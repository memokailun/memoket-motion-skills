// Shared helpers for the browser tools: argument parsing, project-relative module loading, Chrome discovery,
// a static file server, and opening a scene page that follows the scene contract.
//
// Not run directly. Every tool in scripts/ imports it with a relative path.
//
// Environment variables (all optional):
//   CHROME_PATH    Chrome, Chromium or chrome-headless-shell binary. Default: the first one found in the usual
//                  install folders, then the puppeteer and hyperframes download caches.
//   CHROME_FLAGS   extra Chrome flags, space separated (for example --no-sandbox, only when running as root in a
//                  container).
//   NODE_MODULES   node_modules folder that holds puppeteer-core (and mathjax-full for tex2svg). Default: the
//                  node_modules found from the current folder upward, so run tools from the project folder.
//   PYTHON         Python interpreter for helpers that call Python (contact sheets). Default: the project's
//                  .venv/bin/python (Windows .venv\Scripts\python.exe) when it exists, else python3.
import { createRequire } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawnSync } from 'node:child_process'

// ------------------------------------------------------------------ arguments
// parseArgs(argv, bools): "--key value" pairs, "--flag" for names listed in bools, everything else positional.
export function parseArgs(argv, bools = []) {
  const o = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const k = a.slice(2)
      if (bools.includes(k) || k === 'help') o[k] = true
      else { if (i + 1 >= argv.length) fail(`--${k} needs a value`); o[k] = argv[++i] }
    } else o._.push(a)
  }
  return o
}
export function fail(msg, code = 2) { console.error('error: ' + msg); process.exit(code) }
export function usage(text, opts) { if (opts.help) { console.log(text.trim()); process.exit(0) } }
export const parseSize = (s, d = '1920x1080') => {
  const m = String(s || d).match(/^(\d+)x(\d+)$/)
  if (!m) fail(`--size must look like 1920x1080, got ${s}`)
  return [Number(m[1]), Number(m[2])]
}

// ------------------------------------------------------------------ modules from the user's project
// Node resolves bare imports from the importing file's folder (the skill), not from the project, so packages are
// resolved from NODE_MODULES or from the current folder upward.
export function projectBase() {
  return process.env.NODE_MODULES ? path.resolve(process.env.NODE_MODULES, '..') : process.cwd()
}
export async function importFromProject(name, hint) {
  const base = projectBase()
  const req = createRequire(pathToFileURL(base + path.sep).href)
  let p
  try { p = req.resolve(name) } catch (e) {
    fail(`cannot find the npm package "${name}" from ${base}. ` + (hint || 'Run the tool from your project folder after npm install, or set NODE_MODULES=/path/to/node_modules.'))
  }
  return import(pathToFileURL(p).href)
}
export async function loadPuppeteer() {
  const m = await importFromProject('puppeteer-core', 'Install it in your project: npm install puppeteer-core@25.12.0 (the templates pin it).')
  const p = m.default && m.default.launch ? m.default : m
  if (!p || !p.launch) fail('puppeteer-core loaded but has no launch(); check the installed version')
  return p
}

// ------------------------------------------------------------------ Chrome
function globBins(root, names, depth = 4) {
  const out = []
  const walk = (d, k) => {
    let ents = []
    try { ents = fs.readdirSync(d, { withFileTypes: true }) } catch (e) { return }
    for (const e of ents) {
      const p = path.join(d, e.name)
      if (e.isDirectory() && k > 0) walk(p, k - 1)
      else if (names.includes(e.name)) out.push(p)
    }
  }
  walk(root, depth)
  return out.sort().reverse()
}
export function findChrome() {
  const env = process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH
  if (env) {
    if (!fs.existsSync(env)) fail(`CHROME_PATH points at ${env}, which does not exist`)
    return env
  }
  const home = os.homedir()
  const cands = []
  if (process.platform === 'darwin') {
    for (const base of ['/Applications', path.join(home, 'Applications')]) {
      cands.push(`${base}/Google Chrome.app/Contents/MacOS/Google Chrome`, `${base}/Chromium.app/Contents/MacOS/Chromium`,
        `${base}/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`)
    }
  } else if (process.platform === 'win32') {
    for (const base of [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean)) {
      cands.push(path.join(base, 'Google/Chrome/Application/chrome.exe'), path.join(base, 'Chromium/Application/chrome.exe'))
    }
  } else {
    cands.push('/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium')
  }
  for (const c of cands) if (fs.existsSync(c)) return c
  const names = ['chrome', 'chrome.exe', 'Google Chrome for Testing', 'chrome-headless-shell', 'chrome-headless-shell.exe']
  for (const root of [path.join(home, '.cache/puppeteer'), path.join(home, '.cache/hyperframes/chrome')]) {
    const hit = globBins(root, names, 6).find((p) => { try { return fs.statSync(p).isFile() } catch (e) { return false } })
    if (hit) return hit
  }
  fail('no Chrome found. Set CHROME_PATH to a Chrome, Chromium or chrome-headless-shell binary, or install one with:\n' +
    '  npx @puppeteer/browsers install chrome-headless-shell@stable --path ~/.cache/puppeteer')
}
// The same flags for every tool, so stills, checks and renders raster alike.
export const CHROME_ARGS = ['--hide-scrollbars', '--force-color-profile=srgb', '--disable-lcd-text', '--font-render-hinting=none',
  '--no-first-run', '--allow-file-access-from-files']
export async function launch(extraArgs = []) {
  const puppeteer = await loadPuppeteer()
  const executablePath = findChrome()
  const envFlags = (process.env.CHROME_FLAGS || '').split(/\s+/).filter(Boolean)
  try {
    return await puppeteer.launch({ executablePath, headless: true, args: [...CHROME_ARGS, ...envFlags, ...extraArgs] })
  } catch (e) {
    const root = process.platform === 'linux' && process.getuid && process.getuid() === 0
    fail(`Chrome failed to start (${executablePath}): ${e.message}\n` +
      'Common causes: in Codex, the default sandbox aborts Chrome and blocks the local server, so run this command ' +
      'outside the sandbox; on Linux as root (Docker), Chrome refuses to run without its own sandbox, so set ' +
      `CHROME_FLAGS=--no-sandbox in containers only${root ? ' (you are root here)' : ''}.`)
  }
}

// ------------------------------------------------------------------ ffmpeg
// checkFfmpeg(): fail early with one clear line when ffmpeg is missing or older than 5.1 (-fps_mode needs 5.1).
export function checkFfmpeg() {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-version'], { encoding: 'utf8' })
  if (r.error || r.status !== 0) fail('ffmpeg 5.1 or newer not found on PATH; install it (brew, apt, winget)')
  const m = /ffmpeg version n?(\d+)\.(\d+)/.exec(r.stdout || '')
  if (m && (Number(m[1]) < 5 || (Number(m[1]) === 5 && Number(m[2]) < 1))) {
    fail(`ffmpeg ${m[1]}.${m[2]} is too old: 5.1 or newer is needed (-fps_mode); install a current one (brew, apt, winget)`)
  }
  return m ? `${m[1]}.${m[2]}` : 'unknown (a development build)'
}

// ------------------------------------------------------------------ static server
const MIME = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.cjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.map': 'application/json', '.txt': 'text/plain',
  '.csv': 'text/csv', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.wasm': 'application/wasm',
}
// serve(root, virtual): files under root only (no traversal), never cached; virtual = {'/__x.html': 'content'}.
export function serve(root, virtual = {}) {
  root = path.resolve(root)
  return new Promise((res) => {
    const srv = http.createServer((req, resp) => {
      const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname)
      if (virtual[urlPath] != null) { resp.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' }); return resp.end(virtual[urlPath]) }
      const p = path.join(root, urlPath)
      const rel = path.relative(root, p)
      if (rel.startsWith('..') || path.isAbsolute(rel) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { resp.writeHead(404); return resp.end() }
      resp.writeHead(200, { 'Content-Type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' })
      fs.createReadStream(p).pipe(resp)
    })
    srv.on('error', (e) => fail(`local server failed (${e.code || e.message}). In Codex, run this command outside the sandbox.`))
    srv.listen(0, '127.0.0.1', () => res(srv))
  })
}
export const sceneUrl = (srv, scene) => `http://127.0.0.1:${srv.address().port}/${scene.replace(/^\.?\//, '')}`

// ------------------------------------------------------------------ scene pages
// openPage: waits for fonts, then for window.__ready === true and window.seek, or fails fast on window.__error.
export async function openPage(browser, url, { width = 1920, height = 1080, scale = 1, timeout = 60, quiet = false } = {}) {
  const page = await browser.newPage()
  page.on('pageerror', (e) => console.error('[page error]', e.message))
  if (!quiet) page.on('console', (m) => {
    const t = m.type()
    if ((t === 'error' || t === 'warning' || t === 'warn') && !/favicon|404/.test(m.text())) console.error(`[page ${t}]`, m.text())
  })
  await page.setViewport({ width, height, deviceScaleFactor: scale })
  await page.goto(url, { waitUntil: 'load', timeout: timeout * 1000 })
  await page.evaluate(() => document.fonts.ready)
  try {
    await page.waitForFunction('window.__error || (window.__ready === true && typeof window.seek === "function")', { timeout: timeout * 1000, polling: 100 })
  } catch (e) {
    fail(`the scene never set window.__ready (waited ${timeout} s): ${url}. Look for [page error] lines above; setup must end with window.__ready = true.`, 1)
  }
  const err = await page.evaluate(() => window.__error || null)
  if (err) fail(`scene setup failed: ${err}`, 1)
  return page
}
export const seekShot = async (page, t, clip) => {
  await page.evaluate((t) => { window.seek(t) }, t)
  return page.screenshot(clip ? { type: 'png', clip } : { type: 'png', optimizeForSpeed: true })
}
export const python = () => {
  if (process.env.PYTHON) return process.env.PYTHON
  const venv = process.platform === 'win32' ? path.join('.venv', 'Scripts', 'python.exe') : path.join('.venv', 'bin', 'python')
  return fs.existsSync(path.resolve(venv)) ? path.resolve(venv) : 'python3'
}
export const skillDir = () => path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
