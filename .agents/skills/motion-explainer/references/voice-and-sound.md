# Voice and sound

Read before recording any voice, building timing.json, or mixing. Voice takes and transcription are PAID API calls
(OPENAI_API_KEY): get the count with `--dry-run`, confirm it with the user before the first real `vo.py make`, and
keep re-rolls capped. Python tools run with the project venv (`.venv/bin/python`, Windows `.venv\Scripts\python`).

Contents
1. The order of work
2. Recording takes (vo.py)
3. What the transcribe-back check catches, and re-rolls
4. The timing sheet (timing.py) and caption windows
5. plan_vo as a check
6. Sound design (synth.py)
7. Mix, loudness and the sync check
8. Commands, end to end

## 1. The order of work

Record the voice first, build the timing sheet from the measured takes, then animate to the sheet. Every film timed
this way reported "plan_vo: holds 0, errors 0". Holds (frozen frames inserted where a take outruns its caption) are a
fallback: a hold freezes the picture, and plan_vo refuses captions that never settle.

After preflight, without a key or before copy approval, use an estimated sheet (`timing.py build --estimate`) only
for blocking the currently approved stage. Stop at the story and look checkpoints before animation. For a voiced
film, record approved copy, rebuild the sheet from the takes, and re-check every beat anchored to a word.

For a no-voice film, approve caption copy and measured reading holds instead; an estimated sheet is a starting point
for that review, not evidence of recorded speech. Skip voice calls, plan_vo and voice-correlation checks. With sound
only, synthesize cues, use mux.sh at -18 LUFS and verify cue alignment in the decoded file; an explicitly silent
film has no audio stream. A missing key does not authorize changing a voiced brief to no voice.

The 5 to 8 s hardest-beat sample includes sound before the whole film is built, unless the user explicitly chose
silence. For a first-frame cover, shift the picture, captions, cues and audio by one documented offset and verify
sync after encoding; see process.md for the 0.5 s hold plus 0.3 s cross-fade example.

For two engines (or two cuts) of one film, one timing pass writes one voice-over and one sheet that every build follows
exactly. Settle sub-caption splits, number formats and copy order before the sheet is shared: some fixes later could not
be applied to one version alone.

## 2. Recording takes (vo.py)

```sh
.venv/bin/python SKILL_DIR/scripts/vo.py make lines.json out/vo --voice cedar --dry-run   # counts only: no calls, no key
# tell the user the number of paid calls, wait for a yes, then (N = the agreed count):
.venv/bin/python SKILL_DIR/scripts/vo.py make lines.json out/vo --voice cedar --max-calls N
```
- `lines.json`: `{"instructions": "delivery note", "lines": [{"id": "c01", "text": "..."}]}`. The text is the
  locked caption.
- Default delivery: a calm, precise engineer explaining a real finding to other developers; conversational, a little
  understated, never salesy. One voice by default; every extra voice doubles the cost. One silent video serves every
  voice (windows are sized to the longest take).
- Takes are resampled to 48 kHz mono and trimmed to 40 ms around the voice (10 ms RMS, -45 dB under peak), 8 ms fades.
  Durations in vo.json are the trimmed lengths; everything downstream uses them.
- Cache per wav keyed on voice, text, instructions and model: changing the instructions regenerates every line.
- `--dry-run` (make, roll and words) prints the planned takes and paid calls as a RESULT line and exits 0 without
  reading the key. `--max-calls` (default 80) refuses a run that would exceed the agreed budget.
- Per-line takes (not paragraph takes) are what make caption-exact placement possible; a speech-to-speech model can
  paraphrase.

## 3. What the transcribe-back check catches, and re-rolls

- Truncated takes ("...the text?"), numbers run together or respelled ("401st", "May 12th", "11" against "eleven"),
  words swapped ("exposed" for "expose"). Fix by rewording or by writing numbers the way the transcriber writes them
  (digits for counts), never by accepting a wrong take.
- Formatting-only differences ("Round 3" against "round three") can be re-rolled once with identical text.
- TTS is not repeatable: identical text gave takes from 3.48 to 4.79 s with different pauses. Pace and pauses are
  judged, not assumed: `vo.py pace` prints syllables per voiced second (one reference film's median was 5.16).
- Keep every take: `vo.py roll lines.json out/vo c05 --tries 2` saves each try in `out/vo/_keep/` with its length,
  transcript, pauses and pace, and activates nothing; `vo.py use out/vo c05:3` makes a passing try active; `vo.py make`
  then rebuilds vo.json from the cache with no calls.
- Cap the tries. One film reached about 205 takes for 19 lines (one line 27 tries), mostly re-rolling spelled numbers
  that the transcriber always writes as digits, and re-rolling for speed, which is a lottery. vo.py caps tries per id
  (default 6 in total); past the cap, change the number formatting or accept a passing take and report.
- To hear how a number was spoken, transcribe with a prompt asking for numbers in words; read-only, not the gate.

## 4. The timing sheet (timing.py) and caption windows

```sh
node SKILL_DIR/scripts/measure_text.mjs --lines lines.json --out widths.json     # real caption widths
.venv/bin/python SKILL_DIR/scripts/vo.py words lines.json out/vo --dry-run                  # optional word times (paid): count first
.venv/bin/python SKILL_DIR/scripts/timing.py build --lines lines.json --vo out/vo --config timing.config.json --out timing.json
.venv/bin/python SKILL_DIR/scripts/timing.py check timing.json
```
Rules (timing.config.json `rules`, shared with plan_vo):
- Voice starts at caption `in + 0.15` (lead).
- `out >= in + 0.15 + take + 0.25` (tail 0.25; earlier films used 0.35 to 0.40).
- `out - in >= 0.33 s per word + 0.7 s` (hold rule; 0.6 read rushed).
- Next caption `in >= out + 0.35`; never two captions at once.
- Sub-captions: a caption wider than the caption box at the caption size splits at sentence breaks, or at a configured
  clause break (`clause: {"c10": ["sizes,"]}`) only where the take has a measured pause. Sub `in` = segment onset -
  0.15, previous sub `out` = segment end + 0.25, at least 0.15 s with no caption between subs.
- Sentence and sub edges come from silences in the take (ffmpeg silencedetect -35 dB, 0.12 s). Word times from
  whisper are aligned to the caption words by character matching and fitted into those spans; they place marks
  (about 0.15 s accurate), never caption edges. Whisper misses words on some takes, so it runs plain and prompted.
- Images that need reading get explicit extra time per caption (`cap_extra`, `gap_extra`); the close holds
  `close_hold` seconds after the last speech (4 s in series films; the last caption's out is the duration).
- The sheet records its rules, so a reader can re-derive every window.
In scenes, captions and marks come only from the sheet: `K.captions(T, host)`, `K.word(T, 'c02', 'eighth')` in
Motion, `W('c02', 'eighth')` in HyperFrames.

## 5. plan_vo as a check

```sh
node SKILL_DIR/scripts/plan_vo.mjs --scene index.html --vo out/vo/vo.json --out out/warp.json --tail 0.25
```
Expect "holds: 0, errors: 0". plan_vo's tail must equal the sheet's tail (the old default of 0.35 against a 0.25 sheet
inserted holds nobody planned). If it does insert holds, prefer re-timing the scene; if you keep them, pass the same
warp to the video render and the cue dump. Any always-moving layer (breathing field, drifting camera, animated grain)
makes every hold impossible.

## 6. Sound design (synth.py)

- Restraint is a rule: the film must work fully muted (feeds autoplay muted), and sound is a quiet second layer. But
  not too quiet: effects 25 dB under the voice were flagged; landing thuds and whooshes were raised 6 to 8 dB.
- Cues live in the scene next to the motion they belong to (`K.cue(t, type, extra)`, `cue()` in HyperFrames), with
  times from the same variables as the motion, so they stay in sync when timing changes.
- Gains are relative to each type's own level (0 = default), not absolute dB. A design that wrote absolute levels came
  out near silent.
- Palette: tick (pen contact, rhythm), pluck (a landing; notes from one chord), chord, whoosh (centre its 0.45 s
  sin-squared envelope on the move's peak speed: `t0 + SLIDE / 2 - 0.225`), thud (soft impact), swell (a breath on a
  reveal), deny (two descending notes; it can read as a game-show sting, use sparingly), key and type.
- Leave a gap in the voice for a payoff sound: a thud 22 ms before the next line was masked; the next caption came in
  0.35 s after the thud instead.
- Bed: optional, very quiet, starts at 0 and fades in over `fade` seconds (it cannot start mid-film). For example
  `--bed "A2,E3:-33:4"` on the cue dump. Measure a voice-free tail of the final (about -31 LUFS) to confirm the bed is
  audible but polite.
- Seeded: the same cues give the same audio.

## 7. Mix, loudness and the sync check

- mix.py places each take at its warp `start`, lowers the sound design 4 dB and ducks it a further 7 dB under speech
  (60 ms attack, 250 ms release), voice at 0.9, peak limited to 0.97. Everything at 48 kHz.
- mux.sh normalises to -16 LUFS (voiced films; -18 for sound only), true peak -1.5 dBTP, AAC 192 kb/s, and copies the
  video stream untouched. Measured finals: -15.9 to -16.4 LUFS integrated, true peak -1.1 to -1.5 dBFS, LRA 3.5 to 7.3.
- check_sync.py: every line inside its caption window and really present in the audio (correlation above 0.95; the
  first line often reads 0.97 to 0.99 because the opening sound sits under it). Run it twice: on the mix, and on audio
  decoded back out of the final mp4, after loudnorm and AAC (expect violations 0, every line 0.99 to 1.00).
- Silent deliverables skip synth, mix and mux and ship with no audio stream.

## 8. Commands, end to end

```sh
.venv/bin/python SKILL_DIR/scripts/vo.py make lines.json out/vo --voice cedar --dry-run   # ask, then run with --max-calls N
.venv/bin/python SKILL_DIR/scripts/timing.py build --lines lines.json --vo out/vo --config timing.config.json --out timing.json
.venv/bin/python SKILL_DIR/scripts/timing.py check timing.json
# ... build the scene to timing.json ...
node SKILL_DIR/scripts/plan_vo.mjs --scene index.html --vo out/vo/vo.json --out out/warp.json --tail 0.25
bash SKILL_DIR/scripts/with_lock.sh -- node SKILL_DIR/scripts/render.mjs --scene index.html --warp out/warp.json --out out/silent.mp4 --scale 2
node SKILL_DIR/scripts/render.mjs --scene index.html --warp out/warp.json --cues out/cues.json --bed "A2,E3:-33:4"
.venv/bin/python SKILL_DIR/scripts/synth.py out/cues.json out/sfx.wav
.venv/bin/python SKILL_DIR/scripts/mix.py out/warp.json out/vo cedar out/sfx.wav out/mix.wav
LUFS=-16 bash SKILL_DIR/scripts/mux.sh out/silent.mp4 out/mix.wav out/final.mp4
.venv/bin/python SKILL_DIR/scripts/check_sync.py out/warp.json out/cues.json out/vo cedar out/mix.wav
ffmpeg -v error -y -i out/final.mp4 -vn -ac 2 -ar 48000 -c:a pcm_s16le out/decoded.wav
.venv/bin/python SKILL_DIR/scripts/check_sync.py out/warp.json out/cues.json out/vo cedar out/decoded.wav
ffmpeg -i out/final.mp4 -af ebur128=peak=true -f null - 2>&1 | tail -12
```
For HyperFrames, replace the render line with the HyperFrames render (and finish.sh); the cue dump, synth, mix, mux
and checks are identical because the composition exposes the same contract.
