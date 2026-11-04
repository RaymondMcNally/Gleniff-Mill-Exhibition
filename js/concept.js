/* Stage 2 · Concept and parti (concept.html). Part of the removable Stage 2 add-on:
   concept.html, css/concept.css, js/concept.js. Uses js/plan.js for the survey and vendor/jspdf for the PDFs.
   Everything a student types stays in this browser (localStorage 'gleniff-concept'). */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const KEY = 'gleniff-concept';
  const S = { idea: '', heads: [], ans: {}, name: '', title: '', under: 'site', prompt: true, intent: {} };
  try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); if (!S.name) S.name = localStorage.getItem('sitekit-name') || ''; } catch (e) { }
  let saveT = 0;
  const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(S)); if (S.name) localStorage.setItem('sitekit-name', S.name); } catch (e) { } }, 250); };

  // ---------- dates (set in concept.html, window.STAGE2)
  const D = window.STAGE2 || {};
  document.querySelectorAll('[data-date]').forEach(dd => {
    const d = D[dd.dataset.date] || {};
    const when = d.date ? new Date(d.date + 'T12:00:00').toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short' }) : 'To be confirmed';
    dd.innerHTML = esc(when) + (d.note ? '<small>' + esc(d.note) + '</small>' : '');
  });

  // ---------- links that only exist on one of the two sites (e.g. the exhibition's maps and sounds)
  const exists = {};
  const check = f => exists[f] || (exists[f] = fetch(f, { method: 'HEAD', cache: 'no-store' }).then(r => r.ok).catch(() => false));
  const pruneLinks = () => document.querySelectorAll('[data-if]').forEach(a => { a.hidden = true; check(a.dataset.if).then(ok => { a.hidden = !ok; }); });

  // ---------- the brief's design decisions, tied to the site
  const T = {
    contours: ['contours.html', 'Contours'], slope: ['contours.html#measure', 'Slope and levels'], game: ['contour-game.html', 'Plan to section'],
    sun: ['sun.html#sun', 'Sun and shadow'], aspect: ['sun.html#draw', 'Aspect and shade'], micro: ['sun.html#micro', 'Microclimate'], climate: ['sun.html#climate', 'Wind and rain'],
    sections: ['sections.html', 'Sections'], splat: ['splat.html', 'Splat model'], lidar: ['lidar.html', 'Lidar survey'],
    model: ['model.html', 'Your model'], kit: ['kit.html', 'Model kit'], prec: ['#precedents', 'Precedents'], story: ['#story', 'Story and place'],
    brief: ['index.html#tasks', 'The brief'], sdgs: ['index.html#sdgs', 'SDGs'], heliodon: ['heliodon.html', 'Heliodon', 'heliodon.html'],
    maps: ['kiosk.html', 'Old maps', 'exhibition/config.json'], sound: ['exhibition/sounds/river.m4a', 'River recording', 'exhibition/sounds/river.m4a']
  };
  const HEADS = [
    ['Approach', 'How do you arrive: by the road, along the river, through the trees? What do you see first, and what is kept back?', ['sections', 'splat', 'contours']],
    ['Siting', 'Where exactly does it sit, and why there and not ten metres away?', ['contours', 'aspect', 'model']],
    ['Form', 'What shape follows from the idea, and from the ground it sits on?', ['contours', 'game', 'prec']],
    ['Massing', 'One volume or several? How big is it next to the mill ruins and the trees?', ['splat', 'sections']],
    ['Composition', 'How do the parts relate: around a centre, along a line, scattered, stepped?', ['contours', 'prec']],
    ['Rhythm', 'What repeats on the site, like trees, walls, steps or falling water, and what repeats in your design?', ['splat', 'prec']],
    ['Threshold', 'Where does outside become inside, open become sheltered, loud become quiet?', ['micro', 'sections']],
    ['Haptic texture', 'What will small hands and feet touch, and what should it feel like?', ['splat', 'story']],
    ['Light', 'Where is the sun when the children are there? Where do you want brightness, and where shade?', ['sun', 'aspect', 'heliodon']],
    ['Acoustic', 'Where is the river loud, where is it quiet? Is the sound of water something to frame or to escape?', ['sound', 'micro']],
    ['Sight', 'What should a child see from inside: what is framed, what is hidden, what is revealed slowly?', ['splat', 'sections']],
    ['Scent', 'Wet stone, woodland, gorse, the river after rain: what does the place smell like, and where?', ['micro']],
    ['Aspect', 'Which way does the ground face, and which way should the pavilion open?', ['aspect', 'sun', 'climate']],
    ['Structure', 'What holds it up, and does the structure say the idea?', ['prec', 'kit']],
    ['Sequence', 'In what order are spaces and experiences met, from arriving to gathering to leaving?', ['sections', 'contours']],
    ['Circulation', 'How do children move through and around it, on steep ground and along the water?', ['slope', 'contours']],
    ['Scale', 'What is at a child’s scale, and what is at the scale of the valley?', ['model', 'sections']],
    ['Materiality', 'What is it made of, and why: from the place, from the mill’s history, from what the idea needs?', ['maps', 'splat', 'story']],
    ['Interpretation', 'How does it tell the story of the mill, the barytes, the water and the people?', ['story', 'maps', 'lidar']],
    ['Functional brief', 'Shelter, play and learning: how does the idea organise what the brief asks for?', ['brief']],
    ['External environment', 'What does the site gain from the pavilion being there? Which SDGs does it answer?', ['sdgs', 'climate']]
  ];
  const qOf = h => (HEADS.find(x => x[0] === h) || [])[1] || '';
  const toolLink = k => { const t = T[k]; return t ? '<a href="' + t[0] + '"' + (t[2] ? ' data-if="' + t[2] + '"' : '') + '>' + esc(t[1]) + ' →</a>' : ''; };

  function renderHeads() {
    $('headGrid').innerHTML = HEADS.map(([h, q, tools]) => {
      const on = S.heads.includes(h);
      return '<article class="c2-head' + (on ? ' on' : '') + '" data-h="' + esc(h) + '"><div class="top"><b>' + esc(h) + '</b><button type="button" aria-pressed="' + on + '">' + (on ? 'Chosen' : 'Choose') + '</button></div><p>' + esc(q) + '</p><div class="go">' + tools.map(toolLink).join('') + '</div></article>';
    }).join('');
    $('tChips').innerHTML = HEADS.map(([h]) => '<button type="button" data-h="' + esc(h) + '" aria-pressed="' + S.heads.includes(h) + '">' + esc(h) + '</button>').join('');
    const n = S.heads.length;
    $('headCount').textContent = n ? n + ' chosen: ' + S.heads.join(', ') + (n < 6 ? '. Choose at least ' + (6 - n) + ' more for your six parti diagrams.' : '.') : 'None chosen yet. Choose at least six.';
    $('sHeads').textContent = n ? n + ' heading' + (n > 1 ? 's' : '') + ' chosen in section 06, so ' + Math.max(1, Math.ceil(n / 6)) + ' sheet' + (Math.ceil(n / 6) > 1 ? 's' : '') + '.' + (n < 6 ? ' Empty frames get a blank heading to fill in.' : '') : 'No headings chosen yet: the frames get blank headings to fill in. Choose headings in section 06.';
    pruneLinks();
  }
  const toggleHead = h => { const i = S.heads.indexOf(h); if (i < 0) S.heads.push(h); else S.heads.splice(i, 1); S.heads.sort((a, b) => HEADS.findIndex(x => x[0] === a) - HEADS.findIndex(x => x[0] === b)); save(); renderHeads(); verdict(); drawPreview(); };
  document.addEventListener('click', e => { const b = e.target.closest('#headGrid button, #tChips button'); if (b) toggleHead(b.closest('[data-h]').dataset.h); });

  // ---------- ten themes (from the brief, 2.1)
  const THEMES = [
    ['Meaningful concepts make wholes', 'The project is more than the sum of its parts.', 'Take one part away. Does the whole still make sense?'],
    ['Details reflect wholes', 'A handrail or a window carries the idea in concentrated form.', 'Pick one detail. Can you see the concept in it?'],
    ['Details have several roles', 'One element answers several requirements at once.', 'Which move in your parti solves two or three things?'],
    ['Form-patterns recur', 'Patterns repeat inside and out, responding to use and climate.', 'What repeats, and why does it change where it changes?'],
    ['Order and variation', 'Parts belong to one family but each has its own identity.', 'What is the rule, and where do you break it?'],
    ['Good projects are legible', 'You can find the entrance and follow the routes without signs.', 'Where would a child go first without being told?'],
    ['Identity without dominance', 'Not overbearing, and more than merging in: it improves the place.', 'What does Gleniff gain from your pavilion being there?'],
    ['Material and form are linked', 'Materials are explored beyond the commonplace.', 'Could your form be built in a different material and stay the same?'],
    ['Form and space come alive in light', 'Sunlight on the outside and light inside change surfaces and spaces.', 'Where is your pavilion at its best: morning, noon, or a winter afternoon?'],
    ['Projects reveal their ethics', 'Respect for the setting, the users and sustainability can be read.', 'What does your design say it values?']
  ];
  $('themeGrid').innerHTML = THEMES.map((t, i) => '<article><span class="n">' + String(i + 1).padStart(2, '0') + '</span><b>' + esc(t[0]) + '</b><span>' + esc(t[1]) + '</span><em>' + esc(t[2]) + '</em></article>').join('');

  // ---------- is it a concept?
  const QS = [
    ['site', 'Did it start from something you found at Gleniff in Stage 1?', true, 'Go back to your Stage 1 work: your views, your experiential map, your analysis. An idea that could sit anywhere usually ends up as a style.'],
    ['draw', 'Could you draw it in about ten lines, without detail?', true, 'Simplify. Try drawing it in thirty seconds with a thick pen. Whatever survives is the parti.'],
    ['more', 'Is it more than a shape, a material or a style?', true, 'A shape or material can serve the idea, but ask why: the answer to "why" is closer to your concept.'],
    ['here', 'Would it lose its meaning on a different site?', true, 'If it would work just as well in a city car park, tie it to something particular here: the water, the slope, the ruin, the valley.'],
    ['read', 'Could a visitor sense it without a sign explaining it?', true, 'The brief says good projects are legible. Ask what someone would feel, not what you would tell them.']
  ];
  $('tQs').innerHTML = QS.map(([k, q]) => '<li data-k="' + k + '"><span>' + esc(q) + '</span><div class="yn"><button type="button" data-v="1">Yes</button><button type="button" data-v="0">No</button></div></li>').join('');
  $('tQs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const k = b.closest('li').dataset.k; S.ans[k] = S.ans[k] === +b.dataset.v ? undefined : +b.dataset.v; save(); verdict(); });
  $('tIdea').value = S.idea;
  $('tIdea').oninput = e => { S.idea = e.target.value; save(); verdict(); syncIdea(); };
  function verdict() {
    document.querySelectorAll('#tQs li').forEach(li => li.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', S.ans[li.dataset.k] === +b.dataset.v)));
    const words = S.idea.trim() ? S.idea.trim().split(/\s+/).length : 0, items = [];
    items.push(words === 0 ? ['todo', 'Write your idea in one sentence first.'] : words > 40 ? ['todo', 'Your sentence is ' + words + ' words. A concept usually fits in under 30. What can you cut?'] : ['ok', 'Your idea fits in one sentence.']);
    items.push(S.heads.length >= 3 ? ['ok', 'It decides ' + S.heads.length + ' headings. A strong idea makes several decisions at once.'] : ['todo', 'Tap the headings it decides. If it decides fewer than three, it may be a theme rather than a concept.']);
    QS.forEach(([k, q, good, advice]) => { if (S.ans[k] === undefined) items.push(['todo', 'Answer: ' + q]); else items.push(!!S.ans[k] === good ? ['ok', q.replace(/\?$/, '') + ': yes.'] : ['todo', advice]); });
    const ok = items.filter(i => i[0] === 'ok').length, tot = items.length;
    const head = ok === tot ? 'This is working as a concept.' : ok >= tot - 2 ? 'Nearly there.' : words ? 'Keep developing it.' : 'Start with a sentence.';
    $('tVerdict').innerHTML = '<h3>' + head + '</h3><div class="c2-meter"><i style="width:' + Math.round(100 * ok / tot) + '%"></i></div><ul>' + items.map(([c, t]) => '<li class="' + c + '">' + esc(t) + '</li>').join('') + '</ul><p class="small" style="margin-top:10px">This is a prompt for thinking, not a mark. Bring it to your tutor.</p>';
  }

  // ---------- parti sheets: survey underlay
  let G = null, Glo = 0, Ghi = 0;
  const gP = (window.loadGleniff ? window.loadGleniff() : Promise.resolve(null)).then(g => {
    G = g;
    if (g) { Glo = Infinity; Ghi = -Infinity; for (const v of g.Hm) if (v === v) { if (v < Glo) Glo = v; if (v > Ghi) Ghi = v; } }
    return g;
  }).catch(() => null);
  const VIEWS = {   // model mm at 1:200 (x east, y north) and paper scale
    site: { x: 0, y: 0, w: 1688, h: 1207, scale: 2500, bar: 50, note: 'The whole survey at 1:2500, contours every 2 m.' },
    mill: { x: 0, y: 300, w: 1000, h: 750, scale: 1250, bar: 20, note: 'The mill, the river and the road at 1:1250, contours every 2 m.' },
    outline: { x: 0, y: 0, w: 1688, h: 1207, scale: 2500, bar: 50, outline: true, note: 'Only the river, stream, road and mill at 1:2500: draw your own ground.' },
    none: { note: 'Empty frames.' },
    a3: { x: 0, y: 0, w: 1688, h: 1207, scale: 1250, bar: 20 }
  };
  const paperMm = v => [v.w * 200 / v.scale, v.h * 200 / v.scale];   // model mm at 1:200 -> paper mm at 1:scale
  const underCache = {};
  function underlay(kind, res) {   // a canvas of the survey for this view, res px per paper mm
    const v = VIEWS[kind], k = kind + res;
    if (underCache[k]) return underCache[k];
    const [pw, ph] = paperMm(v), c = document.createElement('canvas');
    c.width = Math.round(pw * res); c.height = Math.round(ph * res);
    const x = c.getContext('2d'), s = c.width / v.w;
    x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    const X = mx => (mx - v.x) * s, Y = my => (v.y + v.h - my) * s;
    x.lineCap = 'round'; x.lineJoin = 'round';
    if (!v.outline && G) {
      for (let L = Math.ceil(Glo / 2) * 2; L <= Ghi; L += 2) {
        const seg = G.contour(L), idx = L % 10 === 0;
        x.strokeStyle = idx ? '#8f8f8f' : '#bdbdbd'; x.lineWidth = (idx ? 0.28 : 0.16) * res;
        x.beginPath();
        for (let i = 0; i < seg.length; i += 4) { x.moveTo(X(seg[i]), Y(seg[i + 1])); x.lineTo(X(seg[i + 2]), Y(seg[i + 3])); }
        x.stroke();
      }
    }
    if (G) {
      const line = (pts, col, w, dash) => { x.strokeStyle = col; x.lineWidth = w * res; x.setLineDash(dash ? dash.map(d => d * res) : []); x.beginPath(); pts.forEach(([a, b], i) => i ? x.lineTo(X(a), Y(b)) : x.moveTo(X(a), Y(b))); x.stroke(); };
      line(G.RIVER, '#9cc0ee', 0.9); line(G.TRIB, '#b5d0f2', 0.6); line(G.ROAD, '#a8a8a8', 0.45, [2, 1.2]);
      x.setLineDash([]); x.strokeStyle = '#9a9a9a'; x.lineWidth = 0.35 * res; const m = G.MILL; x.strokeRect(X(m.x), Y(m.y + m.h), m.w * s, m.h * s);
    }
    x.setLineDash([]); x.strokeStyle = '#c8c8c8'; x.lineWidth = 0.2 * res; x.strokeRect(0, 0, c.width, c.height);
    return (underCache[k] = c);
  }

  // ---------- parti sheets: layout (paper mm, A2 landscape 594 x 420)
  const A2 = { w: 594, h: 420, m: 12, tb: 20, gap: 8 };
  function sheets() {
    const n = Math.max(6, Math.ceil(S.heads.length / 6) * 6), out = [];
    for (let s = 0; s < n / 6; s++) {
      const fr = [], fw = (A2.w - 2 * A2.m - 2 * A2.gap) / 3, fh = (A2.h - 2 * A2.m - A2.tb - A2.gap - 4) / 2;
      for (let i = 0; i < 6; i++) {
        const h = S.heads[s * 6 + i] || '';
        fr.push({ x: A2.m + (i % 3) * (fw + A2.gap), y: A2.m + Math.floor(i / 3) * (fh + A2.gap), w: fw, h: fh, n: s * 6 + i + 1, head: h, q: h && S.prompt ? qOf(h) : '' });
      }
      out.push(fr);
    }
    return out;
  }
  function frameInner(f, v) {   // where the underlay sits inside a frame
    const [pw, ph] = paperMm(v), top = f.y + 26, avail = f.h - 26 - 8;
    return { x: f.x + (f.w - pw) / 2, y: top + Math.max(0, (avail - ph) / 2), w: pw, h: ph };
  }

  function drawPreview() {
    const cv = $('sPreview'); if (!cv) return; const x = cv.getContext('2d'), k = cv.width / A2.w, fr = sheets()[0], v = VIEWS[S.under];
    x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height);
    x.strokeStyle = '#222'; x.lineWidth = 0.35 * k * 2;
    fr.forEach(f => {
      x.strokeStyle = '#333'; x.lineWidth = 1; x.strokeRect(f.x * k, f.y * k, f.w * k, f.h * k);
      x.fillStyle = '#c0432a'; x.font = '700 ' + (5 * k) + 'px Archivo, sans-serif'; x.fillText(String(f.n).padStart(2, '0'), (f.x + 4) * k, (f.y + 8) * k);
      x.fillStyle = '#1d2120'; x.fillText(f.head ? f.head.toUpperCase() : 'HEADING: ______________', (f.x + 14) * k, (f.y + 8) * k);
      if (f.q) { x.fillStyle = '#777'; x.font = (3 * k) + 'px Archivo, sans-serif'; wrapCanvas(x, f.q, (f.x + 14) * k, (f.y + 13) * k, (f.w - 18) * k, 3.8 * k, 3); }
      if (v.w && G) { const r = frameInner(f, v); x.drawImage(underlay(S.under, 2), r.x * k, r.y * k, r.w * k, r.h * k); }
    });
    const ty = A2.h - A2.m - A2.tb;
    x.strokeStyle = '#333'; x.strokeRect(A2.m * k, ty * k, (A2.w - 2 * A2.m) * k, A2.tb * k);
    x.fillStyle = '#1d2120'; x.font = '700 ' + (5 * k) + 'px Archivo, sans-serif'; x.fillText('PARTI DIAGRAMS' + (S.title ? ' · ' + S.title.toUpperCase() : ''), (A2.m + 4) * k, (ty + 9) * k);
    x.font = (3.4 * k) + 'px Archivo, sans-serif'; x.fillStyle = '#555'; x.fillText((S.name || 'Your name') + ' · Project 1 Stage 2 · The Waters and the Wild', (A2.m + 4) * k, (ty + 15) * k);
    if (!G && v.w) { x.fillStyle = '#c0432a'; x.font = (5 * k) + 'px Archivo, sans-serif'; x.fillText('Loading the survey…', 30 * k, 60 * k); }
    $('underNote').textContent = v.note;
  }
  function wrapCanvas(x, t, X, Y, w, lh, max) {
    const words = t.split(' '); let line = '', n = 0;
    for (const wd of words) { const tst = line ? line + ' ' + wd : wd; if (x.measureText(tst).width > w && line) { x.fillText(line, X, Y + n * lh); line = wd; if (++n >= max) return; } else line = tst; }
    if (line) x.fillText(line, X, Y + n * lh);
  }

  // ---------- PDF helpers
  const pdfOk = () => { if (window.jspdf) return true; status('The PDF maker didn’t load. Reload the page and try again.', true); return false; };
  const status = (t, err) => { $('sStatus').textContent = t; $('sStatus').className = 'status small' + (err ? ' err' : ''); };
  const fileName = s => (S.name ? S.name.trim().replace(/\s+/g, '_').replace(/[^\w-]/g, '') + '_' : '') + 'gleniff_' + s + '.pdf';
  function north(doc, cx, cy, r) {
    doc.setDrawColor(60); doc.setLineWidth(0.25); doc.circle(cx, cy, r);
    doc.setFillColor(40); doc.triangle(cx, cy - r * 0.85, cx - r * 0.35, cy + r * 0.5, cx + r * 0.35, cy + r * 0.5, 'F');
    doc.setFontSize(6); doc.setTextColor(60); doc.text('N', cx, cy - r - 1.2, { align: 'center' });
  }
  function scaleBar(doc, x, y, v) {
    const len = v.bar * 1000 / v.scale;   // paper mm
    doc.setDrawColor(90); doc.setLineWidth(0.25); doc.line(x, y, x + len, y); doc.line(x, y - 1, x, y + 1); doc.line(x + len / 2, y - 0.7, x + len / 2, y + 0.7); doc.line(x + len, y - 1, x + len, y + 1);
    doc.setFontSize(6); doc.setTextColor(90); doc.text('0', x, y + 3.5, { align: 'center' }); doc.text(v.bar + ' m', x + len, y + 3.5, { align: 'center' }); doc.text('1:' + v.scale, x + len + 4, y + 1);
  }

  $('dlSheets').onclick = async () => {
    if (!pdfOk()) return;
    const v = VIEWS[S.under];
    if (v.w) { status('Preparing the survey…'); await gP; if (!G) { status('The survey didn’t load, so the frames will be blank. Open the page from the website, not a saved copy.', true); } }
    const { jsPDF } = window.jspdf, doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a2' }), all = sheets();
    const img = v.w && G ? underlay(S.under, 12).toDataURL('image/png') : null;
    all.forEach((fr, si) => {
      if (si) doc.addPage('a2', 'landscape');
      fr.forEach(f => {
        doc.setDrawColor(40); doc.setLineWidth(0.35); doc.rect(f.x, f.y, f.w, f.h);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(192, 67, 42); doc.text(String(f.n).padStart(2, '0'), f.x + 4, f.y + 8);
        doc.setTextColor(29, 33, 32); doc.text(f.head ? f.head.toUpperCase() : 'HEADING: ____________________', f.x + 14, f.y + 8);
        if (f.q) { doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(110); doc.text(doc.splitTextToSize(f.q, f.w - 18).slice(0, 3), f.x + 14, f.y + 13.5, { lineHeightFactor: 1.25 }); }
        if (img) {
          const r = frameInner(f, v);
          doc.addImage(img, 'PNG', r.x, r.y, r.w, r.h, 'under-' + S.under, 'FAST');
          north(doc, f.x + f.w - 8, f.y + 9, 3.2);
          scaleBar(doc, r.x, Math.min(r.y + r.h + 4, f.y + f.h - 3), v);
        }
      });
      const ty = A2.h - A2.m - A2.tb, tw = A2.w - 2 * A2.m;
      doc.setDrawColor(40); doc.setLineWidth(0.35); doc.rect(A2.m, ty, tw, A2.tb);
      doc.line(A2.m + tw * 0.62, ty, A2.m + tw * 0.62, ty + A2.tb); doc.line(A2.m + tw * 0.86, ty, A2.m + tw * 0.86, ty + A2.tb);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(29, 33, 32);
      doc.text('PARTI DIAGRAMS' + (S.title ? '  ·  ' + S.title.toUpperCase() : ''), A2.m + 5, ty + 8.5);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(90);
      doc.text((S.name || '') + (S.name ? '  ·  ' : '') + 'Project 1, Stage 2: Concept and site strategy  ·  The Waters and the Wild', A2.m + 5, ty + 15);
      doc.text(['Gleniff Barytes Mill, Ballintrillick, Co. Sligo', 'ARCT06004 · ATU Sligo · Department of Architecture'], A2.m + tw * 0.62 + 4, ty + 8);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(29, 33, 32); doc.text('Sheet ' + (si + 1) + ' of ' + all.length, A2.m + tw * 0.86 + 4, ty + 8.5);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(110); doc.text(v.w ? 'Survey: ATU drone lidar, 2025' : 'A2 landscape', A2.m + tw * 0.86 + 4, ty + 14.5);
    });
    doc.save(fileName('parti_sheets_A2'));
    status('Downloaded ' + all.length + ' A2 sheet' + (all.length > 1 ? 's' : '') + '. Print at 100% (actual size) for the scales to be true.');
  };

  $('dlA3').onclick = async () => {
    if (!pdfOk()) return;
    status('Preparing the survey…'); await gP;
    if (!G) { status('The survey didn’t load. Open the page from the website, not a saved copy.', true); return; }
    const v = VIEWS.a3, [pw, ph] = paperMm(v), { jsPDF } = window.jspdf, doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a3' });
    const x0 = (297 - pw) / 2, y0 = (420 - ph) / 2;
    doc.addImage(underlay('a3', 12).toDataURL('image/png'), 'PNG', x0, y0, pw, ph, undefined, 'FAST');
    north(doc, x0 + pw - 6, y0 - 10, 4); scaleBar(doc, x0, y0 + ph + 7, v);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(150); doc.text('TASK A · CONCEPTUAL REIMAGINING OF THE SITE', x0, 24);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text('Gleniff Barytes Mill site underlay, 1:1250, contours every 2 m, index contours every 10 m. Trace or transfer onto your A3 canvas.', x0, 30);
    doc.text((S.name ? S.name + '  ·  ' : '') + 'ARCT06004 · ATU Sligo', x0, 400);
    doc.save(fileName('site_underlay_A3'));
    status('Downloaded the A3 underlay. Print at 100% (actual size).');
  };

  $('sName').value = S.name; $('sTitle').value = S.title; $('sPrompt').checked = S.prompt !== false;
  $('sName').oninput = e => { S.name = e.target.value; save(); drawPreview(); };
  $('sTitle').oninput = e => { S.title = e.target.value; save(); drawPreview(); };
  $('sPrompt').onchange = e => { S.prompt = e.target.checked; save(); drawPreview(); };
  document.querySelectorAll('[data-under]').forEach(b => b.onclick = () => { S.under = b.dataset.under; save(); syncUnder(); drawPreview(); });
  const syncUnder = () => document.querySelectorAll('[data-under]').forEach(b => b.setAttribute('aria-pressed', b.dataset.under === S.under));

  // ---------- architectural intent
  const FIELDS = [
    ['title', 'Title', 'The name of your concept. Short and memorable.', 1],
    ['idea', 'The idea', 'Your concept in one or two sentences. This starts from what you wrote in section 04.', 3],
    ['place', 'Place', 'Where is the pavilion, and why there? How does the idea respond to the landform, the water, the sun, wind and microclimate, the sound, the plants and animals, the history and culture of Gleniff? Which local and global environmental concerns, and which SDGs, does it answer?', 6],
    ['tech', 'Making', 'What are the key parts it is made of, and how do the structure and the details carry the idea? Which materials, and why? How does the section relate to the plan?', 5],
    ['type', 'For children', 'How does it work as a place for children to shelter, play and learn? Which similar projects have you looked at, and what did you take from them?', 4],
    ['end', 'Close', 'Optional: one or two sentences on what a child will remember of the place after a visit.', 2]
  ];
  $('iFields').innerHTML = FIELDS.map(([k, l, h, r]) => '<div class="c2-field"><label class="lbl" for="i_' + k + '">' + esc(l) + '</label><p class="hint">' + esc(h) + '</p>' + (r === 1 ? '<input type="text" id="i_' + k + '" maxlength="80">' : '<textarea id="i_' + k + '" rows="' + r + '"></textarea>') + '</div>').join('');
  const I = S.intent;
  FIELDS.forEach(([k]) => { const el = $('i_' + k); el.value = I[k] || ''; el.oninput = () => { I[k] = el.value; if (k === 'idea') I.ideaTouched = true; save(); count(); }; });
  function syncIdea() { if (!I.ideaTouched) { I.idea = S.idea; $('i_idea').value = S.idea; count(); } }
  if (!I.idea && S.idea) syncIdea();
  const body = () => FIELDS.filter(([k]) => k !== 'title').map(([k]) => (I[k] || '').trim()).filter(Boolean);
  function count() {
    const w = [I.title || '', ...body()].join(' ').trim().split(/\s+/).filter(Boolean).length;
    $('iWords').textContent = w;
    const f = $('iFit'); f.className = w > 450 ? 'over' : '';
    f.textContent = w === 0 ? '' : w < 200 ? 'room to say more' : w <= 450 ? 'fits one A4 page' : 'probably too long for one A4 page';
  }
  $('iPdf').onclick = () => {
    if (!window.jspdf) { alert('The PDF maker didn’t load. Reload the page.'); return; }
    const paras = body(); if (!paras.length && !I.title) { alert('Write something first.'); return; }
    const { jsPDF } = window.jspdf;
    let size = 11, doc, ok = false;
    for (; size >= 8.5; size -= 0.5) {      // shrink a little to keep it on one page
      doc = new jsPDF({ unit: 'mm', format: 'a4' });
      let y = 22;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120);
      doc.text('ARCHITECTURAL INTENT  ·  Project 1, Stage 2  ·  The Waters and the Wild  ·  ARCT06004', 20, y);
      if (S.name) doc.text(S.name, 190, y, { align: 'right' });
      y += 14; doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(29, 33, 32);
      const tl = doc.splitTextToSize(I.title || 'Untitled', 170); doc.text(tl, 20, y); y += tl.length * 8 + 4;
      doc.setFontSize(size);
      paras.forEach((p, i) => {
        doc.setFont('helvetica', i === 0 && I.idea && p === I.idea.trim() ? 'bold' : 'normal');
        const L = doc.splitTextToSize(p, 170); doc.text(L, 20, y, { lineHeightFactor: 1.4 }); y += L.length * size * 0.3528 * 1.4 + size * 0.45;
      });
      if (y < 280) { ok = true; break; }
    }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(140); doc.text('Gleniff Barytes Mill, Ballintrillick, Co. Sligo', 20, 287);
    doc.save(fileName('architectural_intent_A4'));
    if (!ok) alert('Your intent runs past one A4 page even at a smaller size. Cut it down, then download again.');
  };
  $('iTxt').onclick = () => {
    const t = [(I.title || '').trim(), ...body()].filter(Boolean).join('\n\n') + '\n';
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([t], { type: 'text/plain' })); a.download = fileName('architectural_intent').replace(/\.pdf$/, '.txt'); a.click();
  };
  $('iClear').onclick = () => { if (!confirm('Clear everything in your intent? This can’t be undone.')) return; FIELDS.forEach(([k]) => { I[k] = ''; $('i_' + k).value = ''; }); I.ideaTouched = false; save(); count(); };

  // ---------- go
  renderHeads(); verdict(); syncUnder(); count(); drawPreview(); pruneLinks();
  gP.then(drawPreview);
})();
