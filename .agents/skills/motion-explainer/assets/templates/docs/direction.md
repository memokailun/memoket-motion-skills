# Direction: <working title>

Locked by: <name>, <date>. Builders follow this file exactly. Every item under "Non-negotiables" traces to a judge's
fatal finding or a house rule. Changes to copy or timing after lock go through the director and are logged at the end.

## 1. Spine (one breath)

<One sentence a viewer could repeat after watching. Example: "Half-lives make decay easy to predict: after n half-lives,
one over two to the n is left.">

## 2. Audience and viewing conditions

- Viewer: <a smart person who has only used a chatbot; explain every term where it appears>.
- Where: <feed, autoplay muted, about 390 pt wide on a phone; or a talk, a docs page>.
- Length: <40 to 120 s>. Format: <1920x1080, 30 fps; also 1080x1080? say so now>.

## 3. Look

House look Fine Line (references/design-language.md): porcelain painted paper, Prussian ink, one vermilion detail per
key frame, graphite for what the story sets aside, Instrument Serif labels, Geist captions. Deviations: <none, or list>.

## 4. Non-negotiables (testable)

1. Every frame is a pure function of t; determinism check passes before the final render.
2. Data and plot positions land with zero overshoot; compared things share one style and one progress value.
3. No state the data never had: no rewinds, no in-between values, no marker moving backwards.
4. Text the argument needs is 40 px or more at 1080p (stage key text 56 px, hook 96 px, never under 90 px).
5. No still stage over about 2 s except a finished image held under its caption.
6. <judge fatal items, one line each, each with how to test it>

## 5. Locked copy

Captions are the spoken words, one caption id per voice line. Write captions exactly as below. If the transcribe-back
check flags a line, only how a number is written may change (digits for counts), and the change is logged here.

| id | caption | fact or trace id | badge on screen |
|----|---------|------------------|-----------------|
| c01 | Every hour, half of what's left decays. | F1 (arithmetic) | illustration |
| c02 | After 3 hours, an eighth is left. | F1 | illustration |

Disclosure spoken once: <"The numbers here are computed, not measured." or the prepared-input sentence>.

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

## 9. Sound

Quiet second layer; the film works muted. Palette: <pluck on landings, tick on pen contact, whoosh on sheet slides
centred on peak speed>. Bed: <notes, gain, fade or none>. Mix speech at -16 LUFS.

## 10. Acceptance (the builder runs these and reports the numbers)

- timing.py check: violations 0; plan_vo.mjs --tail 0.25: holds 0, errors 0.
- render.mjs --warnings-only: 0 warnings, 0 browser animations.
- qa_scene.mjs: all ok. determinism.mjs: all identical (run alone on an idle machine). capband.mjs: no ink.
- stillness and speed audits: every flag either fixed or listed below as a designed hold.
- check_sync.py on the mix and on audio decoded from the final: violations 0.
- Contact sheets at 1 s and phone sheets at 390 px read by a person (or a reviewing pass) before delivery.

## 11. Change log after lock

| date | what changed | why | who approved |
|------|--------------|-----|--------------|
