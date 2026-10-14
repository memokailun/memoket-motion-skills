#!/usr/bin/env bash
# finish.sh: turn a slowmo master (make_cut.mjs --n SPF, rendered at 30 fps) into the 30 fps delivery file with a
# camera-like motion blur:
#   1. scale to the delivery size (lanczos; a no-op when the master is already that size)
#   2. motion blur: tmix of TAPS consecutive samples (default 9 of 16, half-weight ends = a 180 degree shutter as a
#      trapezoid), then keep one mixed frame per SPF samples. tmix frame n mixes n-T+1..n, its centre is n-(T-1)/2, so
#      keeping n mod SPF = (T-1)/2 (T odd) centres the shutter exactly on the original frame time
#   3. deband the 8-bit paper gradient (touches only flat areas) and add a static luma dither (no "t" flag: the
#      pattern does not change between frames, so still frames stay still and cheap to encode)
#   4. x264 High@4.1, CRF 12, bt709 tags, faststart, no audio stream (sound is muxed later)
#
#   bash <SKILL_DIR>/scripts/hf/finish.sh out/master_x16.mp4 out/silent.mp4 1920 1080
#
# Env: SPF (default 16), TAPS (default "1 2 2 2 2 2 2 2 1"), CRF (default 12), FPS (default 30).
# 16 samples is the tested setting. With 4, a 180 degree shutter would have only 2 or 3 taps, so fast moves would
# likely step (an inference: the notes never recorded why 4x was dropped).
set -euo pipefail
case "${1:-}" in -h|--help) sed -n '2,16p' "$0"; exit 0 ;; esac
if [ "$#" -ne 4 ]; then sed -n '2,16p' "$0" >&2; exit 2; fi
command -v ffmpeg >/dev/null 2>&1 || { echo "error: ffmpeg 5.1 or newer not found on PATH; install it (brew, apt, winget)" >&2; exit 2; }
in=$1; out=$2; W=$3; H=$4
SPF=${SPF:-16}; TAPS=${TAPS:-"1 2 2 2 2 2 2 2 1"}; CRF=${CRF:-12}; FPS=${FPS:-30}
T=$(echo "$TAPS" | wc -w | tr -d ' ')
if [ $((T % 2)) -ne 1 ]; then echo "TAPS must have an odd count" >&2; exit 2; fi
SEL=$(( ((T - 1) / 2) % SPF ))
ffmpeg -v error -y -i "$in" \
  -vf "scale=${W}:${H}:flags=lanczos,tmix=frames=${T}:weights='${TAPS}',select='eq(mod(n\,${SPF})\,${SEL})',setpts=N/(${FPS}*TB),deband=1thr=0.008:2thr=0.008:3thr=0.008:range=48:blur=1,noise=c0s=2:c0f=u,format=yuv420p,setparams=range=tv:color_primaries=bt709:color_trc=bt709:colorspace=bt709" \
  -r "$FPS" -c:v libx264 -preset slow -crf "$CRF" -profile:v high -level 4.1 -bf 2 -g 60 \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -movflags +faststart -an "$out"
ffprobe -v error -show_entries stream=codec_name,profile,level,width,height,r_frame_rate,nb_frames,pix_fmt -show_entries format=duration,size,bit_rate -of compact "$out"
