(function () {
  'use strict';
  document.querySelectorAll('[data-compare]').forEach(box => {
    const r = box.querySelector('input'), set = () => box.style.setProperty('--pos', r.value + '%');
    r.addEventListener('input', set); set();
  });
  const TABS = {
    rgb: ['pc_rgb.jpg', 'Point cloud coloured by photo colour', 'Each point takes its colour from the survey photographs taken at the same moment. This is the closest to what you\'d see.'],
    intensity: ['pc_intensity.jpg', 'Point cloud coloured by intensity', 'Intensity is how strongly each pulse bounced back. Tarmac, grass, leaves, stone and water reflect laser light differently, so the road and paths stand out even under shade.'],
    elevation: ['pc_elevation.jpg', 'Point cloud coloured by elevation', 'Coloured by height: blue low, red high. Here the trees show up as bumps above the ground around them.'],
    class: ['pc_class.jpg', 'Point cloud coloured by classification', 'After classification: points the software decided are ground (orange) and points that are not ground (white and grey), mostly trees.'],
    overlap: ['r_overlap.jpg', 'Map of survey coverage', 'Coverage: how many times each part of the site was recorded, from once (red) to more than ten times (purple). The edges and ends of the flight lines are covered least.']
  };
  const img = document.getElementById('tabImg'), cap = document.getElementById('tabCap');
  if (!img) return;
  const tabs = document.querySelectorAll('[data-tab]');
  tabs.forEach(t => t.addEventListener('click', () => {
    const [f, alt, c] = TABS[t.dataset.tab];
    img.src = 'img/lidar/' + f; img.alt = alt; cap.textContent = c;
    tabs.forEach(x => x.setAttribute('aria-selected', x === t));
  }));
  Object.values(TABS).forEach(([f]) => { const i = new Image(); i.src = 'img/lidar/' + f; });
})();
