#!/usr/bin/env node
const USAGE = `
qa_scene.mjs: layout gate for a scene. Seeks every --step seconds and checks, on visible text glyphs cut to their real
ink band (canvas font metrics) and counted only when their effective opacity times colour alpha is above 0.05:
  overlap   glyphs of two different text nodes intersect (text on text)
  stroke    a visible stroke in a stroke layer passes through a glyph (marks sit beside or around text)
  ink       a visible filled pen shape or dot (pen strokes are filled outlines) covers part of a glyph
  frame     text outside the safe frame
  zone      caption text leaves the caption band, or other text enters it
  captions  more than one caption visible at once
  copy      visible text contains a banned character (em or en dash, arrows, middle dot, curly or corner quotes)
  holds     a caption window (window.CAPTIONS) shorter than hold_per_word * words + hold_base
  badge     (only with --badge-windows) a badge must be visible inside each window and nowhere else
It knows text glyphs and SVG strokes only: HTML boxes, canvas drawings and drawn ink in the caption band need
capband.mjs and your own eyes. Prove the gate is live once per project by planting a failure in a throwaway copy.

  node <SKILL_DIR>/scripts/qa_scene.mjs --scene index.html [--step 0.1] [--from 0] [--to D] [--json out/qa.json]

Options (defaults fit the templates at 1920x1080)
  --size WxH            viewport (default 1920x1080)
  --frame x0,y0,x1,y1   safe frame for text (default 0,40,W,H-40)
  --band y0,y1          caption band (default 900,1044)
  --caps SEL            caption selector (default ".cap, #cap")
  --strokes SEL         stroke layers (default "svg#ov, svg.art")
  --ink SEL             filled shapes checked against glyphs (default "svg#ov path, svg#ov circle, svg.art path,
                        svg.art circle"; "none" turns it off). Tints meant to sit under text need their own class
                        outside this selector
  --badge SEL           badge selector (default ".badge, #badge")
  --badge-windows LIST  "t0-t1,t0-t1" windows where a badge must show (off by default)
  --hold W,B            hold rule per word and base (default 0.33,0.7)
  --root DIR            web root (default current folder)
Exit code 1 if anything fails; prints the first failures per check with their times.
`
import fs from 'node:fs'
import { parseArgs, usage, fail, parseSize, launch, serve, sceneUrl, openPage } from './lib/page.mjs'

const A = parseArgs(process.argv.slice(2))
usage(USAGE, A)
if (!A.scene) fail('--scene is required (see --help)')
const [W, H] = parseSize(A.size)
const step = Number(A.step || 0.1)
const FR = (A.frame || `0,40,${W},${H - 40}`).split(',').map(Number)
const BAND = (A.band || '900,1044').split(',').map(Number)
const HOLD = (A.hold || '0.33,0.7').split(',').map(Number)
const BW = A['badge-windows'] ? A['badge-windows'].split(',').map((w) => w.split('-').map(Number)) : null
const cfg = { FR, BAND, caps: A.caps || '.cap, #cap', strokes: A.strokes || 'svg#ov, svg.art', badge: A.badge || '.badge, #badge',
  ink: A.ink === 'none' ? '' : (A.ink || 'svg#ov path, svg#ov circle, svg.art path, svg.art circle') }

const srv = await serve(A.root || '.')
const browser = await launch()
const pg = await openPage(browser, sceneUrl(srv, A.scene), { width: W, height: H, scale: 1, timeout: 120 })
const D = await pg.evaluate(() => window.DURATION)
const t0 = Number(A.from || 0), t1 = Number(A.to ?? D)
const fails = { overlap: [], stroke: [], ink: [], frame: [], zone: [], captions: [], copy: [], holds: [], badge: [] }

// caption hold rule from window.CAPTIONS (no seeking needed)
for (const c of await pg.evaluate(() => window.CAPTIONS || [])) {
  const n = String(c.text).trim().split(/\s+/).length, need = HOLD[0] * n + HOLD[1]
  if (c.out - c.in + 1e-6 < need) fails.holds.push(`${c.id} ${c.in.toFixed(2)}-${c.out.toFixed(2)}: ${(c.out - c.in).toFixed(2)} s < ${need.toFixed(2)} s for ${n} words`)
}

for (let t = t0; t <= t1 + 1e-9; t += step) {
  const tt = Math.round(t * 1000) / 1000
  const res = await pg.evaluate((tt, cfg) => {
    window.seek(tt)
    const alpha = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return 1; const p = m[1].split(/[,\s/]+/).filter(Boolean); return p.length > 3 ? parseFloat(p[3]) : 1 }
    const op = (el) => { let o = 1; for (let e = el; e && e.nodeType === 1; e = e.parentElement || e.parentNode) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return 0; o *= Number(cs.opacity) } return o }
    const inCap = (el) => !!el.closest(cfg.caps)
    const ctx = (window.__qaCtx = window.__qaCtx || document.createElement('canvas').getContext('2d'))
    const inkCache = (window.__qaInk = window.__qaInk || new Map())
    const inkOf = (cs, ch) => {
      const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`, k = font + '|' + ch
      if (!inkCache.has(k)) { ctx.font = font; const mt = ctx.measureText(ch); inkCache.set(k, mt.fontBoundingBoxAscent ? { fa: mt.fontBoundingBoxAscent, a: mt.actualBoundingBoxAscent, d: mt.actualBoundingBoxDescent } : null) }
      return inkCache.get(k)
    }
    const BANNED = /[\u2013\u2014\u2190-\u21FF\u00B7\u2018\u2019\u201C\u201D\u300C\u300D]/
    const out = { overlap: [], stroke: [], ink: [], frame: [], zone: [], captions: [], copy: [], badge: [] }
    const glyphs = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    let n, id = 0
    while ((n = walker.nextNode())) {
      if (!n.nodeValue.trim()) continue
      const el = n.parentElement; if (!el || el.closest('script, style, defs, title')) continue
      const cs = getComputedStyle(el)
      const o = op(el) * alpha(cs.color); if (o <= 0.05) continue
      if (BANNED.test(n.nodeValue)) out.copy.push(`"${n.nodeValue.trim().slice(0, 50)}"`)
      const nid = id++, rg = document.createRange()
      for (let i = 0; i < n.nodeValue.length; i++) {
        if (!n.nodeValue[i].trim()) continue
        rg.setStart(n, i); rg.setEnd(n, i + 1)
        for (const q of rg.getClientRects()) {
          if (q.width < 0.5 || q.height < 0.5) continue
          const m = inkOf(cs, n.nodeValue[i])
          let y0 = q.top + q.height * 0.18, y1 = q.bottom - q.height * 0.16
          if (m) { const base = q.top + m.fa; y0 = base - m.a; y1 = base + m.d }   // baseline = content top + font ascent
          glyphs.push({ nid, ch: n.nodeValue[i], txt: n.nodeValue.trim().slice(0, 40), cap: inCap(el), x0: q.left, x1: q.right, y0, y1 })
        }
      }
    }
    outer: for (let i = 0; i < glyphs.length; i++) for (let j = i + 1; j < glyphs.length; j++) {
      const a = glyphs[i], c = glyphs[j]; if (a.nid === c.nid) continue
      if (a.x0 < c.x1 - 1 && c.x0 < a.x1 - 1 && a.y0 < c.y1 - 1 && c.y0 < a.y1 - 1) { out.overlap.push(`"${a.txt}" x "${c.txt}"`); if (out.overlap.length > 3) break outer }
    }
    const [fx0, fy0, fx1, fy1] = cfg.FR, [by0, by1] = cfg.BAND
    for (const g of glyphs) if (g.x0 < fx0 || g.x1 > fx1 || g.y0 < fy0 || g.y1 > fy1) { out.frame.push(`"${g.txt}" ${g.ch} @${Math.round(g.x0)},${Math.round(g.y0)}`); break }
    for (const g of glyphs) {
      if (g.cap && (g.y0 < by0 || g.y1 > by1)) { out.zone.push(`caption glyph ${g.ch} y ${Math.round(g.y0)}..${Math.round(g.y1)}`); break }
      if (!g.cap && g.y1 > by0 - 4 && g.y0 < by1) { out.zone.push(`"${g.txt}" in caption band y ${Math.round(g.y0)}`); break }
    }
    for (const layer of document.querySelectorAll(cfg.strokes)) {
      for (const s of layer.querySelectorAll('path, line, rect, circle, ellipse, polyline, polygon')) {
        if (op(s) <= 0.05) continue
        const cs = getComputedStyle(s); if (cs.stroke === 'none' || Number(cs.strokeOpacity) <= 0.05 || parseFloat(cs.strokeWidth) <= 0) continue
        let L = 0; try { L = s.getTotalLength() } catch (e) { continue }
        if (!(L > 0)) continue
        const pl = Number(s.getAttribute('pathLength')) || L
        const da = cs.strokeDasharray || 'none', dof = parseFloat(cs.strokeDashoffset) || 0
        let visFrac = 1
        if (da !== 'none') { const parts = da.split(/[ ,]+/).map(parseFloat); if (parts.length === 2 && parts[0] >= pl * 0.99) visFrac = Math.max(0, Math.min(1, 1 - dof / pl)) }
        const ctm = s.getScreenCTM(), N = Math.max(8, Math.ceil(L / 4))
        for (let k = 0; k <= N; k++) {
          const f = k / N; if (f > visFrac + 1e-6) break
          const p = s.getPointAtLength(f * L), X = ctm.a * p.x + ctm.c * p.y + ctm.e, Y = ctm.b * p.x + ctm.d * p.y + ctm.f
          const hit = glyphs.find((g) => X > g.x0 + 1 && X < g.x1 - 1 && Y > g.y0 + 1 && Y < g.y1 - 1)
          if (hit) { out.stroke.push(`${s.tagName}${s.id ? '#' + s.id : ''} at ${Math.round(X)},${Math.round(Y)} through "${hit.txt}" (${hit.ch})`); break }
        }
        if (out.stroke.length > 3) break
      }
    }
    if (cfg.ink) for (const s of document.querySelectorAll(cfg.ink)) {
      if (op(s) <= 0.05 || !s.isPointInFill) continue
      const cs = getComputedStyle(s); if (cs.fill === 'none' || Number(cs.fillOpacity) <= 0.05) continue
      if (s.tagName === 'path' && (s.getAttribute('d') || 'M0 0') === 'M0 0') continue
      const bb = s.getBoundingClientRect(); if (bb.width < 0.5 && bb.height < 0.5) continue
      const inv = s.getScreenCTM().inverse()
      for (const g of glyphs) {
        if (g.x1 < bb.left || g.x0 > bb.right || g.y1 < bb.top || g.y0 > bb.bottom) continue
        const ym = (g.y0 + g.y1) / 2
        const hitp = [[(g.x0 + g.x1) / 2, ym], [g.x0 + (g.x1 - g.x0) * 0.25, ym], [g.x0 + (g.x1 - g.x0) * 0.75, ym]].some(([x, y]) => {
          const pt = new DOMPoint(x, y).matrixTransform(inv); return s.isPointInFill(pt)
        })
        if (hitp) { out.ink.push(`${s.tagName}${s.id ? '#' + s.id : ''} covers "${g.txt}" (${g.ch}) at ${Math.round(g.x0)},${Math.round(g.y0)}`); break }
      }
      if (out.ink.length > 3) break
    }
    const caps = [...document.querySelectorAll(cfg.caps)].filter((e) => op(e) > 0.05 && e.textContent.trim())
    if (caps.length > 1) out.captions.push(caps.map((e) => e.textContent.trim().slice(0, 30)).join(' | '))
    out.badgeOn = [...document.querySelectorAll(cfg.badge)].some((e) => op(e) > 0.5)
    return out
  }, tt, cfg)
  for (const k of Object.keys(fails)) for (const m of res[k] || []) fails[k].push(`${tt.toFixed(2)}s ${m}`)
  if (BW) {
    const want = BW.some(([a, b]) => tt >= a + 0.4 && tt <= b - 0.3)        // skip the fades at window edges
    const off = !BW.some(([a, b]) => tt >= a - 0.05 && tt <= b + 0.35)
    if (want && !res.badgeOn) fails.badge.push(`${tt.toFixed(2)}s badge missing inside its window`)
    if (off && res.badgeOn) fails.badge.push(`${tt.toFixed(2)}s badge visible outside every window`)
  }
}
let bad = 0
for (const [k, v] of Object.entries(fails)) {
  if (k === 'badge' && !BW) continue
  console.log(`${k.padEnd(9)} ${v.length ? 'FAIL ' + v.length : 'ok'}`)
  for (const m of v.slice(0, 12)) console.log('   ' + m)
  bad += v.length
}
if (A.json) fs.writeFileSync(A.json, JSON.stringify(fails, null, 1))
console.log('RESULT ' + JSON.stringify(Object.fromEntries(Object.entries(fails).map(([k, v]) => [k, v.length]))))
await browser.close(); srv.close()
process.exit(bad ? 1 : 0)
