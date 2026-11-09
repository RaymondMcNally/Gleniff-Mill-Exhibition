/* Trees on the site (kit.html #trees). Removable add-on: the section, this file, css/trees.css,
   data/trees.json and downloads/trees/. Switched on and off from the admin page (item "trees").
   Tree data: from the October 2025 drone lidar, tree height = surface model minus bare-ground model. */
(async function () {
  'use strict';
  const sec = document.getElementById('trees'); if (!sec || !window.loadGleniff) return;
  const $ = id => document.getElementById(id);
  const canvas = $('treePlan'), info = $('treeInfo');
  let data;
  try { data = await (await fetch('data/trees.json')).json(); } catch (e) { info.textContent = 'The tree data needs the site served over http.'; return; }
  const G = await window.loadGleniff(); if (!G) return;
  const M = 5;                                   // plan.js works in 1:200 model mm: 5 mm per metre
  const BANDS = [
    { k: 's', lo: 3, hi: 6, name: 'Small', note: '3–6 m', a: 0.28 },
    { k: 'm', lo: 6, hi: 10, name: 'Medium', note: '6–10 m', a: 0.45 },
    { k: 'l', lo: 10, hi: 15, name: 'Large', note: '10–15 m', a: 0.62 },
    { k: 'x', lo: 15, hi: 99, name: 'Very large', note: 'over 15 m', a: 0.8 }
  ];
  const bandOf = h => BANDS.find(b => h >= b.lo && h < b.hi) || BANDS[3];
  const T = data.trees.map(r => ({ id: r[0], x: r[1], y: r[2], h: r[3], d: r[4], sq: r[5], check: !!r[6] }));
  T.forEach(t => { t.b = bandOf(t.h); });
  const on = new Set(BANDS.map(b => b.k));
  let numbers = false, sel = null;

  // band filters with counts
  $('treeBands').innerHTML = BANDS.map(b => '<button type="button" aria-pressed="true" data-b="' + b.k + '"><i class="tb-sw" style="opacity:' + b.a + '"></i>' + b.name + ' · ' + b.note + ' <span class="tb-n">' + T.filter(t => t.b === b).length + '</span></button>').join('');
  $('treeBands').addEventListener('click', e => {
    const bt = e.target.closest('button'); if (!bt) return;
    const k = bt.dataset.b; on.has(k) ? on.delete(k) : on.add(k); bt.setAttribute('aria-pressed', on.has(k)); draw();
  });
  $('treeNums').onclick = () => { numbers = !numbers; $('treeNums').setAttribute('aria-pressed', numbers); draw(); };
  $('treeCount').textContent = T.length;

  const P = G.Plan(canvas);
  function draw() {
    P.size(); P.base({ contourAlpha: 0.55, shadeAlpha: 0.5 }); P.water(0.85); P.mill(false);
    const c = P.ctx, flat = G.css('--flat'), ink = G.css('--ink');
    const vis = T.filter(t => on.has(t.b.k)).sort((a, b) => b.d - a.d);
    for (const t of vis) {
      const x = P.X(t.x * M), y = P.Y(t.y * M), r = t.d / 2 * M * P.s;
      c.globalAlpha = t.b.a; c.fillStyle = flat; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
      c.globalAlpha = 0.9; c.strokeStyle = ink; c.lineWidth = 0.6; c.stroke();
    }
    c.globalAlpha = 1; c.strokeStyle = ink; c.lineWidth = 1;
    for (const t of vis) {
      const x = P.X(t.x * M), y = P.Y(t.y * M);
      c.beginPath(); c.moveTo(x - 2.5, y); c.lineTo(x + 2.5, y); c.moveTo(x, y - 2.5); c.lineTo(x, y + 2.5); c.stroke();
    }
    if (numbers) {
      c.font = '500 ' + (P.s > 0.5 ? 9 : 8) + 'px "IBM Plex Mono", monospace'; c.fillStyle = ink; c.textAlign = 'left'; c.textBaseline = 'bottom';
      for (const t of vis) c.fillText(t.id + (t.check ? '?' : ''), P.X(t.x * M) + 2, P.Y(t.y * M) - 1);
    }
    if (sel && on.has(sel.b.k)) {
      const x = P.X(sel.x * M), y = P.Y(sel.y * M), r = sel.d / 2 * M * P.s;
      c.strokeStyle = G.css('--gold'); c.lineWidth = 3; c.beginPath(); c.arc(x, y, r + 1.5, 0, Math.PI * 2); c.stroke();
    }
    P.north(); P.scalebar();
  }
  function show(t) {
    sel = t; draw();
    if (!t) { info.innerHTML = '<p class="small">Tap or hover over a tree to read its size.</p>'; return; }
    info.innerHTML = '<div class="tb-id">Tree ' + t.id + '</div>' +
      '<dl class="tb-dl"><dt>Height</dt><dd>' + t.h.toFixed(1) + ' m</dd><dt>Crown</dt><dd>' + t.d.toFixed(1) + ' m across</dd>' +
      '<dt>Size band</dt><dd>' + t.b.name + '</dd><dt>Square</dt><dd>' + t.sq + '</dd>' +
      '<dt>At 1:500</dt><dd>' + (t.h * 2).toFixed(0) + ' mm tall, ' + (t.d * 2).toFixed(0) + ' mm across</dd>' +
      '<dt>Position</dt><dd>' + t.x.toFixed(1) + ' m east, ' + t.y.toFixed(1) + ' m north of the south-west corner</dd></dl>' +
      (t.check ? '<p class="small tb-chk">On the mill platform: this may be part of the ruin, not a tree. Check on site.</p>' : '');
  }
  function pick(ev) {
    const r = canvas.getBoundingClientRect(), [mx, my] = P.inv(ev.clientX - r.left, ev.clientY - r.top);
    const x = mx / M, y = my / M; let best = null, bd = Infinity;
    for (const t of T) {
      if (!on.has(t.b.k)) continue;
      const d = Math.hypot(t.x - x, t.y - y);
      if (d < Math.max(t.d / 2, 2.5) && d < bd) { bd = d; best = t; }
    }
    return best;
  }
  canvas.addEventListener('pointermove', ev => { if (ev.pointerType === 'mouse') { const t = pick(ev); if (t !== sel) show(t); } });
  canvas.addEventListener('click', ev => show(pick(ev)));
  addEventListener('resize', draw);
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', draw);
  show(null);
})();
