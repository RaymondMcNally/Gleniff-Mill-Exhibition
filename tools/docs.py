import pickle, sys, os, json
import numpy as np, ezdxf
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages
from matplotlib.patches import PathPatch
from matplotlib.path import Path
from shapely import affinity
from shapely.geometry import Polygon

W = sys.argv[1]; OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
d = pickle.load(open(f'{W}/state.pkl', 'rb'))
L, P = d['layers'], d['pieces']
DATUM = 103.86  # levels shown relative: 0 m is the lowest ground of the survey (STL z 519.3 mm)
for l in L: l['real'] = l['real'] - DATUM
(x0, y0, _), (x1, y1, _) = d['bounds']

def polys(g):
    if g is None or g.is_empty: return []
    return [q for q in (g.geoms if hasattr(g, 'geoms') else [g]) if isinstance(q, Polygon)]
def patch(g, **kw):
    verts, codes = [], []
    for q in polys(g):
        for r in [q.exterior, *q.interiors]:
            c = np.asarray(r.coords)[:, :2]; verts += c.tolist(); codes += [Path.MOVETO] + [Path.LINETO] * (len(c) - 2) + [Path.CLOSEPOLY]
    return PathPatch(Path(verts, codes), **kw) if verts else None
def rings(g):
    for q in polys(g):
        for r in [q.exterior, *q.interiors]: yield np.asarray(r.coords)[:, :2]

# ---------- contour plan DXF at 1:200 (true size, mm) with 3D elevations
doc = ezdxf.new('R2010'); doc.units = ezdxf.units.MM; msp = doc.modelspace()
doc.layers.add('CONTOUR_1m', color=8); doc.layers.add('CONTOUR_5m_INDEX', color=1); doc.layers.add('LABELS', color=7)
for l in L:
    idx = round(l['real']) % 5 == 0
    for r in rings(l['geom']):
        pl = msp.add_lwpolyline(r.tolist(), close=True, dxfattribs={'layer': 'CONTOUR_5m_INDEX' if idx else 'CONTOUR_1m'})
        pl.dxf.elevation = l['z']
    if idx:
        q = max(polys(l['geom']), key=lambda q: q.area)
        c = np.asarray(q.exterior.coords); pt = c[len(c) // 3]
        msp.add_text(f"{l['real']:.0f}", height=6, dxfattribs={'layer': 'LABELS', 'insert': (pt[0], pt[1])})
doc.saveas(f'{OUT}/contour_plan_1-200.dxf')

nl = len(L)
cmap = plt.get_cmap('Greys')
with PdfPages(f'{OUT}/Gleniff_Mill_site_model_guide.pdf') as pdf:
    # --- page 1: contour plan
    fig, ax = plt.subplots(figsize=(16.54, 11.69))
    for l in L:
        idx = round(l['real']) % 5 == 0
        for r in rings(l['geom']):
            ax.plot(r[:, 0], r[:, 1], color='k' if idx else '#888', lw=0.9 if idx else 0.35)
        if idx:
            q = max(polys(l['geom']), key=lambda q: q.area); c = np.asarray(q.exterior.coords)
            # label at a point not on the outer boundary
            pts = [p for p in c if x0 + 15 < p[0] < x1 - 15 and y0 + 15 < p[1] < y1 - 15]
            if pts:
                p = pts[len(pts) // 2]
                ax.text(p[0], p[1], f"{l['real']:.0f}", fontsize=7, ha='center', va='center', backgroundcolor='white')
    nx, ny = d['grid']
    ax.set_aspect('equal'); ax.set_xticks([]); ax.set_yticks([])
    for s in ax.spines.values(): s.set_visible(False)
    ax.set_title(f"Gleniff Mill site — contour plan, 1 m interval (bold every 5 m)  ·  +{L[0]['real']:.0f} to +{L[-1]['real']:.0f} m  ·  model {x1 - x0:.0f} × {y1 - y0:.0f} mm at 1:200\n"
                 "Levels relative to the site datum: 0 m is the lowest ground of the survey (ATU drone lidar, Oct 2025)", fontsize=11, loc='left')
    ax.plot([x0 + 20, x0 + 120], [y0 - 25, y0 - 25], 'k', lw=3); ax.text(x0 + 70, y0 - 40, '20 m', ha='center', fontsize=8)
    pdf.savefig(fig); plt.close(fig)

    # --- assembly pages: 6 layers per page
    per = 6
    for start in range(0, nl, per):
        fig, axs = plt.subplots(3, 2, figsize=(16.54, 11.69)); axs = axs.ravel()
        for k, ax in enumerate(axs):
            j = start + k
            ax.set_aspect('equal'); ax.set_xticks([]); ax.set_yticks([])
            ax.set_xlim(x0 - 10, x1 + 10); ax.set_ylim(y0 - 10, y1 + 10)
            if j >= nl: ax.axis('off'); continue
            l = L[j]
            if j > 0:
                pt = patch(L[j - 1]['geom'], facecolor='#eeeeee', edgecolor='#bbbbbb', lw=0.3); ax.add_patch(pt)
            for p in [p for p in P if p['layer'] == l['i']]:
                ax.add_patch(patch(p['poly'], facecolor='#c9a66b', edgecolor='k', lw=0.4, alpha=0.9))
                c = p['poly'].representative_point()
                ax.text(c.x, c.y, f"{p['id']}\ns{p['sheet'] + 1}", fontsize=4.5, ha='center', va='center')
            ax.set_title(f"Layer {l['i']:02d}  ·  contour +{l['real']:.0f} m  ·  grey = layer below", fontsize=9, loc='left')
        fig.suptitle("Assembly order — each label is piece ID / sheet number. Glue each layer so its outer edge sits on the blue engraved line of the layer below.", fontsize=10)
        fig.tight_layout(rect=(0, 0, 1, 0.97)); pdf.savefig(fig); plt.close(fig)

    # --- sheet layouts
    for s in range(d['nsheets']):
        fig, ax = plt.subplots(figsize=(16.54, 11.69))
        ax.add_patch(plt.Rectangle((0, 0), 841, 594, fill=False, ec='#999', lw=0.5))
        for p in [p for p in P if p['sheet'] == s]:
            g = affinity.translate(affinity.rotate(p['poly'], p['ang'], origin=(0, 0)), p['dx'], p['dy'])
            ax.add_patch(patch(g, facecolor='#e8e2d6', edgecolor='r', lw=0.4))
            c = g.representative_point(); ax.text(c.x, c.y, p['id'], fontsize=6, ha='center', va='center')
        ax.set_xlim(-5, 846); ax.set_ylim(-5, 599); ax.set_aspect('equal'); ax.set_xticks([]); ax.set_yticks([])
        ax.set_title(f"Sheet {s + 1:02d} of {d['nsheets']}  (A1 841 × 594 mm)", loc='left')
        pdf.savefig(fig); plt.close(fig)
print('ok')
