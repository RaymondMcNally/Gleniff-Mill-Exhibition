(async function () {
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const pad = n => String(n).padStart(2, '0');

  let data;
  try { data = await (await fetch('data/model.json')).json(); }
  catch (e) {
    document.getElementById('stage').insertAdjacentHTML('beforeend',
      '<p style="position:absolute;inset:auto 16px 40px;font:.85rem var(--mono)">The 3D guide needs the site to be served over http (GitHub Pages or a local server), not opened as a file.</p>');
    return;
  }
  const M = data.meta, NL = data.layers.length, T = M.layer_mm, BT = 12;
  const [W, H] = [M.bounds[1][0] - M.bounds[0][0], M.bounds[1][1] - M.bounds[0][1]];

  // ---- sheet cards
  const grid = document.getElementById('sheets');
  const counts = {};
  data.pieces.forEach(p => counts[p.sheet] = (counts[p.sheet] || 0) + 1);
  for (let s = 1; s <= M.sheets; s++) {
    const n = pad(s);
    grid.insertAdjacentHTML('beforeend',
      `<div class="sheet"><img src="img/sheets/sheet_${n}.png" alt="Layout of laser sheet ${n}" loading="lazy">
       <div class="meta"><span><b>Sheet ${n}</b> <em>${counts[s]} pcs</em></span><span><a href="downloads/sheets/sheet_${n}.dxf" download>DXF</a> · <a href="downloads/sheets/sheet_${n}.svg" download>SVG</a></span></div></div>`);
  }

  // ---- scene
  const stage = document.getElementById('stage'), canvas = document.getElementById('c'), tip = document.getElementById('tip');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(32, 1, 10, 40000);
  const ctl = new THREE.OrbitControls(cam, canvas);
  ctl.enableDamping = true; ctl.maxPolarAngle = Math.PI * 0.495;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f88, 0.6));
  const sun = new THREE.DirectionalLight(0xfff6ea, 0.75);
  sun.position.set(-900, 1400, 700); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -1200, right: 1200, top: 1000, bottom: -1000, near: 100, far: 4000 });
  sun.shadow.bias = -0.0004; scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffffff, 0.25); fill.position.set(900, 500, -800); scene.add(fill);

  // plan x -> X, plan y -> -Z, height -> Y, centred on the footprint
  const model = new THREE.Group(); model.position.set(-W / 2, 0, H / 2); scene.add(model);
  const board = new THREE.Mesh(new THREE.BoxGeometry(M.base_mm[0], BT, M.base_mm[1]),
    new THREE.MeshStandardMaterial({ color: 0xa98d6c, roughness: 0.9 }));
  board.position.set(W / 2, -BT / 2, -H / 2); board.receiveShadow = board.castShadow = true; model.add(board);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.ShadowMaterial({ opacity: 0.16 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -BT; ground.receiveShadow = true; scene.add(ground);

  const shapes = polys => polys.map(rs => {
    const s = new THREE.Shape(rs[0].map(p => new THREE.Vector2(p[0], p[1])));
    for (let h = 1; h < rs.length; h++) s.holes.push(new THREE.Path(rs[h].map(p => new THREE.Vector2(p[0], p[1]))));
    return s;
  });
  const extrude = (polys, k) => {
    const g = new THREE.ExtrudeGeometry(shapes(polys), { depth: T, bevelEnabled: false, curveSegments: 1 });
    g.rotateX(-Math.PI / 2); g.translate(0, k * T, 0); return g;
  };
  const C = { cap: new THREE.Color(0xa2a49f), side: new THREE.Color(0x7d7f7a), now: new THREE.Color(css('--cut') || '#c0432a'), hi: new THREE.Color(0xf2b134) };
  const mat = (c) => new THREE.MeshStandardMaterial({ color: c.clone(), roughness: 0.95 });

  // finished-look solids per layer
  const solids = data.layers.map((L, k) => {
    const m = new THREE.Mesh(extrude(L.full, k), [mat(C.cap), mat(C.side)]);
    m.castShadow = m.receiveShadow = true; m.visible = false; model.add(m); return m;
  });
  // actual cut pieces
  const pieces = data.pieces.map(p => {
    const m = new THREE.Mesh(extrude(p.poly, p.layer - 1), [mat(C.cap), mat(C.side)]);
    m.castShadow = m.receiveShadow = true; m.userData = p; model.add(m); return m;
  });

  // ---- state
  let cur = 1, solid = false, finished = false, hover = null, picked = null;
  const el = id => document.getElementById(id);
  function paint(m) {
    const p = m.userData, isNow = !finished && p.layer === cur, isHi = m === hover || m === picked;
    const c = isHi ? C.hi : isNow ? C.now : C.cap;
    m.material[0].color.copy(c); m.material[1].color.copy(isHi || isNow ? c.clone().multiplyScalar(0.75) : C.side);
  }
  function apply() {
    const top = finished ? NL : cur;
    solids.forEach((m, k) => m.visible = solid && (k + 1) < top);
    pieces.forEach(m => { const L = m.userData.layer; m.visible = L <= top && (!solid || L === top); paint(m); });
    if (solid) solids.forEach((m, k) => { if (k + 1 === top) m.visible = false; });
    el('layNum').firstChild.nodeValue = finished ? 'All' : pad(cur);
    el('layM').textContent = finished ? `${NL} layers` : `+${data.layers[cur - 1].m} m`;
    el('ht').textContent = `${top * T} mm`;
    el('lay').value = cur;
    const list = finished ? [] : pieces.filter(m => m.userData.layer === cur).sort((a, b) => a.userData.sheet - b.userData.sheet || a.userData.id.localeCompare(b.userData.id));
    el('pcount').textContent = finished ? 'Model complete' : `${list.length} pieces on layer ${pad(cur)}`;
    el('plist').innerHTML = list.map((m, i) => `<li data-i="${pieces.indexOf(m)}" class="${m === picked ? 'on' : ''}" tabindex="0"><span>${m.userData.id}</span><span>sheet ${pad(m.userData.sheet)}</span></li>`).join('');
    el('all').setAttribute('aria-pressed', finished);
  }
  const go = n => { finished = false; picked = null; cur = Math.max(1, Math.min(NL, n)); apply(); };
  el('lay').addEventListener('input', e => go(+e.target.value));
  el('prev').onclick = () => go(cur - 1);
  el('next').onclick = () => go(cur + 1);
  el('all').onclick = () => { finished = !finished; picked = null; apply(); };
  el('mode').onclick = e => { solid = !solid; e.target.setAttribute('aria-pressed', solid); apply(); };
  const pickList = li => { if (!li) return; picked = pieces[+li.dataset.i]; apply(); };
  el('plist').addEventListener('click', e => pickList(e.target.closest('li')));
  el('plist').addEventListener('keydown', e => { if (e.key === 'Enter') pickList(e.target.closest('li')); });
  let timer = null;
  el('play').onclick = e => {
    if (timer) { clearInterval(timer); timer = null; e.target.textContent = 'Play build'; return; }
    go(1); e.target.textContent = 'Stop';
    const fast = matchMedia('(prefers-reduced-motion: reduce)').matches;
    timer = setInterval(() => {
      if (cur >= NL) { clearInterval(timer); timer = null; e.target.textContent = 'Play build'; finished = true; apply(); return; }
      go(cur + 1);
    }, fast ? 30 : 260);
  };

  // ---- views
  const views = { aerial: [[-0.55, 0.62, 0.56], [0, 40, 0], 1.0, 32], plan: [[0, 1, 0.0001], [0, 0, 0], 0.92, 6], low: [[-0.78, 0.17, 0.6], [0, 80, 0], 0.85, 32] };
  let view = 'aerial', userMoved = false;
  function setView(v) {
    view = v; const [d, t, f, fov] = views[v];
    cam.fov = fov; cam.updateProjectionMatrix();
    const vf = THREE.MathUtils.degToRad(fov) / 2, hf = Math.atan(Math.tan(vf) * cam.aspect);
    const dist = f * 1050 / Math.sin(Math.min(vf, hf)) * 1.05;
    cam.position.copy(new THREE.Vector3(...d).normalize().multiplyScalar(dist)).add(new THREE.Vector3(...t));
    ctl.target.set(...t); ctl.update();
    document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', b.dataset.view === v));
  }
  document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { userMoved = false; setView(b.dataset.view); });
  ctl.addEventListener('start', () => userMoved = true);

  // ---- hover / tap
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function hit(ev) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    const h = ray.intersectObjects(pieces.filter(m => m.visible), false)[0];
    return h ? h.object : null;
  }
  canvas.addEventListener('pointermove', ev => {
    const m = hit(ev); if (m !== hover) { const old = hover; hover = m; if (old) paint(old); if (m) paint(m); }
    if (m) {
      const p = m.userData, r = stage.getBoundingClientRect();
      tip.textContent = `${p.id} · layer ${pad(p.layer)} (+${data.layers[p.layer - 1].m} m) · sheet ${pad(p.sheet)}`;
      tip.style.left = Math.min(ev.clientX - r.left + 12, r.width - 260) + 'px'; tip.style.top = (ev.clientY - r.top + 12) + 'px';
      tip.hidden = false;
    } else tip.hidden = true;
  });
  canvas.addEventListener('pointerleave', () => { tip.hidden = true; if (hover) { const o = hover; hover = null; paint(o); } });
  canvas.addEventListener('click', ev => { const m = hit(ev); if (m && !finished) { go(m.userData.layer); picked = m; apply(); } });

  // ---- theme + size
  const bg = () => { scene.background = new THREE.Color(css('--stage') || '#dfe2dc'); C.now.set(css('--cut') || '#c0432a'); apply(); };
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', bg);
  new MutationObserver(bg).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  function resize() {
    const r = stage.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false); cam.aspect = r.width / Math.max(r.height, 1); cam.updateProjectionMatrix();
    if (!userMoved) setView(view);
  }
  new ResizeObserver(resize).observe(stage);
  bg(); resize(); setView('aerial'); apply();
  (function loop() { ctl.update(); renderer.render(scene, cam); requestAnimationFrame(loop); })();
})();
