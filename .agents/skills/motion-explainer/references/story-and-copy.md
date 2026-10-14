# Story, copy and truth

Read before writing the brief, the hooks or the locked copy, and before any truth review. Captions are the voice word
for word, so copy is written for the ear and checked like a claim.

Contents
1. Story structures that worked
2. The hook and the last frame
3. Copy for the ear
4. Numbers, captions and the transcribe-back check
5. The truth system
6. Shapes must not overstate
7. States the data never had
8. Scope words and precision
9. Post copy (when the video ships with a post)

## 1. Story structures that worked

- One signature image per video, decided before anything else: the frame people will remember. Ask every concept and
  every judge which single image it is.
- Explainer about a bug or a design choice: the failure visible at frame 0; the stakes by about 6 s; a reason to stay,
  best as "wrong answer first" (the obvious fix, shown failing on another real case); the mechanism on the signature
  instrument; the real fix, shown running; the honest limit; end on the source's own line.
- Explainer about research: the spine in one breath before any caption ("forgetting is a bet", "every summary is a
  retelling"); a hook from the viewer's own experience; an origin story with a date; the one formula moment built from
  pictures already on screen; the payoff of the hook's question about two thirds in; an honest twist that cuts
  against the easy reading; a practical takeaway the viewer can do tomorrow.
- Three or four act breaks, all marked by one transition type, so a muted viewer feels the structure.
- Plan the cuts before the voice: write which line goes first if the read runs long.
- Keep distance from the last episode: reusing its framing and axes reads as "episode 1.5".
- The end rhymes with the beginning: the last frame is a bookend of frame 0.

## 2. The hook and the last frame

The hook (most of the paid "weak opening" findings came from breaking one of these):
- Frame 0 is already beautiful, readable at 390 px, already shows the tension, and the caption is up on frame 0. It is
  the autoplay thumbnail and the loop restart point.
- Something the viewer did not expect happens within the first second (frame 0 may already be in motion: a bead
  mid-fall above an empty slot).
- The first spoken line is about 2.5 s, concrete, literally true of the example, and opens a loop the video closes.
  Measure the take; do not estimate (7 words ran 2.46 s).
- By about 6 s the viewer knows the stakes. Light the contradiction on the word that names it (swapping two lighting
  steps cut the caption-to-picture lag from 3.25 s to 1.1 s).
- Write at least three hooks (frame 0, first-second event, first line with measured length), judge them on the real
  animated first 6 s at 390 px, pick one, say why. The literal line beats the clever one ("added a paragraph that
  repeats" beat "the same thing twice", which overstated).
- A flash is not a hook if it reads as astronomy or a lens flare.

The last frame was flagged as weak in every episode until it was designed at concept stage:
- Design it as a rhyme of frame 0 (same layout and type size, the opening's question finally answered).
- Simplify rather than add: fewer points, more air, no label.
- Hold it 4 to 8 s with the caption up; no new information arrives on it.
- If a mid-film frame is stronger, rebuild the close around it.
- Explainers end on the page: no end card, logo, URL, fade to black or thanks (brand films may differ; ask).

## 3. Copy for the ear

- Write for a smart viewer who has only used a chatbot. The first two sentences describe something they lived; jargon
  only after that, and every term is explained in the sentence where it appears or by the picture under it. Some words
  are banned outright when the audience reads them differently ("prior": say "what it expected"; "context" means the
  context window to developers).
- A developer telling a colleague: contractions, short clauses, at most one fragment per beat. Vary sentence length;
  avoid three parallel clauses in a row (that rhythm reads as generated).
- Numbers as people say them; exact figures live on stage.
- A beat of silence before a quote; let a result land with a half-second pause after it (leave a gap in the voice for
  the payoff sound, or the sound is masked).
- No filler openers ("Here's the thing"), no rhetorical "right?", no hype words, no aphorisms, no "the takeaway is".
- Hooks describe user experiences only and never claim how a vendor's system works inside.
- Say the disclosure out loud once (badges are 6 px on a phone): "The inputs are fixed samples.", "In one preprint",
  "A test endpoint sends eleven pieces, one every 0.3 seconds."
- Localised films: one short line per beat (about 14 characters in Japanese), held max(2.5 s, characters / 4 + 1 s);
  get a native speaker's review of copy in a language the requester cannot read, and explain each line to them in
  their language.

## 4. Numbers, captions and the transcribe-back check

- Lock copy before voice and voice before animation. After lock only how a number is written may change, and the
  change is logged in direction.md.
- The transcribe-back check is an exact match after lowercasing, hyphens to spaces and stripped punctuation. Paid
  examples: "400 first" heard as "401st"; a hyphenated acronym came back without its hyphen on 9 of 11 takes; "May
  12" as "May 12th"; spelled numbers ("seven", "eighteen") came back as digits on almost every take (1 of 15 passed). Choose the written form the
  transcriber produces (digits for counts) before the first take, and keep one style across all captions.
- A caption must not show a different exact-looking number from the stage: "18,000" under a counter reading 18,282
  was flagged; write "18 thousand".
- Captions are one line at a time. Long captions become consecutive single-line sub-captions at sentence breaks, timed
  from the take's silences (timing.py), measured in the real font (measure_text.mjs; a 1,460 px box at 46 to 50 px).
  Break between clauses, never between subject and verb.
- Caption windows: voice at in + 0.15; caption stays 0.25 s after speech; next caption 0.35 s later; hold at least
  0.33 s per word + 0.7 s (timing.py check and qa_scene.mjs holds enforce it; a layout gate once let a caption 0.04 s
  short through).
- Re-read every stakes line and every closing line against the corrected end state before voice. A locked line found
  wrong after the build cost a separate copy change, eight new takes and a 0.44 s shift of every later beat.

## 5. The truth system

Sources of truth, in order: for code, a real trace of the real code at a fixed commit with an "allowed numbers on
screen" list; for research, a verified research pack plus a deterministic seeded simulation for anything animated; for
product films, the real screenshots, then the design kit, then the code ("where they differ, real screenshots win").

The research pack (`facts.md`), which made truth review fast:
- Sweep in several passes, one per angle; each returns papers with how much was opened (full, partial,
  abstract), checkable claims with location and URL, exact on-screen numbers. "Never cite from memory."
- Verify claims in batches against the primary source: verified, partly (keep only the corrected wording), wrong, or
  unverifiable (the default when unsure). About one claim in four from the sweeps needed a correction.
- One sentence a narrator could say per fact, then authors, year, title, page, URL; `[verified]` or `[corrected]`;
  venue flags (peer reviewed, preprint, vendor: say "in one preprint"); `[off screen]` for facts usable only in replies.
- A "Derived numbers" section for our own arithmetic and simulation, each with its formula, its assumption, and "label
  as illustration". The assumption travels with the number everywhere it appears.
- A "Do not say" list with the safe alternative, in three parts: wrong or overclaimed wording; visuals that would
  mislead (scattered markers that look measured, a curve overlaid as if identical, a drawn chain animated as data, a
  smooth exponential through three points); vendor and product claims (never on screen).
- Sources never opened are listed and never quoted. Open the PDF yourself; never accept a second-hand retelling (facts
  marked "verified" from retellings went to production wrong and polluted many drafts).

On screen:
- Badges: `illustration` (computed or simulated numbers), `schematic` (a shape drawn to show a form), `scenario` (a
  made-up but plausible example; it returns with the example). Prepared inputs carry a corner badge the whole video
  (`SAMPLE INPUT`, `SYNTHETIC STREAM`). One plot, one badge type; on screen exactly while the plot is visible; it rides
  with its sheet and is covered with it.
- Source tags: author and year, at most four words, a fixed corner, only while that study's result is on screen, names
  checked against the bibliography, paired with a picture that does not imply a different domain.
- No verification theatre: no green ticks, no "PASSES", no scores the code does not produce; show the literal return
  value.
- Controls are labelled and visibly weaker (smaller, a weaker colour), and never show what they do not compute.
- Translations of real output are labelled as translations and never reworded.
- Data guards: the page refuses to load when a plotted value drifts from its source (render-pipeline.md section 1).
- No product UI or logos in explainers; a product name only as the named subject of a peer-reviewed study; vendor
  numbers flagged as self-reported. Internal experiments stay out of public material.

## 6. Shapes must not overstate

Truth failures were almost never wrong numbers. They were shapes that overstated. The truth lens writes down what a
viewer would conclude from the shape alone and checks that conclusion against the source.
- Compared things share one style (same ink, stroke and head) so only the compared quantity differs: a full-ink
  column against a pale one made a 2.7 percent gap look like 20.
- Compared values move on one shared progress value with no overshoot, so their ratio holds on every frame:
  ```js
  const H = [0.188, 0.193].map((v) => (v / 0.193) * 470)            // to scale, from zero
  K.tw(p, [0, 1], { at: 75.45, type: 'spring', bounce: 0, visualDuration: 0.7 })
  const colH = (i) => H[i] * p.get()                                 // both bars read the same progress
  ```
- Draw to scale from zero where a value is shown; mark log axes with visible decade ticks (an unmarked log axis made
  "seven times weaker" read as 1.8).
- Partial results look partial (crack 3 of 6 chips, not all 6); averages are not drawn as single outcomes; the shape of
  change matches the source (most change in the first step means a drop, not a steady decline).
- The thesis image must agree with its own line (a pin that "keeps it exact" landed 0.45 units off).
- Never draw a mechanism the model does not have.
- Pictures point the way the verb does (bars rising while the voice says "slipped" were flagged; hang them down from a
  baseline).

## 7. States the data never had

Most blockers and judge fatals were states that never existed. Every paused frame, including mid-transition frames,
must be a true state.
- No morph through invented times; every animated position on a data axis is either the true-speed playhead or a
  data value.
- No marker moving backwards inside a run; switch scenarios with a re-set and a plain-words label, never a rewind.
- No value carried in from another run; no half-typed identifier that never existed (open a slot before typing).
- No exact tie shown before the data arrives; labels and tags arrive with their data; old columns sink before new ones
  rise; a transition never keeps one study's labels under the next study's tag.
- Numbers never roll or count in an explainer; a value changes between two true values when its mark finishes. In a
  product film a live counter never jumps: roll it monotonically through a visible fast-forward, or cut away.
- A state probe that dumps the kept state every 0.05 s and prints only changes shows a backward step at a glance.

## 8. Scope words and precision

The truth lens reads every caption for: only, every, all, always, never, needs, the, forever, same, converged.
- One code path is not every path ("on a 400, the client retries" said every 400 is retried; the code retries only
  when one check is true).
- Name operators and values exactly (">=" is not "equals"; an empty string is not "nothing").
- No stronger verb than the source ("needs" where the source says "may require").
- Closing generalisations are scoped to the sample ("THIS SAMPLE"); a stakes line stays true of the fixed state.
- A ratio of two small preprint numbers is replaced by the plain numbers (6 versus 50 points).
- "Converged" when the group ended further away: say "bent toward". "Forever" is drama: scope it.
- Exhaustive lists and system claims get scoped: "this app files old messages", "in a classic model".
- A hook a modern user would answer "obviously yes" is a weak hook; sharpen the condition.

## 9. Post copy (when the video ships with a post)

- Do not reuse the caption script in the post (the same lines twice in a narrator's cadence read as a content
  calendar). Open with the fact itself, not a scripted hook or a label opener ("The twist:").
- First person ("my arithmetic"); give the scenario so every number can be recomputed; scope drama words.
- House style: X gets a single post of at most 280 characters with the video and a statement ending; Reddit may end
  with one real question; no reference lists (authors and years in the text); no AI-disclosure line.
