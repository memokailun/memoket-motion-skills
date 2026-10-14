#!/usr/bin/env python3
"""check_sync.py: every voice line starts after its caption appears, ends before it leaves, and is really present at
that spot in the audio (normalised correlation of the take against the audio above --min, default 0.95; the first line
often reads 0.97 to 0.99 because an opening sound sits under it).

  .venv/bin/python <SKILL_DIR>/scripts/check_sync.py out/warp.json out/cues.json out/vo cedar out/mix.wav [--min 0.95]

cues.json must be dumped with the same --warp as the video. Run it twice: on the mix, and on audio decoded back out of
the final mp4 (after loudnorm and AAC):  ffmpeg -i final.mp4 -vn -ac 2 -ar 48000 -c:a pcm_s16le out/decoded.wav
Prints one row per line, "violations N" and a RESULT line; exit code 1 if N > 0, 2 on wrong arguments.
"""
import json, sys
if sys.argv[1:2] in (['-h'], ['--help']): print(__doc__); sys.exit(0)
if len([x for x in sys.argv[1:] if not x.startswith('--')]) < 5: print(__doc__, file=sys.stderr); sys.exit(2)
try:
    import numpy as np
    from scipy.io import wavfile
except ImportError as e:
    print(f'error: the Python package {e.name} is missing. Create the project venv: python3 -m venv .venv && '
          '.venv/bin/pip install -r <SKILL_DIR>/scripts/requirements.txt, then run this script with .venv/bin/python',
          file=sys.stderr)
    sys.exit(2)
SR = 48000
MIN = float(sys.argv[sys.argv.index('--min') + 1]) if '--min' in sys.argv else 0.95
plan = json.load(open(sys.argv[1])); caps = {c['id']: c for c in json.load(open(sys.argv[2]))['captions']}
vodir, voice = sys.argv[3], sys.argv[4]
sr, mix = wavfile.read(sys.argv[5])
if sr != SR: sys.exit(f'error: {sys.argv[5]} is {sr} Hz, expected {SR}')
mix = (mix[:, 0] if mix.ndim > 1 else mix).astype(np.float32) / 32768
bad = 0
for ln in plan['lines']:
    c = caps[ln['id']]; _, x = wavfile.read(f"{vodir}/{voice}/{ln['id']}.wav"); ref = x.astype(np.float32) / 32768
    end = ln['start'] + len(ref) / SR; a = int(round(ln['start'] * SR)); seg = mix[a:a + len(ref)]
    corr = float(np.dot(seg, ref) / (np.linalg.norm(seg) * np.linalg.norm(ref) + 1e-9)) if len(seg) == len(ref) else 0.0
    ok = c['in'] <= ln['start'] + 1e-6 and end <= c['out'] + 1e-6 and corr > MIN
    bad += not ok
    print(f"{ln['id']} caption {c['in']:6.2f}-{c['out']:6.2f}  voice {ln['start']:6.2f}-{end:6.2f}  corr {corr:.2f}  {'ok' if ok else 'VIOLATION'}  {c['text']}")
print('violations', bad)
print('RESULT ' + json.dumps({'lines': len(plan['lines']), 'violations': bad}))
sys.exit(1 if bad else 0)
