/* Shared survey + plan-drawing helpers for the Gleniff site pages. */
window.loadGleniff = async function () {
  'use strict';
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const $ = id => document.getElementById(id);
  const DATUM = 103.86;               // level 0 = the lowest ground of the survey (STL z 519.3 mm × 0.2)
  const W = 1688, H = 1207;            // survey extent in model mm (1:200)
  const M2R = 0.2;                     // model mm -> real m

  // ---------- data
  let dem;
  try { dem = await (await fetch('data/dem.json')).json(); }
  catch (e) {
    document.querySelectorAll('canvas').forEach(c => c.insertAdjacentHTML('afterend',
      '<p class="small" style="padding:16px">The interactive drawings need the site served over http (GitHub Pages or a local server).</p>'));
    return null;
  }
  const raw = Uint8Array.from(atob(dem.data), c => c.charCodeAt(0));
  const u16 = new Uint16Array(raw.buffer);
  const GW = dem.w, GH = dem.h, ST = dem.step_mm;
  const Hm = new Float32Array(GW * GH);
  for (let i = 0; i < Hm.length; i++) Hm[i] = u16[i] === 0 ? NaN : dem.offset_m + u16[i] * dem.scale - DATUM;   // levels relative to the site datum
  const at = (i, j) => Hm[i * GW + j];                       // row i (y), col j (x)
  function height(x, y) {                                     // model mm -> real m, bilinear
    const fx = x / ST, fy = y / ST, j = Math.floor(fx), i = Math.floor(fy);
    if (i < 0 || j < 0 || i >= GH - 1 || j >= GW - 1) return NaN;
    const tx = fx - j, ty = fy - i;
    const a = at(i, j), b = at(i, j + 1), c = at(i + 1, j), d = at(i + 1, j + 1);
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  }
  const hill = new Image(); hill.src = 'img/hillshade.png';
  await new Promise(r => { hill.onload = r; hill.onerror = r; });

  // ---------- marching squares (segments, model mm)
  const segCache = {};
  function contour(L) {
    if (segCache[L]) return segCache[L];
    const out = [];
    const lerp = (p, q, vp, vq) => p + (q - p) * ((L - vp) / (vq - vp));
    for (let i = 0; i < GH - 1; i++) for (let j = 0; j < GW - 1; j++) {
      const a = at(i, j), b = at(i, j + 1), c = at(i + 1, j + 1), d = at(i + 1, j);
      if (a !== a || b !== b || c !== c || d !== d) continue;
      const k = (a >= L ? 8 : 0) | (b >= L ? 4 : 0) | (c >= L ? 2 : 0) | (d >= L ? 1 : 0);
      if (k === 0 || k === 15) continue;
      const x = j * ST, y = i * ST;
      const T = [lerp(x, x + ST, a, b), y], R = [x + ST, lerp(y, y + ST, b, c)];
      const B = [lerp(x, x + ST, d, c), y + ST], Lf = [x, lerp(y, y + ST, a, d)];
      const s = (p, q) => out.push(p[0], p[1], q[0], q[1]);
      switch (k) {
        case 1: case 14: s(Lf, B); break; case 2: case 13: s(B, R); break;
        case 3: case 12: s(Lf, R); break; case 4: case 11: s(T, R); break;
        case 5: s(Lf, T); s(B, R); break; case 6: case 9: s(T, B); break;
        case 7: case 8: s(Lf, T); break; case 10: s(T, R); s(Lf, B); break;
      }
    }
    return (segCache[L] = new Float32Array(out));
  }

  // ---------- site features (model mm, north up)
  const RIVER = [[319, 300], [312, 400], [275, 500], [219, 600], [166, 700], [125, 800], [128, 900], [110, 1000], [120, 1100], [122, 1180]];
  const TRIB = [[1615, 324], [1475, 319], [1375, 373], [1225, 404], [1139, 393], [1061, 451], [985, 555], [865, 625], [806, 690], [720, 787], [643, 817], [555, 832], [475, 851], [395, 905]];
  const ROAD = [[330, 1207], [350, 1100], [365, 1000], [380, 900], [395, 800], [400, 700], [405, 620], [430, 560], [520, 505], [640, 455], [1000, 255], [1400, 40], [1470, 0]];
  const MILL = { x: 412, y: 590, w: 153, h: 175, cx: 488, cy: 677 };

  // ---------- plan view helper
  function Plan(canvas, opts = {}) {
    const ctx = canvas.getContext('2d');
    const P = { canvas, ctx, pad: 10, s: 1, dpr: 1, draw: null };
    P.size = () => {
      const w = canvas.parentElement.clientWidth || 600;
      P.dpr = Math.min(devicePixelRatio || 1, 2);
      P.s = (w - 2 * P.pad) / W;
      const h = Math.round(H * P.s + 2 * P.pad);
      canvas.width = Math.round(w * P.dpr); canvas.height = Math.round(h * P.dpr);
      canvas.style.height = h + 'px';
    };
    P.X = x => P.pad + x * P.s;
    P.Y = y => P.pad + (H - y) * P.s;
    P.inv = (px, py) => [(px - P.pad) / P.s, H - (py - P.pad) / P.s];
    P.base = (o = {}) => {
      const c = ctx; c.setTransform(P.dpr, 0, 0, P.dpr, 0, 0);
      c.clearRect(0, 0, canvas.width, canvas.height);
      c.fillStyle = css('--paper'); c.fillRect(0, 0, canvas.width, canvas.height);
      const dark = isDark(); c.globalAlpha = (o.shadeAlpha ?? 0.85) * (dark ? 0.45 : 1); c.drawImage(hill, P.X(0), P.Y(H), W * P.s, H * P.s); c.globalAlpha = 1;
      const ink = css('--ink'), cut = css('--cut');
      for (let L = 1; L <= 38; L++) {
        const idx = L % 5 === 0;
        P.segs(contour(L), idx ? cut : ink, idx ? 1.1 : 0.45, (o.contourAlpha ?? 1) * (idx ? 0.9 : 0.45));
      }
      if (o.labels !== false) P.labels();
    };
    P.segs = (sg, col, lw, alpha = 1) => {
      const c = ctx; c.strokeStyle = col; c.lineWidth = lw; c.globalAlpha = alpha; c.beginPath();
      for (let k = 0; k < sg.length; k += 4) { c.moveTo(P.X(sg[k]), P.Y(sg[k + 1])); c.lineTo(P.X(sg[k + 2]), P.Y(sg[k + 3])); }
      c.stroke(); c.globalAlpha = 1;
    };
    P.labels = () => {
      const c = ctx, fs = P.s < 0.3 ? 8.5 : Math.max(9, Math.min(11, 9 * P.s / 0.45));
      c.font = `500 ${fs}px "IBM Plex Mono", monospace`; c.textAlign = 'center'; c.textBaseline = 'middle';
      const placed = [];
      const lstep = P.s < 0.3 ? 10 : 5;
      for (let L = 10 - (lstep === 5 ? 5 : 0); L <= 35; L += lstep) {
        const sg = contour(L);
        for (let ax = 150; ax < W; ax += 330) for (let ay = 150; ay < H; ay += 330) {
          let best = -1, bd = 70 * 70;
          for (let k = 0; k < sg.length; k += 4) {
            const mx = (sg[k] + sg[k + 2]) / 2, my = (sg[k + 1] + sg[k + 3]) / 2, d = (mx - ax) ** 2 + (my - ay) ** 2;
            if (d < bd) { bd = d; best = k; }
          }
          if (best < 0) continue;
          const mx = (sg[best] + sg[best + 2]) / 2, my = (sg[best + 1] + sg[best + 3]) / 2;
          if (placed.some(p => (p[0] - mx) ** 2 + (p[1] - my) ** 2 < 110 * 110)) continue;
          placed.push([mx, my]);
          let ang = Math.atan2(-(sg[best + 3] - sg[best + 1]), sg[best + 2] - sg[best]);
          if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI;
          c.save(); c.translate(P.X(mx), P.Y(my)); c.rotate(ang);
          const tw = c.measureText(L).width + 6;
          c.fillStyle = css('--paper'); c.fillRect(-tw / 2, -fs / 2 - 1, tw, fs + 2);
          c.fillStyle = css('--cut'); c.fillText(L, 0, 0.5); c.restore();
        }
      }
    };
    P.line = (pts, col, lw, dash) => {
      const c = ctx; c.strokeStyle = col; c.lineWidth = lw; c.setLineDash(dash || []); c.lineJoin = 'round'; c.lineCap = 'round';
      c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(P.X(p[0]), P.Y(p[1])) : c.moveTo(P.X(p[0]), P.Y(p[1]))); c.stroke(); c.setLineDash([]);
    };
    P.tag = (x, y, text, bg, fg) => {
      const c = ctx; c.font = '600 11px "IBM Plex Mono", monospace'; c.textBaseline = 'middle'; c.textAlign = 'left';
      const tw = c.measureText(text).width + 10, px = P.X(x), py = P.Y(y);
      c.fillStyle = bg; c.fillRect(px, py - 9, tw, 18); c.fillStyle = fg; c.fillText(text, px + 5, py + 0.5);
    };
    P.north = () => {
      const c = ctx, x = P.X(W) - 26, y = P.Y(H) + 34;
      c.fillStyle = css('--ink'); c.beginPath(); c.moveTo(x, y - 18); c.lineTo(x + 7, y + 4); c.lineTo(x, y - 1); c.lineTo(x - 7, y + 4); c.closePath(); c.fill();
      c.font = '600 11px "IBM Plex Mono", monospace'; c.textAlign = 'center'; c.fillText('N', x, y + 16);
    };
    P.scalebar = () => {
      const c = ctx, x = P.X(40), y = P.Y(40), len = 100 * P.s; // 100 mm = 20 m
      c.fillStyle = css('--ink'); c.fillRect(x, y - 3, len / 2, 4); c.strokeStyle = css('--ink'); c.lineWidth = 1; c.strokeRect(x, y - 3, len, 4);
      c.font = '500 10px "IBM Plex Mono", monospace'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText('20 m', x + len + 6, y - 1);
    };
    P.mill = (active) => {
      const c = ctx; c.strokeStyle = active ? css('--gold') : css('--ink'); c.lineWidth = active ? 3 : 1.5; c.setLineDash(active ? [] : [4, 3]);
      c.strokeRect(P.X(MILL.x), P.Y(MILL.y + MILL.h), MILL.w * P.s, MILL.h * P.s); c.setLineDash([]);
      P.tag(MILL.x + 4, MILL.y + MILL.h + 18, 'Mill', active ? css('--gold') : css('--ink'), active ? '#1d2120' : css('--paper'));
    };
    P.road = (alpha = 0.9) => { ctx.globalAlpha = alpha; P.line(ROAD, isDark() ? '#8d9492' : '#5b625f', 4.5); P.line(ROAD, css('--paper'), 2.2); ctx.globalAlpha = 1; };
    P.water = (alpha = 1) => { P.road(); ctx.globalAlpha = alpha; P.line(RIVER, css('--water'), 3); P.line(TRIB, css('--water'), 2.2); ctx.globalAlpha = 1; };
    return P;
  }
  function isDark() { const m = css('--paper').match(/#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i); return m ? (parseInt(m[1], 16) + parseInt(m[2], 16) + parseInt(m[3], 16)) / 3 < 100 : false; }
  return { css, $, W, H, M2R, GW, GH, ST, Hm, at, height, contour, Plan, RIVER, TRIB, ROAD, MILL, isDark, hill };
};
