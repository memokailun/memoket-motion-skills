#!/usr/bin/env node
const USAGE = `
render.mjs: frame-exact renderer for any page that follows the scene contract (window.DURATION, window.seek(t),
window.__ready; optional window.CAPTIONS, window.CUES, window.WARN). It serves --root over localhost, opens the scene in
headless Chrome, calls seek(t) for every frame, screenshots it and pipes the PNGs to x264.

Run it from your project folder (the one with node_modules), by full path:
  node <SKILL_DIR>/scripts/render.mjs --scene index.html --out out/draft.mp4 [--to 3]
  node <SKILL_DIR>/scripts/render.mjs --scene index.html --out out/final_silent.mp4 --scale 2 --warp out/warp.json
  node <SKILL_DIR>/scripts/render.mjs --scene index.html --stills 0,0.5,1,3.2 --stilldir out/stills --sheet out/stills.png
  node <SKILL_DIR>/scripts/render.mjs --scene index.html --cues out/cues.json [--warp out/warp.json] [--bed "A2,E3:-33:4"]
  node <SKILL_DIR>/scripts/render.mjs --scene index.html --warnings-only

Options
  --scene PATH       page relative to --root (may carry a query, e.g. index.html?fmt=sq)       required
  --root DIR         folder served as the web root (default: current folder)
  --size WxH         viewport in CSS px (default 1920x1080; a 1:1 cut is 1080x1080)
  --fps N            frames per second (default 30)
  --scale N          device pixel ratio; 2 renders 4x the pixels and downsamples with lanczos (finals: 2)
  --workers N        Chrome tabs in parallel (default 1). Joins between workers can show a one-frame sharpness
                     jump; use 1 for finals, or check every join frame printed at the end
  --from S --to S    render only this window (seconds of output time)
  --warp FILE        holds from plan_vo.mjs ({holds:[{at,dur}]}); output time maps to scene time through them
  --cues FILE        dump {duration, cues, captions, holds, bed} in output time instead of rendering (input of
                     synth.py and check_sync.py). Use the same --warp as the video. An existing bed in FILE is kept
  --bed SPEC         bed for synth.py: "notes,notes:gain:fade" (e.g. "A2,E3:-33:4"), a JSON file, or "none"
  --crf N            x264 quality (default 12: no blocking in flat dim areas, with aq-mode 3)
  --x264 PARAMS      x264 params (default aq-mode=3:ref=4; ref=4 keeps 1080p inside H.264 level 4.1)
  --preset NAME      x264 preset (default slow)
  --mblur N          N sub-frames per frame in a 180 degree shutter (default off). Rejected for finals: 4 gave
                     discrete ghost copies of fast text; smooth blur needs 16 or more. Fix strobing with speed caps
  --stills LIST      comma separated times; writes t%06.2f.png files to --stilldir (default out/stills)
  --sheet FILE       with --stills: also tile them into one labelled contact sheet (needs Python with Pillow)
  --warnings-only    load, print engine warnings and engine state, exit 1 if there are warnings
  --keep-temp        keep the per-worker segment folder (deleted on success by default)
  --timeout S        seconds to wait for window.__ready (default 60)
Prints a final line "RESULT {json}".
`
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { parseArgs, usage, fail, parseSize, launch, serve, sceneUrl, openPage, python, skillDir, checkFfmpeg } from './lib/page.mjs'

const A = parseArgs(process.argv.slice(2), ['warnings-only', 'keep-temp'])
usage(USAGE, A)
if (!A.scene) fail('--scene is required (see --help)')
const root = path.resolve(A.root || '.')
const [W, H] = parseSize(A.size)
const fps = Number(A.fps || 30)
const scale = Number(A.scale || 1)
const workers = Math.max(1, Number(A.workers || 1))
const MB = Math.max(1, Number(A.mblur || 1))
const SHUTTER = 0.5                       // 180 degree shutter
const CRF = String(A.crf ?? 12)
const X264 = A.x264 || 'aq-mode=3:ref=4'
const PRESET = A.preset || 'slow'
const LEVEL = W * H <= 1920 * 1088 ? '4.1' : '5.1'
const timeout = Number(A.timeout || 60)
if (!fs.existsSync(path.join(root, A.scene.split('?')[0]))) fail(`scene not found: ${path.join(root, A.scene.split('?')[0])}`)
const VIDEO = !A['warnings-only'] && !A.cues && !A.stills
if (VIDEO) checkFfmpeg()                  // before Chrome starts: a missing or old ffmpeg fails here in one line

// time warp: holds inserted at scene times. Output time t shows scene time sceneT(t).
const HOLDS = A.warp ? JSON.parse(fs.readFileSync(A.warp, 'utf8')).holds.slice().sort((a, b) => a.at - b.at) : []
const HOLD_TOTAL = HOLDS.reduce((a, h) => a + h.dur, 0)
const sceneT = (t) => { let acc = 0; for (const h of HOLDS) { if (t <= h.at + acc) break; if (t <= h.at + acc + h.dur) return h.at; acc += h.dur } return t - acc }
const outT = (ts) => { let acc = 0; for (const h of HOLDS) { if (h.at < ts) acc += h.dur } return ts + acc }
const COLOR = ['-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv']

function ffmpegEncode(out) {
  const blend = MB > 1 ? `tmix=frames=${MB},select='not(mod(n+1\\,${MB}))',setpts=N/${fps}/TB,` : ''
  // colour tags are written into the stream (setparams) and the container; without them players guess
  const vf = blend + (scale !== 1 ? `scale=${W}:${H}:flags=lanczos,` : '') +
    'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv'
  const enc = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps * MB), '-c:v', 'png', '-i', '-',
    '-vf', vf, '-c:v', 'libx264', '-preset', PRESET, '-crf', CRF, '-x264-params', X264, '-profile:v', 'high', '-level:v', LEVEL,
    '-pix_fmt', 'yuv420p', ...COLOR, '-r', String(fps), '-fps_mode', 'cfr', out], { stdio: ['pipe', 'inherit', 'inherit'] })
  enc.failed = null
  enc.on('error', (e) => { enc.failed = enc.failed || e })
  enc.stdin.on('error', (e) => { enc.failed = enc.failed || e })
  return enc
}
function parseBed(spec) {
  if (!spec || spec === 'none') return null
  if (fs.existsSync(spec)) return JSON.parse(fs.readFileSync(spec, 'utf8'))
  const [notes, gain, fade] = spec.split(':')
  return { notes: notes.split(','), gain: Number(gain ?? -33), fade: Number(fade ?? 4) }
}

const srv = await serve(root)
const url = sceneUrl(srv, A.scene)
const browser = await launch()
let exitCode = 0
try {
  const probe = await openPage(browser, url, { width: W, height: H, scale, timeout })
  const info = await probe.evaluate(() => ({
    D: window.DURATION, warn: window.WARN || window.K_WARN || window.__WARN || [],
    anims: document.getAnimations ? document.getAnimations().length : 0,
  }))
  if (!(info.D > 0)) throw new Error('window.DURATION is missing or not positive')
  const DURATION = +(info.D + HOLD_TOTAL).toFixed(4)
  console.log(`scene ${A.scene}: ${info.D} s${HOLD_TOTAL ? ` + holds ${HOLD_TOTAL.toFixed(3)} s` : ''}, engine warnings ${info.warn.length}, browser animations ${info.anims}, ${await browser.version()}`)
  for (const w of info.warn.slice(0, 40)) console.log('  warn ' + w)
  if (A['warnings-only']) {
    if (info.anims) console.log('  browser animations are running: CSS animations, transitions or WAAPI are not seek-safe')
    exitCode = info.warn.length || info.anims ? 1 : 0
  } else if (A.cues) {
    const CUES = (await probe.evaluate(() => window.CUES || [])).map((c) => ({ ...c, t: +outT(c.t).toFixed(4) }))
    const CAPTIONS = (await probe.evaluate(() => window.CAPTIONS || [])).map((c) => ({ ...c, in: +outT(c.in).toFixed(4), out: +outT(c.out).toFixed(4) }))
    let bed = A.bed ? parseBed(A.bed) : null
    if (!A.bed && fs.existsSync(A.cues)) { try { bed = JSON.parse(fs.readFileSync(A.cues, 'utf8')).bed || null } catch (e) { /* new file */ } }
    const doc = { duration: DURATION, cues: CUES, captions: CAPTIONS, holds: HOLDS }
    if (bed) doc.bed = bed
    fs.mkdirSync(path.dirname(path.resolve(A.cues)), { recursive: true })
    fs.writeFileSync(A.cues, JSON.stringify(doc, null, 1))
    console.log(`cues: ${CUES.length}, captions ${CAPTIONS.length}, bed ${bed ? JSON.stringify(bed) : 'none'}, duration ${DURATION} s, written to ${A.cues}`)
    console.log('RESULT ' + JSON.stringify({ mode: 'cues', file: A.cues, cues: CUES.length, captions: CAPTIONS.length, duration: DURATION }))
  } else if (A.stills) {
    const dir = A.stilldir || 'out/stills'
    fs.mkdirSync(dir, { recursive: true })
    const files = []
    for (const t of A.stills.split(',').map(Number)) {
      const f = path.join(dir, `t${t.toFixed(2).padStart(6, '0')}.png`)
      await probe.evaluate((t) => { window.seek(t) }, sceneT(t))
      fs.writeFileSync(f, await probe.screenshot({ type: 'png' }))
      files.push([t, f])
    }
    console.log(`stills: ${files.length}, written to ${dir}`)
    if (A.sheet) {
      const r = spawnSync(python(), [path.join(skillDir(), 'scripts/review_sheets.py'), 'tile', A.sheet, ...files.flatMap(([t, f]) => [String(t), f])], { stdio: 'inherit' })
      if (r.status !== 0) console.error('sheet failed: needs Pillow; create the project venv (.venv) or set PYTHON to a Python that has it')
    }
    console.log('RESULT ' + JSON.stringify({ mode: 'stills', dir, files: files.map((f) => f[1]), sheet: A.sheet || null }))
  } else {
    const out = A.out
    if (!out) throw new Error('--out is required for a video render')
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true })
    const t0 = Number(A.from || 0), t1 = Math.min(Number(A.to ?? DURATION), DURATION)
    const f0 = Math.round(t0 * fps), f1 = Math.round(t1 * fps)
    const n = f1 - f0
    if (n <= 0) throw new Error(`nothing to render between ${t0} and ${t1} s`)
    const k = Math.max(1, Math.min(workers, Math.ceil(n / 60)))
    const per = Math.ceil(n / k)
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mx-render-'))
    const started = process.hrtime.bigint()
    const sub = (j) => ((j + 0.5) / MB - 0.5) * SHUTTER / fps
    let done = 0
    // each worker seeks its own contiguous range in ascending order, like the stills and checks that verified it
    await Promise.all(Array.from({ length: k }, async (_, w) => {
      const a = f0 + w * per, b = Math.min(f1, a + per); if (a >= b) return
      const page = w === 0 ? probe : await openPage(browser, url, { width: W, height: H, scale, timeout, quiet: true })
      const enc = ffmpegEncode(path.join(tmp, `seg${String(w).padStart(2, '0')}.mp4`))
      const closed = new Promise((ok, bad) => {
        enc.on('error', (e) => bad(new Error('ffmpeg could not start: ' + e.message)))
        enc.on('close', (c) => (c === 0 ? ok() : bad(new Error('ffmpeg exited ' + c))))
      })
      closed.catch(() => {})              // awaited below; this only keeps an early failure from being unhandled
      for (let f = a; f < b; f++) {
        for (let j = 0; j < MB; j++) {
          const t = Math.max(0, f / fps + (MB > 1 ? sub(j) : 0))
          await page.evaluate((ts) => { window.seek(ts) }, sceneT(t))
          const buf = await page.screenshot({ type: 'png', optimizeForSpeed: true })
          if (enc.failed) throw new Error('ffmpeg failed: ' + enc.failed.message)
          if (!enc.stdin.write(buf)) await new Promise((ok) => { enc.stdin.once('drain', ok); enc.once('close', ok) })
        }
        if (++done % 150 === 0) console.log(`  ${done}/${n} frames`)
      }
      enc.stdin.end(); await closed
    }))
    const list = fs.readdirSync(tmp).filter((f) => f.startsWith('seg')).sort().map((f) => `file '${path.join(tmp, f)}'`).join('\n')
    fs.writeFileSync(path.join(tmp, 'list.txt'), list)
    await new Promise((ok, bad) => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt'), '-c', 'copy',
      '-bsf:v', 'h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1:video_full_range_flag=0', ...COLOR,
      '-movflags', '+faststart', out], { stdio: 'inherit' })
      .on('error', (e) => bad(new Error('ffmpeg could not start: ' + e.message)))
      .on('close', (c) => (c === 0 ? ok() : bad(new Error('concat exited ' + c)))))
    const secs = Number(process.hrtime.bigint() - started) / 1e9
    const joins = Array.from({ length: k - 1 }, (_, w) => f0 + (w + 1) * per - f0)
    if (A['keep-temp']) console.log('temp kept: ' + tmp)
    else fs.rmSync(tmp, { recursive: true, force: true })
    console.log(`video: ${n} frames (${(n / fps).toFixed(2)} s) at ${W}x${H}, scale ${scale}, ${k} worker(s), ${secs.toFixed(0)} s, written to ${out}`)
    if (joins.length) console.log(`  worker joins at output frames ${joins.join(', ')}: compare each with its neighbours before delivery`)
    console.log('RESULT ' + JSON.stringify({ mode: 'video', out, frames: n, seconds: +(n / fps).toFixed(3), workers: k, joins, renderSeconds: Math.round(secs) }))
  }
} catch (e) {
  console.error('render failed: ' + (e && e.message ? e.message : e))
  exitCode = 1
} finally {
  await browser.close(); srv.close()
}
process.exit(exitCode)
