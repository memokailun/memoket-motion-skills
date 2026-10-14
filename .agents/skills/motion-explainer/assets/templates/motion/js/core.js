/* Deterministic Motion engine (npm "motion" 14.1.0, MIT), the K namespace.
 *
 * Every frame is a pure function of t. Every animated value is a Motion animation:
 *   - one master Motion sequence: K.tw adds a segment at an absolute scene time (springs, eased tweens, pathLength,
 *     attr*, colours, motion values). A property has exactly one track; overlaps are reported in K.WARN.
 *   - standalone velocity springs (K.kick): a spring from 0 to 0 with only a velocity cannot live in a sequence.
 *   - Motion.spring() generators sampled as functions where a per-point physics value is needed (K.springFn).
 * All animations are created paused. K.seek(t) sets each animation's time, flushes Motion's frame loop synchronously,
 * rounds moving HTML text to whole pixels, then runs render hooks that only turn Motion values into geometry and
 * write their full state on every frame. Nothing reads the clock; randomness only from K.rng(seed).
 * Read references/motion-engine.md before changing anything here.
 */
(() => {
  'use strict'
  const M = window.Motion
  if (!M) throw new Error('Motion library missing: check the script tag for node_modules/motion/dist/motion.js')
  M.MotionGlobalConfig.useManualTiming = true
  // Motion hands opacity, transform, filter and colour to the browser's animation engine (WAAPI) when it can. Those run
  // on compositor layers whose promotion depends on seek history (labels differed by up to 8 code values between seek
  // orders). Motion checks for WAAPI once, lazily; hiding it before the first animation keeps every value on Motion's
  // synchronous JS path. Proof: document.getAnimations().length === 0 after setup.
  try { delete Element.prototype.animate } catch (e) { /* keep going */ }
  const K = (window.K = { M })
  const NS = 'http://www.w3.org/2000/svg'
  const root = getComputedStyle(document.documentElement)
  const tok = (name, d) => (root.getPropertyValue(name) || '').trim() || d
  K.C = { paper: tok('--paper', '#F2F2EE'), ink: tok('--ink', '#1A2433'), verm: tok('--verm', '#E4472B'), graphite: tok('--graphite', '#6B727C'), ghost: tok('--ghost', '#8A919B') }

  // ------------------------------------------------------------------ math
  const clamp = (K.clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)))
  const lerp = (K.lerp = (a, b, u) => a + (b - a) * u)
  const sm = (K.sm = (a, b, x) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u) })
  K.rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
  const f2 = (K.f2 = (v) => Math.round(v * 100) / 100)
  const pathOf = (K.pathOf = (arr) => (arr.length ? 'M' + arr.map((p) => f2(p[0]) + ' ' + f2(p[1])).join(' L') : 'M0 0'))
  // eases handed to Motion (evaluated by Motion, never reading the clock)
  K.E = {
    outCubic: (x) => 1 - Math.pow(1 - x, 3),
    outQuart: (x) => 1 - Math.pow(1 - x, 4),
    inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    inOutSine: (x) => -(Math.cos(Math.PI * x) - 1) / 2,
    inQuad: (x) => x * x,
    outQuad: (x) => 1 - (1 - x) * (1 - x),
    expOut: (span, tau) => { const n = 1 - Math.exp(-span / tau); return (x) => (1 - Math.exp(-(x * span) / tau)) / n },
  }
  K.PEN = [0.25, 1, 0.5, 1]             // quart-out pen stroke
  K.STEP = (p) => (p > 0 ? 1 : 0)       // a true cut: every sample after `at` already has the new value

  // ------------------------------------------------------------------ svg and html
  const S = (K.S = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e })
  const set = (K.set = (e, attrs) => { for (const k in attrs) e.setAttribute(k, attrs[k]) })
  K.el = (tag, cls, parent, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; if (parent) parent.appendChild(e); return e }

  // ------------------------------------------------------------------ engine
  const SEQ = [], LAST = new Map(), ENDS = new Map(), REG = [], RENDER = [], WARN = (K.WARN = []), MOVERS = new Set()
  const isMV = (s) => s && typeof s.get === 'function' && typeof s.set === 'function' && typeof s.getVelocity === 'function'
  K.mv = (v = 0) => M.motionValue(v)
  K.nv = (name, v = 0) => { const m = K.mv(v); m.__name = name; return m }   // named: only helps warnings
  // Spring rest thresholds relative to each segment's own distance. Motion's defaults (0.5 units) end springs early
  // and snap the last 0.3 to 0.8 px in one frame; 0.05 percent of the distance leaves 0.13 to 0.20 px.
  const REST = (K.REST = { delta: 5e-4, speed: 5e-3 })
  const springDur = (K.springDur = (o) => {
    const D = 100
    const g = M.spring({ keyframes: [0, D], ...o, restDelta: o.restDelta != null ? o.restDelta : D * REST.delta, restSpeed: o.restSpeed != null ? o.restSpeed : D * REST.speed })
    for (let ms = 0; ms < 20000; ms += 10) if (g.next(ms).done) return ms / 1000
    return 20
  })
  const nameOf = (s) => (s.__name || s.id || (s.getAttribute && s.getAttribute('class')) || s.tagName || 'value')
  // Text never fades through element opacity: a fractional opacity rastered glyphs one code value apart depending on
  // the frame before. Elements with class "lab" fade through their colour's alpha with opacity held at 1.
  const rgba = (str) => {
    if (str[0] === '#') return [1, 3, 5].map((i) => parseInt(str.slice(i, i + 2), 16)).concat([1])
    const p = str.match(/rgba?\(([^)]+)\)/)[1].split(',').map((x) => +x.trim()); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]
  }
  const rgbaStr = (c, a) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${+a.toFixed(4)})`
  const asColorFade = (el, props) => {
    if (!el._base) { el._base = rgba(getComputedStyle(el).color); el.style.opacity = '1'; el.style.color = rgbaStr(el._base, 0) }
    const m = LAST.get(el), src = m && m.has('color') ? rgba(m.get('color')) : el._base, A = el._base[3]
    const ov = props.opacity, out = { ...props }
    delete out.opacity
    out.color = Array.isArray(ov) ? ov.map((a) => rgbaStr(src, A * a)) : rgbaStr(src, A * ov)
    return out
  }
  // K.tw(subject, props, opts): one segment at absolute time opts.at.
  //   subject: element, array of elements, or a motion value. props: {key: to | [from, ..., to]}; for a motion value
  //   props is to | [from, ..., to]. A bare `to` continues from the property's last keyframe, so gaps stay flat.
  //   Springs take either {stiffness, damping} or {bounce, visualDuration}, never a mix. Returns the segment's end time.
  //   Build order must equal time order per value ("last keyframe" means last registered).
  K.tw = (subject, props, opts) => {
    if (opts == null || typeof opts.at !== 'number') throw new Error('K.tw needs opts.at (absolute seconds)')
    if (opts.type === 'spring' && (opts.bounce !== undefined || opts.visualDuration !== undefined) && (opts.stiffness !== undefined || opts.damping !== undefined || opts.mass !== undefined))
      WARN.push(`spring mixes stiffness/damping/mass with bounce/visualDuration at ${opts.at} (Motion ignores bounce then)`)
    const mvMode = isMV(subject)
    if (!mvMode && props && props.opacity !== undefined && subject instanceof HTMLElement && subject.classList.contains('lab') && props.color === undefined) props = asColorFade(subject, props)
    let m = LAST.get(subject); if (!m) LAST.set(subject, (m = new Map()))
    let e = ENDS.get(subject); if (!e) ENDS.set(subject, (e = new Map()))
    // Motion draws pathLength as dasharray "L (1 - L)": the next dash starts exactly at the end, where a round cap
    // paints a dot. pathSpacing 1 keeps the gap past the end.
    if (!mvMode && props.pathLength !== undefined && props.pathSpacing === undefined) props = { ...props, pathSpacing: m.has('pathSpacing') ? 1 : [1, 1] }
    const dur = opts.type === 'spring' ? springDur(opts) : (opts.duration ?? 0.3)
    const end = opts.at + (typeof opts.delay === 'number' ? opts.delay : 0) + dur
    const fill = (k, v) => {
      if (!Array.isArray(v)) {
        if (!m.has(k)) {
          let v0 = null
          if (mvMode) v0 = subject.get()
          else if (k.startsWith('attr') && subject.getAttribute) {
            const an = k.slice(4).replace(/^./, (c) => c.toLowerCase()).replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())
            const s = subject.getAttribute(an); if (s != null && s !== '' && !isNaN(+s)) v0 = +s
          }
          if (v0 == null) throw new Error(`K.tw: no start value for ${k} on ${nameOf(subject)}; give [from, to] the first time`)
          m.set(k, v0)
        }
        v = [m.get(k), v]
      }
      if (e.has(k) && opts.at < e.get(k) - 0.02) WARN.push(`overlap ${k} at ${opts.at.toFixed(2)} < ${e.get(k).toFixed(2)} (${nameOf(mvMode ? subject : [].concat(subject)[0])})`)
      m.set(k, v[v.length - 1]); e.set(k, end)
      return v
    }
    // a spring between two equal numbers has no distance (Motion gives NaN): hold it with a plain 10 ms tween
    const flat = (v) => opts.type === 'spring' && v.length === 2 && typeof v[0] === 'number' && Math.abs(v[0] - v[1]) < 1e-9
    const hold = { at: opts.at, duration: 0.01, ease: 'linear' }
    const tight = (v) => {
      if (opts.type !== 'spring' || opts.restDelta != null || v.length !== 2 || typeof v[0] !== 'number') return opts
      const d = Math.abs(v[1] - v[0])
      return { ...opts, restDelta: Math.max(1e-7, d * REST.delta), restSpeed: Math.max(1e-6, d * REST.speed) }
    }
    if (mvMode) { const kf = fill('__v', props); SEQ.push([subject, kf, flat(kf) ? hold : tight(kf)]); return end }
    if (('x' in props || 'y' in props) && !(subject instanceof SVGElement)) for (const el of [].concat(subject)) if (el instanceof HTMLElement) MOVERS.add(el)
    const kh = {}
    for (const k in props) { const v = fill(k, props[k]); if (flat(v)) kh[k] = v; else SEQ.push([subject, { [k]: v }, tight(v)]) }
    if (Object.keys(kh).length) SEQ.push([subject, kh, hold])
    return end
  }
  K.at = (mv, at, v) => K.tw(mv, v, { at, duration: 0.01, ease: K.STEP })             // set a value instantly at `at`
  K.cut = (subject, props, at) => K.tw(subject, props, { at, duration: 0.01, ease: K.STEP })
  K.reg = (anim, start) => { anim.pause(); REG.push({ a: anim, start, dur: anim.duration }); return anim }
  // velocity kick: standalone spring from 0 to 0 with an initial velocity; add its value in a render hook
  K.kick = (at, o) => { const v = K.mv(0); K.reg(M.animate(v, [0, 0], { type: 'spring', mass: 1, stiffness: 260, damping: 9, ...o }), at); return v }
  // a spring as a function of seconds since start (mass is added only for physics springs: any of stiffness, damping
  // or mass makes Motion ignore bounce and visualDuration; an always-added mass gave 16 percent overshoot)
  K.springFn = (o) => { const g = M.spring({ keyframes: [0, 1], ...(o.visualDuration !== undefined ? {} : { mass: 1 }), ...o }); return (tau) => (tau <= 0 ? 0 : g.next(tau * 1000).value) }
  K.onRender = (fn) => RENDER.push(fn)
  const STEPS = ['setup', 'read', 'resolveKeyframes', 'preUpdate', 'update', 'preRender', 'render', 'postRender']
  const flush = () => {   // run Motion's frame steps now (two passes so work scheduled in the first also lands)
    const fd = M.frameData
    fd.isProcessing = true
    for (let pass = 0; pass < 2; pass++) for (const s of STEPS) if (M.frameSteps[s]) M.frameSteps[s].process(fd)
    fd.isProcessing = false
  }
  K.build = () => { K.reg(M.animate(SEQ), 0); K.SEQ_COUNT = SEQ.length }
  K.seek = (t) => {
    t = clamp(t, 0, K.DURATION)
    for (const r of REG) r.a.time = clamp(t - r.start, 0, r.dur)
    flush()
    // text at a fractional offset is rastered from a glyph cache that depends on earlier frames: whole pixels only
    for (const el of MOVERS) { const tr = el.style.transform; if (tr && tr.indexOf('.') >= 0) el.style.transform = tr.replace(/(-?\d*\.\d+)px/g, (m, v) => Math.round(+v) + 'px') }
    for (const fn of RENDER) fn(t)
  }

  // ------------------------------------------------------------------ sound cues (scripts/synth.py)
  // gains are relative to each cue type's own level in synth.py (0 = its default), not absolute dB
  K.CUES = []
  K.cue = (t, type, extra) => K.CUES.push(Object.assign({ t: +t.toFixed(3), type }, extra || {}))

  // ------------------------------------------------------------------ pen geometry (filled outlines, pen pressure)
  // a pressure-tapered stroke along a polyline, drawn from length fraction u0 to u1
  K.penStroke = (pts, w, u0 = 0, u1 = 1, taper = [0.06, 0.85]) => {
    if (u1 - u0 <= 0.002 || pts.length < 2) return 'M0 0'
    const L = [0]
    for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
    const tot = L[L.length - 1], out = [], inn = []
    const at = (s) => { let i = 1; while (i < L.length - 1 && L[i] < s) i++; const u = clamp((s - L[i - 1]) / Math.max(1e-9, L[i] - L[i - 1])); return [lerp(pts[i - 1][0], pts[i][0], u), lerp(pts[i - 1][1], pts[i][1], u), Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0])] }
    const n = Math.max(4, Math.ceil((tot * (u1 - u0)) / 6))
    for (let i = 0; i <= n; i++) {
      const u = u0 + ((u1 - u0) * i) / n
      const [x, y, a] = at(u * tot)
      const press = sm(0, taper[0], u) * (1 - 0.75 * sm(taper[1], 1, u))
      const hw = (w * (0.3 + 0.7 * press)) / 2
      out.push([x - Math.sin(a) * hw, y + Math.cos(a) * hw]); inn.push([x + Math.sin(a) * hw, y - Math.cos(a) * hw])
    }
    return pathOf(out.concat(inn.reverse())) + ' Z'
  }
  // a pen-drawn ring: width follows pen pressure, a whisper of wobble, a slight overrun past its start
  K.penRing = (cx, cy, r, w, a0, u0 = 0, u1 = 1, wob = 0.005, ph = 0, over = 1.03) => {
    if (u1 - u0 <= 0.002 || r <= 0.5 || w <= 0.05) return 'M0 0'
    const span = Math.PI * 2 * over, n = Math.max(6, Math.ceil(Math.max(28, r * 0.55) * (u1 - u0)))
    const out = [], inn = []
    for (let i = 0; i <= n; i++) {
      const u = u0 + ((u1 - u0) * i) / n, th = a0 + span * u
      const press = sm(0, 0.08, u) * (1 - 0.88 * sm(0.84, 1, u))
      const hw = (w * (0.24 + 0.76 * press)) / 2
      const rr = r * (1 + wob * Math.sin(2 * th + ph) + wob * 0.6 * Math.sin(3 * th + ph * 1.7)) + r * 0.005 * u
      out.push([cx + (rr + hw) * Math.cos(th), cy + (rr + hw) * Math.sin(th)]); inn.push([cx + (rr - hw) * Math.cos(th), cy + (rr - hw) * Math.sin(th)])
    }
    return pathOf(out.concat(inn.reverse())) + ' Z'
  }
  // the editor's loop: a loose, tilted, widening hand-drawn ellipse (1.16 turns) that means "pick this"; never concentric
  K.penLoop = (cx, cy, rx, ry, rot, a0, w, u0, u1, ph = 0) => {
    if (u1 - u0 <= 0.002) return 'M0 0'
    const span = Math.PI * 2 * 1.16, n = Math.max(8, Math.ceil(110 * (u1 - u0))), out = [], inn = [], cr = Math.cos(rot), sr = Math.sin(rot)
    for (let i = 0; i <= n; i++) {
      const u = u0 + ((u1 - u0) * i) / n, th = a0 + span * u
      const press = sm(0, 0.06, u) * (1 - 0.9 * sm(0.78, 1, u)), hw = (w * (0.25 + 0.75 * press)) / 2
      const g = 1 + 0.08 * u + 0.016 * Math.sin(3 * th + ph) + 0.007 * Math.sin(5 * th + ph * 2)
      for (const [arr, d] of [[out, hw], [inn, -hw]]) { const lx = (rx * g + d) * Math.cos(th), ly = (ry * g + d) * Math.sin(th); arr.push([cx + lx * cr - ly * sr, cy + lx * sr + ly * cr]) }
    }
    return pathOf(out.concat(inn.reverse())) + ' Z'
  }

  // ------------------------------------------------------------------ paper (never pure white; painted once, seeded)
  K.paint = (cv, seed = 20261011) => {
    const ctx = cv.getContext('2d'), w = cv.width, h = cv.height
    const gr = ctx.createRadialGradient(w * 0.458, h * 0.352, 40, w * 0.5, h * 0.481, Math.max(w, h) * 0.65)
    gr.addColorStop(0, '#FBFAF7'); gr.addColorStop(0.55, '#F3F3EF'); gr.addColorStop(1, '#E7E7E2')
    ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h)
    const img = ctx.getImageData(0, 0, w, h), d = img.data, R = K.rng(seed)
    for (let i = 0; i < d.length; i += 4) { const n = (R() - 0.5) * 7; d[i] += n; d[i + 1] += n; d[i + 2] += n }   // grain, static
    ctx.putImageData(img, 0, 0)
    ctx.strokeStyle = 'rgba(26,36,51,0.025)'; ctx.lineWidth = 1
    for (let i = 0; i < 70; i++) { const x = R() * w, y = R() * h, a = R() * Math.PI, l = 20 + R() * 60; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (R() - 0.5) * 8, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke() }
  }

  // ------------------------------------------------------------------ beats, labels, chrome, captions
  // a beat is shown only inside [t0, t1): its group is display:none outside, and its render hooks run only inside
  K.beats = []
  K.beat = (t0, t1, name, parentSvg, parentHtml) => {
    const b = { t0, t1, name, g: S('g', { 'data-beat': name }, parentSvg), html: parentHtml ? K.el('div', 'beat', parentHtml) : null, renders: [], on: true }
    K.beats.push(b); return b
  }
  K.beatRender = (b, fn) => b.renders.push(fn)
  K.onRender((t) => {
    for (const b of K.beats) {
      const vis = t >= b.t0 && t < b.t1
      if (vis !== b.on) { b.g.style.display = vis ? '' : 'none'; if (b.html) b.html.style.display = vis ? '' : 'none'; b.on = vis }
      if (vis) for (const fn of b.renders) fn(t)   // write the full state every frame, even "nothing" ('M0 0')
    }
  })
  // stage label: an absolutely placed .lab centred vertically on yc; align 'l' | 'c' | 'r'
  K.label = (host, text, x, yc, o = {}) => {
    const size = o.size || 52
    const pos = K.el('div', 'lpos', host)
    pos.style.left = Math.round(x) + 'px'; pos.style.top = Math.round(yc - size * 0.56) + 'px'
    const el = K.el('div', 'lab ' + (o.cls || ''), pos, text); el.style.fontSize = size + 'px'
    // centre or right-align by measured layout width, on whole pixels (a -50% translate lands on half pixels)
    if (o.align === 'c' || o.align === 'r') pos.style.left = Math.round(x - (o.align === 'c' ? el.offsetWidth / 2 : el.offsetWidth)) + 'px'
    return el
  }
  K.labIn = (el, at, o = {}) => {   // fade in through colour alpha plus a 16 px rise on a 260/20 spring
    K.tw(el, { opacity: [0, o.op ?? 1] }, { at, duration: 0.35, ease: 'easeOut' })
    K.tw(el, { y: [o.dy ?? 16, 0] }, { at, type: 'spring', stiffness: 260, damping: 20 })
  }
  K.labOut = (el, at, d = 0.3) => K.tw(el, { opacity: 0 }, { at, duration: d, ease: 'easeIn' })
  K.chrome = (host, cls, text) => K.el('div', cls, host, text)
  // show a badge or tag over [t0, t1]; t0 <= 0 means on from frame 0 (frame 0 is a poster)
  K.show = (el, t0, t1, fin = 0.35, fout = 0.3) => {
    const first = !LAST.get(el) || !LAST.get(el).has('opacity')
    if (t0 <= 0) K.tw(el, { opacity: [1, 1] }, { at: 0, duration: 0.01 })
    else K.tw(el, { opacity: first ? [0, 1] : 1 }, { at: t0, duration: fin, ease: 'easeOut' })
    if (t1 < K.DURATION - 1e-6) K.tw(el, { opacity: 0 }, { at: t1, duration: fout, ease: 'easeIn' })
  }
  // captions from the timing sheet: one .cap line per sub-caption, words rise on a 22 ms staggered spring, the line
  // fades out in 0.15 s. Returns window.CAPTIONS (one entry per voice line, not per sub-caption).
  K.captions = (T, host) => {
    for (const c of T.captions) for (const s of (c.sub && c.sub.length ? c.sub : [c])) {
      const text = s.text.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim()
      const d = K.el('div', 'cap', host); d.dataset.id = s.id || c.id
      for (const [i, w] of text.split(' ').entries()) { if (i) d.appendChild(document.createTextNode(' ')); K.el('span', 'w', d, w) }
      if (s.size) d.style.fontSize = s.size + 'px'
      const words = [...d.querySelectorAll('.w')]
      if (s.in <= 0) K.tw(d, { opacity: [1, 1] }, { at: 0, duration: 0.01 })   // up on frame 0, no fade
      else {
        K.tw(d, { opacity: [0, 1] }, { at: s.in, duration: 0.1, ease: 'linear' })
        K.tw(words, { opacity: [0, 1] }, { at: s.in, delay: M.stagger(0.022), duration: 0.22, ease: 'easeOut' })
        K.tw(words, { y: [9, 0] }, { at: s.in, delay: M.stagger(0.022), type: 'spring', stiffness: 300, damping: 26 })
      }
      if (s.out < T.duration - 1e-6) K.tw(d, { opacity: 0 }, { at: s.out, duration: 0.15, ease: 'easeIn' })
    }
    return T.captions.map((c) => ({ id: c.id, text: c.text.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim(), in: c.in, out: c.out }))
  }
  // scene time of a spoken word from the timing sheet (nth occurrence); marks land on words
  K.word = (T, id, word, nth = 0) => {
    const c = T.captions.find((x) => x.id === id); if (!c) throw new Error('no caption ' + id)
    const norm = (s) => s.toLowerCase().replace(/[^a-z0-9']/g, '')
    const hits = (c.words || []).filter((w) => norm(w[0]) === norm(word))
    if (!hits[nth]) throw new Error(`word "${word}" not in ${id} (timing sheet words)`)
    return hits[nth][1]
  }
})()
