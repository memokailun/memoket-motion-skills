#!/usr/bin/env node
const USAGE = `
measure_text.mjs: rendered widths of caption lines (and each sentence of them) in the real font, for timing.py's
sub-caption split and for layout. Measuring before a face loads silently measures a fallback font (7 percent narrow).

  node <SKILL_DIR>/scripts/measure_text.mjs --lines lines.json --out widths.json
      [--css node_modules/@fontsource-variable/geist/index.css] [--family "Geist Variable"] [--weight 420]
      [--sizes 46,48,50] [--spacing -0.004em]

Writes {"<text>": {"46": px, "48": px, "50": px}} for every line and every sentence in it.
`
import fs from 'node:fs'
import { parseArgs, usage, fail, launch, serve } from './lib/page.mjs'

const A = parseArgs(process.argv.slice(2))
usage(USAGE, A)
if (!A.lines) fail('--lines is required (see --help)')
const css = (A.css || 'node_modules/@fontsource-variable/geist/index.css').split(',')
for (const c of css) if (!fs.existsSync(c)) fail(`stylesheet not found: ${c} (run from the project folder after npm install)`)
const family = A.family || 'Geist Variable', weight = A.weight || '420', spacing = A.spacing || '-0.004em'
const sizes = (A.sizes || '46,48,50').split(',').map(Number)
const SENT = /(?<=[.?!])\s+|(?<=[.?!]")\s+/
const texts = new Set()
for (const l of JSON.parse(fs.readFileSync(A.lines, 'utf8')).lines) {
  const t = l.text.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim()
  texts.add(t); for (const s of t.split(SENT)) texts.add(s)
}
const html = `<!doctype html><meta charset="utf-8">${css.map((c) => `<link rel="stylesheet" href="/${c}">`).join('')}
<body><span id="s" style="font-family:'${family}';font-weight:${weight};letter-spacing:${spacing};white-space:nowrap">Ag</span></body>`
const srv = await serve('.', { '/__measure.html': html })
const b = await launch()
const pg = await b.newPage()
await pg.goto(`http://127.0.0.1:${srv.address().port}/__measure.html`)
const ok = await pg.evaluate(async (f, w) => { await document.fonts.load(`${w} 48px '${f}'`); await document.fonts.ready; return document.fonts.check(`${w} 48px '${f}'`) }, family, weight)
if (!ok) fail(`font "${family}" did not load from ${css.join(', ')}`)
const out = await pg.evaluate((texts, sizes) => {
  const s = document.getElementById('s'), o = {}
  for (const t of texts) { o[t] = {}; for (const px of sizes) { s.style.fontSize = px + 'px'; s.textContent = t; o[t][px] = Math.round(s.getBoundingClientRect().width) } }
  return o
}, [...texts], sizes)
fs.writeFileSync(A.out || 'widths.json', JSON.stringify(out, null, 1))
console.log(`${texts.size} texts measured in ${family} ${weight} at ${sizes.join(', ')} px, written to ${A.out || 'widths.json'}`)
await b.close(); srv.close()
