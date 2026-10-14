/* HyperFrames composition: the same demo beat as the Motion template ("Every hour, half of what's left decays").
 *
 * One paused GSAP root timeline, registered in index.html as window.__timelines.main. The renderer SEEKS it with events
 * suppressed, probes the end first, and parallel workers start after a backward jump, so every value must be a pure
 * function of t AND independent of what was seeked before. Rules this file follows (references/hyperframes.md):
 *   - every value is a fromTo at an absolute time through tw(): no to(), no set() on the timeline, no callbacks;
 *     the first tween of an element property renders immediately, later ones do not; from and to keys must match
 *   - one track per element and property (overlaps go to window.WARN); concurrent motions live on nested elements
 *   - transform origins are set once, outside the timeline, with smoothOrigin false; force3D false on every tween
 *   - the t = 0 state is the static DOM state; nothing zero-length sits at 0 or exactly on a frame time
 *   - DOM is built once, synchronously; all text exists from the start; nothing reads the clock; one seeded rng
 * Shim for the skill's tools (render.mjs cue dump, plan_vo.mjs, qa_scene.mjs): window.DURATION, window.seek(t) (root
 * totalTime(t, true), as the renderer seeks), window.CAPTIONS, window.CUES, window.WARN, window.__ready after fonts.
 * A setup error is copied to window.__error before it is rethrown, so the tools fail fast with the real message.
 */
try { (function () {
  "use strict";
  const T = window.TIMING;
  if (!T) throw new Error("assets/timing.js missing: run scripts/hf/prepare.mjs");
  const INK = "#1A2433", VERM = "#E4472B";
  const NS = "http://www.w3.org/2000/svg";
  const DUR = T.duration;
  const root = document.getElementById("root");
  // (a cut written by make_cut.mjs sets window.__CUT and its own data-duration; the check applies to the source only)
  if (!window.__CUT && Math.abs(Number(root.dataset.duration) - DUR) > 1e-6) throw new Error(`data-duration ${root.dataset.duration} differs from timing.json ${DUR}: run scripts/hf/prepare.mjs`);

  // ------------------------------------------------------------------ small utils
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, u) => a + (b - a) * u;
  const sm = (a, b, x) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };
  const f2 = (v) => Math.round(v * 100) / 100;
  const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const S = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
  const H = (tag, cls, parent, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; if (parent) parent.appendChild(e); return e; };
  const pathOf = (arr) => (arr.length ? "M" + arr.map((p) => f2(p[0]) + " " + f2(p[1])).join(" L") : "M0 0");
  // a pressure-tapered stroke as a filled outline (static drawings; animated draws use pen() below)
  function penStroke(pts, w, taper = [0.03, 0.92]) {
    const L = [0];
    for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const tot = L[L.length - 1], out = [], inn = [], n = Math.max(4, Math.ceil(tot / 6));
    const at = (s) => { let i = 1; while (i < L.length - 1 && L[i] < s) i++; const u = clamp((s - L[i - 1]) / Math.max(1e-9, L[i] - L[i - 1])); return [lerp(pts[i - 1][0], pts[i][0], u), lerp(pts[i - 1][1], pts[i][1], u), Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0])]; };
    for (let i = 0; i <= n; i++) {
      const u = i / n, [x, y, a] = at(u * tot), press = sm(0, taper[0], u) * (1 - 0.75 * sm(taper[1], 1, u)), hw = (w * (0.3 + 0.7 * press)) / 2;
      out.push([x - Math.sin(a) * hw, y + Math.cos(a) * hw]); inn.push([x + Math.sin(a) * hw, y - Math.cos(a) * hw]);
    }
    return pathOf(out.concat(inn.reverse())) + " Z";
  }
  // scene time of a spoken word from the timing sheet (marks land on words)
  const W = (cid, word, nth = 0) => {
    const c = T.captions.find((x) => x.id === cid); if (!c) throw new Error("no caption " + cid);
    const norm = (s) => s.toLowerCase().replace(/[^a-z0-9']/g, "");
    const ws = (c.words || []).filter((w) => norm(w[0]) === norm(word));
    if (!ws[nth]) throw new Error(`word ${word} not in ${cid}`);
    return ws[nth][1];
  };

  // ------------------------------------------------------------------ timeline helpers
  const tl = gsap.timeline({ paused: true });
  const TRACK = new Map(), WARN = [], ORIGIN = new Map();
  const keysOf = (v) => { const ks = []; for (const k in v) { if (k === "attr") { for (const a in v.attr) ks.push("attr:" + a); } else ks.push(k); } return ks; };
  const pick = (v, keys) => { const o = {}; for (const k of keys) { if (k.startsWith("attr:")) (o.attr = o.attr || {})[k.slice(5)] = v.attr[k.slice(5)]; else o[k] = v[k]; } return o; };
  const nm = (el) => el.id || (el.getAttribute && el.getAttribute("class")) || el.tagName;
  // tw(targets, from, to, at, dur, ease, extra): one fromTo at absolute time `at`, split by first and later properties
  function tw(targets, from, to, at, dur = 0.4, ease = "power2.out", extra = {}) {
    const arr = Array.isArray(targets) ? targets : [targets];
    if (!arr.length) return at;
    const ks = keysOf(from), kt = keysOf(to);
    if (ks.length !== kt.length || ks.some((k) => !kt.includes(k))) throw new Error("from/to keys differ: " + ks + " / " + kt);
    for (const key of ["transformOrigin", "svgOrigin"]) {
      if (!extra[key]) continue;
      for (const el of arr) {        // set once per element, outside the timeline; later tweens must agree
        const o = ORIGIN.get(el), val = key + " " + extra[key];
        if (o === undefined) { gsap.set(el, { [key]: extra[key], smoothOrigin: false }); ORIGIN.set(el, val); }
        else if (o !== val) throw new Error(`${key} changes on ${nm(el)}`);
      }
      extra = Object.assign({}, extra); delete extra[key];
    }
    const stag = typeof extra.stagger === "number" ? extra.stagger : 0;
    const firstKeys = [], laterKeys = [];
    for (const k of ks) {
      const fl = arr.map((el) => !(TRACK.get(el) && TRACK.get(el).has(k)));
      if (fl.some((f) => f !== fl[0])) throw new Error(`mixed firstness for ${k} (${nm(arr[0])})`);
      (fl[0] ? firstKeys : laterKeys).push(k);
      arr.forEach((el, i) => {
        let m = TRACK.get(el); if (!m) TRACK.set(el, (m = new Map()));
        const st = at + stag * i;
        if (m.has(k) && m.get(k) > st + 1e-3) WARN.push(`overlap ${k} at ${st.toFixed(2)} < ${m.get(k).toFixed(2)} (${nm(el)})`);
        m.set(k, st + dur);
      });
    }
    for (const [keys, ir] of [[firstKeys, true], [laterKeys, false]]) {
      if (!keys.length) continue;
      // force3D false: translate3d gives an element its own compositor layer while it moves; layers that come and go
      // with seek history are where Chrome's raster differed by a pixel column
      tl.fromTo(arr, pick(from, keys), Object.assign({ duration: dur, ease, immediateRender: ir, force3D: false }, pick(to, keys), extra), at);
    }
    return at + stag * (arr.length - 1) + dur;
  }
  // consecutive segments for one property set: kf = [[t, vars], [t, vars], ...]
  function chain(targets, kf, ease = "none") {
    for (let i = 1; i < kf.length; i++) tw(targets, kf[i - 1][1], kf[i][1], kf[i - 1][0], Math.max(0.001, kf[i][0] - kf[i - 1][0]), ease);
  }
  const CUES = [];
  const cue = (t, type, extra) => CUES.push(Object.assign({ t: +t.toFixed(3), type }, extra || {}));   // synth.py gains are relative

  // ------------------------------------------------------------------ paper (seeded, painted once at build)
  (function paint(cv, seed) {
    const ctx = cv.getContext("2d"), w = cv.width, h = cv.height;
    const gr = ctx.createRadialGradient(w * 0.458, h * 0.352, 40, w * 0.5, h * 0.481, Math.max(w, h) * 0.65);
    gr.addColorStop(0, "#FBFAF7"); gr.addColorStop(0.55, "#F3F3EF"); gr.addColorStop(1, "#E7E7E2");
    ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h), d = img.data, R = rng(seed);
    for (let i = 0; i < d.length; i += 4) { const n = (R() - 0.5) * 7; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    ctx.putImageData(img, 0, 0);
    ctx.strokeStyle = "rgba(26,36,51,0.025)"; ctx.lineWidth = 1;
    for (let i = 0; i < 70; i++) { const x = R() * w, y = R() * h, a = R() * Math.PI, l = 20 + R() * 60; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (R() - 0.5) * 8, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke(); }
  })(document.getElementById("paper"), 20261011);

  // ------------------------------------------------------------------ the plot (static parts are the frame-0 poster)
  const DATA = { halfLifeHours: 1, remaining: [1, 0.5, 0.25, 0.125] };
  DATA.remaining.forEach((v, k) => { if (Math.abs(v - Math.pow(0.5, k / DATA.halfLifeHours)) > 1e-12) throw new Error(`data drift: remaining[${k}] = ${v}`); });
  const cam = document.getElementById("cam"), ov = document.getElementById("ov"), labels = document.getElementById("labels");
  const X = (hr) => 560 + 250 * hr, Y = (v) => 760 - 500 * v;
  const ink = (pts, w) => S("path", { d: penStroke(pts, w), fill: INK }, ov);
  ink([[X(0), Y(-0.04)], [X(0), Y(1.06)]], 4.5);
  ink([[X(-0.08), Y(0)], [X(3.3), Y(0)]], 4.5);
  for (const hr of [1, 2, 3]) {
    ink([[X(hr), Y(0)], [X(hr), Y(0) + 16]], 4);
    const box = H("div", "lpos", labels); box.style.left = X(hr) - 100 + "px"; box.style.top = Y(0) + 52 - 25 + "px"; box.style.width = "200px"; box.style.textAlign = "center";
    H("div", "lab roman graphite", box, hr + " h").style.fontSize = "44px";
  }
  S("circle", { cx: X(0), cy: Y(1), r: 11, fill: INK }, ov);

  // the curve: a pen stroke whose head moves at a constant speed in x and reaches hour k when point k lands
  const step = 0.42, tHalf = W("c01", "half"), tStart = Math.max(0.25, tHalf - step);
  const N = 240, pts = Array.from({ length: N + 1 }, (_, i) => { const x = (3.2 * i) / N; return [X(x), Y(Math.pow(0.5, x))]; });
  const cum = [0]; for (let i = 1; i <= N; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const curve = S("path", { d: pathOf(pts), fill: "none", stroke: INK, "stroke-width": 5, "stroke-linecap": "round", pathLength: 1, "stroke-dasharray": "1 1" }, ov);
  const kf = []; for (let j = 0; j <= 16; j++) { const x = 0.2 * j, i = Math.round((x / 3.2) * N); kf.push([tStart + x * step, { attr: { "stroke-dashoffset": +(1 - cum[i] / cum[N]).toFixed(5) } }]); }
  chain(curve, kf, "none");
  tw(curve, { opacity: 0 }, { opacity: 1 }, tStart, 0.02, "none");     // gate: no round-cap dot before the pen starts
  cue(tStart, "tick", { gain: -4 });

  // data points land with no overshoot
  const dots = [1, 2, 3].map((hr, i) => {
    const c = S("circle", { cx: X(hr), cy: Y(DATA.remaining[hr]), r: 11, fill: INK }, ov);
    const tk = tStart + hr * step;
    tw(c, { attr: { r: 0 } }, { attr: { r: 11 } }, tk - 0.05, 0.35, "power2.out");
    cue(tk, "pluck", { note: ["A4", "F#4", "D4"][i], gain: -6, decay: 0.8, pan: -0.2 + 0.2 * i });
    return c;
  });

  // "eighth": the one vermilion detail, and the value it names
  const tE = W("c02", "eighth");
  tw(dots[2], { fill: INK }, { fill: VERM }, tE - 0.15, 0.3, "power1.out");
  const v8box = H("div", "lpos", labels); v8box.style.left = X(3) + 34 + "px"; v8box.style.top = Math.round(Y(DATA.remaining[3]) - 70 - 40) + "px";
  const v8 = H("div", "lab roman v", v8box, "1/8"); v8.style.fontSize = "72px";
  tw(v8, { opacity: 0, y: 16 }, { opacity: 1, y: 0 }, tE - 0.1, 0.45, "power3.out");
  cue(tE - 0.1, "pluck", { note: "E5", gain: -4, decay: 1.1, pan: 0.3 });

  // camera: one slow push about (CX, CY); the drawing and the labels share the .cam layer (transform-origin 0 0 in CSS)
  const CX = 935, CY = 520, CAM = (s) => ({ scale: s, x: CX * (1 - s), y: CY * (1 - s) });
  tw(cam, CAM(1), CAM(1.04), 0, DUR, "sine.inOut");

  // ------------------------------------------------------------------ captions (from the timing sheet)
  const capsHost = document.getElementById("caps");
  const CAPTIONS = T.captions.map((c) => ({ id: c.id, text: c.text, in: c.in, out: c.out }));
  for (const c of T.captions) for (const s of (c.sub && c.sub.length ? c.sub : [c])) {
    const d = H("div", "cap", capsHost); d.dataset.id = s.id;
    s.text.split(" ").forEach((w, i) => { if (i) d.appendChild(document.createTextNode(" ")); H("span", "w", d, w); });
    const words = [...d.querySelectorAll(".w")];
    if (s.in <= 0) d.style.opacity = "1";                                  // up on frame 0: static DOM state
    else {
      tw(d, { opacity: 0 }, { opacity: 1 }, s.in, 0.1, "none");
      tw(words, { opacity: 0, y: 9 }, { opacity: 1, y: 0 }, s.in, 0.32, "power2.out", { stagger: 0.022 });
    }
    if (s.out < DUR - 1e-6) tw(d, { opacity: 1 }, { opacity: 0 }, s.out, 0.15, "power1.in");
  }

  // ------------------------------------------------------------------ seek-history independence
  // Chrome re-rasters only what changed; a flat full-frame block whose background moves on every seek makes it raster
  // the whole layer each time (an opacity ramp would not: 8-bit alpha repeats values). It is never visible.
  const repaint = H("div", null, null); repaint.id = "repaint";
  Object.assign(repaint.style, { position: "absolute", left: "0px", top: "0px", width: "1920px", height: "1080px", zIndex: "0",
    backgroundImage: "linear-gradient(#F2F2EE, #F2F2EE)", backgroundSize: "1920px 1080px", backgroundRepeat: "repeat" });
  root.insertBefore(repaint, root.firstChild);
  tw(repaint, { backgroundPosition: "0px 0px" }, { backgroundPosition: `${Math.round(DUR * 480)}px 0px` }, 0, DUR, "none");
  // "transform: none" and an identity matrix rasterise differently (a rounded clip was lost on one seek path): prime
  // every transform-tweened HTML element with an explicit identity; SVG elements get transform-origin 0 0 up front
  const TFP = /^(x|y|z|scale|scaleX|scaleY|rotation|rotate|rotationX|rotationY|skewX|skewY|xPercent|yPercent)$/;
  const tf = new Set();
  tl.getChildren(true, true, false).forEach((t) => { if (Object.keys(t.vars).some((k) => TFP.test(k))) t.targets().forEach((e) => { if (e instanceof Element) tf.add(e); }); });
  tf.forEach((e) => {
    if (e instanceof SVGElement) { if (!e.style.transformOrigin) e.style.transformOrigin = "0px 0px"; }
    else if (!e.style.transform) e.style.transform = "translate(0px, 0px)";
  });
  tl.set({}, {}, DUR);   // pad the timeline to the full length so tl.duration() agrees with data-duration

  // ------------------------------------------------------------------ shim for the skill's tools
  if (WARN.length) console.warn("tween overlaps:\n" + WARN.join("\n"));
  window.WARN = WARN;
  window.DURATION = DUR;
  window.CAPTIONS = CAPTIONS;
  window.CUES = CUES.sort((a, b) => a.t - b.t);
  window.seek = (t) => { tl.totalTime(Math.max(0, Math.min(DUR, t)), true); };
  const FACES = ['400 60px "Instrument Serif"', '420 48px "Geist Variable"', '460 30px "Geist Variable"'];
  Promise.all(FACES.map((f) => document.fonts.load(f))).then(() => document.fonts.ready).then(() => { window.__ready = true; });
  window.__build = () => tl;
})(); } catch (e) { window.__error = String((e && e.stack) || e); throw e; }
