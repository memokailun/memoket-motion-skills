#!/usr/bin/env bash
# mux.sh: loudness-normalise the mix and mux it with the silent video as AAC. The video stream is copied untouched.
#
#   LUFS=-16 bash <SKILL_DIR>/scripts/mux.sh out/silent.mp4 out/mix.wav out/final.mp4
#
# LUFS: integrated loudness target (default -16, right for voiced films in social feeds; -18 suits sound design with
# no voice). True peak -1.5 dBTP, LRA 11, AAC 192 kb/s, 48 kHz stereo, faststart. Silent films skip this step.
# Verify afterwards:  ffmpeg -i out/final.mp4 -af ebur128=peak=true -f null - 2>&1 | tail -12
set -euo pipefail
case "${1:-}" in -h|--help) sed -n '2,8p' "$0"; exit 0 ;; esac
if [ "$#" -ne 3 ]; then sed -n '2,8p' "$0" >&2; exit 2; fi
command -v ffmpeg >/dev/null 2>&1 || { echo "error: ffmpeg 5.1 or newer not found on PATH; install it (brew, apt, winget)" >&2; exit 2; }
LUFS="${LUFS:--16}"
# -shortest is safe because synth.py and mix.py both pad one second past the end of the picture
ffmpeg -y -loglevel error -i "$1" -i "$2" -map 0:v:0 -map 1:a:0 -c:v copy \
  -af "loudnorm=I=${LUFS}:TP=-1.5:LRA=11,aresample=48000" -c:a aac -b:a 192k -ar 48000 -ac 2 -shortest -movflags +faststart "$3"
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,sample_rate,channels -show_entries format=duration -of compact "$3"
