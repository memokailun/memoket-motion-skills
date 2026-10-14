#!/usr/bin/env node
const USAGE = `
plan_vo.mjs: fit recorded voice lines to the scene's caption windows. Each line is spoken from in + lead and needs
until in + lead + take + tail (take = the longest take across voices, so one silent video serves every voice). If a
line outruns its caption, a hold (frozen frame) is inserted at the latest moment inside the window where the frame is
pixel-identical for --still seconds, so a hold never freezes a mark mid-move. No still moment is an error: fix the
scene so the page settles before the caption leaves.

Holds are the fallback. The method is: record first, build timing.json from the measured takes with timing.py, animate
to it, then run this as a check and expect "holds 0, errors 0".

  node <SKILL_DIR>/scripts/plan_vo.mjs --scene index.html --vo out/vo/vo.json --out out/warp.json [--tail 0.25]

  --lead S    voice start after caption in (default 0.15, same as timing.py)
  --tail S    caption stays after speech ends (default 0.25, same as timing.py; a mismatch inserts unplanned holds)
  --still S   still run needed for a hold (default 0.2)
  --size WxH  viewport (default 1920x1080)
Writes {holds, lines: [{id, text, start, dur}], outDuration, errors}; lines[].start is output time, which mix.py uses.
Pass the same file as --warp to render.mjs for both the video and the cue dump.
`
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs, usage, fail, parseSize, launch, serve, sceneUrl, openPage } from './lib/page.mjs'

const A = parseArgs(process.argv.slice(2))
usage(USAGE, A)
for (const k of ['scene', 'vo', 'out']) if (!A[k]) fail(`--${k} is required (see --help)`)
const [W, H] = parseSize(A.size)
const LEAD = Number(A.lead ?? 0.15), TAIL = Number(A.tail ?? 0.25), STILL = Number(A.still ?? 0.2), STEP = 1 / 30
const vo = JSON.parse(fs.readFileSync(A.vo, 'utf8'))
const dur = Object.fromEntries(vo.lines.map((l) => [l.id, Math.max(...Object.values(l.dur))]))
const srv = await serve(A.root || '.')
const browser = await launch()
const page = await openPage(browser, sceneUrl(srv, A.scene), { width: W, height: H, scale: 1, timeout: 120 })
const DURATION = await page.evaluate(() => window.DURATION)
const caps = await page.evaluate(() => window.CAPTIONS || [])
if (!caps.length) fail('the scene has no window.CAPTIONS')
const frame = async (t) => { await page.evaluate((t) => window.seek(t), t); return (await page.screenshot({ type: 'png' })).toString('base64') }
const holds = [], errors = [], lines = []
for (const c of caps) {
  if (!(c.id in dur)) { errors.push(`caption ${c.id} has no voice line in ${A.vo}`); continue }
  const need = c.in + LEAD + dur[c.id] + TAIL
  const out = c.out ?? DURATION
  lines.push({ id: c.id, text: c.text, start: +(c.in + LEAD).toFixed(4), dur: dur[c.id] })
  if (need <= out) continue
  const deficit = +(need - out + 0.05).toFixed(3)
  let found = null
  const lo = c.in + 0.35
  let t = Math.floor((out - STILL - 0.01) / STEP) * STEP
  let next = await frame(t + STILL)
  while (t >= lo) {           // latest still moment: scan backwards for a run of identical frames
    const a = await frame(t)
    if (a === next) {
      let still = true
      for (let u = t + STEP; u < t + STILL - 1e-6; u += STEP) if ((await frame(u)) !== a) { still = false; break }
      if (still) { found = +(t + STILL / 2).toFixed(4); break }
    }
    next = a; t -= STEP
  }
  if (found === null) errors.push(`caption ${c.id} (${c.in}-${out}) needs ${deficit} s more but has no still ${STILL} s moment`)
  else holds.push({ at: found, dur: deficit, caption: c.id })
}
await browser.close(); srv.close()
const outT = (ts) => ts + holds.filter((h) => h.at < ts).reduce((a, h) => a + h.dur, 0)
const plan = { scene: A.scene, sceneDuration: DURATION, outDuration: +(DURATION + holds.reduce((a, h) => a + h.dur, 0)).toFixed(3),
  lead: LEAD, tail: TAIL, holds, lines: lines.map((l) => ({ ...l, start: +outT(l.start).toFixed(4) })), errors }
fs.mkdirSync(path.dirname(path.resolve(A.out)), { recursive: true })
fs.writeFileSync(A.out, JSON.stringify(plan, null, 1))
console.log(`holds: ${holds.length} (+${(plan.outDuration - DURATION).toFixed(2)} s), output ${plan.outDuration} s; errors: ${errors.length}`)
for (const h of holds) console.log(`  hold ${h.dur} s at ${h.at} (caption ${h.caption})`)
for (const e of errors) console.log('  ERROR ' + e)
console.log('RESULT ' + JSON.stringify({ holds: holds.length, errors: errors.length, outDuration: plan.outDuration, file: A.out }))
process.exit(errors.length ? 1 : 0)
