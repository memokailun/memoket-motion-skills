# Process

Read before any film, test or revision, and whenever you plan review or fix rounds. It turns the loop that made our
best films into steps a Codex agent runs one pass at a time, each pass writing its result for the next. A small fix
can reuse research and decisions the user already approved; it cannot skip an unresolved checkpoint or change a
frozen deliverable.

Contents
0. Preflight: confirm before starting
1. The loop at a glance
2. Files a project keeps
3. Steps, with inputs, outputs and stop conditions
4. Human checkpoints (required)
5. Resource etiquette
6. Process failures and their guards
7. Editing continuity and platform covers
8. Late changes and frozen deliverables

## 0. Preflight: confirm before starting

Before source-code reading, research, scaffolding, installs, writing copy, design or rendering, stop for one short
checklist and wait for the user's answer. First gather only the minimum read-only inventory needed to make that
checklist concrete: supplied paths, file existence, asset versions and permitted repository metadata. Reading this
skill and identifying missing inputs are preparation for the checklist, not permission to start production.

Fill known values from the request so the user can confirm or correct them in one reply. Mark missing items as
unknown; do not substitute assumptions. Include all six rows, using "none" where appropriate:

- [ ] Sources: <repositories with local paths, branch, last commit date and origin status; apps/pages/documents and
  versions>; <needed real screenshots/recordings and whether they exist>; <logo files, fonts, colours and versions>.
- [ ] Facts: <person who signs off on numbers and product claims>; <research pack or fact sheet to use>.
- [ ] Output: <platforms, including whether X only>; <aspect ratio, length, language, voice or no voice, captions,
  music, deadline>.
- [ ] Paid services: <voice and any other API/service, allowed or not>; <estimated calls by service, including
  transcription and retries, or zero>. No paid call before its count is approved.
- [ ] On-screen links: <exact URLs, live or placeholder, evidence date, and who supplies the final value>.
- [ ] Frozen: <copy, assets, scenes or deliverables already final, with exact paths/versions that must not change>.

End with one request to confirm or correct this checklist and resolve its unknowns. Do not proceed until the user
answers and the inputs needed for the next stage are available and current. Record that answer in `preflight.md`;
if a needed input is still missing, keep the gate closed and ask only for that item. A later change in source
version, output scope, paid budget or frozen status reopens the affected row.

Repository evidence must be honest. For each repository, confirm that the local directory exists and show the
current branch, last commit date (with timezone), commit id, intended origin branch, and ahead/behind counts against
the locally available origin reference. Show the origin reference's freshness evidence, if available. A local
"behind 0" says nothing about commits not fetched yet. If network access is unavailable or forbidden, label the
result "cached origin; current remote unverified"; missing tracking or metadata is "unknown", never "up to date".
Ask the user to pull/update the right branch or explicitly confirm the snapshot before reading code. Do not fetch,
pull, switch branches, overwrite local work or run prohibited commands merely to satisfy preflight. When metadata
inspection is prohibited, ask the user to supply branch, commit date and origin status instead. After an update,
refresh the evidence and record which exact snapshot the user approved.

For apps and documents, record the build, revision or capture date. Confirm real UI captures show the intended
version; a design mockup is not evidence of the shipped product. For brand assets, name the actual logo files, font
families/weights/files and colour values, with their version or date. Ask who resolves differences between them.
For links, distinguish a verified live destination from the user's confirmation and from a placeholder; do not claim
a live check when offline. An approved placeholder needs the late-change procedure in section 8.

## 1. The loop at a glance

preflight approval, idea and research, brief and concepts, story/copy approval, look approval, character approval when
needed, voice and timing sheet, hardest-beat sample approval, full build, gates, first-cut approval, lens reviews,
fix, director polish, verify, final-render approval, final checks, delivery-package approval, delivery (and post copy).

Why it worked: independent read-only reviewers with fixed lenses and a fixed findings schema; a fixer who logs every
finding not applied and why; a short independent verify pass; the voice recorded before animation; one shared timing
sheet; and gates that run on every change.

## 2. Files a project keeps

```text
preflight.md        confirmed inputs, source snapshots and freshness, paid estimates, links, frozen paths
brief.md            audience, viewing conditions, hard rules, lessons carried from the last review, allowed numbers
facts.md            verified facts, derived numbers with assumptions, Do-not-say list (story-and-copy.md section 5)
concepts/<A|B|C>/   storyboard.md and hooks; style frames and rendered samples only after their prior gates
judges/<lens>.json  concept judge results (scores, problems, graft, fatal)
direction.md        the locked direction (template in assets/templates/docs/direction.md)
lines.json          the locked copy; timing.config.json; timing.json (the shared sheet)
out/vo/             takes, vo.json, words.json, _keep/ (every try)
notes/decisions.md  checkpoint, artifact version, user choice/comments, revisions and explicit approval
notes/build.md      deviations, measured speeds, designed holds, "three weakest moments", findings not applied and why
notes/late-changes.md one-constant changes, layout limits, tested commands, elapsed time, QA and rollback
review/<round>/     one findings file per lens; fix.md (every finding: fixed, partly, not applied, why); verify.json
```

## 3. Steps, with inputs, outputs and stop conditions

0. Preflight. Complete section 0 and get the user's answer before any of the following work.
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
   (argue for a different spine or signature image). Each delivers a written script and beat outline with three hooks,
   including the intended opening and last image. Do not build animated hooks or the film yet. Stop if fewer than
   two concepts exist for a new film; an approved direction carried into a narrow revision needs no new contest.
5. Judges. One pass per lens (hook, density and tone, truth, craft), each scoring every concept 1 to 10 with beat
   references, problems, graft and fatal lists, written to judges/<lens>.json (qa-and-review.md section 3).
6. Direction approvals, in order. Present the script and beat outline; stop for the story/copy decision. Then make
   two or three style frames in different directions; stop for the look decision. If there is a character, show two
   or three designs, then refine the chosen design and stop for approval of those refinements. Write direction.md
   with the approved copy, chosen look, character, testable non-negotiables, beats with fact ids and badges, signature
   image, last frame, sound and acceptance. Judges advise; only the user locks the direction (section 4).
7. Voice and timing. Record takes (confirm paid calls first), fix flags within the re-roll cap, build timing.json and
   check it (voice-and-sound.md). For two engines, this one sheet serves both builds. For no-voice work, confirm the
   caption and music/effects plan and replace estimated reading and action windows with reviewed timings.
8. Sample, then build. Render the hardest beat as a 5 to 8 s sample with sound, unless the user explicitly chose
   silence. It must test the actual hard contact, occlusion, transition or interaction, not an easy opening. Show it
   and stop. Only after approval, block every beat as stills (full size and 390 px), then animate the whole film to
   the sheet. Record deviations, measured speeds, designed holds and the three weakest moments in notes/build.md.
   Character films also follow [character-animation.md](character-animation.md) and its per-frame checks.
9. Gates. warnings-only, timing check, qa_scene, capband, determinism (idle machine), stillness, speed audit, copycheck
   (HyperFrames adds npm run check and seek_audit). All pass or are explained in the notes before any review.
10. First full cut. Render at scale 1 (workers allowed), with the planned sound and captions. Read the contact and
    phone sheets and inspect transitions. Show the playable cut, key stills and concrete alternatives for unresolved
    choices, then stop for comments or approval before the next revision stage. A reviewer is not the user's proxy.
11. Lens reviews. Truth, hook, viewer, phone (or density), craft: separate read-only passes, one findings file each.
12. Fix. One pass applies the user's comments, blockers and majors and cheap, clearly right minors; never changes
    locked copy, timing, takes or the chosen look without reopening the affected approval. Write
    review/<round>/fix.md; keep pre-fix files. Re-run every gate and show changed decisions again.
13. Director polish. Three to five targeted changes with exact geometry and acceptance; then the gates again.
14. Verify. An independent pass checks the polish and the whole film for regressions; a small touches round fixes
    what it finds. Required checkpoint before the final render.
15. Final. One full render at a time, under the lock, scale 2, one worker or checked joins; then cues, synth, mix, mux,
    check_sync twice, loudness and final-file checks (render-pipeline.md section 8; omit voice/audio stages as agreed
    for no-voice or silent films). Review continuity on every frame of the actual delivery encode; sheets are
    navigation aids, not a substitute (qa-and-review.md).
16. Package and deliver. Compare matched frames if two versions exist; the user picks. Show the exact cover/first
    frame, caption treatment or file, on-screen link and final playable file. Stop for delivery approval. Post copy
    gets its own review (voice, truth, platform). Record frozen files after approval; never publish, upload or post.

Running passes in Codex: the default is one pass after another in the same session. For each pass, write a short
brief first (role or lens, input files, the questions to answer, output path and schema), re-read only those inputs,
judge only that lens, write the output file, then move on only when the next human gate is cleared; do not let an
earlier pass's opinion leak into the next. Independent passes may run in parallel only if your setup can start
separate Codex sessions (for example `codex exec` with the brief). A pass that renders writes frames to its own
folder; a pass never edits files it was not asked to write. Read every output before the next step, and stop the
loop when a pass reports a blocker that needs the user.

## 4. Human checkpoints (required)

These are stops, not progress messages. At each row, show the actual artifacts, ask the user to choose or comment,
and wait for an answer. Silence, elapsed time, an internal judge's recommendation and passing QA are not approval.
Comments that request changes mean revise that artifact and show it again; do not infer approval of the next stage.

| Stop | Show concrete choices or evidence | Wait before |
|---|---|---|
| Preflight | The completed short checklist in section 0 | Code reading, research, setup or production |
| Story and copy | The full script and beat outline, opening/closing copy and labelled alternatives for disputed lines or order | Style work, voice recording or animation |
| Look | Two or three style frames in meaningfully different directions, side by side at full and phone size | Character design or detailed scene building |
| Character, when used | Two or three options in matched poses, then close-ups of refinements to the chosen option | Rigging and character animation |
| Hardest beat | A 5 to 8 s encoded sample with sound and close-ups of the hardest moment; matched short variants where timing or motion is unresolved | Building the whole film |
| First full cut | The playable full cut with sound/captions as planned, key stills and side-by-side options for changes | Applying the next revision or polishing the film |
| Final render | The revised cut and sheets, remaining issues or none, proposed final settings and expected render time | The full-length final render |
| Final delivery | The exact delivery encode, cover/first frame, captions and on-screen link with live/placeholder status | Declaring delivery final or freezing the package |

Make decisions quick: one compact sheet or reel per choice, labelled A, B, C; identical crop, scale and sample window
when comparing the same moment. Say what differs in plain language. Give one recommendation and one line of why,
then ask for a letter or a specific correction. Style directions must differ in composition, type or drawing
language, not just accent colour. For a revision, use A = approved/current and B = proposed; do not bury the change
in a new full cut. Always link the actual files, and include 390 px views for phone delivery.

The hardest-beat sample needs audible timing, even when there is no narrator: use approved music/effects or a clearly
labelled local temporary mix, unless the user explicitly chose silence. Do not make paid calls for a sample without
approval. Keep the final's agreed voice, music and silence choices separate from any temporary review sound.

Paid calls are an additional gate whenever a new batch exceeds the approved scope or count. Before any batch, show
the service, purpose and estimated calls, including transcription and retries. `vo.py make ... --dry-run` (and
`roll`/`words --dry-run`) supplies the voice count without calls or a key read; run with `--max-calls` set to the
approved cap. Cover other paid APIs too; no open-ended retry budget. Never set or print a key; read voice credentials
only from OPENAI_API_KEY. A preflight estimate is not approval for an unbounded or changed batch.

Record the artifact path/version, choice, comments and approval in notes/decisions.md. Reuse an existing explicit
approval only for that same scope and version. A change to an approved choice reopens its checkpoint. Never publish,
upload or post anything (including HyperFrames `publish`, `cloud`, `lambda`); deliver files.

## 5. Resource etiquette

- One full render at a time per machine (with_lock.sh), across projects and engines; determinism checks and seek
  audits alone on an idle machine.
- Never touch another project's running render or a live lock (with_lock.sh clears a stale lock itself,
  render-pipeline.md section 7); never regenerate cuts while a render of them runs.
- Never edit a scene while its final renders; copy the folder if you must keep working.
- Log long renders to a file.
- Check disk space before frame-capture renders; delete scratch PNG folders only after full-frame review. Keep
  complained-about frames, close-ups and regression evidence.
- Keep every voice take; never overwrite one.
- Do not modify, regenerate or overwrite files the user declared final. New revisions get a new destination only
  when requested; see section 8.

## 6. Process failures and their guards

| What happened | Guard |
|---|---|
| About 205 TTS takes for 19 lines with no cap | per-id cap in vo.py; change number formatting instead of re-rolling; budget printed before each run |
| Two full renders at once: disk capture refused, then a render cancelled; a check beside a render failed falsely | one heavy job at a time under the lock; checks on an idle machine; check free disk first |
| A long render was interrupted part way and none of it was usable | chunked renders with --from/--to for long films; log to a file |
| Code edited 45 s into a final render | freeze or copy the scene folder for the render |
| QA gates with blind spots trusted too far (glyph boxes too tight, holds unchecked, canvas drawings invisible) | plant failures for generic gates; prove each new fault-specific check fails on the user's bad frame, then passes the fix; read every delivered frame |
| Builder notes contradicted by frames | reviewers verify claims against frames; times in output seconds |
| The look steered by the brief's adjectives and the judges' taste | the look in medium terms; side-by-side style frames for the person who owns the film before concepts go deep |
| Locked copy found wrong after the build | truth reads every stakes and closing line against the corrected end state before voice |
| References captured from an older build | regenerate reference stills from the current source before comparing |
| A shared timing sheet locked before a copy-order decision | settle splits, number formats and copy order before both builds start |
| An action was shortened by a same-framing jump; a closer cut still read as a jump | play the action through and add whole music bars; verify exact boundary continuity if a cut cannot be avoided |
| A cover existed only as a separate thumbnail for an X-first film | build the cover into frame 0 and verify the common picture/audio offset |
| A late URL change became a hunt through code and another full production cycle | one constant, a measured layout limit and a timed, tested update runbook |

## 7. Editing continuity and platform covers

The cat playing with interactive machines on a web page exposed two editing failures that thumbnail review missed.

Action continuity. Why: removing time while leaving the framing unchanged reads as dropped frames. For this owner,
even a motivated cut to a closer shot still read as a jump. Fix: play the action through; prefer lengthening the film
by whole music bars over hiding part of the action. At a fixed tempo, one bar lasts `60 / BPM * beats_per_bar`
seconds; place the added time on full bar boundaries and rebuild the timing sheet and sound together. For music
with changing tempo, use measured bar boundaries. Show the length change at the relevant checkpoint. Without music,
extend to complete the action and confirm the new duration.

Never skip time inside an unchanged framing. If a cut is unavoidable, the outgoing and incoming sides must continue
each other exactly: pose, joints, tail position and direction, gaze, object contacts and camera framing/trajectory.
Do not treat a closer shot as automatic permission to skip action. Compare adjacent frames on both sides at full
size and 4x at contacts, then play through with sound. A pure time remap or a true-step cut still has to pass this
continuity test; technical determinism does not make an edit feel continuous.

X-first cover. Why: a separate cover file may never appear where the film is watched. If the film mainly goes to X,
assume there is no custom thumbnail and make the first encoded frame the cover. This is the production default,
not a claim that every X client offers the same controls. Confirm platforms before choosing aspect ratios or covers;
do not make extra formats the user did not request.

A useful opening is a 0.5 s cover hold, followed by a 0.3 s cross-fade to the film's first frame. Keep that source
frame still during the fade, then start the action at output 0.8 s: every source time maps to `output = source + 0.8`.
Delay the entire audio by the same 0.8 s and shift captions, word times, cues and duration by the same mapping. Keep
the original caption-to-voice lead; do not add it twice. At 30 fps the hold is 15 frames, the fade 9 and the offset
24. For other frame rates choose integer-frame durations and record their actual sum. Check the first decoded
frame, the fade boundaries, caption onset, the first audible event and the final tail. Run sync checks against the
shifted schedule on both the mix and audio decoded from the exact delivery file. A cover added after muxing without
updating the timing evidence is a failed check. Keep the opening event inside the first second after this addition.

## 8. Late changes and frozen deliverables

Why: an end-card URL that is not live yet will change late, when most choices are already approved. A scattered
literal or an undocumented render recipe turns one text edit into avoidable rework. Write
`notes/late-changes.md` before delivery for each known pending item, and keep it with the project:

1. Name the one source constant, for example `END_CARD_URL`, its exact file and its current approved placeholder.
   Every on-screen use must derive from it; record who supplies and signs off on the final URL and how live status
   will be confirmed. Do not make a link look verified while it is still a placeholder.
2. State the measured layout limit: safe box width/height, font and minimum size, allowed lines and longest tested
   value. Measure the replacement in the real loaded font. If it does not fit, stop for a new layout choice instead
   of silently shrinking type or changing the approved card.
3. Write the exact copyable commands that worked in this project, with its working directory and actual paths:
   update the constant, rebuild any baked inputs/cuts, render the changed window, run relevant checks, render/mux the
   new delivery encode and verify it. Include environment settings and timing/cover offsets. A generic list of
   script names or unfilled command placeholders is not a completed runbook.
4. Dry-run the procedure locally with a representative replacement in a revision copy. Record measured time for
   the edit, short render/check, full render and final QA, plus expected total time on this machine. Keep the short
   before/after sample, decoded end-card frame and check output. Undo the dry-run value in the revision copy.
5. State the rollback: preserve the approved source snapshot and encode, record their paths and hashes, write new
   versions to new paths, and restore the revision copy's constant if the update fails. Never overwrite the approved
   file as a rollback mechanism. Reopen the link/layout or delivery checkpoint affected by the real change.

Frozen means no edits. Why: the user may already be distributing a declared final, and an unsolicited improvement
makes versions disagree. Fix: list final source/asset/deliverable paths and versions in preflight.md and
notes/decisions.md. Do not modify, re-render over, replace or delete them. A pending-change runbook is not permission
to change a final. When the user explicitly requests a later revision, preserve the final and make a separately
named revision, applying only the requested change and obtaining the affected checkpoint approval.
