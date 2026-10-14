#!/usr/bin/env python3
"""verify_final.py: compare frames of the final render with fresh stills of the same frames rendered on an idle
machine. Load during a render can raster a glyph wrong (one broken caption glyph, 188 code values); each still goes
through the render's own encode path (lanczos to the output size, bt709 limited yuv420p), so what remains is encode
noise, and a wrong glyph shows as a compact blob of large differences.

  node <SKILL_DIR>/scripts/render.mjs --scene index.html --scale 2 --stills 3.5,41.2 --stilldir out/verify
  .venv/bin/python <SKILL_DIR>/scripts/verify_final.py out/final_silent.mp4 out/verify 105 1236 [--fps 30] [--size 1920x1080]

Frame indices f map to stills named t%06.2f.png at t = f / fps (render.mjs naming). Prints the worst blob per frame.
"""
import json, os, subprocess, sys
a = sys.argv[1:]
if a[:1] in (['-h'], ['--help']): print(__doc__); sys.exit(0)
if len(a) < 3: print(__doc__, file=sys.stderr); sys.exit(2)
try:
    import numpy as np
    from PIL import Image
    from scipy import ndimage
except ImportError as e:
    print(f'error: the Python package {e.name} is missing. Create the project venv: python3 -m venv .venv && '
          '.venv/bin/pip install -r <SKILL_DIR>/scripts/requirements.txt, then run this script with .venv/bin/python',
          file=sys.stderr)
    sys.exit(2)
fps = float(a[a.index('--fps') + 1]) if '--fps' in a else 30
W, H = (a[a.index('--size') + 1] if '--size' in a else '1920x1080').split('x')
pos = [x for i, x in enumerate(a) if not x.startswith('--') and (i == 0 or not a[i - 1].startswith('--'))]
final, sdir, idx = pos[0], pos[1], [int(x) for x in pos[2:]]
os.makedirs(os.path.join(sdir, 'cmp'), exist_ok=True)
worst = []
for f in idx:
    t = f / fps
    still = os.path.join(sdir, f't{t:06.2f}.png')
    if not os.path.exists(still): sys.exit(f'error: {still} missing; render it with --stills {t:.2f}')
    ap, bp = os.path.join(sdir, 'cmp', f's{f:05d}.png'), os.path.join(sdir, 'cmp', f'v{f:05d}.png')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', still, '-vf', f'scale={W}:{H}:flags=lanczos,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,scale=in_color_matrix=bt709:in_range=tv,format=rgb24', ap], check=True)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', final, '-vf', f'select=eq(n\\,{f}),scale=in_color_matrix=bt709:in_range=tv,format=rgb24', '-frames:v', '1', bp], check=True)
    A = np.asarray(Image.open(ap).convert('RGB')).astype(int); B = np.asarray(Image.open(bp).convert('RGB')).astype(int)
    d = np.abs(A - B).max(axis=2); m = d > 48
    lab, n = ndimage.label(ndimage.binary_dilation(m, iterations=2))
    big = int(ndimage.sum(m, lab, range(1, n + 1)).max()) if n else 0
    worst.append((big, f, int(d.max()), float((d > 24).mean())))
    print(f'frame {f:5d} t {t:7.3f}  max {int(d.max()):3d}  >24: {100 * (d > 24).mean():.3f}%  largest blob >48: {big} px')
worst.sort(reverse=True)
print('worst blobs (px, frame, max, share>24):', worst[:5])
print('RESULT ' + json.dumps({'frames': len(idx), 'worstBlobPx': worst[0][0] if worst else 0, 'worstFrame': worst[0][1] if worst else None}))
