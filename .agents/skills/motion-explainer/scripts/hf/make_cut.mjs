#!/usr/bin/env node
const USAGE = `
make_cut.mjs: write a derived copy of a HyperFrames composition whose registered timeline is a paused master that
scrubs the original from --from to --to, N times slower. Never edit generated cuts; regenerate after every change.

  node <SKILL_DIR>/scripts/hf/make_cut.mjs index.html cuts/slowmo16.html --n 16           motion-blur master
  node <SKILL_DIR>/scripts/hf/make_cut.mjs index.html cuts/first3.html --n 1 --to 3        a window for drafts
  node <SKILL_DIR>/scripts/hf/make_cut.mjs index.html cuts/look.html --n 16 --from 21.5 --to 22.5

  --n N        samples per original frame when rendered at the original fps (default 16; 1 = a plain window)
  --from S     original seconds where the cut starts (default 0)
  --to S       original seconds where it ends (default: the composition's data-duration)

Slowmo: render the cut at 30 fps (N samples per frame), then finish.sh blends them back with a 180 degree shutter.
Clip windows (data-start, data-duration) are read by the runtime in MASTER time, so the composition must write them
through the injected map window.__CUT = {from, n} (alias window.__SLOWMO): (t - from) * n. A composition with no timed
clips needs nothing. Asset paths ./assets ./fonts ./vendor ./js are rewritten when the cut lives in a subfolder. The
tool refuses to run if the registration line it rewrites is not found, so a renamed registration fails loudly.
`
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs, usage, fail } from '../lib/page.mjs'

const A = parseArgs(process.argv.slice(2))
usage(USAGE, A)
const [src, dst] = A._
if (!src || !dst) fail('usage: make_cut.mjs <src.html> <dst.html> [--n 16] [--from S] [--to S]')
const N = Number(A.n ?? 16)
if (!(N >= 1)) fail('--n must be 1 or more')
let s = fs.readFileSync(src, 'utf8')
const must = (re, to) => { if (!re.test(s)) fail('pattern not found in ' + src + ': ' + re); s = s.replace(re, to) }
let dur = null, from = 0, to = null, outDur = null
must(/(<div id="root"[^>]*?data-duration=")([\d.]+)(")/, (m, a, d, b) => {
  dur = Number(d); from = Number(A.from ?? 0); to = Number(A.to ?? dur)
  if (!(to > from) || to > dur + 1e-9) fail(`bad window ${from} to ${to} (duration ${dur})`)
  outDur = Math.round((to - from) * N * 1000) / 1000
  return a + outDur + b
})
// keep the registration key; register a master that shows the original at from + T / N
must(/window\.__timelines\["([\w-]+)"\] = tl;([^\n]*)\n(\s*)tl\.seek\(0\);/, (m, key, cmt, ind) =>
  `/* cut (scripts/hf/make_cut.mjs): master time T shows the original at ${from} + T / ${N} */\n` +
  `${ind}tl.seek(${from});\n` +
  `${ind}const CUT = gsap.timeline({ paused: true });\n` +
  `${ind}CUT.add(tl.tweenFromTo(${from}, ${to}, { duration: ${outDur}, ease: "none", immediateRender: false }), 0);\n` +
  `${ind}window.__timelines["${key}"] = CUT;\n${ind}CUT.seek(0);`)
must(/<meta charset="UTF-8" \/>/i, `<meta charset="UTF-8" />\n    <script>window.__CUT = window.__SLOWMO = { from: ${from}, n: ${N} };</script>`)
const depthSrc = path.relative(process.cwd(), path.dirname(path.resolve(src))), depthDst = path.relative(process.cwd(), path.dirname(path.resolve(dst)))
if (depthSrc === '' && depthDst !== '') {
  const up = depthDst.split(path.sep).map(() => '..').join('/')
  s = s.replace(/(["(])\.\/(assets|fonts|vendor|js)\//g, `$1${up}/$2/`)
} else if (depthSrc !== depthDst) fail('the source must be at the project root, or in the same folder as the output')
fs.mkdirSync(path.dirname(path.resolve(dst)), { recursive: true })
fs.writeFileSync(dst, s)
console.log(`${dst} written: original ${from} to ${to} s (of ${dur}) x ${N} = ${outDur} s`)
