"""Contour site-model generator: slice STL at fixed interval, tile, hollow, true-shape nest onto sheets."""
import sys, os, json, pickle
from collections import defaultdict
import numpy as np, trimesh
from shapely.geometry import Polygon, box
from shapely.ops import unary_union, polylabel
from shapely import affinity
from matplotlib.textpath import TextPath
from matplotlib.font_manager import FontProperties
from PIL import Image, ImageDraw
from scipy.signal import fftconvolve
import ezdxf

SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
SCALE = 200                 # 1:200, file units = model mm
STEP = 5.0                  # 1 m real = 5 mm at 1:200
SHEET_W, SHEET_H = 841.0, 594.0   # A1
MARGIN = 8.0
GAP = 3.0                   # spacing between parts
OVERLAP = float(os.environ.get("OVERLAP", 20))  # glue rim under next layer; 0 = solid layers
NX, NY = 3, 3
MIN_AREA = 6.0
SIMPLIFY = 0.1
RES = 1.5                   # nesting raster mm/px

m = trimesh.load(SRC)
zmin, zmax = m.bounds[:, 2]
# Z0 = STL height (mm) of the site datum, 0 m. Default: the lowest ground of the mesh, read from the up-facing
# surface so a flat base under the terrain is ignored. Layers start one interval above it.
Z0 = float(os.environ['Z0']) if 'Z0' in os.environ else None
if Z0 is None:
    up = m.faces[m.face_normals[:, 2] > 0.05]
    Z0 = float(m.vertices[np.unique(up)][:, 2].min())
levels = list(np.arange(Z0 + STEP, zmax, STEP))

def slice_at(z):
    p, _ = m.section(plane_origin=[0, 0, z], plane_normal=[0, 0, 1]).to_2D(to_2D=np.eye(4))
    return unary_union([g.buffer(0) for g in p.polygons_full]).simplify(SIMPLIFY, preserve_topology=True).buffer(0)

def parts(g):
    if g is None or g.is_empty: return []
    gs = list(g.geoms) if hasattr(g, 'geoms') else [g]
    return [x for x in gs if isinstance(x, Polygon) and x.area >= MIN_AREA]

_F = slice_at(zmin + 0.1)
_q = max(_F.geoms, key=lambda q: q.area) if hasattr(_F, 'geoms') else _F
FOOT = Polygon(_q.exterior).simplify(3.5, preserve_topology=True).buffer(0)
EDGE = FOOT.difference(FOOT.buffer(-6))
def clean(g):
    # trim the STL's stair-stepped side walls to a smooth outline; drop sub-1.5 mm slivers
    g = g.union(g.buffer(2.5, join_style=1).intersection(EDGE)).intersection(FOOT)
    return g.buffer(-0.75, join_style=1).buffer(0.75, join_style=1).simplify(0.05).buffer(0)

layers = []
for i, z in enumerate(levels, start=1):
    layers.append(dict(i=i, z=float(z), real=z * SCALE / 1000.0, geom=clean(slice_at(z))))
N = len(layers)
for k, L in enumerate(layers):
    above = layers[k + 1]['geom'] if k + 1 < N else None
    L['above'] = above
    L['cut'] = L['geom'] if (above is None or OVERLAP <= 0) else L['geom'].difference(above.buffer(-OVERLAP)).buffer(-0.5).buffer(0.5)

# --- staggered tiling grid so joints don't line up in consecutive layers
X0, Y0, X1, Y1 = *m.bounds[0][:2], *m.bounds[1][:2]
cx, cy = (X1 - X0) / NX, (Y1 - Y0) / NY
def grid(odd):
    xs = [X0 + k * cx + (cx / 2 if odd else 0) for k in range(0 if odd else 1, NX)]
    ys = [Y0 + k * cy + (cy / 2 if odd else 0) for k in range(0 if odd else 1, NY)]
    xs = [X0 - 1] + xs + [X1 + 1]; ys = [Y0 - 1] + ys + [Y1 + 1]
    return [(chr(65 + b) + str(a + 1), box(xs[a], ys[b], xs[a + 1], ys[b + 1]))
            for b in range(len(ys) - 1) for a in range(len(xs) - 1)]

fp = FontProperties(family='DejaVu Sans', weight='bold')
def text_polys(s, size):
    return [np.asarray(p) for p in TextPath((0, 0), s, size=size, prop=fp).to_polygons() if len(p) > 2]

pieces = []
for L in layers:
    cnt = defaultdict(int)
    for cid, cell in grid(L['i'] % 2 == 0):
        for p in parts(L['cut'].intersection(cell)):
            cnt[cid] += 1
            pieces.append(dict(layer=L['i'], cell=cid, k=cnt[cid], real=L['real'], poly=p, above=L['above']))
tot = defaultdict(int)
for pc in pieces: tot[(pc['layer'], pc['cell'])] += 1
for pc in pieces:
    pc['id'] = f"{pc['layer']:02d}{pc['cell']}" + (f".{pc['k']}" if tot[(pc['layer'], pc['cell'])] > 1 else "")

# --- raster true-shape nesting (pieces can sit inside holes of other pieces)
GW, GH = int((SHEET_W - 2 * MARGIN) / RES), int((SHEET_H - 2 * MARGIN) / RES)
def raster(g):
    b = g.bounds
    w, h = int(np.ceil((b[2] - b[0]) / RES)) + 1, int(np.ceil((b[3] - b[1]) / RES)) + 1
    im = Image.new('L', (w, h), 0); d = ImageDraw.Draw(im)
    gs = list(g.geoms) if hasattr(g, 'geoms') else [g]
    for q in gs:
        d.polygon([((x - b[0]) / RES, (y - b[1]) / RES) for x, y in q.exterior.coords], fill=1)
    for q in gs:
        for r in q.interiors:
            d.polygon([((x - b[0]) / RES, (y - b[1]) / RES) for x, y in r.coords], fill=0)
    return np.array(im, dtype=np.float32)

sheets = []   # occupancy arrays
def mrr_angle(p):
    c = list(p.minimum_rotated_rectangle.exterior.coords)
    return -np.degrees(np.arctan2(c[1][1] - c[0][1], c[1][0] - c[0][0]))

pieces.sort(key=lambda p: -(p['poly'].bounds[2] - p['poly'].bounds[0]) * (p['poly'].bounds[3] - p['poly'].bounds[1]))
for n, pc in enumerate(pieces):
    cands = []
    for base in sorted({0.0, round(mrr_angle(pc['poly']), 3)}):
        for r in (0, 90, 180, 270):
            ang = base + r
            g = affinity.rotate(pc['poly'], ang, origin=(0, 0))
            b = g.bounds
            if b[2] - b[0] > GW * RES - 2 or b[3] - b[1] > GH * RES - 2: continue
            M = raster(g.buffer(GAP / 2 + RES * 0.75, join_style=2))
            if M.shape[0] <= GH and M.shape[1] <= GW: cands.append((ang, g, M))
    if not cands: raise SystemExit(f"piece too big: {pc['id']}")
    done = False
    for si, occ in enumerate(sheets):
        best = None
        for ang, g, M in cands:
            if M.shape[0] > occ.shape[0] or M.shape[1] > occ.shape[1]: continue
            ov = fftconvolve(occ, M[::-1, ::-1], mode='valid')
            ys, xs = np.nonzero(ov < 0.5)
            if len(ys) == 0: continue
            j = np.argmin(xs * 4 + ys)          # pack to the left, then bottom
            sc = xs[j] * 4 + ys[j] + 0.5 * M.shape[1]
            if best is None or sc < best[0]: best = (sc, ang, g, M, xs[j], ys[j])
        if best:
            _, ang, g, M, x, y = best
            occ[y:y + M.shape[0], x:x + M.shape[1]] += M; done = True; break
    if not done:
        occ = np.zeros((GH, GW), np.float32); sheets.append(occ); si = len(sheets) - 1
        ang, g, M = min(cands, key=lambda c: c[2].shape[1])
        x, y = 0, 0; occ[:M.shape[0], :M.shape[1]] += M
    b = g.buffer(GAP / 2 + RES * 0.75, join_style=2).bounds
    pc.update(sheet=si, ang=ang, dx=MARGIN + x * RES - b[0], dy=MARGIN + y * RES - b[1])
print("sheets", len(sheets), "pieces", len(pieces))

def place(pc, geom):
    return affinity.translate(affinity.rotate(geom, pc['ang'], origin=(0, 0)), pc['dx'], pc['dy'])

def rings(g):
    out = []
    if g is None or g.is_empty: return out
    for x in (g.geoms if hasattr(g, 'geoms') else [g]):
        if isinstance(x, Polygon):
            out.append(np.asarray(x.exterior.coords)); out += [np.asarray(r.coords) for r in x.interiors]
        elif x.geom_type in ('LineString', 'LinearRing'):
            out.append(np.asarray(x.coords))
        elif hasattr(x, 'geoms'):
            out += rings(x)
    return out

def label_for(pc):
    """engraved ID, preferably on the strip that the next layer covers (so it is hidden)"""
    P = place(pc, pc['poly'])
    txt = pc['id']
    regions = []
    if pc['above'] is not None:
        regions.append(place(pc, pc['poly'].intersection(pc['above']).buffer(-1.0)))
    regions.append(P.buffer(-1.0))
    for reg in regions:
        if reg.is_empty: continue
        big = max(reg.geoms, key=lambda q: q.area) if hasattr(reg, 'geoms') else reg
        if not isinstance(big, Polygon) or big.area < 4: continue
        pt = polylabel(big, tolerance=0.5)
        for size in (8, 6, 5, 4, 3.2, 2.6):
            tp = text_polys(txt, size); a = np.vstack(tp)
            w, h = a[:, 0].max(), a[:, 1].max()
            for rot in (0, 90):
                ww, hh = (w, h) if rot == 0 else (h, w)
                if big.contains(box(pt.x - ww / 2, pt.y - hh / 2, pt.x + ww / 2, pt.y + hh / 2)):
                    out = []
                    for t in tp:
                        t = t - [w / 2, h / 2]
                        if rot: t = t[:, ::-1] * [-1, 1]
                        out.append(t + [pt.x, pt.y])
                    return out
    return []

summary = []
for si in range(len(sheets)):
    name = f"sheet_{si + 1:02d}"
    items = [p for p in pieces if p['sheet'] == si]
    doc = ezdxf.new('R2010'); doc.units = ezdxf.units.MM
    msp = doc.modelspace()
    for nm, col in (('CUT', 1), ('ENGRAVE', 5), ('SHEET_EDGE_DO_NOT_CUT', 8)): doc.layers.add(nm, color=col)
    msp.add_lwpolyline([(0, 0), (SHEET_W, 0), (SHEET_W, SHEET_H), (0, SHEET_H)], close=True, dxfattribs={'layer': 'SHEET_EDGE_DO_NOT_CUT'})
    svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{SHEET_W}mm" height="{SHEET_H}mm" viewBox="0 0 {SHEET_W} {SHEET_H}">']
    def P(a): return 'M' + ' L'.join(f"{x:.3f},{SHEET_H - y:.3f}" for x, y in a[:, :2])
    cut, eng = [], []
    for pc in items:
        G = place(pc, pc['poly'])
        for r in rings(G): cut.append((r, True))
        if pc['above'] is not None:
            e = pc['above'].boundary.intersection(pc['poly']).difference(pc['poly'].boundary.buffer(0.3))
            for r in rings(place(pc, e)):
                if len(r) > 1: eng.append((r, False))
        for t in label_for(pc): eng.append((t, True))
        summary.append(dict(piece=pc['id'], layer=pc['layer'], contour_m=round(pc['real'], 1), sheet=si + 1))
    # engrave first, cut last
    for col, lay, items_ in (('#0000ff', 'ENGRAVE', eng), ('#ff0000', 'CUT', cut)):
        for r, closed in items_:
            msp.add_lwpolyline(r[:, :2].tolist(), close=closed, dxfattribs={'layer': lay})
            svg.append(f'<path d="{P(r)}{" Z" if closed else ""}" fill="none" stroke="{col}" stroke-width="0.1"/>')
    svg.append('</svg>')
    doc.saveas(f"{OUT}/{name}.dxf")
    open(f"{OUT}/{name}.svg", 'w').write('\n'.join(svg))

pickle.dump(dict(layers=[{k: L[k] for k in ('i', 'z', 'real', 'geom', 'cut')} for L in layers],
                 pieces=[{k: p[k] for k in ('id', 'layer', 'cell', 'real', 'poly', 'sheet', 'ang', 'dx', 'dy')} for p in pieces],
                 nsheets=len(sheets), bounds=m.bounds.tolist(), grid=(NX, NY), overlap=OVERLAP),
            open(os.path.join(OUT, '..', 'state.pkl'), 'wb'))
json.dump(summary, open(os.path.join(OUT, '..', 'summary.json'), 'w'))
