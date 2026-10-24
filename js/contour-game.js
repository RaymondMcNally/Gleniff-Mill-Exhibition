(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const NA = -1e9;
  function seeded(a, seed) { let t = seed >>> 0; const r = () => { t += 0x6D2B79F5; let x = t; x = Math.imul(x ^ x >>> 15, x | 1); x ^= x + Math.imul(x ^ x >>> 7, x | 61); return ((x ^ x >>> 14) >>> 0) / 4294967296; };
    a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // ---------------------------------------------------------------- terrain grids (j = 0 is the north edge)
  function grid(w, h, fn) { const d = new Float32Array(w * h); let mx = -Infinity, mn = Infinity; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const v = fn(i, j); d[j * w + i] = v; if (v > NA) { if (v > mx) mx = v; if (v < mn) mn = v; } } return { w, h, d, max: mx, min: mn }; }
  function at(F, x, y) {
    if (x < 0 || y < 0 || x > F.w - 1 || y > F.h - 1) return NaN;
    const i = Math.min(Math.floor(x), F.w - 2), j = Math.min(Math.floor(y), F.h - 2), tx = x - i, ty = y - j, d = F.d, w = F.w;
    const a = d[j * w + i], b = d[j * w + i + 1], c = d[(j + 1) * w + i], e = d[(j + 1) * w + i + 1];
    if (a <= NA || b <= NA || c <= NA || e <= NA) return NaN;
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + e * tx) * ty;
  }
  function segments(F, L) {                                    // marching squares, grid coords
    const out = [], { w, h, d } = F;
    for (let j = 0; j < h - 1; j++) for (let i = 0; i < w - 1; i++) {
      const a = d[j * w + i], b = d[j * w + i + 1], c = d[(j + 1) * w + i + 1], e = d[(j + 1) * w + i];
      if (a <= NA || b <= NA || c <= NA || e <= NA) continue;
      const k = (a >= L) | (b >= L) << 1 | (c >= L) << 2 | (e >= L) << 3; if (k === 0 || k === 15) continue;
      const t = (p, q) => (L - p) / (q - p);
      const T = [i + t(a, b), j], R = [i + 1, j + t(b, c)], B = [i + t(e, c), j + 1], Lf = [i, j + t(a, e)];
      const s = (p, q) => out.push(p[0], p[1], q[0], q[1]);
      switch (k) { case 1: case 14: s(Lf, T); break; case 2: case 13: s(T, R); break; case 3: case 12: s(Lf, R); break; case 4: case 11: s(R, B); break; case 6: case 9: s(T, B); break; case 7: case 8: s(Lf, B); break; case 5: s(Lf, T); s(R, B); break; case 10: s(T, R); s(Lf, B); break; }
    }
    return out;
  }
  function profile(F, cut, n = 160) { const p = []; for (let k = 0; k <= n; k++) { const t = k / n; p.push(at(F, cut.a[0] + (cut.b[0] - cut.a[0]) * t, cut.a[1] + (cut.b[1] - cut.a[1]) * t)); } return p; }

  // ---------------------------------------------------------------- landforms for stages 1 and 2
  // domain x −1.5…1.5 (west to east), y −1…1 (south to north); A is the west end of the cut, A′ the east end
  const SW = 150, SH = 100, X = i => i / (SW - 1) * 3 - 1.5, Y = j => 1 - j / (SH - 1) * 2;
  const g2 = (x, y, cx, cy, sx, sy) => Math.exp(-(((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2));
  const j = v => v * rnd(0.88, 1.12);
  const side = m => m ? ['east', 'west'] : ['west', 'east'];
  const FORMS = {
    hill: { fn: () => { const sx = j(.8), sy = j(.52); return (x, y) => g2(x, y, 0, 0, sx, sy); },
      why: () => 'One set of rings closing on a single top: one rounded summit, sloping the same way on both sides.', tip: 'Count the summits. How many sets of rings close in on a top?' },
    twin: { fn: () => { const s = j(.44), c = s * rnd(1.02, 1.12); return (x, y) => g2(x, y, -c, 0, s, s * 1.1) + g2(x, y, c, 0, s, s * 1.1); }, saddle: [.6, .85],
      why: () => 'Most of the rings wrap both tops, and only the top one or two split in two: two summits joined by a high, shallow saddle.', tip: 'Count how many rings wrap both tops before they split. Many means the ground between them stays high.' },
    col: { fn: () => { const c = j(.8), s = j(.28); return (x, y) => g2(x, y, -c, 0, s, s * 1.3) + g2(x, y, c, 0, s, s * 1.3) + .08 * g2(x, y, 0, 0, 1.3, .55); }, saddle: [0, .14],
      why: () => 'Two separate sets of rings, joined by the lowest contour or not at all: two summits with a deep col between them.', tip: 'Count how many rings wrap both tops. None, or only the lowest, means the ground drops almost to the bottom between them.' },
    unequal: { fn: m => { const s = m ? -1 : 1; return (x, y) => .55 * g2(x, y, -.62 * s, 0, .45, .42) + g2(x, y, .62 * s, 0, .34, .38) + .2 * g2(x, y, 0, 0, 1.2, .55); },
      why: m => `Two tops, with more rings around the ${side(m)[1]} one: the ${side(m)[1]} summit is higher.`, tip: 'Count the rings around each top. More rings means higher.' },
    steep: { fn: m => { const s = m ? -1 : 1, cx = -.72 * s, a = j(.22), b = j(.95); return (x, y) => { const dx = (x - cx) * s; return Math.exp(-((dx / (dx < 0 ? a : b)) ** 2) - (y / .5) ** 2); }; },
      why: m => `Contours packed tight on the ${side(m)[0]} side and spread out to the ${side(m)[1]}: a steep face to the ${side(m)[0]} and a long gentle slope to the ${side(m)[1]}.`, tip: 'Where are the contours closest together? That is the steepest side.' },
    ramp: { fn: m => { const s = m ? -1 : 1; return (x, y) => { const u = x * s, t = Math.max(0, Math.min(1, (u + 1.3) / 2.3)); return t * (1 / (1 + Math.exp(-(1.02 - u) / .035))) * Math.exp(-((y / .55) ** 4)); }; },
      why: m => `Evenly spaced contours climbing to the ${side(m)[1]}, then all of them bunched along one edge: a steady ramp that ends in a cliff.`, tip: 'Evenly spaced contours mean an even slope. Where do they all crowd together?' },
    mesa: { fn: () => { const sx = j(.78), sy = j(.48); return (x, y) => Math.min(1, 1.75 * g2(x, y, 0, 0, sx, sy)); },
      why: () => 'Rings close together round the edge and a big empty space inside the last one: steep sides and a flat top.', tip: 'A wide gap inside the last ring means flat ground.' },
    crater: { fn: () => { const r0 = j(.55); return (x, y) => { const r = Math.hypot(x / 1.2, y / .8); return Math.exp(-(((r - r0) / .18) ** 2)) * .9 + .22 * Math.exp(-((r / .8) ** 2)) * (r > r0 ? 1 : .2); }; },
      labels: true, why: () => 'The labels rise to a ring and then fall again inside it: a rim with a hollow in the middle.', tip: 'Read the labels. Do the heights keep rising towards the middle, or fall again?' },
    pit: { fn: () => { const c = rnd(-.25, .25); return (x, y) => Math.min(1, 1.7 * g2(x, y, 0, 0, .85, .52)) - .62 * g2(x, y, c, 0, .3, .26); },
      labels: true, why: () => 'A flat-topped rise with a set of rings whose labels go down: a pit dug into the top, like a quarry.', tip: 'Some rings mark a hole, not a hill. Check whether the labels go up or down.' }
  };
  // saddle height as a share of the lower summit, along the cut (two-summit forms only)
  function saddleRatio(p) {
    const n = p.length, mid = Math.floor(n / 2), l = Math.max(...p.slice(0, mid)), r = Math.max(...p.slice(mid)), li = p.indexOf(l), ri = p.lastIndexOf(r);
    return Math.min(...p.slice(li, ri + 1)) / Math.min(l, r);
  }
  function makeForm(name, mirror, peak) {
    const f = FORMS[name]; let fn = f.fn(mirror), raw = grid(SW, SH, (i, jj) => fn(X(i), Y(jj)));
    for (let t = 0; f.saddle && t < 30; t++) {                     // keep the shallow saddle and the deep col clearly apart
      const r = saddleRatio(profile(raw, CUT1)); if (r >= f.saddle[0] && r <= f.saddle[1]) break;
      fn = f.fn(mirror); raw = grid(SW, SH, (i, jj) => fn(X(i), Y(jj)));
    }
    const k = peak / raw.max, F = grid(SW, SH, (i, jj) => Math.max(0, raw.d[jj * SW + i] * k));
    return { F, form: name, mirror, why: f.why(mirror), tip: f.tip, labels: !!f.labels };
  }
  const CUT1 = { a: [(1.5 - 1.38) / 3 * (SW - 1), (SH - 1) / 2], b: [(1.5 + 1.38) / 3 * (SW - 1), (SH - 1) / 2] };

  // ---------------------------------------------------------------- the real site: 2 m grid of the Gleniff survey
  const GD = window.GLENIFF;
  let GF = null;
  function gleniff() {
    if (GF) return GF;
    const raw = atob(GD.data), w = GD.w, h = GD.h;
    GF = grid(w, h, (i, jj) => { const v = raw.charCodeAt((h - 1 - jj) * w + i); return v === 255 ? NA : v * GD.q; });
    return GF;
  }

  // ---------------------------------------------------------------- picking cut lines that give different sections
  function signature(p) { const n = 48, out = []; for (let k = 0; k < n; k++) out.push(p[Math.round(k / (n - 1) * (p.length - 1))]); return out; }
  function differ(c1, c2, span) {
    const a = c1.sig, b = c2.sig; let s = 0; for (let k = 0; k < a.length; k++) s += (a[k] - b[k]) ** 2;
    let r = 0; for (let k = 0; k < a.length; k++) r += (a[k] - b[a.length - 1 - k]) ** 2;   // and against the other read direction
    return Math.min(Math.sqrt(s / a.length), Math.sqrt(r / a.length)) / span + Math.abs(c1.len - c2.len) / Math.max(c1.len, c2.len) * .6;
  }
  function chooseCuts(F, n, opt) {
    const span = F.max - F.min;
    for (let attempt = 0; attempt < 60; attempt++) {
      const out = [];
      for (let tries = 0; tries < 900 && out.length < n; tries++) {
        const len = rnd(opt.minLen, opt.maxLen), ang = rnd(0, Math.PI * 2), cx = rnd(opt.m, F.w - 1 - opt.m), cy = rnd(opt.m, F.h - 1 - opt.m);
        const a = [cx - Math.cos(ang) * len / 2, cy - Math.sin(ang) * len / 2], b = [cx + Math.cos(ang) * len / 2, cy + Math.sin(ang) * len / 2];
        if ([a, b].some(p => p[0] < opt.m || p[1] < opt.m || p[0] > F.w - 1 - opt.m || p[1] > F.h - 1 - opt.m)) continue;
        if (a[0] > b[0]) continue;                                            // keep A on the west so sections read west to east
        const c = { a, b, len }; c.p = profile(F, c); if (c.p.some(v => v !== v)) continue;
        const rel = Math.max(...c.p) - Math.min(...c.p); if (rel < span * opt.minRelief) continue;
        c.sig = signature(c.p);
        if (out.some(o => Math.hypot((o.a[0] + o.b[0]) / 2 - cx, (o.a[1] + o.b[1]) / 2 - cy) < opt.sep)) continue;
        if (out.some(o => differ(o, c, span) < opt.diff)) continue;
        out.push(c);
      }
      if (out.length === n) return out;
    }
    return null;
  }

  // ---------------------------------------------------------------- rounds
  const STAGES = [
    { name: 'Shapes', build: () => {
      const names = shuffle(['hill', 'twin', 'col', 'unequal', 'steep', 'ramp', 'mesa']).slice(0, 4);
      return { kind: 'pairs', plans: names.map(nm => makeForm(nm, Math.random() < .5, rnd(28, 45))), interval: 5 };
    } },
    { name: 'Read the heights', build: () => {
      const pair = pick(['steep', 'unequal', 'ramp']), hollow = pick(['crater', 'pit']);
      const rest = shuffle(['hill', 'twin', 'col', 'mesa', 'steep', 'unequal', 'ramp'].filter(n => n !== pair)).slice(0, 2);
      const plans = [makeForm(pair, false, rnd(30, 45)), makeForm(pair, true, rnd(30, 45)), makeForm(hollow, false, rnd(30, 40)), ...rest.map(nm => makeForm(nm, Math.random() < .5, rnd(28, 45)))];
      plans.forEach(p => p.labels = true);
      return { kind: 'pairs', plans: shuffle(plans), interval: 5 };
    } },
    { name: 'One hill, four cuts', build: () => {
      for (let t = 0; t < 20; t++) {
        const bumps = Array.from({ length: 5 }, () => [rnd(-1.2, 1.2), rnd(-.75, .75), rnd(.22, .55), rnd(.22, .55), rnd(.35, 1)]);
        const tilt = [rnd(-.15, .15), rnd(-.15, .15)];
        const raw = grid(SW, SH, (i, jj) => { const x = X(i), y = Y(jj); let v = .25 + tilt[0] * x + tilt[1] * y; bumps.forEach(([cx, cy, sx, sy, a]) => v += a * g2(x, y, cx, cy, sx, sy)); return v; });
        const k = 40 / (raw.max - raw.min), F = grid(SW, SH, (i, jj) => (raw.d[jj * SW + i] - raw.min) * k);
        const cuts = chooseCuts(F, 4, { minLen: 45, maxLen: 120, m: 6, sep: 18, diff: .2, minRelief: .25 });
        if (cuts) return { kind: 'cuts', F, cuts, interval: 2.5, index: 4, labels: true, unit: 300 / (SW - 1) };
      }
    } },
    { name: 'Gleniff', build: () => {
      const F = gleniff();
      let cuts = null;
      for (const diff of [.16, .12, .08]) { cuts = chooseCuts(F, 4, { minLen: 32, maxLen: 80, m: 3, sep: 16, diff, minRelief: .12 }); if (cuts) break; }
      return { kind: 'cuts', F, cuts, interval: 1, index: 5, labels: true, real: true, unit: GD.step };
    } }
  ];

  // ---------------------------------------------------------------- drawing
  function fitCanvas(cv) { const r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2); const w = Math.max(10, Math.round(r.width * dpr)), h = Math.max(10, Math.round(r.height * dpr)); if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } return { w, h, dpr }; }
  function drawPlan(cv, F, opts) {
    const { w, h, dpr } = fitCanvas(cv), c = cv.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = css('--paper'); c.fillRect(0, 0, w, h);
    const sx = w / (F.w - 1), sy = h / (F.h - 1), P = (x, y) => [x * sx, y * sy];
    if (opts.real) {                                                        // outside the survey
      c.fillStyle = css('--stage');
      for (let jj = 0; jj < F.h; jj++) for (let i = 0; i < F.w; i++) if (F.d[jj * F.w + i] <= NA) c.fillRect((i - .5) * sx, (jj - .5) * sy, sx + 1, sy + 1);
    }
    const iv = opts.interval, idx = opts.index || 0, labs = [];
    const start = Math.ceil((F.min + 1e-6) / iv) * iv || iv;
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (let L = Math.max(start, iv * (opts.real ? 0 : 0.8)); L <= F.max; L += iv) {
      const s = segments(F, L), heavy = idx ? Math.abs(L / (iv * idx) - Math.round(L / (iv * idx))) < 1e-6 : false;
      c.strokeStyle = css(opts.real ? '--contour' : '--ink'); c.lineWidth = (heavy ? 1.6 : opts.real ? .7 : 1.15) * dpr; c.globalAlpha = opts.real && !heavy ? .75 : 1;
      c.beginPath(); for (let k = 0; k < s.length; k += 4) { const p = P(s[k], s[k + 1]), q = P(s[k + 2], s[k + 3]); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); } c.stroke();
      c.globalAlpha = 1;
      if (opts.labels && (!idx || heavy) && s.length) labs.push({ L, s });
    }
    if (opts.features) drawFeatures(c, opts.features, F, sx, sy, dpr);
    // contour labels, kept apart and clear of the edges
    if (labs.length) {
      c.font = `500 ${10 * dpr}px "IBM Plex Mono", monospace`; c.textAlign = 'center'; c.textBaseline = 'middle';
      const placed = [], gap = 54 * dpr;
      labs.forEach(({ L, s }) => {
        let n = 0; const order = seeded(Array.from({ length: s.length / 4 }, (_, k) => k * 4), Math.round(L * 100) + 7).slice(0, 400);   // same spots on every redraw
        for (const k of order) {
          if (n >= (opts.real ? 2 : 1)) break;
          const mx = (s[k] + s[k + 2]) / 2 * sx, my = (s[k + 1] + s[k + 3]) / 2 * sy;
          if (mx < 16 * dpr || my < 12 * dpr || mx > w - 16 * dpr || my > h - 12 * dpr) continue;
          if (placed.some(p => (p[0] - mx) ** 2 + (p[1] - my) ** 2 < gap * gap)) continue;
          if (opts.avoid && opts.avoid.some(cut => distSeg(mx / sx, my / sy, cut) * sx < 14 * dpr)) continue;
          placed.push([mx, my]); n++;
          let ang = Math.atan2((s[k + 3] - s[k + 1]) * sy, (s[k + 2] - s[k]) * sx); if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI;
          const t = (opts.real ? '+' : '') + (Math.round(L * 10) / 10);
          c.save(); c.translate(mx, my); c.rotate(ang); const tw = c.measureText(t).width + 6 * dpr;
          c.fillStyle = css('--paper'); c.fillRect(-tw / 2, -6 * dpr, tw, 12 * dpr); c.fillStyle = css(opts.real ? '--contour' : '--ink'); c.fillText(t, 0, 0); c.restore();
        }
      });
    }
    (opts.cuts || []).forEach((cut, k) => drawCut(c, cut, opts.letters ? opts.letters[k] : 'A', sx, sy, dpr));
  }
  function distSeg(x, y, cut) { const [ax, ay] = cut.a, [bx, by] = cut.b, dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy))); return Math.hypot(x - ax - t * dx, y - ay - t * dy); }
  function drawCut(c, cut, L, sx, sy, dpr) {
    const a = [cut.a[0] * sx, cut.a[1] * sy], b = [cut.b[0] * sx, cut.b[1] * sy];
    c.save(); c.strokeStyle = css('--cut'); c.lineWidth = 2 * dpr; c.setLineDash([7 * dpr, 4 * dpr]);
    c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); c.setLineDash([]);
    const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d;
    [[a, L, -1], [b, L + '′', 1]].forEach(([p, t, s]) => {
      const cx = p[0] + ux * s * 11 * dpr, cy = p[1] + uy * s * 11 * dpr;
      c.fillStyle = css('--cut'); c.beginPath(); c.arc(cx, cy, 9 * dpr, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff'; c.font = `600 ${10.5 * dpr}px "IBM Plex Mono", monospace`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t, cx, cy + .5 * dpr);
    });
    c.restore();
  }
  function drawFeatures(c, feats, F, sx, sy, dpr) {
    const P = ([x, y]) => [x / GD.step * sx, (F.h - 1 - y / GD.step) * sy];
    feats.forEach(f => {
      c.save(); c.beginPath(); f.pts.forEach((p, k) => { const q = P(p); k ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); });
      if (f.kind === 'building') { c.closePath(); c.strokeStyle = css('--ink'); c.setLineDash([3 * dpr, 2 * dpr]); c.lineWidth = 1 * dpr; }
      else if (f.kind === 'water') { c.strokeStyle = css('--engrave'); c.lineWidth = 2 * dpr; c.globalAlpha = .8; }
      else { c.strokeStyle = css('--muted'); c.lineWidth = 2.4 * dpr; c.globalAlpha = .6; }
      c.stroke(); c.restore();
    });
  }
  // a section: ground filled solid, A at the left; scale shared across the round so heights and lengths compare
  function drawSection(cv, sec, R, letter) {
    const { w, h, dpr } = fitCanvas(cv), c = cv.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = css('--paper'); c.fillRect(0, 0, w, h);
    const padL = 18 * dpr, padR = 22 * dpr, top = 12 * dpr, base = h - 16 * dpr, iw = w - padL - padR;
    const len = sec.len / R.maxLen * iw, p = sec.p, lo = R.lo, hi = R.hi;
    const Yv = v => base - (v - lo) / (hi - lo) * (base - top) * .92 - (base - top) * .04;
    c.beginPath(); c.moveTo(padL, base);
    p.forEach((v, k) => c.lineTo(padL + k / (p.length - 1) * len, Yv(v)));
    c.lineTo(padL + len, base); c.closePath(); c.fillStyle = css('--ink'); c.fill();
    c.strokeStyle = css('--rule'); c.lineWidth = 1 * dpr; c.beginPath(); c.moveTo(padL - 6 * dpr, base + .5); c.lineTo(w - 6 * dpr, base + .5); c.stroke();
    c.fillStyle = css('--muted'); c.font = `500 ${10 * dpr}px "IBM Plex Mono", monospace`; c.textBaseline = 'top';
    c.textAlign = 'center'; c.fillText(letter || 'W', padL, base + 3 * dpr); c.fillText(letter ? letter + '′' : 'E', padL + len, base + 3 * dpr);
  }

  // ---------------------------------------------------------------- game state
  let stage = 0, R = null, sel = null, rounds = 0, best = {};
  try { best = JSON.parse(localStorage.getItem('contour-match-best') || '{}') || {}; } catch (e) { best = {}; }
  const LET = ['A', 'B', 'C', 'D', 'E'];

  function newRound() {
    const st = STAGES[stage]; let built = st.build(); if (!built) built = st.build();
    R = Object.assign(built, { miss: 0, matched: 0, slots: [], cards: [] });
    if (R.kind === 'pairs') {
      R.plans.forEach((pl, k) => { pl.cut = CUT1; pl.p = profile(pl.F, CUT1); pl.len = CUT1.b[0] - CUT1.a[0]; pl.key = 'p' + k; pl.tries = 0; });
      R.secs = R.plans.map(pl => ({ key: pl.key, p: pl.p, len: pl.len }));
      R.lo = 0; R.hi = Math.max(...R.plans.map(pl => Math.max(...pl.p)));
    } else {
      R.cuts.forEach((ct, k) => { ct.key = LET[k]; ct.tries = 0; });
      R.secs = R.cuts.map(ct => ({ key: ct.key, p: ct.p, len: ct.len }));
      const all = R.cuts.flatMap(ct => ct.p); R.lo = Math.min(...all); R.hi = Math.max(...all);
    }
    R.maxLen = Math.max(...R.secs.map(s => s.len));
    R.order = shuffle(R.secs.map((s, k) => k));
    sel = null; render(); score();
    $('done').hidden = true;
  }

  function render() {
    const plans = $('plans'), cards = $('cards'); plans.innerHTML = ''; cards.innerHTML = '';
    plans.classList.toggle('single', R.kind === 'cuts');
    if (R.kind === 'pairs') {
      R.plans.forEach((pl, k) => {
        const sh = document.createElement('div'); sh.className = 'sheet';
        sh.innerHTML = `<div class="phead"><span class="lbl">Plan ${k + 1}</span><span class="lbl">contours every ${R.interval} m</span></div><canvas aria-label="Contour plan ${k + 1} with cut line A to A′"></canvas>
          <div class="slots"><button type="button" class="slot" data-key="${pl.key}" aria-label="Section for plan ${k + 1}"><span class="hint">Drop the section for plan ${k + 1}</span></button></div><p class="why" id="why-${pl.key}"></p>`;
        plans.appendChild(sh);
      });
      $('trayNote').textContent = 'All sections share one vertical scale, so a taller silhouette is a higher landform.';
    } else {
      const sh = document.createElement('div'); sh.className = 'sheet big' + (R.real ? '' : '');
      const head = R.real ? `<span class="lbl">Gleniff Barytes Mill · drone lidar survey</span><span class="lbl">contours every 1 m · heights above the lowest ground</span>` : `<span class="lbl">One landform, four cuts</span><span class="lbl">contours every ${R.interval} m</span>`;
      sh.innerHTML = `<div class="phead">${head}</div><canvas aria-label="Contour plan with cut lines A to D"></canvas>
        <div class="slots multi">${R.cuts.map(ct => `<button type="button" class="slot" data-key="${ct.key}" aria-label="Section ${ct.key} to ${ct.key}′"><span class="tag">${ct.key}–${ct.key}′</span><span class="hint">Drop section ${ct.key}–${ct.key}′</span></button>`).join('')}</div><p class="why" id="why-cuts"></p>`;
      plans.appendChild(sh);
      const vex = verticalExaggeration();
      $('trayNote').textContent = `Every cut runs west (W) to east (E), so each section starts at its plain letter. All are drawn at one scale: a longer cut gives a longer section. Heights ×${vex}.`;
    }
    R.order.forEach((si, n) => {
      const s = R.secs[si], b = document.createElement('button');
      b.type = 'button'; b.className = 'card'; b.dataset.key = s.key; b.setAttribute('aria-pressed', 'false'); b.setAttribute('aria-label', `Section ${n + 1}`);
      b.innerHTML = `<span class="tag">${n + 1}</span><canvas></canvas>`; cards.appendChild(b);
      R.cards.push(b);
    });
    $('trayLbl').textContent = `Sections · ${R.secs.length} to place`;
    bind(); paint();
  }
  function verticalExaggeration() {
    // horizontal: section px per grid unit; vertical: px per metre. Report heights relative to lengths.
    const cv = R.cards[0] && R.cards[0].querySelector('canvas'); const w = cv ? cv.getBoundingClientRect().width || 260 : 260, h = w / 3;
    const hpx = (w - 40) / (R.maxLen * R.unit), vpx = (h - 28) * .92 / (R.hi - R.lo);
    const v = vpx / hpx; return v >= 10 ? Math.round(v) : Math.round(v * 2) / 2;
  }
  function paint() {
    if (!R) return;
    const sheets = $('plans').querySelectorAll('.sheet > canvas');   // the plan drawings only, not sections already placed in slots
    if (R.kind === 'pairs') R.plans.forEach((pl, k) => drawPlan(sheets[k], pl.F, { interval: R.interval, labels: pl.labels, cuts: [pl.cut], avoid: [pl.cut] }));
    else drawPlan(sheets[0], R.F, { interval: R.interval, index: R.index, labels: true, real: R.real, cuts: R.cuts, letters: R.cuts.map(c => c.key), avoid: R.cuts, features: R.real ? GD.features : null });
    R.cards.forEach(b => { const s = R.secs.find(x => x.key === b.dataset.key); drawSection(b.querySelector('canvas'), s, R, R.kind === 'pairs' ? 'A' : null); });
    document.querySelectorAll('.slot.ok canvas').forEach(cv => { const s = R.secs.find(x => x.key === cv.dataset.key); drawSection(cv, s, R, R.kind === 'pairs' ? 'A' : cv.dataset.key); });
  }

  // ---------------------------------------------------------------- drag, tap and keyboard
  let drag = null;
  function bind() {
    R.cards.forEach(b => {
      b.addEventListener('pointerdown', e => {
        if (e.button > 0) return;
        drag = { b, x: e.clientX, y: e.clientY, moved: false, ghost: null, id: e.pointerId };
        b.setPointerCapture(e.pointerId);
      });
      b.addEventListener('pointermove', e => {
        if (!drag || drag.b !== b) return;
        if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6) {
          drag.moved = true; const r = b.getBoundingClientRect(), g = document.createElement('div'); g.className = 'ghost'; g.style.width = r.width + 'px';
          const src = b.querySelector('canvas'), cv = document.createElement('canvas'); cv.width = src.width; cv.height = src.height; cv.getContext('2d').drawImage(src, 0, 0); g.appendChild(cv);
          document.body.appendChild(g); drag.ghost = g; drag.off = [e.clientX - r.left, e.clientY - r.top]; b.style.opacity = .35;
        }
        if (drag.moved) {
          drag.ghost.style.left = (e.clientX - drag.off[0]) + 'px'; drag.ghost.style.top = (e.clientY - drag.off[1]) + 'px';
          const s = slotAt(e.clientX, e.clientY); document.querySelectorAll('.slot.hot').forEach(x => x !== s && x.classList.remove('hot')); if (s && !s.classList.contains('ok')) s.classList.add('hot');
        }
      });
      const end = e => {
        if (!drag || drag.b !== b) return;
        const d = drag; drag = null; b.style.opacity = '';
        document.querySelectorAll('.slot.hot').forEach(x => x.classList.remove('hot'));
        if (d.ghost) { d.ghost.remove(); const s = e.type === 'pointerup' ? slotAt(e.clientX, e.clientY) : null; if (s) place(b, s); else back(b); }
        else if (e.type === 'pointerup') select(b);
      };
      b.addEventListener('pointerup', end); b.addEventListener('pointercancel', end);
      b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(b); } });
    });
    document.querySelectorAll('.slot').forEach(s => {
      s.addEventListener('click', () => { if (sel && !s.classList.contains('ok')) place(sel, s); });
    });
  }
  function slotAt(x, y) { const el = document.elementFromPoint(x, y); return el ? el.closest('.slot') : null; }
  function select(b) {
    if (sel === b) { b.setAttribute('aria-pressed', 'false'); sel = null; say('Section put back.'); return; }
    if (sel) sel.setAttribute('aria-pressed', 'false');
    sel = b; b.setAttribute('aria-pressed', 'true'); say('Section selected. Now choose a plan.');
    document.querySelectorAll('.slot:not(.ok)').forEach(s => s.querySelector('.hint') && (s.querySelector('.hint').textContent = R.kind === 'pairs' ? 'Tap to place it here' : `Tap to place it on ${s.dataset.key}–${s.dataset.key}′`));
  }
  function back(b) { b.classList.remove('back'); void b.offsetWidth; b.classList.add('back'); }
  function say(t) { $('live').textContent = t; }

  function place(b, s) {
    if (s.classList.contains('ok')) return;
    const key = s.dataset.key, right = b.dataset.key === key, item = R.kind === 'pairs' ? R.plans.find(p => p.key === key) : R.cuts.find(c => c.key === key);
    if (sel) { sel.setAttribute('aria-pressed', 'false'); sel = null; }
    resetHints();
    if (right) {
      s.classList.add('ok'); s.innerHTML = (R.kind === 'cuts' ? `<span class="tag">${key}–${key}′</span>` : '') + `<canvas data-key="${key}"></canvas>`;
      b.classList.add('gone'); R.matched++;
      const why = R.kind === 'pairs' ? $('why-' + key) : $('why-cuts');
      why.className = 'why good'; why.textContent = R.kind === 'pairs' ? item.why : cutWhy(item);
      paint(); say('Correct. ' + why.textContent);
      if (R.matched === R.secs.length) finish();
    } else {
      item.tries++; R.miss++;
      s.classList.remove('bad'); void s.offsetWidth; s.classList.add('bad'); setTimeout(() => s.classList.remove('bad'), 450);
      const why = R.kind === 'pairs' ? $('why-' + key) : $('why-cuts');
      why.className = 'why tip'; why.textContent = R.kind === 'pairs' ? item.tip : cutTip(item);
      back(b); say('Not that one. ' + why.textContent);
    }
    score();
  }
  function resetHints() { document.querySelectorAll('.slot:not(.ok) .hint').forEach(h => { const s = h.closest('.slot'); h.textContent = R.kind === 'pairs' ? `Drop the section for plan ${[...document.querySelectorAll('.sheet')].indexOf(s.closest('.sheet')) + 1}` : `Drop section ${s.dataset.key}–${s.dataset.key}′`; }); }
  const metres = (ct) => Math.round(ct.len * R.unit);
  function hiAt(ct) { let k = 0; ct.p.forEach((v, i) => { if (v > ct.p[k]) k = i; }); return { k, v: ct.p[k], d: Math.round(k / (ct.p.length - 1) * ct.len * R.unit) }; }
  function cutWhy(ct) { const h = hiAt(ct), lo = Math.min(...ct.p); return `${ct.key}–${ct.key}′ is ${metres(ct)} m long and climbs ${(h.v - lo).toFixed(1)} m, highest ${h.d} m from ${ct.key}.`; }
  function cutTip(ct) { const h = hiAt(ct), near = h.k / (ct.p.length - 1); return `Line ${ct.key} is ${metres(ct)} m long and its highest ground is ${near < .33 ? `near ${ct.key}` : near > .67 ? `near ${ct.key}′` : 'in the middle'}. Compare the section's length and where it peaks.`; }

  function score() {
    $('sMatched').textContent = `${R.matched}/${R.secs.length}`; $('sMiss').textContent = R.miss; $('sRounds').textContent = rounds;
  }
  function finish() {
    rounds++; score();
    const st = R.miss === 0 ? 3 : R.miss <= 2 ? 2 : 1;
    $('stars').textContent = '★'.repeat(st) + '☆'.repeat(3 - st);
    $('doneTitle').textContent = st === 3 ? 'Every section first time' : st === 2 ? 'Round cleared' : 'Round cleared: try another';
    $('doneText').textContent = `${R.secs.length} sections placed with ${R.miss} mistake${R.miss === 1 ? '' : 's'}. ${stage < 3 ? 'Play another round or move on to the next stage.' : 'Every Gleniff round uses new cut lines through the real survey.'}`;
    $('next').hidden = stage >= 3;
    best[stage] = Math.max(best[stage] || 0, st);
    try { localStorage.setItem('contour-match-best', JSON.stringify(best)); } catch (e) { }
    marks(); $('done').hidden = false; $('done').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
  }
  function marks() {
    document.querySelectorAll('[data-stage]').forEach(b => b.querySelector('b').classList.toggle('done', !!best[+b.dataset.stage]));
    const got = Object.keys(best).length; $('best').textContent = got ? `Stages cleared on this device: ${got} of 4` : '';
  }
  function setStage(s) { stage = s; document.querySelectorAll('[data-stage]').forEach(b => b.setAttribute('aria-pressed', +b.dataset.stage === s)); newRound(); }
  document.querySelectorAll('[data-stage]').forEach(b => b.onclick = () => setStage(+b.dataset.stage));
  $('again').onclick = () => newRound();
  $('next').onclick = () => { setStage(Math.min(3, stage + 1)); window.scrollTo({ top: 0, behavior: 'auto' }); };
  let rt = 0; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(paint, 120); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => setTimeout(paint, 50));
  new MutationObserver(() => setTimeout(paint, 50)).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  marks(); setStage(0);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(paint);
})();
