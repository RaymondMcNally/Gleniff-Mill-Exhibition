(async function () {
  'use strict';
  const G = await window.loadSite('model.html'); if (!G) return;
  const { css, $, Plan, W, H, pack } = G;
  const MM = window.MyModel;
  const status = (t, s = '') => { $('mStatus').textContent = t; $('mStatus').dataset.state = s; };
  const DEM = G.DEM, KEY = pack.modelKey || ('sitekit-model-' + pack.id), SITE = pack.slug || SiteKit.slug(pack.name);
  fillSite(G);

  // ---------- state. S.x, S.y: SW corner in plan coordinates (mm at 1:200, the site pack's frame).
  // S.size is the physical model size in mm; S.scale the model scale (100, 200, 500 or 1000).
  // On the plan the square is Q() = S.size × scale / 200 plan units; on the ground it is S.size × scale / 1000 m.
  // 3D print: 230 mm square at 1:200 (46 × 46 m). The P1S plate is 256 mm but its front-left corner (18 × 28 mm)
  // can't be printed on, so the largest square that slices cleanly is about 230 mm. It sits 22 mm in from the left.
  // The plaster mould uses the same 230 mm footprint; its tapered walls take 10 mm a side, so it casts 210 mm (42 × 42 m).
  const PRINT = 230, MOULD = 210, BED = 256, EXCL = [18, 28], PLACE = [22, (BED - PRINT) / 2], MAXH = 250;
  const SIZE = { print: PRINT, mould: MOULD };
  const S = { size: 300, x: G.focus[0] - 150, y: G.focus[1] - 150, board: 5, sheet: [841, 594], hollow: true, name: '',
    output: 'card', cardSize: 300, base: 3, vex: 1, arrow: true, castBase: 10, lastPrint: 'print',
    cncSize: 400, stock: 100, fit: 'true', cncBase: 6, cardKind: 'layers', spacing: 20, dpi: 254, tile: false, scale: 200, lam: 1, card: 2, handSize: 250 };
  const SCALES = [100, 200, 500, 1000];
  const BEDCNC = [2500, 1300];                             // Mantech Falcon 1325 bed, mm (Z travel 200 mm)
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) Object.assign(S, s); const n = localStorage.getItem('sitekit-name'); if (n && !S.name) S.name = n; } catch (e) { }
  if (!['layers', 'waffle', 'relief'].includes(S.cardKind)) S.cardKind = 'layers';
  if (!SCALES.includes(+S.scale)) S.scale = 200;
  if (![1, 2, 3, 4, 5].includes(+S.lam)) S.lam = 1;
  if (![1, 1.5, 2, 2.5, 3].includes(+S.card)) S.card = 2;
  if (![150, 200, 250].includes(+S.handSize)) S.handSize = 250;
  const HANDSIZES = [150, 200, 250], CARDSIZES = [200, 250, 300];   // hand-cut: the square must fit an A3 sheet with its title block
  const MPM = () => S.scale / 1000;
  const LT = () => S.output === 'hand' ? S.card : S.board * (S.cardKind === 'layers' ? S.lam : 1);   // layer thickness: sheets glued per contour × board                          // metres on site per mm of model
  const Q = () => S.size * S.scale / 200;                    // square side in plan units
  const mFmt = v => (Math.abs(v - Math.round(v)) < 1e-6 ? String(Math.round(v)) : v.toFixed(v < 10 ? 1 : 0));
  if (S.output === 'cnc') S.size = S.cncSize; else if (S.output === 'hand') S.size = S.handSize; else if (!SIZE[S.output]) S.output = 'card'; else S.size = SIZE[S.output];
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); localStorage.setItem('sitekit-name', S.name); } catch (e) { } };
  $('mSize').value = S.size; $('mBoard').value = S.board; $('mLam').value = S.lam; $('mSheet').value = S.sheet.join('x'); $('mHollow').checked = S.hollow; $('mName').value = S.name;
  $('mBase').value = S.base; $('mVex').value = S.vex; $('mArrow').checked = S.arrow; $('mCast').value = S.castBase;
  $('mCard').value = S.card; $('mSpacing').value = S.spacing; $('mDpi').value = S.dpi; $('mTile').checked = !!S.tile;
  $('mCncSize').value = S.cncSize; $('mStock').value = S.stock; $('mFit').value = S.fit; $('mCncBase').value = S.cncBase;
  const snap = v => Math.round(v / 2) * 2;
  // class tile model: the survey is divided into a grid of squares from its south-west corner; columns A, B, C… run
  // west to east, rows 1, 2, 3… south to north. In tile mode the square snaps to a tile.
  const tileCount = () => [Math.max(1, Math.ceil(W / Q())), Math.max(1, Math.ceil(H / Q()))];
  const colName = c => { let t = ''; c++; while (c > 0) { const m = (c - 1) % 26; t = String.fromCharCode(65 + m) + t; c = Math.floor((c - 1) / 26); } return t; };
  const tileId = () => `${colName(Math.round(S.x / Q()))}${Math.round(S.y / Q()) + 1}`;
  const clampSel = () => {
    const q = Q();
    if (S.tile) { const [nc, nr] = tileCount(); S.x = Math.min(nc - 1, Math.max(0, Math.round(S.x / q))) * q; S.y = Math.min(nr - 1, Math.max(0, Math.round(S.y / q))) * q; return; }
    S.x = snap(Math.max(-q / 2, Math.min(W - q / 2, S.x))); S.y = snap(Math.max(-q / 2, Math.min(H - q / 2, S.y)));
  };
  clampSel();

  // ---------- plan
  const P = Plan($('pickPlan'));
  P.draw = () => {
    const c = P.ctx;
    P.base({ contourAlpha: 0.75 }); P.features({ alpha: 0.8, tags: 'focus' });
    if (S.tile) {
      const [nc, nr] = tileCount(); c.save(); c.strokeStyle = css('--muted'); c.globalAlpha = .5; c.lineWidth = 1; c.setLineDash([4, 4]);
      const q = Q();
      for (let i = 0; i <= nc; i++) { c.beginPath(); c.moveTo(P.X(i * q), P.Y(0)); c.lineTo(P.X(i * q), P.Y(nr * q)); c.stroke(); }
      for (let j = 0; j <= nr; j++) { c.beginPath(); c.moveTo(P.X(0), P.Y(j * q)); c.lineTo(P.X(nc * q), P.Y(j * q)); c.stroke(); }
      c.setLineDash([]); c.globalAlpha = .75; c.fillStyle = css('--muted'); c.font = '500 10px "IBM Plex Mono", monospace'; c.textAlign = 'left'; c.textBaseline = 'top';
      if (q * P.s > 26) for (let i = 0; i < nc; i++) for (let j = 0; j < nr; j++) c.fillText(colName(i) + (j + 1), P.X(i * q) + 4, P.Y((j + 1) * q) + 4);
      c.restore();
    }
    const x = P.X(S.x), y = P.Y(S.y + Q()), w = Q() * P.s;
    c.fillStyle = css('--accent'); c.globalAlpha = 0.14; c.fillRect(x, y, w, w); c.globalAlpha = 1;
    c.strokeStyle = css('--accent'); c.lineWidth = 2.5; c.strokeRect(x, y, w, w);
    c.font = '600 11px "IBM Plex Mono", monospace'; c.textAlign = 'left'; c.textBaseline = 'bottom';
    const t = `${S.tile ? 'Tile ' + tileId() + ' · ' : ''}1:${S.scale} · ${S.size} mm · ${mFmt(S.size * MPM())} m`, tw = c.measureText(t).width + 10;
    c.fillStyle = css('--accent'); c.fillRect(x, y - 18, tw, 18); c.fillStyle = '#fff'; c.fillText(t, x + 5, y - 4);
    P.north(); P.scalebar();
  };
  const cv = $('pickPlan');
  let drag = null;
  const evPos = e => { const r = cv.getBoundingClientRect(); return P.inv(e.clientX - r.left, e.clientY - r.top); };
  cv.addEventListener('pointerdown', e => {
    const [mx, my] = evPos(e);
    const q = Q();
    if (mx >= S.x && mx <= S.x + q && my >= S.y && my <= S.y + q) drag = [mx - S.x, my - S.y];
    else { drag = [q / 2, q / 2]; S.x = mx - q / 2; S.y = my - q / 2; clampSel(); P.draw(); queue(); }
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove', e => { if (!drag) return; const [mx, my] = evPos(e); S.x = mx - drag[0]; S.y = my - drag[1]; clampSel(); P.draw(); queue(); });
  cv.addEventListener('pointerup', () => { drag = null; });
  cv.addEventListener('keydown', e => {
    const d = e.shiftKey ? 50 : 10, m = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, d], ArrowDown: [0, -d] }[e.key];
    if (!m) return; e.preventDefault(); S.x += m[0]; S.y += m[1]; clampSel(); P.draw(); queue();
  });
  const resize = fn => { const c = [S.x + Q() / 2, S.y + Q() / 2]; fn(); S.x = c[0] - Q() / 2; S.y = c[1] - Q() / 2; clampSel(); };
  $('mSize').onchange = e => { resize(() => { S.size = +e.target.value; if (S.output === 'hand') S.handSize = S.size; }); P.draw(); queue(); };
  document.querySelectorAll('[data-scale]').forEach(b => b.onclick = () => { const v = +b.dataset.scale; if (v === S.scale) return; resize(() => S.scale = v); scaleLabels(); fitted = false; P.draw(); queue(); });
  // every label that names a scale or a real-world size follows the chosen scale
  function scaleLabels() {
    document.querySelectorAll('[data-scale]').forEach(b => b.setAttribute('aria-pressed', +b.dataset.scale === S.scale));
    document.querySelectorAll('.js-ms').forEach(e => e.textContent = `1:${S.scale}`);
    const opt = (id, f) => [...$(id).options].forEach(o => o.textContent = f(o.value));
    opt('mBoard', v => `${v} mm · ${mFmt(v * MPM())} m`);
    opt('mLam', v => `${v} sheet${+v === 1 ? '' : 's'} · ${mFmt(v * S.board * MPM())} m`);
    opt('mCncSize', v => `${v} × ${v} mm (${mFmt(v * MPM())} m)`);
    opt('mSpacing', v => `${v} mm (${mFmt(v * MPM())} m)`);
    opt('mCard', v => `${v} mm · ${mFmt(v * MPM())} m per layer`);
    $('mFit').options[0].textContent = `True scale (1:${S.scale})`; $('mVex').options[0].textContent = `True scale (1:${S.scale})`;
    $('specModel').textContent = `1:${S.scale}`; $('specPrint').textContent = `${PRINT} mm · ${mFmt(PRINT * MPM())} × ${mFmt(PRINT * MPM())} m`;
  }
  $('mBoard').onchange = e => { S.board = +e.target.value; scaleLabels(); queue(); };
  $('mLam').onchange = e => { S.lam = +e.target.value; queue(); };
  $('mCard').onchange = e => { S.card = +e.target.value; queue(); };
  $('mSheet').onchange = e => { S.sheet = e.target.value.split('x').map(Number); queue(); };
  $('mHollow').onchange = e => { S.hollow = e.target.checked; queue(); };
  $('mName').oninput = e => { S.name = e.target.value.trim(); save(); };
  $('mBase').onchange = e => { S.base = +e.target.value; queue(); };
  $('mVex').onchange = e => { S.vex = +e.target.value; queue(); };
  $('mArrow').onchange = e => { S.arrow = e.target.checked; queue(); };
  $('mCast').onchange = e => { S.castBase = +e.target.value; queue(); };
  $('mCncSize').onchange = e => { resize(() => S.cncSize = S.size = +e.target.value); fitted = false; P.draw(); queue(); };
  $('mStock').onchange = e => { S.stock = +e.target.value; queue(); };
  $('mSpacing').onchange = e => { S.spacing = +e.target.value; queue(); };
  $('mDpi').onchange = e => { S.dpi = +e.target.value; queue(); };
  $('mTile').onchange = e => { S.tile = e.target.checked; clampSel(); showOutput(); P.draw(); queue(); };
  const setKind = k => { if (k === S.cardKind) return; S.cardKind = k; showOutput(); fitted = false; queue(); };
  $('kLayers').onclick = () => setKind('layers'); $('kWaffle').onclick = () => setKind('waffle'); $('kRelief').onclick = () => setKind('relief');
  $('mFit').onchange = e => { S.fit = e.target.value; queue(); };
  $('mCncBase').onchange = e => { S.cncBase = +e.target.value; queue(); };

  // ---------- output: card model (laser) or 3D print. The same square drives both.
  const LABELS = { card: ['Layers', 'Laser sheets', 'Model height'], print: ['Tallest point', 'Print size', 'Height scale'], mould: ['Mould height', 'Cast size', 'Plaster to fill'], cnc: ['Carving height', 'Block needed', 'Height scale'], hand: ['Layers of card', 'Template', 'Model height'] };
  function showOutput() {
    const o = S.output;
    $('main').dataset.out = o;
    $('oCard').setAttribute('aria-pressed', o === 'card'); $('oPrint').setAttribute('aria-pressed', o === 'print' || o === 'mould'); $('oCnc').setAttribute('aria-pressed', o === 'cnc'); $('oHand').setAttribute('aria-pressed', o === 'hand');
    $('kModel').setAttribute('aria-pressed', o === 'print'); $('kMould').setAttribute('aria-pressed', o === 'mould');
    [...$('mSize').options].forEach(op => op.hidden = !(o === 'hand' ? HANDSIZES : CARDSIZES).includes(+op.value));
    $('mSize').value = S.size; $('mSize').disabled = o !== 'card' && o !== 'hand';
    $('dlPrint').textContent = o === 'mould' ? 'Download mould (3MF)' : 'Download 3D print (3MF)';
    $('p3dLbl').textContent = o === 'mould' ? 'Printed mould' : 'Finished model';
    const KLAB = { layers: LABELS.card, waffle: ['Sections', 'Laser sheets', 'Model height'], relief: ['Image', 'Resolution', 'Black to white'] };
    ['tLayers', 'tSheets', 'tHeight'].forEach((id, i) => $(id).textContent = (o === 'card' ? KLAB[S.cardKind] : LABELS[o])[i]);
    $('main').dataset.kind = S.cardKind; $('main').dataset.tile = S.tile ? 'on' : 'off';
    [['kLayers', 'layers'], ['kWaffle', 'waffle'], ['kRelief', 'relief']].forEach(([id, k]) => $(id).setAttribute('aria-pressed', S.cardKind === k));
  }
  function setOutput(o) {
    if (o === S.output) return;
    if (S.output === 'card') S.cardSize = S.size;
    if (S.output === 'hand') S.handSize = S.size;
    resize(() => { S.size = o === 'cnc' ? S.cncSize : o === 'hand' ? S.handSize : SIZE[o] || (CARDSIZES.includes(+S.cardSize) ? S.cardSize : 300); if (SIZE[o]) S.lastPrint = o; S.output = o; });
    showOutput(); fitted = false; P.draw(); queue();
  }
  $('oCard').onclick = () => setOutput('card');
  $('oPrint').onclick = () => setOutput(SIZE[S.output] ? S.output : S.lastPrint || 'print');
  $('oCnc').onclick = () => setOutput('cnc');
  $('oHand').onclick = () => setOutput('hand');
  $('kModel').onclick = () => setOutput('print');
  $('kMould').onclick = () => setOutput('mould');


  // ---------- compute
  let model = null, packed = null, pm = null, Gcur = null, sheetIx = 0, timer = 0, wf = null, wpk = null, rel = null, r3d = null, sheetSrc = null;
  const datum = () => S.tile ? DEM.lo : undefined;                       // class tiles: one base level for the whole site
  const outBtns = ['dlPlan', 'dlPlot', 'dlKit', 'dlPrint', 'dlStl', 'dlCnc', 'dlWaffle', 'dlRelief', 'dlHand'];
  function queue() { clearTimeout(timer); status('Working out your model…'); outBtns.forEach(id => $(id).disabled = true); timer = setTimeout(compute, 180); }
  const selM = () => ({ x0: S.x * 0.2, y0: S.y * 0.2, size: S.size * MPM() });
  function compute() {
    save();
    const sel = selM(); MM.setScale(S.scale);
    if (S.output === 'hand') return computeHand(sel);
    if (S.output === 'cnc') return computeCarve(sel);
    if (S.output !== 'card') return computePrint(sel);
    pm = null; wf = null; rel = null;
    if (S.cardKind === 'waffle') return computeWaffle(sel);
    if (S.cardKind === 'relief') return computeRelief(sel);
    const T = LT(), iv = T * MPM();
    model = MM.buildModel(DEM, sel, T, { scale: S.scale, hollow: S.hollow, rim: 15, base: S.tile ? Math.floor(DEM.lo / iv + 1e-9) * iv : undefined });
    const Gm = Gcur = model.G;
    planLabels();
    $('oArea').textContent = `${(Gm.size).toFixed(0)} × ${(Gm.size).toFixed(0)} m`;
    if (!model.layers.length) {
      ['oLevels', 'oLayers', 'oSheets', 'oHeight', 'oPaper'].forEach(id => $(id).textContent = '—');
      status(Gm.coverage < 0.01 ? 'This square is outside the survey. Move it onto the site.' : 'This square is too flat for any layers at this board thickness.', 'err');
      draw3D(); $('sheetView').innerHTML = ''; return;
    }
    // laminated layers: every layer is cut S.lam times and the copies glued into one thicker layer
    const items = S.lam > 1 ? model.layers.flatMap(l => Array.from({ length: S.lam }, (_, c) => c ? Object.assign({}, l, { copy: c }) : l)) : model.layers;
    packed = MM.nest(items, S.sheet[0], S.sheet[1]);
    if (packed.error) { status(packed.error, 'err'); return; }
    sheetSrc = { count: packed.count, svg: i => MM.toSVG(packed, i, 'sheet') };
    sheetIx = Math.min(sheetIx, packed.count - 1);
    $('oLevels').textContent = `${G.fmt(Gm.lo)} to ${G.fmt(Gm.hi)} m`;
    $('oLayers').textContent = S.lam > 1 ? `${model.layers.length} × ${S.lam} sheets` : `${model.layers.length} × ${S.board} mm`;
    $('oSheets').textContent = `${packed.count} × ${S.sheet[0]}×${S.sheet[1]}`;
    $('oHeight').textContent = `${+(model.layers.length * T).toFixed(1)} mm + base`;
    $('oPaper').textContent = planPaper().name;
    const warn = Gm.coverage < 0.999 ? `About ${Math.round((1 - Gm.coverage) * 100)}% of this square is outside the survey and will be left at base level. ` : '';
    const many = model.layers.length * S.lam > 120 ? ` That is ${model.layers.length * S.lam} sheets of card to cut and stack: a bigger contour interval (more sheets glued per contour) or a smaller scale keeps it manageable.` : '';
    status(warn + `Ready: ${model.layers.length} layers from ${G.fmt(model.layers[0].L)} m to ${G.fmt(model.layers[model.layers.length - 1].L)} m` + (S.lam > 1 ? `, each ${S.lam} sheets of ${S.board} mm glued together (${model.layers.length * S.lam} pieces of card).` : '.') + many, warn || many ? 'warn' : 'ok');
    $('dlPlan').disabled = $('dlPlot').disabled = $('dlKit').disabled = false;
    draw3D(); drawSheet();
  }

  // hand-cut grey card: the same contour layers as the laser kit (one per thickness of card), drawn on one A3 template
  function computeHand(sel) {
    pm = null; wf = null; rel = null; packed = null; sheetSrc = null;
    const T = S.card, iv = T * MPM();
    model = MM.buildModel(DEM, sel, T, { scale: S.scale, hollow: false, rim: 0, base: S.tile ? Math.floor(DEM.lo / iv + 1e-9) * iv : undefined });
    const Gm = Gcur = model.G;
    planLabels();
    $('oArea').textContent = `${Gm.size.toFixed(0)} × ${Gm.size.toFixed(0)} m`;
    if (!model.layers.length) {
      ['oLevels', 'oLayers', 'oSheets', 'oHeight', 'oPaper'].forEach(id => $(id).textContent = '—');
      status(Gm.coverage < 0.01 ? 'This square is outside the survey. Move it onto the site.' : 'This square is too flat for any layers at this card thickness.', 'err');
      draw3D(); $('handView').innerHTML = ''; return;
    }
    const n = model.layers.length;
    $('oLevels').textContent = `${G.fmt(Gm.lo)} to ${G.fmt(Gm.hi)} m`;
    $('oLayers').textContent = `${n} × ${S.card} mm`;
    $('oSheets').textContent = 'A3 portrait';
    $('oHeight').textContent = `${+(n * T).toFixed(1)} mm + base`;
    $('oPaper').textContent = planPaper().name;
    const warn = Gm.coverage < 0.999 ? `About ${Math.round((1 - Gm.coverage) * 100)}% of this square is outside the survey and will be left at base level. ` : '';
    const many = n > 40 ? ` That is ${n} pieces of card to cut by hand: thicker card, a smaller scale or a smaller square keeps it manageable.` : '';
    status(warn + `Ready: ${n} layers of ${S.card} mm card, contours every ${mFmt(iv)} m from ${G.fmt(model.layers[0].L)} m to ${G.fmt(model.layers[n - 1].L)} m.` + many, warn || many ? 'warn' : 'ok');
    $('dlPlan').disabled = $('dlPlot').disabled = $('dlHand').disabled = false;
    draw3D(); drawHand();
  }
  // layer numbers for the hand-cut template, placed on the contour lines (model mm): every contour gets at least one,
  // long ones up to three, kept apart so they stay readable where the ground is steep
  function handLabels() {
    const sz = S.size, placed = [], lab = [];
    const near = (x, y, d) => placed.some(q => (q[0] - x) ** 2 + (q[1] - y) ** 2 < d * d);
    model.layers.forEach(ly => {
      const txt = String(ly.k).padStart(2, '0'), cand = [];
      let run = 0;                                                       // length along all of this contour's loops
      ly.outline.forEach(l => {
        for (let q = 0; q < l.length; q++) {
          const a = l[q], b2 = l[(q + 1) % l.length], seg = Math.hypot(b2[0] - a[0], b2[1] - a[1]);
          run += seg; const x = (a[0] + b2[0]) / 2, y = (a[1] + b2[1]) / 2;
          if (x < 4 || y < 4 || x > sz - 4 || y > sz - 4) continue;     // not along the square's edge
          cand.push({ x, y, run });
        }
      });
      if (!cand.length) return;
      const total = cand[cand.length - 1].run, want = Math.max(1, Math.min(3, Math.floor(total / 140) + 1));
      let got = 0;
      for (const minD of [14, 9, 6]) {                                    // relax spacing until each contour has a number
        for (let t = 0; t < want && got < want; t++) {
          const target = total * (t + 0.5) / want;
          const pick = cand.filter(c => !near(c.x, c.y, minD)).sort((p1, p2) => Math.abs(p1.run - target) - Math.abs(p2.run - target))[0];
          if (pick) { placed.push([pick.x, pick.y]); lab.push([pick.x, pick.y, txt]); got++; }
        }
        if (got) break;
      }
    });
    return lab;
  }
  // template preview: the square with its contours and layer numbers, as on the PDF
  function drawHand() {
    if (!model || !model.layers.length) return;
    const sz = S.size, n = model.layers.length;
    let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 ${sz + 16} ${sz + 16}" role="img" aria-label="Contour template preview"><rect x="-8" y="-8" width="${sz + 16}" height="${sz + 16}" fill="#fff"/>`;
    model.layers.forEach((ly, i) => {
      const heavy = ly.k % 5 === 0, d = ly.outline.map(l => 'M' + l.map(([x, y]) => `${x.toFixed(1)},${(sz - y).toFixed(1)}`).join('L') + 'Z').join('');
      out += `<path d="${d}" fill="none" stroke="${heavy ? '#111' : '#555'}" stroke-width="${heavy ? 0.5 : 0.25}"/>`;
    });
    handLabels().forEach(([x, y, t]) => { out += `<rect x="${(x - 2.2).toFixed(1)}" y="${(sz - y - 1.5).toFixed(1)}" width="4.4" height="3" fill="#fff"/><text x="${x.toFixed(1)}" y="${(sz - y).toFixed(1)}" font-size="2.4" font-family="Helvetica,Arial,sans-serif" text-anchor="middle" dominant-baseline="central" fill="#c0432a">${t}</text>`; });
    out += `<rect x="0" y="0" width="${sz}" height="${sz}" fill="none" stroke="#000" stroke-width="0.6"/></svg>`;
    $('handLbl').textContent = `A3 contour template · 1:${S.scale} · ${n} layers of ${S.card} mm card`;
    $('handView').innerHTML = out;
  }

  function computePrint(sel) {
    model = null; packed = null;
    const mould = S.output === 'mould';
    pm = mould ? MM.buildMould(DEM, sel, { scale: S.scale, vex: S.vex, castBase: S.castBase, offset: PLACE, datum: datum() })
      : MM.buildPrint(DEM, sel, { scale: S.scale, base: S.base, vex: S.vex, arrow: S.arrow, offset: PLACE, datum: datum() });
    const Gm = Gcur = pm.G;
    planLabels();
    $('oArea').textContent = `${Gm.size.toFixed(0)} × ${Gm.size.toFixed(0)} m`;
    if (pm.error) {
      ['oLevels', 'oLayers', 'oSheets', 'oHeight', 'oPaper'].forEach(id => $(id).textContent = '—');
      status('This square is outside the survey. Move it onto the site.', 'err');
      draw3D(); drawBed(); return;
    }
    $('oLevels').textContent = `${G.fmt(Gm.lo)} to ${G.fmt(Gm.hi)} m`;
    $('oLayers').textContent = `${pm.height.toFixed(0)} mm`;
    $('oSheets').textContent = mould ? `${pm.cast} × ${pm.cast} mm` : `${pm.size} × ${pm.size} mm`;
    $('oHeight').textContent = mould ? `${pm.volume.toFixed(1)} litres` : S.vex === 1 ? `1:${S.scale} true` : `1:${+(S.scale / S.vex).toFixed(1)} (${S.vex}×)`;
    $('oPaper').textContent = planPaper().name;
    $('dlPlan').disabled = $('dlPlot').disabled = false;
    if (pm.height > MAXH) {
      status(`At ${pm.height.toFixed(0)} mm this print is taller than the P1S can build (${MAXH} mm). Choose true-scale heights or move the square.`, 'err');
    } else {
      const warn = Gm.coverage < 0.999 ? `About ${Math.round((1 - Gm.coverage) * 100)}% of this square is outside the survey and will print at base level. ` : '';
      status(warn + (mould
        ? `Ready: a ${pm.size} × ${pm.size} mm mould, ${pm.height.toFixed(0)} mm tall. It casts a ${pm.cast} mm square (${mFmt(pm.cast * MPM())} × ${mFmt(pm.cast * MPM())} m at 1:${S.scale}) and takes about ${pm.volume.toFixed(1)} litres of plaster to fill.`
        : `Ready: a ${pm.size} × ${pm.size} mm print, ${pm.height.toFixed(0)} mm at its tallest point.`), warn ? 'warn' : 'ok');
      $('dlPrint').disabled = $('dlStl').disabled = false;
    }
    draw3D(); drawBed();
  }

  function computeCarve(sel) {
    model = null; packed = null;
    pm = MM.buildCarve(DEM, sel, { scale: S.scale, base: S.cncBase, stock: S.stock, fit: S.fit, maxCells: 320, datum: datum(), span: S.tile ? DEM.hi - DEM.lo : undefined });
    const Gm = Gcur = pm.G;
    $('oArea').textContent = `${Gm.size.toFixed(0)} × ${Gm.size.toFixed(0)} m`;
    planLabels();
    if (pm.error) {
      ['oLevels', 'oLayers', 'oSheets', 'oHeight', 'oPaper'].forEach(id => $(id).textContent = '—');
      status('This square is outside the survey. Move it onto the site.', 'err'); draw3D(); drawCarve(); return;
    }
    const blk = Math.round(pm.size + 40);
    $('oLevels').textContent = `${G.fmt(Gm.lo)} to ${G.fmt(Gm.hi)} m`;
    $('oLayers').textContent = `${pm.height.toFixed(0)} mm`;
    $('oSheets').textContent = `${blk} × ${blk} × ${S.stock}`;
    $('oHeight').textContent = pm.vex === 1 ? `1:${S.scale} true` : `1:${Math.round(S.scale / pm.vex)} (fitted)`;
    $('oPaper').textContent = planPaper().name;
    $('dlPlan').disabled = $('dlPlot').disabled = false;
    if (pm.height > S.stock + 0.01) {
      status(`At true scale this square is ${pm.height.toFixed(0)} mm tall, more than your ${S.stock} mm material. Choose thicker material (laminate sheets, or a foam block), a smaller square, or Heights: Fit to the material.`, 'err');
    } else {
      const warn = [];
      if (Gm.coverage < 0.999) warn.push(`About ${Math.round((1 - Gm.coverage) * 100)}% of this square is outside the survey and will be carved flat at base level.`);
      if (pm.height > 75) warn.push(`It is ${pm.height.toFixed(0)} mm deep, which needs long-reach bits: check the tooling with the technician.`);
      status((warn.length ? warn.join(' ') + ' ' : '') + `Ready: a ${pm.size} × ${pm.size} mm carving, ${pm.height.toFixed(0)} mm tall, from ${S.stock} mm material${pm.vex < 1 ? `, heights flattened to 1:${Math.round(S.scale / pm.vex)}` : ''}.`, warn.length ? 'warn' : 'ok');
      $('dlCnc').disabled = false;
    }
    draw3D(); drawCarve();
  }

  // ---------- CNC section: the block, the ground through the middle of the square (west to east), and the bed
  function drawCarve() {
    const v = $('cncView');
    if (!pm || pm.error || !pm.carve) { v.innerHTML = '<p class="small">Move your square onto the survey to see the carving.</p>'; return; }
    const N = pm.grid, Sz = pm.size, T = S.stock, r = Math.floor(N / 2);
    const f = Math.max(1, Math.round(0.24 * Sz / Math.max(T, pm.height)));            // vertical drawing factor
    const W = Sz + 40, Hd = Math.max(T, pm.height) * f, pad = 22, vw = W + pad * 2, vh = Hd + 64;
    const X = x => pad + 20 + x, Y = z => 28 + Hd - z * f;
    let prof = `M${X(0)} ${Y(0)}`;
    for (let c = 0; c < N; c++) { const k = (r * N + c) * 3; prof += ` L${X(pm.positions[k]).toFixed(1)} ${Y(pm.positions[k + 2]).toFixed(1)}`; }
    prof += ` L${X(Sz)} ${Y(0)} Z`;
    const ink = css('--ink'), mut = css('--muted'), rule = css('--rule'), board = css('--board'), cut = css('--cut'), fs = Math.max(9, vw / 48);
    const over = pm.height > T + 0.01;
    // bed inset: the block on the Falcon's 2500 × 1300 bed
    const bs = 150 / BEDCNC[0], bw = BEDCNC[0] * bs, bh = BEDCNC[1] * bs;
    v.innerHTML = `<svg viewBox="0 0 ${vw} ${vh}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Section through the block: material ${T} mm, carving ${pm.height.toFixed(0)} mm">
      <rect x="${X(-20)}" y="${Y(T)}" width="${W}" height="${T * f}" fill="${rule}" opacity="0.55" stroke="${mut}" stroke-width="1"/>
      <path d="${prof}" fill="${board}" stroke="${ink}" stroke-width="1"/>
      <path d="M${X(-20)} ${Y(pm.base)}H${X(Sz + 20)}" stroke="${cut}" stroke-width="1" stroke-dasharray="5 4"/>
      ${over ? `<path d="M${X(-20)} ${Y(T)}H${X(Sz + 20)}" stroke="${cut}" stroke-width="2"/>` : ''}
      <text x="${X(-18)}" y="${Y(T) - 6}" font-family="IBM Plex Mono, monospace" font-size="${fs}" fill="${over ? cut : mut}">material ${T} mm${over ? ' · too thin' : ''}</text>
      <text x="${X(Sz + 18)}" y="${Y(pm.height) - 6}" text-anchor="end" font-family="IBM Plex Mono, monospace" font-size="${fs}" fill="${ink}">carving ${pm.height.toFixed(0)} mm</text>
      <text x="${X(Sz + 18)}" y="${Y(pm.base) + fs + 3}" text-anchor="end" font-family="IBM Plex Mono, monospace" font-size="${fs}" fill="${cut}">uncut base ${pm.base} mm</text>
      <text x="${X(-18)}" y="${vh - 10}" font-family="IBM Plex Mono, monospace" font-size="${fs}" fill="${mut}">W ← section through the middle, ${Sz} mm → E${f > 1 ? ` · heights drawn ×${f}` : ''}</text>
    </svg>
    <svg viewBox="0 0 ${bw + 200} ${bh + 24}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="The block on the router bed" style="max-width:420px">
      <rect x="1" y="1" width="${bw}" height="${bh}" fill="none" stroke="${mut}" stroke-width="1"/>
      <rect x="${1 + 20 * bs}" y="${1 + bh - (Sz + 40) * bs - 20 * bs}" width="${(Sz + 40) * bs}" height="${(Sz + 40) * bs}" fill="${board}" stroke="${ink}" stroke-width="0.8"/>
      <text x="${bw + 10}" y="${bh / 2}" font-family="IBM Plex Mono, monospace" font-size="11" fill="${mut}">Falcon bed</text>
      <text x="${bw + 10}" y="${bh / 2 + 14}" font-family="IBM Plex Mono, monospace" font-size="11" fill="${mut}">2500 × 1300 mm</text>
    </svg>`;
  }

  // ---------- print bed preview: the print, shaded from its own heights, on the 256 mm plate (front at the bottom)
  function drawBed() {
    const v = $('bedView');
    if (!pm || pm.error) { v.innerHTML = '<p class="small">Move your square onto the survey to see the print.</p>'; return; }
    const N = pm.G.N, z = (r, c) => pm.positions[(Math.max(0, Math.min(N - 1, r)) * N + Math.max(0, Math.min(N - 1, c))) * 3 + 2];
    const cnv = document.createElement('canvas'); cnv.width = cnv.height = N;
    let zlo = Infinity, zhi = -Infinity; for (let i = 0; i < N * N; i++) { const q = pm.positions[i * 3 + 2]; if (q < zlo) zlo = q; if (q > zhi) zhi = q; }
    const g = cnv.getContext('2d'), im = g.createImageData(N, N), span = Math.max(1, zhi - zlo);
    for (let row = 0; row < N; row++) for (let c = 0; c < N; c++) {
      const r = N - 1 - row;                                   // image row 0 = north
      const dx = (z(r, c + 1) - z(r, c - 1)) / 4, dy = (z(r + 1, c) - z(r - 1, c)) / 4;
      const shade = Math.max(0, Math.min(1, 0.72 + (-dx + dy) * 0.35));           // light from the north-west
      const t = (z(r, c) - zlo) / span, k = (row * N + c) * 4, base = 150 + 80 * t;
      im.data[k] = base * shade + 20; im.data[k + 1] = base * shade + 22; im.data[k + 2] = base * shade + 18; im.data[k + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    const ink = css('--ink'), mut = css('--muted'), rule = css('--rule'), acc = css('--accent'), ox = PLACE[0], oy = BED - PLACE[1] - PRINT, ins = pm.inset || 0, img = PRINT - 2 * ins;
    let grid = '';
    for (let t = 32; t < 256; t += 32) grid += `<path d="M${t} 0V256M0 ${t}H256" stroke="${rule}" stroke-width="0.5"/>`;
    v.innerHTML = `<svg viewBox="-16 -20 292 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Your ${PRINT} mm print on the 256 mm build plate, north up">
      <rect x="0" y="0" width="256" height="256" fill="${css('--stage')}" stroke="${mut}" stroke-width="0.8"/>${grid}
      <rect x="0" y="${BED - EXCL[1]}" width="${EXCL[0]}" height="${EXCL[1]}" fill="${mut}" opacity="0.35"/>
      <text x="${EXCL[0] + 3}" y="${BED - 4}" font-family="IBM Plex Mono, monospace" font-size="6" fill="${mut}">no-print corner</text>
      ${ins ? `<rect x="${ox}" y="${oy}" width="${PRINT}" height="${PRINT}" fill="${mut}" opacity="0.25"/>` : ''}
      <image href="${cnv.toDataURL()}" x="${ox + ins}" y="${oy + ins}" width="${img}" height="${img}" preserveAspectRatio="none"/>
      <rect x="${ox}" y="${oy}" width="${PRINT}" height="${PRINT}" fill="none" stroke="${acc}" stroke-width="1.2"/>
      <g transform="translate(240 -11)"><path d="M0 -7 L4 3 L0 1 L-4 3 Z" fill="${ink}"/><text x="8" y="2" font-family="IBM Plex Mono, monospace" font-size="8" fill="${ink}">N</text></g>
      <text x="0" y="-8" font-family="IBM Plex Mono, monospace" font-size="7.5" fill="${mut}">Plate 256 × 256 mm · back</text>
      <path d="M${ox} 265H${ox + PRINT}M${ox} 261V269M${ox + PRINT} 261V269" stroke="${ink}" stroke-width="0.6"/>
      <text x="${ox + PRINT / 2}" y="276" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="7.5" fill="${ink}">${pm.mould ? `${PRINT} mm mould · casts ${pm.cast} mm = ${mFmt(pm.cast * MPM())} m · ${pm.height.toFixed(0)} mm tall` : `${PRINT} mm = ${mFmt(PRINT * MPM())} m on site · ${pm.height.toFixed(0)} mm tall`}</text>
    </svg>`;
  }


  // ---------- waffle sections
  function computeWaffle(sel) {
    model = null; packed = null; rel = null;
    wf = MM.buildWaffle(DEM, sel, { scale: S.scale, board: S.board, spacing: S.spacing, base: 10, datum: datum() });
    const Gm = Gcur = wf.G;
    planLabels();
    $('oArea').textContent = `${Gm.size.toFixed(0)} × ${Gm.size.toFixed(0)} m`;
    if (wf.error) { ['oLevels', 'oLayers', 'oSheets', 'oHeight', 'oPaper'].forEach(id => $(id).textContent = '—'); status('This square is outside the survey. Move it onto the site.', 'err'); sheetSrc = null; $('sheetView').innerHTML = ''; draw3D(); return; }
    wpk = MM.packShelves(wf.pieces, S.sheet[0], S.sheet[1]);
    if (wpk.error) { status(wpk.error, 'err'); return; }
    sheetSrc = { count: wpk.count, svg: i => { const { cut, eng } = MM.shelfPaths(wpk, i); return MM.pathsSVG(S.sheet[0], S.sheet[1], cut, eng, 'sheet'); } };
    sheetIx = Math.min(sheetIx, wpk.count - 1);
    const n = wf.pos.length;
    $('oLevels').textContent = `${G.fmt(Gm.lo)} to ${G.fmt(Gm.hi)} m`;
    $('oLayers').textContent = `${n} + ${n} pieces`;
    $('oSheets').textContent = `${wpk.count} × ${S.sheet[0]}×${S.sheet[1]}`;
    $('oHeight').textContent = `${wf.height.toFixed(0)} mm + base`;
    $('oPaper').textContent = planPaper().name;
    const warn = Gm.coverage < 0.999 ? `About ${Math.round((1 - Gm.coverage) * 100)}% of this square is outside the survey and will be cut at base level. ` : '';
    status(warn + `Ready: ${n * 2} pieces, a section every ${wf.spacing.toFixed(1)} mm (${(wf.spacing * MPM()).toFixed(1)} m), on ${wpk.count} sheet${wpk.count > 1 ? 's' : ''}.`, warn ? 'warn' : 'ok');
    $('dlPlan').disabled = $('dlPlot').disabled = $('dlWaffle').disabled = false;
    draw3D(); drawSheet();
  }

  // ---------- engraved relief: a greyscale image, black = lowest ground (engraved deepest), white = highest
  function reliefCanvas(r) {
    const c = document.createElement('canvas'); c.width = c.height = r.px;
    const g = c.getContext('2d'), im = g.createImageData(r.px, r.px), span = Math.max(1e-6, r.hi - r.lo);
    for (let i = 0; i < r.px * r.px; i++) { const h = r.h[i], v = h === h ? Math.max(0, Math.min(255, Math.round((h - r.lo) / span * 255))) : 0; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
    g.putImageData(im, 0, 0); return c;
  }
  const reliefPx = () => Math.round(S.size * S.dpi / 25.4);
  function computeRelief(sel) {
    model = null; packed = null; wf = null;
    MM.setScale(S.scale); rel = MM.reliefGrid(DEM, sel, 360); MM.setScale(S.scale);
    const Gm = Gcur = rel.G;
    planLabels();
    $('oArea').textContent = `${Gm.size.toFixed(0)} × ${Gm.size.toFixed(0)} m`;
    if (!(Gm.hi > Gm.lo)) { ['oLevels', 'oLayers', 'oSheets', 'oHeight', 'oPaper'].forEach(id => $(id).textContent = '—'); status('This square is outside the survey. Move it onto the site.', 'err'); $('reliefView').innerHTML = ''; r3d = null; draw3D(); return; }
    rel.lo = S.tile ? DEM.lo : Gm.lo; rel.hi = S.tile ? DEM.hi : Gm.hi;
    const px = reliefPx();
    $('oLevels').textContent = `${G.fmt(Gm.lo)} to ${G.fmt(Gm.hi)} m`;
    $('oLayers').textContent = `${px} × ${px} px`;
    $('oSheets').textContent = `${S.dpi} dpi`;
    $('oHeight').textContent = `${G.fmt(rel.lo)} to ${G.fmt(rel.hi)} m`;
    $('oPaper').textContent = planPaper().name;
    $('reliefLbl').textContent = `Engraving image · ${S.size} × ${S.size} mm at ${S.dpi} dpi`;
    $('reliefView').innerHTML = `<img alt="Greyscale engraving image of your square: black is the lowest ground, white the highest" src="${reliefCanvas(rel).toDataURL()}">`;
    r3d = MM.buildCarve(DEM, sel, { scale: S.scale, base: 4, stock: 16, fit: 'stock', maxCells: 150, datum: datum(), span: S.tile ? DEM.hi - DEM.lo : undefined });
    const warn = Gm.coverage < 0.999 ? `About ${Math.round((1 - Gm.coverage) * 100)}% of this square is outside the survey and will engrave as the lowest ground. ` : '';
    status(warn + `Ready: a ${px} × ${px} pixel image for ${S.size} × ${S.size} mm. Black is ${G.fmt(rel.lo)} m, white ${G.fmt(rel.hi)} m.`, warn ? 'warn' : 'ok');
    $('dlPlan').disabled = $('dlPlot').disabled = $('dlRelief').disabled = false;
    draw3D();
  }

  // ---------- sheet preview (contour layers and waffle)
  function drawSheet() {
    if (!sheetSrc) return;
    $('sheetLbl').textContent = `Laser sheet ${sheetIx + 1} of ${sheetSrc.count} · ${S.sheet[0]} × ${S.sheet[1]} mm`;
    $('sheetView').innerHTML = sheetSrc.svg(sheetIx).replace(/^<\?xml[^>]*>\s*/, '');
  }
  $('sPrev').onclick = () => { if (!sheetSrc) return; sheetIx = (sheetIx - 1 + sheetSrc.count) % sheetSrc.count; drawSheet(); };
  $('sNext').onclick = () => { if (!sheetSrc) return; sheetIx = (sheetIx + 1) % sheetSrc.count; drawSheet(); };

  // ---------- 3D preview
  const stage = $('p3dStage');
  const R = new THREE.WebGLRenderer({ canvas: $('p3d'), antialias: true }); R.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(35, 1, 1, 10000);
  const ctl = new THREE.OrbitControls(cam, $('p3d')); ctl.enableDamping = true; ctl.maxPolarAngle = Math.PI * 0.49;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f88, 0.6));
  const sun = new THREE.DirectionalLight(0xfff4e6, 0.75); sun.position.set(-300, 600, 400); scene.add(sun);
  const group = new THREE.Group(); scene.add(group);
  let fitted = false;
  function draw3D() {
    if (!fitted && stage.getBoundingClientRect().height < 10) { requestAnimationFrame(draw3D); return; }
    group.children.slice().forEach(o => { group.remove(o); o.geometry && o.geometry.dispose(); });
    if (S.output === 'cnc') { drawCarve3D(); if (!fitted) fit3D(); return; }
    if (S.output !== 'card' && S.output !== 'hand') { drawPrint3D(); if (!fitted) fit3D(); return; }
    if (S.output === 'card' && S.cardKind === 'waffle') { drawWaffle3D(); if (!fitted) fit3D(); return; }
    if (S.output === 'card' && S.cardKind === 'relief') { drawRelief3D(); if (!fitted) fit3D(); return; }
    const sz = S.size, bt = 6;
    const base = new THREE.Mesh(new THREE.BoxGeometry(sz, bt, sz), new THREE.MeshStandardMaterial({ color: 0xa98d6c, roughness: 0.9 }));
    base.position.set(0, -bt / 2, 0); group.add(base);
    if (model) model.layers.forEach((ly, i) => {
      const shapes = ly.polys.map(p => { const s = new THREE.Shape(p.outer.map(([x, y]) => new THREE.Vector2(x - sz / 2, y - sz / 2))); p.holes.forEach(h => s.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x - sz / 2, y - sz / 2))))); return s; });
      const g = new THREE.ExtrudeGeometry(shapes, { depth: LT(), bevelEnabled: false, curveSegments: 1 });
      g.rotateX(-Math.PI / 2); g.translate(0, i * LT(), 0);
      group.add(new THREE.Mesh(g, [new THREE.MeshStandardMaterial({ color: 0xa2a49f, roughness: 0.95 }), new THREE.MeshStandardMaterial({ color: 0x7d7f7a, roughness: 1 })]));
    });
    if (!fitted) fit3D();
  }
  const plaMat = new THREE.MeshStandardMaterial({ color: 0xd8d5cc, roughness: 0.7, flatShading: true });
  const plateMat = new THREE.MeshStandardMaterial({ color: 0x3b3f3e, roughness: 0.85 });
  function drawPrint3D() {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(256, 2, 256), plateMat); plate.position.set(0, -1, 0); group.add(plate);
    if (!pm || pm.error) return;
    const src = pm.positions, n = src.length / 3, xyz = new Float32Array(src.length), h = 128;
    for (let i = 0; i < n; i++) { xyz[i * 3] = src[i * 3] - h; xyz[i * 3 + 1] = src[i * 3 + 2]; xyz[i * 3 + 2] = -(src[i * 3 + 1] - h); }   // north = −z, as for the card model
    let g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(xyz, 3)); g.setIndex(new THREE.BufferAttribute(pm.indices, 1));
    g = g.toNonIndexed(); g.computeVertexNormals();
    group.add(new THREE.Mesh(g, plaMat));
  }
  const mdfMat = new THREE.MeshStandardMaterial({ color: 0xb59570, roughness: 0.9, flatShading: true });
  const blockMat = new THREE.MeshBasicMaterial({ color: 0x8a8f88, transparent: true, opacity: 0.12, depthWrite: false });
  function drawCarve3D() {
    if (!pm || pm.error || !pm.carve) return;
    const Sz = pm.size, T = S.stock, src = pm.positions, n = src.length / 3, xyz = new Float32Array(src.length), h = Sz / 2;
    for (let i = 0; i < n; i++) { xyz[i * 3] = src[i * 3] - h; xyz[i * 3 + 1] = src[i * 3 + 2]; xyz[i * 3 + 2] = -(src[i * 3 + 1] - h); }
    let g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(xyz, 3)); g.setIndex(new THREE.BufferAttribute(pm.indices, 1));
    g = g.toNonIndexed(); g.computeVertexNormals(); mdfMat.color = new THREE.Color(css('--board') || '#b59570');
    group.add(new THREE.Mesh(g, mdfMat));
    const blk = new THREE.Mesh(new THREE.BoxGeometry(Sz + 40, T, Sz + 40), blockMat); blk.position.y = T / 2; group.add(blk);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(blk.geometry), new THREE.LineBasicMaterial({ color: pm.height > T + 0.01 ? 0xc0432a : 0x8a8f88 }));
    edges.position.y = T / 2; group.add(edges);
  }
  const wMatA = new THREE.MeshStandardMaterial({ color: 0xb4b6b0, roughness: 0.95 }), wMatB = new THREE.MeshStandardMaterial({ color: 0x9a9c96, roughness: 0.95 });
  const boardMat = new THREE.MeshStandardMaterial({ color: 0xa98d6c, roughness: 0.9 }), plyMat = new THREE.MeshStandardMaterial({ color: 0xd9c19a, roughness: 0.85, flatShading: true });
  function drawWaffle3D() {
    const sz = S.size, h2 = sz / 2;
    const base = new THREE.Mesh(new THREE.BoxGeometry(sz, 6, sz), boardMat); base.position.y = -3; group.add(base);
    if (!wf || wf.error) return;
    const t = wf.board;
    wf.pieces.forEach(pc => {
      const g = new THREE.ExtrudeGeometry(new THREE.Shape(pc.outline.map(([u, v]) => new THREE.Vector2(u, v))), { depth: t, bevelEnabled: false, curveSegments: 1 });
      if (pc.dir === 'A') g.translate(-h2, 0, -(pc.at + t / 2) + h2);                    // west–east piece at y = at
      else { g.rotateY(Math.PI / 2); g.translate(pc.at - t / 2 - h2, 0, h2); }           // south–north piece at x = at
      group.add(new THREE.Mesh(g, pc.dir === 'A' ? wMatA : wMatB));
    });
  }
  function drawRelief3D() {
    if (!r3d || r3d.error) return;
    const Sz = r3d.size, src = r3d.positions, n = src.length / 3, xyz = new Float32Array(src.length), h = Sz / 2, k = S.size / Sz;
    for (let i = 0; i < n; i++) { xyz[i * 3] = (src[i * 3] - h) * k; xyz[i * 3 + 1] = src[i * 3 + 2]; xyz[i * 3 + 2] = -(src[i * 3 + 1] - h) * k; }
    let g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(xyz, 3)); g.setIndex(new THREE.BufferAttribute(r3d.indices, 1));
    g = g.toNonIndexed(); g.computeVertexNormals(); group.add(new THREE.Mesh(g, plyMat));
  }
  function fit3D() {
    const r = stage.getBoundingClientRect(); R.setSize(r.width, r.height, false); cam.aspect = r.width / Math.max(1, r.height); cam.updateProjectionMatrix();
    cam.position.set(-S.size * 1.25, S.size * 1.35, S.size * 1.7); ctl.target.set(0, 10, 0); ctl.update(); fitted = true;
  }
  new ResizeObserver(() => { const r = stage.getBoundingClientRect(); R.setSize(r.width, r.height, false); cam.aspect = r.width / Math.max(1, r.height); cam.updateProjectionMatrix(); }).observe(stage);
  const bg = () => { scene.background = new THREE.Color(css('--stage') || '#dfe2dc'); };
  (function loop() { ctl.update(); R.render(scene, cam); requestAnimationFrame(loop); })();

  // ---------- downloads
  const slug = () => ((S.name || 'student').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'student') + (S.tile ? '_tile-' + tileId() : '');
  const today = () => new Date().toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });
  function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }
  // plan scale: the largest of 1:100, 1:200, 1:500, 1:1000, 1:2000 at which the square fits an A0 sheet
  function planScale() { const ps = [10, 5, 2, 1, 0.5].find(f => Gcur.size * f <= 800) || 0.5; return { ps, ratio: 1000 / ps }; }
  // plan contour interval: 0.5 m at 1:100 and 1:200, 1 m at 1:500, 2 m beyond
  function planStep() { if (!Gcur) return 0.5; const ps = planScale().ps; return ps >= 5 ? 0.5 : ps >= 2 ? 1 : 2; }
  function planLabels() { const r = planScale().ratio; $('dlPlan').textContent = `Download 1:${r} plan (PDF)`; $('dlPlot').textContent = `Download 1:${plotScale().ratio} plotter SVG (NextDraw, A1)`; $('specPlan').textContent = `1:${r}`; document.querySelectorAll('.js-ps').forEach(e => e.textContent = `1:${r}`); $('specCont').textContent = `every ${planStep()} m`; }
  function planPaper() { const D = Gcur.size * planScale().ps; return D <= 545 ? { name: 'A1 landscape', w: 841, h: 594 } : { name: 'A0 landscape', w: 1189, h: 841 }; }
  function clipSeg(x1, y1, x2, y2, xmin, ymin, xmax, ymax) {      // Liang–Barsky
    let t0 = 0, t1 = 1; const dx = x2 - x1, dy = y2 - y1;
    for (const [p, q] of [[-dx, x1 - xmin], [dx, xmax - x1], [-dy, y1 - ymin], [dy, ymax - y1]]) {
      if (p === 0) { if (q < 0) return null; } else { const t = q / p; if (p < 0) { if (t > t1) return null; if (t > t0) t0 = t; } else { if (t < t0) return null; if (t < t1) t1 = t; } }
    }
    return [x1 + t0 * dx, y1 + t0 * dy, x1 + t1 * dx, y1 + t1 * dy];
  }
  let hillData = null;
  async function hillshadeURL() {
    if (hillData) return hillData;
    const img = G.hill, c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0);
    hillData = c.toDataURL('image/jpeg', 0.85); return hillData;
  }

  // features on a PDF plan: X, Y map metres to page mm; box clips
  function drawFeatures(doc, X, Y, box, Gm, light) {
    const t0 = light ? 0.7 : 0, col = (...c) => doc.setDrawColor(...(c.length === 1 ? [c[0], c[0], c[0]] : c).map(v => Math.round(v + (255 - v) * t0))), lw = w => doc.setLineWidth(light ? w * 0.6 : w);
    const poly = (pts, close) => { for (let i = 1; i < pts.length + (close ? 1 : 0); i++) { const p = pts[i - 1], q = pts[i % pts.length]; const a = clipSeg(X(p[0]), Y(p[1]), X(q[0]), Y(q[1]), box[0], box[1], box[2], box[3]); if (a) doc.line(a[0], a[1], a[2], a[3]); } };
    (pack.features || []).forEach(f => {
      const pts = f.pts || []; if (!pts.length || f.kind === 'area') return;
      const closed = G.KINDS[f.kind]?.closed || f.closed;
      if (f.kind === 'water') { doc.setLineDashPattern([3, 1.5], 0); col(58, 95, 140); lw(0.4); }
      else if (f.kind === 'road') { doc.setLineDashPattern([], 0); col(90); lw(0.6); }
      else if (f.kind === 'path') { doc.setLineDashPattern([2, 1.2], 0); col(120, 100, 70); lw(0.3); }
      else if (f.kind === 'boundary') { doc.setLineDashPattern([4, 1, 1, 1], 0); col(192, 67, 42); lw(0.5); }
      else { doc.setLineDashPattern([1.5, 1], 0); col(0); lw(0.3); }
      if (f.kind === 'point') { const [x, y] = pts[0], px = X(x), py = Y(y); if (px > box[0] && px < box[2] && py > box[1] && py < box[3]) { doc.setLineDashPattern([], 0); doc.circle(px, py, 0.8, 'F'); } }
      else poly(pts, closed);
      doc.setLineDashPattern([], 0);
      if (f.name && f.kind === 'building') {
        let cx = 0, cy = 0, ymax = -1e9; pts.forEach(p => { cx += p[0]; cy += p[1]; ymax = Math.max(ymax, p[1]); }); cx /= pts.length;
        const px = X(cx), py = Y(ymax) - 2;
        if (px > box[0] + 10 && px < box[2] - 10 && py > box[1] + 4 && py < box[3]) { doc.setFontSize(light ? 6.5 : 8); doc.setTextColor(light ? 150 : 0); doc.text(f.name + ' (approx.)', px, py, { align: 'center' }); doc.setTextColor(0); }
      }
    });
  }

  async function makePlanPDF() {
    const { jsPDF } = window.jspdf, paper = planPaper(), Gm = Gcur;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [paper.w, paper.h] });
    MM.setScale(S.scale);
    const { ps, ratio } = planScale(), D = Gm.size * ps, m = 12, dx0 = 24, dy0 = (paper.h - D) / 2, st = MM.STEP;
    const cstep = planStep(), lab = cstep < 1 ? 1 : 5, idx = cstep < 1 ? 5 : cstep < 2 ? 5 : 10, grid = ps >= 5 ? 10 : ps >= 2 ? 20 : ps >= 1 ? 50 : 100, f = Math.max(1, 5 / ps);
    const X = x => dx0 + (x - Gm.x0) * ps, Y = y => dy0 + D - (y - Gm.y0) * ps;
    doc.setLineWidth(0.5); doc.rect(m, m, paper.w - 2 * m, paper.h - 2 * m);
    // outside-survey shading
    doc.setFillColor(232, 232, 228);
    for (let r = 1; r < Gm.P - 1; r++) { let run = -1; for (let c = 1; c <= Gm.P - 1; c++) { const out = c < Gm.P - 1 && Gm.V[r * Gm.P + c] <= -1e3; if (out && run < 0) run = c; if (!out && run >= 0) { const x1 = Gm.x0 + (run - 1.5) * st, x2 = Gm.x0 + (c - 1.5) * st, y = Gm.y0 + (r - 1) * st; const a = clipSeg(X(x1), Y(y + st / 2), X(x2), Y(y + st / 2), dx0, dy0, dx0 + D, dy0 + D); if (a) doc.rect(a[0], Y(y + st / 2), a[2] - a[0], st * ps, 'F'); run = -1; } } }
    // contours
    const lv = MM.planSegments(Gm, cstep);
    lv.forEach(({ L, segs }) => {
      const five = Math.abs(L / idx - Math.round(L / idx)) < 1e-6, one = Math.abs(L / lab - Math.round(L / lab)) < 1e-6 && lab === 1;
      if (five) { doc.setDrawColor(20); doc.setLineWidth(0.35); } else if (one) { doc.setDrawColor(70); doc.setLineWidth(0.18); } else { doc.setDrawColor(150); doc.setLineWidth(0.1); }
      for (let k = 0; k < segs.length; k += 4) { const a = clipSeg(X(segs[k]), Y(segs[k + 1]), X(segs[k + 2]), Y(segs[k + 3]), dx0, dy0, dx0 + D, dy0 + D); if (a) doc.line(a[0], a[1], a[2], a[3]); }
    });
    // contour labels on whole metres
    doc.setFontSize(6.5); doc.setTextColor(30);
    const placed = [];
    lv.filter(o => Math.abs(o.L / lab - Math.round(o.L / lab)) < 1e-6).forEach(({ L, segs }) => {
      for (let ax = 8 * f; ax < Gm.size; ax += 17 * f) for (let ay = 8 * f; ay < Gm.size; ay += 17 * f) {
        let best = -1, bd = 36 * f * f;
        for (let k = 0; k < segs.length; k += 4) { const mx = (segs[k] + segs[k + 2]) / 2 - Gm.x0, my = (segs[k + 1] + segs[k + 3]) / 2 - Gm.y0, d = (mx - ax) ** 2 + (my - ay) ** 2; if (d < bd) { bd = d; best = k; } }
        if (best < 0) continue;
        const mx = (segs[best] + segs[best + 2]) / 2, my = (segs[best + 1] + segs[best + 3]) / 2;
        if (placed.some(p => (p[0] - mx) ** 2 + (p[1] - my) ** 2 < 100 * f * f)) continue;
        if (mx - Gm.x0 < 2 * f || my - Gm.y0 < 2 * f || mx - Gm.x0 > Gm.size - 2 * f || my - Gm.y0 > Gm.size - 2 * f) continue;
        placed.push([mx, my]);
        let ang = Math.atan2(segs[best + 3] - segs[best + 1], segs[best + 2] - segs[best]) * 180 / Math.PI;
        if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
        doc.text(String(Math.round(L)), X(mx), Y(my), { angle: ang, align: 'center', baseline: 'middle' });
      }
    });
    // spot heights on a grid that suits the plan scale
    doc.setFontSize(5.5); doc.setDrawColor(0); doc.setLineWidth(0.15); doc.setTextColor(0);
    for (let gx = grid; gx < Gm.size; gx += grid) for (let gy = grid; gy < Gm.size; gy += grid) {
      const h = MM.heightAt(Gm, Gm.x0 + gx, Gm.y0 + gy); const px = X(Gm.x0 + gx), py = Y(Gm.y0 + gy);
      doc.line(px - 1.2, py, px + 1.2, py); doc.line(px, py - 1.2, px, py + 1.2);
      if (h === h) doc.text(h.toFixed(2), px + 1.4, py - 0.8);
    }
    // site features (approximate)
    drawFeatures(doc, X, Y, [dx0, dy0, dx0 + D, dy0 + D], Gm);
    // drawing frame + grid ticks
    doc.setDrawColor(0); doc.setLineWidth(0.35); doc.rect(dx0, dy0, D, D);
    doc.setFontSize(7); doc.setLineWidth(0.2);
    for (let t = 0; t <= Gm.size + 1e-6; t += grid) {
      doc.line(X(Gm.x0 + t), dy0 + D, X(Gm.x0 + t), dy0 + D + 3); doc.text(`${t}`, X(Gm.x0 + t), dy0 + D + 6.5, { align: 'center' });
      doc.line(dx0 - 3, Y(Gm.y0 + t), dx0, Y(Gm.y0 + t)); doc.text(`${t}`, dx0 - 4, Y(Gm.y0 + t) + 1, { align: 'right' });
    }
    // title block
    const tx = dx0 + D + 18, tw = paper.w - m - tx - 6; let ty = dy0;
    doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.text(doc.splitTextToSize(pack.name, tw)[0], tx, ty + 6);
    doc.setFontSize(11); doc.setFont('helvetica', 'normal'); doc.text('Site plan · your model area', tx, ty + 13);
    const rows = [['PROJECT', (pack.notes || pack.year || '').split(/\n|\. /)[0].slice(0, 60)], ['SITE', [pack.place, pack.year].filter(Boolean).join(' · ')], ['NAME', (S.name || '') + (S.tile ? `   ·   class tile ${tileId()}` : '')], ['SCALE', `1:${ratio} @ ${paper.name.split(' ')[0]}`], ['DATE', today()], ['MODEL', `1:${S.scale} · ${S.size} × ${S.size} mm`], ['AREA', `${mFmt(Gm.size)} × ${mFmt(Gm.size)} m · levels ${G.fmt(Gm.lo)} to ${G.fmt(Gm.hi)} m`]];
    ty += 20; doc.setLineWidth(0.2);
    rows.forEach(([k, v]) => { doc.line(tx, ty, tx + tw, ty); doc.setFontSize(6); doc.setTextColor(110); doc.text(k, tx, ty + 3.5); doc.setFontSize(9.5); doc.setTextColor(0); doc.text(v, tx, ty + 9); ty += 12; });
    doc.line(tx, ty, tx + tw, ty);
    // north + scale bar
    ty += 12; const nx = tx + 12, ny = ty + 12;
    doc.setLineWidth(0.3); doc.circle(nx, ny, 8); doc.setFillColor(0); doc.triangle(nx, ny - 11, nx - 3, ny + 2, nx + 3, ny + 2, 'F');
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.text('N', nx, ny - 13, { align: 'center' }); doc.setFont('helvetica', 'normal');
    const sbx = tx + 30, sby = ny + 2; for (let i = 0; i < 5; i++) { if (i % 2 === 0) doc.rect(sbx + i * 20, sby, 20, 2.5, 'F'); }
    doc.rect(sbx, sby, 100, 2.5); doc.setFontSize(7); [0, 2, 4, 6, 8, 10].forEach(v => doc.text(`${v * 10 / ps}`, sbx + v * 10, sby - 1.5, { align: 'center' })); doc.text('m', sbx + 103, sby + 2.2);
    ty += 32;
    // key plan
    try {
      const img = await hillshadeURL(), kw = Math.min(tw, 180), kh = kw * H / W;
      doc.addImage(img, 'JPEG', tx, ty, kw, kh);
      doc.setDrawColor(192, 67, 42); doc.setLineWidth(0.6);
      { const cx = v => Math.max(tx, Math.min(tx + kw, v)), cy = v => Math.max(ty, Math.min(ty + kh, v)); const x1 = cx(tx + S.x / W * kw), x2 = cx(tx + (S.x + Q()) / W * kw), y1 = cy(ty + (H - S.y - Q()) / H * kh), y2 = cy(ty + (H - S.y) / H * kh); doc.rect(x1, y1, x2 - x1, y2 - y1); }
      doc.setFontSize(6.5); doc.setTextColor(90); doc.text('Key plan: your square on the surveyed site', tx, ty + kh + 4); doc.setTextColor(0);
      ty += kh + 10;
    } catch (e) { }
    doc.setFontSize(7.5); doc.setTextColor(60);
    const notes = [cstep < 1 ? 'Contours every 0.5 m; whole metres labelled; heavy line every 5 m.' : `Contours every ${cstep} m; heavy and labelled every ${idx} m.`, `Spot heights on a ${grid} m grid. Grid figures are metres from the SW corner.`,
      G.relative ? 'Levels in metres relative to the site datum: 0 m is the lowest ground of the survey.' : `Levels in metres as given for the site (lowest ground ${G.lo.toFixed(1)} m).`,
      pack.survey ? 'Survey: ' + pack.survey + '.' : 'From the site terrain model.', 'Blue dashed: watercourses. Grey: roads. Dashed outlines: buildings (approx.).', 'Grey fill: outside survey. Print at 100%: the scale bar must measure 100 mm.'];
    let ny2 = ty; notes.forEach(t => doc.splitTextToSize(t, tw).forEach(line => { doc.text(line, tx, ny2); ny2 += 4; }));
    return doc.output('blob');
  }

  function makeSheetsPDF() {
    const { jsPDF } = window.jspdf, [SW, SH] = S.sheet;
    const doc = new jsPDF({ orientation: SW > SH ? 'landscape' : 'portrait', unit: 'mm', format: [SW, SH] });
    for (let i = 0; i < packed.count; i++) {
      if (i) doc.addPage([SW, SH], SW > SH ? 'landscape' : 'portrait');
      const { cut, eng } = MM.sheetPaths(packed, i);
      doc.setLineWidth(0.05);
      const draw = (p, col) => { doc.setDrawColor(...col); const pts = p.pts.concat(p.closed ? [p.pts[0]] : []); for (let k = 1; k < pts.length; k++) doc.line(pts[k - 1][0], SH - pts[k - 1][1], pts[k][0], SH - pts[k][1]); };
      eng.forEach(p => draw(p, [0, 0, 255])); cut.forEach(p => draw(p, [255, 0, 0]));
    }
    return doc.output('blob');
  }

  function makeGuidePDF() {
    const { jsPDF } = window.jspdf, doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const Gm = model.G, sheetOf = new Map(); packed.placed.forEach(p => { const k = p.layer.k; if (!sheetOf.has(k)) sheetOf.set(k, new Set()); sheetOf.get(k).add(p.sheet + 1); }); sheetOf.forEach((v, k) => sheetOf.set(k, [...v].join(',')));
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text(`Your ${pack.name} model · assembly guide`.slice(0, 70), 15, 20);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    const info = [`Name: ${S.name || '—'}    Date: ${today()}`, `Area: ${mFmt(Gm.size)} × ${mFmt(Gm.size)} m  ·  model ${S.size} × ${S.size} mm at 1:${S.scale}  ·  board ${S.board} mm${S.lam > 1 ? ` × ${S.lam} sheets glued per layer` : ''} (${mFmt(LT() * MPM())} m per layer)`,
      `${model.layers.length} layers, ${model.layers[0].L} m to ${model.layers[model.layers.length - 1].L} m  ·  ${packed.count} sheet(s) of ${S.sheet[0]} × ${S.sheet[1]} mm  ·  ${S.hollow ? 'hollow layers (15 mm glue strip)' : 'solid layers'}`];
    info.forEach((t, i) => doc.text(t, 15, 30 + i * 6));
    const steps = ['1. Cut a base board exactly ' + S.size + ' × ' + S.size + ' mm.', '2. Laser: engrave (blue) first as a light score, then cut (red). Test on an offcut first.', `3. Each piece is engraved with its layer number and level, e.g. "07 ${Math.round(model.layers[Math.min(6, model.layers.length - 1)].L)}" (layer 07 and its level in metres).`, '4. Glue layer 01 to the base, square to the edges. Each layer sits on the blue line engraved on the layer below.', '5. Keep the cut-out middles of hollow layers: they are useful offcuts.'].concat(S.lam > 1 ? [`6. Every layer is cut ${S.lam} times. Glue the ${S.lam} copies with the same number into one thick layer, edges lined up, before stacking.`] : []);
    steps.forEach((t, i) => doc.text(t, 15, 54 + i * 6));
    // table
    let y = 92; doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.text('Layer', 15, y); doc.text('Level (m)', 35, y); doc.text('Sheet', 60, y); doc.setFont('helvetica', 'normal');
    model.layers.forEach((ly, i) => { const col = Math.floor(i / 18), row = i % 18; const x = 15 + col * 70, yy = y + 5 + row * 5; if (col && row === 0) { doc.setFont('helvetica', 'bold'); doc.text('Layer', x, y); doc.text('Level (m)', x + 20, y); doc.text('Sheet', x + 45, y); doc.setFont('helvetica', 'normal'); } doc.text(String(ly.k).padStart(2, '0'), x, yy); doc.text(ly.L.toFixed(1), x + 20, yy); doc.text(String(sheetOf.get(ly.k)), x + 45, yy); });
    // small multiples
    const per = 8, cell = 62;
    model.layers.forEach((ly, i) => {
      if (i % per === 0) { doc.addPage('a4', 'landscape'); doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.text('Layer by layer (north up). Red: this layer. Grey: the layer below.', 15, 15); doc.setFont('helvetica', 'normal'); }
      const j = i % per, cx = 15 + (j % 4) * (cell + 6), cy = 25 + Math.floor(j / 4) * (cell + 22), k = cell / S.size;
      doc.setDrawColor(160); doc.setLineWidth(0.2); doc.rect(cx, cy, cell, cell);
      const drawL = (L, col, w) => { doc.setDrawColor(...col); doc.setLineWidth(w); L.outline.forEach(l => { for (let q = 0; q < l.length; q++) { const a = l[q], b = l[(q + 1) % l.length]; doc.line(cx + a[0] * k, cy + cell - a[1] * k, cx + b[0] * k, cy + cell - b[1] * k); } }); };
      if (i) drawL(model.layers[i - 1], [170, 170, 170], 0.2);
      drawL(ly, [192, 67, 42], 0.45);
      doc.setFontSize(9); doc.setTextColor(0); doc.text(`Layer ${String(ly.k).padStart(2, '0')} · ${ly.L.toFixed(1)} m · sheet ${sheetOf.get(ly.k)}`, cx, cy + cell + 6);
    });
    return doc.output('blob');
  }

  // ---------- hand-cut template: A3 portrait, the square at true model scale, one contour per layer of card,
  // title block along the bottom with the student's name and the scale. Printed at 100% it is the cutting pattern.
  async function makeHandPDF() {
    const { jsPDF } = window.jspdf, doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a3' });
    const PW = 297, PH = 420, m = 10, Gm = model.G, sz = S.size, K = 1000 / S.scale, n = model.layers.length, iv = S.card * MPM();
    const ox = (PW - sz) / 2, oy = 30;                                   // square: top-left on the page
    const px = x => ox + x, py = y => oy + sz - y;                       // model mm → page mm (north up)
    const X = x => ox + (x - Gm.x0) * K, Y = y => oy + sz - (y - Gm.y0) * K;   // site metres → page mm
    doc.setLineWidth(0.5); doc.rect(m, m, PW - 2 * m, PH - 2 * m);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(90);
    doc.text('CONTOUR TEMPLATE · HAND-CUT GREY CARD MODEL', m + 4, m + 6); doc.text('Print at actual size (100%), not fit to page', m + 4, m + 10);
    // 100 mm print check bar, top right
    const bx = PW - m - 4 - 100, by = m + 8;
    doc.setDrawColor(0); doc.setLineWidth(0.4); doc.line(bx, by, bx + 100, by); doc.line(bx, by - 2, bx, by + 2); doc.line(bx + 100, by - 2, bx + 100, by + 2);
    doc.setLineWidth(0.2); for (let t = 10; t < 100; t += 10) doc.line(bx + t, by - (t === 50 ? 1.6 : 1), bx + t, by);
    doc.setFontSize(6.5); doc.setTextColor(0); doc.text('PRINT CHECK: THIS LINE = 100 mm', bx + 50, by - 2.5, { align: 'center' }); doc.setTextColor(90);
    // site features, light, under the contours
    drawFeatures(doc, X, Y, [ox, oy, ox + sz, oy + sz], Gm, true);
    // contours: the edge of each layer of card
    const clip = (a, b) => clipSeg(px(a[0]), py(a[1]), px(b[0]), py(b[1]), ox, oy, ox + sz, oy + sz);
    model.layers.forEach(ly => {
      const heavy = ly.k % 5 === 0;
      doc.setDrawColor(heavy ? 0 : 40); doc.setLineWidth(heavy ? 0.45 : 0.22);
      ly.outline.forEach(l => { for (let q = 0; q < l.length; q++) { const a = clip(l[q], l[(q + 1) % l.length]); if (a) doc.line(a[0], a[1], a[2], a[3]); } });
    });
    // layer numbers on the contour lines, on a white patch: every contour gets at least one, long ones several
    const lab = handLabels();
    doc.setFontSize(6.5);
    lab.forEach(([x, y, txt]) => { const w = doc.getTextWidth(txt) + 1.2; doc.setFillColor(255, 255, 255); doc.rect(px(x) - w / 2, py(y) - 1.5, w, 3, 'F'); });
    doc.setTextColor(192, 67, 42); lab.forEach(([x, y, txt]) => doc.text(txt, px(x), py(y), { align: 'center', baseline: 'middle' }));
    doc.setTextColor(0);
    // frame, corner marks and metre ticks
    doc.setDrawColor(0); doc.setLineWidth(0.5); doc.rect(ox, oy, sz, sz);
    doc.setLineWidth(0.2); [[ox, oy], [ox + sz, oy], [ox, oy + sz], [ox + sz, oy + sz]].forEach(([cx, cy]) => { doc.line(cx - 4, cy, cx + 4, cy); doc.line(cx, cy - 4, cx, cy + 4); });
    const grid = [5, 10, 20, 25, 50, 100, 200].find(g => g * K >= 18) || 200;
    doc.setFontSize(6.5); doc.setTextColor(80);
    for (let t = 0; t <= Gm.size + 1e-6; t += grid) {
      doc.line(ox + t * K, oy + sz, ox + t * K, oy + sz + 2.5); doc.text(String(t), ox + t * K, oy + sz + 5.5, { align: 'center' });
      doc.line(ox - 2.5, oy + sz - t * K, ox, oy + sz - t * K); doc.text(String(t), ox - 3.5, oy + sz - t * K + 0.8, { align: 'right' });
    }
    doc.text('metres from the south-west corner of your square', ox + sz, oy + sz + 9, { align: 'right' });
    doc.setTextColor(0);
    // how to use it, between the drawing and the title block
    const TB = 64, tby = PH - m - TB;                                    // title block height and top
    let ny = oy + sz + 15;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text('How to cut your model', (PW - Math.max(sz, 180)) / 2, ny); doc.setFont('helvetica', 'normal'); ny += 5;
    const steps = [
      `1  Check the print: the line at the top right must measure exactly 100 mm. If not, reprint at actual size (100%).`,
      `2  Cut a base board ${sz} × ${sz} mm. Layer 01 sits on it.`,
      `3  Each contour is the edge of one layer of ${S.card} mm grey card, numbered from the bottom up (red numbers). Layer 01 is everything inside contour 01, layer 02 everything inside contour 02, and so on.`,
      `4  Prick through the template along the contour onto the card (or use carbon paper), with the square's corners. Number each piece.`,
      `5  Cut with a sharp scalpel on a mat. Where a contour meets the edge of the square, cut along the edge.`,
      `6  Glue 01 to the base, square to the edges, then 02 on 01 and so on. Prick the next contour onto each layer before you glue it, so you can line the next piece up.`];
    doc.setFontSize(7.5);
    const sw = Math.max(sz, 180);
    const nx0 = (PW - sw) / 2;
    steps.forEach(t => doc.splitTextToSize(t, sw).forEach(line => { if (ny < tby - 3) doc.text(line, nx0, ny); ny += 3.6; }));
    // layer table: number and level of every contour
    ny += 3;
    const rowsAvail = Math.floor((tby - 4 - ny - 5) / 3.4), cols = Math.max(Math.ceil(n / Math.max(1, rowsAvail)), Math.min(7, Math.ceil(n / 5))), colW = sw / Math.max(cols, 6);
    if (rowsAvail >= 3 && colW >= 18) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text('Layers', nx0, ny); doc.setFont('helvetica', 'normal'); ny += 4.5;
      const rows = Math.ceil(n / cols); doc.setFontSize(7);
      model.layers.forEach((ly, i) => { const cx = nx0 + Math.floor(i / rows) * colW, cy = ny + (i % rows) * 3.4; doc.setTextColor(192, 67, 42); doc.text(String(ly.k).padStart(2, '0'), cx, cy); doc.setTextColor(0); doc.text(`${G.fmt(ly.L)} m`, cx + 5, cy); });
    }

    // ---- title block along the bottom
    doc.setDrawColor(0); doc.setLineWidth(0.5); doc.rect(m, tby, PW - 2 * m, TB);
    const c1 = m + 92, c2 = c1 + 92, c3 = PW - m;                        // three columns: site | details | north, scale bar, key plan
    doc.setLineWidth(0.25); doc.line(c1, tby, c1, tby + TB); doc.line(c2, tby, c2, tby + TB);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.text(doc.splitTextToSize(pack.name, 84)[0], m + 4, tby + 9);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(60);
    doc.text(doc.splitTextToSize([pack.place, pack.notes ? pack.notes.split(/\n|\. /)[0] : ''].filter(Boolean).join(' · '), 84).slice(0, 2), m + 4, tby + 15);
    doc.setTextColor(0); doc.setFontSize(10); doc.text('Contour template', m + 4, tby + 27); doc.setFontSize(8); doc.setTextColor(60); doc.text('hand-cut grey card site model', m + 4, tby + 31.5);
    doc.setFontSize(6); doc.setTextColor(110); doc.text('NAME', m + 4, tby + 40);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(0); doc.text(doc.splitTextToSize(S.name || ' ', 84)[0], m + 4, tby + 48);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(90); doc.text('ATU Sligo · Department of Architecture', m + 4, tby + TB - 4);
    const rows = [['SCALE', `1:${S.scale} at A3`], ['CARD', `${S.card} mm grey card · contours every ${mFmt(iv)} m`], ['LAYERS', `${n} layers · ${G.fmt(model.layers[0].L)} to ${G.fmt(model.layers[n - 1].L)} m`],
      ['MODEL', `${sz} × ${sz} mm · ${mFmt(Gm.size)} × ${mFmt(Gm.size)} m${S.tile ? ' · class tile ' + tileId() : ''}`], ['DATE', today()]];
    let ry = tby; rows.forEach(([k, v], i) => { if (i) { doc.setDrawColor(170); doc.line(c1, ry, c2, ry); } doc.setFontSize(6); doc.setTextColor(110); doc.text(k, c1 + 3, ry + 4); doc.setFontSize(k === 'SCALE' ? 11 : 8.5); doc.setTextColor(0); doc.setFont('helvetica', k === 'SCALE' ? 'bold' : 'normal'); doc.text(doc.splitTextToSize(v, 86)[0], c1 + 3, ry + 10); doc.setFont('helvetica', 'normal'); ry += TB / rows.length; });
    // north arrow and scale bar
    const nx = c2 + 12, nyy = tby + 16;
    doc.setDrawColor(0); doc.setLineWidth(0.3); doc.circle(nx, nyy, 6.5); doc.setFillColor(0); doc.triangle(nx, nyy - 9, nx - 2.5, nyy + 1.5, nx + 2.5, nyy + 1.5, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text('N', nx, nyy - 10.5, { align: 'center' }); doc.setFont('helvetica', 'normal');
    const sbm = [2, 5, 10, 20, 25, 50, 100].find(v => v * K * 4 >= 40 && v * K * 4 <= 60) || [2, 5, 10, 20, 25, 50, 100].find(v => v * K * 4 >= 40) || 100;
    const sbx = c2 + 24, sby = tby + 17, seg = sbm * K;
    for (let i = 0; i < 4; i++) if (i % 2 === 0) doc.rect(sbx + i * seg, sby, seg, 2, 'F');
    doc.rect(sbx, sby, seg * 4, 2); doc.setFontSize(6.5); for (let i = 0; i <= 4; i++) doc.text(String(i * sbm), sbx + i * seg, sby - 1.5, { align: 'center' }); doc.text('m', sbx + seg * 4 + 2.5, sby + 1.8);
    // key plan: where the square sits on the site
    try {
      const img = await hillshadeURL(), kw = c3 - c2 - 8, kh = Math.min(TB - 30, kw * H / W), kw2 = kh * W / H, kx = c2 + 4, ky = tby + 26;
      doc.addImage(img, 'JPEG', kx, ky, kw2, kh);
      doc.setDrawColor(192, 67, 42); doc.setLineWidth(0.5);
      const cx = v => Math.max(kx, Math.min(kx + kw2, v)), cy = v => Math.max(ky, Math.min(ky + kh, v));
      const x1 = cx(kx + S.x / W * kw2), x2 = cx(kx + (S.x + Q()) / W * kw2), y1 = cy(ky + (H - S.y - Q()) / H * kh), y2 = cy(ky + (H - S.y) / H * kh); doc.rect(x1, y1, x2 - x1, y2 - y1);
      doc.setFontSize(6); doc.setTextColor(90); doc.text('Key plan: your square on the site', kx, ky + kh + 3.5); doc.setTextColor(0);
    } catch (e) { }
    return doc.output('blob');
  }
  // ---------- pen-plotter plan: the contour plan as an Inkscape SVG for the Bantam Tools NextDraw 2234 (A1, 864 × 594 mm travel).
  // Every mark is a single stroke (no fills, no fonts, no dashes left to the software), in mm, joined into long paths,
  // on numbered Inkscape layers, one per pen. Layer names use NextDraw layer codes: "!" pauses for a pen change, "%" is never plotted.
  function plotScale() { const ps = [10, 5, 2, 1, 0.5].find(f => Gcur.size * f <= 545) || 0.5; return { ps, ratio: 1000 / ps }; }
  const HX = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[·•]/g, '-').replace(/×/g, 'x').replace(/[–—]/g, '-').replace(/[′’‘]/g, "'").replace(/[“”]/g, '"').replace(/°/g, ' deg').replace(/[^\x20-\x7e]/g, '');
  function hWidth(s, h) { const k = h / 21; let w = 0; for (const ch of HX(s)) { const g = window.HERSHEY[ch] || window.HERSHEY[' ']; w += (g[1] - g[0]) * k; } return w; }
  // single-stroke text: h = cap height (mm); align left|center|right; base 'alpha' (baseline) or 'middle'; ang in degrees, y down
  function hText(s, x, y, h, o = {}) {
    const k = h / 21, w = hWidth(s, h), out = [];
    let cx = o.align === 'center' ? -w / 2 : o.align === 'right' ? -w : 0; const dy = o.base === 'middle' ? -10.5 * k : -9 * k;
    const a = (o.ang || 0) * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    for (const ch of HX(s)) {
      const g = window.HERSHEY[ch] || window.HERSHEY[' '];
      g[2].forEach(st => { const pl = []; for (let i = 0; i < st.length; i += 2) { const px = cx + (st[i] - g[0]) * k, py = st[i + 1] * k + dy; pl.push([x + px * ca - py * sa, y + px * sa + py * ca]); } out.push(pl); });
      cx += (g[1] - g[0]) * k;
    }
    return out;
  }
  function hWrap(s, h, w) { const words = HX(s).split(' '), lines = []; let cur = ''; words.forEach(wd => { const t = cur ? cur + ' ' + wd : wd; if (hWidth(t, h) > w && cur) { lines.push(cur); cur = wd; } else cur = t; }); if (cur) lines.push(cur); return lines; }
  // join loose 2-point segments that share end points into long polylines (pen stays down)
  function chain(segs) {
    const key = (x, y) => Math.round(x * 1000) + ',' + Math.round(y * 1000), ends = new Map(), used = new Uint8Array(segs.length), out = [];
    const add = (k, i) => { const l = ends.get(k); l ? l.push(i) : ends.set(k, [i]); };
    segs.forEach((s, i) => { add(key(s[0], s[1]), i); add(key(s[2], s[3]), i); });
    const next = (x, y) => { const l = ends.get(key(x, y)); if (!l) return -1; for (const i of l) if (!used[i]) return i; return -1; };
    for (let i = 0; i < segs.length; i++) {
      if (used[i]) continue; used[i] = 1; const s = segs[i], pl = [[s[0], s[1]], [s[2], s[3]]];
      for (const fwd of [true, false]) for (;;) {
        const p = fwd ? pl[pl.length - 1] : pl[0], j = next(p[0], p[1]); if (j < 0) break; used[j] = 1;
        const t = segs[j], q = key(t[0], t[1]) === key(p[0], p[1]) ? [t[2], t[3]] : [t[0], t[1]];
        fwd ? pl.push(q) : pl.unshift(q);
      }
      out.push(pl);
    }
    return out;
  }
  function rdp(pl, eps) {
    if (pl.length < 3) return pl; const keep = new Uint8Array(pl.length); keep[0] = keep[pl.length - 1] = 1; const st = [[0, pl.length - 1]];
    while (st.length) { const [a, b] = st.pop(), [ax, ay] = pl[a], [bx, by] = pl[b], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1e-9; let md = 0, mi = -1;
      for (let i = a + 1; i < b; i++) { const d = Math.abs((pl[i][0] - ax) * dy - (pl[i][1] - ay) * dx) / L; if (d > md) { md = d; mi = i; } }
      if (md > eps) { keep[mi] = 1; st.push([a, mi], [mi, b]); } }
    return pl.filter((_, i) => keep[i]);
  }
  // break a polyline into real dashes (pattern in mm: on, off, on, off…)
  function dashed(pl, pat) {
    const out = []; let k = 0, left = pat[0], cur = [pl[0]];
    for (let i = 1; i < pl.length; i++) {
      let [x0, y0] = pl[i - 1]; const [x1, y1] = pl[i]; let seg = Math.hypot(x1 - x0, y1 - y0);
      while (seg > 1e-9) {
        const t = Math.min(left, seg), f = t / seg, nx = x0 + (x1 - x0) * f, ny = y0 + (y1 - y0) * f;
        if (k % 2 === 0) cur.push([nx, ny]);
        seg -= t; left -= t; x0 = nx; y0 = ny;
        if (left <= 1e-9) { if (k % 2 === 0 && cur.length > 1) out.push(cur); k = (k + 1) % pat.length; left = pat[k]; cur = [[x0, y0]]; }
      }
    }
    if (k % 2 === 0 && cur.length > 1) out.push(cur);
    return out;
  }
  const circ = (cx, cy, r, n = 36) => Array.from({ length: n + 1 }, (_, i) => [cx + r * Math.cos(i / n * 2 * Math.PI), cy + r * Math.sin(i / n * 2 * Math.PI)]);
  const rectPl = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]];
  // fill a rectangle with back-and-forth strokes (one pen-down) spaced to the pen
  const hatchRect = (x, y, w, h, gap) => { const pl = []; let up = true; for (let yy = y; yy <= y + h + 1e-6; yy += gap) { pl.push(up ? [x, yy] : [x + w, yy], up ? [x + w, yy] : [x, yy]); up = !up; } return pl; };

  async function makePlotterSVG() {
    const Gm = Gcur, PW = 841, PH = 594;
    MM.setScale(S.scale);
    const { ps, ratio } = plotScale(), D = Gm.size * ps, m = 12, dx0 = 24, dy0 = (PH - D) / 2, box = [dx0, dy0, dx0 + D, dy0 + D];
    const cstep = ps >= 5 ? 0.5 : ps >= 2 ? 1 : 2, lab = cstep < 1 ? 1 : 5, idx = cstep < 1 ? 5 : cstep < 2 ? 5 : 10, grid = ps >= 5 ? 10 : ps >= 2 ? 20 : ps >= 1 ? 50 : 100, f = Math.max(1, 5 / ps);
    const X = x => dx0 + (x - Gm.x0) * ps, Y = y => dy0 + D - (y - Gm.y0) * ps;
    // pens: id → [layer name, colour, nominal pen width mm]. Order = plot order.
    const L = { fine: [], text: [], heavy: [], water: [], bound: [] };
    const NAMES = {
      fine: ['1 Fine black pen - minor contours', '#555', 0.1],
      text: ['2 Fine black pen - figures, spot heights, roads, buildings, title', '#000', 0.1],
      heavy: ['!3 Medium black pen - index contours, frame, north, scale bar', '#000', 0.35],
      water: ['!4 Blue pen - watercourses', '#3a5f8c', 0.3],
      bound: ['!5 Red pen - site boundary', '#c0432a', 0.3] };
    const clipPl = pl => { const out = []; let cur = null; for (let i = 1; i < pl.length; i++) { const a = clipSeg(pl[i - 1][0], pl[i - 1][1], pl[i][0], pl[i][1], ...box); if (!a) { cur = null; continue; }
      if (cur && Math.abs(cur[cur.length - 1][0] - a[0]) < 1e-6 && Math.abs(cur[cur.length - 1][1] - a[1]) < 1e-6) cur.push([a[2], a[3]]); else { cur = [[a[0], a[1]], [a[2], a[3]]]; out.push(cur); } } return out; };

    // contours: clip, chain, simplify
    const lv = MM.planSegments(Gm, cstep);
    lv.forEach(({ L: lev, segs }) => {
      const five = Math.abs(lev / idx - Math.round(lev / idx)) < 1e-6, cl = [];
      for (let k = 0; k < segs.length; k += 4) { const a = clipSeg(X(segs[k]), Y(segs[k + 1]), X(segs[k + 2]), Y(segs[k + 3]), ...box); if (a && (a[0] !== a[2] || a[1] !== a[3])) cl.push(a); }
      chain(cl).forEach(pl => (five ? L.heavy : L.fine).push(rdp(pl, 0.04)));
    });
    // contour figures, sitting in a gap cut in their contour
    const placed = [], gaps = [];
    lv.filter(o => Math.abs(o.L / lab - Math.round(o.L / lab)) < 1e-6).forEach(({ L: lev, segs }) => {
      for (let ax = 8 * f; ax < Gm.size; ax += 17 * f) for (let ay = 8 * f; ay < Gm.size; ay += 17 * f) {
        let best = -1, bd = 36 * f * f;
        for (let k = 0; k < segs.length; k += 4) { const mx = (segs[k] + segs[k + 2]) / 2 - Gm.x0, my = (segs[k + 1] + segs[k + 3]) / 2 - Gm.y0, d = (mx - ax) ** 2 + (my - ay) ** 2; if (d < bd) { bd = d; best = k; } }
        if (best < 0) continue;
        const mx = (segs[best] + segs[best + 2]) / 2, my = (segs[best + 1] + segs[best + 3]) / 2;
        if (placed.some(p => (p[0] - mx) ** 2 + (p[1] - my) ** 2 < 100 * f * f)) continue;
        if (mx - Gm.x0 < 2 * f || my - Gm.y0 < 2 * f || mx - Gm.x0 > Gm.size - 2 * f || my - Gm.y0 > Gm.size - 2 * f) continue;
        placed.push([mx, my]);
        let ang = -Math.atan2(segs[best + 3] - segs[best + 1], segs[best + 2] - segs[best]) * 180 / Math.PI;   // page y is down
        if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
        const txt = String(Math.round(lev)), h = 1.6, px = X(mx), py = Y(my);
        L.text.push(...hText(txt, px, py, h, { align: 'center', base: 'middle', ang }));
        gaps.push([px, py, hWidth(txt, h) / 2 + 0.8]);
      }
    });
    // cut the contours under each figure so the number reads
    const inGap = (x, y) => gaps.some(([gx, gy, r]) => (x - gx) ** 2 + (y - gy) ** 2 < r * r);
    ['fine', 'heavy'].forEach(p => { if (!gaps.length) return; const out = []; L[p].forEach(pl => { let cur = []; pl.forEach(([x, y], i) => {
      if (i) { const [x0, y0] = pl[i - 1], n = Math.max(1, Math.ceil(Math.hypot(x - x0, y - y0) / 0.3)); for (let s = 1; s <= n; s++) { const qx = x0 + (x - x0) * s / n, qy = y0 + (y - y0) * s / n; if (inGap(qx, qy)) { if (cur.length > 1) out.push(rdp(cur, 0.04)); cur = []; } else cur.push([qx, qy]); } }
      else if (!inGap(x, y)) cur.push([x, y]); }); if (cur.length > 1) out.push(rdp(cur, 0.04)); }); L[p] = out; });

    // spot heights
    for (let gx = grid; gx < Gm.size; gx += grid) for (let gy = grid; gy < Gm.size; gy += grid) {
      const h = MM.heightAt(Gm, Gm.x0 + gx, Gm.y0 + gy); if (h !== h) continue; const px = X(Gm.x0 + gx), py = Y(Gm.y0 + gy);
      L.text.push([[px - 1.2, py], [px + 1.2, py]], [[px, py - 1.2], [px, py + 1.2]], ...hText(h.toFixed(2), px + 1.4, py - 0.8, 1.4));
    }
    // site features
    (pack.features || []).forEach(ft => {
      const pts = ft.pts || []; if (!pts.length || ft.kind === 'area') return;
      const closed = G.KINDS[ft.kind]?.closed || ft.closed, pg = pts.map(p => [X(p[0]), Y(p[1])]); if (closed) pg.push(pg[0]);
      if (ft.kind === 'point') { const [px, py] = pg[0]; if (px > box[0] && px < box[2] && py > box[1] && py < box[3]) L.text.push(circ(px, py, 0.8, 16), circ(px, py, 0.4, 12)); return; }
      const parts = clipPl(pg), pat = { water: [3, 1.5], path: [2, 1.2], boundary: [4, 1, 1, 1], road: null }[ft.kind], pen = ft.kind === 'water' ? 'water' : ft.kind === 'boundary' ? 'bound' : 'text';
      parts.forEach(pl => (pat === null ? [pl] : dashed(pl, pat || [1.5, 1])).forEach(d => L[pen].push(d)));
      if (ft.name && ft.kind === 'building') {
        let cx = 0, ymax = -1e9; pts.forEach(p => { cx += p[0]; ymax = Math.max(ymax, p[1]); }); cx /= pts.length;
        const px = X(cx), py = Y(ymax) - 2; if (px > box[0] + 10 && px < box[2] - 10 && py > box[1] + 4 && py < box[3]) L.text.push(...hText(ft.name + ' (approx.)', px, py, 2, { align: 'center' }));
      }
    });
    // frames and grid ticks
    L.heavy.push(rectPl(m, m, PW - 2 * m, PH - 2 * m), rectPl(dx0, dy0, D, D));
    for (let t = 0; t <= Gm.size + 1e-6; t += grid) {
      L.text.push([[X(Gm.x0 + t), dy0 + D], [X(Gm.x0 + t), dy0 + D + 3]], ...hText(`${t}`, X(Gm.x0 + t), dy0 + D + 6.5, 1.8, { align: 'center' }));
      L.text.push([[dx0 - 3, Y(Gm.y0 + t)], [dx0, Y(Gm.y0 + t)]], ...hText(`${t}`, dx0 - 4, Y(Gm.y0 + t) + 0.9, 1.8, { align: 'right' }));
    }
    // title block
    const tx = dx0 + D + 18, tw = PW - m - tx - 6; let ty = dy0;
    L.heavy.push(...hText(hWrap(pack.name, 6, tw)[0] || '', tx, ty + 6, 6));
    L.text.push(...hText('Site plan - your model area', tx, ty + 13, 3.2));
    const rows = [['PROJECT', (pack.notes || pack.year || '').split(/\n|\. /)[0].slice(0, 60)], ['SITE', [pack.place, pack.year].filter(Boolean).join(' - ')], ['NAME', (S.name || '') + (S.tile ? `   -   class tile ${tileId()}` : '')], ['SCALE', `1:${ratio} @ A1 - pen plot`], ['DATE', today()], ['MODEL', `1:${S.scale} - ${S.size} x ${S.size} mm`], ['AREA', `${mFmt(Gm.size)} x ${mFmt(Gm.size)} m - levels ${G.fmt(Gm.lo)} to ${G.fmt(Gm.hi)} m`]];
    ty += 20;
    rows.forEach(([k, v]) => { L.text.push([[tx, ty], [tx + tw, ty]], ...hText(k, tx, ty + 3.5, 1.6), ...hText(hWrap(v, 2.6, tw)[0] || '', tx, ty + 9, 2.6)); ty += 12; });
    L.text.push([[tx, ty], [tx + tw, ty]]);
    // north arrow (hatched) and scale bar (hatched blocks)
    ty += 12; const nx = tx + 12, ny = ty + 12;
    L.heavy.push(circ(nx, ny, 8, 64), [[nx, ny - 11], [nx - 3, ny + 2], [nx + 3, ny + 2], [nx, ny - 11]]);
    { const tri = []; let up = true; for (let yy = ny - 10.5; yy <= ny + 2; yy += 0.35) { const half = 3 * (yy - (ny - 11)) / 13; tri.push(up ? [nx - half, yy] : [nx + half, yy], up ? [nx + half, yy] : [nx - half, yy]); up = !up; } L.heavy.push(tri); }
    L.heavy.push(...hText('N', nx, ny - 13, 3.2, { align: 'center' }));
    const sbx = tx + 30, sby = ny + 2;
    for (let i = 0; i < 5; i += 2) L.heavy.push(hatchRect(sbx + i * 20, sby, 20, 2.5, 0.35));
    L.heavy.push(rectPl(sbx, sby, 100, 2.5), [[sbx + 20, sby], [sbx + 20, sby + 2.5]], [[sbx + 60, sby], [sbx + 60, sby + 2.5]]);
    [0, 2, 4, 6, 8, 10].forEach(v => L.text.push(...hText(`${v * 10 / ps}`, sbx + v * 10, sby - 1.5, 1.8, { align: 'center' })));
    L.text.push(...hText('m', sbx + 103, sby + 2.2, 1.8));
    ty += 32;
    const notes = [cstep < 1 ? 'Contours every 0.5 m; whole metres figured; medium pen every 5 m.' : `Contours every ${cstep} m; medium pen and figured every ${idx} m.`, `Spot heights on a ${grid} m grid. Grid figures are metres from the SW corner.`,
      G.relative ? 'Levels in metres relative to the site datum: 0 m is the lowest ground of the survey.' : `Levels in metres as given for the site (lowest ground ${G.lo.toFixed(1)} m).`,
      pack.survey ? 'Survey: ' + pack.survey + '.' : 'From the site terrain model.', 'Blue dashed: watercourses. Dashed outlines: buildings (approx.). Red: site boundary.', 'Plotted at 100% on A1: the scale bar measures 100 mm.'];
    notes.forEach(t => hWrap(t, 2, tw).forEach(line => { L.text.push(...hText(line, tx, ty, 2)); ty += 4; }));

    // reference only (layer "%": shown in Inkscape, never plotted): key plan image and outside-survey tint
    let ref = '';
    try { const img = await hillshadeURL(), kw = Math.min(tw, 180), kh = kw * H / W;
      ref += `<image x="${tx}" y="${ty + 4}" width="${kw.toFixed(2)}" height="${kh.toFixed(2)}" href="${img}" xlink:href="${img}" preserveAspectRatio="none"/>`;
      const cx = v => Math.max(tx, Math.min(tx + kw, v)), cy = v => Math.max(ty + 4, Math.min(ty + 4 + kh, v)), x1 = cx(tx + S.x / W * kw), x2 = cx(tx + (S.x + Q()) / W * kw), y1 = cy(ty + 4 + (H - S.y - Q()) / H * kh), y2 = cy(ty + 4 + (H - S.y) / H * kh);
      ref += `<rect x="${x1.toFixed(2)}" y="${y1.toFixed(2)}" width="${(x2 - x1).toFixed(2)}" height="${(y2 - y1).toFixed(2)}" fill="none" stroke="#c0432a" stroke-width="0.6"/>`;
    } catch (e) { }

    // write it out
    const f2 = v => (Math.round(v * 100) / 100).toString(), d = pl => 'M' + pl.map(p => f2(p[0]) + ' ' + f2(p[1])).join('L');
    let total = 0, body = '', n = 0;
    Object.keys(NAMES).forEach(p => {
      const pls = L[p].filter(pl => pl.length > 1); if (!pls.length) return;
      const [name, col, w] = NAMES[p]; n++;
      pls.forEach(pl => { for (let i = 1; i < pl.length; i++) total += Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1]); });
      // a few hundred paths per element keeps Inkscape quick; one subpath per pen stroke
      let chunks = ''; for (let i = 0; i < pls.length; i += 400) chunks += `<path d="${pls.slice(i, i + 400).map(d).join('')}"/>`;
      body += `\n  <g inkscape:groupmode="layer" id="pen${n}" inkscape:label="${name}" style="fill:none;stroke:${col};stroke-width:${w};stroke-linecap:round;stroke-linejoin:round">${chunks}</g>`;
    });
    const svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!-- ${HX(pack.name)} - contour plan 1:${ratio} for pen plotter (Bantam Tools NextDraw 2234, A1 landscape 841 x 594 mm). Made ${today()}.
     Open in Inkscape, then Extensions > Bantam Tools NextDraw. Plot all layers in order: the plotter pauses at each layer marked "!" so you can change pen.
     Or use the Layers tab to plot one layer number at a time. The "%" layer is reference only and never plots. Total pen-down travel about ${(total / 1000).toFixed(1)} m. -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
  width="${PW}mm" height="${PH}mm" viewBox="0 0 ${PW} ${PH}" version="1.1">
  <title>${HX(pack.name)} - contour plan 1:${ratio} (pen plot)</title>
  <sodipodi:namedview inkscape:document-units="mm" units="mm" pagecolor="#ffffff" showgrid="false"/>
  <g inkscape:groupmode="layer" id="ref" inkscape:label="% Reference only - not plotted" style="opacity:0.5">${ref}</g>${body}
</svg>
`;
    return { blob: new Blob([svg], { type: 'image/svg+xml' }), ratio, metres: total / 1000, layers: n };
  }
  $('dlPlot').onclick = async () => {
    const b = $('dlPlot'); b.disabled = true; const t = b.textContent; b.textContent = 'Making SVG…';
    try { const r = await makePlotterSVG(); download(r.blob, `${slug()}_${SITE}_plan_1-${r.ratio}_A1_nextdraw.svg`); status(`Plotter SVG ready: 1:${r.ratio} on A1, ${r.layers} pen layers, about ${r.metres.toFixed(0)} m of pen-down line. Open it in Inkscape and plot with the NextDraw extension.`, 'ok'); }
    catch (e) { status('Could not make the plotter SVG: ' + e.message, 'err'); }
    b.textContent = t; b.disabled = false;
  };

  $('dlHand').onclick = async () => {
    const b = $('dlHand'); b.disabled = true; const t = b.textContent; b.textContent = 'Making PDF…';
    try { download(await makeHandPDF(), `${slug()}_${SITE}_contour-template_1-${S.scale}_A3.pdf`); } catch (e) { status('Could not make the PDF: ' + e.message, 'err'); }
    b.textContent = t; b.disabled = false;
  };

  $('dlPlan').onclick = async () => {
    const b = $('dlPlan'); b.disabled = true; const t = b.textContent; b.textContent = 'Making PDF…';
    try { download(await makePlanPDF(), `${slug()}_${SITE}_plan_1-${planScale().ratio}.pdf`); } catch (e) { status('Could not make the PDF: ' + e.message, 'err'); }
    b.textContent = t; b.disabled = false;
  };
  $('dlKit').onclick = async () => {
    const b = $('dlKit'); b.disabled = true; const t = b.textContent; b.textContent = 'Making files…';
    try {
      const zip = new JSZip(), dir = zip.folder(`${slug()}_${SITE}_model_1-${S.scale}`);
      for (let i = 0; i < packed.count; i++) {
        const n = String(i + 1).padStart(2, '0');
        dir.file(`sheet_${n}.svg`, MM.toSVG(packed, i, `${pack.name} model sheet ${n}`));
        dir.file(`sheet_${n}.dxf`, MM.toDXF(packed, i));
      }
      dir.file('cutting_sheets.pdf', makeSheetsPDF());
      dir.file('assembly_guide.pdf', makeGuidePDF());
      dir.file(`plan_1-${planScale().ratio}.pdf`, await makePlanPDF());
      dir.file('README.txt', [`${pack.name} · your site model`, `Name: ${S.name || '-'}`, `Model ${S.size} x ${S.size} mm at 1:${S.scale} (${mFmt(model.G.size)} x ${mFmt(model.G.size)} m), board ${S.board} mm${S.lam > 1 ? ` (${S.lam} sheets glued per layer, so ${model.layers.length * S.lam} pieces)` : ''}, ${model.layers.length} layers.`, `Sheets: ${packed.count} x ${S.sheet[0]} x ${S.sheet[1]} mm. SVG, DXF and PDF hold the same linework, in mm.`, `Red (CUT layer) = cut. Blue (ENGRAVE layer) = light score: where the next layer goes, and the layer label.`, `Engrave first, then cut. Test settings on an offcut.`, pack.survey ? `Survey: ${pack.survey}.` : '', G.relative ? 'Levels relative: 0 m is the lowest ground of the survey.' : 'Levels as given for the site.'].join('\r\n'));
      download(await zip.generateAsync({ type: 'blob' }), `${slug()}_${SITE}_model_1-${S.scale}.zip`);
    } catch (e) { status('Could not make the files: ' + e.message, 'err'); }
    b.textContent = t; b.disabled = false;
  };

  function printMeta() {
    const what = pm.mould ? `plaster casting mould ${pm.size} x ${pm.size} mm, casts ${pm.cast} x ${pm.cast} mm (mirrored, upside down)` : `${pm.size} x ${pm.size} mm`;
    return { Title: `${S.name || 'Your'} ${pack.name} ${pm.mould ? 'plaster mould' : 'site model'} 1:${S.scale}`, Designer: S.name || '',
      Description: `${pack.name}${pack.place ? ', ' + pack.place : ''}, ${mFmt(Gcur.size)} x ${mFmt(Gcur.size)} m at 1:${S.scale}, ${what}. Levels ${G.fmt(Gcur.lo)} to ${G.fmt(Gcur.hi)} m, heights ${S.vex === 1 ? 'true scale' : S.vex + 'x exaggerated'}, ${pm.mould ? S.castBase + ' mm plaster base' : S.base + ' mm base'}. ATU Sligo Site Model Kit.`,
      CreationDate: new Date().toISOString().slice(0, 10) };   // no Application tag: Bambu Studio reads it as its own version string
  }
  $('dlPrint').onclick = async () => {
    const b = $('dlPrint'); b.disabled = true; const t = b.textContent; b.textContent = 'Making 3MF…';
    try {
      const zip = new JSZip();
      for (const [k, v] of Object.entries(MM.print3MFParts(pm, printMeta()))) zip.file(k, v, { createFolders: false });
      download(await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'model/3mf' }), `${slug()}_${SITE}_${pm.mould ? 'mould' : 'print'}_${PRINT}mm.3mf`);
    } catch (e) { status('Could not make the 3MF: ' + e.message, 'err'); }
    b.textContent = t; b.disabled = false;
  };
  $('dlStl').onclick = () => {
    try { download(new Blob([MM.printSTL(pm, slug())], { type: 'model/stl' }), `${slug()}_${SITE}_${pm.mould ? 'mould' : 'print'}_${PRINT}mm.stl`); }
    catch (e) { status('Could not make the STL: ' + e.message, 'err'); }
  };

  function makeCarveSheet() {
    const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: 'mm', format: 'a4' }), Gm = Gcur, blk = Math.round(pm.size + 40);
    const stl = `${slug()}_${SITE}_cnc_${pm.size}mm.stl`, hs = pm.vex === 1 ? `1:${S.scale} (true scale)` : `1:${Math.round(S.scale / pm.vex)} (flattened to fit the material)`;
    let y = 20;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.text('CNC carving · setup sheet', 15, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(90); doc.text(`${pack.name}${pack.place ? ' · ' + pack.place : ''}`, 15, y + 7); doc.setTextColor(0);
    y += 16;
    const rows = [['Student', S.name || '—'], ['Date', today()], ['File', stl], ['Site area', `${mFmt(Gm.size)} × ${mFmt(Gm.size)} m, levels ${G.fmt(Gm.lo)} to ${G.fmt(Gm.hi)} m`],
      ['Plan scale', `1:${S.scale} (model is in millimetres, ready to use: do not rescale)`], ['Height scale', hs], ['Carving', `${pm.size} × ${pm.size} mm, ${pm.height.toFixed(1)} mm tall`],
      ['Uncut base', `${pm.base} mm under the lowest ground`], ['Material', `${blk} × ${blk} mm block (20 mm margin all round), ${S.stock} mm thick`],
      ['Machine', 'Mantech Falcon 1325 · bed 2500 × 1300 mm · Z travel 200 mm'], ['North', 'Top edge of the file (+Y). Mark it on the block before cutting.']];
    doc.setFontSize(9.5);
    rows.forEach(([k, v]) => { doc.setDrawColor(200); doc.line(15, y, 195, y); doc.setTextColor(110); doc.text(k.toUpperCase(), 15, y + 5); doc.setTextColor(0); doc.text(doc.splitTextToSize(v, 135), 55, y + 5); y += 8; });
    doc.line(15, y, 195, y); y += 9;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('In VCarve Pro', 15, y); doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); y += 6;
    const steps = [
      `1. Job Setup: single sided, units mm, width ${blk} mm, height ${blk} mm, thickness ${S.stock} mm. Z zero on the material surface, XY datum bottom-left.`,
      `2. Model > Import Component / 3D Model, choose ${stl}. Initial orientation: Top. Leave the model size as it is (${pm.size} × ${pm.size} × ${pm.height.toFixed(1)} mm): it is already at scale.`,
      '3. Zero plane position in model: bottom. Centre the model on the block. In Material Setup, set the gap above the model to 0 so the highest ground sits at the material surface.',
      '4. 3D Roughing toolpath: an end mill (for example 6 mm), machining limit = model boundary, with a small machining allowance (about 0.5 mm).',
      '5. 3D Finishing toolpath: a ball-nose bit (for example 6 mm, or 3 mm for finer detail), stepover about 10%, raster.',
      `6. Optional: a profile cut around the ${pm.size} mm square, with tabs, to free the carving from the block.`,
      "7. Save the toolpaths with the post processor supplied with the router (Mantech), and copy them to the machine's own USB stick.",
      'Feeds, speeds, pass depths and bit choice depend on the material: confirm them with the technician before cutting.'];
    steps.forEach(t => { const ls = doc.splitTextToSize(t, 180); doc.text(ls, 15, y); y += ls.length * 4.6 + 1.5; });
    if (pm.height > 75) { y += 3; doc.setTextColor(192, 67, 42); doc.text(doc.splitTextToSize(`This carving is ${pm.height.toFixed(0)} mm deep: it needs bits with enough reach for the full depth.`, 180), 15, y); doc.setTextColor(0); }
    return doc.output('blob');
  }
  $('dlCnc').onclick = async () => {
    const b = $('dlCnc'); b.disabled = true; const t = b.textContent; b.textContent = 'Making files…';
    try {
      const zip = new JSZip(), base = `${slug()}_${SITE}_cnc_${pm.size}mm`, dir = zip.folder(base);
      dir.file(`${base}.stl`, MM.printSTL(pm, slug()));
      dir.file('setup_sheet.pdf', makeCarveSheet());
      dir.file('README.txt', [`${pack.name} · CNC carving`, `Name: ${S.name || '-'}`, `${base}.stl: ${pm.size} x ${pm.size} x ${pm.height.toFixed(1)} mm, 1:${S.scale} in plan, heights ${pm.vex === 1 ? 'true scale' : '1:' + Math.round(S.scale / pm.vex)}.`,
        `Import into VCarve Pro with Model > Import Component / 3D Model. Do not rescale. Origin is the south-west bottom corner; north is +Y.`, `Material: ${Math.round(pm.size + 40)} x ${Math.round(pm.size + 40)} x ${S.stock} mm. ${pm.base} mm stays uncut under the lowest ground.`,
        'Make the toolpaths in VCarve and save them with the post processor supplied with the router. Full settings in setup_sheet.pdf.'].join('\r\n'));
      download(await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 1 } }), `${base}.zip`);
    } catch (e) { status('Could not make the files: ' + e.message, 'err'); }
    b.textContent = t; b.disabled = false;
  };

  function pathsPDF(count, pathsOf) {
    const { jsPDF } = window.jspdf, [SW, SH] = S.sheet;
    const doc = new jsPDF({ orientation: SW > SH ? 'landscape' : 'portrait', unit: 'mm', format: [SW, SH] });
    for (let i = 0; i < count; i++) {
      if (i) doc.addPage([SW, SH], SW > SH ? 'landscape' : 'portrait');
      const { cut, eng } = pathsOf(i); doc.setLineWidth(0.05);
      const draw = (p, col) => { doc.setDrawColor(...col); const pts = p.pts.concat(p.closed ? [p.pts[0]] : []); for (let k = 1; k < pts.length; k++) doc.line(pts[k - 1][0], SH - pts[k - 1][1], pts[k][0], SH - pts[k][1]); };
      eng.forEach(p => draw(p, [0, 0, 255])); cut.forEach(p => draw(p, [255, 0, 0]));
    }
    return doc.output('blob');
  }
  function makeWaffleGuide() {
    const { jsPDF } = window.jspdf, doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }), Gm = Gcur, n = wf.pos.length, sp = wf.spacing;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text(`Your ${pack.name} waffle model · assembly`.slice(0, 64), 15, 20);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    [`Name: ${S.name || '—'}${S.tile ? '    Class tile: ' + tileId() : ''}    Date: ${today()}`, `Area: ${mFmt(Gm.size)} × ${mFmt(Gm.size)} m  ·  model ${S.size} × ${S.size} mm at 1:${S.scale}  ·  board ${S.board} mm`,
      `${n} A pieces (west–east) and ${n} B pieces (south–north), a section every ${sp.toFixed(1)} mm (${(sp * MPM()).toFixed(1)} m)`, `${wpk.count} sheet(s) of ${S.sheet[0]} × ${S.sheet[1]} mm`].forEach((t, i) => doc.text(doc.splitTextToSize(t, 145)[0], 15, 30 + i * 6));
    const steps = ['1. Laser: engrave (blue) first, then cut (red). Test the slot fit on an offcut: if it is tight, sand the slot.', `2. Cut a base board exactly ${S.size} × ${S.size} mm.`,
      '3. Stand the B pieces upright on the base, slots up: B1 on the west edge, every arrow pointing north.', '4. Lower the A pieces onto them, slots down: A1 on the south edge, every arrow pointing east.',
      '5. Every slot is half the height at its crossing, so the tops meet flush. Glue to the base once all pieces are in.', `6. Each piece is a true 1:${S.scale} section through the site, at the line shown on the key.`];
    doc.setFontSize(9.5); steps.forEach((t, i) => doc.text(doc.splitTextToSize(t, 140), 15, 62 + i * 10));
    // key: the grid of pieces, north up
    const kx = 175, ky = 40, ks = 100, f = ks / S.size;
    doc.setDrawColor(150); doc.setLineWidth(0.3); doc.rect(kx, ky, ks, ks);
    doc.setFontSize(6.5);
    wf.pos.forEach((v, i) => {
      doc.setDrawColor(192, 67, 42); doc.setLineWidth(0.35); doc.line(kx, ky + ks - v * f, kx + ks, ky + ks - v * f);
      doc.setDrawColor(58, 95, 174); doc.line(kx + v * f, ky, kx + v * f, ky + ks);
      if (i % Math.ceil(n / 8) === 0 || i === n - 1) { doc.setTextColor(192, 67, 42); doc.text('A' + (i + 1), kx - 2, ky + ks - v * f + 1, { align: 'right' }); doc.setTextColor(58, 95, 174); doc.text('B' + (i + 1), kx + v * f, ky + ks + 5, { align: 'center' }); }
    });
    doc.setTextColor(0); doc.setFontSize(9); doc.text('N', kx + ks + 6, ky + 2); doc.setFillColor(0); doc.triangle(kx + ks + 7.5, ky + 4, kx + ks + 5.5, ky + 10, kx + ks + 9.5, ky + 10, 'F');
    doc.setFontSize(8); doc.text('Red: A pieces (west–east). Blue: B pieces (south–north).', kx, ky + ks + 12);
    return doc.output('blob');
  }
  $('dlWaffle').onclick = async () => {
    const b = $('dlWaffle'); b.disabled = true; const t = b.textContent; b.textContent = 'Making files…';
    try {
      const zip = new JSZip(), dir = zip.folder(`${slug()}_${SITE}_waffle`), [SW, SH] = S.sheet;
      for (let i = 0; i < wpk.count; i++) {
        const n = String(i + 1).padStart(2, '0'), { cut, eng } = MM.shelfPaths(wpk, i);
        dir.file(`sheet_${n}.svg`, MM.pathsSVG(SW, SH, cut, eng, `${pack.name} waffle sheet ${n}`)); dir.file(`sheet_${n}.dxf`, MM.pathsDXF(cut, eng));
      }
      dir.file('cutting_sheets.pdf', pathsPDF(wpk.count, i => MM.shelfPaths(wpk, i)));
      dir.file('assembly_guide.pdf', makeWaffleGuide());
      dir.file(`plan_1-${planScale().ratio}.pdf`, await makePlanPDF());
      dir.file('README.txt', [`${pack.name} · waffle section model`, `Name: ${S.name || '-'}${S.tile ? '   Class tile: ' + tileId() : ''}`, `Model ${S.size} x ${S.size} mm at 1:${S.scale}, board ${S.board} mm, ${wf.pos.length * 2} pieces, a section every ${wf.spacing.toFixed(1)} mm.`,
        `Sheets: ${wpk.count} x ${SW} x ${SH} mm. SVG, DXF and PDF hold the same linework, in mm.`, 'Red (CUT layer) = cut. Blue (ENGRAVE layer) = piece names and direction arrows.', 'A pieces run west to east (A1 south), slotted from below. B pieces run south to north (B1 west), slotted from above.', 'See assembly_guide.pdf.'].join('\r\n'));
      download(await zip.generateAsync({ type: 'blob' }), `${slug()}_${SITE}_waffle.zip`);
    } catch (e) { status('Could not make the files: ' + e.message, 'err'); }
    b.textContent = t; b.disabled = false;
  };

  // PNG with its resolution recorded (pHYs), so laser software imports it at the right physical size
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = u => { let c = 0xffffffff; for (let i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  function pngWithDpi(buf, dpi) {
    const src = new Uint8Array(buf), dv0 = new DataView(src.buffer), parts = [src.subarray(0, 8)];
    for (let o = 8; o < src.length;) {
      const len = dv0.getUint32(o), type = String.fromCharCode(...src.subarray(o + 4, o + 8)), end = o + 12 + len;
      if (type !== 'pHYs') parts.push(src.subarray(o, end));
      if (type === 'IHDR') {
        const ch = new Uint8Array(21), dv = new DataView(ch.buffer), ppm = Math.round(dpi / 0.0254);
        dv.setUint32(0, 9); ch.set([112, 72, 89, 115], 4); dv.setUint32(8, ppm); dv.setUint32(12, ppm); ch[16] = 1; dv.setUint32(17, crc32(ch.subarray(4, 17)));
        parts.push(ch);
      }
      o = end;
    }
    return new Blob(parts, { type: 'image/png' });
  }
  $('dlRelief').onclick = async () => {
    const b = $('dlRelief'); b.disabled = true; const t = b.textContent; b.textContent = 'Making image…';
    try {
      await new Promise(r => setTimeout(r, 30));
      MM.setScale(S.scale); const sel = selM(), r = MM.reliefGrid(DEM, sel, reliefPx());
      r.lo = rel.lo; r.hi = rel.hi;
      const blob = await new Promise(res => reliefCanvas(r).toBlob(res, 'image/png'));
      download(pngWithDpi(await blob.arrayBuffer(), S.dpi), `${slug()}_${SITE}_relief_${S.size}mm_${S.dpi}dpi.png`);
    } catch (e) { status('Could not make the image: ' + e.message, 'err'); }
    b.textContent = t; b.disabled = false;
  };

  // class tile map for tutors: the grid over the whole survey, with every tile named
  async function makeTileMap() {
    const { jsPDF } = window.jspdf, doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
    const [nc, nr] = tileCount(), q = Q(), m = 15, aw = 420 - 2 * m, ah = 297 - 2 * m - 34, k = Math.min(aw / (nc * q), ah / (nr * q));
    const ox = m + (aw - nc * q * k) / 2, oy = m + 30, X = x => ox + x * k, Y = y => oy + (nr * q - y) * k;
    const kind = { card: { layers: 'card contour layers', waffle: 'waffle sections', relief: 'engraved relief' }[S.cardKind], print: '3D prints', mould: 'plaster casts', cnc: 'CNC carvings' }[S.output];
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text(`${pack.name} · class tile map`, m, m + 6);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    doc.text(`Tiles ${S.size} × ${S.size} mm at 1:${S.scale} (${mFmt(S.size * MPM())} × ${mFmt(S.size * MPM())} m) · ${kind} · base level ${G.fmt(DEM.lo)} m (the lowest ground of the survey) for every tile`, m, m + 13);
    doc.setTextColor(90); doc.text('Columns A, B, C… run west to east; rows 1, 2, 3… south to north. Write each student\'s name in their tile. Every tile shares one base level, so neighbours line up.', m, m + 19); doc.setTextColor(0);
    try { const img = await hillshadeURL(); doc.addImage(img, 'JPEG', X(0), Y(H), W * k, H * k); } catch (e) { }
    let on = 0;
    for (let i = 0; i < nc; i++) for (let j = 0; j < nr; j++) {
      let hit = 0; for (let a = 0; a < 5; a++) for (let b2 = 0; b2 < 5; b2++) { const v = DEM.sample((i + (a + .5) / 5) * q * 0.2, (j + (b2 + .5) / 5) * q * 0.2); if (v === v) hit++; }
      const cur = S.tile && Math.round(S.x / q) === i && Math.round(S.y / q) === j;
      if (hit) on++; else { doc.setFillColor(238, 238, 234); doc.rect(X(i * q), Y((j + 1) * q), q * k, q * k, 'F'); }
      doc.setDrawColor(cur ? 192 : 60, cur ? 67 : 60, cur ? 42 : 60); doc.setLineWidth(cur ? 0.8 : 0.3); doc.rect(X(i * q), Y((j + 1) * q), q * k, q * k);
      doc.setFontSize(Math.min(14, Math.max(7, q * k / 5))); doc.setTextColor(hit ? 20 : 150); doc.text(colName(i) + (j + 1), X(i * q) + 2, Y((j + 1) * q) + Math.min(14, Math.max(7, q * k / 5)) * 0.42 + 1.5);
    }
    if (S.tile) { const ci = Math.round(S.x / q), cj = Math.round(S.y / q); doc.setDrawColor(192, 67, 42); doc.setLineWidth(0.9); doc.rect(X(ci * q), Y((cj + 1) * q), q * k, q * k); }
    doc.setTextColor(0); doc.setFontSize(9);
    doc.text(`${on} tiles touch the survey (grey tiles fall outside it). North is up.`, m, 297 - m + 2);
    return doc.output('blob');
  }
  $('dlTiles').onclick = async () => {
    const b = $('dlTiles'); b.disabled = true; const t = b.textContent; b.textContent = 'Making PDF…';
    try { download(await makeTileMap(), `${SITE}_class_tiles_1-${S.scale}_${S.size}mm.pdf`); } catch (e) { status('Could not make the tile map: ' + e.message, 'err'); }
    b.textContent = t; b.disabled = false;
  };

  // ---------- boot
  const redraw = () => { P.size(); P.draw(); bg(); if (pm) (pm.carve ? drawCarve() : drawBed()); };
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redraw);
  new MutationObserver(redraw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  let rt; new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { P.size(); P.draw(); }, 80); }).observe(document.querySelector('main'));
  scaleLabels(); showOutput(); redraw(); compute();
})();
