# Design language

Read before choosing or changing a look, before blocking stills, and whenever a reviewer says a frame "reads like a
slide" or "looks like AI". The default house look is Fine Line; Galley Proof is the alternative for code and text-diff
stories. Both are written as tokens you can copy.

Contents
1. Principles (the taste that decided right versus wrong)
2. Fine Line, the default look
3. Galley Proof, for code and text stories
4. Sizes: 1920x1080 against a 390 px phone
5. Rejected looks and moves, and what replaced them
6. Making a new look

## 1. Principles

1. Few words on stage. Motion and images carry the story; text density reads as a lecture and nobody reads while
   watching. Count stage words besides the caption at every key frame: single digits, at most about four labels of one
   to three words. No tables, bullets, paragraphs, code pages or legends. A formula appears once, as a crafted moment
   built by animation. Labels never restate the caption; fewer words is the tiebreak. A label earns its place only when
   it makes a wordless picture readable (a scale, a unit, one value).
2. Look like a technical publication explaining something rigorous in a relaxed way: axes, curves computed from the
   real formula, a properly typeset equation, schematic diagrams, precise pen lines. Vividness comes from action
   (drawing, morphing, springs, rhythm) and plain narration, never from atmosphere. Hard bans: particles, lens flares,
   glow halos, bloom, bokeh, stars, water, shake, glitch, whip pans, zoom blur, 3D spins, cube or page-curl
   transitions, text strokes, text plates, gradient text, gradient-blob wallpaper, neon, stock footage, AI imagery,
   emoji, clip-art icons, green "verified" lights.
3. Light ground: porcelain or warm paper, never pure white, never a dark field. Paint a broad window light with grain
   and fibres so the page is alive. Light grounds also survive platform compression better than dark fields full of
   moving specks.
4. Rigorous content, relaxed style: if the style is too rigorous, the viewer's barrier is too high.
5. Something happens in the first second; the stakes are clear by about 6 s; frame 0 is a poster.
6. The last frame is the image people screenshot: make it the most beautiful one by simplifying (fewer points, more
   air), as a rhyme of frame 0, held 4 to 8 s.
7. Springs over keyframed eases (motion-engine.md section 5); data never overshoots.
8. Wow from craft, never from claims or effects: impressive but not exaggerated.
9. Nothing fake-looking: no counter that jumps, no ghost copy flying back, no blurred readable UI, no invented
   in-between values, no state the data never had.
10. Tell the story with a clear logic from start to finish; do not change the look just to be different from last time.
11. Colour carries one meaning each (below). One accent item per key frame.
12. Copy hygiene everywhere on screen: no em or en dashes, arrow characters, middle dots, curly or corner quotes,
    asterisk emphasis. No AI-generated or AI-voice disclosure lines inside the video; the publisher handles disclosure.
13. Characters: if the story needs an animal, a line-drawn cat with a job in the story (one clean ink line, paper fill,
    never talking). House preference. Read [character-animation.md](character-animation.md) before designing or
    animating one; approve the design and its refinements before building the rig.

Motion grammar that held across films:
- Within an act nothing cuts; things morph (a ring unrolls into a trace, a curve straightens when its axes go
  logarithmic, tallies fold into dots). Between acts a fresh sheet slides over the old one, the only depth move, three
  or four times per film.
- One primary motion at a time; secondary motion under about 30 percent opacity, starting 80 to 120 ms after the
  primary at 30 percent amplitude or less.
- Keep the stage alive: never still for more than about 2 s unless a finished image holds under its caption. Fill a
  breath with one small event that carries meaning (a tick marching along a line, a pen underline on the word about to
  change), never decoration.
- Cause before effect, on screen: show the reading head before the ring retracts, the axes change before the curve
  straightens.
- Visual events land on their spoken word; the picture may lead the word by 0 to 0.4 s.
- Picture the abstract with the most literal research image available (two pens tallying in a ruled ledger, not hands
  or faces). Make mechanisms physical (jaws that squeeze a row of chips, not a scanner wave).

## 2. Fine Line, the default look

Identity: a light, airy science-magazine plate that moves. Porcelain ground, one Prussian ink, one vermilion; the
story is told by line drawing and shape morphing; the premium feel comes from easing, physical response and restraint.

Tokens (template `style.css`):
```css
:root {
  --paper: #F2F2EE;   /* porcelain ground, under the painted paper */
  --ink: #1A2433;     /* Prussian ink: drawing, history, axes */
  --ink-soft: rgba(26, 36, 51, .64);
  --verm: #E4472B;    /* vermilion: now, the fresh event, the one detail; never without a meaning */
  --cap: #3B4453;     /* caption ink, lighter than drawing ink so captions sit behind the show */
  --graphite: #6B727C;/* what the story sets aside: a superseded equation, a reading head, source tags */
  --ghost: #8A919B;   /* dotted ghosts (at least 40 percent or they vanish on a phone) */
}
```
- Painted paper (K.paint): radial window light upper centre (#FBFAF7 to #F3F3EF to #E7E7E2), static seeded grain of
  plus or minus 3.5 code values, 70 faint fibres at 2.5 percent ink. Never animated.
- Type: Instrument Serif italic for the few stage labels (52 px), roman for numerals, the one equation set properly
  (MathJax, about 156 px when it is the moment). Instrument Serif numerals beat tracked mono numerals (three type voices
  per frame read as clutter). Mono only for things that are literally code or settings. Geist Variable for captions,
  badges and tags: one sans and one serif per frame. Fonts are OFL from npm, loaded locally; no system fonts.
- Captions: bottom centre, one line, Geist 420 at 48 px, `--cap` ink, letter-spacing -0.004em, top 946 px; words rise
  9 px on a 300/26 spring with a 22 ms stagger, the line fades out in 0.15 s; up on the first film frame with no fade, shifted with any
  approved cover offset (process.md). The band y 900
  to 1044 belongs to captions only (capband.mjs proves it). A line wider than the caption box (`caption_box_px` in
  timing.config.json, 1,460 px, measured at 48 px) is split by timing.py into consecutive single-line sub-captions at a
  sentence break; never two lines at once.
- Badges and source tags (disclosure without clutter): a lowercase pill top right (`illustration` for computed numbers,
  `schematic` for drawn shapes, `scenario` for a made-up example), Geist 30 px; a source tag top left in graphite,
  author and year in plain words, at most four words plus `preprint`. Both ride on their sheet's chrome layer, ignore
  the camera, and are visible exactly while their plot is. At 30 px they are about 6 px on a phone, so say the
  disclosure aloud once too, or make it legible on screen in a no-voice film.
- Pen lines: every line is a filled outline whose width follows pen pressure (ramps in, tapers out) with a whisper of
  wobble, so nothing looks plotted. Primary strokes 4.5 to 6.5 px. Draws run quart-out ([0.25, 1, 0.5, 1]) in 0.35 to
  0.5 s; retractions in-out cubic 0.45 s staggered 60 ms, outer to inner.
- Vocabulary: ink weight = strength (fading is thinning, never vanishing); dotted ghost = ignored, not deleted; dashed
  line = the naive recipe wherever it appears; the editor's loop (tilted, open, 1.16 turns) = "pick this", never
  concentric; onion skins only while valid; abstract chat = rounded bubbles of grey bars, no real text, no app chrome.
  Encodings must not contradict the data the moment they are taught (a bigger ring cannot mean "older" in one shot
  and "newer" in the next).
- Composition: no head bands or rules; at most two subjects plus their labels; camera centre a little above frame
  centre (930 to 960, 430 to 470) because the caption takes the bottom; chrome 110 px from the sides, 60 to 68 px from
  the top; keep drawing out of the caption band and the chrome corners.
- Camera: slow pushes on in-out sine across a whole beat (a few percent), a return to 1.0 for plots, a gentle pull
  back at the close. Never scale large text.
- Sound character (works muted): paper and glass, quiet. Felt-mallet pluck when something lands, dry wooden ticks for
  rhythms, a short downward pen-scratch whoosh for a sheet slide, a soft two-note swell for reveals, an optional
  open-fifth bed. No risers, booms or glitches. Speech at -16 LUFS.

## 3. Galley Proof, for code and text stories

Identity: one proof sheet on warm paper; the draft is set like a book page; what the program recorded and what people
did appear as a copy editor's marks, with notes in the margin level with their line. Precise and credible; its cost is
text density, so cut words hard.

```css
:root {
  --paper: #F3EEE5; --ink: #1C1915; --ink-2: #554E45; --ink-3: #8C8376; --rule: #BDB3A2; --hair: #D8CFC0;
  --red: #A63A1F;  --red-tint: #EDD5C9;   /* the program's record, a mismatch */
  --blue: #28588A; --blue-tint: #D6E0EA;  /* a person */
  --same: #AFA697;                         /* underline under text that matches the other side */
}
```
- Static paper grain (fractal noise, multiply, about 4 percent). No green, gradients, shadows, blur, glow, rounded
  panels or cards; the only rounded shapes are marks. Faces: Newsreader Variable, Geist, Geist Mono. Hand-set every
  line, measure real widths after `document.fonts.load` (measuring a fallback serif came out 7 percent narrow).
- Zones at 1920x1080: head band 128,40 to 1792,116; stage 128,148 to 1320,860; margin 1384,148 to 1792,860; caption
  128,908 to 1792,1040. Zones never overlap, mid-transition included; marks may bleed 12 px into empty margin.
- Marks at font size s, baseline b: tint under text from b - 0.80s to b + 0.26s, rx 4; same-underline 5 px (3 px
  vanished on a phone) at b + 0.31s; circle glyph extent plus 10 px, stroke 3.5 red; no strike line anywhere; nothing
  opaque over glyphs; minimum stroke 3 px. The story must survive if every stroke disappears at phone scale.
- Motion: translations only (8 px rises, whole-document glides); nothing bounces, scales, rotates, blurs or slides in
  from off-frame. "Mark, then set": the mark draws first and holds 0.15 s, then the type responds. A new page: a
  hairline draws across the stage, old lines lift out in reading order, new lines set; never two scales at once.
- Red is the program's record, blue is a person; a person's fix is never red (on a phone the red mark lands on the fix
  and reads as the bug). A red tint and a blue tint never sit under the same glyphs.

## 4. Sizes: 1920x1080 against a 390 px phone

A 16:9 video in a phone feed is about 390 pt wide, a scale of about 0.2.

| Element | At 1080p | On the phone | Verdict |
|---|---|---|---|
| Hook sentence | 96 to 104 px | 19 to 21 px | reads at a glance |
| Figures a muted viewer needs | 64 px or more | 13 px | reads |
| Key stage text | 56 px minimum | 11 px | reads paused, carried by colour while playing |
| Anything that carries the argument | 40 px minimum | 8 px | the floor |
| Captions | 48 to 50 px | 10 px | readable; hooks for a phone-first brief may go to 64 px |
| Labels, badges, tags | 30 px minimum | 6 px | for people who pause |
| 28 px text | 28 px | 5.7 px | decoration only |
| Primary strokes | 4.5 to 6.5 px | about 1 px | must never carry a beat alone |

- The story must survive with every stroke gone: shapes, tints, colour blocks, big numbers and the caption carry it.
- Make a mark's phone read a shape, not a detail (travelling points at r 9 or more); faint is invisible (raise
  waiting digits to 55 percent, tints to 50 percent); dense small multiples become texture.
- The punchline itself must be large: push the camera into the payoff instead of drawing it small.
- Every UI demo needs a push where the reacting part fills at least 40 percent of the frame width.
- 1:1 cuts are re-laid out, not cropped. Check frames 0, 0.5 and 1.0 s in every format.
- Test with real frames: `ffmpeg -ss <t> -i final.mp4 -frames:v 1 -vf scale=390:-1 out.png`, or a whole phone sheet:
  `review_sheets.py at out/final.mp4 out/phone.png --times 0,0.5,1,6,12 --tile 390`.

## 5. Rejected looks and moves, and what replaced them

| Rejected | Why | Replacement |
|---|---|---|
| Dark starfield, anamorphic flash | astronomy, screensaver, AI flavour | porcelain page, pen rings |
| Ripples on dark water | meditation app | the same light page |
| Shader cross-warp transitions | text liquefies, reads as an AI morph | plain sheet slide |
| Icons (newspaper, envelope, speaker, chat dots) | clip-art legend | one-word label beside the object |
| Ring on a stick | reads as a radio mast | light column with a crisp top |
| Jittered pseudo-measurements | fake data | smooth schematic curve with a badge |
| Labels restating the caption | read twice | no words besides the caption |
| Two-line captions under figures | textbook plate | single-line sub-captions |
| Concentric "lens" for a recipe | reads as one more ring | graphite reading head |
| Scanner wave | reads as a scanner | jaws that squeeze |
| Closing timetable of 22 numbers | broke word spacing, tiny | one signature image on one time scale |
| Cards, dashed boxes, rounded panels | upload area, UI card | rules, hairlines, columns |
| Skeleton chips before data arrives | loader UI, invented state | a genuinely blank lane |
| Rewind of an edit | marker moves backwards | re-set with a plain label |
| A person's fix on red | reads as the bug | blue, settling to ink |
| Scale on large text | raster noise, a zoom feel | translate and opacity only |
| Ghost copies flying back | doubled text | land exactly and swap in one frame, or fade where resting |
| Blurred readable UI | looks like a render bug | crisp; focus by framing and light |
| Counter jumping 00:01 to 34:17 | looks fake | a monotonic roll or a cut-away |
| Tab hopping in UI films | messy | one continuous eased scroll |
| Empty frame 0, fade in from nothing | weak thumbnail | a composed poster at t = 0 |
| Grey scrims and tap discs | tutorial grammar | the UI reacts on its own |

## 6. Making a new look

1. Write the brief's look in terms of the medium (diagrams, curves, real formulas, ink lines, paper), never in terms
   of effects. "Premium, light, depth, bloom" in a brief produced starfields and glowing water.
2. After story approval, render two or three still style frames in different directions using the same beat. Show
   them side by side, labelled A, B, C, with a one-line recommendation; stop for the owner's choice or comments.
   Refine the chosen look and obtain approval. Save animation for the 5 to 8 s hardest-beat checkpoint in process.md.
   Judges are for legibility, truth and craft defects; they once ranked last the look the owner chose.
3. Write the look as tokens in CSS custom properties (ground, one ink, one accent with one meaning, a set-aside grey,
   caption ink), one serif and one sans, a caption spec, a badge spec, and a mark grammar: what each colour, line style
   and shape means. Reviewers check every new mark against this grammar.
4. Check every effect for determinism before liking it: no masks or group opacity on fading content, no blur on text,
   no always-moving background layers, no full-frame shaders. Run determinism.mjs on a style frame.
5. Check the style frames at 390 px and muted; check that light grounds and fine lines survive an encode at the
   delivery bitrate.
6. Keep the default look unless the story needs another; a new look for its own sake is not a reason.
