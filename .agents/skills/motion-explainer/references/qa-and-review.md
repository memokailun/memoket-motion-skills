# QA and review

Read before the first draft review and before reporting any film as done. Section 1 is the gates (tools); section 2 is
what reviewers found most often across 309 findings on eight films (fix these before anyone else sees the cut);
section 3 is how to run review passes and what each lens checks.

Contents
1. Gates: what each tool catches, and its limits
2. The ranked list of common findings
3. Review passes (lenses) and the findings file
4. Fixing, polishing and verifying

## 1. Gates: what each tool catches, and its limits

| Tool | Catches | Limits | Pass |
|---|---|---|---|
| `render.mjs --warnings-only` | K.tw or tw() overlaps, mixed spring keys, running browser animations | only what the engine reports | 0 and 0 |
| `timing.py check` | voice not fitting, hold rule, gaps, overlapping subs | the sheet only | violations 0 |
| `qa_scene.mjs` | text on text, strokes and filled ink through glyphs, text outside the safe frame, text in or out of the caption band, two captions at once, banned characters in visible text, caption holds, badge windows (opt-in) | knows glyphs, SVG strokes and filled SVG shapes; not HTML boxes, canvas drawings or images | all ok |
| `capband.mjs` | any drawing in the caption band (SVG, canvas, HTML) | a sliding sheet's own paper counts while it passes | no ink, or only sheet slides |
| `determinism.mjs` | seek-order dependence (PNG bytes, 3 orders) and painted DOM state | run alone; single-code-value noise is reported as noise | 0 mismatches |
| `hf/seek_audit.mjs` | the HyperFrames renderer's seek orders (end first, backward jumps) | Chrome tile seams: compare with its control pass | nothing beyond the control |
| `stillness.mjs` / `alive.py` | still stretches over 1.6 s (scene, captions hidden / rendered video) | designed holds are allowed: list them | every run fixed or listed |
| `speed_audit.mjs` | strobing moves (px per frame) | box centres and sizes only | under the caps, or listed |
| `copycheck.py` | banned characters and words in copy and source | its lists only | problems 0 |
| `check_sync.py` | voice outside its caption, voice missing from the mix | needs the warp used for the video | violations 0, twice |
| `verify_final.py` | glyphs rastered wrong under load in the final | sampled frames only | no compact blobs |
| `review_sheets.py` | everything a person sees | needs a reader | every sheet read |

- Prove each gate is live once per project: plant a failure in a throwaway copy (move a label onto a mark, start a red
  line 30 px inside the text) and confirm the gate fails. A gate that trimmed glyph boxes too tightly passed a line
  through ascenders until a judge called it fatal.
- Add per-film probes for the story's own invariants: a state probe printing the kept value every 0.05 s (catches
  backward steps), an allowed-numbers scan of every visible number against the brief's list, a ghost check for lifted
  copies.
- Sweeps: frames every 0.25 s through every slide, morph and build; 0.1 or 0.05 s through hand-offs; 2-frame steps
  around cuts (`review_sheets.py windows`).
- Never trust the builder's notes over the frames: notes claimed "at most three labels at once" (five were up), "every
  gap is at least 0.35 s" (one was 0.25), "no stray element" (there was one). State times in output seconds.

## 2. The ranked list of common findings

R1. Still or empty stage under a line that matters (about 110 of 309; every film). A page that did not change for 7 s
after the result; a pivot line over an empty stage for 2.3 s; 32 percent of half-second bins still in one film. Fix with
trace-true motion, never decoration: one meaningful stage event on the key word of every caption (a hold band growing
at true speed under the hook; the page dimming to the changed line on "changes the first match"); build the missing
image from what is already on stage. Measure stillness at phone size with a pixel threshold; 1 to 2 px pulses only
keep it alive on paper.

R2. Too small for a 390 px phone (about 90). Labels at 28 px, recap headers at 30, a payoff in a 120 x 80 px patch.
Floors: argument text 40 px, stage key text 56, hook text 90 to 100, labels 30, and 28 px is decoration. Push the
camera into the payoff. Never let a 1 px mark carry a beat alone; pair it with a 44 px word or a tint change.

R3. Picture and voice disagree in time or direction (about 25 majors). The claim spoken before its number was on
screen; the effect (rings retracting) before its cause (the mark that causes it); the caption giving away the twist
while the picture still showed the old value; bars rising while the voice said "slipped"; "the smallest span" drawn as
the largest. Anchor every mark to a measured word time; cause before effect; the picture points the way the verb does.

R4. The opening does not stop the thumb (about 65). Frame 0 without a focal point; motion blur smearing the first
second; stakes after 6 s; a dead pocket right after the hook (1.9 to 5.5 s nearly still); a 3.2 s first line meant to
be 2.5. See story-and-copy.md section 2.

R5. The last frame is not the most beautiful one (about 34; every film until it was designed at concept stage). 22
numbers at 42 px; "the plainest close in the series"; a stock scatter. Design it as a rhyme of frame 0; simplify; hold.

R6. A visual encoding overstates the source (about 18, the most important truth majors). Unequal styling of compared
bars, overshoot on data, an unmarked log axis, all-or-nothing pictures for partial results, averages drawn as single
outcomes. See story-and-copy.md section 6.

R7. A state the data never had (about 11, but most blockers). Morphs through invented times, a marker moving
backwards, a value from another run, code that never existed, a tie shown before the data. Every paused frame is a true
state.

R8. Reads like a slide, lecture or textbook plate (about 44). Seven text objects and 12 words plus a 14-word caption; a
centred title card; the year three times in 4 s (caption, folio, tag); a quote set on stage under the same caption.
Keep labels that tell marks apart, drop labels that restate the voice; two contrasting words instead of axis titles.

R9. Badges and source tags wrong, late or unreadable (about 37). A badge leaving while its plot stays; badges hanging
over slides; the wrong badge type; a made-up example returning without its badge; a tag that implies a study measured
something it did not. Badge window equals plot visibility; say the disclosure aloud.

R10. Colour or mark grammar misused (about 25). A person's fix on the program's red; a losing candidate in the edit
red; a concentric shape read as one more ring; one concept drawn as a valley in one act and a hill in the next. Write
the grammar down once; truth and craft check every new mark against it.

R11. Copy precision and scope (about 15, each a truth issue). See story-and-copy.md section 8.

R12. Jargon and symbols nobody explained (about 14). A symbol never said or glossed; "tokens"; config keys on a card.
Colour the symbol like the thing it names; grow the picture of a term out of what it measures; draw the term's referent
on the word.

R13. Transitions, half-states and seams (about 65, mostly minor). Slides at 267 to 345 px per frame; two scales of one
document at once; a new caption over the old picture before the slide; every beat fading to blank paper; accidental
figures mid-morph (a stick creature, a face). Mid-transition frames get paused and screenshotted: they must be true and
clean too.

R14. Sound under the threshold or off-tone (about 31, mostly minor). A payoff thud masked by the next line; effects 25
dB under the voice; a two-note deny that read as a game-show sting. Leave a gap in the voice for the payoff sound.

## 3. Review passes (lenses) and the findings file

Run each lens as a separate, independent, read-only pass, one after another (or as parallel Codex tasks if your setup
offers them), each given only: the direction, the timing sheet, facts.md, the build notes (including the builder's
"three weakest moments", which predicted the reviewers' majors almost every time), and the rendered file. Each pass
renders its own frames into its own folder, re-runs the gates it relies on, and writes one file
`review/<round>/<lens>.json`. Never let a pass edit the scene.

Findings file (fixed fields made 309 findings comparable and let a fixer apply them mechanically):
```json
{ "lens": "truth", "verdict": "one paragraph",
  "findings": [ { "severity": "blocker | major | minor", "time": "41.2 s", "issue": "...", "fix": "concrete change" } ] }
```
Severity: blocker = breaks a rule, misstates a fact, or the video fails its purpose; major = clearly hurts the
opening, comprehension or quality; minor = polish. Every finding has a time and a concrete fix. Give reviewers a
length budget: "add a hold" requests added up to +40 percent on one film.

| Lens | What it reads | Essentials of the prompt |
|---|---|---|
| Truth (technical honesty) | every caption against the locked copy and transcripts; every number, curve, label, badge and tag against facts.md, its Do-not-say and misleading-visuals lists, and the data | re-run QA, sync, ffprobe and loudness yourself; write what a viewer concludes from each shape alone and check it; read every caption for scope words; would a demanding engineer find every statement precise? |
| Hook (the opening) | frames every 0.2 to 0.25 s for 0 to 8 or 15 s at 390 px, muted | as a ruthless social-video editor: would you stop in the first second and why; does line 1 open a loop; are the stakes clear by 6 s; frame-accurate dead pockets |
| Viewer (comprehension) | the whole film once, as someone who has only used a chatbot | after each act write one sentence of what you understood; flag every place you would be lost, every unexplained term or symbol, every picture that does not obviously mean what the voice says. The most efficient comprehension test we ran |
| Phone (muted) | frames every 0.5 s at 390 px plus the sheets | is the mechanism clear with captions only; anything the argument needs too small or too brief; caption holds measured on the encode |
| Density and tone | key frames | count stage words per second besides captions; flag slide, lecture, textbook plate, or an atmospheric "AI aesthetic"; is the story told by motion |
| Craft and motion (with sound) | 0.1 to 0.25 s transition sweeps, the audio | a senior motion designer: stillness over 2 s; speed and strobing; overshoot on data; half-states; masked or off-tone sound; is the last frame the most beautiful one; compare with the best previous film |
| Feedback compliance | every numbered item of the requester's written feedback, frame by frame | for product films, it found four blockers in a cut another lens rated as holding up with three majors |

Concept judges use the same schema plus a ranking, a score per concept with strengths and problems, a `graft` list
(what the final direction should take from each concept) and a `fatal` list (what must never ship). Judge only
delivered concepts: check each storyboard and its rendered hook exist first, and stop if fewer than two do.

Calibration: lenses disagree, and that is useful (honesty wanted a losing bracket kept, craft wanted nothing red on
untouched text; the fixer chose and logged why). Judges are not the person who owns the film: all three ranked last
the look that person chose. Use judges for legibility, truth and craft defects; let the film's owner choose looks.

## 4. Fixing, polishing and verifying

- Fix pass brief: apply every blocker and major and the minors that are cheap and clearly right; if one conflicts with
  the direction, the shared timing sheet or the facts, leave it and say why. Never change the locked copy, the timing
  sheet or the voice takes in a fix pass.
- The fix report lists every finding as fixed, partly fixed or not applied, with the reason (accepted reasons: it
  would put text on text, it would read as a rewind, the direction locks it). Keep the pre-fix scene and render
  (`out/<name>_prefix.mp4`) so the verify pass can diff.
- Director polish: three to five targeted changes with exact geometry and acceptance (for example "replace the closing
  timetable with two fans on one time scale").
- Verify pass: an independent pass checks the polish and the whole film for regressions; it found new minors in most
  rounds, which a small touches round fixed. Then re-run every gate and read the new sheets before reporting.
- Two versions of one film (two engines): a compare pass on matched frames says which to publish and why (story
  clarity for the target viewer first, then craft), the three best and weakest moments of each, any remaining blocker,
  and the best still for a thumbnail. The person who asked for the film decides.
