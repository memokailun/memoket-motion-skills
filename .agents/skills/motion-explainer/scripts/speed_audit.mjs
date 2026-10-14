#!/usr/bin/env node
const USAGE = `
speed_audit.mjs: per-frame speed of every visible element. Strobing (an object read as separate copies) comes from
moves that are too fast for 30 fps: a critically damped sheet spring whipped at 267 px per frame, a reading scroll at
166. Caps that fixed them: reading content at most about 50 px per frame, large travels about 110 to 120, a 1,920 px
sheet slide on in-out sine over 0.9 s peaking near 112 (an in-out cubic over 0.9 s peaks near 213). With a motion-blur
finish (HyperFrames slowmo plus tmix), try --limit 35 as a starting guess for thin elements and tune it per film.

  node <SKILL_DIR>/scripts/speed_audit.mjs --scene index.html [--limit 50] [--from 0] [--to D]

  --limit PX     report elements whose box centre or size changes more than PX per frame (default 50)
  --select SEL   elements to track (default: text-bearing HTML elements and SVG shapes inside "#stage, #root")
  --skip LIST    time windows to ignore, "t0-t1,t0-t1" (for example the sheet slides you already measured)
  --fps N        frame rate (default 30)
  --size WxH     viewport (default 1920x1080)
Prints one line per flagged element and run: time window, peak px per frame, frames, smallest box side.
`
import { parseArgs, usage, fail, parseSize, launch, serve, sceneUrl, openPage } from './lib/page.mjs'

const A = parseArgs(process.argv.slice(2))
usage(USAGE, A)
if (!A.scene) fail('--scene is required (see --help)')
const [W, H] = parseSize(A.size)
const LIMIT = Number(A.limit || 50), FPS = Number(A.fps || 30)
const SKIP = A.skip ? A.skip.split(',').map((w) => w.split('-').map(Number)) : []
const SEL = A.select || ':is(#stage, #root) :is(path, line, circle, ellipse, rect, polygon, polyline, image, text, .lab, .badge, .tag, .card, .box)'
const srv = await serve(A.root || '.')
const b = await launch()
const pg = await openPage(b, sceneUrl(srv, A.scene), { width: W, height: H, scale: 1, timeout: 120 })
const D = await pg.evaluate(() => window.DURATION)
const f0 = Math.round(Number(A.from || 0) * FPS), f1 = Math.round(Math.min(Number(A.to ?? D), D) * FPS)
await pg.evaluate((sel) => {
  window.__sa = { els: [...document.querySelectorAll(sel)].filter((e) => !e.closest('defs, clipPath, mask, #caps')), prev: null }
}, SEL)
const hits = new Map()
for (let f = f0; f <= f1; f++) {
  const t = f / FPS
  const skip = SKIP.some(([a, z]) => t >= a && t <= z)
  const res = await pg.evaluate((t, LIMIT, skip) => {
    window.seek(t)
    const S = window.__sa
    const vis = (e) => { for (let n = e; n && n.nodeType === 1; n = n.parentElement || n.parentNode) { const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) return false } return true }
    const cur = S.els.map((e) => { if (!vis(e)) return null; const r = e.getBoundingClientRect(); return r.width + r.height > 0 ? [r.x + r.width / 2, r.y + r.height / 2, r.width, r.height] : null })
    const out = []
    if (S.prev && !skip) for (let i = 0; i < cur.length; i++) {
      const a = S.prev[i], c = cur[i]; if (!a || !c) continue
      const v = Math.max(Math.hypot(c[0] - a[0], c[1] - a[1]), Math.abs(c[2] - a[2]), Math.abs(c[3] - a[3]))
      if (v > LIMIT) {
        const e = S.els[i]
        out.push([i, Math.round(v), Math.round(Math.min(c[2], c[3])), (e.id ? '#' + e.id : '') + '<' + e.tagName.toLowerCase() + (e.getAttribute('class') ? '.' + e.getAttribute('class').trim().replace(/\s+/g, '.') : '') + '>' + (e.textContent && e.textContent.length < 24 && !(e instanceof SVGElement) ? ' "' + e.textContent.trim() + '"' : '')])
      }
    }
    S.prev = cur
    return out
  }, t, LIMIT, skip)
  for (const [i, v, dim, name] of res) {
    const h = hits.get(i)
    if (h && f - h.last <= 2) { h.t1 = t; h.max = Math.max(h.max, v); h.n++; h.last = f; h.dim = Math.min(h.dim, dim) }
    else { if (h) console.log(fmt(h)); hits.set(i, { name, t0: t, t1: t, max: v, n: 1, last: f, dim }) }
  }
}
function fmt(h) { return `${h.t0.toFixed(2)}-${h.t1.toFixed(2)}  max ${h.max} px/frame  frames ${h.n}  min side ${h.dim}  ${h.name}` }
for (const h of hits.values()) console.log(fmt(h))
console.log(`elements over ${LIMIT} px/frame: ${hits.size}`)
console.log('RESULT ' + JSON.stringify({ limit: LIMIT, flagged: hits.size }))
await b.close(); srv.close()
