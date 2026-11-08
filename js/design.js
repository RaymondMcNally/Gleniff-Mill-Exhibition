/* Stage 2 · Initial and developed design (design.html). Part of the removable Stage 2 design add-on:
   design.html, css/design.css, js/design.js. Uses js/sitepack.js (survey), js/model-core.js (1:50 laser base),
   vendor/jspdf and vendor/jszip. Everything a student does stays in this browser (localStorage 'gleniff-design').
   Coordinates: metres from the survey's south-west corner, x east, y north. */
(function () {
  'use strict';
  if (!document.getElementById('timeline')) return;   // page locked for students: nothing to run
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const KEY = 'gleniff-design';
  const S = { forms: [], cut: null, views: [], sel: 0, name: '', adj: null, checks: {}, qs: {}, showFp: true, mbSize: 400, mbBoard: 3 };
  try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); if (!S.name) S.name = localStorage.getItem('sitekit-name') || ''; } catch (e) { }
  let saveT = 0;
  const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(S)); if (S.name) localStorage.setItem('sitekit-name', S.name); } catch (e) { } }, 250); };

  // ---------- links to pages that may be missing (Stage 2 removed, exhibition-only pages)
  const exists = {};
  const check = f => exists[f] || (exists[f] = fetch(f, { method: 'HEAD', cache: 'no-store' }).then(r => r.ok).catch(() => false));
  const pruneLinks = () => document.querySelectorAll('[data-if]').forEach(a => { a.hidden = true; check(a.dataset.if).then(ok => { a.hidden = !ok; }); });
  // on-page links to sections that are locked for students (hidden by access.js)
  const pruneOnpage = () => document.querySelectorAll('.onpage a[href^="#"], .c3-item .h a[href^="#"], .c3-phases a[href^="#"]').forEach(a => {
    const t = document.querySelector(a.getAttribute('href')), sec = t && t.closest('section');
    a.hidden = !!(sec && getComputedStyle(sec).display === 'none');
  });

  // ---------- timeline
  (function () {
    const D = window.STAGE3 || {}, keys = ['issue', 'interim', 'final', 'portfolio'];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let nextSet = false;
    $('timeline').innerHTML = keys.map(k => {
      const d = D[k] || {}, dt = d.date ? new Date(d.date + 'T12:00:00') : null;
      let cls = '';
      if (dt) { if (dt < today) cls = 'past'; else if (!nextSet) { cls = 'next'; nextSet = true; } }
      const when = dt ? dt.toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short' }) + (d.time ? ' · ' + d.time : '') : 'To be confirmed';
      return '<li class="' + cls + '"><span class="when">' + (cls === 'next' ? 'Next · ' : '') + esc(when) + '</span><b>' + esc(d.label || k) + '</b></li>';
    }).join('');
  })();

  // ---------- activities
  const ACTS = [
    ['Play', 'Free play nobody organises.', 'Where on this slope or by this water would someone start playing without being told?'],
    ['Challenge', 'Climbing, balancing, a little risk.', 'What is just hard enough here: a bank, a log, stepping stones across the stream?'],
    ['Rest', 'Pausing, warming up, watching.', 'Where can a tired visitor sit out of the wind and still watch the others?'],
    ['Explore', 'Finding things out by going to look.', 'What is waiting to be found: the old workings, the waterfall, the view of the mountains, the life in the stream?'],
    ['Fantasy', 'Stories, hiding, imagining.', 'The ruined mill, the old workings, the dark wood: where does the story start?'],
    ['Stewardship', 'Learning the ethics of looking after a place.', 'What could visitors learn to care for here: the river, the trees, the ruin?']
  ];
  $('acts').innerHTML = ACTS.map(a => '<article><b>' + esc(a[0]) + '</b><span>' + esc(a[1]) + '</span><em>' + esc(a[2]) + '</em></article>').join('');

  // ---------- checklists
  const L = (t, h, x) => ({ t, h, x });
  const LISTS = {
    interim: [
      ['Spatial analysis', 'Relationship diagrams showing context: the river and the mountains', [L('Relationship diagram', '#adjTool')]],
      ['Context plans', '1:500 · mechanical pencil, on A2', [L('1:500 context plan base', '#place')]],
      ['Context sections', '1:500 · mechanical pencil, on A2', [L('1:500 context section', '#place'), L('Sections tool', 'sections.html')]],
      ['Sketch design plans', '1:200 · capturing as much context and approach as you can', [L('1:200 site plan base', '#place')]],
      ['Sketch design sections', '1:200 · showing context', [L('1:200 site section', '#place')]],
      ['Sketch design elevations', '1:200 · showing context', [L('Scale figures', '#scale')]],
      ['Sketch design model', '1:500 or 1:200', [L('Your model', 'model.html')]],
      ['Working models', 'A series, both conceptual and massing', [L('Models', '#models'), L('Concept models', 'concept.html#models', 'concept.html')]],
      ['Concept and site strategy', 'Intent, parti diagrams and conceptual models', [L('Concept page', 'concept.html', 'concept.html')]],
      ['Iteration process work', 'On A3 clean-cut sketch roll', []]
    ],
    final: [
      ['Experiential representation', 'Medium of your choice', [L('Splat model of the site', 'splat.html')]],
      ['Rendered perspective of the pavilion in the landscape', 'Medium of your choice', [L('Splat model for viewpoints', 'splat.html')]],
      ['Sequence of views on approach', '6 views, from the distant view to the threshold, with a key plan on the same sheet', [L('Views sheet with key plan', '#place')]],
      ['Detailed site plan with roof plan', '1:200 · mechanical pencil', [L('1:200 site plan base', '#place')]],
      ['Detailed site sections × 2', '1:200 · mechanical pencil', [L('1:200 site section', '#place'), L('Sections tool', 'sections.html')]],
      ['Detailed pavilion plans', '1:100 · mechanical pencil', [L('1:100 ground plan base', '#place')]],
      ['Detailed pavilion sections × 2', '1:100 · mechanical pencil', [L('Scale figures', '#scale')]],
      ['Detailed pavilion elevations × 4', '1:100 · mechanical pencil', []],
      ['Materials and structural strategy', 'Various metric scales · mechanical pencil', [L('Precedents', '#precedents')]],
      ['Written design intent', 'One A4 page · completed with your concept and site strategy', [L('Intent helper', 'concept.html#intent', 'concept.html')]],
      ['Conceptual model', 'Completed with your concept and site strategy', [L('Concept page', 'concept.html#models', 'concept.html')]],
      ['Series of working massing models', 'Various scales · from the interim review', []],
      ['Final detailed presentation model', '1:50 · on its contextual landscape · labelled, with a north point', [L('1:50 laser base', '#models')]],
      ['Process work', 'A5/A4 sketchbook · trace roll at a consistent A3, bound with bull clips', []]
    ],
    portfolio: [
      ['Design revised after the reviews', 'Respond to feedback from the interim and final reviews', []],
      ['Concept carried through', 'From the conceptual approach to the final proposal', []],
      ['The site and place read clearly', 'Its qualities and wider context, carried into the proposal', []],
      ['Experimental models and techniques', 'Showing spatial arrangement and the experience of the spaces', []],
      ['Sensory and atmospheric qualities', 'Light and materials', []],
      ['Key spaces represented', 'Showing their spatial qualities', []],
      ['Construction, technology and environment', 'Your chosen solutions, communicated', []],
      ['Methods and media', 'Appropriate ways of communicating', []],
      ['Drawing conventions', 'Correct orthographic and paraline conventions', []],
      ['Craft in model making', 'Solid bases, labelled underneath with name, stage and scale', []],
      ['Overall presentation', 'Including sheet titles with all salient information', []]
    ]
  };
  function renderLists() {
    document.querySelectorAll('[data-list]').forEach(box => {
      const k = box.dataset.list, items = LISTS[k], done = items.filter((_, i) => S.checks[k + i]).length;
      box.innerHTML = items.map(([t, m, links], i) => {
        const on = !!S.checks[k + i];
        return '<label class="c3-item' + (on ? ' done' : '') + '"><input type="checkbox" data-c="' + k + i + '"' + (on ? ' checked' : '') + '><span><b>' + esc(t) + '</b><span class="m">' + esc(m) + '</span></span><span class="h">' +
          links.map(l => '<a href="' + l.h + '"' + (l.x ? ' data-if="' + l.x + '"' : '') + '>' + esc(l.t) + ' →</a>').join('') + '</span></label>';
      }).join('') + '<div class="c3-prog">' + done + ' of ' + items.length + ' done</div>';
    });
    pruneLinks();
  }
  document.addEventListener('change', e => { const c = e.target.closest('[data-c]'); if (c) { S.checks[c.dataset.c] = c.checked; save(); renderLists(); } });

  // ---------- nine questions
  const QS = [
    ['To what extent is your design meeting your stated design intentions? Have you changed or developed them?', 'Compare it with your Stage 2 intent. Changing it is fine; say why.'],
    ['Are you engaging with learning through play in the landscape? How is it experienced by young and old, and why did you choose this?', 'Walk through it as a five-year-old, then as their grandparent.'],
    ['Is the overall concept clear and coherent?', 'Could a classmate say your idea back to you after one look at your drawings?'],
    ['What are your design references? How have your precedents influenced you?', 'Name two precedents and the one thing you took from each.'],
    ['How does your design respond to the site and its context?', 'The river, the stream, the mill platform, the road, the slope: which does it answer, and how?'],
    ['How does it respond to climate, environment, the landscape and its surroundings?', 'Wet westerly weather, low winter sun from the south, shelter under the bank: what does the pavilion do about them?'],
    ['What is the experience of your pavilion for a visitor?', 'Describe the visit from the road to the threshold to the intimate space in five sentences.'],
    ['What atmospheric and environmental conditions do you want to achieve?', 'Light, the sound of water, warmth, damp, smell: what is it like on a wet November morning?'],
    ['What structure and materials are you suggesting?', 'What holds it up, what is it made of, how does it meet the ground, and why?']
  ];
  $('nineQs').innerHTML = QS.map(([q, t], i) => '<li><label for="q' + i + '">' + esc(q) + '</label><p class="tip">' + esc(t) + '</p><textarea id="q' + i + '" rows="3"></textarea></li>').join('');
  QS.forEach((_, i) => { const el = $('q' + i); el.value = S.qs[i] || ''; el.oninput = () => { S.qs[i] = el.value; save(); }; });
  $('qTxt').onclick = () => {
    const t = 'Project 1 Stage 2 · Developed design · Nine questions' + (S.name ? ' · ' + S.name : '') + '\n\n' + QS.map(([q], i) => (i + 1) + '. ' + q + '\n' + (S.qs[i] || '').trim() + '\n').join('\n');
    dlBlob(new Blob([t], { type: 'text/plain' }), fileName('nine_questions', 'txt'));
  };
  // intent carried over from Stage 2 (if a student used it)
  try {
    const c = JSON.parse(localStorage.getItem('gleniff-concept') || 'null'), I = c && c.intent;
    if (I && (I.title || I.idea || I.place)) {
      $('myIntent').hidden = false;
      $('myIntentText').textContent = [I.title, I.idea, I.place, I.tech, I.type, I.end].filter(x => x && x.trim()).join('\n\n');
    }
  } catch (e) { }

  // ---------- shared helpers
  const dlBlob = (b, n) => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = n; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); };
  const fileName = (s, ext = 'pdf') => (S.name ? S.name.trim().replace(/\s+/g, '_').replace(/[^\w-]/g, '') + '_' : '') + 'gleniff_' + s + '.' + ext;
  const polyArea = p => { let a = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]); return Math.abs(a / 2); };
  const inside = (pt, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > pt[1]) !== (p[j][1] > pt[1]) && pt[0] < (p[j][0] - p[i][0]) * (pt[1] - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c; };
  const centroid = p => { const n = p.length; return [p.reduce((s, q) => s + q[0], 0) / n, p.reduce((s, q) => s + q[1], 0) / n]; };
  const segDist = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l)) : 0; return [Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy), t]; };
  const fmtL = v => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2);

  // marching squares over a window of the survey (metres) → flat array of segments [x1,y1,x2,y2,...] per level
  function march(sample, x0, y0, x1, y1, step, levels) {
    const nx = Math.ceil((x1 - x0) / step) + 1, ny = Math.ceil((y1 - y0) / step) + 1, Z = new Float32Array(nx * ny);
    for (let i = 0; i < ny; i++) for (let j = 0; j < nx; j++) Z[i * nx + j] = sample(x0 + j * step, y0 + i * step);
    return levels.map(Lv => {
      const out = [], lerp = (p, q, vp, vq) => p + (q - p) * ((Lv - vp) / (vq - vp));
      for (let i = 0; i < ny - 1; i++) for (let j = 0; j < nx - 1; j++) {
        const a = Z[i * nx + j], b = Z[i * nx + j + 1], c = Z[(i + 1) * nx + j + 1], d = Z[(i + 1) * nx + j];
        if (a !== a || b !== b || c !== c || d !== d) continue;
        const k = (a >= Lv ? 1 : 0) | (b >= Lv ? 2 : 0) | (c >= Lv ? 4 : 0) | (d >= Lv ? 8 : 0);
        if (k === 0 || k === 15) continue;
        const x = x0 + j * step, y = y0 + i * step;
        const B = [lerp(x, x + step, a, b), y], R = [x + step, lerp(y, y + step, b, c)], T = [lerp(x, x + step, d, c), y + step], Lf = [x, lerp(y, y + step, a, d)];
        const s = (p, q) => out.push(p[0], p[1], q[0], q[1]);
        switch (k) {
          case 1: case 14: s(Lf, B); break; case 2: case 13: s(B, R); break; case 3: case 12: s(Lf, R); break;
          case 4: case 11: s(R, T); break; case 6: case 9: s(B, T); break; case 7: case 8: s(Lf, T); break;
          case 5: s(Lf, B); s(R, T); break; case 10: s(B, R); s(Lf, T); break;
        }
      }
      return { L: Lv, seg: out };
    });
  }

  // ---------- sun (NOAA equations; Irish local time)
  const LAT = 54.3979, LON = -8.3986, rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
  function lastSunday(y, m) { const d = new Date(Date.UTC(y, m + 1, 0)); d.setUTCDate(d.getUTCDate() - d.getUTCDay()); return d; }
  function localToUTC(y, m, d, h) { const t = Date.UTC(y, m, d) + h * 3600e3, s = lastSunday(y, 2).getTime() + 3600e3, e = lastSunday(y, 9).getTime() + 3600e3; return t - ((t - 3600e3 >= s && t - 3600e3 < e) ? 3600e3 : 0); }
  function solar(ms) {
    const jd = ms / 86400000 + 2440587.5, T = (jd - 2451545) / 36525;
    const L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360, M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
    const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
    const C = Math.sin(rad(M)) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(rad(2 * M)) * (0.019993 - 0.000101 * T) + Math.sin(rad(3 * M)) * 0.000289;
    const om = 125.04 - 1934.136 * T, lam = L0 + C - 0.00569 - 0.00478 * Math.sin(rad(om));
    const eps = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60 + 0.00256 * Math.cos(rad(om));
    const dec = deg(Math.asin(Math.sin(rad(eps)) * Math.sin(rad(lam)))), y = Math.tan(rad(eps / 2)) ** 2;
    const eqt = 4 * deg(y * Math.sin(2 * rad(L0)) - 2 * e * Math.sin(rad(M)) + 4 * e * y * Math.sin(rad(M)) * Math.cos(2 * rad(L0)) - 0.5 * y * y * Math.sin(4 * rad(L0)) - 1.25 * e * e * Math.sin(2 * rad(M)));
    const d = new Date(ms), mins = d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
    let tst = (mins + eqt + 4 * LON) % 1440; if (tst < 0) tst += 1440;
    let ha = tst / 4 - 180; if (ha < -180) ha += 360;
    const cz = Math.sin(rad(LAT)) * Math.sin(rad(dec)) + Math.cos(rad(LAT)) * Math.cos(rad(dec)) * Math.cos(rad(ha));
    const zen = deg(Math.acos(Math.max(-1, Math.min(1, cz))));
    const az = (deg(Math.atan2(Math.sin(rad(ha)), Math.cos(rad(ha)) * Math.sin(rad(LAT)) - Math.tan(rad(dec)) * Math.cos(rad(LAT)))) + 540) % 360;
    return { alt: 90 - zen, az };
  }

  // ================= RELATIONSHIP DIAGRAM =================
  // c: 1 marks context (river, mountains, the mill): not a space, no area, not counted in the 70 m²
  const ADJ0 = () => ({
    b: [
      { n: 'Arrival', a: 25, o: 1, x: 100, y: 110 }, { n: 'Threshold', a: 8, o: 0, x: 250, y: 170 },
      { n: 'Collective space', a: 30, o: 0, x: 440, y: 230 }, { n: 'Intimate space', a: 6, o: 0, x: 640, y: 170 },
      { n: 'Explore', a: 20, o: 1, x: 330, y: 450 }, { n: 'Rest', a: 8, o: 0, x: 600, y: 320 }, { n: 'Store', a: 4, o: 0, x: 340, y: 320 },
      { n: 'Play and challenge', a: 40, o: 1, x: 790, y: 420 }, { n: 'Landscape of learning', a: 80, o: 1, x: 130, y: 360 },
      { n: 'River', c: 1, x: 570, y: 455 }, { n: 'Mountains', c: 1, x: 810, y: 70 }
    ],
    l: [[0, 1, 1], [1, 2, 1], [2, 3, 2], [2, 4, 2], [2, 5, 2], [2, 6, 1], [5, 7, 2], [2, 8, 3], [4, 8, 1], [3, 9, 3], [8, 9, 2], [3, 10, 3], [2, 10, 3], [0, 10, 3]]
  });
  if (!S.adj || !S.adj.b) S.adj = ADJ0();
  const A = () => S.adj;
  let aSel = -1;
  const nameLines = (n, r) => { if (n.length * 7.6 <= 2 * r - 10 || !n.includes(' ')) return [n]; const w = n.split(' '); let best = [n], bd = 1e9; for (let i = 1; i < w.length; i++) { const a = w.slice(0, i).join(' '), b = w.slice(i).join(' '), d = Math.max(a.length, b.length); if (d < bd) { bd = d; best = [a, b]; } } return best; };
  const rOf = b => b.c ? 44 : Math.max(28, 8.6 * Math.sqrt(Math.max(1, +b.a || 1)));
  function adjSVG(print) {
    const ink = print ? '#1d2120' : css('--ink'), mut = print ? '#6b706d' : css('--muted'), acc = print ? '#c0432a' : css('--accent'), pap = print ? '#ffffff' : css('--paper'), bg = print ? '#ffffff' : 'transparent';
    const a = A(), o = [];
    o.push('<rect x="0" y="0" width="900" height="560" fill="' + bg + '"/>');
    a.l.forEach(([i, j, s], k) => {
      const p = a.b[i], q = a.b[j]; if (!p || !q) return;
      const w = s === 1 ? 6 : s === 2 ? 2.5 : 2, dash = s === 3 ? ' stroke-dasharray="4 7"' : '';
      o.push('<line class="lkhit" data-l="' + k + '" x1="' + p.x + '" y1="' + p.y + '" x2="' + q.x + '" y2="' + q.y + '"/>');
      o.push('<line class="lk" data-l="' + k + '" x1="' + p.x + '" y1="' + p.y + '" x2="' + q.x + '" y2="' + q.y + '" stroke="' + ink + '" stroke-width="' + w + '" stroke-linecap="round"' + dash + '/>');
    });
    a.b.forEach((b, i) => {
      const r = rOf(b), sel = i === aSel && !print;
      if (b.c) {   // context: a soft tinted shape, labelled, no area
        const wet = /river|stream|water|lake|pool|falls?/i.test(b.n), fill = wet ? '#cfe0f5' : print ? '#e4e6e1' : css('--rule');
        o.push('<g class="bub ctx' + (sel ? ' sel' : '') + '" data-b="' + i + '"><rect x="' + (b.x - r * 1.35) + '" y="' + (b.y - r * 0.72) + '" width="' + (r * 2.7) + '" height="' + (r * 1.44) + '" rx="' + (r * 0.72) + '" fill="' + fill + '" stroke="' + (sel ? acc : mut) + '" stroke-width="' + (sel ? 3.5 : 1.2) + '"/>' +
          nameLines(b.n, r * 1.3).map((t, k, all) => '<text x="' + b.x + '" y="' + (b.y + 1 - (all.length - 1 - k) * 16) + '" fill="' + ink + '" font-family="Archivo, Helvetica, sans-serif" font-weight="600" font-size="14" text-anchor="middle">' + esc(t) + '</text>').join('') +
          '<text class="a" x="' + b.x + '" y="' + (b.y + 17) + '" fill="' + mut + '" font-family="IBM Plex Mono, monospace" font-size="11" text-anchor="middle">context</text></g>');
        return;
      }
      o.push('<g class="bub' + (b.o ? ' out' : '') + (sel ? ' sel' : '') + '" data-b="' + i + '"><circle cx="' + b.x + '" cy="' + b.y + '" r="' + r + '" fill="' + pap + '" stroke="' + (sel ? acc : ink) + '" stroke-width="' + (sel ? 3.5 : 2) + '"' + (b.o ? ' stroke-dasharray="7 5"' : '') + '/>' +
        nameLines(b.n, r).map((t, k, all) => '<text x="' + b.x + '" y="' + (b.y + 1 - (all.length - 1 - k) * 16) + '" fill="' + ink + '" font-family="Archivo, Helvetica, sans-serif" font-weight="600" font-size="14" text-anchor="middle">' + esc(t) + '</text>').join('') +
        '<text class="a" x="' + b.x + '" y="' + (b.y + 17) + '" fill="' + mut + '" font-family="IBM Plex Mono, monospace" font-size="11" text-anchor="middle">' + (+b.a || 0) + ' m²' + (b.o ? ' · outside' : '') + '</text></g>');
    });
    o.push('<g class="key" font-family="IBM Plex Mono, monospace" font-size="11" fill="' + mut + '"><line x1="16" y1="530" x2="56" y2="530" stroke="' + ink + '" stroke-width="6"/><text x="62" y="534">must be next to</text>' +
      '<line x1="190" y1="530" x2="230" y2="530" stroke="' + ink + '" stroke-width="2.5"/><text x="236" y="534">close</text>' +
      '<line x1="300" y1="530" x2="340" y2="530" stroke="' + ink + '" stroke-width="2" stroke-dasharray="4 7"/><text x="346" y="534">seen from</text>' +
      '<circle cx="452" cy="530" r="9" fill="none" stroke="' + ink + '" stroke-dasharray="4 3"/><text x="468" y="534">outside</text>' +
      '<rect x="540" y="522" width="30" height="16" rx="8" fill="' + (print ? '#e4e6e1' : css('--rule')) + '" stroke="' + mut + '"/><text x="578" y="534">context</text></g>');
    if (print) o.push('<text x="884" y="534" text-anchor="end" font-family="Archivo, Helvetica, sans-serif" font-size="12" fill="' + mut + '">' + esc((S.name ? S.name + ' · ' : '') + 'Relationship diagram · Gleniff pavilion') + '</text>');
    return o.join('');
  }
  function adjRender() {
    $('adjSvgEl').innerHTML = adjSVG(false);
    const a = A(), inArea = a.b.filter(b => !b.o && !b.c).reduce((s, b) => s + (+b.a || 0), 0);
    $('adjSum').textContent = 'Inside: ' + inArea + ' m² of about 70 m²' + (inArea > 85 ? '. That is well over the brief.' : inArea < 55 ? '. There is room for more.' : '.');
  }
  function adjList() {
    $('adjList').innerHTML = A().b.map((b, i) => b.c ? '<div class="c3-adj-row ctx" data-i="' + i + '"><input type="text" value="' + esc(b.n) + '" maxlength="28" aria-label="Name"><span class="c3-ctx">Context</span><button type="button" title="Remove" aria-label="Remove ' + esc(b.n) + '">✕</button></div>' : '<div class="c3-adj-row" data-i="' + i + '"><input type="text" value="' + esc(b.n) + '" maxlength="28" aria-label="Name"><input type="number" min="1" max="400" value="' + (+b.a || 0) + '" aria-label="Area in square metres"><button type="button" aria-pressed="' + !!b.o + '" title="Outside or inside">' + (b.o ? 'Out' : 'In') + '</button><button type="button" title="Remove" aria-label="Remove ' + esc(b.n) + '">✕</button></div>').join('');
  }
  $('adjList').addEventListener('input', e => {
    const row = e.target.closest('.c3-adj-row'); if (!row) return; const b = A().b[+row.dataset.i];
    if (e.target.type === 'text') b.n = e.target.value; else b.a = Math.max(1, +e.target.value || 1);
    save(); adjRender();
  });
  $('adjList').addEventListener('click', e => {
    const bt = e.target.closest('button'), row = e.target.closest('.c3-adj-row'); if (!bt || !row) return; const i = +row.dataset.i, a = A();
    if (bt.title === 'Remove') { a.b.splice(i, 1); a.l = a.l.filter(l => l[0] !== i && l[1] !== i).map(l => [l[0] > i ? l[0] - 1 : l[0], l[1] > i ? l[1] - 1 : l[1], l[2]]); aSel = -1; }
    else a.b[i].o = a.b[i].o ? 0 : 1;
    save(); adjList(); adjRender();
  });
  $('adjAdd').onclick = () => { A().b.push({ n: 'New space', a: 10, o: 0, x: 450 + (Math.random() - .5) * 200, y: 280 + (Math.random() - .5) * 120 }); save(); adjList(); adjRender(); };
  $('adjCtx').onclick = () => { A().b.push({ n: 'Context', c: 1, x: 450 + (Math.random() - .5) * 240, y: 90 + Math.random() * 60 }); save(); adjList(); adjRender(); };
  $('adjReset').onclick = () => { if (confirm('Start the diagram again? Your spaces and links will be replaced.')) { S.adj = ADJ0(); aSel = -1; save(); adjList(); adjRender(); } };
  (function () {
    const svg = $('adjSvgEl'); let drag = null;
    const pt = e => { const r = svg.getBoundingClientRect(); return [(e.clientX - r.left) * 900 / r.width, (e.clientY - r.top) * 560 / r.height]; };
    svg.addEventListener('pointerdown', e => {
      const g = e.target.closest('[data-b]'), l = e.target.closest('[data-l]');
      if (g) { const i = +g.dataset.b, p = pt(e), b = A().b[i]; drag = { i, dx: b.x - p[0], dy: b.y - p[1], moved: false, sx: p[0], sy: p[1] }; svg.setPointerCapture(e.pointerId); return; }
      if (l) { const k = +l.dataset.l, a = A(); a.l[k][2]++; if (a.l[k][2] > 3) a.l.splice(k, 1); save(); adjRender(); return; }
      aSel = -1; adjRender();
    });
    svg.addEventListener('pointermove', e => {
      if (!drag) return; const p = pt(e), b = A().b[drag.i];
      if (Math.hypot(p[0] - drag.sx, p[1] - drag.sy) > 3) drag.moved = true;
      if (!drag.moved) return;
      const r = rOf(b); b.x = Math.max(r, Math.min(900 - r, p[0] + drag.dx)); b.y = Math.max(r, Math.min(510 - r, p[1] + drag.dy)); adjRender();
    });
    svg.addEventListener('pointerup', () => {
      if (!drag) return; const i = drag.i;
      if (!drag.moved) {
        if (aSel === -1) aSel = i;
        else if (aSel === i) aSel = -1;
        else { const a = A(), k = a.l.findIndex(l => (l[0] === aSel && l[1] === i) || (l[0] === i && l[1] === aSel)); if (k < 0) a.l.push([aSel, i, 1]); aSel = -1; }
      }
      drag = null; save(); adjRender();
    });
  })();
  const adjFile = () => '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="560" viewBox="0 0 900 560">' + adjSVG(true).replace(/ class="[^"]*"/g, '').replace(/ data-[lb]="\d+"/g, '').replace(/<line x1[^>]*stroke="transparent"[^>]*\/>/g, '') + '</svg>';
  $('adjSvg').onclick = () => dlBlob(new Blob([adjFile()], { type: 'image/svg+xml' }), fileName('relationship_diagram', 'svg'));
  $('adjPng').onclick = () => {
    const img = new Image(), url = URL.createObjectURL(new Blob([adjFile()], { type: 'image/svg+xml' }));
    img.onload = () => { const c = document.createElement('canvas'); c.width = 1800; c.height = 1120; const x = c.getContext('2d'); x.drawImage(img, 0, 0, 1800, 1120); URL.revokeObjectURL(url); c.toBlob(b => dlBlob(b, fileName('relationship_diagram', 'png'))); };
    img.src = url;
  };

  // ================= SCALE FIGURES =================
  const PEOPLE = [
    { n: 'Adult', h: 1700, eye: 1580, seat: 460, table: 760, r: 7.5, sw: 0.26, leg: 0.47 },
    { n: '12 years', h: 1500, eye: 1390, seat: 430, table: 710, r: 6.8, sw: 0.26, leg: 0.47 },
    { n: '8 years', h: 1280, eye: 1170, seat: 350, table: 590, r: 6.2, sw: 0.27, leg: 0.45 },
    { n: '5 years', h: 1100, eye: 1000, seat: 310, table: 530, r: 5.6, sw: 0.28, leg: 0.43 },
    { n: '3 years', h: 950, eye: 860, seat: 260, table: 460, r: 5.0, sw: 0.29, leg: 0.40 }
  ];
  // figure outline in mm, x centred, y up from the ground; returns { head: [cx, cy, r], body: [[x,y]...] }
  function figure(p) {
    const H = p.h, hh = H / p.r, s = H * p.sw / 2, neck = H - hh, sh = neck - H * 0.025, hip = H * p.leg, hp = s * 0.72, gap = s * 0.1, hand = hip - H * 0.04;
    return {
      head: [0, H - hh * 0.5, hh * 0.45],
      body: [[-s * 0.32, neck], [-s, sh], [-s * 1.04, hand], [-s * 0.78, hand], [-hp, hip], [-hp * 0.92, 0], [-gap, 0], [-gap, hip * 0.88], [gap, hip * 0.88], [gap, 0], [hp * 0.92, 0], [hp, hip], [s * 0.78, hand], [s * 1.04, hand], [s, sh], [s * 0.32, neck]]
    };
  }
  (function () {
    const k = 0.15, base = 270, gap = 175, ink = 'var(--ink)', mut = 'var(--muted)';
    let o = '<line x1="10" y1="' + base + '" x2="890" y2="' + base + '" stroke="' + ink + '" stroke-width="1.5"/>';
    PEOPLE.forEach((p, i) => {
      const cx = 90 + i * gap, f = figure(p), X = x => cx + x * k, Y = y => base - y * k;
      o += '<polygon points="' + f.body.map(q => X(q[0]).toFixed(1) + ',' + Y(q[1]).toFixed(1)).join(' ') + '" fill="' + mut + '" opacity=".55"/><circle cx="' + X(0) + '" cy="' + Y(f.head[1]) + '" r="' + (f.head[2] * k).toFixed(1) + '" fill="' + mut + '" opacity=".55"/>';
      o += '<line x1="' + (cx - 60) + '" y1="' + Y(p.eye) + '" x2="' + (cx + 60) + '" y2="' + Y(p.eye) + '" stroke="var(--accent)" stroke-dasharray="3 3"/>';
      o += '<text x="' + (cx + 62) + '" y="' + (Y(p.eye) + 4) + '" font-family="IBM Plex Mono, monospace" font-size="11" fill="var(--accent)">' + p.eye + '</text>';
      o += '<text x="' + cx + '" y="' + (base + 20) + '" text-anchor="middle" font-family="Archivo, sans-serif" font-weight="600" font-size="13" fill="' + ink + '">' + p.n + ' · ' + p.h + '</text>';
    });
    o += '<text x="890" y="18" text-anchor="end" font-family="IBM Plex Mono, monospace" font-size="11" fill="var(--accent)">- - eye height, mm</text>';
    $('figSvg').innerHTML = o;
    $('ergoRows').innerHTML = PEOPLE.map(p => '<tr><td>' + p.n + '</td><td>' + p.h + ' mm</td><td>' + p.eye + ' mm</td><td>' + p.seat + ' mm</td><td>' + p.table + ' mm</td></tr>').join('');
  })();
  function pdfFigure(doc, p, cx, gy, scale, mode) {   // mode 'fill' or 'cut'
    const k = 1 / scale, f = figure(p), pts = f.body.map(q => [cx + q[0] * k, gy - q[1] * k]);
    const lines = pts.slice(1).map((q, i) => [q[0] - pts[i][0], q[1] - pts[i][1]]);
    if (mode === 'cut') { doc.setDrawColor(40); doc.setLineWidth(0.15); doc.setFillColor(215); doc.lines(lines, pts[0][0], pts[0][1], [1, 1], 'FD', true); doc.circle(cx, gy - f.head[1] * k, f.head[2] * k, 'FD'); }
    else { doc.setFillColor(110); doc.lines(lines, pts[0][0], pts[0][1], [1, 1], 'F', true); doc.circle(cx, gy - f.head[1] * k, f.head[2] * k, 'F'); }
  }
  $('figPdf').onclick = () => {
    if (!window.jspdf) return;
    const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: 'mm', format: 'a4' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(29, 33, 32); doc.text('Scale figures', 15, 18);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(110);
    doc.text('Adult 1700 · 12 years 1500 · 8 years 1280 · 5 years 1100 · 3 years 950 mm tall. Print at 100% (actual size). Trace or cut them into your drawings.', 15, 24);
    let y = 48;
    [[200, 4], [100, 3], [50, 2]].forEach(([sc, reps]) => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(29, 33, 32); doc.text('1:' + sc, 15, y - (1800 / sc) - 4 > 30 ? y - 1800 / sc - 4 : y - 30);
      const gy = y, step = Math.max(6, 900 / sc);
      let x = 22;
      for (let r = 0; r < reps; r++) PEOPLE.forEach(p => { if (x < 195) pdfFigure(doc, p, x, gy, sc, 'fill'); x += step; });
      doc.setDrawColor(120); doc.setLineWidth(0.2); doc.line(15, gy, 195, gy);
      y += sc === 200 ? 40 : sc === 100 ? 55 : 90;
    });
    doc.setFontSize(7.5); doc.setTextColor(140); doc.text('Gleniff pavilion · Project 1 Stage 2 · ARCT06004 ATU Sligo', 15, 287);
    doc.save(fileName('scale_figures'));
  };
  $('figCut').onclick = () => {
    if (!window.jspdf) return;
    const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: 'mm', format: 'a4' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(29, 33, 32); doc.text('Cut-out figures for models', 15, 18);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(110);
    doc.text('Print at 100% on card (or glue the print to card). Cut round the solid line, fold the tab back on the dashed line, glue the tab down.', 15, 24);
    const row = (sc, y, reps) => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(29, 33, 32); doc.text('1:' + sc, 15, y - 1800 / sc - 2);
      let x = 24;
      for (let r = 0; r < reps; r++) PEOPLE.forEach(p => {
        const w = Math.max(5, p.h * p.sw * 1.15 / sc), tab = Math.max(4, 300 / sc);
        if (x + w / 2 > 196) return;
        pdfFigure(doc, p, x, y, sc, 'cut');
        doc.setDrawColor(40); doc.setLineWidth(0.15); doc.rect(x - w / 2, y, w, tab);
        doc.setLineDashPattern([0.8, 0.8], 0); doc.line(x - w / 2, y, x + w / 2, y); doc.setLineDashPattern([], 0);
        x += w + 4;
      });
    };
    row(50, 82, 2); row(50, 140, 2); row(100, 180, 3); row(100, 212, 3); row(100, 244, 3);
    doc.setFontSize(7.5); doc.setTextColor(140); doc.text('Gleniff pavilion · Project 1 Stage 2 · ARCT06004 ATU Sligo', 15, 287);
    doc.save(fileName('cutout_figures'));
  };

  // ================= THE SURVEY, AND EVERYTHING THAT NEEDS IT =================
  let G = null, feats = [];
  const gP = (window.loadSite ? window.loadSite('design.html') : Promise.resolve(null)).then(g => {
    G = g;
    if (g) feats = g.feats.filter(f => ['water', 'road', 'building', 'path'].includes(f.kind)).map(f => ({ kind: f.kind, id: f.id, name: f.name, P: f.P.map(p => [p[0] / 5, p[1] / 5]) }));
    return g;
  }).catch(() => null);
  const millC = () => { const m = feats.find(f => f.id === 'mill'); return m ? centroid(m.P) : G ? [G.widthM / 2, G.depthM / 2] : [100, 130]; };
  const designC = () => S.forms.length ? centroid(S.forms.flatMap(f => f.pts)) : millC();

  // ---------- footprints
  function groundUnder(f) {
    if (!G || f.pts.length < 3) return null;
    const xs = f.pts.map(p => p[0]), ys = f.pts.map(p => p[1]);
    let lo = Infinity, hi = -Infinity, s = 0, n = 0;
    for (let x = Math.min(...xs); x <= Math.max(...xs); x += 0.4) for (let y = Math.min(...ys); y <= Math.max(...ys); y += 0.4) {
      if (!inside([x, y], f.pts)) continue; const z = G.sample(x, y); if (z !== z) continue;
      lo = Math.min(lo, z); hi = Math.max(hi, z); s += z; n++;
    }
    return n ? { lo, hi, mean: s / n } : null;
  }
  const floorOf = f => (f.floor !== '' && f.floor != null && isFinite(+f.floor)) ? +f.floor : (() => { const g = groundUnder(f); return g ? Math.round(g.mean * 20) / 20 : 0; })();
  const areaOf = f => polyArea(f.pts) * (Math.max(1, Math.min(3, +f.levels || 1)));
  function renderForms() {
    const tot = S.forms.reduce((s, f) => s + areaOf(f), 0);
    $('plArea').textContent = Math.round(tot) + ' m²';
    $('plGauge').style.width = Math.min(100, tot) + '%';
    const n = $('plAreaNote');
    n.className = tot > 85 ? 'over' : '';
    n.textContent = !S.forms.length ? 'Target about 70 m². Add a rectangle or draw a shape.' : tot > 85 ? 'Target about 70 m²: ' + Math.round(tot - 70) + ' m² over' : tot < 55 ? 'Target about 70 m²: ' + Math.round(70 - tot) + ' m² to go' : 'Close to the 70 m² target';
    $('plForms').innerHTML = S.forms.map((f, i) => {
      const g = groundUnder(f), fl = floorOf(f);
      return '<div class="c3-form' + (i === S.sel ? ' on' : '') + '" data-f="' + i + '"><header><span>' + esc(f.name || 'Form ' + (i + 1)) + ' · ' + polyArea(f.pts).toFixed(1) + ' m²</span><button type="button" data-del="' + i + '">Remove</button></header>' +
        '<div class="r"><label for="fh' + i + '">Height above floor (m)</label><input id="fh' + i + '" type="number" step="0.1" min="1" max="15" value="' + (+f.h || 3.5) + '" data-k="h"></div>' +
        '<div class="r"><label for="ff' + i + '">Floor level (m, blank = auto)</label><input id="ff' + i + '" type="number" step="0.05" value="' + (f.floor ?? '') + '" placeholder="' + fl.toFixed(2) + '" data-k="floor"></div>' +
        '<div class="r"><label for="fl' + i + '">Floors</label><input id="fl' + i + '" type="number" step="1" min="1" max="3" value="' + (+f.levels || 1) + '" data-k="levels"></div>' +
        '<div class="info">' + (g ? 'Ground under it ' + fmtL(g.lo) + ' to ' + fmtL(g.hi) + ' m: falls ' + (g.hi - g.lo).toFixed(1) + ' m. Floor ' + fmtL(fl) + '.' : 'Outside the survey.') + '</div></div>';
    }).join('');
  }
  $('plForms').addEventListener('click', e => {
    const d = e.target.closest('[data-del]'); if (d) { S.forms.splice(+d.dataset.del, 1); S.sel = Math.max(0, Math.min(S.sel, S.forms.length - 1)); save(); renderForms(); draw(); drawSec(); return; }
    const h = e.target.closest('header'); if (h) { S.sel = +h.closest('[data-f]').dataset.f; renderForms(); draw(); }
  });
  $('plForms').addEventListener('change', e => {
    const k = e.target.dataset.k; if (!k) return; const f = S.forms[+e.target.closest('[data-f]').dataset.f];
    f[k] = k === 'floor' ? (e.target.value === '' ? null : +e.target.value) : +e.target.value; save(); renderForms(); draw(); drawSec();
  });
  $('plRect').onclick = () => {
    const c = S.forms.length ? [V.cx + 4, V.cy - 4] : designC();
    S.forms.push({ name: 'Form ' + (S.forms.length + 1), pts: [[c[0] - 5, c[1] - 3.5], [c[0] + 5, c[1] - 3.5], [c[0] + 5, c[1] + 3.5], [c[0] - 5, c[1] + 3.5]], h: 3.5, floor: null, levels: 1 });
    S.sel = S.forms.length - 1; setMode('form'); if (!S.cut) defaultCut(); save(); renderForms(); draw(); drawSec();
  };
  let drawing = null;
  $('plDraw').onclick = () => { setMode('form'); drawing = []; hint(); draw(); };

  // ---------- the plan view
  const cv = $('plMap'), ctx = cv.getContext('2d');
  const V = { cx: 100, cy: 135, mpp: 0.12, w: 600, h: 520, dpr: 1 };
  let mode = 'form';
  const X = x => V.w / 2 + (x - V.cx) / V.mpp, Y = y => V.h / 2 - (y - V.cy) / V.mpp, inv = (px, py) => [V.cx + (px - V.w / 2) * V.mpp, V.cy - (py - V.h / 2) * V.mpp];
  function sizeMap() { const r = cv.getBoundingClientRect(); V.w = r.width || 600; V.h = r.height || 520; V.dpr = Math.min(2, devicePixelRatio || 1); cv.width = Math.round(V.w * V.dpr); cv.height = Math.round(V.h * V.dpr); }
  let ccache = null;
  function contoursForView() {
    const wM = V.w * V.mpp, hM = V.h * V.mpp, x0 = V.cx - wM / 2, y0 = V.cy - hM / 2;
    const iv = wM < 70 ? 0.5 : wM < 160 ? 1 : 2, step = wM < 70 ? 0.4 : wM < 160 ? 0.8 : 1.6;
    const key = [Math.round(x0 / 5), Math.round(y0 / 5), Math.round(wM / 5), iv].join(',');
    if (ccache && ccache.key === key) return ccache;
    const pad = wM * 0.3, gx0 = Math.max(0, x0 - pad), gy0 = Math.max(0, y0 - pad), gx1 = Math.min(G.widthM, x0 + wM + pad), gy1 = Math.min(G.depthM, y0 + hM + pad);
    const lv = []; for (let l = Math.ceil(G.lo / iv) * iv; l <= G.hi; l += iv) lv.push(+l.toFixed(2));
    ccache = { key, iv, cs: gx1 > gx0 && gy1 > gy0 ? march(G.sample, gx0, gy0, gx1, gy1, step, lv) : [] };
    return ccache;
  }
  function shadowPolys(f, sun) {
    if (!sun || sun.alt <= 0.5) return [];
    const L = (+f.h || 3.5) / Math.tan(rad(sun.alt)), dx = -Math.sin(rad(sun.az)) * L, dy = -Math.cos(rad(sun.az)) * L;
    const top = f.pts.map(p => [p[0] + dx, p[1] + dy]), out = [f.pts, top];
    f.pts.forEach((p, i) => { const q = f.pts[(i + 1) % f.pts.length]; out.push([p, q, top[(i + 1) % f.pts.length], top[i]]); });
    return out;
  }
  let sunNow = null;
  function draw() {
    if (!G) return;
    const c = ctx, ink = css('--ink'), acc = css('--accent'), water = css('--engrave') || '#3a5fae', pap = css('--paper'), mut = css('--muted');
    c.setTransform(V.dpr, 0, 0, V.dpr, 0, 0); c.fillStyle = pap; c.fillRect(0, 0, V.w, V.h);
    c.globalAlpha = 0.75 * (G.isDark() ? 0.5 : 1); c.drawImage(G.hill, X(0), Y(G.depthM), G.widthM / V.mpp, G.depthM / V.mpp); c.globalAlpha = 1;
    const C = contoursForView(), idxEvery = C.iv * 5;
    C.cs.forEach(({ L, seg }) => {
      const idx = Math.abs(L / idxEvery - Math.round(L / idxEvery)) < 1e-6;
      c.strokeStyle = idx ? css('--cut') : ink; c.globalAlpha = idx ? 0.85 : 0.35; c.lineWidth = idx ? 1.1 : 0.6; c.beginPath();
      for (let k = 0; k < seg.length; k += 4) { c.moveTo(X(seg[k]), Y(seg[k + 1])); c.lineTo(X(seg[k + 2]), Y(seg[k + 3])); }
      c.stroke();
    });
    c.globalAlpha = 1;
    feats.forEach(f => {
      c.beginPath(); f.P.forEach((p, i) => i ? c.lineTo(X(p[0]), Y(p[1])) : c.moveTo(X(p[0]), Y(p[1])));
      if (f.kind === 'building') { c.closePath(); c.setLineDash([5, 4]); c.strokeStyle = ink; c.lineWidth = 1.4; c.stroke(); c.setLineDash([]); }
      else if (f.kind === 'water') { c.strokeStyle = water; c.lineWidth = Math.max(2, 1.2 / V.mpp * 0.6); c.stroke(); }
      else if (f.kind === 'road') { c.strokeStyle = mut; c.lineWidth = Math.max(3, 4 / V.mpp); c.globalAlpha = 0.35; c.stroke(); c.globalAlpha = 1; }
      else { c.strokeStyle = mut; c.setLineDash([4, 3]); c.lineWidth = 1.2; c.stroke(); c.setLineDash([]); }
    });
    // shadows
    if (mode === 'sun' && sunNow && S.forms.length) {
      const off = document.createElement('canvas'); off.width = cv.width; off.height = cv.height; const o = off.getContext('2d');
      o.setTransform(V.dpr, 0, 0, V.dpr, 0, 0); o.fillStyle = '#1d2a3a';
      S.forms.forEach(f => shadowPolys(f, sunNow).forEach(p => { o.beginPath(); p.forEach((q, i) => i ? o.lineTo(X(q[0]), Y(q[1])) : o.moveTo(X(q[0]), Y(q[1]))); o.closePath(); o.fill(); }));
      c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 0.38; c.drawImage(off, 0, 0); c.globalAlpha = 1; c.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
    }
    // forms
    S.forms.forEach((f, i) => {
      const on = i === S.sel && mode === 'form';
      c.beginPath(); f.pts.forEach((p, k) => k ? c.lineTo(X(p[0]), Y(p[1])) : c.moveTo(X(p[0]), Y(p[1]))); c.closePath();
      c.fillStyle = acc; c.globalAlpha = 0.28; c.fill(); c.globalAlpha = 1; c.strokeStyle = on ? acc : ink; c.lineWidth = on ? 2.5 : 1.8; c.stroke();
      if (on) f.pts.forEach(p => { c.fillStyle = pap; c.strokeStyle = acc; c.lineWidth = 2; c.beginPath(); c.rect(X(p[0]) - 5, Y(p[1]) - 5, 10, 10); c.fill(); c.stroke(); });
      if (f.pts.length > 2) { const m = centroid(f.pts); c.font = '600 11px Archivo, sans-serif'; c.fillStyle = ink; c.textAlign = 'center'; c.fillText(polyArea(f.pts).toFixed(0) + ' m²', X(m[0]), Y(m[1]) + 4); }
    });
    if (drawing) {
      c.strokeStyle = acc; c.lineWidth = 2; c.setLineDash([6, 4]); c.beginPath(); drawing.forEach((p, k) => k ? c.lineTo(X(p[0]), Y(p[1])) : c.moveTo(X(p[0]), Y(p[1]))); if (hover && drawing.length) c.lineTo(X(hover[0]), Y(hover[1])); c.stroke(); c.setLineDash([]);
      drawing.forEach((p, k) => { c.fillStyle = k ? pap : acc; c.beginPath(); c.arc(X(p[0]), Y(p[1]), k ? 4 : 6, 0, 7); c.fill(); c.strokeStyle = acc; c.stroke(); });
    }
    // section line
    if (S.cut) {
      const a = S.cut.a, b = S.cut.b, act = mode === 'cut';
      c.strokeStyle = act ? acc : ink; c.lineWidth = act ? 2 : 1.3; c.setLineDash([12, 4, 3, 4]); c.beginPath(); c.moveTo(X(a[0]), Y(a[1])); c.lineTo(X(b[0]), Y(b[1])); c.stroke(); c.setLineDash([]);
      [[a, 'A'], [b, 'B']].forEach(([p, t]) => { c.fillStyle = act ? acc : ink; c.beginPath(); c.arc(X(p[0]), Y(p[1]), 10, 0, 7); c.fill(); c.fillStyle = pap; c.font = '700 11px Archivo, sans-serif'; c.textAlign = 'center'; c.fillText(t, X(p[0]), Y(p[1]) + 4); });
    }
    // views
    S.views.forEach((v, i) => {
      const px = X(v.p[0]), py = Y(v.p[1]), act = mode === 'views', a = v.d, len = 34;
      c.fillStyle = act ? acc : ink; c.globalAlpha = 0.18; c.beginPath(); c.moveTo(px, py); c.arc(px, py, 60, -a - 0.5, -a + 0.5); c.closePath(); c.fill(); c.globalAlpha = 1;
      c.strokeStyle = act ? acc : ink; c.lineWidth = 2; c.beginPath(); c.moveTo(px, py); c.lineTo(px + Math.cos(a) * len, py - Math.sin(a) * len); c.stroke();
      if (act) { c.beginPath(); c.arc(px + Math.cos(a) * len, py - Math.sin(a) * len, 5, 0, 7); c.fillStyle = pap; c.fill(); c.stroke(); }
      c.fillStyle = act ? acc : ink; c.beginPath(); c.arc(px, py, 10, 0, 7); c.fill(); c.fillStyle = pap; c.font = '700 11px Archivo, sans-serif'; c.textAlign = 'center'; c.fillText(String(i + 1), px, py + 4);
    });
    // north and scale bar
    c.fillStyle = ink; c.strokeStyle = ink; c.lineWidth = 1.2; c.beginPath(); c.moveTo(V.w - 24, 16); c.lineTo(V.w - 30, 34); c.lineTo(V.w - 18, 34); c.closePath(); c.fill(); c.font = '600 11px Archivo, sans-serif'; c.textAlign = 'center'; c.fillText('N', V.w - 24, 48);
    const nice = [1, 2, 5, 10, 20, 50, 100], m = nice.find(n => n / V.mpp > 70) || 100, px = m / V.mpp;
    c.fillStyle = pap; c.globalAlpha = .85; c.fillRect(V.w - px - 26, V.h - 34, px + 20, 26); c.globalAlpha = 1;
    c.fillStyle = ink; c.fillRect(V.w - px - 16, V.h - 20, px, 3); c.font = '500 10px IBM Plex Mono, monospace'; c.textAlign = 'right'; c.fillText(m + ' m', V.w - 16, V.h - 24);
    c.textAlign = 'left'; c.fillText('contours ' + C.iv + ' m', 10, 18);
  }

  // ---------- interaction
  let hover = null, drag = null;
  const evPt = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  function hint() {
    const t = {
      form: drawing ? 'Click to add corners. Click the first corner, or press Enter, to finish. Esc cancels.' : S.forms.length ? 'Drag corners to reshape, drag inside to move. Click an edge to add a corner. Drag empty ground to pan; scroll to zoom.' : 'Add a rectangle or draw a shape to start. Drag to pan; scroll to zoom.',
      cut: 'Drag across the plan to draw the section line. Drag A or B to adjust. Shift-drag to pan.',
      views: 'Click to place a view (up to 6), drag its handle to aim it. Drag a number to move it. Shift-drag to pan.',
      sun: 'Pick a day and drag the time slider. Drag to pan; scroll to zoom.'
    };
    $('plHint').textContent = t[mode];
  }
  function setMode(m) {
    mode = m; if (m !== 'form') drawing = null;
    document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === m));
    document.querySelectorAll('[data-pane]').forEach(p => p.hidden = p.dataset.pane !== m);
    if (m === 'sun') updSun();
    hint(); draw();
  }
  document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => setMode(b.dataset.mode));
  cv.addEventListener('pointerdown', e => {
    if (!G) return; cv.focus({ preventScroll: true });
    const p = evPt(e), w = inv(p[0], p[1]), near = (q, r = 9) => Math.hypot(X(q[0]) - p[0], Y(q[1]) - p[1]) < r;
    cv.setPointerCapture(e.pointerId);
    const pan = () => { drag = { t: 'pan', sx: p[0], sy: p[1], cx: V.cx, cy: V.cy }; };
    if (e.shiftKey || e.button === 1) return pan();
    if (mode === 'form') {
      if (drawing) {
        if (drawing.length >= 3 && near(drawing[0], 10)) return finishDraw();
        drawing.push(w); draw(); return;
      }
      const f = S.forms[S.sel];
      if (f) {
        const vi = f.pts.findIndex(q => near(q));
        if (vi >= 0) { drag = { t: 'v', i: vi }; return; }
        for (let k = 0; k < f.pts.length; k++) { const a = f.pts[k], b = f.pts[(k + 1) % f.pts.length], [d, t] = segDist(p, [X(a[0]), Y(a[1])], [X(b[0]), Y(b[1])]); if (d < 6 && t > 0.05 && t < 0.95) { f.pts.splice(k + 1, 0, w); drag = { t: 'v', i: k + 1 }; draw(); return; } }
      }
      for (let i = S.forms.length - 1; i >= 0; i--) if (inside(w, S.forms[i].pts)) { S.sel = i; drag = { t: 'move', last: w }; renderForms(); draw(); return; }
      return pan();
    }
    if (mode === 'cut') {
      if (S.cut && near(S.cut.a, 12)) { drag = { t: 'ca' }; return; }
      if (S.cut && near(S.cut.b, 12)) { drag = { t: 'cb' }; return; }
      S.cut = { a: w, b: w.slice() }; drag = { t: 'cb', fresh: true }; return;
    }
    if (mode === 'views') {
      for (let i = S.views.length - 1; i >= 0; i--) { const v = S.views[i], tip = [X(v.p[0]) + Math.cos(v.d) * 34, Y(v.p[1]) - Math.sin(v.d) * 34]; if (Math.hypot(tip[0] - p[0], tip[1] - p[1]) < 9) { drag = { t: 'vd', i }; return; } }
      for (let i = S.views.length - 1; i >= 0; i--) if (near(S.views[i].p, 12)) { drag = { t: 'vm', i }; return; }
      if (S.views.length >= 6) { $('plHint').textContent = 'Six views already: remove one first.'; return; }
      const c = designC(); S.views.push({ p: w, d: Math.atan2(c[1] - w[1], c[0] - w[0]) }); drag = { t: 'vd', i: S.views.length - 1, fresh: true }; renderViews(); draw(); return;
    }
    pan();
  });
  cv.addEventListener('pointermove', e => {
    if (!G) return; const p = evPt(e), w = inv(p[0], p[1]);
    if (drawing) { hover = w; if (!drag) draw(); }
    if (!drag) return;
    if (drag.t === 'pan') { V.cx = drag.cx - (p[0] - drag.sx) * V.mpp; V.cy = drag.cy + (p[1] - drag.sy) * V.mpp; draw(); return; }
    if (drag.t === 'v') { S.forms[S.sel].pts[drag.i] = w; renderFormsSoon(); draw(); return; }
    if (drag.t === 'move') { const f = S.forms[S.sel], dx = w[0] - drag.last[0], dy = w[1] - drag.last[1]; f.pts = f.pts.map(q => [q[0] + dx, q[1] + dy]); drag.last = w; renderFormsSoon(); draw(); drawSecSoon(); return; }
    if (drag.t === 'ca') { S.cut.a = w; draw(); drawSecSoon(); return; }
    if (drag.t === 'cb') { S.cut.b = w; draw(); drawSecSoon(); return; }
    if (drag.t === 'vm') { S.views[drag.i].p = w; draw(); return; }
    if (drag.t === 'vd') { const v = S.views[drag.i]; if (Math.hypot(w[0] - v.p[0], w[1] - v.p[1]) > 0.5) v.d = Math.atan2(w[1] - v.p[1], w[0] - v.p[0]); draw(); }
  });
  cv.addEventListener('pointerup', () => {
    if (!drag) return;
    if (drag.t === 'cb' && drag.fresh && S.cut && Math.hypot(S.cut.a[0] - S.cut.b[0], S.cut.a[1] - S.cut.b[1]) < 2) defaultCut(inv(...[X(S.cut.a[0]), Y(S.cut.a[1])]));
    if (drag.t !== 'pan') { save(); renderForms(); renderViews(); drawSec(); }
    drag = null; draw();
  });
  cv.addEventListener('dblclick', e => {
    if (mode !== 'form' || drawing) return; const f = S.forms[S.sel]; if (!f) return; const p = evPt(e);
    const vi = f.pts.findIndex(q => Math.hypot(X(q[0]) - p[0], Y(q[1]) - p[1]) < 9);
    if (vi >= 0 && f.pts.length > 3) { f.pts.splice(vi, 1); save(); renderForms(); draw(); drawSec(); }
  });
  cv.addEventListener('wheel', e => { e.preventDefault(); const p = evPt(e), w = inv(p[0], p[1]); zoom(e.deltaY < 0 ? 0.8 : 1.25, w, p); }, { passive: false });
  cv.addEventListener('keydown', e => {
    if (drawing && e.key === 'Enter') return finishDraw();
    if (drawing && e.key === 'Escape') { drawing = null; hint(); draw(); return; }
    const s = 40 * V.mpp, k = { ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, s], ArrowDown: [0, -s] }[e.key];
    if (k) { e.preventDefault(); V.cx += k[0]; V.cy += k[1]; draw(); }
    if (e.key === '+' || e.key === '=') zoom(0.8); if (e.key === '-') zoom(1.25);
  });
  function finishDraw() {
    if (drawing && drawing.length >= 3) { S.forms.push({ name: 'Form ' + (S.forms.length + 1), pts: drawing, h: 3.5, floor: null, levels: 1 }); S.sel = S.forms.length - 1; if (!S.cut) defaultCut(); }
    drawing = null; hover = null; save(); renderForms(); hint(); draw(); drawSec();
  }
  function zoom(f, w, p) {
    const n = Math.max(0.02, Math.min(1.2, V.mpp * f));
    if (w && p) { V.cx = w[0] - (p[0] - V.w / 2) * n; V.cy = w[1] + (p[1] - V.h / 2) * n; }
    V.mpp = n; draw();
  }
  $('zIn').onclick = () => zoom(0.75); $('zOut').onclick = () => zoom(1.33);
  $('zFit').onclick = () => { const c = designC(); V.cx = c[0]; V.cy = c[1]; V.mpp = 70 / V.w; draw(); };
  $('zAll').onclick = () => { if (!G) return; V.cx = G.widthM / 2; V.cy = G.depthM / 2; V.mpp = Math.max(G.widthM / V.w, G.depthM / V.h) * 1.05; draw(); };
  let rfT = 0, sT = 0;
  const renderFormsSoon = () => { clearTimeout(rfT); rfT = setTimeout(renderForms, 120); };
  const drawSecSoon = () => { clearTimeout(sT); sT = setTimeout(drawSec, 60); };
  function defaultCut(c) { c = c || designC(); S.cut = { a: [c[0] - 30, c[1]], b: [c[0] + 30, c[1]] }; }
  function renderViews() {
    $('plViews').innerHTML = S.views.map((v, i) => '<div class="c3-view"><span>' + (i + 1) + ' · ' + ['Distant view', 'Approach', 'Approach', 'Nearer', 'Arrival', 'Threshold'][i] + '</span><button type="button" data-v="' + i + '">Remove</button></div>').join('') || '<p class="small">No views yet.</p>';
  }
  $('plViews').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) { S.views.splice(+b.dataset.v, 1); save(); renderViews(); draw(); } });
  $('vClear').onclick = () => { S.views = []; save(); renderViews(); draw(); };

  // ---------- sun
  function updSun() {
    const v = $('sunDay').value, h = +$('sunHour').value, now = new Date();
    let y = now.getFullYear(), m, d;
    if (v === 'today') { m = now.getMonth(); d = now.getDate(); } else { [m, d] = v.split('-').map(Number); }
    sunNow = solar(localToUTC(y, m, d, h));
    const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
    $('sunTime').textContent = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
    $('sunInfo').textContent = sunNow.alt <= 0.5 ? 'The sun is below the horizon.' : 'Sun ' + sunNow.alt.toFixed(0) + '° high, from ' + compass(sunNow.az) + ' (' + sunNow.az.toFixed(0) + '°). A 3.5 m wall casts a shadow ' + (3.5 / Math.tan(rad(sunNow.alt))).toFixed(1) + ' m long on level ground.';
    draw();
  }
  const compass = a => ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round(a / 45) % 8];
  $('sunDay').onchange = updSun; $('sunHour').oninput = updSun;

  // ---------- section
  const sc = $('plSec'), sctx = sc.getContext('2d');
  function profile(cut, step) {
    const a = cut.a, b = cut.b, len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(2, Math.ceil(len / step)), pts = [];
    for (let i = 0; i <= n; i++) { const t = i / n; pts.push([t * len, G.sample(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)]); }
    const boxes = [];
    S.forms.forEach(f => {
      const ts = [];
      f.pts.forEach((p, k) => {
        const q = f.pts[(k + 1) % f.pts.length], r = [b[0] - a[0], b[1] - a[1]], s = [q[0] - p[0], q[1] - p[1]], den = r[0] * s[1] - r[1] * s[0];
        if (Math.abs(den) < 1e-9) return;
        const t = ((p[0] - a[0]) * s[1] - (p[1] - a[1]) * s[0]) / den, u = ((p[0] - a[0]) * r[1] - (p[1] - a[1]) * r[0]) / den;
        if (u >= 0 && u <= 1 && t >= 0 && t <= 1) ts.push(t);
      });
      if (inside(a, f.pts)) ts.push(0); if (inside(b, f.pts)) ts.push(1);
      ts.sort((x, y) => x - y);
      const fl = floorOf(f);
      for (let i = 0; i + 1 < ts.length; i += 2) boxes.push({ s0: ts[i] * len, s1: ts[i + 1] * len, z0: fl, z1: fl + (+f.h || 3.5) });
    });
    return { len, pts, boxes };
  }
  function drawSec() {
    const r = sc.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1), w = r.width || 600, h = r.height || 220;
    sc.width = Math.round(w * dpr); sc.height = Math.round(h * dpr);
    const c = sctx; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.fillStyle = css('--bg'); c.fillRect(0, 0, w, h);
    if (!G || !S.cut) { $('secInfo').textContent = 'Draw a section line in Section line mode.'; return; }
    const P = profile(S.cut, 0.25), ok = P.pts.filter(p => p[1] === p[1]);
    if (ok.length < 2) { $('secInfo').textContent = 'The line is outside the survey.'; return; }
    let lo = Math.min(...ok.map(p => p[1])), hi = Math.max(...ok.map(p => p[1]), ...P.boxes.map(b => b.z1));
    lo -= 2; hi += 2.5;
    const k = Math.min((w - 70) / P.len, (h - 30) / (hi - lo)), ox = 46, X = s => ox + s * k, Y = z => h - 14 - (z - lo) * k;
    const ink = css('--ink'), mut = css('--muted'), acc = css('--accent');
    c.strokeStyle = css('--rule'); c.lineWidth = 1; c.font = '500 10px IBM Plex Mono, monospace'; c.fillStyle = mut; c.textAlign = 'right';
    const stepZ = (hi - lo) * k > 160 ? 1 : 2;
    for (let z = Math.ceil(lo / stepZ) * stepZ; z <= hi; z += stepZ) { c.beginPath(); c.moveTo(ox, Y(z)); c.lineTo(X(P.len), Y(z)); c.stroke(); c.fillText(fmtL(z).replace('.00', ''), ox - 6, Y(z) + 3); }
    c.beginPath(); let started = false;
    P.pts.forEach(([s, z]) => { if (z !== z) { started = false; return; } started ? c.lineTo(X(s), Y(z)) : c.moveTo(X(s), Y(z)); started = true; });
    c.strokeStyle = ink; c.lineWidth = 2.2; c.stroke();
    c.fillStyle = ink; c.globalAlpha = 0.08; c.beginPath(); c.moveTo(X(ok[0][0]), Y(lo)); ok.forEach(([s, z]) => c.lineTo(X(s), Y(z))); c.lineTo(X(ok[ok.length - 1][0]), Y(lo)); c.closePath(); c.fill(); c.globalAlpha = 1;
    P.boxes.forEach(b => { c.fillStyle = acc; c.globalAlpha = 0.2; c.fillRect(X(b.s0), Y(b.z1), (b.s1 - b.s0) * k, (b.z1 - b.z0) * k); c.globalAlpha = 1; c.strokeStyle = acc; c.lineWidth = 2; c.strokeRect(X(b.s0), Y(b.z1), (b.s1 - b.s0) * k, (b.z1 - b.z0) * k); });
    // scale figures beside the first box (or mid-line)
    const fx = P.boxes.length ? P.boxes[0].s0 - 2.5 : P.len / 2, fz = G.sample(S.cut.a[0] + (S.cut.b[0] - S.cut.a[0]) * fx / P.len, S.cut.a[1] + (S.cut.b[1] - S.cut.a[1]) * fx / P.len);
    if (fz === fz) [PEOPLE[0], PEOPLE[3]].forEach((pp, i) => { const f = figure(pp), gx = X(fx + i * 0.7), gy = Y(fz), kk = k / 1000; c.fillStyle = mut; c.beginPath(); f.body.forEach((q, j) => j ? c.lineTo(gx + q[0] * kk, gy - q[1] * kk) : c.moveTo(gx + q[0] * kk, gy - q[1] * kk)); c.closePath(); c.fill(); c.beginPath(); c.arc(gx, gy - f.head[1] * kk, f.head[2] * kk, 0, 7); c.fill(); });
    c.font = '700 12px Archivo, sans-serif'; c.fillStyle = ink; c.textAlign = 'center'; c.fillText('A', X(0), 14); c.fillText('B', X(P.len), 14);
    $('secInfo').textContent = P.len.toFixed(0) + ' m long · ground ' + fmtL(Math.min(...ok.map(p => p[1]))) + ' to ' + fmtL(Math.max(...ok.map(p => p[1]))) + ' m · true scale, no exaggeration' + (P.boxes.length ? '' : ' · the line misses your pavilion');
    $('cutInfo').textContent = $('secInfo').textContent;
  }

  // ================= PDF DRAWINGS =================
  const A2W = 594, A2H = 420, M = 12, TB = 20;
  const status = (t, err) => { $('plStatus').textContent = t; $('plStatus').className = 'small status' + (err ? ' err' : ''); };
  function titleBlock(doc, title, sub) {
    const ty = A2H - M - TB, tw = A2W - 2 * M;
    doc.setDrawColor(40); doc.setLineWidth(0.35); doc.rect(M, ty, tw, TB); doc.line(M + tw * 0.62, ty, M + tw * 0.62, ty + TB); doc.line(M + tw * 0.84, ty, M + tw * 0.84, ty + TB);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(29, 33, 32); doc.text(title.toUpperCase(), M + 5, ty + 8.5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(90);
    doc.text((S.name ? S.name + '  ·  ' : '') + 'Project 1, Stage 2: Initial and developed design  ·  The Waters and the Wild', M + 5, ty + 15);
    doc.text(['Gleniff Barytes Mill, Ballintrillick, Co. Sligo', 'ARCT06004 · ATU Sligo · Department of Architecture'], M + tw * 0.62 + 4, ty + 8);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(29, 33, 32); doc.text(sub, M + tw * 0.84 + 4, ty + 8.5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(110); doc.text('Survey: ATU drone lidar, 2025', M + tw * 0.84 + 4, ty + 14.5);
  }
  function northPt(doc, cx, cy, r) {
    doc.setDrawColor(60); doc.setLineWidth(0.25); doc.circle(cx, cy, r); doc.setFillColor(40);
    doc.triangle(cx, cy - r * 0.85, cx - r * 0.35, cy + r * 0.5, cx + r * 0.35, cy + r * 0.5, 'F');
    doc.setFontSize(7); doc.setTextColor(60); doc.text('N', cx, cy - r - 1.5, { align: 'center' });
  }
  function scaleBar(doc, x, y, scale, m) {
    const len = m * 1000 / scale;
    doc.setDrawColor(40); doc.setLineWidth(0.3); doc.line(x, y, x + len, y);
    for (let i = 0; i <= 4; i++) doc.line(x + len * i / 4, y - (i % 2 ? 0.8 : 1.4), x + len * i / 4, y + (i % 2 ? 0.8 : 1.4));
    doc.setFillColor(40); doc.rect(x, y - 0.6, len / 4, 1.2, 'F'); doc.rect(x + len / 2, y - 0.6, len / 4, 1.2, 'F');
    doc.setFontSize(7); doc.setTextColor(60); doc.text('0', x, y + 4, { align: 'center' }); doc.text(m + ' m', x + len, y + 4, { align: 'center' }); doc.text('1:' + scale, x + len + 5, y + 1);
  }
  // a plan of the survey into a frame on the sheet: frame {x,y,w,h} paper mm, centre (m), scale
  function planInto(doc, fr, c, scale, o = {}) {
    const k = 1000 / scale, wM = fr.w / k, hM = fr.h / k, x0 = c[0] - wM / 2, y0 = c[1] - hM / 2;
    const PX = x => fr.x + (x - x0) * k, PY = y => fr.y + fr.h - (y - y0) * k;
    const inF = (x, y) => x >= x0 && x <= x0 + wM && y >= y0 && y <= y0 + hM;
    const lv = []; for (let l = Math.ceil(G.lo / o.iv) * o.iv; l <= G.hi + 1e-9; l += o.iv) lv.push(+l.toFixed(3));
    const cs = march(G.sample, Math.max(0, x0), Math.max(0, y0), Math.min(G.widthM, x0 + wM), Math.min(G.depthM, y0 + hM), o.step, lv);
    cs.forEach(({ L, seg }) => {
      const idx = Math.abs(L / o.idx - Math.round(L / o.idx)) < 1e-6;
      doc.setDrawColor(idx ? 120 : 175); doc.setLineWidth(idx ? 0.22 : 0.12);
      for (let i = 0; i < seg.length; i += 4) doc.line(PX(seg[i]), PY(seg[i + 1]), PX(seg[i + 2]), PY(seg[i + 3]));
    });
    const poly = (pts, closed) => { const q = pts.map(p => [PX(p[0]), PY(p[1])]); for (let i = 0; i + 1 < q.length; i++) doc.line(q[i][0], q[i][1], q[i + 1][0], q[i + 1][1]); if (closed) doc.line(q[q.length - 1][0], q[q.length - 1][1], q[0][0], q[0][1]); };
    // clip lines to the frame by drawing only segments with both ends inside (dense enough for these features)
    const clipPoly = (pts, closed) => { const dense = []; const all = closed ? pts.concat([pts[0]]) : pts; for (let i = 0; i + 1 < all.length; i++) { const a = all[i], b = all[i + 1], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1)); for (let j = 0; j < n; j++) dense.push([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n]); } dense.push(all[all.length - 1]); for (let i = 0; i + 1 < dense.length; i++) if (inF(...dense[i]) && inF(...dense[i + 1])) doc.line(PX(dense[i][0]), PY(dense[i][1]), PX(dense[i + 1][0]), PY(dense[i + 1][1])); };
    feats.forEach(f => {
      if (f.kind === 'water') { doc.setDrawColor(90, 140, 210); doc.setLineWidth(scale <= 50 ? 0.6 : 0.45); clipPoly(f.P, false); }
      else if (f.kind === 'road') { doc.setDrawColor(150); doc.setLineWidth(0.25); doc.setLineDashPattern([2, 1.2], 0); clipPoly(f.P, false); doc.setLineDashPattern([], 0); }
      else if (f.kind === 'building') { doc.setDrawColor(110); doc.setLineWidth(0.3); doc.setLineDashPattern([1.5, 1], 0); clipPoly(f.P, true); doc.setLineDashPattern([], 0); }
    });
    if (o.spot) {
      doc.setFontSize(scale <= 50 ? 5.5 : 5); doc.setTextColor(120);
      for (let x = Math.ceil(x0 / o.spot) * o.spot; x <= x0 + wM; x += o.spot) for (let y = Math.ceil(y0 / o.spot) * o.spot; y <= y0 + hM; y += o.spot) {
        const z = G.sample(x, y); if (z !== z) continue; const px = PX(x), py = PY(y);
        if (px < fr.x + 4 || px > fr.x + fr.w - 12 || py < fr.y + 4 || py > fr.y + fr.h - 3) continue;
        doc.setDrawColor(140); doc.setLineWidth(0.12); doc.line(px - 0.6, py, px + 0.6, py); doc.line(px, py - 0.6, px, py + 0.6);
        doc.text(z.toFixed(scale <= 50 ? 2 : 1), px + 0.9, py - 0.5);
      }
    }
    if (o.fp && $('plShowFp').checked) S.forms.forEach(f => { doc.setDrawColor(192, 67, 42); doc.setLineWidth(scale <= 50 ? 0.35 : 0.3); doc.setLineDashPattern([2.5, 1.2], 0); clipPoly(f.pts, true); doc.setLineDashPattern([], 0); });
    if (o.cut && S.cut) {
      doc.setDrawColor(40); doc.setLineWidth(0.25); doc.setLineDashPattern([5, 1.5, 1, 1.5], 0); clipPoly([S.cut.a, S.cut.b], false); doc.setLineDashPattern([], 0);
      [[S.cut.a, 'A'], [S.cut.b, 'B']].forEach(([p, t]) => { if (!inF(...p)) return; doc.setFillColor(40); doc.circle(PX(p[0]), PY(p[1]), 2.4, 'F'); doc.setTextColor(255); doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.text(t, PX(p[0]), PY(p[1]) + 1, { align: 'center' }); doc.setFont('helvetica', 'normal'); });
    }
    doc.setDrawColor(40); doc.setLineWidth(0.35); doc.rect(fr.x, fr.y, fr.w, fr.h);
    return { PX, PY, inF, x0, y0, wM, hM };
  }
  const needSurvey = async () => { status('Preparing…'); await gP; if (!G) { status('The survey didn’t load. Open the page from the website, not a saved copy.', true); return false; } if (!window.jspdf) { status('The PDF maker didn’t load. Reload the page.', true); return false; } return true; };
  const newA2 = () => new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a2' });
  const fr0 = () => ({ x: M, y: M, w: A2W - 2 * M, h: A2H - 2 * M - TB - 6 });
  const levelNote = () => G.relative ? 'Levels in metres above the lowest ground of the survey' : 'Levels in metres';

  const DL = {
    async plan200() {
      if (!await needSurvey()) return;
      const doc = newA2(), fr = fr0(), c = designC();
      planInto(doc, fr, c, 200, { iv: 0.5, idx: 2.5, step: 0.4, spot: 10, fp: true, cut: true });
      northPt(doc, fr.x + fr.w - 12, fr.y + 14, 5); scaleBar(doc, fr.x + 8, fr.y + fr.h - 8, 200, 20);
      doc.setFontSize(7); doc.setTextColor(110); doc.text(levelNote() + '. Contours every 0.5 m, index every 2.5 m. Spot levels every 10 m.', fr.x + 8, fr.y + fr.h - 13);
      titleBlock(doc, 'Site plan · base', '1:200 at A2');
      doc.save(fileName('site_plan_1-200_A2')); status('Downloaded the 1:200 site plan. Print at 100% (actual size) on A2.');
    },
    async plan500() {
      if (!await needSurvey()) return;
      const doc = newA2(), fr = fr0(), k = 1000 / 500, wM = fr.w / k, hM = fr.h / k, d = designC();
      // centred on the pavilion, kept over the survey as far as it will go so the sheet holds as much context as possible
      const cl = (v, lo, hi) => lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v));
      const c = [cl(d[0], wM / 2, G.widthM - wM / 2), cl(d[1], hM / 2, G.depthM - hM / 2)];
      planInto(doc, fr, c, 500, { iv: 1, idx: 5, step: 0.8, spot: 25, fp: true, cut: true });
      northPt(doc, fr.x + fr.w - 12, fr.y + 14, 5); scaleBar(doc, fr.x + 8, fr.y + fr.h - 8, 500, 50);
      doc.setFontSize(7); doc.setTextColor(110); doc.text(levelNote() + '. Contours every 1 m, index every 5 m. Spot levels every 25 m. The mountains are beyond the survey: add them from the OS map and your Stage 1 work.', fr.x + 8, fr.y + fr.h - 13);
      titleBlock(doc, 'Context plan · base', '1:500 at A2');
      doc.save(fileName('context_plan_1-500_A2')); status('Downloaded the 1:500 context plan. Print at 100% (actual size) on A2.');
    },
    async plan100() {
      if (!await needSurvey()) return;
      const doc = newA2(), fr = fr0(), c = designC();
      planInto(doc, fr, c, 100, { iv: 0.25, idx: 1, step: 0.2, spot: 4, fp: true, cut: true });
      northPt(doc, fr.x + fr.w - 12, fr.y + 14, 5); scaleBar(doc, fr.x + 8, fr.y + fr.h - 8, 100, 10);
      doc.setFontSize(7); doc.setTextColor(110); doc.text(levelNote() + '. Contours every 0.25 m, index every 1 m. Spot levels every 4 m, smoothed from a 0.4 m survey grid.', fr.x + 8, fr.y + fr.h - 13);
      titleBlock(doc, 'Ground plan · base', '1:100 at A2');
      doc.save(fileName('ground_plan_1-100_A2')); status('Downloaded the 1:100 ground plan. Print at 100% (actual size) on A2.');
    },
    async plan50() {
      if (!await needSurvey()) return;
      const doc = newA2(), fr = fr0(), c = designC();
      planInto(doc, fr, c, 50, { iv: 0.25, idx: 1, step: 0.1, spot: 2, fp: true, cut: false });
      northPt(doc, fr.x + fr.w - 12, fr.y + 14, 5); scaleBar(doc, fr.x + 8, fr.y + fr.h - 8, 50, 5);
      doc.setFontSize(7); doc.setTextColor(110); doc.text(levelNote() + '. Contours every 0.25 m, index every 1 m. Spot levels every 2 m, smoothed from a 0.4 m survey grid.', fr.x + 8, fr.y + fr.h - 13);
      titleBlock(doc, 'Ground plan · base', '1:50 at A2');
      doc.save(fileName('ground_plan_1-50_A2')); status('Downloaded the 1:50 ground plan. Print at 100% (actual size) on A2.');
    },
    sec200() { return this.secAt(200); },
    sec500() { return this.secAt(500); },
    async secAt(want) {
      if (!await needSurvey()) return;
      if (!S.cut) defaultCut();
      const P = profile(S.cut, 0.2), ok = P.pts.filter(p => p[1] === p[1]);
      if (ok.length < 2) { status('The section line is outside the survey.', true); return; }
      const fr = fr0(), avail = fr.w - 30, scale = [200, 500, 1000, 2500].filter(s => s >= want).find(s => P.len * 1000 / s <= avail) || 2500, k = 1000 / scale;
      const doc = newA2(), lo = Math.min(...ok.map(p => p[1])) - 3, hi = Math.max(...ok.map(p => p[1]), ...P.boxes.map(b => b.z1)) + 3;
      const ox = fr.x + 24 + (avail - P.len * k) / 2, base = fr.y + fr.h / 2 + (hi - lo) * k / 2, SX = s => ox + s * k, SZ = z => base - (z - lo) * k;
      doc.setDrawColor(40); doc.setLineWidth(0.35); doc.rect(fr.x, fr.y, fr.w, fr.h);
      doc.setFontSize(6.5); doc.setTextColor(120);
      for (let z = Math.ceil(lo); z <= hi; z++) { doc.setDrawColor(z % 5 ? 225 : 195); doc.setLineWidth(0.1); doc.line(SX(0) - 4, SZ(z), SX(P.len), SZ(z)); doc.text(fmtL(z).replace('.00', ''), SX(0) - 5, SZ(z) + 0.8, { align: 'right' }); }
      // ground: poché band under the profile line
      doc.setFillColor(232); let prev = null;
      P.pts.forEach(p => { if (p[1] !== p[1]) { prev = null; return; } if (prev) { const d = 3; doc.lines([[p[0] * k - prev[0] * k, -(p[1] - prev[1]) * k], [0, d], [-(p[0] - prev[0]) * k, (p[1] - prev[1]) * k]], SX(prev[0]), SZ(prev[1]), [1, 1], 'F', true); } prev = p; });
      doc.setDrawColor(20); doc.setLineWidth(0.6); prev = null;
      P.pts.forEach(p => { if (p[1] !== p[1]) { prev = null; return; } if (prev) doc.line(SX(prev[0]), SZ(prev[1]), SX(p[0]), SZ(p[1])); prev = p; });
      if ($('plShowFp').checked) P.boxes.forEach(b => { doc.setDrawColor(192, 67, 42); doc.setLineWidth(0.35); doc.setLineDashPattern([2.5, 1.2], 0); doc.rect(SX(b.s0), SZ(b.z1), (b.s1 - b.s0) * k, (b.z1 - b.z0) * k); doc.setLineDashPattern([], 0); });
      const fx = P.boxes.length ? Math.max(1, P.boxes[0].s0 - 3) : P.len / 2, fz = G.sample(S.cut.a[0] + (S.cut.b[0] - S.cut.a[0]) * fx / P.len, S.cut.a[1] + (S.cut.b[1] - S.cut.a[1]) * fx / P.len);
      if (fz === fz) [PEOPLE[0], PEOPLE[3]].forEach((pp, i) => pdfFigure(doc, pp, SX(fx + i * 0.8), SZ(fz), scale, 'fill'));
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(29, 33, 32); doc.text('A', SX(0), SZ(hi) - 2, { align: 'center' }); doc.text('B', SX(P.len), SZ(hi) - 2, { align: 'center' }); doc.setFont('helvetica', 'normal');
      scaleBar(doc, fr.x + 8, fr.y + fr.h - 8, scale, scale === 200 ? 20 : scale === 500 ? 50 : 100);
      doc.setFontSize(7); doc.setTextColor(110); doc.text(levelNote() + '. Ground from the survey along A–B, ' + P.len.toFixed(0) + ' m. True scale, no vertical exaggeration.' + (P.boxes.length ? ' Your pavilion is dashed: draw your own section over it.' : ''), fr.x + 8, fr.y + fr.h - 13);
      // small key plan
      const kf = { x: fr.x + fr.w - 92, y: fr.y + 6, w: 86, h: 62 }, mid = [(S.cut.a[0] + S.cut.b[0]) / 2, (S.cut.a[1] + S.cut.b[1]) / 2], ks = [1000, 1250, 2500].find(s => P.len * 1000 / s < kf.w - 10) || 2500;
      doc.setFillColor(255); doc.rect(kf.x, kf.y, kf.w, kf.h, 'F');
      planInto(doc, kf, mid, ks, { iv: 2, idx: 10, step: 1, fp: true, cut: true });
      doc.setFontSize(6); doc.setTextColor(110); doc.text('Key plan 1:' + ks, kf.x, kf.y + kf.h + 3.5);
      titleBlock(doc, (want === 500 ? 'Context section' : 'Site section') + ' A–B · base', '1:' + scale + ' at A2');
      doc.save(fileName((want === 500 ? 'context' : 'site') + '_section_A-B_1-' + scale + '_A2'));
      status('Downloaded the section at 1:' + scale + (scale !== want ? ' (too long for 1:' + want + ' on A2; shorten the line for 1:' + want + ')' : '') + '. Print at 100% (actual size).');
    },
    async views() {
      if (!await needSurvey()) return;
      const doc = newA2(), top = M, availH = A2H - 2 * M - TB - 6;
      const kf = { x: M, y: top, w: 200, h: availH };
      const pts = S.views.map(v => v.p).concat(S.forms.flatMap(f => f.pts)); if (!pts.length) pts.push(millC());
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), c = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
      const need = Math.max(Math.max(...xs) - Math.min(...xs) + 30, (Math.max(...ys) - Math.min(...ys) + 30) * kf.w / kf.h);
      const ks = [500, 1000, 1250, 2000, 2500, 5000].find(s => need * 1000 / s <= kf.w) || 5000;
      const T = planInto(doc, kf, c, ks, { iv: ks <= 1000 ? 1 : 2, idx: ks <= 1000 ? 5 : 10, step: ks <= 1000 ? 0.5 : 1, fp: true, cut: false });
      S.views.forEach((v, i) => {
        const px = T.PX(v.p[0]), py = T.PY(v.p[1]), a = v.d;
        doc.setFillColor(192, 67, 42); doc.setDrawColor(192, 67, 42); doc.setLineWidth(0.4);
        doc.setGState && doc.setGState(new doc.GState({ opacity: 0.18 }));
        doc.triangle(px, py, px + Math.cos(a - 0.5) * 16, py - Math.sin(a - 0.5) * 16, px + Math.cos(a + 0.5) * 16, py - Math.sin(a + 0.5) * 16, 'F');
        doc.setGState && doc.setGState(new doc.GState({ opacity: 1 }));
        doc.line(px, py, px + Math.cos(a) * 10, py - Math.sin(a) * 10);
        doc.circle(px, py, 2.8, 'F'); doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.text(String(i + 1), px, py + 1.1, { align: 'center' }); doc.setFont('helvetica', 'normal');
      });
      northPt(doc, kf.x + kf.w - 10, kf.y + 12, 4.5); scaleBar(doc, kf.x + 6, kf.y + kf.h - 7, ks, ks <= 1000 ? 20 : 50);
      doc.setFontSize(7); doc.setTextColor(110); doc.text('Key plan', kf.x + 6, kf.y + kf.h - 12);
      const gx = kf.x + kf.w + 8, cw = (A2W - M - gx - 8) / 2, ch = (availH - 16) / 3, names = ['Distant view', 'Approach', 'Approach', 'Nearer', 'Arrival', 'Threshold'];
      for (let i = 0; i < 6; i++) {
        const x = gx + (i % 2) * (cw + 8), y = top + Math.floor(i / 2) * (ch + 8);
        doc.setDrawColor(40); doc.setLineWidth(0.35); doc.rect(x, y, cw, ch);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(192, 67, 42); doc.text(String(i + 1).padStart(2, '0'), x + 4, y + 8);
        doc.setTextColor(29, 33, 32); doc.setFontSize(10); doc.text(names[i].toUpperCase(), x + 14, y + 8); doc.setFont('helvetica', 'normal');
      }
      titleBlock(doc, 'Sequence of views on approach', 'A2 · key plan 1:' + ks);
      doc.save(fileName('approach_views_A2'));
      status(S.views.length ? 'Downloaded the views sheet with ' + S.views.length + ' viewpoint' + (S.views.length > 1 ? 's' : '') + ' on the key plan.' : 'Downloaded the views sheet. Place viewpoints in Views mode to number them on the key plan.');
    }
  };
  document.querySelectorAll('[data-dl]').forEach(b => b.onclick = async () => { b.disabled = true; try { await DL[b.dataset.dl](); } catch (e) { status('Something went wrong making the drawing: ' + e.message, true); } b.disabled = false; });
  $('plName').value = S.name; $('plName').oninput = e => { S.name = e.target.value; save(); };
  $('plShowFp').checked = S.showFp !== false; $('plShowFp').onchange = e => { S.showFp = e.target.checked; save(); };

  // ================= 1:50 LASER BASE =================
  $('mbSize').value = S.mbSize; $('mbBoard').value = S.mbBoard;
  $('mbSize').onchange = e => { S.mbSize = +e.target.value; save(); mbInfo(); }; $('mbBoard').onchange = e => { S.mbBoard = +e.target.value; save(); mbInfo(); };
  function mbInfo() {
    if (!G) return; const sz = S.mbSize / 20, c = designC();
    let lo = Infinity, hi = -Infinity; for (let x = c[0] - sz / 2; x <= c[0] + sz / 2; x += 0.5) for (let y = c[1] - sz / 2; y <= c[1] + sz / 2; y += 0.5) { const z = G.sample(x, y); if (z === z) { lo = Math.min(lo, z); hi = Math.max(hi, z); } }
    const n = isFinite(lo) ? Math.ceil((hi - lo) / (S.mbBoard / 20)) : 0;
    $('mbInfo').textContent = (S.forms.length ? 'Centred on your pavilion. ' : 'Centred on the mill (place your pavilion in section 04 to centre it there). ') + (n ? 'The ground rises ' + (hi - lo).toFixed(1) + ' m across it: about ' + n + ' layers of ' + S.mbBoard + ' mm board, ' + (n * S.mbBoard) + ' mm tall.' + (n > 80 ? ' That is a lot of layers: try a smaller area or thicker board.' : '') : 'This area is outside the survey.');
  }
  $('mbZip').onclick = async () => {
    const b = $('mbZip'); b.disabled = true; const info = $('mbInfo');
    try {
      await gP; if (!G || !window.MyModel || !window.JSZip) { info.textContent = 'The model maker didn’t load. Reload the page.'; return; }
      info.textContent = 'Working out the layers…'; await new Promise(r => setTimeout(r, 30));
      const MM = window.MyModel, size = S.mbSize / 20, c = designC(), sel = { x0: c[0] - size / 2, y0: c[1] - size / 2, size };
      MM.setScale(50);
      const model = MM.buildModel(G.DEM, sel, S.mbBoard, { scale: 50, hollow: true, rim: 15 });
      if (!model.layers.length) { info.textContent = 'No layers: this area is outside the survey or flat at this board thickness.'; return; }
      const packed = MM.nest(model.layers, 841, 594);
      if (packed.error) { info.textContent = packed.error; return; }
      const zip = new window.JSZip(), dir = zip.folder('laser_sheets');
      for (let i = 0; i < packed.count; i++) { const n = String(i + 1).padStart(2, '0'); dir.file('sheet_' + n + '.svg', MM.toSVG(packed, i, 'Gleniff 1:50 base sheet ' + n)); dir.file('sheet_' + n + '.dxf', MM.toDXF(packed, i)); }
      const lines = ['Gleniff pavilion: 1:50 landscape base', (S.name ? 'For ' + S.name : ''), '', 'Area: ' + size + ' x ' + size + ' m, model ' + S.mbSize + ' x ' + S.mbSize + ' mm at 1:50', 'Board: ' + S.mbBoard + ' mm, one layer every ' + (S.mbBoard / 20).toFixed(2) + ' m', 'South-west corner of the area: x ' + sel.x0.toFixed(1) + ' m, y ' + sel.y0.toFixed(1) + ' m from the survey origin', 'Sheets: ' + packed.count + ' x A1 (841 x 594 mm). Red lines cut, blue lines engrave the layer numbers.', '', 'Layers, from the bottom (stack in this order on a base board):'];
      model.layers.forEach((l, i) => lines.push('  ' + String(i + 1).padStart(3, ' ') + '   level ' + fmtL(l.L) + ' m'));
      lines.push('', levelNote() + '.', 'North is up on every sheet. Mark north on the base before you glue the first layer.');
      zip.file('README.txt', lines.filter((l, i) => l !== '' || i > 1).join('\r\n'));
      dlBlob(await zip.generateAsync({ type: 'blob' }), fileName('1-50_base_laser', 'zip'));
      info.textContent = 'Downloaded: ' + model.layers.length + ' layers on ' + packed.count + ' A1 sheet' + (packed.count > 1 ? 's' : '') + '. Check the files with the technician before cutting.';
    } catch (e) { info.textContent = 'Something went wrong: ' + e.message; }
    finally { b.disabled = false; }
  };

  // ================= GO =================
  renderLists(); adjList(); adjRender(); renderViews(); renderForms(); hint(); pruneLinks();
  setTimeout(pruneOnpage, 600); setTimeout(pruneOnpage, 2500);
  const rs = () => { sizeMap(); draw(); drawSec(); };
  window.addEventListener('resize', () => { clearTimeout(rs.t); rs.t = setTimeout(rs, 120); });
  gP.then(g => {
    if (!$('plMap') || !document.body.contains(cv)) return;   // the page was locked after this script started
    if (!g) { $('plHint').textContent = 'The survey needs the website served over http (GitHub Pages or a local server).'; return; }
    const c = designC(); V.cx = c[0]; V.cy = c[1]; sizeMap(); V.mpp = 70 / V.w;
    if (!S.cut && S.forms.length) defaultCut();
    renderForms(); draw(); drawSec(); mbInfo(); updSun(); setMode('form');
  });
})();
