---
name: motion-explainer
description: >-
  Makes motion-graphics explainer videos (MP4) that animate a technical idea
  with diagrams, plots, pen lines and formulas, built as deterministic HTML
  scenes rendered frame by frame with the Motion library or with HyperFrames,
  with voice-over, captions and sound design. Use when someone wants an
  explainer or concept video, an animated diagram or chart, a short product
  feature film built from real screenshots, a storyboard, voice-over timing
  and captions, or a render, review or re-render of such a video, even if
  they only say "make a short video about X". Not for adding animation to an
  app or website's own UI.
metadata:
  version: "1.0"
---

# Motion Explainer

Short explainer films that look like a technical publication in motion: light paper, ink lines, real plots and
formulas, springs that land like objects, few words on stage, captions that are the voice word for word. Every frame
is a pure function of time, so renders, stills and checks always agree.

Use it for explainer, concept, research or bug-story videos, animated diagrams and formulas, storyboards and style
frames, voice-over and caption timing, and reviews or re-renders of such films (product films built from real UI too).
Not for adding animation to an app's or website's own UI, slide decks, or editing camera footage.

## Read this first

- Paths here are relative to the folder that holds this SKILL.md (call it SKILL_DIR). Run scripts from the user's
  project folder by full path: `node SKILL_DIR/scripts/render.mjs --scene index.html ...`. Never write into
  SKILL_DIR; every project starts by copying a template out of it (workflow step 1).
- Rendering, stills, QA and audits start headless Chrome and a localhost server. Codex's default sandbox aborts Chrome
  and blocks the server: request approval to run those commands outside the sandbox. The sandbox also has no network,
  so `npm install`, `pip install`, `vo.py` and the first HyperFrames render (it downloads Chrome Headless Shell) need
  approval too. ffmpeg and the offline Python tools (timing, synth, mix, check_sync) work inside it.
- Python tools run with the project's venv (`.venv/bin/python`, on Windows `.venv\Scripts\python`), made in workflow
  step 1. Every script prints its usage with `--help` and exits 2 on wrong arguments; the render, QA and gate tools end
  with a machine-readable `RESULT {...}` line.
- Required checkpoints (do not skip them; without them Codex would proceed): before the first paid voice call, get
  the count from `vo.py make ... --dry-run` (no calls, no key read), tell the user and wait for a yes; show the
  direction and blocked stills and wait for approval before building the whole film; show the draft's sheets and the
  expected render time before a full-length final. Never publish or upload.

## Non-negotiables

1. The scene contract. A scene defines `window.DURATION`, a synchronous `window.seek(t)` that sets every visual for
   time t, `window.__ready = true` after fonts and a first seek, and optionally `window.CAPTIONS`, `window.CUES`,
   `window.WARN`, `window.__error`. The same t gives the same pixels whatever was seeked before: no clock, timers,
   requestAnimationFrame, CSS transitions or keyframes, video elements or unseeded randomness.
2. Determinism rules, each paid for with a re-render: hide WAAPI before the first Motion animation; one track per
   property (0 engine warnings); render hooks write their full state every frame; text moves by whole pixels, never
   scales, and fades through colour alpha; no SVG masks or group opacity on fading content; cuts are true steps; in
   HyperFrames every value is a fromTo through tw(), with no to(), callbacks or sets at frame times.
3. Truth: no state the data never had (no rewinds, invented in-between values, markers moving backwards); data lands
   with zero overshoot; compared things share one style; the page refuses to load when its data drifts; computed
   plots carry a badge; every number traces to facts.md or a trace.
4. Captions are the voice word for word, one line at a time, timed from measured takes; after copy lock only how a
   number is written may change.
5. Copy hygiene on screen and in everything you write: no em or en dashes, arrow characters, middle dots, curly or
   corner quotes, asterisk emphasis; no AI-disclosure lines in the video.
6. One full render at a time per machine (`scripts/with_lock.sh`); determinism checks only on an idle machine; never
   touch another project's running render; never edit a scene while its final renders.

## Requirements

Node 22 or newer; ffmpeg and ffprobe 5.1 or newer; Chrome, Chromium or chrome-headless-shell (`CHROME_PATH` if not
found); Python 3.10 or newer, used through a per-project venv with numpy, scipy, Pillow and requests (workflow step 1;
node tools that call Python use `PYTHON` if set, else `.venv/bin/python` when it exists, else python3); for voice
only, `OPENAI_API_KEY` (paid). npm packages install per project from the template's pinned package.json.

## Choose the engine

- Motion in our renderer (default). Spring physics read as premium; in two finished two-engine comparisons the Motion
  build was preferred, and one product film shipped its HyperFrames version. The renderer does supersampled finals,
  holds, cue dumps, stills and every QA tool. Template: `--engine motion`. Read references/motion-engine.md.
- HyperFrames when you want its CLI (lint, check, layout and contrast gates, 4K presets), a slow-motion master with a
  camera-shutter blur, or a long multi-chapter film on one GSAP timeline. Template: `--engine hyperframes`. Read
  references/hyperframes.md. It exposes the same contract, so the audio and QA chain is identical.
- Plain GSAP inside our renderer only to port an existing GSAP scene: one paused timeline seeked with
  `tl.seek(t, false)`, every value a fromTo with `immediateRender: false, lazy: false`, overlaps refused.
- With time for two versions of one storyboard, build Motion first.

## Workflow

Each step names its command; the full loop with review passes is in references/process.md.

1. Scaffold outside SKILL_DIR: `node SKILL_DIR/scripts/init.mjs <project> --engine motion`, then
   `cd <project> && npm install`, then the Python venv: `python3 -m venv .venv && .venv/bin/pip install -r
   SKILL_DIR/scripts/requirements.txt`. HyperFrames: `--engine hyperframes`, then
   `node SKILL_DIR/scripts/hf/prepare.mjs` after install and after every copy change.
2. Story and truth: brief.md and facts.md (verified sources, derived numbers with assumptions, a Do-not-say list).
   Three concepts with three hooks each, judged in separate passes, then a locked `direction.md` (template copied in
   step 1). Checkpoint: the user approves the direction and the look.
3. Lock copy in `lines.json` (one id per caption line):
   `.venv/bin/python SKILL_DIR/scripts/copycheck.py --lines lines.json`.
4. Voice (paid; ask first): `.venv/bin/python SKILL_DIR/scripts/vo.py make lines.json out/vo --dry-run` prints the
   paid-call count without calling; tell the user, wait for a yes, then run it without `--dry-run` and with
   `--max-calls` set to the agreed number. Fix flags within the re-roll cap (`vo.py roll`, `vo.py use`; roll and words
   take `--dry-run` too). No key yet: skip and use `--estimate` in step 5.
5. Timing sheet: `node SKILL_DIR/scripts/measure_text.mjs --lines lines.json --out widths.json`, then
   `.venv/bin/python SKILL_DIR/scripts/timing.py build --lines lines.json --vo out/vo --config timing.config.json
   --out timing.json` (or `--estimate`), then `.venv/bin/python SKILL_DIR/scripts/timing.py check timing.json`.
6. Block stills before motion: `node SKILL_DIR/scripts/render.mjs --scene index.html --stills 0,0.5,1,4 --stilldir
   out/stills --sheet out/stills.png`, and look at them at 390 px wide too.
7. Build the scene to timing.json: captions and word times only from the sheet (`K.captions`, `K.word`; `W()` in
   HyperFrames), a data guard in setup, cues next to the motion they belong to.
8. Gates after every meaningful change: `render.mjs --scene index.html --warnings-only` (0 and 0), `qa_scene.mjs`,
   `capband.mjs`, `stillness.mjs`, `speed_audit.mjs` (each `--scene index.html`), and on an idle machine
   `determinism.mjs --scene index.html`. HyperFrames adds `npm run check` and `hf/seek_audit.mjs index.html`.
9. Draft: `node SKILL_DIR/scripts/render.mjs --scene index.html --out out/draft.mp4` (HyperFrames: `hf/make_cut.mjs`
   then `npx hyperframes render`), then
   `.venv/bin/python SKILL_DIR/scripts/review_sheets.py video out/draft.mp4 out/sheets` and a 390 px sheet
   (`review_sheets.py at ... --tile 390`). Read every sheet yourself.
10. Review passes (truth, hook, viewer, phone or density, craft), each read-only, each writing
    `review/<round>/<lens>.json`; one fix pass; a polish pass; an independent verify pass (references/qa-and-review.md).
11. Voice fit check: `node SKILL_DIR/scripts/plan_vo.mjs --scene index.html --vo out/vo/vo.json --out out/warp.json
    --tail 0.25` must report holds 0, errors 0. Checkpoint before the final render.
12. Final: `bash SKILL_DIR/scripts/with_lock.sh -- node SKILL_DIR/scripts/render.mjs --scene index.html --warp
    out/warp.json --out out/silent.mp4 --scale 2`, then cue dump, `synth.py`, `mix.py`, `mux.sh`, `check_sync.py` on
    the mix and on audio decoded from the final, loudness and final-file checks (references/voice-and-sound.md
    section 8, references/render-pipeline.md section 8).

## Taste

- Few words on stage: single digits besides the caption, at most four short labels, no tables, legends or code pages.
- Look like a technical publication: axes, real curves, one typeset formula, pen lines. Never stars, glow, water,
  bloom, particles, shader warps or clip-art.
- Light painted paper, never pure white or dark. Prussian ink, one vermilion detail with one meaning, graphite for what
  the story sets aside.
- Something happens in the first second; stakes by about 6 s; frame 0 is a finished poster with the caption up.
- The last frame is the most beautiful one: a simpler rhyme of frame 0, held 4 to 8 s.
- Within an act things morph; between acts a fresh sheet slides over the old one, three or four times per film.
- Every caption gets a meaningful stage event on its key word; no still stage over about 2 s except a held image.
- Cause before effect on screen; the picture lands on its spoken word and points the way the verb does.
- Springs by damping ratio: data and plot positions at 1 (bounce 0); decorative pops 0.5 to about 0.65 (overshoot 15
  percent or less); below 0.5 only for physical events (a ripple, a drop, a pin). Scrolls, slides and camera trucks
  are eased tweens under the speed caps.
- Sized for a 390 px phone, muted: argument text 40 px, stage key text 56 px, hook text 96 px (90 px at the very
  least), captions 48 px.
- Wow from craft, never from claims. Nothing fake-looking: no jumping counters, ghost copies or blurred readable UI.
- Sound is a quiet second layer: plucks on landings, ticks for pen contact, a whoosh on slides; the film works muted.

## Gotchas

- `timing.py` and `plan_vo.mjs` must share lead 0.15 and tail 0.25, or plan_vo inserts holds nobody planned.
- A spring with stiffness, damping or mass ignores bounce: one silently overshot data by 16 percent.
- An eased move peaks at its average speed times pi/2 (in-out sine) or 3 (in-out cubic): a 1,920 px slide in 0.9 s
  peaks near 112 or 213 px per frame. Measure with speed_audit.mjs instead of trusting the ease name.
- A zero-delta spring in a Motion sequence is NaN; a velocity-only spring there never moves (use `K.kick`).
- Before its first segment a Motion value already shows that segment's `from`; build order must equal time order.
- Text fading through `opacity`, or sitting at fractional offsets, broke byte-identical frames: use `.lab` labels
  and K.label.
- `img.decode()` can hang a render forever; use `decoding = 'sync'` and load events.
- HyperFrames: a guard that reads `data-duration` must skip cuts (`window.__CUT`); clip windows inside cuts must be
  mapped through it; `hyperframes preview` rewrites the source file; fonts must be inlined in the html.
- synth.py gains are relative to each cue type's own level; absolute dB values come out near silent.
- Dump cues with the same `--warp` as the video, or check_sync compares the wrong windows.
- Load during a render can raster a wrong glyph; verify finals with verify_final.py and read the 1 s sheets.

## Acceptance checklist (report the numbers)

- [ ] timing.py check: violations 0; plan_vo: holds 0, errors 0
- [ ] render.mjs --warnings-only: 0 engine warnings, 0 browser animations
- [ ] qa_scene: all ok; capband: no ink outside sheet slides; copycheck: problems 0
- [ ] determinism (idle machine): 0 mismatches; HyperFrames: seek_audit nothing beyond the control, npm run check passes
- [ ] stillness and speed audits: every flag fixed or listed as designed in notes/build.md
- [ ] frame 0 is a poster; something moves in the first second; stakes by about 6 s; last frame held 4 to 8 s
- [ ] every plot with computed or drawn values carries its badge exactly while visible; the disclosure is spoken once
- [ ] review findings: every blocker and major fixed or explained in review/<round>/fix.md; verify pass clean
- [ ] check_sync: violations 0 on the mix and on decoded final audio; about -16 LUFS, true peak under -1 dBFS
- [ ] ffprobe shows bt709 tags and level 4.1; every frame decodes; 1 s and 390 px sheets of the final read

## References (read when the step comes up)

- references/process.md: the whole loop as passes, files to keep, checkpoints, resource etiquette. Read at the start
  of any real film.
- references/story-and-copy.md: story structures, hooks, the last frame, copy for the ear, numbers and
  transcription, the truth system, misleading shapes and states, scope words. Read before the brief and copy lock.
- references/design-language.md: taste principles, the Fine Line and Galley Proof looks as tokens, phone sizes,
  rejected looks, how to make a new look. Read before blocking stills.
- references/motion-engine.md: why each piece of the template's core.js exists, sequence semantics, SVG and text
  rules, spring feel, speed caps, helper API, sheets, lift-out copies. Read before writing Motion scene code.
- references/hyperframes.md: seek semantics, tw(), transforms and layers, cuts, slowmo blur, fonts, render
  operations, seek audit. Read before any HyperFrames work.
- references/render-pipeline.md: the contract, renderer settings and why, workers and chunks, warp and cues, machine
  discipline, final-file checks, Codex sandbox and troubleshooting. Read before the first render and the final.
- references/voice-and-sound.md: order of work, takes and re-roll caps, timing rules, plan_vo, synth, mix, loudness,
  sync checks, end-to-end commands. Read before recording.
- references/qa-and-review.md: what each gate catches, the ranked common findings, review lenses and the findings
  file, fix and verify rules. Read before the first draft review.

## Scripts (all in SKILL_DIR/scripts; run them, read them only to change them)

| Script | Job |
|---|---|
| `init.mjs` | copy a template into a new project |
| `render.mjs` | video, stills, cue dump, preflight warnings |
| `qa_scene.mjs`, `capband.mjs`, `stillness.mjs`, `speed_audit.mjs`, `determinism.mjs` | scene gates |
| `vo.py`, `measure_text.mjs`, `timing.py`, `plan_vo.mjs` | voice, captions and the timing sheet |
| `synth.py`, `mix.py`, `mux.sh`, `check_sync.py` | sound, mix, loudness, sync |
| `review_sheets.py`, `alive.py`, `verify_final.py`, `copycheck.py` | reading the film, final checks, copy |
| `tex2svg.mjs`, `motion_probe.mjs`, `with_lock.sh` | formulas, Motion upgrade check, render lock |
| `hf/prepare.mjs`, `hf/make_cut.mjs`, `hf/finish.sh`, `hf/seek_audit.mjs`, `hf/seek_stills.mjs` | HyperFrames helpers |
