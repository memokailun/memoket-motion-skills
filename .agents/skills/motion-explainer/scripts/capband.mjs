#!/usr/bin/env node
const USAGE = `
capband.mjs: drawn ink in the caption band. qa_scene.mjs only knows text and strokes; this finds any drawing (SVG,
canvas, HTML boxes) that enters the band where captions live. At every sample, with captions hidden, it screenshots
the band twice: once as rendered (A) and once with the content layers hidden too (B, the bare ground), and counts
pixels that differ by more than 24 code values. A live check once found a dispersal effect drawing 2,752 px into the
band. A sliding sheet's own paper and shadow also count while it passes; judge those by eye.

  node <SKILL_DIR>/scripts/capband.mjs --scene index.html [--step 0.25] [--band 900,1044]

  --caps SEL      caption layer to hide in both shots (default "#caps")
  --content SEL   layers hidden for the bare-ground shot (default "#ov, #labels, #chrome")
  --size WxH      viewport (default 1920x1080)
  --min N         ignore samples with at most N inked pixels (default 0)
Prints "t pixels" for every sample with ink; exit code 1 if any.
`
import { parseArgs, usage, fail, parseSize, launch, serve, sceneUrl, openPage } from './lib/page.mjs'

const A = parseArgs(process.argv.slice(2))
usage(USAGE, A)
if (!A.scene) fail('--scene is required (see --help)')
const [W, H] = parseSize(A.size)
const step = Number(A.step || 0.25)
const [y0, y1] = (A.band || '900,1044').split(',').map(Number)
const CAPS = A.caps || '#caps', CONTENT = A.content || '#ov, #labels, #chrome'
const MIN = Number(A.min || 0)
const srv = await serve(A.root || '.')
const b = await launch()
const pg = await openPage(b, sceneUrl(srv, A.scene), { width: W, height: H, scale: 1, timeout: 120 })
const D = await pg.evaluate(() => window.DURATION)
await pg.addStyleTag({ content: `${CAPS} { visibility: hidden !important }` })
const clip = { x: 0, y: y0, width: W, height: y1 - y0 }
const hits = []
for (let t = 0; t <= D + 1e-9; t += step) {
  const tt = Math.round(t * 1000) / 1000
  await pg.evaluate((tt) => window.seek(tt), tt)
  const a = await pg.screenshot({ type: 'png', clip, encoding: 'base64' })
  await pg.evaluate((sel) => { for (const e of document.querySelectorAll(sel)) { e.dataset.capbandVis = e.style.visibility; e.style.visibility = 'hidden' } }, CONTENT)
  const bb = await pg.screenshot({ type: 'png', clip, encoding: 'base64' })
  await pg.evaluate((sel) => { for (const e of document.querySelectorAll(sel)) e.style.visibility = e.dataset.capbandVis || '' }, CONTENT)
  if (a === bb) continue
  const n = await pg.evaluate(async (a, bb) => {
    const load = (s) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + s })
    const [ia, ib] = await Promise.all([load(a), load(bb)])
    const c = document.createElement('canvas'); c.width = ia.width; c.height = ia.height; const x = c.getContext('2d')
    x.drawImage(ia, 0, 0); const da = x.getImageData(0, 0, c.width, c.height).data
    x.clearRect(0, 0, c.width, c.height); x.drawImage(ib, 0, 0); const db = x.getImageData(0, 0, c.width, c.height).data
    let n = 0
    for (let i = 0; i < da.length; i += 4) if (Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2])) > 24) n++
    return n
  }, a, bb)
  if (n > MIN) hits.push([tt, n])
}
for (const [t, n] of hits) console.log(`${t.toFixed(2)} ${n}`)
console.log(`caption band y ${y0}..${y1}: ${hits.length} sample(s) with ink`)
console.log('RESULT ' + JSON.stringify({ samples: Math.floor(D / step) + 1, inked: hits.length, worst: hits.sort((p, q) => q[1] - p[1])[0] || null }))
await b.close(); srv.close()
process.exit(hits.length ? 1 : 0)
