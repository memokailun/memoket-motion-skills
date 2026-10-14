#!/usr/bin/env node
const USAGE = `
init.mjs: start a video project by copying a working template out of the skill (the skill folder itself is never
written to). The copy renders as is: a short demo beat with captions, cues and the house look.

  node <SKILL_DIR>/scripts/init.mjs <project-dir> [--engine motion|hyperframes] [--force]

  --engine motion       (default) Motion library scene for scripts/render.mjs: index.html, style.css, js/core.js,
                        js/main.js, timing.json, package.json
  --engine hyperframes  HyperFrames composition with the same beat: index.html, js/scene.js, fonts.config.json,
                        timing.json, package.json
  Both also get direction.md, lines.json, timing.config.json and a .gitignore.
  --force               overwrite files that already exist (default: keep them and report)

Then: cd <project-dir> && npm install (see the printed next steps).
`
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs, usage, fail, skillDir } from './lib/page.mjs'

const A = parseArgs(process.argv.slice(2), ['force'])
usage(USAGE, A)
const dest = A._[0]
if (!dest) fail('give the project folder to create (see --help)')
const engine = A.engine || 'motion'
if (!['motion', 'hyperframes'].includes(engine)) fail('--engine must be motion or hyperframes')
const SK = skillDir()
const T = path.join(SK, 'assets/templates')
const out = path.resolve(dest)
if (out === SK || out.startsWith(SK + path.sep)) fail('the project must live outside the skill folder')
const copied = [], kept = []
const copy = (src, dst) => {
  if (fs.statSync(src).isDirectory()) { for (const f of fs.readdirSync(src)) copy(path.join(src, f), path.join(dst, f)); return }
  if (fs.existsSync(dst) && !A.force) { kept.push(path.relative(out, dst)); return }
  fs.mkdirSync(path.dirname(dst), { recursive: true })
  fs.copyFileSync(src, dst); copied.push(path.relative(out, dst))
}
copy(path.join(T, engine), out)
for (const f of ['direction.md', 'lines.json', 'timing.config.json']) copy(path.join(T, 'docs', f), path.join(out, f))
const gi = path.join(out, '.gitignore')
if (!fs.existsSync(gi)) { fs.writeFileSync(gi, 'node_modules/\n.venv/\nout/\nrenders/\ncuts/\nvendor/\nfonts/\n.thumbnails/\n.hyperframes/\n*.wav\n'); copied.push('.gitignore') }

const S = SK
const venv = `
  python3 -m venv .venv && .venv/bin/pip install -r "${S}/scripts/requirements.txt"
  # every Python tool then runs as: .venv/bin/python "${S}/scripts/<tool>.py"  (Windows: .venv\\Scripts\\python)`
const next = engine === 'motion' ? `
  cd ${dest}
  npm install                     # motion, puppeteer-core and the fonts, pinned exactly${venv}
  node "${S}/scripts/render.mjs" --scene index.html --stills 0,1,2.5,5 --stilldir out/stills --sheet out/stills.png
  node "${S}/scripts/render.mjs" --scene index.html --out out/draft.mp4 --to 3
  node "${S}/scripts/qa_scene.mjs" --scene index.html` : `
  cd ${dest}
  npm install                     # hyperframes, gsap, puppeteer-core and the fonts, pinned exactly${venv}
  node "${S}/scripts/hf/prepare.mjs"          # vendor gsap, local fonts, bake timing.json, inline fonts
  npm run check
  node "${S}/scripts/hf/make_cut.mjs" index.html cuts/first3.html --n 1 --to 3
  HYPERFRAMES_NO_TELEMETRY=1 DO_NOT_TRACK=1 HYPERFRAMES_NO_UPDATE_CHECK=1 HYPERFRAMES_SKIP_SKILLS=1 \\
    npx hyperframes render -c cuts/first3.html --fps 30 --quality draft -o out/draft3.mp4`
console.log(`${engine} project in ${out}: ${copied.length} files copied${kept.length ? `, ${kept.length} kept (use --force to overwrite): ${kept.join(', ')}` : ''}`)
console.log('Next steps (in Codex, npm install, pip install and the first HyperFrames render need network, and render and check\n' +
  'commands start Chrome and a local server: approve them to run outside the sandbox):' + next)
