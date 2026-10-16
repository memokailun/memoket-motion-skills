# HyperFrames engine

Read before building or fixing a HyperFrames composition (heygen-com/hyperframes, Apache 2.0: HTML plus one GSAP
timeline, rendered by the hyperframes CLI in headless Chrome). Verified on hyperframes 0.8.148 and 0.8.149, GSAP 3.15.0.
The template in `assets/templates/hyperframes/` already follows every rule below.

Contents
1. The mental model
2. Setup, pinning and commands to avoid
3. Composition structure
4. How the renderer seeks, and the rules that follow
5. The tw() helper (the only way to write a tween)
6. Transforms, compositor layers and the whole-frame repaint
7. Cuts: windows and slow-motion masters
8. Motion blur: slowmo plus tmix
9. Render operations
10. Verification ladder and seek_audit
11. Fonts
12. Joining the voice and sound chain
13. Long films, 1:1 cuts and posters
14. Shader transitions: tested, rejected

## 1. The mental model

A composition is an HTML page with exactly one paused GSAP root timeline registered on
`window.__timelines[<composition id>]`. The renderer does not play it: it seeks it frame by frame with
`totalTime(t, true)` (events suppressed), probes the end of the timeline first, and with several workers each worker
starts its chunk after a jump. So every pixel must be a pure function of t AND independent of seek order. Almost every
HyperFrames bug we paid for was a seek-order bug: the forward-scrubbed preview looked right and a render, a still or an
audit after a backward jump did not.

## 2. Setup, pinning and commands to avoid

- `node SKILL_DIR/scripts/init.mjs <dir> --engine hyperframes`, `npm install`, then
  `node SKILL_DIR/scripts/hf/prepare.mjs` (vendor GSAP, local fonts, bake timing.json, inline fonts).
- Pin every package exactly; keep `@hyperframes/shader-transitions` on the same version as `hyperframes`; do not
  upgrade mid-project. `npx hyperframes --version` inside the project resolves the local pin. Needs Node 22 or newer.
- Telemetry and network off on every command, written into every npm script:
  `HYPERFRAMES_NO_TELEMETRY=1 DO_NOT_TRACK=1 HYPERFRAMES_NO_UPDATE_CHECK=1 HYPERFRAMES_SKIP_SKILLS=1`.
- Never run, unless the user explicitly asks: `publish` (uploads the project), `feedback`, `cloud`, `lambda`,
  `cloudrun`, `skills update`, `upgrade`, `capture <url>`, `catalog --on-device`, and `snapshot` without
  `--describe false` (with GEMINI_API_KEY set it sends frames to Gemini). Always: `hyperframes snapshot --at 3.2,8.0
  --no-end --describe false -o out/snap`.
- Never run `hyperframes preview` on a file you are editing: Studio rewrites the source in place (stamps
  `data-hf-id` on every element, writes `.hyperframes/` and `.thumbnails/`). If needed: `--background --no-open`, and
  clean with a portable one-liner (BSD and GNU `sed -i` differ):
  `node -e "const fs=require('fs');const f='index.html';fs.writeFileSync(f,fs.readFileSync(f,'utf8').replace(/ data-hf-id=\"[^\"]*\"/g,''))"`.
- Vendor GSAP locally (prepare.mjs); the init template loads it from a CDN and a render must not need the network.
- One root composition per project: only `index.html` may carry `data-composition-id` (lint `multiple_root_compositions`).
  Tests live in `tests/`, cuts in `cuts/`, rendered with `render -c <file>`. lint, check, snapshot and preview always
  use index.html; use `scripts/hf/seek_stills.mjs` for any other file.
- Do not install HeyGen's router skills from the init AGENTS.md; this skill is the contract.
- esbuild's postinstall may be skipped by npm's allowScripts; the prebuilt binary works.

## 3. Composition structure

```html
<div id="root" data-composition-id="main" data-start="0" data-duration="8.17" data-width="1920" data-height="1080">...</div>
<script src="./js/scene.js"></script>
<script>
  (function () {
    const tl = window.__build();                 // the scene file builds DOM and timeline synchronously
    window.__timelines = window.__timelines || {};
    window.__timelines["main"] = tl;             // key = data-composition-id; keep this line literally in the html
    tl.seek(0);
  })();
</script>
```
- Keep the registration line in the html text: lint reads it, and make_cut.mjs rewrites it (it refuses to run if the
  pattern is missing).
- `data-duration` sets the video length. Pad the timeline to the full length (`tl.set({}, {}, DUR)`) and assert the
  two agree in the source (skip the assert in cuts, which set `window.__CUT`).
- Build the timeline synchronously at load; the runtime waits for fonts and media itself. Signal `window.__ready` for
  the skill's tools separately, after the faces load.
- No fetch at render time: bake every input (timing sheet, simulation paths, typeset formulas, glyph outlines) into a
  JS data file (prepare.mjs writes `assets/timing.js`). Inline assets over the compiler's 2 MB limit fail; a painted
  paper JPEG at q93 4:4:4 stays under it, or paint the paper on a canvas at build (the template does).
- Timed clips (`data-start`, `data-duration`, class `clip`) are hidden by the runtime outside their window. Only leaf
  elements should be clips (a clip with children gets lint `nested_structure_needs_subcomposition`). The skill's QA
  tools load the raw page without the runtime, so clip windows are invisible to them: also switch covered things off on
  the timeline with autoAlpha. Simplest: no clips at all, visibility driven on the one timeline (the template).
- Sub-compositions were never needed: one index.html, one timeline; split long films into JS files, not compositions.
- Lint forbids tweening `left` and `width`: animate transforms or swap in one frame.
- `check` treats intentional layering as errors (`content_overlap`, `text_occluded`): mark the specific element with
  `data-layout-allow-overlap` or `data-layout-allow-occlusion`; WCAG AA contrast failures are errors too. Aim for a
  full pass: lint 0, runtime 0, layout 0, motion 0, contrast all.

## 4. How the renderer seeks, and the rules that follow

1. Never `to()` for state that matters; always `fromTo` with explicit start and end. A `to()` records its start from
   whatever the element shows the first time it renders, which depends on seek order. Loudest case: a focus filter
   tweened with `to()` from `filter: none` interpolated brightness from 0, a black phone for 3 frames. Fix: fromTo
   between two full filter strings with the same function list, keeping `blur(0px)`.
2. The first tween of a property renders immediately; every later tween of it has `immediateRender: false` and starts
   from where the previous one ended. A later fromTo without it applies its from value at t = 0; a first tween with
   `immediateRender: false` left an element visible after a seek back from the end.
3. Never put a property only in the from of a fromTo: GSAP restores from-only properties when the playhead passes back
   and does not re-apply them going forward. tw() throws when from and to keys differ.
4. Nothing zero-duration at exactly t = 0: such sets are not rendered when the playhead lands on 0 and are reverted
   when it arrives backwards. The t = 0 state is the static DOM state, written in the html or with gsap.set at build.
5. Never a set exactly on a frame time: a chunk landing on it after a backward jump reverts it. Prefer no sets at all
   (an instant change is a 0.001 to 0.02 s fromTo); if a project insists, place sets 0.1 ms early.
6. No two tweens on one property of one element overlapping in time: overlapping opacity tweens differed by 212 px at
   the merge point; a pulse overlapping its own settle rendered differently from stills. Put concurrent motions on
   nested elements (wrapper for position, child for the pulse).
7. `autoAlpha` writes visibility; a rewound `visibility: visible` on a child overrides a hidden parent. Inside a parent
   you also hide, use opacity.
8. No callbacks for state: `onUpdate`, `onStart`, `onComplete` and `call()` do not run in render (events suppressed).
9. Determinism basics: no Math.random, Date, performance.now, timers, requestAnimationFrame, network, CSS transitions
   (lint `css_transition_used`), @keyframes, `repeat: -1`, `yoyo` (a pulse is two explicit tweens), position fixed.
10. Text that appears later is in the DOM from the start (reveal with opacity, visibility or clip, never display or
    textContent), so its font slices load before the first frame.
11. The skill's tools seek the way the renderer does: the shim is `window.seek = (t) => tl.totalTime(t, true)`.

## 5. The tw() helper (the only way to write a tween)

`tw(targets, from, to, at, dur, ease, extra)` in the template's `js/scene.js`: one fromTo at an absolute time. It keeps
a track per element and property, gives the first tween `immediateRender: true` and later ones false, throws when from
and to keys differ or when one call mixes first and later properties across targets, sets transform origins once
outside the timeline (and throws if one changes), writes `force3D: false` on every tween, tracks `attr:` keys
separately, and logs overlaps to `window.WARN` (a final has none). Companions: `chain(targets, [[t, vars], ...])`
for keyframes (motion along a curve is a chain of short linear segments sampled from the curve), pen strokes with
`pathLength="1"`, `stroke-dasharray="1 1"` and a dashoffset tween plus a 0.02 s opacity gate so the round cap shows no
dot before the pen starts, path morphs between paths with the same command structure, and the camera
`CAM(s) = { scale: s, x: cx * (1 - s), y: cy * (1 - s) }` on a layer with `transform-origin: 0px 0px`.

## 6. Transforms, compositor layers and the whole-frame repaint

- Set every transform origin once, outside the timeline, with `smoothOrigin: false`; an origin appearing only in a
  tween's to-vars shifted SVG shapes. Use `svgOrigin` for SVG shapes whose box changes before they scale.
- `transform: none` and an identity matrix are not the same to Chrome: on one seek path a phone screen lost its rounded
  clip. Prime every transform-tweened HTML element with `translate(0px, 0px)` after the timeline is built, and write
  `transform-origin: 0px 0px` on transformed SVG elements up front (GSAP writes it only along some seek paths).
- No CSS `transform` on an element GSAP animates (lint `gsap_css_transform_conflict`); use a wrapper.
- `force3D: false` on every tween: `translate3d` gives an element its own compositor layer while it moves, and layers
  that come and go with seek history are where raster differed by a pixel column.
- A card left with `perspective()` after a 3D fold stays 3D: drop `transformPerspective` to 0 the moment it lies flat.
  CSS 3D anywhere also switches the renderer from fast drawElementImage capture to screenshots.
- Hide with `autoAlpha`, not `opacity: 0`: an element left at opacity 0 kept its own layer for 17 s.
- Whole-frame repaint: a flat full-frame block under everything whose background position moves on every seek makes
  Chrome re-raster the whole layer each time (an opacity ramp would not: 8-bit alpha repeats values). Costs about half
  the capture speed with a slowmo master; it is in the template.
- `mix-blend-mode` cannot key images under camera transforms; key images offline.

## 7. Cuts: windows and slow-motion masters

`node SKILL_DIR/scripts/hf/make_cut.mjs index.html cuts/x.html --n N [--from a --to b]` writes a copy whose registered
timeline is a paused master scrubbing the original from a to b, N times slower (`--n 1` is a plain window for fast
drafts of one section). Paths are rewritten for the `cuts/` folder.
- Clip windows (`data-start`, `data-duration`) are read in MASTER time, so in a cut every clip ran N times too early
  (a badge vanished at 2.4 s). The cut injects `window.__CUT = { from, n }`; write every clip window through it:
  ```js
  const CUT = window.__CUT || null
  function clipWin(el, t0, t1) {
    let a = t0, b = t1
    if (CUT) { a = (t0 - CUT.from) * CUT.n; b = (t1 - CUT.from) * CUT.n }
    if (b <= 0) { a = 1e6; b = 1e6 + 0.001 }               // wholly before the window: never shown
    a = Math.max(0, a)
    el.dataset.start = String(Math.round(a * 1000) / 1000); el.dataset.duration = String(Math.round((b - a) * 1000) / 1000)
  }
  ```
- The window wrapper must not render the master 0 to a at build: the cut seeks the source to `from` first and adds
  the scrub with `immediateRender: false` (the first version lost whole states after a backward seek inside the cut).
- Never edit generated cuts; regenerate after every index.html change; re-run prepare.mjs if fonts or copy changed.

## 8. Motion blur: slowmo plus tmix

1. `make_cut.mjs index.html cuts/slowmo16.html --n 16`
2. Render the cut at 30 fps (16 samples per original frame, 480 per second):
   `npx hyperframes render -c cuts/slowmo16.html --fps 30 --quality high --workers 3 -o out/master_x16.mp4`
3. `bash SKILL_DIR/scripts/hf/finish.sh out/master_x16.mp4 out/silent.mp4 1920 1080`: a 9-tap trapezoid of 16
   samples is a 180 degree shutter centred exactly on the original frame time, then deband and a static dither.

Result as reviewed: blur reads as a camera shutter on fast moves and leaves still frames sharp. 16 samples is the tested
setting. One film first rendered a 4x master and then moved to 16x; the notes do not say why. Our inference: with 4
samples a 180 degree shutter has only 2 or 3 taps, so fast moves would likely step. Thin, fast elements may still show
separate copies under the blur: read 0.25 s sweeps through every fast move, and as a starting guess run
speed_audit.mjs with `--limit 35`, then tune the limit per film. Blur in the first second can smear the hook: check
frames 0 to 1 s. Without blur, the alternative finish is a supersampled 4K master
(`--resolution landscape-4k --quality delivery --crf 12`) and a lanczos downscale.

## 9. Render operations

- Disk capture of a long slowmo needs huge space (a 55,162-frame master wanted about 57 GB). With several workers set
  `HF_CAPTURE_PARALLEL_STREAM=true` so workers stream to the encoder. Check `df -h` first.
- Always pass `-o`; presets: draft, looks (default, CRF 16), delivery (= high); `--crf` and `--video-bitrate` exclude
  each other. The same source rendered twice gave identical frames.
- Shared machine: take the render lock (`with_lock.sh`), 3 workers, and `nice -n 15` for the lower-priority project;
  make sure no other render of the same project runs (`pgrep -fl hyperframes`) before regenerating cuts.
- Reference: a 16x master of 55,162 frames took 21 to 26 minutes with 3 to 4 workers on an M5; finish.sh 7.5 min; a 2 s
  draft smoke test took 3.6 to 3.8 s.

## 10. Verification ladder and seek_audit

1. `npm run check` after every change (lint, runtime, layout, motion, contrast).
2. Stills: `seek_stills.mjs` (any file, renderer seek semantics) or `hyperframes snapshot --describe false --no-end`.
   Dense passes every 0.25 s through every move.
3. `node SKILL_DIR/scripts/hf/seek_audit.mjs index.html --step 0.25`: a clean forward pass against passes that jump
   first (end then forward; end, middle, forward; three quarters, one quarter, forward), plus a second clean pass as
   the noise floor. It found real bugs in every project (overlapping tweens, the window wrapper, transform none versus
   identity, from-only properties, a first fromTo without immediate render). Accept when every flag is at or below the
   control: half-resolution tile seams leave 1 to 4 px even between identical passes. Read flags at `--dpr 1` before
   acting. The skill's determinism.mjs and qa_scene.mjs also run on HyperFrames pages through the shim.
4. Render versus stills at every second (after a 1.5 px blur, count pixels over 40/255): twice the still was wrong
   (the transform-none class), twice the render found what stills could not. Always read frames of the actual render.
5. Contact sheets of the delivery file: 1 s sheets, 0.25 s windows through transitions, 390 px phone checks. These
   are navigation aids; continuity acceptance also reviews every decoded delivery frame (qa-and-review.md).
6. Frame-difference scans for named faults ("stops then lurches"): one continuous settle curve fixed it.

## 11. Fonts

- The compiler only sees `@font-face` rules written in the html text. A family declared only in a linked css is
  fetched from Google Fonts at compile time and injected after every stylesheet, overriding local files (a first
  render fetched 9 faces). prepare.mjs copies OFL fonts from npm, writes `font-display: block`, and inlines only the
  slices the page's characters need (scanning linked local scripts too). Re-run after every copy change.
- Never name system families (Helvetica, Arial, SF Pro, Hiragino); end stacks with a generic keyword.
- For CJK text put the CJK family first and set `lang`, or punctuation comes from the Latin face.
- Use only weights you shipped; another weight makes Chrome synthesise bold.
- Crisp text: `-webkit-font-smoothing: antialiased; font-kerning: normal`; GSAP scale-up re-rasters each frame, but rest
  on whole pixels and never leave a blur or fractional scale on text that should read at rest.
- A glyph used as a drawable shape is baked as an outline path into the data file.

## 12. Joining the voice and sound chain

The composition exposes the scene contract, so the same tools run on it: `render.mjs --scene index.html --cues
out/cues.json` (cue dump through the shim), `plan_vo.mjs` (must report holds 0: the HyperFrames render cannot insert
holds, so time captions to the voice before animating and anchor marks to word times with `W(captionId, word)`),
`qa_scene.mjs`, then synth, mix, mux and check_sync as in voice-and-sound.md. Captions are drawn by the composition.

## 13. Long films, 1:1 cuts and posters

- Over about 60 s: one master timeline in a kit namespace, chapter files that build only inside their containers and
  time window, kit helpers with absolute times, boundary states owned by the kit and checked by a tool, and an
  append-only request log for kit changes (most seek-order lessons were found there).
- A global time warp may extend approved timing (every child's start and end through a monotonic map). Never use it
  to skip action inside an unchanged shot. Keep pose, tail and camera continuous; prefer whole music bars of extra
  time and reopen the affected checkpoint before changing approved length (process.md).
- 1:1 cut: the same timeline with a layout flag on the root, re-laid out, never cropped; regenerate after every change;
  render with `--resolution square-4k`.
- Poster first frame: shifting tweens alone leaves audio and caption metadata behind. Use the cover procedure in
  process.md: one shared offset for the film timeline, caption/word windows, cues and audio, with final decoded sync
  verification. Show the actual encoded opening for approval; a custom thumbnail is not assumed for X.

## 14. Shader transitions: tested, rejected

`@hyperframes/shader-transitions` cross-warp-morph displaces the whole frame with noise: ink lines and text liquefy and
the captions warp with the scene; it reads as an AI morph, not paper. What shipped at every act break: a fresh sheet
slides over the old one in 0.9 s on `sine.inOut` (it starts moving at once; its peak speed is half a cubic's), its edge
shadow fades over the last 18 percent of travel, the covered sheet is switched off once covered, a whoosh sits on peak
speed. Any full-frame shader also distorts captions and fine ink; prefer physical moves (slides, folds, pen strokes).
