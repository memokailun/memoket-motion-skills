# Motion engine (npm "motion", our renderer)

Read before writing or changing scene code for the Motion engine. The template's `js/core.js` implements everything
here; this file explains why each piece exists, so you do not remove one. Verified on motion 14.1.0 in headless Chrome;
run `scripts/motion_probe.mjs` before any upgrade.

Contents
1. Why this engine
2. The five determinism rules
3. Sequence semantics you must know
4. SVG, text and raster rules
5. How springs should feel
6. Speed caps: not everything is a spring
7. Physics-driven timing
8. Helper API (K namespace) and patterns
9. Sheets, beats and camera
10. Lift-out copies (UI films)
11. Determinism bug register
12. Verification

## 1. Why this engine

In two finished two-engine comparisons (the same storyboard built with HyperFrames and with Motion), the Motion build
was preferred; one product film shipped its HyperFrames version. With time for two versions, build Motion first. What
reads as premium is spring physics: things land, settle and react like objects, where eased curves look keyframed.
The engine keeps that feel while every frame stays a pure function of t, so a frame-by-frame renderer produces the
same film every time.

## 2. The five determinism rules

1. Pin Motion exactly (`"motion": "14.1.0"`), load the global build with a script tag and use `window.Motion`.
2. Hide WAAPI before the first animation:
   ```js
   M.MotionGlobalConfig.useManualTiming = true
   try { delete Element.prototype.animate } catch (e) {}
   ```
   Motion hands opacity, transform, filter, clipPath and backgroundColor to the browser's animation engine, on
   compositor layers whose promotion depends on seek history (labels differed by up to 8 code values between seek
   orders). Motion checks for WAAPI once, lazily, and memoizes the answer, so the delete must run before any
   `animate()`. Proof: `document.getAnimations().length === 0` (render.mjs --warnings-only prints it).
3. Everything paused; seek sets `.time` on every registered animation, then flushes Motion's frame steps
   synchronously (two passes, so work scheduled in the first, such as pathLength attributes, also lands). Without the
   flush, a screenshot right after seek shows the previous frame. Cost: about 1 to 1.5 ms per seek for 1,000 segments.
4. Render hooks only turn Motion values into geometry, and write their full state on every frame of their beat, even
   "nothing" (`'M0 0'`). A hook that wrote only after a start time kept stale points after a later seek.
5. One owner per value. Every subject and property has exactly one track (K.tw warns on overlaps; a final has 0
   warnings). Secondary motion (pulses, pings) is a separate motion value added in a render hook:
   `r = baseR * (1 + 0.08 * (att.get() + pulse.get()))`. When Motion owns an element's `transform` (x, y), a hook
   that must also move it writes the separate CSS `translate` property on a parent wrapper, never `transform`.

## 3. Sequence semantics you must know

- A value's segments merge into one track and gaps interpolate. If a later segment restates a different `from`, the
  value glides from the previous end to that `from` across the whole gap (a ring sat at 1.6x scale for 16 s between
  two pulses). K.tw remembers each property's last keyframe; a bare target continues from it, so gaps stay flat.
  Consequence: build order must equal time order per value.
- Overlapping segments silently erase keyframes: a new segment deletes every existing keyframe of that value inside
  its time range. Hence the overlap warning.
- Before its first segment a value already shows that segment's `from` (Motion duplicates the first keyframe at 0):
  the first segment's `from` IS the opening state. A step registered at t = 0 still shows the old value on frame 0;
  for "on from frame 0" write `[1, 1]` at 0.
- Springs inside a sequence become easing curves scaled by the move's distance:
  - a zero-delta spring gives NaN (K.tw turns a spring between equal numbers into a 10 ms hold);
  - a velocity-only spring (0 to 0 with a velocity) never moves inside a sequence, so kicks are standalone
    animations registered at their start time (`K.kick(at, { velocity: 16, stiffness: 270, damping: 9 })`);
  - durations depend on the delta; K.tw uses rest thresholds relative to the distance so ends are exact.
- Physics keys override bounce: any of stiffness, damping or mass makes Motion ignore `bounce` and `visualDuration`.
  A helper that always added `mass: 1` turned every "bounce 0" spring into stiffness 100, damping 10: 16 percent
  overshoot on data. Give a spring either `{ stiffness, damping }` or `{ bounce, visualDuration }`, never a mix
  (K.tw warns).
- Spring tails snap at rest: default thresholds (0.5 units) ended springs early and snapped the last 0.3 to 0.8 px in
  one frame. Thresholds at 0.05 percent of the distance leave 0.13 to 0.20 px (K.REST).
- Cuts are true steps: a "cut" made as a 10 ms linear tween put any frame landing inside it at an in-between value (a
  half-cleared field over a 67 percent placeholder). Use `K.cut(el, { opacity: [0, 1] }, at)` (ease `p > 0 ? 1 : 0`).

## 4. SVG, text and raster rules

- SVG opacity through the attribute: `attrOpacity`, `attrR`, `attrCx`, `attrStdDeviation`. Plain `opacity` on an SVG
  element writes CSS style; render hooks write attributes; CSS beats the attribute, so mixing channels makes one
  silently win. K.tw can read a bare target's start from an attribute, never from CSS.
- Morphs: do them in a render hook from a 0 to 1 motion value and two point lists resampled to the same count, start
  point and direction (arc-length resampled, 72 points), not by animating `d`.
- pathLength drawing: Motion writes dasharray `L (1 - L)`, so a round cap paints a dot at the path's end; K.tw pins
  `pathSpacing: 1`. A pathLength of 0 with round caps paints a dot at the start: pair every draw-in and retraction
  with an opacity change: `K.tw(line, { pathLength: [0, 1], attrOpacity: [0, 0.9] }, { at, duration: 0.34, ease: K.PEN })`.
- To make a drawing tip ride a clock (head at x(t)), pass an ease that maps time to arc-length fraction, or rebuild
  the partial path in a render hook (the template does this for its curve).
- Text never scales: scale springs on 210 px glyphs gave single-code-value differences through Chrome's glyph cache.
  Text moves by translation and opacity only; scale is for shapes. Large, rotating or curve-riding text becomes a
  bitmap drawn once at 2x to 4x on a canvas and moved by whole pixels.
- Text fades through its colour's alpha with opacity held at 1 (K.tw rewrites opacity on `.lab` elements); fractional
  element opacity rastered glyphs one code value apart depending on the frame before.
- Moving HTML text lands on whole pixels: a word sliding at a fractional translate differed by up to 224 code values on
  48 px between seek orders with identical DOM. K.seek rounds the translate of every element Motion moves; round your
  own text offsets in hooks too; centre labels by measured width, not by a -50 percent translate.
- No SVG masks and no group opacity on content that fades: they made PNGs differ by up to 42 code values between seek
  orders with identical DOM. Paint each colour with one `userSpaceOnUse` gradient whose stops carry the fade, rewritten
  per frame. A layer that must vanish uses `display: none`, never `visibility: hidden` over a mask or blend (stale
  fragments after a jump). A static mask that passes the determinism check may stay; prove it.
- MathJax formulas (scripts/tex2svg.mjs): split the SVG into its top-level parts, each in its own group, fade with
  `fill-opacity`, never group opacity.
- Outlines that fold or sit behind cards are filled rings (outer shape minus inner, `fill-rule: evenodd`), not
  strokes.
- Inline SVG icons copied several times keep their ids; `url(#clip0)` then resolves to the first copy, and copies
  render blank when that one is hidden. Rename ids per copy and rewrite every `url(#id)` and href.
- The render server serves webp, gif and wasm; check any other asset type renders before relying on it.

## 5. How springs should feel

The rule: no overshoot on anything that carries data or a position on a plot. A value that overshoots briefly shows a
number nobody measured.

By damping ratio z (every spring below has mass 1; written stiffness/damping, ratio in brackets):

| z | Overshoot | Use | Shipped examples |
|---|---|---|---|
| 1 | none | data, plot positions, needles, bars, formula parts: `{ type: 'spring', bounce: 0, visualDuration: 0.3 to 0.6 }` | columns, crossing markers, data dots |
| 0.65 to 1 | under about 7 percent | soft settles, text, UI moves | a fold 62/12.5 (0.79), caption words 300/26 (0.75); UI lift 420/30 (0.73), travel 190/20 (0.73), settle 240/30 (0.97), camera 70/17 (1.0), sheet 260/30 (0.93) |
| 0.5 to about 0.65 | about 7 to 16 percent | decorative pops and small physical moves (the reviews' cap for pops: 15 percent overshoot or less) | markers 420/23 (0.56), cores 300/19 (0.55), glyphs 330/20 (0.55), ticks 500/23 (0.51), a bubble 220/15 (0.51), labels in 260/20 (0.62), a card opening 230/19 (0.63), UI pop 300/22 (0.64) |
| below 0.5 | over 16 percent | physical events only | ripple pings (kicks 270/9, 0.27), a drop's pool 227/11.5 (0.38), a pin 330/15 (0.41); at the 0.5 edge: a card landing 170/13, chips cracking 200/14 |

Labels come in with opacity 0.35 s easeOut plus y 16 to 0 on 260/20 (K.labIn); caption words rise y 9 to 0 on 300/26
with a 22 ms stagger (K.captions).

Damping ratio z = damping / (2 sqrt(stiffness x mass)); overshoot = exp(-z pi / sqrt(1 - z^2)) for z below 1 (z 0.5
gives 16 percent, 0.65 gives 7, 0.8 gives 1.5); in Motion, bounce b gives z = 1 - b. Product films: overshoot budget
about 3 percent; `back.out(1.7)` reads playful.

## 6. Speed caps: not everything is a spring

Measure speed per frame for every big move (scripts/speed_audit.mjs) and write it in the build notes.
- Sheet slides: a critically damped spring (130/22.8) whipped at 267 px per frame then crept for 0.4 s. Use an in-out
  sine over 0.9 s for a 1,920 px slide: it starts moving at once and peaks near 112 px per frame (peak = pi/2 times the
  average speed). An in-out cubic peaks at 3 times the average, about 213 px per frame over 0.9 s, close to the whip
  it replaced; if you want the cubic's shape, give it about 1.8 s. The edge shadow fades over the last 100 px; the
  whoosh (0.45 s) is centred on peak speed (`t0 + SLIDE / 2 - 0.225`).
- Reading scrolls strobed at 166 px per frame. Eased tweens whose length comes from the distance:
  `dur = Math.max(0.6, (Math.PI / 2) * distancePx / 1500)` keeps inOutSine at about 50 px per frame. A continuous
  glide through reading stops beats stop-and-go.
- Long travels: keep big cards under about 110 to 120 px per frame (softer springs, or a short fade-in with a rise).
- Lifts, travels and settles stay on springs; scrolls, slides and camera trucks are eased tweens.

## 7. Physics-driven timing

- Per-point springs as functions: `K.springFn(o)` samples a spring by seconds; ropes and pours run the same spring per
  point, delayed along the curve; flights use progress on a bounce-0 spring with a bow `-bow * sin(pi * go)`.
- Solve a spring for its landing time and put the next event and the sound there:
  ```js
  const f = K.springFn({ bounce: 0, visualDuration: 0.5 })
  let lo = 0, hi = 3; for (let q = 0; q < 40; q++) { const md = (lo + hi) / 2; if (f(md) < 0.96) lo = md; else hi = md }
  K.cue(t0 + hi, 'tick', { gain: -4 })
  ```
- Cause before effect, computed from the same functions that draw the cause: a falling bead whose ease is its gravity
  curve lands at speed on its frame; a reading head's crossing time per ring is bisected from its ease, and each ring
  retracts exactly when crossed.
- Crowded hand-offs: simulate the schedule offline with the same springs, then measure per frame (nearest pass, no
  slow point over text).

## 8. Helper API (K namespace) and patterns

| Group | Helpers |
|---|---|
| Math | `K.clamp`, `K.lerp`, `K.sm` (smoothstep), `K.rng(seed)`, `K.f2`, `K.pathOf(points)` |
| Eases | `K.E.outCubic / outQuart / inOutCubic / inOutSine / inQuad / outQuad / expOut(span, tau)`, `K.PEN` quart-out pen, `K.STEP` |
| Engine | `K.mv`, `K.nv(name, v)`, `K.tw(subject, props, { at, ... })`, `K.cut`, `K.at`, `K.reg`, `K.kick`, `K.springFn`, `K.springDur`, `K.onRender`, `K.build`, `K.seek`, `K.WARN`, `K.REST` |
| SVG and HTML | `K.S(tag, attrs, parent)`, `K.set`, `K.el(tag, cls, parent, text)` |
| Pen geometry | `K.penStroke(points, w, u0, u1, taper)`, `K.penRing(...)`, `K.penLoop(...)` (the editor's loop: "pick this", never concentric) |
| Layout | `K.beat(t0, t1, name, svgParent, htmlParent)`, `K.beatRender`, `K.label(host, text, x, yc, { size, cls, align })`, `K.labIn`, `K.labOut`, `K.chrome`, `K.show(el, t0, t1)` |
| Timing sheet | `K.captions(T, host)` returns window.CAPTIONS; `K.word(T, id, word, nth)` scene time of a spoken word |
| Look | `K.paint(canvas, seed)` painted paper; `K.C` colour tokens read from CSS |
| Cues | `K.cue(t, type, extra)`; gains are relative to each synth type's own level |

Patterns to add when a film needs them (not in the template; write them in the same style):
- Bitmap glyphs for big, rotating or curve-riding text: draw the text once on a canvas at 2x to 4x, place it as an SVG
  `<image>` (or a canvas) and move it by whole pixels.
- Matched outlines for morphs: resample both outlines to the same point count (72 is plenty), the same start point and
  the same direction by arc length, then lerp the point lists in a render hook from one 0 to 1 motion value.
- Accordion fold without CSS 3D: each panel's content takes `matrix(1 0 0 cos(theta) 0 ya - ya * cos(theta))`;
  panels are trapezoids (mountain creases slightly wider) with a flat shade per panel.
- MathJax parts: split the typeset SVG into its top-level groups and build them one by one (`fill-opacity` fades).
- HTML groups that ride SVG geometry: each frame, place the HTML layer from the SVG element's screen matrix, rounded
  to whole pixels.
- Modular builds by several people or agents (one per chapter): an ownership window per chapter (segments outside go to
  K.WARN), shared values (camera, device) changed only through kit helpers and at rest by the window end, a spine that
  checks every shared value at each boundary, and a monotonic time warp applied to segment start times so a chapter can
  gain holds without rewriting its beats. Each chapter must add 0 warnings.

## 9. Sheets, beats and camera

- Within an act nothing cuts; things morph. Between acts a fresh sheet slides over the old one (three or four times
  per film): a `<g>` with an edge shadow (30 px gradient of ink at 0, 0.035, 0.13), the painted paper as an image, and
  a camera group; an HTML label layer and a chrome layer (badges, tags) with the same transform.
  ```js
  K.tw(a.sx, [1920, 0], { at: t0, duration: 0.9, ease: K.E.inOutSine })         // peak about 112 px per frame
  K.cue(t0 + 0.9 / 2 - 0.225, 'whoosh', { dur: 0.45, dir: 'down', gain: -11, pan: 0.4 })
  // render hook: shadow opacity = clamp((sx - 40) / 60); old act's labels clipped at the incoming edge; anything
  // wholly under the incoming sheet is hidden, not just clipped (a clipped badge overlapped the next one)
  ```
- Chrome rides with its sheet but ignores the camera; it is covered together with its plot.
- Beats are groups shown only inside their window (`display: none` outside), so a stale state is never visible.
- Camera: one motion value per axis on the act's camera group; slow pushes on inOutSine across a whole beat (a few
  percent), a bounce-0 spring to return. Rest the camera 0.25 to 0.45 s away from any UI change next to it. Keep large
  text on sheets without camera moves (camera scale on text is fractional).
- Idle life without fuss: two motion values on alternating keyframe lists, 2.5 percent of radius, phase-shifted
  between objects; never an always-moving layer under the whole frame (it also makes every voice hold impossible).

## 10. Lift-out copies (UI films)

An audit of a product film found 11 fly-back ghosts that read as rendering bugs (doubled text, "4" reading as "44",
two close buttons). One rule fixes all of them: a copy and its source are never both visible.
- `lift` hides the source on the lift's first frame and pins the copy to the source's live rect at scale 1, laid out
  at zoom 1 (the same raster). Bump, shadow and backing start one frame later.
- Every lift ends in exactly one of: `land` (an eased glide, no bounce, onto the source's getBoundingClientRect() read
  in that same frame, held 2 frames, then a single-frame swap: copy off and source on, never a cross-fade),
  `fadeAtRest` (it fades where it rests and never travels back), or leaving with the device.
- The pop render hook runs last. Build-time guards warn when a land would cross the bezel.
- Verify with a ghost check that seeks every frame and compares each visible copy with its source (0 overlap frames,
  swap delta under 0.25 device px). Related: two texts that swap never share a frame; devices and panels move fully
  opaque; a slot is empty while its copy is out; dealt cards start opaque behind the device.

## 11. Determinism bug register

| Symptom | Size | Fix |
|---|---|---|
| Labels differ by seek order | up to 8 code values | hide WAAPI before the first animation |
| Dot at the end of drawn paths | visible | `pathSpacing: 1` |
| Dot at the start when pathLength is 0 | visible | pair draws with opacity |
| NaN from a zero-delta spring | NaN | 10 ms hold instead |
| Stale geometry after a later seek | wrong beat's points | hooks write every frame |
| Large glyphs differ under scale springs | 1 code value | text moves only by translation and opacity |
| "bounce 0" springs overshoot | 16 percent | mass only for physics springs |
| Column and badge differ by seek order | up to 42 code values | no masks, no group opacity; gradient paint |
| Broken glyph in one seek order | 188 code values | run checks alone on an idle machine |
| Text one value apart after opacity fades | 1 code value | fade text through colour alpha |
| Sliding word differs by seek order | 224 code values | whole-pixel translate for moving HTML text |
| One-frame in-between values at cuts | 67 percent states | true step ease |
| Last 0.3 to 0.8 px snapped in one frame | sub-pixel jump | relative rest thresholds |
| Value drifts across a 16 s gap | ring at 1.6x | never restate a different `from` |
| Masked or blended layer leaves fragments | 3 x 8 px | hide with `display: none` |
| Render workers never ready | render failed | `decoding = 'sync'`, no `img.decode()` |
| Icon copies render blank | missing glyphs | unique SVG ids per copy |
| Sharpness jump at a worker join | edges up to 46 | finals in one tab or chunks |

Accepted residuals: 1 to 3 code values in soft shadows across tabs, single values in large glyphs at fine steps.

## 12. Verification

- `render.mjs --warnings-only`: 0 engine warnings, 0 browser animations.
- `determinism.mjs`: 1 s steps for the whole film, 0.25 s through changed windows, 0.73 s to catch periodic effects.
  PNG mismatch with identical DOM state means Chrome raster; find the cause by stripping one suspect (masks, group
  opacity, camera) after every seek in a throwaway copy and re-running: the variant that goes identical names it.
- Engine state: segment count, `K.WARN.length === 0`, cue count, `document.getAnimations().length === 0`,
  `typeof window.gsap === 'undefined'` in a Motion build, mean seek time over 200 scattered seeks.
- Data guards in setup; per-frame probes for crowded moves; speed audit for every big move; ghost check for copies.
