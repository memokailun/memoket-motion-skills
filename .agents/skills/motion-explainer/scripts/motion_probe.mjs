#!/usr/bin/env node
const USAGE = `
motion_probe.mjs: re-checks, in headless Chrome, the Motion behaviours the engine in assets/templates/motion/js/core.js
depends on. Run it before upgrading Motion past the pinned version; any DIFF means a rule in references/motion-engine.md
may no longer hold, so re-run the determinism check on a real scene before shipping the upgrade.

  node <SKILL_DIR>/scripts/motion_probe.mjs          (from a project whose node_modules has motion and puppeteer-core)

Expected on motion 14.1.0: A one browser animation while WAAPI is present; B a restated "from" glides across the gap,
a continued one holds; C before its first segment a value shows that segment's from; D adding mass makes Motion
ignore bounce (peak 1.163 against 1.0); E a zero-delta spring gives NaN; F a velocity-only spring never moves inside
a sequence; G "opacity" writes CSS style, "attrOpacity" the attribute; H pathLength writes dasharray "L (1 - L)".
`
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs, usage, fail, launch, serve, skillDir, projectBase } from './lib/page.mjs'

const A = parseArgs(process.argv.slice(2))
usage(USAGE, A)
if (!fs.existsSync(path.join(projectBase(), 'node_modules/motion/dist/motion.js'))) fail('node_modules/motion/dist/motion.js not found: run from a project with motion installed')
const html = fs.readFileSync(path.join(skillDir(), 'assets/probe/motion_probe.html'), 'utf8')
const EXPECT = {
  A_waapiAnimations: 1, B_gapRestated: [0.851, 0.532, 0.021], B_gapContinued: [1, 1, 1], C_beforeFirst: 3,
  D_peakWithMass: 1.163, D_peakNoMass: 1, E_zeroDelta: ['NaN', 'NaN', '7'], F_velocityInSequence: ['0', '0'],
  F_velocityStandalone: [0.721, 0.823], G_opacity: { attr: '1', style: '0.5', browserAnimations: 0 }, G_attrOpacity: '0.5', H_dasharray: '0.5 0.5',
}
const srv = await serve(projectBase(), { '/__probe.html': html })
const b = await launch()
const pg = await b.newPage()
pg.on('pageerror', (e) => console.error('[page error]', e.message))
await pg.goto(`http://127.0.0.1:${srv.address().port}/__probe.html`)
await pg.waitForFunction('window.done === true', { timeout: 20000 })
const out = await pg.evaluate(() => window.OUT)
await b.close(); srv.close()
const version = JSON.parse(fs.readFileSync(path.join(projectBase(), 'node_modules/motion/package.json'), 'utf8')).version
let diffs = 0
for (const [k, want] of Object.entries(EXPECT)) {
  const same = JSON.stringify(out[k]) === JSON.stringify(want)
  if (!same) diffs++
  console.log(`${same ? 'same' : 'DIFF'}  ${k}: ${JSON.stringify(out[k])}${same ? '' : `  (14.1.0: ${JSON.stringify(want)})`}`)
}
console.log(`motion ${version}: ${diffs} difference(s) from 14.1.0`)
process.exit(diffs ? 1 : 0)
