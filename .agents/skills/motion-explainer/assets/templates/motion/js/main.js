/* Demo beat (replace with your film): "Every hour, half of what's left decays." A pen draws y = 0.5^x on light paper,
 * data points land on the spoken word with zero overshoot, and on "eighth" the third point turns vermilion and its
 * value appears. Shows the scene contract, the timing sheet, marks on words, a data guard, captions, chrome and cues.
 * Captions and their windows come only from timing.json (built by scripts/timing.py from lines.json). */
(() => {
  'use strict'
  const K = window.K, C = K.C
  // every face the page uses, by name: fonts.ready alone can resolve before a lazily used face loads
  const FACES = ['400 60px "Instrument Serif"', 'italic 400 60px "Instrument Serif"', '420 48px "Geist Variable"', '460 30px "Geist Variable"']
  // the numbers on screen and where they come from (here: arithmetic, so the plot carries an "illustration" badge)
  const DATA = { halfLifeHours: 1, remaining: [1, 0.5, 0.25, 0.125] }

  const setup = async () => {
    await Promise.all(FACES.map((f) => document.fonts.load(f)))
    await document.fonts.ready
    const T = await fetch('timing.json').then((r) => { if (!r.ok) throw new Error('timing.json missing'); return r.json() })
    // data guard: refuse to load when a plotted number drifts from its source
    DATA.remaining.forEach((v, k) => { if (Math.abs(v - Math.pow(0.5, k / DATA.halfLifeHours)) > 1e-12) throw new Error(`data drift: remaining[${k}] = ${v}`) })
    K.DURATION = T.duration
    K.paint(document.getElementById('paper'))
    const cam = document.getElementById('cam'), labels = document.getElementById('labels')

    // plot frame: origin (560, 760), 250 px per hour, 500 px per unit; camera centre a little above frame centre
    const X = (h) => 560 + 250 * h, Y = (v) => 760 - 500 * v
    const pen = (pts, w, color = C.ink) => K.S('path', { d: K.penStroke(pts, w, 0, 1, [0.03, 0.92]), fill: color }, cam)
    pen([[X(0), Y(-0.04)], [X(0), Y(1.06)]], 4.5)                 // axes are on frame 0: frame 0 is a poster
    pen([[X(-0.08), Y(0)], [X(3.3), Y(0)]], 4.5)
    for (const h of [1, 2, 3]) {
      pen([[X(h), Y(0)], [X(h), Y(0) + 16]], 4)
      K.label(labels, h + ' h', X(h), Y(0) + 52, { size: 44, cls: 'roman graphite', align: 'c' })
    }
    K.S('circle', { cx: X(0), cy: Y(1), r: 11, fill: C.ink }, cam)        // the starting amount, on frame 0

    // the curve: its head moves at a constant speed in x and reaches hour k exactly when point k lands on its word
    const step = 0.42
    const tHalf = K.word(T, 'c01', 'half')
    const tStart = Math.max(0.25, tHalf - step)
    const head = K.nv('curveHead', 0)
    K.tw(head, [0, 3.2], { at: tStart, duration: 3.2 * step, ease: 'linear' })
    const curve = K.S('path', { d: 'M0 0', fill: C.ink }, cam)
    K.onRender(() => {                                          // writes every frame, 'M0 0' when nothing is drawn
      const xh = head.get()
      if (xh <= 0.01) { K.set(curve, { d: 'M0 0' }); return }
      const n = Math.max(2, Math.ceil(60 * xh))
      const pts = Array.from({ length: n + 1 }, (_, i) => { const x = (xh * i) / n; return [X(x), Y(Math.pow(0.5, x))] })
      K.set(curve, { d: K.penStroke(pts, 5, 0, 1, [0.02, 0.97]) })
    })
    K.cue(tStart, 'tick', { gain: -4 })

    // data points land with bounce 0: a value that overshoots briefly shows a number nobody measured
    const pts = [1, 2, 3].map((h, i) => {
      const c = K.S('circle', { cx: X(h), cy: Y(DATA.remaining[h]), r: 0, fill: C.ink }, cam)
      const tk = tStart + h * step
      K.tw(c, { attrR: [0, 11] }, { at: tk - 0.05, type: 'spring', bounce: 0, visualDuration: 0.3 })
      K.cue(tk, 'pluck', { note: ['A4', 'F#4', 'D4'][i], gain: -6, decay: 0.8, pan: -0.2 + 0.2 * i })
      return c
    })

    // "eighth": the one vermilion detail of the frame, and the value it names (at least 56 px on stage)
    const tE = K.word(T, 'c02', 'eighth')
    K.tw(pts[2], { fill: [C.ink, C.verm] }, { at: tE - 0.15, duration: 0.3, ease: 'easeOut' })
    const v8 = K.label(labels, '1/8', X(3) + 34, Y(DATA.remaining[3]) - 70, { size: 72, cls: 'roman v' })
    K.labIn(v8, tE - 0.1)
    K.cue(tE - 0.1, 'pluck', { note: 'E5', gain: -4, decay: 1.1, pan: 0.3 })

    // camera: one slow push across the beat; the label layer gets the same transform as the drawing
    const cs = K.nv('camScale', 1)
    K.tw(cs, [1, 1.04], { at: 0, duration: T.duration, ease: K.E.inOutSine })
    const CX = 935, CY = 520
    K.onRender(() => {
      const s = cs.get()
      cam.setAttribute('transform', `translate(${CX} ${CY}) scale(${s.toFixed(5)}) translate(${-CX} ${-CY})`)
      labels.style.transform = `translate(${CX}px, ${CY}px) scale(${s.toFixed(5)}) translate(${-CX}px, ${-CY}px)`
    })

    // chrome: computed numbers carry "illustration" for exactly as long as the plot is on screen
    K.show(K.chrome(document.getElementById('chrome'), 'badge', 'illustration'), 0, T.duration)

    window.CAPTIONS = K.captions(T, document.getElementById('caps'))
    K.build()
    window.DURATION = K.DURATION
    window.CUES = K.CUES.sort((a, b) => a.t - b.t)
    window.WARN = K.WARN
    window.seek = K.seek
    if (K.WARN.length) console.warn('engine warnings:\n' + K.WARN.join('\n'))
    K.seek(0)
    window.__ready = true      // last line, after the first seek
  }
  setup().catch((e) => { window.__error = String((e && e.stack) || e); console.error('setup failed', window.__error) })
})()
