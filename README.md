# Motion Explainer

A Codex skill for making motion-graphics explainer videos that look like a technical publication in motion: light
paper, ink lines, real plots and formulas, springs that land like objects, few words on stage, and captions that are
the voice word for word. Scenes are HTML pages built with the [Motion](https://motion.dev) library (or with
[HyperFrames](https://github.com/heygen-com/hyperframes)) and rendered frame by frame, so every render, still and
check sees exactly the same frame for the same time.

It packages what we learned making a series of explainer films: the scene contract and renderer, the determinism
rules that each cost a re-render, the house look as tokens, the voice and caption timing method, the sound tools, the
QA gates, and the review loop with the most common reviewer findings.

## How Codex picks it up

Clone the repository and start Codex inside it. Codex scans `.agents/skills` in every folder from your working
directory up to the repository root, so the skill at `.agents/skills/motion-explainer/` is available with no install
step. Check with `/skills`, or mention it directly with `$motion-explainer`. Codex also picks it on its own when you ask
for an explainer video.

Work on films inside the repository, under `work/` (git ignores it), so Codex always sees the skill. (Codex walks up
to the root of a git repository; in a plain copy that is not a git clone it only looks in the folder you started it
in, so start Codex at the repository root there.) To use the skill from other folders too, link it once into your
personal skills folder, from the repository root:

```sh
mkdir -p ~/.agents/skills && ln -sfn "$(pwd)/.agents/skills/motion-explainer" ~/.agents/skills/motion-explainer
```

A link, not a copy, so `git pull` updates it. If `~/.agents/skills/motion-explainer` is already a copied folder,
remove it first: otherwise the link lands inside it and Codex lists the skill twice.

Claude Code reads the same skill through `.claude/skills/motion-explainer`, a relative link to
`.agents/skills/motion-explainer`, when you start it inside this repository. To use it from other folders, link it
into `~/.claude/skills` the same way:

```sh
mkdir -p ~/.claude/skills && ln -sfn "$(pwd)/.agents/skills/motion-explainer" ~/.claude/skills/motion-explainer
```

## Prerequisites

| Tool | Version | Why |
|---|---|---|
| Node.js | 22 or newer | render and QA tools, HyperFrames CLI |
| ffmpeg and ffprobe | 5.1 or newer | encoding, sheets, loudness, silence detection |
| Chrome, Chromium or chrome-headless-shell | any recent | the renderer drives it headless; set `CHROME_PATH` if it is not in a standard place |
| Python | 3.10 or newer | sound design, mix, sync check, contact sheets, voice tools; each film gets its own venv with numpy, scipy, Pillow and requests (`python3 -m venv .venv && .venv/bin/pip install -r <skill>/scripts/requirements.txt`; Homebrew and Debian Pythons refuse a plain `pip install`) |
| OpenAI API key | optional | voice-over takes and transcription are paid calls; without a key you can still build, time (estimated) and render silent films |

npm packages are installed per film from the template's pinned `package.json` (motion 14.1.0, puppeteer-core 25.12.0,
fonts from @fontsource; HyperFrames films add hyperframes 0.8.149 and gsap 3.15.0).

## Quick start (about 10 minutes)

From the repository root:

```sh
SK=.agents/skills/motion-explainer
node $SK/scripts/init.mjs work/demo --engine motion        # copies a working demo scene out of the skill
cd work/demo
npm install                                                # add --cache /some/folder if npm reports a cache permission error
SK=../../.agents/skills/motion-explainer
python3 -m venv .venv && .venv/bin/pip install -r $SK/scripts/requirements.txt   # Python tools run as .venv/bin/python
node $SK/scripts/render.mjs --scene index.html --warnings-only          # 0 engine warnings, 0 browser animations
node $SK/scripts/render.mjs --scene index.html --stills 0,1.2,4.6,8 --stilldir out/stills
node $SK/scripts/render.mjs --scene index.html --out out/demo.mp4       # about 8 s of video, a minute or less
node $SK/scripts/qa_scene.mjs --scene index.html                        # layout gate: all ok
node $SK/scripts/determinism.mjs --scene index.html --step 0.5          # same frame in any seek order
.venv/bin/python $SK/scripts/review_sheets.py video out/demo.mp4 out/sheets --step 0.5
```

Open `out/demo.mp4` and `out/sheets/sheet_00.png`. The demo draws a half-life curve on painted paper; points land on
the spoken word with zero overshoot and the last one turns vermilion. Then open `js/main.js`: it is the whole beat in
about 90 lines, and `js/core.js` is the engine (read `references/motion-engine.md` before changing it).

HyperFrames version of the same beat:

```sh
node .agents/skills/motion-explainer/scripts/init.mjs work/demo-hf --engine hyperframes
cd work/demo-hf && npm install
SK=../../.agents/skills/motion-explainer
node $SK/scripts/hf/prepare.mjs                      # vendor gsap, local fonts, bake timing, inline fonts
npm run check                                        # lint, runtime, layout, motion, contrast
node $SK/scripts/hf/make_cut.mjs index.html cuts/first3.html --n 1 --to 3
HYPERFRAMES_NO_TELEMETRY=1 DO_NOT_TRACK=1 HYPERFRAMES_NO_UPDATE_CHECK=1 HYPERFRAMES_SKIP_SKILLS=1 \
  npx hyperframes render -c cuts/first3.html --fps 30 --quality draft -o out/draft3.mp4
```

## What is new

Production now starts with one confirmed preflight checklist and pauses for story, look, character, a 5 to 8 s sample
with sound, the first full cut and final delivery choices. New character guidance covers connected anatomy, clean
occlusion, restrained acting and checks proven against real faults. Every delivered frame gets a continuity review;
X-first covers, late URL changes and frozen deliverables have explicit procedures.

## Asking Codex for a video

Start Codex in the repository and describe the film, the audience and where it will be watched. For example:

- "Use $motion-explainer to make a 45 second explainer about how a hash map handles collisions, for developers
  watching muted on their phones. Start with three hooks and blocked stills."
- "Make a short video showing why exponential backoff with jitter beats fixed retries. Silent, captions only."
- "Review work/backoff/out/draft.mp4 with the truth and hook lenses and write the findings files."
- "Re-render work/backoff at final quality and run the audio and sync checks."

What to expect:
- Codex first asks you to confirm sources and their freshness, assets, claims, output settings, paid-call estimates,
  links and frozen work. It waits for your answer before production. It then shows labelled options and pauses for
  story/copy, look, character design and refinements when present, a short rendered sample with sound, the first full
  cut, the final render and the delivery package. Silence is not approval. Paid voice counts come from `--dry-run`.
- Rendering and checks start headless Chrome and a local server, which Codex's default sandbox blocks. The sandbox
  also has no network, so `npm install`, `pip install`, voice calls and the first HyperFrames render (it downloads
  Chrome Headless Shell) need approval too. Approve those commands to run outside the sandbox when Codex asks
  (ffmpeg and the offline Python tools run inside it).
- Each film lives in its own folder under `work/` with `direction.md`, `lines.json`, `timing.json`, the scene and
  `out/`. Review passes write `review/<round>/<lens>.json`.
- One full render at a time per machine: finals run under `scripts/with_lock.sh`, which waits for a shared lock and
  clears a lock left behind by a job that no longer runs.

## What is inside

```text
.agents/skills/motion-explainer/
  SKILL.md                 the instructions Codex follows (contract, workflow, taste, acceptance)
  agents/openai.yaml       display name and invocation policy for Codex
  references/              process, story and copy, design language, Motion engine, HyperFrames, render pipeline,
                           character animation, voice and sound, QA and review (read on demand)
  scripts/                 render.mjs and the QA gates, voice and timing tools, sound and mix, sheets,
                           hf/ helpers for HyperFrames (prepare, cuts, slowmo finish, seek audit, stills)
  assets/templates/        motion/ and hyperframes/ demo projects, docs/ (direction, lines, timing config)
  assets/probe/            the page scripts/motion_probe.mjs uses to re-check Motion before an upgrade
```

The skill never writes into its own folder: every film starts by copying a template into `work/<name>/`.

## Tested on and known limits

- Built and smoke-tested on one Mac (macOS 26, Apple silicon): Node 26, ffmpeg 8.1, Google Chrome 155 and the
  chrome-headless-shell 152 that HyperFrames downloads, Python 3.14, Codex CLI 0.158. Node 22 is the documented floor
  (HyperFrames needs it) but was not run here. Determinism (same frame in any seek order) holds within one machine and
  one Chrome version: re-run `determinism.mjs` after a Chrome update and on any new machine.
- Windows: use Git Bash or WSL. The HyperFrames npm scripts set environment variables POSIX style, so `npm run
  check` fails in cmd and PowerShell; `.venv/bin/python` is `.venv\Scripts\python` there; `with_lock.sh`, `mux.sh`
  and `hf/finish.sh` need bash.
- Linux as root (Docker): Chrome refuses to start without its own sandbox; set `CHROME_FLAGS=--no-sandbox`, in
  containers only.
- ffmpeg older than 5.1 (Ubuntu 22.04 ships 4.4) lacks `-fps_mode`; render.mjs stops with a clear message.
- Not tested: Linux, Windows, Intel Macs, or agents other than Codex (the skill follows the open Agent Skills format,
  but only Codex discovery from `.agents/skills` was checked).

## Checking the skill after an edit

No model calls are needed for any of these:

```sh
SK=.agents/skills/motion-explainer
# frontmatter and layout (needs a Python with PyYAML, for example a venv with pyyaml installed)
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py $SK
# syntax of every script
for f in $SK/scripts/*.mjs $SK/scripts/hf/*.mjs $SK/scripts/lib/*.mjs; do node --check "$f" || echo "FAIL $f"; done
python3 -m py_compile $SK/scripts/*.py && echo python ok
for f in $SK/scripts/*.sh $SK/scripts/hf/*.sh; do bash -n "$f" || echo "FAIL $f"; done
# Codex sees the skill (renders the model input locally, no model call); run from the repository root
codex debug prompt-input "make a short video about how a bloom filter works" | grep -c 'motion-explainer'
```

Then try triggering in a real Codex session (these are normal model turns). It should pick the skill for:
"make a short video about how a bloom filter works"; "animate this latency chart into a 20 second clip with
captions"; "make a 30 second feature video of our app from these screenshots"; "re-render work/backoff with the new
voice-over and check the sync". It should not for: "add a spring animation to this modal"; "make a slide deck about
our Q3 results"; "trim this screen recording and add subtitles"; "write a CSS loading spinner".

## Licenses and third-party notes

- Motion (npm `motion`): MIT. Installed from npm per project, not vendored here.
- HyperFrames (npm `hyperframes`): Apache 2.0. Installed from npm per project (its shader-transitions package was
  tested and is not used). The CLI has commands that upload or call external services (publish, cloud, lambda,
  snapshot descriptions); the skill never runs them unless you ask. The helpers in `scripts/hf/` are our own code
  that drives the CLI; no HyperFrames source is copied into this repository.
- GSAP: its own Standard "no charge" license (https://gsap.com/standard-license), not open source. Installed from npm in
  HyperFrames projects only; `scripts/hf/prepare.mjs` copies `gsap.min.js` into the project's `vendor/` folder, never into this
  repository.
- puppeteer-core: Apache 2.0, installed from npm.
- Fonts (Geist, Instrument Serif): SIL Open Font License 1.1, installed from the npm `@fontsource` packages; HyperFrames
  projects copy the files and each LICENSE into their own `fonts/` folder. No font files are vendored here.
- MathJax (optional, for typeset formulas): Apache 2.0, installed on demand (`npm install mathjax-full@3.2.2`).
- Voice-over uses the OpenAI API (paid) through your own `OPENAI_API_KEY`; the key is read from the environment only
  and never written to disk.
- This repository's own license: decide before sharing it outside the team.
