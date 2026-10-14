#!/usr/bin/env node
const USAGE = `
determinism.mjs: proves the scene contract. The same t must give the same frame whatever was seeked before (parallel
render workers, inserted holds and review stills all reach frames in different orders).
  1. One page renders every sampled t ascending, descending, and in a seeded random order with a random jump before
     each: the PNG bytes must match.
  2. A second page in another random order: the painted DOM state (computed opacity, transform, filter, dash, stroke,
     fill, clip-path, text and all attributes of every painted element) must match.
PNG mismatches with identical DOM state point at Chrome's raster (masks, group opacity, fractional text offsets,
compositor layers), not at your timeline. Run it alone on an idle machine: a check beside a render once produced a
broken glyph that an idle rerun did not.

  node <SKILL_DIR>/scripts/determinism.mjs --scene index.html [--step 1] [--from 0] [--to D] [--out out/determinism]

  --step S     sample spacing (1 s for a whole film, 0.25 s through changed windows, 0.73 s to catch periodic effects)
  --stage SEL  root of the painted elements for the DOM comparison (default "#stage, #root", else body)
  --size WxH   viewport (default 1920x1080)
  --out DIR    where mismatching PNGs are written (u = ascending, d = descending, r = random)
  --tol N      a PNG mismatch whose largest difference is at most N code values on at most --tol-pixels pixels is
               reported as raster noise, not a failure (default 2 and 16: Chrome's anti-aliasing of a moving edge
               can differ by one code value on one pixel). --strict counts every byte
Exit code 1 on a state mismatch or a PNG mismatch above the tolerance.
`
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { parseArgs, usage, fail, parseSize, launch, serve, sceneUrl, openPage } from './lib/page.mjs'

const A = parseArgs(process.argv.slice(2), ['strict'])
usage(USAGE, A)
if (!A.scene) fail('--scene is required (see --help)')
const [W, H] = parseSize(A.size)
const step = Number(A.step || 1)
const OUT = A.out || 'out/determinism'
const STAGE = A.stage || '#stage, #root'
const TOL = A.strict ? -1 : Number(A.tol ?? 2), TOLPX = Number(A['tol-pixels'] ?? 16)
const srv = await serve(A.root || '.')
const url = sceneUrl(srv, A.scene)
const b = await launch()
const open = () => openPage(b, url, { width: W, height: H, scale: 1, timeout: 120 })
let s = 12345
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
const P1 = await open()
const D = await P1.evaluate(() => window.DURATION)
const t0 = Number(A.from || 0), t1 = Math.min(Number(A.to ?? D), D)
const T = []; for (let t = t0; t <= t1 + 1e-9; t += step) T.push(+t.toFixed(3)); if (T[T.length - 1] < t1 - 1e-6) T.push(+t1.toFixed(3))
const PNGS = {}
const shot = async (pg, t, tag) => { await pg.evaluate((t) => window.seek(t), t); const buf = await pg.screenshot({ type: 'png' }); PNGS[tag + t] = buf; return crypto.createHash('sha1').update(buf).digest('hex') }
const state = (pg, t) => pg.evaluate((t, sel) => {
  window.seek(t)
  const host = document.querySelector(sel) || document.body
  const eff = (e) => { let o = 1; for (let x = e; x && x.nodeType === 1; x = x.parentElement || x.parentNode) { const cs = getComputedStyle(x); if (cs.display === 'none' || cs.visibility === 'hidden') return 0; o *= Number(cs.opacity); if (x === host) break } return o }
  let h = ''
  for (const e of host.querySelectorAll('*')) {
    if (e.closest('defs') || eff(e) <= 0) continue
    if ((e.tagName === 'path' && e.getAttribute('d') === 'M0 0') || ((e.tagName === 'circle' || e.tagName === 'ellipse') && !(Number(e.getAttribute('r') || e.getAttribute('rx')) > 0))) continue
    const cs = getComputedStyle(e)
    h += '\n' + e.tagName + cs.opacity + cs.transform + cs.translate + cs.filter + cs.strokeDasharray + cs.strokeDashoffset + cs.stroke + cs.fill + cs.color + cs.clipPath + (e.childElementCount ? '' : e.textContent)
    for (const a of e.attributes) if (a.name !== 'href' && a.name !== 'style' && a.name !== 'src') h += a.name + a.value
  }
  return h
}, t, STAGE)
const up = {}, down = {}, rand = {}
for (const t of T) up[t] = await shot(P1, t, 'u')
for (const t of [...T].reverse()) down[t] = await shot(P1, t, 'd')
for (const t of [...T].sort(() => rnd() - 0.5)) { await P1.evaluate((t) => window.seek(t), T[Math.floor(rnd() * T.length)]); rand[t] = await shot(P1, t, 'r') }
// largest per-channel difference and the number of differing pixels between two PNGs, decoded in the page
const diff = (a, b) => P1.evaluate(async (a, b) => {
  const load = (s) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + s })
  const [ia, ib] = await Promise.all([load(a), load(b)])
  const c = document.createElement('canvas'); c.width = ia.width; c.height = ia.height; const x = c.getContext('2d')
  x.drawImage(ia, 0, 0); const da = x.getImageData(0, 0, c.width, c.height).data
  x.clearRect(0, 0, c.width, c.height); x.drawImage(ib, 0, 0); const db = x.getImageData(0, 0, c.width, c.height).data
  let n = 0, max = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1
  for (let i = 0; i < da.length; i += 4) {
    const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]))
    if (d > 0) { n++; max = Math.max(max, d); const p = i / 4, px = p % c.width, py = (p / c.width) | 0; x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py) }
  }
  return { n, max, box: n ? [x0, y0, x1, y1] : null }
}, a.toString('base64'), b.toString('base64'))
let bad = 0, noise = 0
const badT = []
for (const t of T) if (up[t] !== down[t] || up[t] !== rand[t]) {
  const ds = []
  for (const k of ['d', 'r']) if (up[t] !== { d: down, r: rand }[k][t]) ds.push(await diff(PNGS['u' + t], PNGS[k + t]))
  const worst = ds.reduce((m, d) => (d.max > m.max || (d.max === m.max && d.n > m.n) ? d : m), { n: 0, max: 0 })
  if (worst.max <= TOL && worst.n <= TOLPX) { noise++; console.log(`raster noise at ${t}: ${worst.n} px, max ${worst.max} code value(s), box ${JSON.stringify(worst.box)}`); continue }
  bad++; badT.push(t)
  console.log(`pixel mismatch at ${t}: ${worst.n} px, max ${worst.max} code values, box ${JSON.stringify(worst.box)}`)
  fs.mkdirSync(OUT, { recursive: true })
  for (const k of ['u', 'd', 'r']) fs.writeFileSync(path.join(OUT, `pm_${k}_${t}.png`), PNGS[k + t])
}
const P2 = await open()
const sa = {}, sb = {}
for (const t of T) sa[t] = await state(P1, t)
for (const t of [...T].sort(() => rnd() - 0.5)) { await P2.evaluate((t) => window.seek(t), T[Math.floor(rnd() * T.length)]); sb[t] = await state(P2, t) }
let badS = 0
for (const t of T) if (sa[t] !== sb[t]) {
  badS++
  const x = sa[t].split('\n'), y = sb[t].split('\n'), i = x.findIndex((v, k) => v !== y[k])
  console.log(`state mismatch at ${t}:\n  A ${(x[i] || '').slice(0, 300)}\n  B ${(y[i] || '').slice(0, 300)}`)
}
if (bad) console.log(`PNGs of the mismatches are in ${OUT}`)
console.log(`same page, 3 seek orders: ${T.length - bad - noise}/${T.length} byte-identical, ${noise} within raster noise, ${bad} mismatched; second page, painted DOM state: ${T.length - badS}/${T.length} identical`)
console.log('RESULT ' + JSON.stringify({ samples: T.length, pngMismatch: bad, rasterNoise: noise, stateMismatch: badS, times: badT }))
await b.close(); srv.close()
process.exit(bad || badS ? 1 : 0)
