(async function () {
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
    return;
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
  const plans = [];
  const redrawAll = () => plans.forEach(p => { p.size(); p.draw(); });

  // ================= 01 LAYERS =================
  // The hill built from 1 m sheets of board, like the student model. The slider sets how many sheets are stacked;
  // the edge of the top sheet is the contour at that level.
  const lvl = $('lvl');
  const qOf = (h, L) => Math.min(Math.floor(h + 1e-6), L);           // which sheet a point sits on
  const tone = (q, L) => q >= L ? css('--sheet-top') : (q % 2 ? css('--sheet-a') : css('--sheet-b'));
  const slicePlan = Plan($('slicePlan'));
  slicePlan.draw = () => {
    const L = +lvl.value, P = slicePlan, c = P.ctx;
    P.base({ contourAlpha: 0, labels: false });
    const cs = P.s * ST + 0.6;
    for (let i = 0; i < GH; i++) for (let j = 0; j < GW; j++) {
      const h = at(i, j); if (h !== h) continue;
      c.fillStyle = tone(qOf(h, L), L);
      c.fillRect(P.X(j * ST) - P.s * ST / 2, P.Y(i * ST) - P.s * ST / 2, cs, cs);
    }
    for (let k = 1; k < L; k++) P.segs(contour(k), css('--ink'), k % 5 ? 0.6 : 1.1, k % 5 ? 0.35 : 0.6);
    P.segs(contour(L), css('--cut'), 2.6, 1);
    P.water(0.6); P.mill(false); P.north();
  };
  plans.push(slicePlan);

  // 3D
  const stage = $('sliceStage'), glc = $('sliceGL');
  let render3d = () => {};
  if (window.THREE) {
    const renderer = new THREE.WebGLRenderer({ canvas: glc, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(30, 1, 10, 40000);
    const ctl = new THREE.OrbitControls(cam, glc); ctl.enableDamping = true; ctl.maxPolarAngle = Math.PI * 0.49;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x80857f, 0.6));
    const sun = new THREE.DirectionalLight(0xfff4e6, 0.75); sun.position.set(-800, 1200, -600); scene.add(sun);
    const Yof = h => h * 5;   // relative level (m) -> model mm
    // ghost of the real ground, so the steps can be compared with the hill they stand for
    const pos = new Float32Array(GW * GH * 3), idx = [];
    for (let i = 0; i < GH; i++) for (let j = 0; j < GW; j++) {
      const h = at(i, j), k = (i * GW + j) * 3;
      pos[k] = j * ST - W / 2; pos[k + 1] = h === h ? Yof(h) : 0; pos[k + 2] = -(i * ST - H / 2);
    }
    for (let i = 0; i < GH - 1; i++) for (let j = 0; j < GW - 1; j++) {
      const a = i * GW + j, b = a + 1, c = a + GW, d = c + 1;
      if (at(i, j) !== at(i, j) || at(i, j + 1) !== at(i, j + 1) || at(i + 1, j) !== at(i + 1, j) || at(i + 1, j + 1) !== at(i + 1, j + 1)) continue;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const ghostMat = new THREE.MeshStandardMaterial({ color: 0x7d827c, roughness: 0.95, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide });
    const ghost = new THREE.Mesh(g, ghostMat); ghost.renderOrder = 2; scene.add(ghost);
    // stepped board model
    const stepMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    let steps = null;
    const col = new THREE.Color();
    const buildSteps = L => {
      const P = [], C = [];
      const half = ST / 2, ok = (i, j) => i >= 0 && j >= 0 && i < GH && j < GW && at(i, j) === at(i, j);
      const quad = (a, b, c, d, cl) => { P.push(...a, ...b, ...c, ...a, ...c, ...d); for (let n = 0; n < 6; n++) C.push(cl.r, cl.g, cl.b); };
      const shade = (q, k) => { col.set(tone(q, L)); return col.clone().multiplyScalar(k); };
      for (let i = 0; i < GH; i++) for (let j = 0; j < GW; j++) {
        if (!ok(i, j)) continue;
        const q = qOf(at(i, j), L), y = Yof(q), x = j * ST - W / 2, z = -(i * ST - H / 2);
        quad([x - half, y, z + half], [x + half, y, z + half], [x + half, y, z - half], [x - half, y, z - half], shade(q, 1));
        // risers to the east and south neighbours (and to the edge of the survey)
        for (const [di, dj] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
          const ni = i + di, nj = j + dj, nq = ok(ni, nj) ? qOf(at(ni, nj), L) : -1;
          if (nq >= q) continue;
          const y0 = Yof(Math.max(nq, -1)), cl = shade(q, 0.72);
          if (dj === 1) quad([x + half, y0, z + half], [x + half, y0, z - half], [x + half, y, z - half], [x + half, y, z + half], cl);
          if (dj === -1) quad([x - half, y0, z - half], [x - half, y0, z + half], [x - half, y, z + half], [x - half, y, z - half], cl);
          if (di === 1) quad([x + half, y0, z - half], [x - half, y0, z - half], [x - half, y, z - half], [x + half, y, z - half], cl);
          if (di === -1) quad([x - half, y0, z + half], [x + half, y0, z + half], [x + half, y, z + half], [x - half, y, z + half], cl);
        }
      }
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); sg.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
      sg.computeVertexNormals();
      return new THREE.Mesh(sg, stepMat);
    };
    const lineMat = new THREE.LineBasicMaterial({ color: 0xc0432a });
    let lines = null;
    const setLevel = L => {
      if (steps) { scene.remove(steps); steps.geometry.dispose(); }
      steps = buildSteps(L); scene.add(steps);
      if (lines) { scene.remove(lines); lines.geometry.dispose(); }
      const sg = contour(L), p = new Float32Array(sg.length / 2 * 3);
      for (let k = 0, m = 0; k < sg.length; k += 2, m += 3) { p[m] = sg[k] - W / 2; p[m + 1] = Yof(L) + 0.8; p[m + 2] = -(sg[k + 1] - H / 2); }
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(p, 3));
      lines = new THREE.LineSegments(lg, lineMat); lines.renderOrder = 3; scene.add(lines);
    };
    let moved = false; ctl.addEventListener('start', () => moved = true);
    const fit = () => {
      const r = stage.getBoundingClientRect();
      renderer.setSize(r.width, r.height, false); cam.aspect = r.width / Math.max(1, r.height); cam.updateProjectionMatrix();
      if (!moved) {
        const vf = THREE.MathUtils.degToRad(cam.fov) / 2, hf = Math.atan(Math.tan(vf) * cam.aspect);
        const d = 780 / Math.sin(Math.min(vf, hf));
        cam.position.copy(new THREE.Vector3(-0.45, 0.62, 0.64).normalize().multiplyScalar(d)); ctl.target.set(0, 60, 0); ctl.update();
      }
    };
    render3d = () => { scene.background = new THREE.Color(css('--stage')); lineMat.color.set(css('--cut')); setLevel(+lvl.value); };
    new ResizeObserver(fit).observe(stage); fit(); render3d();
    lvl.addEventListener('input', () => setLevel(+lvl.value));
    (function loop() { ctl.update(); renderer.render(scene, cam); requestAnimationFrame(loop); })();
  }
  const lvlSay = () => { $('lvlTxt').textContent = lvl.value; const n = $('lvlSheets'); if (n) n.textContent = lvl.value === '1' ? '1 sheet' : lvl.value + ' sheets'; };
  lvl.addEventListener('input', () => { lvlSay(); slicePlan.draw(); });
  lvlSay();
  // build it up one sheet at a time
  const playB = $('lvlPlay'); let playT = null;
  if (playB) playB.onclick = () => {
    if (playT) { clearInterval(playT); playT = null; playB.textContent = 'Stack the sheets'; return; }
    lvl.value = 1; lvl.dispatchEvent(new Event('input')); playB.textContent = 'Stop';
    playT = setInterval(() => {
      if (+lvl.value >= +lvl.max) { clearInterval(playT); playT = null; playB.textContent = 'Stack the sheets'; return; }
      lvl.value = +lvl.value + 1; lvl.dispatchEvent(new Event('input'));
    }, 450);
  };

  // ================= 03 READER =================
  const FEATS = [
    { k: 'mill', t: 'Mill platform · terrace', d: 'A level shelf at about +6 m: almost no contours cross it. Cut into the hillside for the mill, with the road along its west side and tight lines on its south side where the ground rises 4–5 m in about 14 m.' },
    { k: 'river', t: 'Ballintrillick River · valley', d: 'Down the west side the contours make Vs pointing south, upstream. The river falls about 8 m, from about +8.5 m to just above 0, as it runs north across the survey.' },
    { k: 'trib', t: 'Tributary and gorge · steep valley', d: 'The stream that fed the mill. In the east the lines on both banks nearly touch: a gorge with sides close to 1:2. It drops about 22 m to pass just north of the mill, then runs under the road and on to the river beyond the surveyed area.' },
    { k: 'bank', t: 'Bank behind the mill · steep', d: 'Five contours packed into a narrow band: about 1:3. Too steep to walk straight up comfortably; a path would zig-zag.' },
    { k: 'hill', t: 'Open hillside · even slope', d: 'North-east of the gorge the lines are evenly spaced, about 4–6 m apart. A steady slope of around 1:12 to 1:16.' },
    { k: 'cut', t: 'The road · made ground', d: 'Nature rarely draws straight contours. Where the road climbs south-east across the slope, the contours kink sharply: it sits on a shelf cut into the hillside, rising about 34 m across the survey.' },
  ];
  const readPlan = Plan($('readPlan'));
  let feat = 'mill';
  readPlan.draw = () => {
    const P = readPlan, c = P.ctx, gold = css('--gold');
    P.base({ contourAlpha: 0.8 });
    P.water(feat === 'river' || feat === 'trib' ? 0.35 : 0.8);
    const hl = (pts, w) => { P.line(pts, gold, w); };
    if (feat === 'river') hl(RIVER, 6);
    if (feat === 'trib') hl(TRIB, 6);
    if (feat === 'bank') { c.strokeStyle = gold; c.lineWidth = 3; c.strokeRect(P.X(400), P.Y(600), 170 * P.s, 45 * P.s); }
    if (feat === 'hill') { c.strokeStyle = gold; c.lineWidth = 3; c.beginPath(); c.ellipse(P.X(1280), P.Y(700), 170 * P.s, 110 * P.s, 0.45, 0, Math.PI * 2); c.stroke(); }
    if (feat === 'cut') { P.line(ROAD, gold, 6); }
    P.mill(feat === 'mill');
    P.tag(150, 1060, 'River', css('--water'), '#fff');
    P.tag(1180, 470, 'Tributary', css('--water'), '#fff');
    P.north(); P.scalebar();
  };
  plans.push(readPlan);
  const fl = $('feat');
  fl.innerHTML = FEATS.map((f, i) => `<li data-k="${f.k}" tabindex="0" class="${f.k === feat ? 'on' : ''}"><span class="k">${i + 1}</span><div><b>${f.t}</b><span>${f.d}</span></div></li>`).join('');
  const pickFeat = li => { if (!li) return; feat = li.dataset.k; fl.querySelectorAll('li').forEach(x => x.classList.toggle('on', x === li)); readPlan.draw(); };
  fl.addEventListener('click', e => pickFeat(e.target.closest('li')));
  fl.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickFeat(e.target.closest('li')); } });

  // ================= 04 MEASURE =================
  const PRESETS = { mill: [[180, 700], [700, 560]], valley: [[125, 1120], [300, 420]], gorge: [[1200, 640], [1200, 250]] };
  let A = PRESETS.mill[0].slice(), B = PRESETS.mill[1].slice(), ex = 1, drag = null;
  const mp = Plan($('measurePlan'));
  mp.draw = () => {
    const P = mp, c = P.ctx;
    P.base({ contourAlpha: 0.85 }); P.water(0.7); P.mill(false);
    c.strokeStyle = css('--ink'); c.lineWidth = 2.5; c.beginPath(); c.moveTo(P.X(A[0]), P.Y(A[1])); c.lineTo(P.X(B[0]), P.Y(B[1])); c.stroke();
    [[A, 'A'], [B, 'B']].forEach(([p, t]) => {
      c.fillStyle = css('--accent'); c.beginPath(); c.arc(P.X(p[0]), P.Y(p[1]), 9, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff'; c.font = '600 11px "IBM Plex Mono", monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t, P.X(p[0]), P.Y(p[1]) + 0.5);
    });
    P.north(); P.scalebar();
  };
  plans.push(mp);
  const cv = $('measurePlan');
  const evPos = e => { const r = cv.getBoundingClientRect(); return mp.inv(e.clientX - r.left, e.clientY - r.top); };
  const clamp = p => [Math.max(5, Math.min(W - 6, p[0])), Math.max(5, Math.min(H - 6, p[1]))];
  cv.addEventListener('pointerdown', e => {
    const p = evPos(e), dA = Math.hypot(p[0] - A[0], p[1] - A[1]), dB = Math.hypot(p[0] - B[0], p[1] - B[1]);
    const near = 26 / mp.s;
    if (dA < near && dA <= dB) drag = 'A'; else if (dB < near) drag = 'B';
    else { A = clamp(p); B = clamp(p); drag = 'B'; }
    cv.setPointerCapture(e.pointerId); update();
  });
  cv.addEventListener('pointermove', e => { if (!drag) return; const p = clamp(evPos(e)); if (drag === 'A') A = p; else B = p; update(); });
  cv.addEventListener('pointerup', () => drag = null);
  document.querySelectorAll('[data-preset]').forEach(b => b.onclick = () => { [A, B] = PRESETS[b.dataset.preset].map(p => p.slice()); update(); });
  document.querySelectorAll('[data-ex]').forEach(b => b.onclick = () => {
    ex = +b.dataset.ex; document.querySelectorAll('[data-ex]').forEach(x => x.setAttribute('aria-pressed', x === b)); section();
  });

  const fmtRatio = g => g < 1e-4 ? 'level' : `1:${(1 / g) >= 100 ? Math.round(1 / g) : (1 / g).toFixed(1)}`;
  function samples() {
    const len = Math.hypot(B[0] - A[0], B[1] - A[1]) * M2R, n = Math.max(2, Math.round(len));
    const s = [];
    for (let k = 0; k <= n; k++) { const t = k / n; const x = A[0] + (B[0] - A[0]) * t, y = A[1] + (B[1] - A[1]) * t; s.push({ d: len * t, h: height(x, y), x, y }); }
    return { len, s };
  }
  function verdict(g) {
    if (g <= 1 / 50) return ['level', 'Level', 'TGD M treats 1:50 or flatter as level: an accessible route needs no ramp features.'];
    if (g <= 1 / 20) return ['gentle', 'Gently sloped', 'Between 1:50 and 1:20: an accessible path without handrails or landings as a ramp.'];
    if (g <= 1 / 12) return ['ramp', 'Ramp territory', 'Steeper than 1:20: needs ramp flights with landings. 1:20 for up to 10 m, 1:15 for up to 5 m, 1:12 for no more than 2 m.'];
    if (g <= 1 / 2) return ['steep', 'Too steep for a ramp', 'Steeper than 1:12: use steps, or wind the route across the slope to make it shallower.'];
    return ['scramble', 'Bank or cliff', 'Steeper than 1:2: a channel side or embankment. Building here means retaining walls.'];
  }
  function update() {
    mp.draw();
    const { len, s } = samples();
    const ok = s.filter(p => p.h === p.h);
    if (len < 2 || ok.length < 2) {
      ['mLen', 'mRise', 'mGrad', 'mPct', 'mMax', 'mEnds'].forEach(id => $(id).textContent = '—');
      $('verdict').dataset.k = ''; $('verdict').innerHTML = '<b>Drag out a longer line</b><span>Pull the ends at least a few metres apart, inside the survey.</span>';
      section(); return;
    }
    const h0 = ok[0].h, h1 = ok[ok.length - 1].h, rise = h1 - h0, g = Math.abs(rise) / len;
    let mx = 0; for (let k = 5; k < s.length; k++) { const a = s[k - 5].h, b = s[k].h; if (a === a && b === b) mx = Math.max(mx, Math.abs(b - a) / (s[k].d - s[k - 5].d)); }
    $('mLen').textContent = `${len.toFixed(1)} m`;
    $('mRise').textContent = `${rise >= 0 ? '+' : '−'}${Math.abs(rise).toFixed(1)} m`;
    $('mGrad').textContent = fmtRatio(g);
    $('mPct').textContent = `${(g * 100).toFixed(1)}% · ${(Math.atan(g) * 180 / Math.PI).toFixed(1)}°`;
    $('mMax').textContent = mx ? fmtRatio(mx) : '—';
    $('mEnds').textContent = `${h0.toFixed(1)} → ${h1.toFixed(1)}`;
    const [k, t, d] = verdict(g);
    $('verdict').dataset.k = k; $('verdict').innerHTML = `<b>${t}</b><span>${d}${mx > g * 1.6 && mx > 1 / 12 ? ` The steepest 5 m along the line is ${fmtRatio(mx)}, so the route is not even.` : ''}</span>`;
    section();
  }

  function nearLine(poly, s) {               // first sample within 12 mm of a polyline
    for (const p of s) for (let k = 1; k < poly.length; k++) {
      const [x1, y1] = poly[k - 1], [x2, y2] = poly[k], dx = x2 - x1, dy = y2 - y1;
      const t = Math.max(0, Math.min(1, ((p.x - x1) * dx + (p.y - y1) * dy) / (dx * dx + dy * dy)));
      if (Math.hypot(p.x - (x1 + t * dx), p.y - (y1 + t * dy)) < 12) return p;
    }
    return null;
  }
  function section() {
    const svg = $('sectionSvg');
    const { len, s } = samples(); const ok = s.filter(p => p.h === p.h);
    if (len < 2 || ok.length < 2) { svg.setAttribute('viewBox', '0 0 900 120'); svg.innerHTML = `<text x="450" y="60" text-anchor="middle" fill="${css('--muted')}" font-family="IBM Plex Mono, ui-monospace, monospace" font-size="13">Draw a line on the plan to see its section</text>`; return; }
    let lo = Math.min(...ok.map(p => p.h)), hi = Math.max(...ok.map(p => p.h));
    lo = Math.floor(lo - 1); hi = Math.ceil(hi + 1);
    const ml = 48, mr = 16, mt = 18, mb = 34, VW = 900;
    let sx = (VW - ml - mr) / len, sy = sx * ex;
    let ph = (hi - lo) * sy;
    if (ph > 420) { sy = 420 / (hi - lo); sx = sy / ex; ph = 420; }
    if (ph < 90) { const extra = (90 - ph) / sy / 2; lo -= extra; hi += extra; ph = 90; }
    const VH = Math.round(ph + mt + mb), pw = len * sx;
    const X = d => ml + d * sx, Y = h => mt + (hi - h) * sy;
    const ink = css('--ink'), mut = css('--muted'), rule = css('--rule'), cut = css('--cut'), board = css('--board');
    let o = '';
    const yStep = (hi - lo) > 30 ? 5 : (hi - lo) > 12 ? 2 : 1;
    for (let h = Math.ceil(lo); h <= hi; h++) {
      if (h % yStep) continue;
      o += `<line x1="${ml}" x2="${ml + pw}" y1="${Y(h)}" y2="${Y(h)}" stroke="${rule}" stroke-width="${h % 5 ? 0.5 : 1}"/>`;
      o += `<text x="${ml - 6}" y="${Y(h) + 3.5}" text-anchor="end" font-size="10" fill="${mut}" font-family="IBM Plex Mono, ui-monospace, monospace">${h}</text>`;
    }
    const xStep = len > 250 ? 50 : len > 100 ? 20 : len > 40 ? 10 : 5;
    for (let d = 0; d <= len + 0.01; d += xStep) o += `<line x1="${X(d)}" x2="${X(d)}" y1="${mt + ph}" y2="${mt + ph + 5}" stroke="${mut}"/><text x="${X(d)}" y="${mt + ph + 17}" text-anchor="middle" font-size="10" fill="${mut}" font-family="IBM Plex Mono, ui-monospace, monospace">${d} m</text>`;
    let path = '', first = true, fill = '';
    s.forEach(p => { if (p.h !== p.h) { first = true; return; } path += `${first ? 'M' : 'L'}${X(p.d).toFixed(1)},${Y(p.h).toFixed(1)} `; first = false; });
    fill = `M${X(ok[0].d)},${mt + ph} ` + ok.map(p => `L${X(p.d).toFixed(1)},${Y(p.h).toFixed(1)}`).join(' ') + ` L${X(ok[ok.length - 1].d)},${mt + ph} Z`;
    o += `<path d="${fill}" fill="${board}" opacity=".35"/>`;
    o += `<path d="${path}" fill="none" stroke="${ink}" stroke-width="2"/>`;
    // markers
    const mk = (p, text, col) => p && p.h === p.h ? `<line x1="${X(p.d)}" x2="${X(p.d)}" y1="${Y(p.h) - 4}" y2="${Y(p.h) - 22}" stroke="${col}" stroke-width="1.5"/><text x="${X(p.d) + 4}" y="${Y(p.h) - 24}" font-size="10.5" font-weight="600" fill="${col}" font-family="IBM Plex Mono, ui-monospace, monospace">${text}</text>` : '';
    o += mk(nearLine(RIVER, s), 'River', css('--water'));
    o += mk(nearLine(TRIB, s), 'Tributary', css('--water'));
    const inMill = s.filter(p => p.x > MILL.x && p.x < MILL.x + MILL.w && p.y > MILL.y && p.y < MILL.y + MILL.h && p.h === p.h);
    if (inMill.length) {
      const a = inMill[0], b = inMill[inMill.length - 1];
      o += `<rect x="${X(a.d)}" y="${mt}" width="${Math.max(2, X(b.d) - X(a.d))}" height="${ph}" fill="${css('--gold')}" opacity=".12"/>`;
      o += mk(inMill[Math.floor(inMill.length / 2)], 'Mill platform', ink);
    }
    o += `<text x="${ml}" y="${mt - 5}" font-size="11" font-weight="600" fill="${cut}" font-family="IBM Plex Mono, ui-monospace, monospace">A</text><text x="${ml + pw}" y="${mt - 5}" text-anchor="end" font-size="11" font-weight="600" fill="${cut}" font-family="IBM Plex Mono, ui-monospace, monospace">B</text>`;
    o += `<text x="${ml + pw}" y="${VH - 2}" text-anchor="end" font-size="10" fill="${mut}" font-family="IBM Plex Mono, ui-monospace, monospace">${ex === 1 ? 'true scale' : 'vertical ×' + ex} · levels in m</text>`;
    svg.setAttribute('viewBox', `0 0 ${VW} ${VH}`); svg.innerHTML = o;
  }

  // ================= 05 WATER =================
  const wp = Plan($('waterPlan'));
  wp.draw = () => {
    const P = wp, c = P.ctx;
    P.base({ contourAlpha: 0.55, labels: false, shadeAlpha: 0.6 });
    P.water(1); P.mill(false);
    c.strokeStyle = css('--water'); c.fillStyle = css('--water'); c.lineWidth = 1.3;
    const step = 40;
    for (let y = step / 2; y < H; y += step) for (let x = step / 2; x < W; x += step) {
      const h = height(x, y), hx = height(x + 5, y) - height(x - 5, y), hy = height(x, y + 5) - height(x, y - 5);
      if (!(h === h && hx === hx && hy === hy)) continue;
      const gx = -hx / (10 * M2R), gy = -hy / (10 * M2R), m = Math.hypot(gx, gy);
      if (m < 0.01) continue;
      const L = Math.min(1, m / 0.35) * 28 + 6, ux = gx / m, uy = gy / m;
      const x0 = P.X(x - ux * L / 2), y0 = P.Y(y - uy * L / 2), x1 = P.X(x + ux * L / 2), y1 = P.Y(y + uy * L / 2);
      c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
      const a = Math.atan2(y1 - y0, x1 - x0); c.beginPath(); c.moveTo(x1, y1);
      c.lineTo(x1 - 5 * Math.cos(a - 0.5), y1 - 5 * Math.sin(a - 0.5)); c.lineTo(x1 - 5 * Math.cos(a + 0.5), y1 - 5 * Math.sin(a + 0.5)); c.closePath(); c.fill();
    }
    P.north(); P.scalebar();
  };
  plans.push(wp);

  // ================= 07 QUIZ =================
  const Q = [
    { q: 'On the Gleniff plan, the contours either side of the tributary nearly touch. What does that tell you?', o: ['A steep-sided channel or gorge', 'A level terrace', 'A ridge running along the stream'], a: 0, w: 'Close lines mean steep ground. Close lines on both sides of a stream mean a gorge.' },
    { q: 'Where a contour crosses a valley, which way does its V point?', o: ['Downhill, the way the water flows', 'Uphill, upstream', 'It depends on the drawing scale'], a: 1, w: 'In a valley the V points upstream. On a spur or ridge it points downhill.' },
    { q: 'A 1:200 drawing has 1 m contours. Two neighbouring lines are 60 mm apart. What is the gradient?', o: ['1:60', '1:6', '1:12'], a: 2, w: '60 mm at 1:200 is 12 m on the ground. Rising 1 m over 12 m is 1:12, the steepest a short ramp can be.' },
    { q: 'You draw a new level platform on your site plan. How do you show the ground as it was?', o: ['Existing contours dashed, proposed contours solid', 'Delete the old contours under the building', 'Colour the old contours red'], a: 0, w: 'Both stay on the drawing so anyone can read what was cut and filled.' },
    { q: 'Rain falls on the open hillside east of the mill. Which way does it run?', o: ['Along the contours', 'Square to the contours, downhill', 'Towards the nearest building'], a: 1, w: 'Water takes the steepest route down, which always crosses contours at right angles.' },
  ];
  const quiz = $('quiz'); let score = 0, answered = 0;
  quiz.innerHTML = Q.map((x, i) => `<div class="q" data-i="${i}"><p>${i + 1}. ${x.q}</p><div class="opts">${x.o.map((t, j) => `<button type="button" data-j="${j}">${t}</button>`).join('')}</div><div class="why" hidden></div></div>`).join('');
  quiz.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const box = b.closest('.q'); if (box.dataset.done) return;
    const x = Q[+box.dataset.i], j = +b.dataset.j; box.dataset.done = 1; answered++;
    box.querySelectorAll('button').forEach(btn => { const k = +btn.dataset.j; if (k === x.a) btn.dataset.r = 'right'; else if (k === j) btn.dataset.r = 'wrong'; });
    if (j === x.a) score++;
    const why = box.querySelector('.why'); why.textContent = (j === x.a ? 'Correct. ' : 'Not quite. ') + x.w; why.hidden = false;
    $('score').textContent = `${score} of ${answered} correct so far.`;
  });

  // ---------- boot
  const onTheme = () => { render3d(); redrawAll(); section(); };
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', onTheme);
  new MutationObserver(onTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  let rt; new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { redrawAll(); }, 80); }).observe(document.querySelector('main'));
  if (document.fonts) document.fonts.ready.then(redrawAll);
  redrawAll(); update();
})();
