#!/usr/bin/env python3
"""mix.py: place the voice takes over the sound design and duck the sound under speech.

  .venv/bin/python <SKILL_DIR>/scripts/mix.py out/warp.json out/vo cedar out/sfx.wav out/mix.wav [--sfx-db -4] [--duck-db -7]

warp.json is plan_vo.mjs output: lines[].start is each take's start in output time. Takes are <vo>/<voice>/<id>.wav.
The sound design is lowered by --sfx-db overall and ducked a further --duck-db while a line speaks (60 ms attack,
250 ms release); voice at 0.9; the whole mix is scaled down if its peak passes 0.97. Everything must be 48 kHz.
Then: mux.sh (loudness and AAC) and check_sync.py (on this mix and again on audio decoded from the final mp4).
"""
import json, sys
if sys.argv[1:2] in (['-h'], ['--help']): print(__doc__); sys.exit(0)
if len(sys.argv) < 6: print(__doc__, file=sys.stderr); sys.exit(2)
try:
    import numpy as np
    from scipy.io import wavfile
except ImportError as e:
    print(f'error: the Python package {e.name} is missing. Create the project venv: python3 -m venv .venv && '
          '.venv/bin/pip install -r <SKILL_DIR>/scripts/requirements.txt, then run this script with .venv/bin/python',
          file=sys.stderr)
    sys.exit(2)
SR = 48000
warp, vodir, voice, sfx_p, out = sys.argv[1:6]
opt = lambda k, d: float(sys.argv[sys.argv.index(k) + 1]) if k in sys.argv else d
plan = json.load(open(warp))
sr, sfx = wavfile.read(sfx_p)
if sr != SR: sys.exit(f'error: {sfx_p} is {sr} Hz, expected {SR}')
sfx = sfx.astype(np.float32) / 32768
if sfx.ndim == 1: sfx = np.stack([sfx, sfx], 1)
L = max(len(sfx), int((plan['outDuration'] + 1) * SR))
mix = np.zeros((L, 2), np.float32); mix[:len(sfx)] = sfx * 10 ** (opt('--sfx-db', -4) / 20)
voice_env = np.zeros(L, np.float32); vo = np.zeros(L, np.float32)
for ln in plan['lines']:
    r, x = wavfile.read(f"{vodir}/{voice}/{ln['id']}.wav")
    if r != SR: sys.exit(f"error: take {ln['id']} is {r} Hz, expected {SR}")
    x = x.astype(np.float32) / 32768
    a = int(ln['start'] * SR); b = min(L, a + len(x))
    vo[a:b] += x[:b - a]; voice_env[a:b] = 1
att, rel = int(0.06 * SR), int(0.25 * SR)       # duck envelope with attack and release smoothing
env = np.zeros(L, np.float32); g = 0.0
for i in range(0, L, 64):
    target = voice_env[i]
    g += (target - g) * (64 / att if target > g else 64 / rel); g = min(1, max(0, g)); env[i:i + 64] = g
mix *= (10 ** (opt('--duck-db', -7) * env / 20))[:, None]
mix += np.stack([vo, vo], 1) * 0.9
peak = np.max(np.abs(mix)) + 1e-9
if peak > 0.97: mix *= 0.97 / peak
wavfile.write(out, SR, (mix * 32767).astype(np.int16))
print(f'mix: {len(plan["lines"])} lines, voice {voice}, {L / SR:.1f}s, written to {out}')
