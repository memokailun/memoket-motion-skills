# Direction: <working title>

Locked by: <name>, <date>. Builders follow this file exactly. Every item under "Non-negotiables" traces to a judge's
fatal finding or a house rule. Changes to approved copy, timing or look reopen the affected human checkpoint and are
logged at the end. The owner decides; a director or reviewing pass does not replace the owner's approval.

## Preflight and decisions

- Confirmed checklist: <preflight.md, user answer and date; no production before that answer>.
- Sources: <local repository paths, approved branches/commits, last commit dates, behind-origin status and evidence
  freshness; approved app/page/document versions; real screenshots/recordings and brand file/font/colour versions>.
- Claims: <facts.md or research pack version; who signs off on numbers and product claims>.
- Output: <platforms, aspect ratios, duration, language, voice or none, captions, music, deadline>.
- Paid services: <allowed services, estimated calls, caps and approvals before any calls>.
- Links: <display text and destination, live or placeholder, confirmation owner>.
- Frozen: <exact files and dependencies declared final; do not change or overwrite them>.
- Decision record: <notes/decisions.md; artifact versions, user choices and outstanding comments>.
- Stops: script and beats; 2 or 3 look frames; character options then refinements if used; 5 to 8 s hardest-beat sample
  with sound unless explicitly silent; first full cut; before final render; cover/captions/link before delivery.
  Show labelled comparisons and a one-line recommendation. Silence is not approval.

## 1. Spine (one breath)

<One sentence a viewer could repeat after watching. Example: "Half-lives make decay easy to predict: after n half-lives,
one over two to the n is left.">

## 2. Audience and viewing conditions

- Viewer: <a smart person who has only used a chatbot; explain every term where it appears>.
- Where: <feed, autoplay muted, about 390 pt wide on a phone; or a talk, a docs page>.
- Length: <40 to 120 s>. Format: <1920x1080, 30 fps; also 1080x1080? say so now>.

## 3. Look

Selected look: <approved option and frame paths>. House baseline Fine Line (references/design-language.md): porcelain
painted paper, Prussian ink, one vermilion detail per key frame, graphite for what the story sets aside, Instrument
Serif labels, Geist captions. Deviations: <none, or list>.

Character, if used: <approved design and refinements, rest proportions and contact poses, lazy/curious acting, named
joints and part IDs; character-animation.md checks and actual bad-frame regression fixtures>.

## 4. Non-negotiables (testable)

1. Every frame is a pure function of t; determinism check passes before the final render.
2. Data and plot positions land with zero overshoot; compared things share one style and one progress value.
3. No state the data never had: no rewinds, no in-between values, no marker moving backwards.
4. Text the argument needs is 40 px or more at 1080p (stage key text 56 px, hook 96 px, never under 90 px).
5. No still stage over about 2 s except a finished image held under its caption; a living character breathes in holds.
6. No skipped action inside unchanged framing; extend by whole music bars. An unavoidable cut preserves pose, tail
   and camera continuity and returns to the user for review.
7. Characters remain connected at designated joints, with clean occlusion and no disappearing parts; root speed and
   limb stretch are checked every frame against the approved caps.
8. <judge fatal items, one line each, each with how to test it>

## 5. Locked copy

With voice, captions are the spoken words, one caption id per voice line. Without voice, approve the same copy with
reading holds. Write captions exactly as below. If the transcribe-back
check flags a line, only how a number is written may change (digits for counts), and the change is logged here.

| id | caption | fact or trace id | badge on screen |
|----|---------|------------------|-----------------|
| c01 | Every hour, half of what's left decays. | F1 (arithmetic) | illustration |
| c02 | After 3 hours, an eighth is left. | F1 | illustration |

Disclosure once in voice, or legibly on screen without voice: <"The numbers here are computed, not measured."
or the prepared-input sentence>.

## 6. Hooks (three alternatives, one chosen)

| | frame 0 (the poster) | first-second event | first line (measured length) |
|---|---|---|---|
| A | <...> | <...> | <... (2.4 s)> |
| B | <...> | <...> | <...> |
| C | <...> | <...> | <...> |

Chosen: <A>, because <...>. Stakes clear by <time, at most about 6 s>.

## 7. Beats

Times come from the timing sheet; marks are anchored to spoken words (K.word / W()).

| beat | caption | what moves (cause before effect) | lands on word | badge or tag | sound cue |
|------|---------|----------------------------------|---------------|--------------|-----------|
| half-life-plot | c01 | the pen draws y = 0.5^x; points land as the head passes each hour | "half" | illustration | tick, plucks |
| eighth | c02 | point 3 turns vermilion, "1/8" rises beside it | "eighth" | illustration | pluck |

Act breaks: <caption ids where a fresh sheet slides over the old one; three or four per film at most>.

## 8. Signature image and last frame

- Signature image (the one frame people remember): <...>.
- Last frame (the most beautiful one, a rhyme of frame 0, held 4 to 8 s, no new information): <...>.
- Platform cover: <X-first assumes no custom thumbnail; frame 0 cover, hold/fade and shared audio offset>.
- End-card link, if agreed: <one constant, measured layout limit, live/placeholder status>.
- Late-change runbook: <notes/late-changes.md, exact commands, measured time and versioned outputs>.

## 9. Sound

Quiet second layer; the film works muted. Palette: <pluck on landings, tick on pen contact, whoosh on sheet slides
centred on peak speed>. Bed: <notes, gain, fade or none>. Mix speech at -16 LUFS.

## 10. Acceptance (the builder runs these and reports the numbers)

- timing.py check: violations 0; plan_vo.mjs --tail 0.25: holds 0, errors 0.
- render.mjs --warnings-only: 0 warnings, 0 browser animations.
- qa_scene.mjs: all ok. determinism.mjs: all identical (run alone on an idle machine). capband.mjs: no ink.
- stillness and speed audits: every flag either fixed or listed below as a designed hold.
- check_sync.py on the mix and on audio decoded from the final: violations 0.
- Contact sheets at 1 s and phone sheets at 390 px read; every decoded delivery frame reviewed for continuity.
- Every contact and paw-near-face window inspected at 4x. Character probes cover every frame, fail the actual known
  faults first, then pass the corrections and clean controls. Record checked/total frames and peak speed/stretch.
- Cover, captions and exact link approved on the delivery candidate; audio offset verified; frozen files unchanged.
- Voice-only checks above are N/A for no-voice films; verify sound cues directly, or confirm no audio for silent films.

## 11. Change log after lock

| date | what changed | why | who approved |
|------|--------------|-----|--------------|
