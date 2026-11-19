/* Trees on Your model (model.html #mTrees). Removable add-on: this file, the #mTrees block in model.html and the
   item "model-trees" in access.json (switched on and off from the admin page). Uses data/trees.json and
   downloads/trees/ from the Model kit trees add-on.
   - a trees layer on the plan (students switch it on and off; remembered in this browser), also printed on the
     1:100 contour plan while it is on;
   - a tree template for the student's own square at their model scale: A3, true size, with a schedule of every
     tree's height and crown in model millimetres. Bigger squares come on several A3 sheets.
   model.js calls ModelTrees.drawPlan(P) and ModelTrees.drawPDF(doc, X, Y, box) if this file is loaded, and
   provides window.MyModelState(). When the admin switch is off (#mTrees hidden) nothing is drawn.
   Coordinates: metres from the survey's south-west corner. */
(function () {
  'use strict';
  const KEY = 'gleniff-model-trees';
  const BANDS = [[3, 6, 'Small', 237], [6, 10, 'Medium', 214], [10, 15, 'Large', 184], [15, 99, 'Very large', 153]];
  const band = h => BANDS.find(b => h >= b[0] && h < b[1]) || BANDS[3];
  const $ = id => document.getElementById(id);
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  let T = null, show = true;
  try { show = localStorage.getItem(KEY) !== '0'; } catch (e) { }

  const enabled = () => { const e = $('mTrees'); return !!(e && T && !e.classList.contains('acc-off')); };
  const visible = () => enabled() && show;
  const fire = () => window.dispatchEvent(new Event('trees-change'));
  const state = () => window.MyModelState ? window.MyModelState() : null;
  // trees whose crown reaches into the square (x0, y0, side in metres)
  const inSq = s => T.filter(t => {
    const dx = Math.max(s.x0 - t.x, 0, t.x - (s.x0 + s.side)), dy = Math.max(s.y0 - t.y, 0, t.y - (s.y0 + s.side));
    return dx * dx + dy * dy < (t.d / 2) ** 2;
  });
  const centreIn = (t, s) => t.x >= s.x0 && t.x <= s.x0 + s.side && t.y >= s.y0 && t.y <= s.y0 + s.side;
  const fmt = v => (Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1));

  function count() {
    const s = state(), el = $('mTreeCount'); if (!s || !el || !T) return;
    const a = inSq(s), c = a.filter(t => centreIn(t, s)).length;
    el.textContent = a.length ? `${a.length} tree${a.length === 1 ? '' : 's'} in your square (${c} standing inside it, ${a.length - c} reaching in from outside). ` +
      `At 1:${s.scale}, 1 m is ${fmt(1000 / s.scale)} mm: a 10 m tree is ${fmt(10000 / s.scale)} mm tall.` : 'No trees of 3 m and over in your square.';
    const b = $('dlTrees'); if (b) b.disabled = !a.length;
  }

  // ---------- on the interactive plan: P.X / P.Y take plan mm (5 per metre)
  function drawPlan(P) {
    count();
    if (!visible()) return;
    const c = P.ctx, flat = css('--flat') || '#7a8a7e', ink = css('--ink') || '#1d2120';
    c.save();
    for (const t of T) {
      const x = P.X(t.x * 5), y = P.Y(t.y * 5), r = t.d / 2 * 5 * P.s;
      c.globalAlpha = [0.28, 0.45, 0.62, 0.8][BANDS.indexOf(band(t.h))]; c.fillStyle = flat;
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
      c.globalAlpha = 0.8; c.strokeStyle = ink; c.lineWidth = 0.6; c.stroke();
    }
    c.restore();
  }

  // ---------- on the 1:100 contour plan PDF: X / Y take metres; box = drawing frame in paper mm
  function clipRect(doc, x, y, w, h) { doc.saveGraphicsState(); doc.rect(x, y, w, h, null); doc.clip(); doc.discardPath(); }
  function drawPDF(doc, X, Y, box) {
    if (!visible()) return [];
    const ps = X(1) - X(0);
    clipRect(doc, box[0], box[1], box[2] - box[0], box[3] - box[1]);
    doc.setLineWidth(0.25); doc.setDrawColor(40, 110, 60); doc.setLineDashPattern([], 0);
    let any = false;
    T.forEach(t => {
      const px = X(t.x), py = Y(t.y), r = t.d / 2 * ps;
      if (px + r < box[0] || px - r > box[2] || py + r < box[1] || py - r > box[3]) return;
      any = true; doc.circle(px, py, r, 'S');
      doc.line(px - 1, py, px + 1, py); doc.line(px, py - 1, px, py + 1);
    });
    doc.setFontSize(5.5); doc.setTextColor(40, 110, 60);
    T.forEach(t => { const px = X(t.x), py = Y(t.y); if (px > box[0] && px < box[2] - 4 && py > box[1] + 2 && py < box[3]) doc.text(`T${t.id}${t.check ? '?' : ''} ${fmt(t.h)}m`, px + 1.2, py - 0.8); });
    doc.restoreGraphicsState();
    doc.setDrawColor(0); doc.setTextColor(0); doc.setLineWidth(0.2);
    return any ? ['Trees (green circles: crowns, labelled with tree number and height)'] : [];
  }

  // ---------- tree template for the student's square, A3 landscape, true size at the model scale
  function template() {
    const s = state(); if (!s || !T) return;
    const { jsPDF } = window.jspdf, PW = 420, PH = 297;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
    const k = 1000 / s.scale, D = s.side * k;                 // paper mm per metre; square size on paper (= model size)
    const trees = inSq(s).sort((a, b) => a.id - b.id);
    // drawing frames: one sheet when the square fits beside a title column, otherwise overlapping A3 tiles
    const single = D <= 250, FW = single ? D : 380, FH = single ? D : 250, OV = 20;
    const nc = single ? 1 : Math.max(1, Math.ceil((D - OV) / (FW - OV))), nr = single ? 1 : Math.max(1, Math.ceil((D - OV) / (FH - OV)));
    const sx = nc > 1 ? (D - FW) / (nc - 1) : 0, sy = nr > 1 ? (D - FH) / (nr - 1) : 0;
    const tiles = []; for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) tiles.push([c * sx, D - FH - r * sy]);  // north row first
    const title = `${s.site || 'Site'} · trees in your square · 1:${s.scale}`;
    const grid = s.scale <= 100 ? 5 : s.scale <= 200 ? 10 : s.scale <= 500 ? 25 : 50;   // grid every … m

    tiles.forEach(([vx, vy], i) => {
      if (i) doc.addPage('a3', 'landscape');
      const ox = 20, oy = single ? (PH - D) / 2 : 26;          // top-left of the frame on paper
      const P = (mx, my) => [ox + (mx - vx), oy + (vy + FH - my)];      // square mm (origin SW, y up) -> paper
      const fw = Math.min(FW, D), fh = Math.min(FH, D);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(single ? 13 : 11); doc.setTextColor(0);
      if (!single) {
        doc.text(`${title} · sheet ${i + 1} of ${tiles.length}`, ox, 12);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(70);
        doc.text(`Sheets overlap by about ${OV} mm: line them up on the ${grid} m grid and the tree crosses. Print at 100% (actual size), A3 landscape.`, ox, 17);
      }
      // square (the model edge) and grid, clipped
      clipRect(doc, ox, oy, fw, fh);
      doc.setDrawColor(170); doc.setLineWidth(0.15); doc.setLineDashPattern([1.5, 1.5], 0);
      for (let g = grid; g < s.side - 1e-6; g += grid) {
        let [a, b] = P(g * k, 0), [c2, d2] = P(g * k, D); doc.line(a, b, c2, d2);
        [a, b] = P(0, g * k); [c2, d2] = P(D, g * k); doc.line(a, b, c2, d2);
      }
      doc.setLineDashPattern([], 0);
      T.filter(t => trees.includes(t)).forEach(t => {          // big crowns first (T is sorted by crown)
        const [px, py] = P((t.x - s.x0) * k, (t.y - s.y0) * k);
        doc.setFillColor(band(t.h)[3]); doc.setDrawColor(0); doc.setLineWidth(0.25); doc.circle(px, py, t.d / 2 * k, 'FD');
      });
      doc.setLineWidth(0.3);
      trees.forEach(t => { const [px, py] = P((t.x - s.x0) * k, (t.y - s.y0) * k), a = Math.min(1.5, Math.max(0.6, t.d / 2 * k * 0.4)); doc.line(px - a, py, px + a, py); doc.line(px, py - a, px, py + a); });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(k < 2 ? 4.5 : D < 120 ? 5.5 : 6.5); doc.setTextColor(0);
      trees.forEach(t => { const [px, py] = P((t.x - s.x0) * k, (t.y - s.y0) * k); doc.text(`${t.id}${t.check ? '?' : ''}`, px + 1.2, py - 1); });
      doc.restoreGraphicsState();
      // model edge: solid where it is the edge of the square, dashed where the sheet is cut
      doc.setDrawColor(0); doc.setLineWidth(0.6);
      const [ex0, ey1] = P(0, 0), [ex1, ey0] = P(D, D);
      const L = Math.max(ox, ex0), R = Math.min(ox + fw, ex1), Tt = Math.max(oy, ey0), B = Math.min(oy + fh, ey1);
      if (ex0 >= ox - 0.01) doc.line(ex0, Tt, ex0, B); if (ex1 <= ox + fw + 0.01) doc.line(ex1, Tt, ex1, B);
      if (ey0 >= oy - 0.01) doc.line(L, ey0, R, ey0); if (ey1 <= oy + fh + 0.01) doc.line(L, ey1, R, ey1);
      if (!single) { doc.setLineWidth(0.25); doc.setLineDashPattern([2, 1.5], 0); doc.rect(ox, oy, fw, fh); doc.setLineDashPattern([], 0); }
      // grid figures (metres from the square's SW corner)
      doc.setFontSize(6.5); doc.setTextColor(90);
      for (let g = 0; g <= s.side + 1e-6; g += grid) {
        const [gx] = P(g * k, 0), [, gy] = P(0, g * k);
        if (gx >= ox - 0.5 && gx <= ox + fw + 0.5) doc.text(String(g), gx, oy + fh + 4, { align: 'center' });
        if (gy >= oy - 0.5 && gy <= oy + fh + 0.5) doc.text(String(g), ox - 2, gy + 1, { align: 'right' });
      }
      // key: where this sheet sits on the square
      if (!single) {
        const kw = 22, kx = PW - 20 - kw, ky = 6, ks = kw / D;
        doc.setDrawColor(120); doc.setLineWidth(0.2); doc.rect(kx, ky, kw, kw);
        doc.setFillColor(200); doc.rect(kx + vx * ks, ky + (D - vy - FH) * ks, fw * ks, fh * ks, 'FD');
        north(doc, kx - 8, ky + 10);
        footer(doc, s, ox + fw, PH - 8, 'right');
      }
    });

    // title column (single sheet) or schedule sheet(s)
    let x, y, colW, bottom = PH - 18;
    if (single) {
      x = 20 + D + 14; y = (PH - D) / 2 + 5; colW = PW - 20 - x;
      doc.setPage(1);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(0); doc.text(doc.splitTextToSize(title, colW)[0], x, y);
      y += 6; doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(60);
      doc.text(doc.splitTextToSize('Print at 100% (actual size), A3 landscape. Trim on the thick line: it is the edge of your model. Lay it over the model, north to north, prick through each tree centre, then make each tree to its crown circle and the height in the schedule.', colW), x, y);
      y += 16; north(doc, x + 4, y + 6); y += 16;
    } else {
      doc.addPage('a3', 'landscape'); x = 20; y = 18; colW = PW - 40;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(0); doc.text(`${title} · tree schedule`, x, y);
      y += 6; doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(60);
      doc.text(`Your square is ${fmt(s.side)} × ${fmt(s.side)} m on the ground and ${fmt(D)} × ${fmt(D)} mm on the model, on ${tiles.length} A3 sheets. Trim each sheet on the dashed frame, overlap and tape them, then trim the whole on the thick line (the model edge).`, x, y);
      y += 10;
      footer(doc, s, PW - 20, PH - 8, 'right');
    }
    doc.setFontSize(7.5); doc.setTextColor(60);
    doc.text(doc.splitTextToSize(`Grey crowns by height: light 3-6 m, 6-10 m, 10-15 m, dark over 15 m. ? = may be part of the mill ruin: check on site. Crowns reaching in from outside the square are cut at the edge. Grid every ${grid} m, figures in metres from the SW corner of your square.`, Math.min(colW, 250)), x, y);
    y += single ? 16 : 12;
    // schedule table
    const cols = [['No.', 10], ['Height m', 16], ['Crown m', 15], ['Model height mm', 24], ['Model crown mm', 24]];
    const tw = cols.reduce((a, c) => a + c[1], 0) + 6, perCol = Math.max(1, Math.floor(colW / tw));
    let col = 0, y0 = y, cx = x;
    const head = () => { doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(0); let xx = cx; cols.forEach(([h, w]) => { doc.text(h, xx, y); xx += w; }); doc.setFont('helvetica', 'normal'); doc.setDrawColor(0); doc.setLineWidth(0.2); doc.line(cx, y + 1.2, cx + tw - 6, y + 1.2); y += 4.5; };
    head();
    trees.forEach(t => {
      if (y > bottom) {
        col++; if (col >= perCol) { doc.addPage('a3', 'landscape'); footer(doc, s, PW - 20, PH - 8, 'right'); col = 0; y0 = 18; }
        cx = x + col * tw; y = y0; head();
      }
      doc.setFontSize(7); doc.setTextColor(0);
      let xx = cx;
      [`${t.id}${t.check ? '?' : ''}${centreIn(t, s) ? '' : '*'}`, t.h.toFixed(1), t.d.toFixed(1), fmt(t.h * k), fmt(t.d * k)].forEach((v, j) => { doc.text(v, xx, y); xx += cols[j][1]; });
      y += 3.8;
    });
    doc.setFontSize(6.5); doc.setTextColor(90); doc.text('* stands outside your square; only its crown reaches in.', cx, y + 2);
    if (single) footer(doc, s, PW - 20, PH - 8, 'right');
    const fn = `${(s.site || 'Site').replace(/[^A-Za-z0-9]+/g, '_')}_trees_1-${s.scale}_${(s.name || 'my_model').replace(/[^A-Za-z0-9]+/g, '_')}.pdf`;
    doc.save(fn);
  }
  function north(doc, x, y) {
    doc.setFillColor(0); doc.triangle(x, y - 6, x - 2.2, y + 1.5, x + 2.2, y + 1.5, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(0); doc.text('N', x, y - 7.5, { align: 'center' }); doc.setFont('helvetica', 'normal');
  }
  function footer(doc, s, x, y, align) {
    doc.setFontSize(6.5); doc.setTextColor(110);
    doc.text(`${s.name ? s.name + ' · ' : ''}${s.tile ? 'class tile ' + s.tile + ' · ' : ''}model 1:${s.scale}, ${fmt(s.size)} × ${fmt(s.size)} mm · tree heights from the Oct 2025 drone lidar (about ±1 m) · ATU Sligo · ARCT06004`, x, y, { align });
  }

  function ready() {
    const cb = $('mTreeShow');
    if (cb) { cb.checked = show; cb.onchange = () => { show = cb.checked; try { localStorage.setItem(KEY, show ? '1' : '0'); } catch (e) { } fire(); }; }
    const b = $('dlTrees');
    if (b) b.onclick = () => { b.disabled = true; const t = b.textContent; b.textContent = 'Making PDF…'; setTimeout(() => { try { template(); } finally { b.textContent = t; b.disabled = false; } }, 30); };
    const el = $('mTrees');
    if (el) new MutationObserver(fire).observe(el, { attributes: true, attributeFilter: ['class'] });   // admin switch applied
    fire();
  }

  window.ModelTrees = { drawPlan, drawPDF, on: visible };
  fetch('data/trees.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).then(j => {
    if (!j || !Array.isArray(j.trees)) return;
    T = j.trees.map(r => ({ id: r[0], x: r[1], y: r[2], h: r[3], d: r[4], sq: r[5], check: !!r[6] })).sort((a, b) => b.d - a.d);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
  }).catch(() => { });
})();
