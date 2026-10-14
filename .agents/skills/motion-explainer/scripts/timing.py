#!/usr/bin/env python3
"""timing.py: build the shared timing sheet (timing.json) from the locked lines and the measured voice takes, or check
an existing sheet against the caption rules. Every engine reads captions, word times and beats from this one file.

Usage (run from the project folder):
  .venv/bin/python <SKILL_DIR>/scripts/timing.py build --lines lines.json --vo out/vo --config timing.config.json --out timing.json
  .venv/bin/python <SKILL_DIR>/scripts/timing.py build --lines lines.json --estimate --config timing.config.json --out timing.json
  .venv/bin/python <SKILL_DIR>/scripts/timing.py check timing.json [--config timing.config.json]

build
  --lines FILE     {"lines": [{"id": "c01", "text": "..."}]}: the locked copy; caption text = spoken words
  --vo DIR         folder written by vo.py (vo.json plus <voice>/<id>.wav). Take lengths are measured, sentence and
                   sub-caption edges come from silences in the take (ffmpeg silencedetect -35 dB, 0.12 s)
  --voice NAME     which voice's takes to time to (default: the longest take across voices, so one silent video
                   serves every voice)
  --words FILE     word times from "vo.py words" (default <vo>/words.json if present); without it, word times are
                   spread over the measured speech by character count (good to about 0.2 s)
  --estimate       no voice yet: take lengths estimated from syllables (rules.est_syllables_per_second). Use for
                   blocking only; re-run with --vo after recording, then re-check every beat anchored to words
  --widths FILE    caption widths from measure_text.mjs (default widths.json if present); else estimated
  --config FILE    rules and per-caption extras (see assets/templates/docs/timing.config.json)
check
  verifies: voice fits (out >= in + lead + take + tail), hold rule (out - in >= hold_per_word * words + hold_base),
  gap rule (next in >= out + gap), one caption at a time, last out == duration. Ends with a RESULT line; exit 1 on any
  violation, 2 on wrong arguments.

Rules (defaults, overridable in the config): voice starts at in + 0.15; caption stays 0.25 s after speech; next
caption at least 0.35 s later; hold at least 0.33 s per word + 0.7 s. plan_vo.mjs uses the same lead and tail, so a
sheet built here gives "holds 0".
"""
import difflib, json, math, os, re, subprocess, sys

DEFAULT_RULES = {'lead': 0.15, 'tail': 0.25, 'gap': 0.35, 'hold_per_word': 0.33, 'hold_base': 0.7, 'sub_swap': 0.15,
                 'pad': 0.04, 'close_hold': 4.0, 'caption_box_px': 1460, 'caption_px': 48, 'est_syllables_per_second': 4.6,
                 'est_pause_sentence': 0.3, 'est_pause_comma': 0.12}
SENT = re.compile(r'(?<=[.?!])\s+|(?<=[.?!]")\s+')
up = lambda x: math.ceil(x * 100 - 1e-6) / 100
r2 = lambda x: round(x + 1e-9, 2)
alnum = lambda w: [x for x in w.lower() if x.isalnum()]


def die(msg):
    print('error: ' + msg, file=sys.stderr); sys.exit(2)


def opt(args, k, d=None):
    return args[args.index(k) + 1] if k in args else d


def clean(text):
    return re.sub(r'\s+', ' ', text.replace('|', ' ')).strip()


def syllables(text):
    n = 0
    for tok in re.findall(r"[A-Za-z']+|\d[\d,.]*", text):
        if tok[0].isdigit():
            n += 2 * len(re.findall(r'\d+', tok)); continue
        w = tok.lower().replace("'", '')
        c = len(re.findall(r'[aeiouy]+', w))
        if w.endswith('e') and not w.endswith(('le', 'ee')) and c > 1: c -= 1
        if w.endswith('ed') and not w.endswith(('ted', 'ded')) and c > 1: c -= 1
        n += max(1, c)
    return n


def silences(wav, noise='-35dB', d=0.12):
    e = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', wav, '-af', f'silencedetect=noise={noise}:d={d}', '-f', 'null', '-'],
                       capture_output=True, text=True).stderr
    st = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', e)]
    en = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', e)]
    return [(round(a, 3), round(b, 3)) for a, b in zip(st, en)]


def align(cw, wt):
    """Whisper tokens to caption words by character alignment (whisper merges, splits and respells tokens).
    Returns [a, b] per caption word, None where no character matched."""
    ch, tm = [], []
    for w, a, b in wt:
        c = alnum(w)
        for k, x in enumerate(c): ch.append(x); tm.append((a + (b - a) * k / len(c), a + (b - a) * (k + 1) / len(c)))
    cc, owner = [], []
    for j, w in enumerate(cw):
        for x in alnum(w): cc.append(x); owner.append(j)
    span = [None] * len(cw)
    for blk in difflib.SequenceMatcher(None, cc, ch, autojunk=False).get_matching_blocks():
        for q in range(blk.size):
            j, (ta, tb) = owner[blk.a + q], tm[blk.b + q]
            span[j] = [ta, tb] if span[j] is None else [min(span[j][0], ta), max(span[j][1], tb)]
    return [sp if sp and sp[1] - sp[0] >= 0.02 else None for sp in span]


def fill(cw, span, S, E):
    """Map one segment's word spans into its measured speech span [S, E]: affine on the matched words; unmatched words
    share the gaps by character count."""
    m = [j for j, s in enumerate(span) if s]
    if len(m) >= 2 and span[m[-1]][1] > span[m[0]][0]:
        n = [len(alnum(w)) + 1 for w in cw]; tot = sum(n)
        S1, E1 = S + (E - S) * sum(n[:m[0]]) / tot, E - (E - S) * sum(n[m[-1] + 1:]) / tot
        a0, b0 = span[m[0]][0], span[m[-1]][1]
        f = lambda x: S1 + (x - a0) * (E1 - S1) / (b0 - a0)
        sp = [[f(s[0]), f(s[1])] if s else None for s in span]
    else:
        sp = [None] * len(cw)
    out, j = [], 0
    while j < len(cw):
        if sp[j]: out.append(sp[j]); j += 1; continue
        k = j
        while k < len(cw) and not sp[k]: k += 1
        lo = out[-1][1] if out else S
        hi = sp[k][0] if k < len(cw) else E
        if hi - lo < 0.06 * (k - j) and out and k < len(cw):
            lo = out[-1][1] = (out[-1][0] + out[-1][1]) / 2; hi = sp[k][0] = (sp[k][0] + sp[k][1]) / 2
        n = [len(alnum(w)) + 1 for w in cw[j:k]]; tot = sum(n); acc = 0
        for q in n: out.append([lo + (hi - lo) * acc / tot, lo + (hi - lo) * (acc + q) / tot]); acc += q
        j = k
    return out


def segments(cid, text, clause):
    """[(segment text, sentence index)]: sentences, plus configured clause breaks inside a sentence."""
    out = []
    for si, s in enumerate(SENT.split(text)):
        ws, cur = s.split(), []
        for w in ws:
            cur.append(w)
            if w in clause.get(cid, []) and len(cur) < len(ws): out.append((' '.join(cur), si)); cur = []
        if cur: out.append((' '.join(cur), si))
    return out


def width_of(text, px, widths, R):
    w = widths.get(text, {})
    if str(px) in w: return w[str(px)]
    if px in w: return w[px]
    return len(text) * px * 0.52          # rough Geist-like average advance; measure_text.mjs gives the real width


def estimate_take(text, R):
    pauses = len(SENT.split(text)) - 1
    commas = len(re.findall(r',\s', text))
    dur = syllables(text) / R['est_syllables_per_second'] + pauses * R['est_pause_sentence'] + commas * R['est_pause_comma']
    return round(dur + 2 * R['pad'], 3)


def estimate_silences(text, dur, R):
    """Pauses placed at sentence ends and commas by character share (estimate mode only)."""
    total = len(text); out = []
    for m in re.finditer(r'[.?!]"?\s|,\s', text):
        p = R['est_pause_sentence'] if m.group(0).strip(' ')[0] in '.?!"' else R['est_pause_comma']
        mid = R['pad'] + (dur - 2 * R['pad']) * (m.start() + 1) / total
        out.append((round(mid - p / 2, 3), round(mid + p / 2, 3)))
    return out


def build(args):
    lines_p = opt(args, '--lines') or die('--lines is required')
    lines = json.load(open(lines_p))['lines']
    cfg = json.load(open(opt(args, '--config'))) if opt(args, '--config') else {}
    R = dict(DEFAULT_RULES, **cfg.get('rules', {}))
    cap_extra, gap_extra = cfg.get('cap_extra', {}), cfg.get('gap_extra', {})
    split, clause = cfg.get('split', 'auto'), cfg.get('clause', {})
    estimate = '--estimate' in args
    vo_dir = opt(args, '--vo')
    if not estimate and not vo_dir: die('give --vo DIR (recorded takes) or --estimate (no voice yet)')
    vo = json.load(open(os.path.join(vo_dir, 'vo.json'))) if vo_dir else None
    voice = opt(args, '--voice')
    words_p = opt(args, '--words') or (os.path.join(vo_dir, 'words.json') if vo_dir and os.path.exists(os.path.join(vo_dir, 'words.json')) else None)
    WORDS = json.load(open(words_p)) if words_p else {}
    widths_p = opt(args, '--widths') or ('widths.json' if os.path.exists('widths.json') else None)
    widths = json.load(open(widths_p)) if widths_p else {}
    by_id = {l['id']: l for l in (vo['lines'] if vo else [])}
    caps, t, report = [], 0.0, []
    for ln in lines:
        cid, text = ln['id'], clean(ln['text'])
        if vo:
            if cid not in by_id: die(f'{cid} has no take in {vo_dir}/vo.json (run vo.py make)')
            v = by_id[cid]
            if clean(v['text']) != text: die(f'{cid}: lines.json text differs from the recorded take; re-record or fix the copy')
            vname = voice or max(v['dur'], key=lambda k: v['dur'][k])
            if not all(v['ok'].values()): print(f'warning: {cid} fails transcribe-back ({v["heard"]}); fix before locking', file=sys.stderr)
            dur = v['dur'][vname]
            wav = os.path.join(vo_dir, vname, cid + '.wav')
            sil = silences(wav) if os.path.exists(wav) else []
        else:
            dur = estimate_take(text, R); sil = estimate_silences(text, dur, R); vname = 'estimate'
        cw = text.split()
        wsrc = WORDS.get(cid, {})
        spans = {k: align(cw, wsrc[k]) for k in ('plain', 'prompted') if k in wsrc}
        best = max(spans, key=lambda k: sum(1 for s in spans[k] if s)) if spans else None
        span = spans[best] if best else [None] * len(cw)
        segs = segments(cid, text, clause)
        nw = [len(s.split()) for s, _ in segs]
        bounds, wi = [], 0
        for j in range(len(segs) - 1):
            wi += nw[j]; L, Rr = span[wi - 1], span[wi]
            exp = (L[1] + Rr[0]) / 2 if L and Rr else R['pad'] + (dur - 2 * R['pad']) * sum(len(alnum(x)) for x in cw[:wi]) / max(1, sum(len(alnum(x)) for x in cw))
            if sil: bounds.append(min(sil, key=lambda p: abs((p[0] + p[1]) / 2 - exp) - 0.5 * min(0.8, p[1] - p[0])))
            else: bounds.append((exp, exp))
        edges = [R['pad']] + [b for a, b in bounds]; ends = [a for a, b in bounds] + [dur - R['pad']]
        wts, wi = [], 0
        for j, (s, _) in enumerate(segs):
            for (a, b), x in zip(fill(cw[wi:wi + nw[j]], span[wi:wi + nw[j]], edges[j], ends[j]), cw[wi:wi + nw[j]]): wts.append([x, a, b])
            wi += nw[j]
        cin = r2(t); s0 = cin + R['lead']; s1 = s0 + dur
        min_hold = R['hold_per_word'] * len(cw) + R['hold_base']
        out = up(max(s1 + R['tail'], cin + min_hold) + cap_extra.get(cid, 0))
        seg_rows = [[s, r2(s0 + edges[j]), r2(s0 + ends[j])] for j, (s, _) in enumerate(segs)]
        want_split = (cid in split) if isinstance(split, list) else (split == 'auto' and width_of(text, R['caption_px'], widths, R) > R['caption_box_px'])
        subs = []
        if want_split and len(segs) > 1:
            ins, outs = [cin], []
            for a, b in bounds:
                o, n = s0 + a + R['tail'], s0 + b - R['lead']
                if n - o < R['sub_swap']: m = s0 + (a + b) / 2; o, n = m - R['sub_swap'] / 2, m + R['sub_swap'] / 2
                outs.append(r2(o)); ins.append(r2(n))
            outs.append(out)
            for j, (s, _) in enumerate(segs):
                subs.append({'id': cid + 'abcdefgh'[j], 'text': s, 'in': ins[j], 'out': outs[j], 'speech': seg_rows[j][1:]})
        else:
            subs.append({'id': cid, 'text': text, 'in': cin, 'out': out, 'speech': [r2(s0), r2(s1)]})
        for s in subs:
            wpx = width_of(s['text'], R['caption_px'], widths, R)
            if wpx > R['caption_box_px'] * 1.2: print(f'warning: {s["id"]} is about {round(wpx)} px wide at {R["caption_px"]} px; add a clause break or shorten', file=sys.stderr)
        c = {'id': cid, 'text': text, 'in': cin, 'out': out, 'speech': [r2(s0), r2(s1)], 'take': r2(dur), 'voice': vname,
             'min_hold': r2(min_hold), 'sub': subs, 'words': [[x, r2(s0 + a), r2(s0 + b)] for x, a, b in wts]}
        caps.append(c)
        report.append((cid, best or ('estimate' if estimate else 'spread'), sum(1 for s in span if s), len(cw)))
        t = out + R['gap'] + gap_extra.get(cid, 0)
    D = up(caps[-1]['speech'][1] + R['close_hold'])
    caps[-1]['out'] = max(D, caps[-1]['out']); D = caps[-1]['out']; caps[-1]['sub'][-1]['out'] = D
    beats = []
    B = cfg.get('beats', [])
    for n, (name, cid) in enumerate(B):
        st = 0.0 if n == 0 else next(c['in'] for c in caps if c['id'] == cid)
        en = next(c['in'] for c in caps if c['id'] == B[n + 1][1]) if n + 1 < len(B) else D
        beats.append({'name': name, 'start': st, 'end': en, 'caption_ids': [cid]})
    acts = [next(c['in'] for c in caps if c['id'] == a) for a in cfg.get('act_breaks', [])]
    doc = {'duration': D, 'source': 'estimate (no voice yet)' if estimate else f'{vo_dir}/vo.json',
           'rules': dict(R, note='captions[].{id,text,in,out} = window.CAPTIONS; show sub[] one line at a time; words[] = [word, start, end] '
                                 'in scene seconds for placing marks, not for caption edges; run plan_vo.mjs with the same --tail'),
           'captions': caps, 'beats': beats, 'act_breaks': acts}
    out_p = opt(args, '--out', 'timing.json')
    js = json.dumps(doc, indent=1)   # short arrays on one line, so the sheet stays readable in a diff
    js = re.sub(r'\[\s+("(?:[^"\\]|\\.)*"|-?[\d.]+),\s+(-?[\d.]+)(?:,\s+(-?[\d.]+))?\s+\]', lambda m: '[' + ', '.join(g for g in m.groups() if g) + ']', js)
    js = re.sub(r'"(caption_ids|act_breaks)": \[\s+([^\]]*?)\s+\]', lambda m: f'"{m.group(1)}": [' + ', '.join(x.strip() for x in m.group(2).split(',')) + ']', js)
    assert json.loads(js) == json.loads(json.dumps(doc))
    open(out_p, 'w').write(js + '\n')
    for (cid, how, nm, nt), c in zip(report, caps):
        print(f"{cid} {c['in']:6.2f}-{c['out']:6.2f} speech {c['speech'][0]:6.2f}-{c['speech'][1]:6.2f} hold {c['out'] - c['in']:5.2f} (min {c['min_hold']:.2f}) words {how} {nm}/{nt}")
        if len(c['sub']) > 1:
            for s in c['sub']: print(f"    {s['id']} {s['in']:6.2f}-{s['out']:6.2f}  {s['text']}")
    print(f'duration {D} s, written to {out_p}')
    print('RESULT ' + json.dumps({'mode': 'build', 'file': out_p, 'captions': len(caps), 'duration': D}))
    return doc


def check(args):
    p = args[0] if args and not args[0].startswith('--') else die('give the timing.json to check')
    T = json.load(open(p))
    cfg = json.load(open(opt(args, '--config'))) if opt(args, '--config') else {}
    R = dict(DEFAULT_RULES, **T.get('rules', {}), **cfg.get('rules', {}))
    bad = []
    caps = T['captions']
    for i, c in enumerate(caps):
        n = len(clean(c['text']).split())
        if 'take' in c and c['out'] + 1e-6 < c['in'] + R['lead'] + c['take'] + R['tail']:
            bad.append(f"{c['id']}: voice does not fit (out {c['out']} < in + lead + take + tail = {c['in'] + R['lead'] + c['take'] + R['tail']:.2f})")
        if c['out'] - c['in'] + 1e-6 < R['hold_per_word'] * n + R['hold_base']:
            bad.append(f"{c['id']}: hold {c['out'] - c['in']:.2f} s < {R['hold_per_word']} x {n} words + {R['hold_base']}")
        if i + 1 < len(caps) and caps[i + 1]['in'] + 1e-6 < c['out'] + R['gap']:
            bad.append(f"{c['id']} to {caps[i + 1]['id']}: gap {caps[i + 1]['in'] - c['out']:.2f} s < {R['gap']}")
        subs = c.get('sub') or []
        for a, b in zip(subs, subs[1:]):
            if b['in'] < a['out'] - 1e-6: bad.append(f"{a['id']} and {b['id']} overlap")
    if abs(caps[-1]['out'] - T['duration']) > 1e-6: bad.append(f"last caption out {caps[-1]['out']} != duration {T['duration']}")
    for b in bad: print('VIOLATION ' + b)
    print(f'captions {len(caps)}, violations {len(bad)}')
    print('RESULT ' + json.dumps({'mode': 'check', 'captions': len(caps), 'violations': len(bad)}))
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    a = sys.argv[1:]
    if a[:1] in (['-h'], ['--help']): print(__doc__); sys.exit(0)
    if not a: print(__doc__, file=sys.stderr); sys.exit(2)
    if a[0] == 'build': build(a[1:])
    elif a[0] == 'check': check(a[1:])
    else: die('first argument must be build or check (see --help)')
