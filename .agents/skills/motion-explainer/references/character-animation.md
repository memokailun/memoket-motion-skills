# Character animation

Read before designing, rigging or animating an animal, and again before reviewing a character cut. These lessons came
from a cat playing with interactive machines on a web page. A clean silhouette at one pose does not prove a working
rig. The animal must stay connected, readable and alive between poses too.

Contents
1. One connected animal
2. Occlusion and line hygiene
3. Parts never pop
4. Personality and pace
5. Eyes and thought
6. Per-frame probes the project must build

For character options and refinement approvals, read [Process](process.md), section 4. For continuous editing,
platform covers and late changes, use that file's editing and delivery rules. For proof that a check catches a real
fault and for review of the delivered encode, read [QA and review](qa-and-review.md), section 5.

## 1. One connected animal

Why: independently moved shapes made the head float, limbs detach and the torso stretch into a tube. A shared parent
transform alone does not make the drawing anatomically connected.

Fix:
- Define one named body root and an attachment graph: head to neck to shoulders to torso; limbs and tail to their
  actual body roots. Pin the head to the neck, with a shoulder shape covering the junction in every pose.
- Give each junction real filled overlap, including the limb and tail roots. Overlap must survive rotation and
  rasterization; do not rely on two edges merely touching. Draw the front fill over the hidden joint outline.
- Store rest lengths per limb segment. Limit stretch to about 1.15 times rest length, measured along the rig segment
  before camera scale, including the frames between poses. Bend or move the body when a target is out of reach.
- Keep a broad torso with the approved proportions. Do not stretch the torso into a tube to bridge distant poses.
  Record allowed torso length, width and aspect ranges from the approved design, then measure them on every frame.
- Rasterize each part separately on every film frame, before other parts cover it. Test the declared attachment
  overlaps and the connected union of the filled anatomy. Fail on a gap, detached part or open junction; then check
  the real composite for visible seams. A fully hidden limb may disappear from the composite, but its anatomy must
  still join the body in the isolated masks. An accidental paw-to-face overlap cannot replace its shoulder joint.

## 2. Occlusion and line hygiene

Why: a forearm across the chin, a paw near the face or a tail over a leg can fuse into one ambiguous shape. Rear
outlines, markings and whiskers showing through a front part make the depth wrong. Even separate outlines read as
one when they approach at a shallow angle, under about 35 degrees.

Fix:
- Give each overlap an explicit front and back order. Paint the back part and its details first, then the front
  part's opaque fill, then its exposed outline and details. The front fill must hide the back outline, markings and
  whiskers. Never redraw all whiskers or all outlines above the whole animal.
- Keep the two visible outlines distinct. Cover the hidden portion, change the pose or increase the separation;
  do not stack outlines into a heavy seam. A leg line must end at a real joint, disappear under an occluding fill,
  or continue into its own shape. It must not stop in mid air beside the face.
- Test outline pairs within a recorded clearance based on the stroke width, not only pairs that intersect. Measure
  local tangent angles at their nearest approach; flag angles under about 35 degrees even when there is a small
  gap. Use the actual rejected frame to set the clearance so this check catches the perceived fusion.
- Add automatic checks for rear ink leaking through front fills, merged or near-tangent outlines, and floating
  anatomical line endings. Give outlines and details part ids so the probe knows which layer owns each pixel. Test
  the painted composite as well as the rig paths; path coordinates alone do not prove the occlusion worked.
- Prove every new check fails on the exact frame the user complained about before trusting a corrected pass. Keep
  that frame and its source as a regression fixture; use adjacent frames too for a temporal fault. The required
  failing-then-passing evidence is in [QA and review](qa-and-review.md), section 5.

Diagnostic raster masks are separate QA outputs, not SVG masks added to the delivered scene. Keep the engine's
determinism rules for scene paint and verify the actual layering after every pose or draw-order change.

## 3. Parts never pop

Why: a tail that vanishes when the cat lies down reads as a missing part, even if the next still looks plausible.
Switching a part off when its pose changes hides a rig problem instead of animating the action.

Fix:
- Keep every part in the rig. A tail or limb going behind the body slides behind it over several frames; it does not
  jump from fully visible to hidden between adjacent frames. Animate the occlusion edge, not a visibility toggle.
- On every frame measure each part's full isolated area and its visible area after the real draw order and viewport
  clipping. Compare both areas, their ratio and their movement with the previous frame; flag abrupt losses, gains
  and one-frame disappearances or reappearances. Account for camera scale and pose changes in the full-area baseline.
- Record the expected occluder and entry/exit window. Check that the lost area is actually covered by that occluder
  or leaves the viewport continuously. A flag is not cleared merely by labelling it "behind body".
- Set area-change tolerances against known good motion and the real bad adjacent frames. Antialiasing and a small
  last sliver need a measured tolerance; they do not justify exempting a whole pose transition.

## 4. Personality and pace

Why: a lazy, curious cat reads more clearly and animates more cleanly than a hyperactive one. Fast travel makes
contacts and transitions difficult and looks strange beside a calm web page.

Fix:
- Let the cat notice, consider, reach and rest. Show curiosity with the eyes, ears, whiskers and a head tilt before
  moving its body. Let the machine's response carry the larger motion.
- Cap the visible character's root travel on every adjacent frame. Start at 6 px per frame at 1920x1080 and 30 fps;
  for a uniformly scaled 1080-high reference use `limit = 6 * (outputHeight / 1080) * (30 / outputFps)`. Record the
  actual limit and peak in notes/build.md. Do not use the larger sheet-slide or UI travel caps for an animal.
- Measure a named rig root, not a changing bounding-box centre. Log its scene-space displacement and its projected
  screen displacement so camera moves cannot hide a lurch. Include every visible frame pair in the cap check.
- To relocate the cat, let a planned camera move take it fully off screen, relocate while every part is outside the
  viewport, then reveal it in a coherent pose. Prove the invisible interval; never teleport across visible frames.
- Use eased or spring motion with deliberate acceleration and settles. No linear tweens for character travel,
  limbs, facial motion or breathing. A linear interpolation helper inside a sampled curved trajectory does not
  make the intended motion linear, but inspect its frame velocities to prove the result.

## 5. Eyes and thought

Why: identical pupil offsets make the cat look unfocused, while slowly gliding pupils feel mechanical. A frozen
body with constantly moving eyes has activity but no thought.

Fix:
- Give both eyes one real target point on the machine or page. Compute each pupil's aim from its own eye centre in
  the same coordinate space, with correct parallax for the head angle and target distance; do not copy one pupil's
  offset to the other. Keep pupils inside their lids and reproject after a camera or head change.
- Eyes lead the head by 2 to 4 frames at 30 fps, with the same short lead in seconds at other frame rates. Use small,
  quick saccades followed by a settle on the target; never glide the pupils continuously across a hold.
- Tie blinks to thought changes: noticing, deciding, reacting or relaxing. Shape mood with lids and brows instead of
  random blinking or large root moves. Ears, whiskers and head tilt support that same thought.
- Keep gentle breathing during every character hold. Move the chest and attached anatomy together without opening
  a joint or stretching the torso. Design the breath into scene time; an inserted frozen-frame voice hold would
  stop it. Use the timing sheet to avoid such holds.

## 6. Per-frame probes the project must build

The bundled scripts do not implement this character anatomy suite. Implement project-specific probes beside the
film, validate them on real faults, and record their commands and evidence. `speed_audit.mjs` tracks box centres and
sizes; it supplements, but does not replace, the named-root check.

For every output frame, including intermediate poses and the opening and close:
1. Map the output frame and presentation time through any cover offset or time warp to the correct scene state.
   Export root, camera, joints, rest-length ratios, target point, pupil directions, part ids and draw order.
2. Rasterize separate fill, outline and detail masks per part at the delivery scale. Keep unoccluded masks for
   connectivity and post-occlusion masks for visible-area and line tests; do not confuse a valid hidden part with a
   detached one. Also capture the normal composite with the exact delivery paint order.
3. Fail on broken attachments, visible seams, excessive limb stretch, torso deformation, rear ink leakage, fused or
   near-tangent outlines, floating line ends, part-area pops and root-speed violations. Log the frame number, time,
   part ids, measurement, threshold and a crop for each failure. Set and record thresholds from the approved rig and
   observed good and bad frames, not after the fact to make the failing cut pass.
4. Check gaze against its shared target and review eye/head timing, blinks, breath and expression in the rendered
   sample. Numeric alignment cannot judge whether the thought reads.
5. Re-run the suite after every pose, camera, timing or layering change. A partial run is not a whole-film pass.
   Report total frames tested and total frames expected, then review every decoded frame of the actual delivered
   file using [QA and review](qa-and-review.md), section 5.
