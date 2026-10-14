#!/usr/bin/env python3
"""review_sheets.py: labelled contact sheets for reading a film frame by frame (needs ffmpeg and Pillow).

  .venv/bin/python <SKILL_DIR>/scripts/review_sheets.py video   out/final.mp4 out/sheets [--step 1] [--cols 4] [--tile 480]
  .venv/bin/python <SKILL_DIR>/scripts/review_sheets.py at      out/final.mp4 out/phone.png --times 0,0.5,1,6,12 [--tile 390] [--cols 5]
  .venv/bin/python <SKILL_DIR>/scripts/review_sheets.py windows out/final.mp4 out/sweeps --step 0.25 slide1:14.2:15.4 hook:0:3
  .venv/bin/python <SKILL_DIR>/scripts/review_sheets.py tile    out/sheet.png 0 a.png 1.5 b.png [--tile 640] [--cols 4]

video    one frame every --step seconds (labels are frame-centre times), 16 tiles per sheet; read every sheet
at       the given times on one sheet; --tile 390 is the phone check (a 16:9 video in a feed is about 390 pt wide)
windows  frames every --step seconds through named windows name:t0:t1 (slides, morphs, handoffs: 0.25 s; cuts: 0.067)
tile     tile existing PNGs given as time and file pairs (render.mjs --sheet uses this)
Tiles keep the frame's aspect ratio (16:9 or 1:1). Prints the sheet paths.
"""
import os, subprocess, sys, tempfile


def die(msg):
    print('error: ' + msg, file=sys.stderr); sys.exit(2)


def opt(args, k, d=None):
    return args[args.index(k) + 1] if k in args else d


def pil():
    try:
        from PIL import Image, ImageDraw, ImageFont
        return Image, ImageDraw, ImageFont
    except ImportError:
        die('needs Pillow. Create the project venv: python3 -m venv .venv && .venv/bin/pip install -r '
            '<SKILL_DIR>/scripts/requirements.txt, then run this script with .venv/bin/python')


def font(size):
    _, _, ImageFont = pil()
    for p in ('/System/Library/Fonts/Menlo.ttc', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 'C:/Windows/Fonts/consola.ttf'):
        if os.path.exists(p):
            try: return ImageFont.truetype(p, size)
            except Exception: pass
    try: return ImageFont.load_default(size=size)
    except TypeError: return ImageFont.load_default()


def tile(out, items, tw=480, cols=4):
    Image, ImageDraw, _ = pil()
    if not items: die('no frames to tile')
    im0 = Image.open(items[0][1]); th = round(tw * im0.height / im0.width)
    lab, pad = 26, 6
    rows = (len(items) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * (tw + pad) + pad, rows * (th + lab + pad) + pad), (24, 24, 24))
    d = ImageDraw.Draw(sheet); f = font(17)
    for i, (t, p) in enumerate(items):
        im = Image.open(p).convert('RGB').resize((tw, th), Image.LANCZOS)
        x, y = pad + (i % cols) * (tw + pad), pad + (i // cols) * (th + lab + pad)
        sheet.paste(im, (x, y + lab)); d.text((x + 4, y + 4), f't = {float(t):.2f} s', fill=(235, 235, 235), font=f)
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    sheet.save(out); print(out)


def grab(video, t, path):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{t:.3f}', '-i', video, '-frames:v', '1', path], check=True)


def duration(video):
    return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video],
                                capture_output=True, text=True, check=True).stdout)


def main(a):
    if a[:1] in (['-h'], ['--help']): print(__doc__); return
    if len(a) < 3: print(__doc__, file=sys.stderr); sys.exit(2)
    cmd, rest = a[0], a[1:]
    tw, cols = int(opt(rest, '--tile', 480)), int(opt(rest, '--cols', 4))
    if cmd == 'tile':
        pos = [x for i, x in enumerate(rest) if not x.startswith('--') and (i == 0 or not rest[i - 1].startswith('--'))]
        out, pairs = pos[0], pos[1:]
        tile(out, [(pairs[i], pairs[i + 1]) for i in range(0, len(pairs), 2)], int(opt(rest, '--tile', 640)), cols)
    elif cmd == 'video':
        video, outdir = rest[0], rest[1]; step = float(opt(rest, '--step', 1))
        fr = os.path.join(outdir, 'frames'); os.makedirs(fr, exist_ok=True)
        for f in os.listdir(fr):
            if f.endswith('.png'): os.remove(os.path.join(fr, f))
        subprocess.run(['ffmpeg', '-v', 'error', '-i', video, '-vf', f'fps=1/{step}', os.path.join(fr, 'f_%05d.png')], check=True)
        files = sorted(os.listdir(fr))
        items = [(round(i * step + step / 2, 2), os.path.join(fr, f)) for i, f in enumerate(files)]
        for s in range(0, len(items), 16): tile(os.path.join(outdir, f'sheet_{s // 16:02d}.png'), items[s:s + 16], tw, cols)
        print(f'duration {duration(video):.2f} s, {len(items)} frames')
    elif cmd == 'at':
        video, out = rest[0], rest[1]
        times = [float(x) for x in (opt(rest, '--times') or die('--times is required')).split(',')]
        tmp = tempfile.mkdtemp(prefix='sheet-')
        items = []
        for t in times:
            p = os.path.join(tmp, f't{t:08.3f}.png'); grab(video, t, p); items.append((t, p))
        tile(out, items, int(opt(rest, '--tile', 390)), int(opt(rest, '--cols', 5)))
    elif cmd == 'windows':
        video, outdir = rest[0], rest[1]; step = float(opt(rest, '--step', 0.25))
        specs = [x for x in rest[2:] if x.count(':') == 2]
        for spec in specs:
            name, t0, t1 = spec.split(':'); t, items = float(t0), []
            while t <= float(t1) + 1e-6:
                p = os.path.join(outdir, name, f'{name}_{t:08.3f}.png'); os.makedirs(os.path.dirname(p), exist_ok=True)
                grab(video, t, p); items.append((t, p)); t += step
            tile(os.path.join(outdir, name + '.png'), items, tw, cols)
    else:
        die('first argument must be video, at, windows or tile (see --help)')


if __name__ == '__main__':
    main(sys.argv[1:])
