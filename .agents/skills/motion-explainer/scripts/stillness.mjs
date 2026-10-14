#!/usr/bin/env node
const USAGE = `
stillness.mjs: stretches where the stage does not visibly move, measured before rendering. A still stage under a line
that matters was the most common review finding of all. Frames are taken every 0.1 s at phone size (about 384 px
wide) with captions hidden; a frame counts as moving when more than --pixels pixels changed by more than --levels
against the frame --lag seconds earlier (1 to 2 px pulses only "keep it alive" on paper, so exact hashes are not used).

  node <SKILL_DIR>/scripts/stillness.mjs --scene index.html [--min 1.6]

  --min S       report still runs at least this long (default 1.6)
  --caps SEL    caption layer hidden while measuring (default "#caps")
  --levels N    change threshold per pixel in code values (default 18)
  --pixels N    pixels that must change (default 6)
  --lag S       compare against the frame this much earlier (default 0.3)
  --size WxH    viewport (default 1920x1080)
Designed holds (the finished image under its caption, the last frame) are allowed: list them in the build notes.
For a rendered video use alive.py instead.
`
import { parseArgs, usage, fail, parseSize, launch, serve, sceneUrl, openPage } from './lib/page.mjs'

const A = parseArgs(process.argv.slice(2))
usage(USAGE, A)
if (!A.scene) fail('--scene is required (see --help)')
const [W, H] = parseSize(A.size)
const MIN = Number(A.min || 1.6), LEV = Number(A.levels || 18), PIX = Number(A.pixels || 6), LAG = Number(A.lag || 0.3)
const srv = await serve(A.root || '.')
const b = await launch()
const pg = await openPage(b, sceneUrl(srv, A.scene), { width: W, height: H, scale: 384 / W, timeout: 120 })
const D = await pg.evaluate(() => window.DURATION)
await pg.addStyleTag({ content: `${A.caps || '#caps'} { visibility: hidden !important }` })
const lagN = Math.max(1, Math.round(LAG * 10))
const moving = []
for (let i = 0; i <= Math.round(D * 10); i++) {
  await pg.evaluate((t) => window.seek(t), i / 10)
  const shot = await pg.screenshot({ type: 'png', encoding: 'base64' })
  // decode in the page, keep only the last lagN + 1 frames, compare with the one lagN steps back
  moving.push(await pg.evaluate(async (b64, lagN, LEV, PIX) => {
    const im = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + b64 })
    const c = (window.__stC = window.__stC || document.createElement('canvas')), x = c.getContext('2d', { willReadFrequently: true })
    c.width = im.width; c.height = im.height; x.drawImage(im, 0, 0)
    const buf = (window.__stBuf = window.__stBuf || [])
    buf.push(x.getImageData(0, 0, c.width, c.height).data)
    if (buf.length > lagN + 1) buf.shift()
    if (buf.length <= lagN) return true
    const d = buf[buf.length - 1], p = buf[0]; let n = 0
    for (let k = 0; k < d.length; k += 4) if (Math.max(Math.abs(d[k] - p[k]), Math.abs(d[k + 1] - p[k + 1]), Math.abs(d[k + 2] - p[k + 2])) > LEV && ++n > PIX) return true
    return false
  }, shot, lagN, LEV, PIX))
}
const runs = []
let st = null
moving.concat([true]).forEach((m, i) => {
  if (!m && st === null) st = i
  if (m && st !== null) { if ((i - st) / 10 >= MIN) runs.push([st / 10, i / 10]); st = null }
})
for (const [a, z] of runs) console.log(`still ${a.toFixed(1)} to ${z.toFixed(1)} (${(z - a).toFixed(1)} s)`)
console.log(`${runs.length} still stretch(es) of ${MIN} s or more in ${D} s`)
console.log('RESULT ' + JSON.stringify({ runs }))
await b.close(); srv.close()
