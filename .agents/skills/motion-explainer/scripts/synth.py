#!/usr/bin/env python3
"""synth.py: procedural sound design from the scene's cues (pure numpy and scipy, seeded: the same cues give the same
audio). Sound is a quiet second layer; the film must work muted.

  .venv/bin/python <SKILL_DIR>/scripts/synth.py out/cues.json out/sfx.wav [--seed 7]

cues.json is the file render.mjs --cues writes: {"duration": s, "cues": [{"t": s, "type": ..., ...}], "bed": {...}}.
Cue types. Every gain is in dB RELATIVE TO THE TYPE'S OWN LEVEL (0 = its default), not an absolute level; a design
that wrote absolute levels came out near silent.
  tick      soft dry click (pen contact, rhythm)    {gain}
  key       one keystroke                            {gain}
  type      a run of keystrokes                      {n, rate (keys/s), gain}
  pluck     glassy felt-mallet note (a landing)      {note: 'A4' | freq, gain, decay}
  chord     staggered plucks                         {notes: ['D4','F#4','A4'], spread (s), gain}
  whoosh    airy filtered noise, sin^2 envelope      {dur, dir: 'up'|'down', gain}  centre it on the move's peak speed
  thud      low, soft, muted knock                   {gain}
  deny      two soft descending notes                {gain}  (can read as a game-show sting; use sparingly)
  swell     soft pad breath                          {dur, notes, gain}
Any cue may carry pan in [-1, 1].
Bed (optional, very quiet, starts at 0 and fades in over `fade` s): {"notes": ["A2", "E3"], "gain": -33, "fade": 4}.
Output: 48 kHz stereo 16-bit, duration + 1 s, a small decorrelated room, peak limited to 0.98.
"""
import json, sys
if __name__ == '__main__':
    if sys.argv[1:2] in (['-h'], ['--help']): print(__doc__); sys.exit(0)
    if len(sys.argv) < 3: print(__doc__, file=sys.stderr); sys.exit(2)
try:
    import numpy as np
    from scipy.signal import butter, sosfilt, fftconvolve
except ImportError as e:
    print(f'error: the Python package {e.name} is missing. Create the project venv: python3 -m venv .venv && '
          '.venv/bin/pip install -r <SKILL_DIR>/scripts/requirements.txt, then run this script with .venv/bin/python',
          file=sys.stderr)
    sys.exit(2)

SR = 48000
rng = np.random.default_rng(int(sys.argv[sys.argv.index('--seed') + 1]) if '--seed' in sys.argv else 7)

def note_hz(n):
    if isinstance(n, (int, float)): return float(n)
    names = {'C': -9, 'D': -7, 'E': -5, 'F': -4, 'G': -2, 'A': 0, 'B': 2}
    base = names[n[0].upper()]; i = 1
    if len(n) > 2 or (len(n) == 2 and not n[1].isdigit()):
        if n[1] == '#': base += 1; i = 2
        elif n[1] == 'b': base -= 1; i = 2
    octave = int(n[i:])
    return 440.0 * 2 ** ((base + (octave - 4) * 12) / 12)

def db(x): return 10 ** (x / 20)
def t_axis(d): return np.arange(int(d * SR)) / SR
def bp(x, lo, hi, order=2): return sosfilt(butter(order, [lo, hi], 'band', fs=SR, output='sos'), x)
def lp(x, f, order=2): return sosfilt(butter(order, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, order=2): return sosfilt(butter(order, f, 'high', fs=SR, output='sos'), x)

def tick(gain=0):
    t = t_axis(0.03)
    s = bp(rng.standard_normal(len(t)), 2500, 7000) * np.exp(-t / 0.004) * 0.5
    s += np.sin(2 * np.pi * 1850 * t) * np.exp(-t / 0.008) * 0.25
    return s * db(-14 + gain)

def key(gain=0):
    t = t_axis(0.045)
    body = bp(rng.standard_normal(len(t)), 900, 3200) * np.exp(-t / 0.006)
    click = bp(rng.standard_normal(len(t)), 3000, 9000) * np.exp(-t / 0.0015) * 0.6
    return (body + click) * db(-22 + gain + rng.uniform(-2, 1))

def typing(n=8, rate=11, gain=0):
    d = n / rate + 0.1
    out = np.zeros(int(d * SR))
    for i in range(int(n)):
        at = int((i / rate + rng.uniform(-0.012, 0.012)) * SR)
        k = key(gain); at = max(0, at)
        out[at:at + len(k)] += k[:len(out) - at]
    return out

def pluck(note='A4', gain=0, decay=0.9):
    f = note_hz(note); t = t_axis(decay * 2.2)
    s = np.zeros_like(t)
    for mult, amp, dk in ((1, 1.0, 1.0), (2.0, 0.28, 0.45), (3.01, 0.12, 0.3), (4.2, 0.06, 0.18)):
        s += amp * np.sin(2 * np.pi * f * mult * t) * np.exp(-t / (decay * dk))
    s *= np.minimum(1, t / 0.004)
    return lp(s, 6000) * db(-17 + gain)

def chord(notes=('D4', 'F#4', 'A4'), spread=0.035, gain=0):
    parts = [pluck(n, gain - 3, 1.2) for n in notes]
    L = max(len(p) for p in parts) + int(spread * SR * len(parts))
    out = np.zeros(L)
    for i, p in enumerate(parts):
        a = int(i * spread * SR); out[a:a + len(p)] += p
    return out

def whoosh(dur=0.7, dir='up', gain=0):
    t = t_axis(dur); n = rng.standard_normal(len(t))
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 2
    lo, hi = (400, 5000) if dir == 'up' else (5000, 400)
    out = np.zeros_like(t); seg = int(0.02 * SR)
    for a in range(0, len(t), seg):
        c = lo * (hi / lo) ** (a / len(t))
        out[a:a + seg] = bp(n[a:a + seg + 512], c * 0.7, min(c * 1.4, 20000))[:len(out[a:a + seg])]
    return lp(out * env, 9000) * db(-26 + gain)

def thud(gain=0):
    t = t_axis(0.5)
    f = 95 * np.exp(-t / 0.25) + 55
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.12)
    s += lp(rng.standard_normal(len(t)), 400) * np.exp(-t / 0.02) * 0.3
    return s * db(-16 + gain)

def deny(gain=0):
    a = pluck('E4', gain - 4, 0.35); b = pluck('C4', gain - 4, 0.5)
    out = np.zeros(len(a) + int(0.11 * SR) + len(b))
    out[:len(a)] += lp(a, 2500); out[int(0.11 * SR):int(0.11 * SR) + len(b)] += lp(b, 2500)
    return out

def swell(dur=2.5, notes=('D3', 'A3', 'F#4'), gain=0):
    t = t_axis(dur); s = np.zeros_like(t)
    for n in notes:
        f = note_hz(n)
        for det in (-0.12, 0.0, 0.13):
            ph = rng.uniform(0, 2 * np.pi)
            s += np.sin(2 * np.pi * f * (1 + det / 100) * t + ph) + 0.25 * np.sin(2 * np.pi * 2 * f * t + ph)
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.5
    return lp(s * env, 2200) * db(-32 + gain) / len(notes)

def bed(duration, notes=('D3', 'A3', 'E4', 'F#4'), gain=-30, fade=3):
    t = t_axis(duration); s = np.zeros_like(t)
    for i, n in enumerate(notes):
        f = note_hz(n)
        lfo = 0.6 + 0.4 * np.sin(2 * np.pi * (0.05 + 0.017 * i) * t + i)
        for det in (-0.08, 0.09):
            s += lfo * np.sin(2 * np.pi * f * (1 + det / 100) * t + rng.uniform(0, 6.28))
    s = lp(s, 1400) / (2 * len(notes))
    env = np.minimum(1, np.minimum(t / fade, (duration - t) / fade)).clip(0, 1)
    return s * env * db(gain)

GEN = {'tick': tick, 'key': key, 'pluck': pluck, 'chord': chord, 'whoosh': whoosh, 'thud': thud, 'deny': deny, 'swell': swell}

def main(cfg_path, out_path):
    cfg = json.load(open(cfg_path))
    dur = float(cfg['duration']) + 1.0
    L = int(dur * SR)
    dry = np.zeros((L, 2))
    for c in cfg.get('cues', []):
        typ = c.get('type'); kw = {k: v for k, v in c.items() if k not in ('t', 'type', 'pan', 'label')}
        if typ == 'type': s = typing(**kw)
        elif typ in GEN: s = GEN[typ](**kw)
        else: print('skip unknown cue', typ); continue
        a = int(float(c['t']) * SR); b = min(L, a + len(s))
        if a >= L: continue
        pan = float(c.get('pan', 0.0)); gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        dry[a:b, 0] += s[:b - a] * gl * 1.414; dry[a:b, 1] += s[:b - a] * gr * 1.414
    # small room: decorrelated exponential-noise IR
    irt = t_axis(1.6)
    ir = [hp(lp(rng.standard_normal(len(irt)), 7000), 150) * np.exp(-irt / 0.45) for _ in range(2)]
    wet = np.stack([fftconvolve(dry[:, i], ir[i])[:L] for i in range(2)], 1)
    wet *= 0.18 / (np.sqrt(np.sum(ir[0] ** 2)) + 1e-9)
    mix = dry + wet
    if cfg.get('bed') is not None:
        b = cfg['bed']; bb = bed(float(cfg['duration']), tuple(b.get('notes', ('D3', 'A3', 'E4', 'F#4'))), b.get('gain', -30), b.get('fade', 3))
        mix[:len(bb), 0] += bb; mix[:len(bb), 1] += bb
    peak = np.max(np.abs(mix)) + 1e-9
    if peak > 0.98: mix *= 0.98 / peak
    from scipy.io import wavfile
    wavfile.write(out_path, SR, (mix * 32767).astype(np.int16))
    print(f'audio: {len(cfg.get("cues", []))} cues, {dur:.1f}s, peak {20*np.log10(peak):.1f} dBFS, written to {out_path}')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
