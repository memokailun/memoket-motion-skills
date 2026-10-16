# Render pipeline

Read before the first render of a project, and again before the final. Paths are relative to the skill folder
(SKILL_DIR); commands run from the project folder.

Contents
1. The scene contract (engine-neutral)
2. Project layout and environment
3. render.mjs: what it does and the settings that were paid for
4. Workers, joins and long films
5. Time warp, cue dump and the bed
6. Stills and contact sheets
7. Machine discipline: one heavy job at a time
8. Final-file checks and delivery encodes
9. Codex sandbox and troubleshooting

## 1. The scene contract (engine-neutral)

A scene is one HTML page that defines these globals. Every tool (render, plan_vo, QA, cue dump) talks only to them,
so a Motion scene and a HyperFrames composition use the same audio and QA chain unchanged.

```js
window.DURATION = 8.17                   // scene seconds
window.seek = (t) => { ... }             // synchronous; sets EVERY visual for time t; pure function of t
window.__ready = true                    // last line of setup, after fonts, layout measuring and a first seek(0)
window.__error = 'message'               // set on setup failure so tools fail fast instead of timing out
window.CAPTIONS = [{ id, text, in, out }] // scene seconds; one voice line per id; last out = DURATION
window.CUES = [{ t, type, ...gain, pan }] // optional sound cues for synth.py
window.WARN = []                         // engine warnings (overlaps, mixed springs); must be empty for a final
```

- Same t, same pixels, whatever was seeked before. Render workers start mid-film, holds repeat a time, review stills
  come in any order. Nothing reads the clock: no requestAnimationFrame, setTimeout, CSS transitions or @keyframes,
  no `<video>`, no unseeded Math.random, no Date.
- Fixed stage: `html, body` at the stage size, overflow hidden, an explicit body background.
- Read caption texts and windows from the one timing sheet at load; never retype them. A `|` in source text may
  hand-break a caption for display; strip it before exposing window.CAPTIONS.
- Make the page refuse to load when its data drifts: throw in setup if a plotted number differs from the data file
  (to a stated tolerance). A console warning is not enough; set window.__error.
- Wait for every face by name before measuring: `await Promise.all(FACES.map((f) => document.fonts.load(f)))` then
  `document.fonts.ready`. fonts.ready alone can resolve before a lazily used face loads.
- Images: set `img.decoding = 'sync'` and wait for load events. Never await `img.decode()`: it can stay pending in a
  background tab, and two renders never became ready because of it.

## 2. Project layout and environment

`node SKILL_DIR/scripts/init.mjs <dir> --engine motion|hyperframes` copies a working template. The Motion template:

```text
index.html  style.css  js/core.js  js/main.js  timing.json  package.json  direction.md  lines.json  timing.config.json
```

- Serve root = the project folder (`--root`, default the current folder). Reference assets relatively
  (`node_modules/motion/dist/motion.js`, `timing.json`); a scene outside the root cannot be served.
- Pins (package.json, exact versions, never ranges): motion 14.1.0, puppeteer-core 25.12.0, fonts from
  @fontsource 5.3.0; HyperFrames projects add hyperframes 0.8.149 and gsap 3.15.0. Motion must be pinned: every
  engine rule depends on sequence and spring internals (scripts/motion_probe.mjs re-checks them).
- Environment variables: `CHROME_PATH` (Chrome, Chromium or chrome-headless-shell; default: first found in the usual
  install folders and the puppeteer and hyperframes caches), `CHROME_FLAGS` (extra Chrome flags, space separated;
  `--no-sandbox` only when running as root in a container), `NODE_MODULES` (default: found from the current folder
  upward), `PYTHON` (default: the project's `.venv/bin/python` when it exists, else python3; the venv holds numpy,
  scipy, Pillow and requests: `python3 -m venv .venv && .venv/bin/pip install -r SKILL_DIR/scripts/requirements.txt`),
  `RENDER_LOCK`, `OPENAI_API_KEY` (voice only). Python tools are run as `.venv/bin/python SKILL_DIR/scripts/<tool>.py`
  (Windows: `.venv\Scripts\python`).
- Determinism holds within one machine and Chrome version. Chrome auto-updates; record the version that render.mjs
  prints in the build notes, and re-run the determinism check after an update before comparing old and new frames.

## 3. render.mjs: what it does and the settings that were paid for

`node SKILL_DIR/scripts/render.mjs --help` lists every flag. It serves the root over localhost, opens the scene in
headless Chrome with `--force-color-profile=srgb --disable-lcd-text --font-render-hinting=none --hide-scrollbars`
(every tool uses the same flags, so stills, checks and renders raster alike), seeks each frame, screenshots it and
pipes PNGs to x264.

| Setting | Value | Why |
|---|---|---|
| `--scale 2` for finals | renders 3840x2160, lanczos down to 1080p | cleaner text and strokes, about 2x slower; drafts at 1 |
| `--crf 12` with `aq-mode=3` | x264 high | a technical review found blocking in flat dim paper areas at CRF 15 |
| `ref=4`, level 4.1 | x264 params | 5 reference frames made the stream High@5.0; some players refuse it |
| colour tags | setparams in the filter chain plus h264_metadata on the joined file | without them ffprobe showed primaries and transfer "unknown" and players guessed |
| `-fps_mode cfr` | constant 30 fps | needs ffmpeg 5.1 or newer (render.mjs checks before a video render) |
| `--mblur` | off | 4 sub-frames gave discrete ghost copies of fast text; smooth blur needs 16 or more; fix strobing with speed caps instead (qa-and-review.md) |
| temp folders | deleted on success, kept on failure | the original tool never deleted them: 141 folders, 2.1 GB on one machine |
| `--size 1080x1080` | 1:1 cut | the same scene with a layout flag (`index.html?fmt=sq`), re-laid out, never cropped |

Not worth chasing: at CRF 12 x264 keeps refining paper grain across byte-identical held frames (2 to 5 code values);
invisible at playback.

Preflight before any long render: `render.mjs --scene index.html --warnings-only` must print 0 engine warnings and 0
browser animations (a running CSS animation or WAAPI animation is not seek-safe).

## 4. Workers, joins and long films

- Default `--workers 1`. Each worker seeks its own contiguous range ascending and writes a segment; segments are
  joined by stream copy. A 5-worker render once showed a one-frame sharpness jump at a join (cross-tab raster plus a
  fresh I-frame, edges up to 46 code values). Finals: one worker, or check every join frame the tool prints (frame
  difference at the join against its neighbours; a clean join measured 2.43 against neighbours of 2.08 to 2.49).
- Drafts may use 3 to 4 workers. Chrome's per-tab raster differs by 1 to 3 code values in soft shadows; that is why
  finals render ascending in one tab, which is what the stills and checks saw.
- Long films (3 minutes and up): render sequential chunks with `--from/--to` (for example 0 to 60, 60 to 120, 120 to
  end), each a fresh one-tab Chrome, retry a failed chunk up to three times, join by stream copy with the bt709
  bitstream tags, then decode every frame of the result once (`ffmpeg -v error -i final.mp4 -f null -`).
- Reference times at scale 2 on a 10-core laptop: 1,029 frames in 223 s in one tab (a light UI film); 3,215 frames in
  917 to 1,226 s with 4 workers (a dense drawing film, slower while checks ran beside it); a 3-minute film in one tab
  took 36 to 40 minutes. Tell the user the expected time before starting a final.

## 5. Time warp, cue dump and the bed

- `--warp out/warp.json` (plan_vo.mjs output) inserts holds: inside a hold the scene is frozen at `h.at`; after it,
  output time is scene time plus the hold. Cue and caption times move forward for anything strictly after a hold.
- Dump cues with exactly the same `--warp` as the video, or check_sync.py compares the wrong windows:
  `render.mjs --scene index.html --warp out/warp.json --cues out/cues.json`.
- The bed for synth.py rides in the cues file. `--bed "A2,E3:-33:4"` (notes, gain, fade) writes it; a later dump
  without `--bed` keeps the bed already in the file. (Earlier tools overwrote it on every dump and the bed was
  re-added by hand each round.)
- Timing the voice first (voice-and-sound.md) makes the warp an identity: plan_vo reports holds 0. A designed hold
  that is part of the picture belongs inside the scene, not in the warp.

## 6. Stills and contact sheets

- `render.mjs --stills 0,0.5,1,6.2 --stilldir out/stills --sheet out/stills.png` seeks the times in the order given
  on one page, so stills only match the video if the scene passes the determinism check.
- Block every beat as stills first (full size and a 390 px phone sheet), fix composition, then animate.
- Read sheets of the final mp4, not only scene stills: `review_sheets.py video out/final.mp4 out/sheets --step 1`
  (labels are frame-centre times), `review_sheets.py at ... --tile 390` for phone checks, `review_sheets.py windows`
  for 0.25 s sweeps through transitions.

## 7. Machine discipline: one heavy job at a time

- One full render at a time per machine, across projects and engines. Wrap heavy jobs in the lock:
  `bash SKILL_DIR/scripts/with_lock.sh -- node SKILL_DIR/scripts/render.mjs ...`. Two finals at once crashed Chrome
  on a 16 GB machine; two HyperFrames attempts failed under load.
- Load corrupts glyphs, not only speed: a determinism run beside a 4-worker render found a broken caption glyph (up
  to 188 code values) in one seek order; the idle rerun was clean. Run determinism and seek audits alone.
- Never edit the scene while its final renders (a reviewer once had to prove by re-rendering stills that the final
  matched code edited 45 s after the render started). Freeze or copy the folder for the duration.
- Log every long render to a file (`... 2>&1 | tee out/render.log`).
- The lock rule protects live renders only. with_lock.sh writes `pid N since <time>: <command>` to `owner` inside the
  lock folder; while waiting it checks that pid, and if the process is gone (the wrapper was killed, crashed, or the
  machine restarted) it prints "removing stale lock left by pid N" and takes the lock. By hand:
  `cat "${RENDER_LOCK:-${TMPDIR:-/tmp}/motion-explainer-render.lock}/owner"`, then `ps -p N`: a running pid is a live
  job, so wait. `--max-wait SECONDS` exits 3 instead of waiting longer than that.
- Long films render in chunks (`--from/--to`, section 4), so a failed or interrupted chunk is re-rendered alone.
- Check free disk space before a render (`df -h .`); delete per-frame PNG folders after the sheets are read.

## 8. Final-file checks and delivery encodes

Run on the delivered file, not the intermediate:

```sh
ffprobe -v error -show_entries stream=codec_name,profile,level,width,height,r_frame_rate,pix_fmt,color_primaries,color_transfer,color_space -of compact out/final.mp4
ffmpeg -v error -i out/final.mp4 -f null -                                  # every frame decodes
ffmpeg -i out/final.mp4 -vf blackdetect=d=0.1 -an -f null - 2>&1 | grep black   # no black frames
ffmpeg -i out/final.mp4 -af ebur128=peak=true -f null - 2>&1 | tail -12          # about -16 LUFS, true peak under -1
```

- Frame 0 is a complete poster, not black: it is the autoplay thumbnail and the loop restart point.
- verify_final.py: compare a few frames of the final with fresh idle 2x stills put through the same encode path.
  This is a sampled glyph check, not continuity acceptance. Follow [qa-and-review.md](qa-and-review.md) to inspect
  every decoded delivery frame and every contact or paw-near-face window at 4x; keep the frame-count evidence.
- For an X-first delivery, treat frame 0 as the cover. Confirm cover, captions and link at the delivery checkpoint
  in process.md after checking the actual encoded candidate. Never modify a file the user has declared final.
- Delivery copy from the CRF 12 master: `ffmpeg -i master.mp4 -c:v libx264 -preset slow -crf 18 -profile:v high
  -level 4.1 -pix_fmt yuv420p -bf 2 -g 60 -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv
  -c:a copy -movflags +faststart delivery.mp4` (115 s: 104 MB master, 49 MB delivery, SSIM 0.996).
- Silent films (product promos) skip synth, mix and mux and ship with no audio stream at all.

## 9. Codex sandbox and troubleshooting

- Rendering starts headless Chrome and a localhost server. Codex's default sandbox aborts Chrome (exit 134) and
  blocks the server (EPERM). Request approval to run render, still, QA and audit commands outside the sandbox.
- The sandbox also has no network: `npm install`, `pip install`, `vo.py` (paid API calls) and the first HyperFrames
  render (it downloads Chrome Headless Shell) need approval to run outside it. ffmpeg encodes and the offline Python
  tools (timing, synth, mix, check_sync) work inside it.
- Scripts never write into the skill folder; outputs go under the project's `out/`.
- "cannot find the npm package puppeteer-core": run from the project folder after `npm install`, or set NODE_MODULES.
- "the scene never set window.__ready": read the `[page error]` lines; a setup throw (data guard, missing timing
  file, missing font) is the usual cause.
- npm cache permission errors: `npm install --cache <some writable folder>`.
- "numpy is missing" (or scipy, PIL, requests): create the project venv and run the tool with `.venv/bin/python`;
  Homebrew and Debian Pythons refuse a plain `pip install` (externally-managed-environment).
- "ffmpeg 5.1 or newer not found": install a current ffmpeg (brew, apt, winget) and make sure it is first on PATH.
- Chrome fails to start as root on Linux (Docker): set `CHROME_FLAGS=--no-sandbox`, in containers only.
- Shell word splitting: pass every flag as its own argument; never build `--scene $VAR` strings with flags inside.
- Old Chrome and new Chrome raster differently; never compare frames rendered by two Chrome versions pixel for pixel.
