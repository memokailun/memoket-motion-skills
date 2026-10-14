#!/usr/bin/env node
const USAGE = `
seek_stills.mjs: layout stills straight from any HyperFrames composition file (cuts included, which
"hyperframes snapshot" cannot target), seeking the way the renderer does: totalTime(t, true), events suppressed.

  node <SKILL_DIR>/scripts/hf/seek_stills.mjs index.html out/stills 0,0.5,1,3.2 [--size 1920x1080] [--sheet out/s.png]

Writes t%06.2f.png per time. Stills are for blocking and layout; review frames for delivery come from the rendered mp4
(review_sheets.py), because twice a still was wrong where the render was right, and twice the reverse.
`
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { parseArgs, usage, fail, parseSize, launch, python, skillDir } from '../lib/page.mjs'

const A = parseArgs(process.argv.slice(2))
usage(USAGE, A)
const [file, out, times] = A._
if (!file || !out || !times) fail('usage: seek_stills.mjs <file.html> <outdir> <t1,t2,...>')
const [W, H] = parseSize(A.size)
fs.mkdirSync(out, { recursive: true })
const browser = await launch()
const page = await browser.newPage()
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 })
page.on('pageerror', (e) => console.log('[page error]', e.message))
await page.goto('file://' + path.resolve(file), { waitUntil: 'load' })
await page.evaluate(async () => { await document.fonts.ready })
await page.waitForFunction('window.__timelines && Object.keys(window.__timelines).length > 0', { timeout: 60000 })
const files = []
for (const t of times.split(',').map(Number)) {
  await page.evaluate((t) => { Object.values(window.__timelines)[0].totalTime(t, true) }, t)
  await new Promise((r) => setTimeout(r, 30))
  const name = path.join(out, `t${t.toFixed(2).padStart(6, '0')}.png`)
  await page.screenshot({ path: name }); files.push([t, name])
}
await browser.close()
console.log(`${files.length} stills in ${out}`)
if (A.sheet) {
  const r = spawnSync(python(), [path.join(skillDir(), 'scripts/review_sheets.py'), 'tile', A.sheet, ...files.flatMap(([t, f]) => [String(t), f])], { stdio: 'inherit' })
  if (r.status !== 0) console.error('sheet failed: needs Pillow; create the project venv (.venv) or set PYTHON to a Python that has it')
}
