#!/usr/bin/env python3
"""vo.py: voice-over takes, one per caption line, with a transcribe-back check. PAID API: every take is one TTS call
plus one transcription call. Read references/voice-and-sound.md first and keep re-rolls capped.

Usage (run from the project folder with the project venv; make, roll and words need OPENAI_API_KEY unless --dry-run):
  .venv/bin/python <SKILL_DIR>/scripts/vo.py make  lines.json out/vo [--voice cedar] [--max-calls 80] [--dry-run]
  .venv/bin/python <SKILL_DIR>/scripts/vo.py roll  lines.json out/vo c02 c05 [--tries 2] [--max-calls 80] [--dry-run]
  .venv/bin/python <SKILL_DIR>/scripts/vo.py use   out/vo c05:3 [c02:1 ...]
  .venv/bin/python <SKILL_DIR>/scripts/vo.py words lines.json out/vo [--max-calls 80] [--dry-run]
  .venv/bin/python <SKILL_DIR>/scripts/vo.py pace  lines.json out/vo

Ask before paying: run make (or roll, or words) with --dry-run first. It prints the planned takes and paid calls as a
RESULT line and exits 0 without calling the API or reading the key. Tell the user the number, wait for a yes, then run
the same command without --dry-run and with --max-calls set to the agreed number.

make   One take per line per voice: 48 kHz mono, silence trimmed to 40 ms pads, transcribed back and compared with the
       caption text (lowercase, hyphens as spaces, punctuation stripped). Cached per wav: re-running only calls the API
       for lines whose voice, text, instructions or model changed. Writes out/vo/<voice>/<id>.wav and out/vo/vo.json.
roll   Fresh takes of identical text for the given ids (TTS is not repeatable: identical text gave 3.48 to 4.79 s).
       Every try is kept in out/vo/_keep/<id>_tryN.wav plus .json (dur, heard, ok, pauses, pace); the current take is
       saved once as try0; nothing becomes active. Capped: --tries per call (default 2) and --cap total tries per id
       (default 6). When a line keeps failing, change how a number is written instead of rolling again.
use    Make kept tries active (they must pass), then run make again to rebuild vo.json from the cache (no API calls).
words  Word times per take (whisper-1 word timestamps, plain and prompted with the line; each misses words on some
       takes) for placing marks on spoken words. Writes out/vo/words.json, cached by wav content.
pace   Syllables per voiced second of every active take (no API calls), to compare takes and spot rushed lines.

Options: --model gpt-4o-mini-tts  --stt gpt-4o-transcribe  --instructions "delivery note" (else lines.json
"instructions")  --max-calls N (default 80; refuse to start if the run would need more paid calls)  --dry-run.
The key is read only from OPENAI_API_KEY, only when a call is made, and never written anywhere.
"""
import hashlib, json, os, re, shutil, subprocess, sys, tempfile
from concurrent.futures import ThreadPoolExecutor

DEFAULT_INSTR = ('A calm, precise engineer explaining a real finding to other developers. Conversational and plain, '
                 'a little understated, never salesy or dramatic. Natural pace, clear diction.')
API = 'https://api.openai.com/v1'


def die(msg):
    print('error: ' + msg, file=sys.stderr); sys.exit(2)


def opt(args, k, d=None):
    return args[args.index(k) + 1] if k in args else d


def key():
    k = os.environ.get('OPENAI_API_KEY')
    if not k: die('OPENAI_API_KEY is not set. Voice takes are a paid API call; ask the user for a key, or build the '
                  'timing sheet with timing.py --estimate and record later.')
    return k


def requests_mod():
    try:
        import requests
        return requests
    except ImportError:
        die('needs the requests package. Create the project venv: python3 -m venv .venv && .venv/bin/pip install -r '
            '<SKILL_DIR>/scripts/requirements.txt, then run this script with .venv/bin/python')


def tts(text, voice, instr, model):
    r = requests_mod().post(f'{API}/audio/speech', timeout=120, headers={'Authorization': f'Bearer {key()}'},
                            json={'model': model, 'voice': voice, 'input': text, 'instructions': instr, 'response_format': 'wav'})
    r.raise_for_status(); return r.content


def transcribe(path, model, prompt=None, words=False):
    data = {'model': model}
    if prompt: data['prompt'] = prompt
    if words: data.update({'response_format': 'verbose_json', 'timestamp_granularities[]': 'word'})
    with open(path, 'rb') as f:
        r = requests_mod().post(f'{API}/audio/transcriptions', timeout=120, headers={'Authorization': f'Bearer {key()}'},
                                files={'file': ('a.wav', f, 'audio/wav')}, data=data)
    r.raise_for_status()
    return r.json() if words else r.json()['text']


def norm(s):
    s = s.lower().replace('-', ' ')
    s = re.sub(r"[^a-z0-9' ]", ' ', s)
    return ' '.join(s.split())


def trim_to_48k(raw_bytes, out_path):
    """Resample to 48 kHz mono, trim to 40 ms around the voice (10 ms RMS, -45 dB under peak), 8 ms fades."""
    import numpy as np
    from scipy.io import wavfile
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as t:
        t.write(raw_bytes); tmp = t.name
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp, '-ac', '1', '-ar', '48000', tmp + '.48.wav'], check=True)
    sr, x = wavfile.read(tmp + '.48.wav'); os.remove(tmp); os.remove(tmp + '.48.wav')
    x = x.astype(np.float32) / (32768 if x.dtype == np.int16 else 1)
    win = int(0.01 * sr)
    env = np.sqrt(np.convolve(x ** 2, np.ones(win) / win, mode='same'))
    thr = 10 ** (-45 / 20) * max(1e-6, float(np.max(np.abs(x))))
    idx = np.where(env > thr)[0]
    a, b = (idx[0], idx[-1]) if len(idx) else (0, len(x) - 1)
    pad = int(0.04 * sr)
    y = x[max(0, a - pad):min(len(x), b + pad)].copy()
    fade = int(0.008 * sr); y[:fade] *= np.linspace(0, 1, fade); y[-fade:] *= np.linspace(1, 0, fade)
    os.makedirs(os.path.dirname(out_path) or '.', exist_ok=True)
    wavfile.write(out_path, sr, (y * 32767).astype(np.int16))
    return round(len(y) / sr, 4)


def silences(wav, noise='-35dB', d=0.12):
    e = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', wav, '-af', f'silencedetect=noise={noise}:d={d}', '-f', 'null', '-'],
                       capture_output=True, text=True).stderr
    st = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', e)]
    en = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', e)]
    return [(round(a, 3), round(b, 3)) for a, b in zip(st, en)]


def syllables(text):
    n = 0
    for tok in re.findall(r"[A-Za-z']+|\d[\d,.]*", text):
        if tok[0].isdigit(): n += 2 * len(re.findall(r'\d+', tok)); continue
        w = tok.lower().replace("'", '')
        c = len(re.findall(r'[aeiouy]+', w))
        if w.endswith('e') and not w.endswith(('le', 'ee')) and c > 1: c -= 1
        if w.endswith('ed') and not w.endswith(('ted', 'ded')) and c > 1: c -= 1
        n += max(1, c)
    return n


def pace(wav, text, dur):
    voiced = dur - sum(b - a for a, b in silences(wav))
    return round(syllables(text) / max(0.1, voiced), 2)


def load_cfg(args):
    p = args[0] if args else die('give lines.json')
    if not os.path.exists(p): die(f'{p} not found')
    cfg = json.load(open(p))
    instr = opt(args, '--instructions') or cfg.get('instructions') or DEFAULT_INSTR
    return cfg, instr, opt(args, '--model', 'gpt-4o-mini-tts'), opt(args, '--stt', 'gpt-4o-transcribe')


def cache_key(voice, text, instr, model):
    return hashlib.sha1(f'{voice}|{text}|{instr}|{model}'.encode()).hexdigest()


def budget(args, mode, takes, calls, note=''):
    """Print the plan before any paid call; stop on --dry-run (exit 0) or when --max-calls is exceeded (exit 2)."""
    print(f'{mode}: {takes} take(s), {calls} paid API call(s){note}', flush=True)
    try: cap = int(opt(args, '--max-calls', 80))
    except ValueError: die('--max-calls needs a whole number')
    if '--dry-run' in args:
        print('RESULT ' + json.dumps({'mode': mode, 'dryRun': True, 'takes': takes, 'paidCalls': calls, 'maxCalls': cap}))
        sys.exit(0)
    if calls > cap: die(f'{calls} calls exceed --max-calls {cap}; raise it only if the user agreed to the cost')


def make(args):
    cfg, instr, model, stt = load_cfg(args)
    out = args[1] if len(args) > 1 else die('give the output folder')
    voices = opt(args, '--voice', 'cedar').split(',')
    cache_p = os.path.join(out, 'cache.json'); cache = json.load(open(cache_p)) if os.path.exists(cache_p) else {}
    todo = [(ln, v) for ln in cfg['lines'] for v in voices
            if cache.get(os.path.join(out, v, ln['id'] + '.wav'), {}).get('k') != cache_key(v, ln['text'], instr, model)
            or not os.path.exists(os.path.join(out, v, ln['id'] + '.wav'))]
    budget(args, 'make', len(todo), 2 * len(todo), f' (TTS {model} plus transcription {stt})')
    os.makedirs(out, exist_ok=True)
    res = []
    for ln in cfg['lines']:
        row = {'id': ln['id'], 'text': ln['text'], 'dur': {}, 'heard': {}, 'ok': {}}
        for v in voices:
            p = os.path.join(out, v, ln['id'] + '.wav'); k = cache_key(v, ln['text'], instr, model)
            if cache.get(p, {}).get('k') == k and os.path.exists(p):
                row['dur'][v], row['heard'][v] = cache[p]['dur'], cache[p]['heard']
            else:
                d = trim_to_48k(tts(ln['text'], v, instr, model), p)
                h = transcribe(p, stt)
                cache[p] = {'k': k, 'dur': d, 'heard': h}; row['dur'][v], row['heard'][v] = d, h
                json.dump(cache, open(cache_p, 'w'), indent=1)
            row['ok'][v] = norm(row['heard'][v]) == norm(ln['text'])
        res.append(row)
        flag = '' if all(row['ok'].values()) else '   FLAG transcript differs: ' + ' | '.join(f"{v}: {row['heard'][v]}" for v in voices if not row['ok'][v])
        print(f"{ln['id']:>5} " + ' '.join(f"{v} {row['dur'][v]:.2f}s" for v in voices) + f"  {ln['text']}{flag}")
    json.dump({'voices': voices, 'instructions': instr, 'model': model, 'lines': res}, open(os.path.join(out, 'vo.json'), 'w'), indent=1)
    bad = [r['id'] for r in res if not all(r['ok'].values())]
    print(f'vo.json written; flagged: {", ".join(bad) if bad else "none"}')
    print('RESULT ' + json.dumps({'mode': 'make', 'takes': len(todo), 'paidCalls': 2 * len(todo), 'lines': len(res), 'flagged': bad}))


def roll(args):
    cfg, instr, model, stt = load_cfg(args)
    out = args[1] if len(args) > 1 else die('give the vo folder')
    lines = {l['id']: l['text'] for l in cfg['lines']}
    ids = [a for a in args[2:] if a in lines]
    if not ids: die('give the caption ids to re-roll')
    voice = opt(args, '--voice', 'cedar'); tries = int(opt(args, '--tries', 2)); cap = int(opt(args, '--cap', 6))
    keep = os.path.join(out, '_keep')
    cache_p = os.path.join(out, 'cache.json'); cache = json.load(open(cache_p)) if os.path.exists(cache_p) else {}
    jobs = []
    for i in ids:
        n0 = 1
        while os.path.exists(os.path.join(keep, f'{i}_try{n0}.wav')): n0 += 1
        if n0 - 1 + tries > cap: die(f'{i} already has {n0 - 1} tries; the cap is {cap}. Reword how a number is written, '
                                     f'accept a passing take, or ask the director (raise --cap only with the user\'s agreement)')
        jobs += [(i, n) for n in range(n0, n0 + tries)]
    budget(args, 'roll', len(jobs), 2 * len(jobs))
    os.makedirs(keep, exist_ok=True)
    for i in ids:                       # keep the current take once as try0 before any new try
        p = os.path.join(out, voice, i + '.wav')
        t0 = os.path.join(keep, f'{i}_try0.wav')
        if os.path.exists(p) and not os.path.exists(t0) and p in cache:
            shutil.copy(p, t0); c = cache[p]
            json.dump({'k': c['k'], 'dur': c['dur'], 'heard': c['heard'], 'ok': norm(c['heard']) == norm(lines[i]),
                       'pauses': silences(t0), 'pace': pace(t0, lines[i], c['dur'])}, open(t0[:-4] + '.json', 'w'))

    def run(job):
        i, n = job; q = os.path.join(keep, f'{i}_try{n}.wav')
        err = None
        for _ in range(3):
            try:
                d = trim_to_48k(tts(lines[i], voice, instr, model), q); h = transcribe(q, stt); break
            except Exception as e:
                err = e
        else:
            return f'{i} try {n}: FAILED {err}'
        j = {'k': cache_key(voice, lines[i], instr, model), 'dur': d, 'heard': h, 'ok': norm(h) == norm(lines[i]),
             'pauses': silences(q), 'pace': pace(q, lines[i], d)}
        json.dump(j, open(q[:-4] + '.json', 'w'))
        return f"{i} try {n}: {d:.2f}s ok={j['ok']} pace={j['pace']} syl/s pauses={j['pauses']} heard={h!r}"

    with ThreadPoolExecutor(4) as ex:
        for r in ex.map(run, jobs): print(r, flush=True)
    print('listen, then activate one with: vo.py use', out, 'ID:N')


def use(args):
    out = args[0] if args else die('give the vo folder')
    voice = opt(args, '--voice', 'cedar')
    cache_p = os.path.join(out, 'cache.json'); c = json.load(open(cache_p)) if os.path.exists(cache_p) else {}
    for a in [x for x in args[1:] if ':' in x]:
        i, n = a.split(':')
        j = json.load(open(os.path.join(out, '_keep', f'{i}_try{n}.json')))
        if not j.get('ok'): die(f'{a} fails transcribe-back ({j["heard"]}); pick a passing take')
        p = os.path.join(out, voice, i + '.wav'); os.makedirs(os.path.dirname(p), exist_ok=True)
        shutil.copy(os.path.join(out, '_keep', f'{i}_try{n}.wav'), p)
        c[p] = {'k': j['k'], 'dur': j['dur'], 'heard': j['heard']}
        print('using', a, f"{j['dur']:.2f}s", j['heard'])
    json.dump(c, open(cache_p, 'w'), indent=1)
    print('now run: vo.py make <lines.json>', out, '(rebuilds vo.json from the cache, no API calls)')


def load_vo(out):
    p = os.path.join(out, 'vo.json')
    if not os.path.exists(p): die(f'{p} missing; run vo.py make first')
    return json.load(open(p))


def words(args):
    cfg, _, _, _ = load_cfg(args)
    out = args[1] if len(args) > 1 else die('give the vo folder')
    vo = load_vo(out)
    voice = opt(args, '--voice', vo['voices'][0])
    wp = os.path.join(out, 'words.json'); res = json.load(open(wp)) if os.path.exists(wp) else {}
    texts = {l['id']: l['text'] for l in cfg['lines']}

    def whisper(p, prompt=None):
        j = transcribe(p, 'whisper-1', prompt, words=True)
        return [(w['word'], round(w['start'], 2), round(w['end'], 2)) for w in j.get('words', [])]
    keys, planned = {}, 0
    for ln in vo['lines']:
        p = os.path.join(out, voice, ln['id'] + '.wav')
        if not os.path.exists(p): die(f'{p} missing; run vo.py make first')
        keys[ln['id']] = k = hashlib.sha1(open(p, 'rb').read()).hexdigest()
        r = res.get(ln['id'], {}) if res.get(ln['id'], {}).get('k') == k else {}
        planned += ('plain' not in r) + ('prompted' not in r)
    budget(args, 'words', len(vo['lines']), planned, ' (whisper-1 word timestamps)')
    calls = 0
    for ln in vo['lines']:
        p = os.path.join(out, voice, ln['id'] + '.wav'); k = keys[ln['id']]
        r = res.get(ln['id'], {})
        if r.get('k') != k: r = {'k': k}
        if 'plain' not in r: r['plain'] = whisper(p); calls += 1
        if 'prompted' not in r: r['prompted'] = whisper(p, texts.get(ln['id'], ln['text'])); calls += 1
        r['dur'] = ln['dur'][voice]; r['silences'] = silences(p)
        res[ln['id']] = r
        json.dump(res, open(wp, 'w'), indent=0)
    print(f'words.json written ({calls} paid transcription calls)')
    print('RESULT ' + json.dumps({'mode': 'words', 'paidCalls': calls, 'lines': len(vo['lines'])}))


def pace_cmd(args):
    cfg, _, _, _ = load_cfg(args)
    out = args[1] if len(args) > 1 else die('give the vo folder')
    vo = load_vo(out)
    rates = []
    for ln in vo['lines']:
        for v, d in ln['dur'].items():
            p = os.path.join(out, v, ln['id'] + '.wav'); r = pace(p, ln['text'], d); rates.append(r)
            print(f"{ln['id']} {v} {d:5.2f}s {r:5.2f} syl/s voiced  {ln['text']}")
    if rates: print(f'median {sorted(rates)[len(rates) // 2]:.2f} syl/s voiced')


if __name__ == '__main__':
    a = sys.argv[1:]
    if a[:1] in (['-h'], ['--help']): print(__doc__); sys.exit(0)
    if not a: print(__doc__, file=sys.stderr); sys.exit(2)
    cmds = {'make': make, 'roll': roll, 'use': use, 'words': words, 'pace': pace_cmd}
    if a[0] not in cmds: die('first argument must be make, roll, use, words or pace (see --help)')
    cmds[a[0]](a[1:])
