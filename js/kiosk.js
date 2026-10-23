/* Exhibition kiosk (kiosk.html): the public screen on the terminal.
   It drives the other two windows on the same computer, the same way the Sections and Projection pages do:
   - the cut goes to the big screen (sections.html?display) and the projector on 'sitekit-link-<site>' as { t: 'cut', s, cam, final };
   - map layers, old maps and the cut layer go to the projector window (project.html?out) as the projection state on
     'sitekit-proj-<site>' (and localStorage), keeping the calibration made on the Projection page.
   Everything the exhibition shows is set in exhibition/config.json. */
(async function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let toastT = 0, ready = false;
  function toast(t) { const el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 3200); }

  // ---------------------------------------------------------------- stage: 1920 × 1080, scaled to the screen
  const stage = $('stage');
  function fit() {
    const k = Math.min(innerWidth / 1920, innerHeight / 1080);
    stage.style.transform = `translate(${(innerWidth - 1920 * k) / 2}px, ${(innerHeight - 1080 * k) / 2}px) scale(${k})`;
  }
  fit(); addEventListener('resize', fit);

  // ---------------------------------------------------------------- keep visitors in the exhibit
  addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('dragstart', e => e.preventDefault());
  addEventListener('gesturestart', e => e.preventDefault());
  addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
  addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k === 'f5' || ((e.ctrlKey || e.metaKey) && (k === 'r' || k === 'l' || k === 'p' || k === 's' || k === '+' || k === '-' || k === '=')) || (e.altKey && (k === 'arrowleft' || k === 'arrowright'))) e.preventDefault();
    if (k === 'backspace' && !(e.target.matches && e.target.matches('input'))) e.preventDefault();
  });
  history.pushState(null, '', location.href);
  addEventListener('popstate', () => history.pushState(null, '', location.href));

  // ---------------------------------------------------------------- site and exhibition config
  const G = await window.loadSite('kiosk.html'); if (!G) return;
  let cfg;
  try { cfg = await (await fetch('exhibition/config.json', { cache: 'no-cache' })).json(); }
  catch (e) { toast('exhibition/config.json could not be read'); return; }
  const pack = G.pack, WM = G.widthM, DM = G.depthM, GL = window.GISLayers;
  if (cfg.place) $('kPlace').textContent = `${cfg.title || pack.name} · ${cfg.place}`.toUpperCase();
  if (cfg.credit) $('kCredit').textContent = cfg.credit.toUpperCase();
  const LINK = 'BroadcastChannel' in window ? new BroadcastChannel('sitekit-link-' + pack.id) : null;
  const PROJ = 'BroadcastChannel' in window ? new BroadcastChannel('sitekit-proj-' + pack.id) : null;
  const PKEY = 'sitekit-proj-' + pack.id, SKEY = 'sitekit-sections-' + pack.id;
  const post = (ch, m) => { try { ch && ch.postMessage(m); } catch (e) { } };

  // ---------------------------------------------------------------- state
  const C0 = cfg.cut || {};
  const DEF = () => ({
    tab: 'cut', A: (C0.A || [WM * 0.1, DM * 0.5]).slice(), B: (C0.B || [WM * 0.9, DM * 0.5]).slice(), look: C0.look || -1, depth: C0.depth || 60, trees: true,
    today: true, mapOn: cfg.maps.map(() => false), mapOp: cfg.maps.map(m => +m.opacity || 70),
    layerOn: cfg.layers.map(l => !!l.on), follow: true
  });
  let K = DEF();
  let changed = false;                                    // anything moved since the last reset (for the idle reset)

  // ---------------------------------------------------------------- the map (site metres → canvas px)
  const MW = 1100, MH = 788, R = 2;
  const sc = Math.min(MW / WM, MH / DM), ox = (MW - WM * sc) / 2, oy = (MH - DM * sc) / 2;
  const X = m => ox + m * sc, Y = m => oy + (DM - m) * sc;
  const toM = (px, py) => [(px - ox) / sc, DM - (py - oy) / sc];
  const map = $('map'), mctx = map.getContext('2d');
  map.width = MW * R; map.height = MH * R;
  const base = document.createElement('canvas'); base.width = MW * R; base.height = MH * R;
  {
    const c = base.getContext('2d'); c.setTransform(R, 0, 0, R, 0, 0);
    c.fillStyle = '#0b0b0b'; c.fillRect(0, 0, MW, MH);
    c.globalAlpha = 0.28; c.imageSmoothingEnabled = true; c.drawImage(G.hill, X(0), Y(DM), WM * sc, DM * sc); c.globalAlpha = 1;
    G.levels.forEach(L => {
      const s = G.contour(L), idx = Math.abs(L / G.IDX - Math.round(L / G.IDX)) < 1e-6;
      c.strokeStyle = idx ? '#6b706d' : '#343736'; c.lineWidth = idx ? 1.1 : 0.6; c.beginPath();
      for (let k = 0; k < s.length; k += 4) { c.moveTo(X(s[k] / 5), Y(s[k + 1] / 5)); c.lineTo(X(s[k + 2] / 5), Y(s[k + 3] / 5)); }
      c.stroke();
    });
    c.lineCap = 'round'; c.lineJoin = 'round';
    G.feats.forEach(f => {
      const pts = f.P.map(([x, y]) => [X(x / 5), Y(y / 5)]); if (pts.length < 2) return;
      c.setLineDash([]); c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
      if (f.kind === 'water') { c.strokeStyle = '#3d8bff'; c.lineWidth = 3; c.stroke(); }
      else if (f.kind === 'road') { c.strokeStyle = '#8a8f8c'; c.lineWidth = 3; c.stroke(); }
      else if (f.kind === 'path') { c.strokeStyle = '#8a8f8c'; c.lineWidth = 1.5; c.setLineDash([5, 4]); c.stroke(); }
      else if (f.kind === 'building') { c.closePath(); c.strokeStyle = '#d9d4c7'; c.lineWidth = 1.6; c.setLineDash([5, 3]); c.stroke(); }
    });
    c.setLineDash([]);
  }

  // old maps (images over the survey extent)
  const MAPIMG = cfg.maps.map(m => { const im = new Image(); im.onload = () => render(); im.src = m.file; return im; });

  // GIS layers from the config
  const LAY = cfg.layers.map(() => ({ raw: null, epsg: 'site', kind: 'mixed', props: [], ready: false, conv: null, convKey: '' }));
  await Promise.all(cfg.layers.map(async (l, i) => {
    try {
      const p = GL.parse(await (await fetch(l.file, { cache: 'no-cache' })).text());
      const epsg = l.crs === 'site' ? 'site' : l.crs && l.crs !== 'auto' ? +l.crs : (p.epsg || (p.feats.length ? GL.guessEpsg(p.feats, (pack.source && pack.source.epsg) || 2157) : 'site'));
      Object.assign(LAY[i], { raw: p.feats, epsg, kind: GL.kindOf(p.feats), props: GL.props(p.feats), ready: p.feats.length > 0 });
    } catch (e) { LAY[i].ready = false; }
  }));
  const projState = () => {
    let s = null; try { s = JSON.parse(localStorage.getItem(PKEY) || 'null'); } catch (e) { }
    const d = { area: 'site', base: 3, vex: 1, aspect: 1.6, scale: 200, layers: { elev: true, hill: true, cont: true, slope: false, feat: true, flood: false, sun: false, img: false, cal: false, gis: true, sect: true, sectDim: true },
      ci: 1, flood: 0.2, date: new Date().toISOString().slice(0, 10), time: 0.5, imgOp: 0.85, calib: {}, gis: [], gisPlace: { crs: 'auto', E: '', N: '', dx: 0, dy: 0, rot: 0 }, overlays: [] };
    if (s) { Object.assign(d, s); d.layers = Object.assign({}, d.layers, s.layers); }
    if (!Array.isArray(d.gis)) d.gis = [];
    return d;
  };
  function layerConv(i) {
    const L = LAY[i]; if (!L.ready) return null;
    const place = projState().gisPlace || {}, key = JSON.stringify(place);
    if (L.conv && L.convKey === key) return L.conv;
    try {
      const Gs = { widthM: WM, depthM: DM };
      L.conv = GL.convert(L.raw, L.epsg, GL.origin(pack, Gs, place), Gs, place); L.convKey = key;
    } catch (e) { L.conv = null; }
    return L.conv;
  }
  const layerStyle = i => { const l = cfg.layers[i]; return { on: true, color: l.color, width: +l.width || 1.5, op: 0.9, fill: l.fill !== false, by: l.colorBy || '', anim: false }; };

  // ---------------------------------------------------------------- the cut
  const geom = () => {
    const [ax, ay] = K.A, [bx, by] = K.B, L = Math.hypot(bx - ax, by - ay) || 1, u = [(bx - ax) / L, (by - ay) / L];
    return { L, u, v: [-u[1] * K.look, u[0] * K.look], ax, ay, bx, by };
  };
  const compass = a => ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round(((a % 360) + 360) % 360 / 45) % 8];
  const lookWord = () => { const { v } = geom(); return compass(Math.atan2(v[0], v[1]) * 180 / Math.PI); };
  const cutState = () => ({ A: K.A, B: K.B, look: K.look, depth: K.depth >= 201 ? 201 : K.depth, above: 1000, poche: true, ground: false, scan: K.trees, cut: true });
  let sendT = 0, lastSend = 0;
  function sendCut(final) {
    const m = { t: 'cut', final: !!final, cam: 'section', s: cutState() };
    const go = () => { lastSend = performance.now(); post(LINK, m); };
    clearTimeout(sendT);
    if (final || performance.now() - lastSend > 40) go(); else sendT = setTimeout(go, 40);
    if (final) {
      try { const o = JSON.parse(localStorage.getItem(SKEY) || '{}'); localStorage.setItem(SKEY, JSON.stringify(Object.assign(o, cutState(), { cam: 'section' }))); } catch (e) { }
      if (K.follow) followCut();
    }
  }

  // ---------------------------------------------------------------- the projector: layers, old maps, the cut layer
  function pushProj() {
    const P = projState();
    Object.assign(P.layers, { sect: true, sectDim: true, gis: true, cal: false, elev: K.today, hill: K.today });
    const ex = cfg.layers.map((l, i) => ({
      id: 'ex-' + l.id, name: l.name, on: !!K.layerOn[i] && LAY[i].ready, color: l.color, width: +l.width || 1.5, op: 0.9, fill: l.fill !== false, by: l.colorBy || '', anim: false,
      kind: LAY[i].kind, props: LAY[i].props, count: LAY[i].raw ? LAY[i].raw.length : 0, epsg: LAY[i].epsg, url: l.file
    }));
    P.gis = ex.concat(P.gis.filter(g => !String(g.id).startsWith('ex-')));
    P.overlays = cfg.maps.map((m, i) => ({ id: m.id, src: m.file, on: !!K.mapOn[i], op: K.mapOp[i] / 100 }));
    try { localStorage.setItem(PKEY, JSON.stringify(P)); } catch (e) { }
    post(PROJ, { t: 'state', s: P });
  }

  // ---------------------------------------------------------------- drawing the map
  function render() {
    if (!ready) return;
    const c = mctx; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, map.width, map.height);
    if (K.tab !== 'maps' || K.today) c.drawImage(base, 0, 0); else { c.fillStyle = '#0b0b0b'; c.fillRect(0, 0, map.width, map.height); }
    c.setTransform(R, 0, 0, R, 0, 0);
    if (K.tab === 'maps') {
      cfg.maps.forEach((m, i) => { const im = MAPIMG[i]; if (K.mapOn[i] && im.complete && im.naturalWidth) { c.globalAlpha = K.mapOp[i] / 100; c.drawImage(im, X(0), Y(DM), WM * sc, DM * sc); } });
      c.globalAlpha = 1;
    }
    if (K.tab === 'gis') cfg.layers.forEach((l, i) => { if (K.layerOn[i]) { const cv = layerConv(i); if (cv) GL.draw(c, layerStyle(i), cv, X, Y, 1.25, 0); } });
    if (K.tab === 'cut') drawCut(c);
  }
  function drawCut(c) {
    const { u, v, ax, ay, bx, by } = geom(), BIG = 3000;
    const S = ([x, y]) => [X(x), Y(y)], at = (t, o) => S([ax + u[0] * t + v[0] * o, ay + u[1] * t + v[1] * o]);
    const poly = pts => { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); };
    c.fillStyle = 'rgba(0,0,0,.45)'; poly([at(-BIG, 0), at(BIG, 0), at(BIG, -BIG), at(-BIG, -BIG)]); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.28)'; c.lineWidth = 1; c.setLineDash([6, 6]);
    c.beginPath(); c.moveTo(...at(-BIG, 0)); c.lineTo(...at(BIG, 0)); c.stroke(); c.setLineDash([]);
    const a = S([ax, ay]), b = S([bx, by]), red = '#ff453a';
    c.strokeStyle = red; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.stroke();
    const dvx = v[0], dvy = -v[1];
    [[a, 'A', -1], [b, 'B', 1]].forEach(([q, lab, sg]) => {
      c.strokeStyle = red; c.lineWidth = 3; c.beginPath(); c.moveTo(q[0], q[1]); c.lineTo(q[0] + dvx * 30, q[1] + dvy * 30); c.stroke();
      c.fillStyle = red; c.beginPath(); c.moveTo(q[0] + dvx * 42, q[1] + dvy * 42); c.lineTo(q[0] + dvx * 30 - dvy * 9, q[1] + dvy * 30 + dvx * 9); c.lineTo(q[0] + dvx * 30 + dvy * 9, q[1] + dvy * 30 - dvx * 9); c.closePath(); c.fill();
      c.fillStyle = '#0b0b0b'; c.lineWidth = 3; c.beginPath(); c.arc(q[0], q[1], 18, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = red; c.beginPath(); c.arc(q[0], q[1], 5, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff'; c.font = '700 22px "IBM Plex Sans", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(lab, q[0] + u[0] * sg * 38, q[1] - u[1] * sg * 38);
    });
  }

  // the section preview: survey ground along the line, as the big screen sees it
  const prev = $('prev'), pctx = prev.getContext('2d'); prev.width = 632 * R; prev.height = 356 * R;
  function renderPreview() {
    const c = pctx, w = 632, h = 356; c.setTransform(R, 0, 0, R, 0, 0);
    c.fillStyle = '#101312'; c.fillRect(0, 0, w, h);
    const { L, u, ax, ay } = geom(), n = 240, g = [];
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i <= n; i++) { const t = i / n * L, z = G.sample(ax + u[0] * t, ay + u[1] * t); g.push([t, z]); if (z === z) { lo = Math.min(lo, z); hi = Math.max(hi, z); } }
    if (lo === Infinity) { c.fillStyle = '#a3a3a3'; c.font = '16px "IBM Plex Mono", monospace'; c.fillText('The line is off the survey', 24, 40); return; }
    const k = Math.min((w - 60) / L, 150 / Math.max(8, hi - lo)), x0 = 30, yb = 210;
    const sx = t => K.look > 0 ? x0 + t * k : x0 + (L - t) * k, sy = z => yb - (z - lo) * k;
    const runs = []; let cur = [];
    g.forEach(([t, z]) => { if (z === z) cur.push([sx(t), sy(z)]); else if (cur.length) { runs.push(cur); cur = []; } }); if (cur.length) runs.push(cur);
    runs.forEach(r => {
      c.fillStyle = '#000'; c.beginPath(); r.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.lineTo(r[r.length - 1][0], yb + 46); c.lineTo(r[0][0], yb + 46); c.closePath(); c.fill();
      c.strokeStyle = '#ff453a'; c.lineWidth = 2.2; c.beginPath(); r.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke();
    });
    c.fillStyle = '#f4f4f2'; c.font = '700 16px "IBM Plex Sans", sans-serif'; c.textBaseline = 'top';
    c.fillText(K.look > 0 ? 'A' : 'B', x0, 18); c.textAlign = 'right'; c.fillText(K.look > 0 ? 'B' : 'A', x0 + L * k, 18); c.textAlign = 'left';
    $('prevCap').textContent = `Section A–B · looking ${lookWord()} · ${L.toFixed(0)} m${K.trees ? '' : ' · trees hidden'}`;
  }

  // ---------------------------------------------------------------- dragging the cut on the map
  let drag = null;
  const evMap = e => { const r = map.getBoundingClientRect(); return [(e.clientX - r.left) * MW / r.width, (e.clientY - r.top) * MH / r.height]; };
  const clampM = ([x, y]) => [Math.max(0, Math.min(WM, x)), Math.max(0, Math.min(DM, y))];
  map.addEventListener('pointerdown', e => {
    if (K.tab !== 'cut') return;
    const [px, py] = evMap(e), a = [X(K.A[0]), Y(K.A[1])], b = [X(K.B[0]), Y(K.B[1])];
    const dA = Math.hypot(px - a[0], py - a[1]), dB = Math.hypot(px - b[0], py - b[1]);
    if (Math.min(dA, dB) < 46) drag = { k: dA <= dB ? 'A' : 'B' };
    else {
      const dx = b[0] - a[0], dy = b[1] - a[1], t = ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy || 1);
      const d = Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
      if (t > 0 && t < 1 && d < 30) drag = { k: 'move', m: toM(px, py), A: K.A.slice(), B: K.B.slice() };
    }
    if (drag) { map.setPointerCapture(e.pointerId); e.preventDefault(); }
  });
  map.addEventListener('pointermove', e => {
    if (!drag) return;
    const [px, py] = evMap(e), m = toM(px, py);
    if (drag.k === 'move') { const dx = m[0] - drag.m[0], dy = m[1] - drag.m[1]; K.A = clampM([drag.A[0] + dx, drag.A[1] + dy]); K.B = clampM([drag.B[0] + dx, drag.B[1] + dy]); }
    else { const other = drag.k === 'A' ? K.B : K.A, p = clampM(m); if (Math.hypot(p[0] - other[0], p[1] - other[1]) > 8) K[drag.k] = p; }
    changed = true; render(); renderPreview(); sendCut(false);
  });
  const endDrag = () => { if (!drag) return; drag = null; sendCut(true); };
  map.addEventListener('pointerup', endDrag); map.addEventListener('pointercancel', endDrag);

  // ---------------------------------------------------------------- tabs and panels
  const HINT = { cut: 'Drag A or B to move the cut', maps: 'Projected on the model', gis: 'Layers shown on the model', sound: 'Tap a number to listen' };
  function setTab(t) {
    K.tab = t;
    document.querySelectorAll('.k-tab').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tab === t)));
    $('pCut').hidden = t !== 'cut'; $('pMaps').hidden = t !== 'maps'; $('pGis').hidden = t !== 'gis'; $('pSound').hidden = t !== 'sound';
    $('hint').textContent = HINT[t]; $('markers').hidden = t !== 'sound';
    drawMaps(); render();
  }
  document.querySelectorAll('.k-tab').forEach(b => b.onclick = () => { changed = true; setTab(b.dataset.tab); });

  // cut panel
  $('flip').onclick = () => { K.look = -K.look; changed = true; render(); renderPreview(); sendCut(true); };
  const showTrees = () => { $('trees').setAttribute('aria-pressed', String(K.trees)); $('trees').textContent = K.trees ? 'Trees on' : 'Trees off'; };
  $('trees').onclick = () => { K.trees = !K.trees; changed = true; showTrees(); renderPreview(); sendCut(true); };
  const showDepth = () => { $('depth').value = K.depth; $('depthOut').textContent = K.depth >= 201 ? 'everything' : `${K.depth} m`; };
  $('depth').oninput = e => { K.depth = +e.target.value; changed = true; showDepth(); sendCut(false); };
  $('depth').onchange = () => sendCut(true);

  // old maps panel
  function drawMaps() {
    const rows = cfg.maps.map((m, i) => `
      <div class="k-mapcard${K.mapOn[i] ? ' on' : ''}">
        <button type="button" class="k-maphead" data-map="${i}" aria-pressed="${K.mapOn[i]}"><span class="k-year">${esc(m.date)}</span><b>${esc(m.name)}</b><span class="k-switch"><i></i></span></button>
        <div class="k-mapop"><label for="mop${i}">OPACITY</label><input id="mop${i}" data-op="${i}" type="range" min="0" max="100" value="${K.mapOp[i]}"${K.mapOn[i] ? '' : ' disabled'}><output id="mopo${i}">${K.mapOp[i]}%</output></div>
      </div>`).join('') + `
      <div class="k-mapcard${K.today ? ' on' : ''}">
        <button type="button" class="k-maphead" data-today aria-pressed="${K.today}"><span class="k-year">2025</span><b>Today · drone survey</b><span class="k-switch"><i></i></span></button>
        <div class="k-mapop"><span class="k-mono" style="font-size:13px;color:#a3a3a3">BASE</span><span style="font-size:15px;color:#a3a3a3">Terrain colours on the model, under the old maps</span><span></span></div>
      </div>`;
    $('mapsList').innerHTML = rows;
    $('mapsList').querySelectorAll('[data-map]').forEach(b => b.onclick = () => { const i = +b.dataset.map; K.mapOn[i] = !K.mapOn[i]; changed = true; drawMaps(); render(); pushProj(); });
    $('mapsList').querySelector('[data-today]').onclick = () => { K.today = !K.today; changed = true; drawMaps(); render(); pushProj(); };
    $('mapsList').querySelectorAll('[data-op]').forEach(r => r.oninput = e => { const i = +r.dataset.op; K.mapOp[i] = +e.target.value; $('mopo' + i).textContent = K.mapOp[i] + '%'; changed = true; render(); stackLabel(); pushProjSoon(); });
    stackLabel();
  }
  function stackLabel() {
    const on = cfg.maps.map((m, i) => K.mapOn[i] ? `${m.name} ${K.mapOp[i]}%` : null).filter(Boolean);
    $('stackLabel').hidden = K.tab !== 'maps';
    $('stackLabel').textContent = on.length ? on.join(' · ') : 'No old map switched on';
  }
  $('todayOnly').onclick = () => { K.mapOn = cfg.maps.map(() => false); K.today = true; changed = true; drawMaps(); render(); pushProj(); };
  let projT = 0; const pushProjSoon = () => { clearTimeout(projT); projT = setTimeout(pushProj, 60); };

  // layers panel
  function drawGis() {
    $('gisList').innerHTML = cfg.layers.map((l, i) => {
      const ready = LAY[i].ready, on = ready && K.layerOn[i];
      return `<button type="button" class="k-tile" data-layer="${i}" aria-pressed="${on}"${ready ? '' : ' disabled'} style="border-color:${on ? esc(l.color) : '#262626'}">
        <span class="k-tilehead"><span class="k-sw" style="background:${esc(l.color)}"></span><span class="k-state">${ready ? (on ? 'ON' : 'OFF') : 'DATA TO COME'}</span></span>
        <span><b>${esc(l.name)}</b><small>${esc(l.source || '')}</small></span></button>`;
    }).join('');
    $('gisList').querySelectorAll('[data-layer]').forEach(b => b.onclick = () => { const i = +b.dataset.layer; K.layerOn[i] = !K.layerOn[i]; changed = true; drawGis(); render(); pushProj(); });
    const n = cfg.layers.filter((l, i) => LAY[i].ready && K.layerOn[i]).length;
    $('gisCount').textContent = `${n} of ${cfg.layers.length} layers on the model`;
  }
  $('allOff').onclick = () => { K.layerOn = cfg.layers.map(() => false); changed = true; drawGis(); render(); pushProj(); };

  // ---------------------------------------------------------------- sounds
  const SND = cfg.sounds.map(s => ({ cfg: s, audio: null, missing: false }));
  let playing = -1, lastPlayed = 0, vol = 0.7;
  await Promise.all(SND.map(async s => { try { const r = await fetch(s.cfg.file, { method: 'HEAD', cache: 'no-cache' }); s.missing = !r.ok; } catch (e) { s.missing = true; } }));
  function fade(a, to, ms, done) {
    const from = a.volume, t0 = performance.now();
    const step = now => { const k = Math.min(1, (now - t0) / ms); a.volume = Math.max(0, Math.min(1, from + (to - from) * k)); if (k < 1) requestAnimationFrame(step); else if (done) done(); };
    requestAnimationFrame(step);
  }
  function stop() { if (playing >= 0 && SND[playing].audio) { const a = SND[playing].audio; fade(a, 0, 600, () => a.pause()); } playing = -1; drawSounds(); }
  function play(i, quiet) {
    const s = SND[i];
    if (s.missing) { if (!quiet) toast(`The ${s.cfg.name.toLowerCase()} recording has not been added yet.`); return; }
    if (playing === i) { stop(); return; }
    stop();
    if (!s.audio) { s.audio = new Audio(s.cfg.file); s.audio.loop = true; s.audio.onerror = () => { s.missing = true; if (playing === i) { playing = -1; } drawSounds(); }; }
    s.audio.volume = 0; s.audio.currentTime = 0;
    s.audio.play().then(() => fade(s.audio, vol, 900)).catch(() => { });
    playing = i; lastPlayed = i; drawSounds();
  }
  function followCut() {                                       // the recording nearest the line
    const { ax, ay, bx, by } = geom(), dx = bx - ax, dy = by - ay;
    let best = -1, bd = Infinity;
    SND.forEach((s, i) => {
      if (s.missing || !s.cfg.at) return;
      const [px, py] = s.cfg.at, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1))), d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      if (d < bd) { bd = d; best = i; }
    });
    if (best >= 0 && best !== playing) play(best, true);
  }
  const PLAY = 'M8 5v14l11-7z', PAUSE = 'M7 5h4v14H7zM13 5h4v14h-4z';
  function drawSounds() {
    $('soundList').innerHTML = SND.map((s, i) => `
      <button type="button" class="k-sound" data-sound="${i}" aria-pressed="${playing === i}" aria-label="${playing === i ? 'Pause' : 'Play'} ${esc(s.cfg.name)}">
        <span class="k-shead"><span class="k-snum">0${i + 1}</span><span class="k-sbtn${playing === i ? ' pulse' : ''}"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${playing === i ? PAUSE : PLAY}"/></svg></span></span>
        <span><b>${esc(s.cfg.name)}</b><small>${esc(s.cfg.where || '')}</small>${s.missing ? '<span class="k-missing">Recording to come</span>' : ''}</span>
      </button>`).join('');
    $('soundList').querySelectorAll('[data-sound]').forEach(b => b.onclick = () => { changed = true; play(+b.dataset.sound); });
    $('markers').innerHTML = SND.map((s, i) => s.cfg.at ? `
      <button type="button" class="k-marker${playing === i ? ' pulse' : ''}" data-mk="${i}" aria-pressed="${playing === i}" aria-label="${playing === i ? 'Pause' : 'Play'} ${esc(s.cfg.name)}" style="left:${X(s.cfg.at[0]).toFixed(0)}px;top:${Y(s.cfg.at[1]).toFixed(0)}px">0${i + 1}</button>
      <span class="k-mlabel" style="left:${X(s.cfg.at[0]).toFixed(0)}px;top:${Y(s.cfg.at[1]).toFixed(0)}px">${esc(s.cfg.name)}</span>` : '').join('');
    $('markers').querySelectorAll('[data-mk]').forEach(b => b.onclick = () => { changed = true; play(+b.dataset.mk); });
    $('nowPlaying').textContent = playing >= 0 ? 'Now playing · ' + SND[playing].cfg.name : 'No sound playing';
    $('playIcon').setAttribute('d', playing >= 0 ? PAUSE : PLAY);
    $('playBtn').setAttribute('aria-label', playing >= 0 ? 'Pause sound' : 'Play sound');
    $('playBtn').classList.toggle('pulse', playing >= 0);
    $('follow').setAttribute('aria-pressed', String(K.follow));
  }
  $('playBtn').onclick = () => { changed = true; if (playing >= 0) stop(); else { const i = SND[lastPlayed] && !SND[lastPlayed].missing ? lastPlayed : SND.findIndex(s => !s.missing); if (i >= 0) play(i); else toast('No recordings have been added yet.'); } };
  $('follow').onclick = () => { K.follow = !K.follow; changed = true; drawSounds(); if (K.follow) followCut(); };
  $('vol').oninput = e => { vol = +e.target.value / 100; if (playing >= 0 && SND[playing].audio) SND[playing].audio.volume = vol; };

  // ---------------------------------------------------------------- staff exit: hold the corner 3 s, then the PIN
  let holdT = 0, pin = '';
  const exitBtn = $('exitBtn');
  const unhold = () => { clearTimeout(holdT); exitBtn.classList.remove('holding'); };
  exitBtn.addEventListener('pointerdown', e => { e.preventDefault(); exitBtn.classList.add('holding'); holdT = setTimeout(() => { unhold(); openPin(); }, 3000); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => exitBtn.addEventListener(t, unhold));
  const PINLEN = String(cfg.staffPin || '').length || 4;
  function showPin(bad) { const el = $('pinShow'); el.textContent = '•'.repeat(pin.length) + '·'.repeat(Math.max(0, PINLEN - pin.length)); el.classList.toggle('bad', !!bad); }
  function openPin() { pin = ''; showPin(); $('pinModal').hidden = false; }
  $('pinPad').innerHTML = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Clear', '0', 'Back'].map(k => `<button type="button" data-k="${k}"${k.length > 1 ? ' style="font-size:17px"' : ''}>${k}</button>`).join('');
  $('pinPad').querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
    const k = b.dataset.k;
    if (k === 'Clear') pin = ''; else if (k === 'Back') pin = pin.slice(0, -1); else if (pin.length < PINLEN) pin += k;
    showPin();
    if (pin.length === PINLEN) {
      if (pin === String(cfg.staffPin)) { $('pinModal').hidden = true; openStaff(); }
      else { pin = ''; showPin(true); }
    }
  });
  $('pinCancel').onclick = () => { $('pinModal').hidden = true; };
  let projSeen = 0, bigSeen = 0;
  function openStaff() { $('staffModal').hidden = false; post(PROJ, { t: 'ping' }); post(LINK, { t: 'display-ping' }); setTimeout(showStatus, 600); }
  function showStatus() { $('stProj').classList.toggle('on', performance.now() - projSeen < 8000); $('stBig').classList.toggle('on', performance.now() - bigSeen < 8000); }
  $('staffBack').onclick = () => { $('staffModal').hidden = true; };
  $('openProj').onclick = () => { window.open('project.html?out', 'sitekit-projector', 'popup,width=960,height=600'); setTimeout(() => { pushProj(); showStatus(); }, 1500); };
  $('openBig').onclick = () => { window.open('sections.html?display&site=' + encodeURIComponent(pack.id), 'sitekit-bigscreen', 'popup,width=1280,height=720'); setTimeout(showStatus, 2500); };
  $('fullK').onclick = () => { (document.documentElement.requestFullscreen ? document.documentElement.requestFullscreen() : Promise.reject()).catch(() => { }); };
  $('calib').onclick = () => { location.href = 'project.html'; };
  $('leave').onclick = () => { location.href = 'index.html'; };

  // ---------------------------------------------------------------- the other windows
  if (LINK) LINK.onmessage = ({ data: m }) => {
    if (m.t === 'display-hello') { bigSeen = performance.now(); if (!drag) sendCut(true); }
    else if (m.t === 'cut-request') sendCut(true);
  };
  if (PROJ) PROJ.onmessage = ({ data: m }) => { if (m.t === 'hello') { projSeen = performance.now(); pushProj(); } };

  // ---------------------------------------------------------------- idle: back to the start after a quiet spell
  let lastTouch = Date.now();
  ['pointerdown', 'input', 'keydown'].forEach(t => addEventListener(t, () => { lastTouch = Date.now(); }, true));
  setInterval(() => {
    if (!changed || Date.now() - lastTouch < (+cfg.idleSeconds || 180) * 1000) return;
    if (!$('staffModal').hidden) return;
    stop(); K = DEF(); changed = false; $('pinModal').hidden = true;
    showTrees(); showDepth(); drawGis(); drawSounds(); setTab('cut'); renderPreview(); sendCut(true); pushProj();
  }, 5000);

  // ---------------------------------------------------------------- start
  ready = true;
  showTrees(); showDepth(); drawGis(); drawSounds(); setTab('cut'); renderPreview();
  sendCut(true); pushProj();
})();
