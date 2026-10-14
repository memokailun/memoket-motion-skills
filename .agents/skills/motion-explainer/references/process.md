# Process

Read at the start of any film longer than a quick test, and whenever you plan review or fix rounds. It turns the loop
that made our best films into steps a Codex agent runs one pass at a time, each pass writing its result to a file the
next pass reads. Short films and one-off fixes can skip steps 2 and 3, never steps 6, 9 and 11.

Contents
1. The loop at a glance
2. Files a project keeps
3. Steps, with inputs, outputs and stop conditions
4. Human checkpoints (required)
5. Resource etiquette
6. Process failures and their guards

## 1. The loop at a glance

idea, research pack, brief, three concepts, judges, locked direction, voice and timing sheet, build (stills first),
gates, draft, lens reviews, fix, director polish, verify, final render and audio, final checks, delivery (and post copy).

Why it worked: independent read-only reviewers with fixed lenses and a fixed findings schema; a fixer who logs every
finding not applied and why; a short independent verify pass; the voice recorded before animation; one shared timing
sheet; and gates that run on every change.

## 2. Files a project keeps

```text
brief.md            audience, viewing conditions, hard rules, lessons carried from the last review, allowed numbers
facts.md            verified facts, derived numbers with assumptions, Do-not-say list (story-and-copy.md section 5)
concepts/<A|B|C>/   storyboard.md, hooks, the real first 6 s as a scene, key stills, a 390 px sheet
judges/<lens>.json  concept judge results (scores, problems, graft, fatal)
direction.md        the locked direction (template in assets/templates/docs/direction.md)
lines.json          the locked copy; timing.config.json; timing.json (the shared sheet)
out/vo/             takes, vo.json, words.json, _keep/ (every try)
notes/build.md      deviations, measured speeds, designed holds, "three weakest moments", findings not applied and why
review/<round>/     one findings file per lens; fix.md (every finding: fixed, partly, not applied, why); verify.json
```

## 3. Steps, with inputs, outputs and stop conditions

1. Idea (series work). Generate candidates from three starting points (existing research, fresh, the audience's
   pain), then judge them in two passes: audience and hook (a hook the viewer lived through last week, a payoff not
   predictable from the title, distance from the last episode) and rigor and producibility (open the primary sources;
   prefer the idea where one published formula drives the animation and gives real numbers). Idea notes are leads, not
   facts. Output: one chosen idea with a one-line spine.
2. Research pack. Sweep passes per angle, then verify passes in batches of about 12 claims against primary sources,
   then one synthesis pass writing facts.md, a bibliography, a discussion (spine in one breath, draft captions with fact
   ids, five hooks, a motion map tied to fact ids, honest caveats) and a seeded simulation for numbers to animate.
3. Brief. Audience and viewing conditions with pixel floors; hard rules; "lessons from the last review" (carry the
   previous round's majors forward as defaults); allowed numbers on screen; a draft caption table with the fact id
   behind each line. Write the look in terms of the medium (diagrams, curves, pen lines, paper), not effects.
4. Concepts. Three passes with deliberately different angles: "director's cut" (execute the seed as well as it can
   be done), "hook maximalist" (the strongest first 5 s within the look and truth rules), "alternative structure"
   (argue for a different spine or signature image). Each delivers a storyboard with three hooks, the real animated
   first 6 s as a scene, key stills for later beats, and its own 390 px check. Stop if fewer than two concepts exist.
5. Judges. One pass per lens (hook, density and tone, truth, craft), each scoring every concept 1 to 10 with
   timestamps, problems, graft and fatal lists, written to judges/<lens>.json (qa-and-review.md section 3).
6. Locked direction. One pass (the creative director) writes direction.md: what is taken from which concept, the
   non-negotiables (every fatal item, each testable), the locked copy table, hooks, beats anchored to words with badges
   and fact ids, the signature image and last frame, sound, and the acceptance list. "Fix the scene, never the tool."
   Required checkpoint: the user approves the direction and the look (section 4).
7. Voice and timing. Record takes (confirm the paid calls first), fix flags within the re-roll cap, build timing.json,
   check it (voice-and-sound.md). For two engines, this one sheet serves both builds.
8. Build. Block every beat as stills first (full size and a 390 px sheet), fix composition, then animate to the
   sheet. The builder writes notes/build.md with deviations from the direction, measured speeds of big moves, designed
   holds, and its own three weakest moments.
9. Gates. warnings-only, timing check, qa_scene, capband, determinism (idle machine), stillness, speed audit, copycheck
   (HyperFrames adds npm run check and seek_audit). All pass or are explained in the notes before any review.
10. Draft. Render at scale 1 (workers allowed), contact sheets at 1 s, 390 px phone sheets, 0.25 s sweeps through
    transitions. Read every sheet.
11. Lens reviews. Truth, hook, viewer, phone (or density), craft: separate read-only passes, one findings file each.
12. Fix. One pass applies blockers and majors and cheap, clearly right minors; never touches locked copy, the sheet or
    the takes; writes review/<round>/fix.md; keeps the pre-fix files. Re-run every gate.
13. Director polish. Three to five targeted changes with exact geometry and acceptance; then the gates again.
14. Verify. An independent pass checks the polish and the whole film for regressions; a small touches round fixes
    what it finds. Required checkpoint before the final render.
15. Final. One full render at a time, under the lock, scale 2, one worker or checked joins; then cues, synth, mix, mux,
    check_sync twice, loudness, final-file checks (render-pipeline.md section 8), 1 s sheets of the final read again.
16. Compare (two versions) and deliver. The person who asked for the film picks. Post copy gets its own review
    (voice, truth, platform).

Running passes in Codex: the default is one pass after another in the same session. For each pass, write a short
brief first (role or lens, input files, the questions to answer, output path and schema), re-read only those inputs,
judge only that lens, write the output file, then move on; do not let an earlier pass's opinion leak into the next.
Independent passes (the concept passes, the judges, the review lenses) may run in parallel only if your setup can
start separate Codex sessions (for example `codex exec` with the brief). A pass that renders writes frames to its own
folder; a pass never edits files it was not asked to write. Read every output file before the next step, and stop the
loop when a pass reports a blocker that needs the user.

## 4. Human checkpoints (required)

Codex proceeds unless a skill requires approval, so these are requirements:
- Before the first paid call: tell the user the number of TTS and transcription calls (`vo.py make ... --dry-run`
  prints it without calling or reading the key) and wait for a yes; then run with `--max-calls` set to that number.
  Never set or print a key; read it only from OPENAI_API_KEY.
- After the direction and look: show the user the style frames or blocked stills (a contact sheet and the hook at 390
  px) and wait for approval before building the whole film.
- Before a full-length final render: show the draft's sheets and say how long the final will take; wait for a go.
- Never publish, upload or post anything (including HyperFrames `publish`, `cloud`, `lambda`); deliver files.

## 5. Resource etiquette

- One full render at a time per machine (with_lock.sh), across projects and engines; determinism checks and seek
  audits alone on an idle machine.
- Never touch another project's running render or a live lock (with_lock.sh clears a stale lock itself,
  render-pipeline.md section 7); never regenerate cuts while a render of them runs.
- Never edit a scene while its final renders; copy the folder if you must keep working.
- Log long renders to a file.
- Check disk space before frame-capture renders; delete per-frame PNG folders after reading the sheets.
- Keep every voice take; never overwrite one.

## 6. Process failures and their guards

| What happened | Guard |
|---|---|
| About 205 TTS takes for 19 lines with no cap | per-id cap in vo.py; change number formatting instead of re-rolling; budget printed before each run |
| Two full renders at once: disk capture refused, then a render cancelled; a check beside a render failed falsely | one heavy job at a time under the lock; checks on an idle machine; check free disk first |
| A long render was interrupted part way and none of it was usable | chunked renders with --from/--to for long films; log to a file |
| Code edited 45 s into a final render | freeze or copy the scene folder for the render |
| QA gates with blind spots trusted too far (glyph boxes too tight, holds unchecked, canvas drawings invisible) | plant a failure once per project; add per-film invariant probes; read the frames |
| Builder notes contradicted by frames | reviewers verify claims against frames; times in output seconds |
| The look steered by the brief's adjectives and the judges' taste | the look in medium terms; a style-frame reel for the person who owns the film before concepts go deep |
| Locked copy found wrong after the build | truth reads every stakes and closing line against the corrected end state before voice |
| References captured from an older build | regenerate reference stills from the current source before comparing |
| A shared timing sheet locked before a copy-order decision | settle splits, number formats and copy order before both builds start |
