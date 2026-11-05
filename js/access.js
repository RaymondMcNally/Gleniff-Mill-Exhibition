/* Student access switches. Reads access.json and hides the parts of the site that aren't open yet:
   - locked pages drop out of the menu, their cards and links are hidden, and the page itself shows a notice;
   - locked model formats and scales are hidden on Your model (model.html).
   Edit the switches on admin.html. This paces what students see; it is not a password. Anyone who knows a
   file's address on GitHub can still open it.

   Exempt: the exhibition kiosk and the windows it drives (project.html?out, sections.html?display), any tab the
   kiosk has been opened in this session, and staff view (set on admin.html), which shows locked parts outlined.
   If access.json can't be read the site stays fully open. */
(function () {
  var d = document.documentElement, q = location.search;
  var page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  var ss = function (k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { } };
  var ls = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };

  if (page === 'kiosk.html') { ss('acc-kiosk', '1'); return; }
  if (/[?&](out|display)\b/.test(q) || ss('acc-kiosk') === '1') return;
  if (page === 'admin.html') return;
  if (/[?&]student\b/.test(q)) ss('acc-student', '1');
  if (/[?&]staff\b/.test(q)) ss('acc-student', '');
  var staff = ls('gleniff-access-staff') === '1' && ss('acc-student') !== '1';

  var css = document.createElement('style');
  css.textContent =
    'html.acc-wait main,html.acc-wait header nav{visibility:hidden}' +
    '.acc-off{display:none!important}' +
    '.acc-staff .acc-locked{outline:2px dashed var(--accent,#c0432a);outline-offset:2px;opacity:.6}' +
    '.acc-unlink{color:inherit;text-decoration:none}' +
    '.acc-lock{max-width:640px;margin:12vh auto;padding:0 20px;text-align:left}' +
    '.acc-lock .eyebrow{font:500 12px/1 var(--mono,monospace);letter-spacing:.08em;text-transform:uppercase;color:var(--accent,#c0432a)}' +
    '.acc-lock h1{font-size:clamp(28px,5vw,44px);line-height:1.1;margin:.4em 0 .3em}' +
    '.acc-lock p{color:var(--muted,#5d6562);font-size:18px}' +
    '.acc-lock a.btn{display:inline-block;margin-top:12px;padding:10px 16px;border:1px solid var(--ink,#1d2120);text-decoration:none;font-weight:600}' +
    '.acc-banner{position:fixed;left:12px;bottom:12px;z-index:9999;background:var(--ink,#1d2120);color:var(--bg,#eee);font:500 12px/1.3 var(--mono,monospace);padding:8px 10px;border-radius:4px;max-width:280px}' +
    '.acc-banner a{color:inherit}' +
    '.acc-promo{margin-bottom:28px}' +
    '.acc-promo a{display:flex;align-items:center;gap:16px;border:1px solid var(--ink,#1d2120);background:var(--paper,#f7f8f5);padding:14px 18px;text-decoration:none;color:var(--ink,#1d2120)}' +
    '.acc-promo a:hover{background:var(--ink,#1d2120);color:var(--paper,#f7f8f5)}' +
    '.acc-promo span{font:500 .7rem var(--mono,monospace);letter-spacing:.08em;text-transform:uppercase;color:var(--accent,#c0432a)}' +
    '.acc-promo b{font-size:1.1rem;flex:1}.acc-promo i{font-style:normal;font-size:1.3rem}';
  d.appendChild(css);
  d.classList.add('acc-wait');
  var released = false, release = function () { if (!released) { released = true; d.classList.remove('acc-wait'); } };
  setTimeout(release, 3000);                                          // safety net: never leave the page blank

  var today = (function () { var t = new Date(); return t.getFullYear() + '-' + ('0' + (t.getMonth() + 1)).slice(-2) + '-' + ('0' + t.getDate()).slice(-2); })();
  var fmtDate = function (s) { try { return new Date(s + 'T12:00:00').toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'long' }); } catch (e) { return s; } };

  // Radio-like button groups on Your model: if the chosen one is locked, pick the first open one.
  var GROUPS = [['#oCard', '#oPrint', '#oCnc', '#oHand'], ['#kModel', '#kMould'], ['#kLayers', '#kWaffle', '#kRelief'], ['[data-scale="200"]', '[data-scale="500"]', '[data-scale="100"]', '[data-scale="1000"]']];

  function isOpen(it, byId) {
    var self = it.on || (it.from && today >= it.from);
    if (!self) return false;
    return it.parent && byId[it.parent] ? isOpen(byId[it.parent], byId) : true;
  }

  function apply(cfg) {
    var items = (cfg && cfg.items) || [], byId = {};
    items.forEach(function (it) { byId[it.id] = it; });
    var lockedPages = {}, lockedSel = [];
    items.forEach(function (it) {
      if (isOpen(it, byId)) return;
      (it.pages || []).forEach(function (p) { lockedPages[p.toLowerCase()] = it; });
      if (it.sel) lockedSel.push(it.sel);
    });
    // a parent whose children are all locked is locked too (e.g. Laser cutter with no laser formats open)
    items.forEach(function (it) {
      var kids = items.filter(function (k) { return k.parent === it.id; });
      if (kids.length && it.sel && kids.every(function (k) { return !isOpen(k, byId); })) lockedSel.push(it.sel);
    });
    var mark = staff ? 'acc-locked' : 'acc-off';
    if (staff) d.classList.add('acc-staff');

    // this page itself
    var me = lockedPages[page];
    if (me && !staff) {
      var main = document.querySelector('main');
      var when = me.from ? 'It opens on ' + fmtDate(me.from) + '.' : (me.note || cfg.message || 'It opens later in the project.');
      if (me.from && me.note) when += ' ' + me.note;
      var html = '<div class="acc-lock"><div class="eyebrow">Not open yet</div><h1>' + esc(me.label) + '</h1><p>' + esc(when) + '</p><p>Your tutor will tell you when it’s ready.</p><a class="btn" href="index.html">Back to Start here</a></div>';
      if (main) main.innerHTML = html; else document.body.innerHTML = html;
      document.title = me.label + ' · not open yet';
      document.querySelectorAll('iframe,video,audio').forEach(function (x) { x.remove(); });
    }

    // add-on pages listed only in access.json (e.g. Stage 2, Stage 3): a menu link, and a pointer on Start here.
    // Delete the item from access.json (and its files) and both disappear. menu.after can be a list: the first
    // link found is used, so a later stage still sits in the right place if an earlier one is removed.
    var promos = [];
    items.forEach(function (it) {
      if (!it.pages || !it.pages[0]) return;
      var href = it.pages[0], open = isOpen(it, byId);
      if (!open && !staff) return;
      if (it.menu) document.querySelectorAll('header nav').forEach(function (nav) {
        if (nav.querySelector('a[href="' + href + '"]')) return;
        var a = document.createElement('a'); a.href = href; a.textContent = it.menu.label || it.label;
        var list = [].concat(it.menu.after || []), after = null;
        for (var i = 0; i < list.length && !after; i++) after = nav.querySelector('a[href="' + list[i] + '"]');
        if (after) after.after(a); else nav.appendChild(a);
      });
      if (it.promo && page === (it.promo.page || 'index.html')) promos.push({ it: it, open: open, href: href });
    });
    // one pointer only: the latest open stage (staff with nothing open see the latest, outlined as locked)
    var pr = promos.filter(function (x) { return x.open; }).pop() || (staff ? promos[promos.length - 1] : null);
    var hero = document.querySelector('main .hero');
    if (pr && hero && !document.getElementById('acc-promo-' + pr.it.id)) {
      var p = document.createElement('div'); p.className = 'wrap acc-promo' + (pr.open ? '' : ' acc-locked'); p.id = 'acc-promo-' + pr.it.id;
      p.innerHTML = '<a href="' + pr.href + '"><span>' + esc(pr.it.promo.eyebrow || 'Now open') + '</span><b>' + esc(pr.it.promo.text || pr.it.label) + '</b><i>\u2192</i></a>';
      hero.after(p);
    }

    // links to locked pages
    document.querySelectorAll('a[href]').forEach(function (a) {
      var h = (a.getAttribute('href') || '').split(/[?#]/)[0].split('/').pop().toLowerCase();
      if (!h || !lockedPages[h]) return;
      if (staff) { a.classList.add('acc-locked'); a.title = 'Locked for students'; return; }
      if (a.closest('nav') || /\b(pagecard|playcard|play-hero|card)\b/.test(a.className)) { a.classList.add('acc-off'); return; }
      var s = document.createElement('span'); s.className = 'acc-unlink'; s.innerHTML = a.innerHTML; a.replaceWith(s);
    });
    document.querySelectorAll('iframe[src]').forEach(function (f) {
      var h = f.getAttribute('src').split(/[?#]/)[0].split('/').pop().toLowerCase();
      if (lockedPages[h] && !staff) f.remove();
    });

    // locked controls (model formats, scales)
    lockedSel.forEach(function (sel) { try { document.querySelectorAll(sel).forEach(function (el) { el.classList.add(mark); }); } catch (e) { } });

    if (!staff && lockedSel.length) {
      var fix = function () {
        GROUPS.forEach(function (g) {
          var els = g.map(function (s) { return document.querySelector(s); }).filter(Boolean);
          var cur = els.filter(function (e) { return e.getAttribute('aria-pressed') === 'true'; })[0];
          if (cur && cur.classList.contains('acc-off')) {
            var nxt = els.filter(function (e) { return !e.classList.contains('acc-off'); })[0];
            if (nxt) nxt.click();
          }
        });
        // no format open at all: say so instead of an empty picker
        var outs = document.querySelector('.outsel');
        if (outs && !outs.querySelector('.outbtns button:not(.acc-off)') && !document.getElementById('accNoFmt')) {
          var p = document.createElement('p'); p.id = 'accNoFmt'; p.className = 'small';
          p.textContent = 'No model formats are open yet. Your tutor will open them when you get to model making.';
          outs.appendChild(p);
          document.querySelectorAll('button[id^="dl"]').forEach(function (b) { b.classList.add('acc-off'); });
        }
      };
      fix(); var n = 0, iv = setInterval(function () { fix(); if (++n > 30) clearInterval(iv); }, 500);   // the model page builds itself after loading the survey
    }

    if (staff) {
      var b = document.createElement('div'); b.className = 'acc-banner';
      b.innerHTML = (me ? '<b>This page is locked for students.</b> ' : '') + 'Staff view: parts locked for students are outlined. <a href="?student">See it as a student</a> · <a href="admin.html">Admin</a>';
      document.body.appendChild(b);
    }
    release();
  }

  function esc(s) { return String(s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var cfgP = fetch('access.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { if (!r.ok) throw 0; return r.json(); });
  var ready = new Promise(function (res) { if (document.readyState !== 'loading') res(); else document.addEventListener('DOMContentLoaded', res); });
  Promise.all([cfgP, ready]).then(function (v) { apply(v[0]); }).catch(function () { ready.then(release); });
})();
