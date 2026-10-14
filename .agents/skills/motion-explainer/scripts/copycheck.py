#!/usr/bin/env python3
r"""copycheck.py: banned characters and words in the copy and the scene source, before anything is voiced or rendered.

  .venv/bin/python <SKILL_DIR>/scripts/copycheck.py --lines lines.json [--timing timing.json] [--files js/main.js style.css ...]
                                          [--words banned_words.txt] [--allow "\u2212\u00d7"]

Banned characters (house copy rules): em dash, en dash, arrows, middle dot, curly quotes, corner quotes, and in caption
text also asterisks. --allow lets specific non-ASCII characters through, written as \uXXXX escapes or literally (for
example the typeset minus U+2212 and the times sign U+00D7 inside a formula). --words is a file of banned words or
names, one per line (house lists such as product names stay in the project, not in the skill). Every other non-ASCII
character in the source is listed so a person can confirm it. Ends with a RESULT line; exit code 1 on any problem, 2 on
wrong arguments.
"""
import json, re, sys
a = sys.argv[1:]
if a[:1] in (['-h'], ['--help']): print(__doc__); sys.exit(0)
if not any(k in a for k in ('--lines', '--timing', '--files')): print(__doc__, file=sys.stderr); sys.exit(2)
def opt(k, d=None): return a[a.index(k) + 1] if k in a else d
def multi(k):
    if k not in a: return []
    out = []
    for x in a[a.index(k) + 1:]:
        if x.startswith('--'): break
        out.append(x)
    return out
BANNED = {'\u2014': 'em dash', '\u2013': 'en dash', '\u00b7': 'middle dot', '\u2018': 'curly quote', '\u2019': 'curly quote',
          '\u201c': 'curly quote', '\u201d': 'curly quote', '\u300c': 'corner quote', '\u300d': 'corner quote'}
ARROWS = re.compile('[\u2190-\u21ff\u27f0-\u27ff\u2900-\u297f]')
allow = set(re.sub(r'\\u([0-9a-fA-F]{4})', lambda m: chr(int(m.group(1), 16)), opt('--allow') or ''))
words = [w.strip() for w in open(opt('--words')).read().splitlines() if w.strip()] if opt('--words') else []
problems = 0
def scan(name, text, caption=False):
    global problems
    for ch, what in BANNED.items():
        if ch in text and ch not in allow: print(f'{name}: {what} U+{ord(ch):04X} x{text.count(ch)}'); problems += 1
    for m in set(ARROWS.findall(text)):
        if m not in allow: print(f'{name}: arrow U+{ord(m):04X}'); problems += 1
    if caption and ('*' in text or '->' in text or '=>' in text): print(f'{name}: asterisk or ASCII arrow in caption text'); problems += 1
    for w in words:
        if re.search(r'(?<![A-Za-z])' + re.escape(w) + r'(?![A-Za-z])', text): print(f'{name}: banned word "{w}"'); problems += 1
texts = []
if opt('--lines'):
    for l in json.load(open(opt('--lines')))['lines']: texts.append((f"lines {l['id']}", l['text']))
if opt('--timing'):
    for c in json.load(open(opt('--timing')))['captions']:
        texts.append((f"timing {c['id']}", c['text']))
        for s in c.get('sub', []): texts.append((f"timing {s['id']}", s['text']))
for n, t in texts: scan(n, t, caption=True)
other = set()
for f in multi('--files'):
    src = open(f, encoding='utf-8').read(); scan(f, src)
    other |= {c for c in src if ord(c) > 127 and c not in BANNED and c not in allow and not ARROWS.match(c)}
if other: print('other non-ASCII characters in source (confirm each):', ' '.join(f'U+{ord(c):04X}' for c in sorted(other)))
print(f'checked {len(texts)} caption texts and {len(multi("--files"))} files: problems {problems}')
print('RESULT ' + json.dumps({'captions': len(texts), 'files': len(multi('--files')), 'problems': problems}))
sys.exit(1 if problems else 0)
