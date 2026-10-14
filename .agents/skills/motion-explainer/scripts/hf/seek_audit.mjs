#!/usr/bin/env node
const USAGE = `
seek_audit.mjs: the frame at time t must not depend on what was rendered before it. The HyperFrames renderer seeks the
registered timeline with totalTime(t, true), probes the end first, and a parallel worker starts its chunk after a
jump to a later time. This compares, for every sample, a clean forward pass A with passes that first jump:
  B  seek to the end, then forward from 0
  C  seek to the end, jump to the middle, forward to the end
  D  seek to 3/4, jump to 1/4, forward to the middle
and, as the noise floor, A2: a second clean forward pass with no jump at all. Every pass opens a fresh page (reusing one
page crashed an audit with "Navigating frame was detached"). A pixel counts when its RGB sum differs by more than 24.

Accept when every flag in B, C and D is at or below what A2 shows: Chrome leaves 1 to 4 px seams on half-resolution
tile edges even between two identical passes. Read flags at full resolution before acting (--dpr 1).

  node <SKILL_DIR>/scripts/hf/seek_audit.mjs index.html [--size 1920x1080] [--step 0.25] [--dpr 0.5]

Opens the file directly (file://), like the renderer, with the project's puppeteer-core and CHROME_PATH (default: the
first Chrome found, including the chrome-headless-shell that hyperframes downloads to ~/.cache/hyperframes).
Prints JSON {samples, control, differing: {B, C, D}, beyondControl}; exit code 1 if anything is beyond the control.
`
import path from 'node:path'
import { parseArgs, usage, fail, parseSize, launch } from '../lib/page.mjs'

const A = parseArgs(process.argv.slice(2))
usage(USAGE, A)
const file = A._[0]
if (!file) fail('give the composition html (see --help)')
const [W, H] = parseSize(A.size)
const step = Number(A.step || 0.25), DPR = Number(A.dpr || 0.5)
const browser = await launch()
let page = null
const open = async () => {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (page) await page.close().catch(() => {})
      page = await browser.newPage()
      page.on('pageerror', (e) => console.error('[page error]', e.message))
      await page.setViewport({ width: W, height: H, deviceScaleFactor: DPR })
      await page.goto('file://' + path.resolve(file), { waitUntil: 'load', timeout: 120000 })
      await page.evaluate(async () => { await document.fonts.ready })
      await page.waitForFunction('window.__timelines && Object.keys(window.__timelines).length > 0', { timeout: 60000 })
      return
    } catch (e) { if (attempt === 2) throw e; await new Promise((r) => setTimeout(r, 1000)) }
  }
}
await open()
const dur = await page.evaluate(() => Number(document.getElementById('root').dataset.duration))
const ts = []; for (let t = 0; t <= dur + 1e-6; t += step) ts.push(Math.round(t * 1000) / 1000)
const seek = (t) => page.evaluate((t) => { Object.values(window.__timelines)[0].totalTime(t, true) }, t)
const shot = async () => { await new Promise((r) => setTimeout(r, 30)); return page.screenshot({ encoding: 'base64', type: 'png' }) }
const pass = async (pre, list) => { await open(); for (const p of pre) await seek(p); const o = {}; for (const t of list) { await seek(t); o[t] = await shot() } return o }
const REF = await pass([], ts)
const q = (f) => ts[Math.round((ts.length - 1) * f)]
const passes = {
  A2: await pass([], ts),
  B: await pass([dur], ts),
  C: await pass([dur], ts.filter((t) => t >= q(0.5))),
  D: await pass([q(0.75)], ts.filter((t) => t >= q(0.25) && t <= q(0.5))),
}
const cmp = (a, b) => page.evaluate(async (a, b, scale) => {
  const load = (s) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + s })
  const [ia, ib] = await Promise.all([load(a), load(b)])
  const c = document.createElement('canvas'); c.width = ia.width; c.height = ia.height; const x = c.getContext('2d')
  x.drawImage(ia, 0, 0); const da = x.getImageData(0, 0, c.width, c.height).data
  x.clearRect(0, 0, c.width, c.height); x.drawImage(ib, 0, 0); const db = x.getImageData(0, 0, c.width, c.height).data
  let n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1
  for (let i = 0; i < da.length; i += 4) {
    if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 24) {
      n++; const p = i / 4, px = p % c.width, py = (p / c.width) | 0
      x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py)
    }
  }
  return { n, box: n ? [x0 / scale, y0 / scale, x1 / scale, y1 / scale].map(Math.round) : null }
}, a, b, DPR)
const out = {}
for (const [k, P] of Object.entries(passes)) {
  out[k] = []
  for (const t of Object.keys(P)) if (P[t] !== REF[t]) { const r = await cmp(REF[t], P[t]); if (r.n > 0) out[k].push({ t: +t, ...r }) }
}
const floor = Math.max(0, ...out.A2.map((f) => f.n))
const beyond = ['B', 'C', 'D'].flatMap((k) => out[k].filter((f) => f.n > floor).map((f) => ({ pass: k, ...f })))
console.log(JSON.stringify({ samples: ts.length, control: { flags: out.A2.length, maxPixels: floor }, differing: { B: out.B, C: out.C, D: out.D }, beyondControl: beyond }))
console.log(`RESULT seek audit: ${ts.length} samples, control noise up to ${floor} px, ${beyond.length} flag(s) beyond the control`)
await browser.close()
process.exit(beyond.length ? 1 : 0)
