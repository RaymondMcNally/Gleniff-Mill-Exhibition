/* Map layers for the Your model plan (model.html): the red line boundary and building outlines from the
   Stage 2 brief map, or any other layer listed in data/overlays.json. Students switch each layer on and off under
   the plan; the choice is remembered in this browser. Layers that are on are also printed on the 1:100 contour plan.
   model.js calls SiteOverlays.drawPlan(P) and SiteOverlays.drawPDF(doc, X, Y, box) if this file is loaded;
   delete this file and data/overlays.json to remove the layers. Coordinates: metres from the survey's SW corner. */
(function () {
  'use strict';
  const KEY = 'gleniff-overlays';
  let layers = [], on = {};
  try { on = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { }
  const isOn = l => on[l.id] ?? l.on !== false;
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const col = l => l.color === 'ink' ? css('--ink') : l.color;
  const rgb = h => { const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(h || ''); return m ? [1, 2, 3].map(i => parseInt(m[i], 16)) : [29, 33, 32]; };

  function controls() {
    const wrap = document.querySelector('#pickPlan')?.closest('.canvas-wrap'); if (!wrap || !layers.length) return;
    let box = document.getElementById('ovlBox');
    if (!box) {
      box = document.createElement('div'); box.id = 'ovlBox'; box.className = 'ovl';
      box.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px 16px;align-items:center;padding:8px 2px 0;font-size:.84rem';
      wrap.after(box);
    }
    box.innerHTML = '<span class="lbl">Map layers</span>' + layers.map(l => {
      const c = col(l);
      return '<label style="display:inline-flex;gap:6px;align-items:center;cursor:pointer" title="' + (l.note || '').replace(/"/g, '&quot;') + '"><input type="checkbox" data-ovl="' + l.id + '"' + (isOn(l) ? ' checked' : '') + '>' +
        '<span style="display:inline-block;width:18px;height:0;border-top:' + Math.max(2, l.width) + 'px solid ' + c + '"></span>' + l.name + '</label>';
    }).join('');
    box.onchange = e => {
      const id = e.target.dataset.ovl; if (!id) return;
      on[id] = e.target.checked; try { localStorage.setItem(KEY, JSON.stringify(on)); } catch (err) { }
      window.dispatchEvent(new Event('overlays-change'));
    };
  }

  // on the interactive plan: P.X / P.Y take plan mm (5 per metre)
  function drawPlan(P) {
    const c = P.ctx;
    layers.filter(isOn).forEach(l => {
      const k = col(l);
      l.polys.forEach(r => {
        c.beginPath(); r.forEach(([x, y], i) => i ? c.lineTo(P.X(x * 5), P.Y(y * 5)) : c.moveTo(P.X(x * 5), P.Y(y * 5))); c.closePath();
        if (l.fill) { c.fillStyle = k; c.globalAlpha = l.fill; c.fill(); c.globalAlpha = 1; }
        c.strokeStyle = k; c.lineWidth = l.width || 2; c.lineJoin = 'round'; c.stroke();
      });
    });
  }

  // on the PDF plan: X / Y take metres; box = [x0, y0, x1, y1] of the drawing frame in paper mm (lines are clipped to it)
  function clip(x1, y1, x2, y2, b) {
    let t0 = 0, t1 = 1; const dx = x2 - x1, dy = y2 - y1;
    for (const [p, q] of [[-dx, x1 - b[0]], [dx, b[2] - x1], [-dy, y1 - b[1]], [dy, b[3] - y1]]) {
      if (p === 0) { if (q < 0) return null; continue; }
      const t = q / p; if (p < 0) { if (t > t1) return null; if (t > t0) t0 = t; } else { if (t < t0) return null; if (t < t1) t1 = t; }
    }
    return [x1 + t0 * dx, y1 + t0 * dy, x1 + t1 * dx, y1 + t1 * dy];
  }
  function drawPDF(doc, X, Y, box) {
    const used = [];
    layers.filter(isOn).forEach(l => {
      const [r, g, b] = l.color === 'ink' ? [20, 20, 20] : rgb(l.color);
      doc.setDrawColor(r, g, b); doc.setLineWidth(l.pdfWidth || 0.35);
      let any = false;
      l.polys.forEach(p => p.forEach((q, i) => {
        const n = p[(i + 1) % p.length], a = clip(X(q[0]), Y(q[1]), X(n[0]), Y(n[1]), box);
        if (a) { doc.line(a[0], a[1], a[2], a[3]); any = true; }
      }));
      if (any) used.push(l);
    });
    doc.setDrawColor(0); doc.setLineWidth(0.2);
    return used.map(l => l.name);      // model.js can list these in the legend if it wants
  }

  window.SiteOverlays = { drawPlan, drawPDF, layers: () => layers.filter(isOn) };
  fetch('data/overlays.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).then(j => {
    if (!j || !Array.isArray(j.layers)) return;
    layers = j.layers.filter(l => Array.isArray(l.polys) && l.polys.length);
    const go = () => { controls(); window.dispatchEvent(new Event('overlays-change')); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  }).catch(() => { });
})();
