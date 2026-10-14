#!/usr/bin/env python3
"""alive.py: still stretches in a rendered video (camera drift ignored). Frames at 10 fps are scaled to 240x135 grey,
so sub-pixel drift vanishes; a frame counts as moving when more than 6 small pixels changed by more than 18 levels
against the frame 0.3 s earlier. Captions count as motion here, so read results next to stillness.mjs (captions
hidden) and the contact sheets.

  .venv/bin/python <SKILL_DIR>/scripts/alive.py out/draft.mp4 [min_seconds=1.6]

Rule: no still stretch over about 2 s except a finished image held under its caption or the last frame.
"""
import subprocess, sys
if sys.argv[1:2] in (['-h'], ['--help']): print(__doc__); sys.exit(0)
if len(sys.argv) < 2: print(__doc__, file=sys.stderr); sys.exit(2)
try:
    import numpy as np
except ImportError as e:
    print(f'error: the Python package {e.name} is missing. Create the project venv: python3 -m venv .venv && '
          '.venv/bin/pip install -r <SKILL_DIR>/scripts/requirements.txt, then run this script with .venv/bin/python',
          file=sys.stderr)
    sys.exit(2)
vid = sys.argv[1]; mins = float(sys.argv[2]) if len(sys.argv) > 2 else 1.6
W, H, FPS, LAG = 240, 135, 10, 3
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', vid, '-vf', f'fps={FPS},scale={W}:{H}:flags=area,format=gray', '-f', 'rawvideo', '-'],
                     capture_output=True, check=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(np.int16)
mov = [True] * LAG + [int((np.abs(fr[i] - fr[i - LAG]) > 18).sum()) > 6 for i in range(LAG, len(fr))]
runs, s = [], None
for i, m in enumerate(mov + [True]):
    if not m and s is None: s = i
    if m and s is not None:
        if (i - s) / FPS >= mins: runs.append((s / FPS, i / FPS))
        s = None
print(f'{len(fr)} frames at {FPS} fps; still stretches of {mins} s or more:')
for a, b in runs: print(f'  {a:6.1f} to {b:6.1f}  ({b - a:.1f} s)')
