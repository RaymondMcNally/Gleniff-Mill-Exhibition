"""Trees on the site: 1:200 tree template on A3 tiles (plus a 1:200 DXF of the tree positions).

Linework (survey edge, contours, water, road, mill, 25 m grid) is read from the 1:500 tree DXF and
scaled x2.5; trees come from data/trees.json. Run from the repo root:
    python3 tools/trees_a3_1-200.py
Writes downloads/trees/Gleniff_Trees_1-200_A3_tiles.pdf and downloads/trees/Gleniff_Trees_1-200.dxf
"""
import json, math
import ezdxf
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from shapely.geometry import Polygon, box

pdfmetrics.registerFont(TTFont('Sans', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('SansB', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
pdfmetrics.registerFont(TTFont('Mono', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'))

SRC = 'downloads/trees/Gleniff_Trees_1-500.dxf'
OUT_PDF = 'downloads/trees/Gleniff_Trees_1-200_A3_tiles.pdf'
OUT_DXF = 'downloads/trees/Gleniff_Trees_1-200.dxf'
K = 2.5            # 1:500 mm -> 1:200 mm
M = 5.0            # metres -> 1:200 mm
SQ = 25 * M        # 25 m reference square = 125 mm at 1:200

# ---------- read linework (1:500 mm) and scale to 1:200 mm
src = ezdxf.readfile(SRC).modelspace()
def plines(layer):
    return [([(x * K, y * K) for x, y in e.get_points('xy')], e.closed) for e in src.query(f'LWPOLYLINE[layer=="{layer}"]')]
frame = plines('FRAME')[0][0]
W, H = max(p[0] for p in frame), max(p[1] for p in frame)       # 1688 x 1207 mm
edge = plines('SURVEY_EDGE')[0][0]
edge_poly = Polygon(edge).buffer(0)
contours, water, road, mill = plines('CONTOURS_2M'), plines('WATER'), plines('ROAD'), plines('MILL')

data = json.load(open('data/trees.json'))
BANDS = [(3, 6, 'Small', 0.929), (6, 10, 'Medium', 0.839), (10, 15, 'Large', 0.722), (15, 99, 'Very large', 0.6)]
def grey(h):
    for lo, hi, _, g in BANDS:
        if lo <= h < hi: return g
    return BANDS[-1][3]
T = [dict(id=r[0], x=r[1] * M, y=r[2] * M, h=r[3], r=r[4] / 2 * M, check=bool(r[6])) for r in data['trees']]
T.sort(key=lambda t: -t['r'])          # big crowns first so small ones sit on top

# ---------- tiles: A3 landscape, drawing frame FW x FH, 5 x 5 overlapping, empty tiles dropped
PW, PH = 420, 297
FX, FY, FW, FH = 22, 24, 376, 253      # frame on the sheet (mm from bottom-left)
NC = math.ceil((W - FW) / (FW - 30)) + 1
NR = math.ceil((H - FH) / (FH - 12)) + 1
SX = (W - FW) / (NC - 1); SY = (H - FH) / (NR - 1)
tiles = []
for row in range(NR):                  # row 0 = north
    for col in range(NC):
        x0, y0 = col * SX, H - FH - row * SY
        if edge_poly.intersection(box(x0, y0, x0 + FW, y0 + FH)).area > 400:
            tiles.append((row, col, x0, y0))
N = len(tiles)

def path(c, pts, closed, tx):
    p = c.beginPath(); p.moveTo(*tx(pts[0]))
    for q in pts[1:]: p.lineTo(*tx(q))
    if closed: p.close()
    return p

def bb(pts):
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)
CB = [bb(p) for p, _ in contours]

def site(c, tx, s, labels=True, lw=1.0, view=None):
    """Draw the site through transform tx (model mm -> pt); s = pt per model mm; view = (x0,y0,x1,y1) to cull."""
    vx0, vy0, vx1, vy1 = view or (-1e9, -1e9, 1e9, 1e9)
    seen = lambda a: a[2] >= vx0 and a[0] <= vx1 and a[3] >= vy0 and a[1] <= vy1
    TT = [t for t in T if seen((t['x'] - t['r'], t['y'] - t['r'], t['x'] + t['r'], t['y'] + t['r']))]
    c.setDash(); c.setLineCap(1); c.setLineJoin(1)
    c.setStrokeGray(0.72); c.setLineWidth(0.35 * lw)
    for (pts, cl), b in zip(contours, CB):
        if seen(b): c.drawPath(path(c, pts, cl, tx), stroke=1, fill=0)
    c.setStrokeGray(0.6); c.setLineWidth(1.6 * lw)
    for pts, cl in water: c.drawPath(path(c, pts, cl, tx), stroke=1, fill=0)
    c.setStrokeGray(0.35); c.setLineWidth(0.5 * lw); c.setDash(4, 2.5)
    for pts, cl in road: c.drawPath(path(c, pts, cl, tx), stroke=1, fill=0)
    c.setDash(); c.setStrokeGray(0.15); c.setLineWidth(0.7 * lw)
    for pts, cl in mill: c.drawPath(path(c, pts, cl, tx), stroke=1, fill=0)
    c.setStrokeGray(0.3); c.setLineWidth(0.8 * lw)
    c.drawPath(path(c, edge, True, tx), stroke=1, fill=0)
    for t in TT:
        x, y = tx((t['x'], t['y']))
        c.setFillGray(grey(t['h'])); c.setStrokeGray(0); c.setLineWidth(0.5 * lw)
        c.circle(x, y, t['r'] * s, stroke=1, fill=1)
    c.setLineWidth(0.6 * lw); c.setStrokeGray(0)
    a = 1.4 * mm
    for t in TT:
        x, y = tx((t['x'], t['y'])); c.line(x - a, y, x + a, y); c.line(x, y - a, x, y + a)
    if labels:
        c.setFillGray(0); c.setFont('Sans', 6.5)
        for t in TT:
            x, y = tx((t['x'], t['y'])); c.drawString(x + 1.2 * mm, y + 0.9 * mm, f"{t['id']}{'?' if t['check'] else ''}")

def north(c, x, y):
    c.setFillGray(0); c.setFont('SansB', 8); c.drawCentredString(x, y + 4 * mm, 'N')
    p = c.beginPath(); p.moveTo(x, y + 2.5 * mm); p.lineTo(x - 3 * mm, y - 8 * mm); p.lineTo(x, y - 5.5 * mm); p.lineTo(x + 3 * mm, y - 8 * mm); p.close()
    c.drawPath(p, fill=1, stroke=0)

def scalebar(c, x, y):
    seg = 2 * M                     # 2 m segments, 10 m total = 50 mm
    for i in range(5):
        c.setFillGray(0 if i % 2 == 0 else 1); c.setStrokeGray(0); c.setLineWidth(0.5)
        c.rect(x + i * seg * mm, y, seg * mm, 2 * mm, stroke=1, fill=1)
    c.setFillGray(0); c.setFont('Mono', 7)
    for i in range(6): c.drawCentredString(x + i * seg * mm, y - 4 * mm, str(i * 2))
    c.drawString(x + 5 * seg * mm + 3 * mm, y - 4 * mm, 'm  ·  1:200')

def keymap(c, x, y, w, cur=None, label=True):
    """Small plan of the site with the tile outlines; cur = index of this tile."""
    s = w / W; h = H * s
    tx = lambda p: (x + p[0] * s, y + p[1] * s)
    c.saveState()
    c.setStrokeGray(0.45); c.setLineWidth(0.5); c.setFillGray(0.93)
    c.drawPath(path(c, edge, True, tx), stroke=1, fill=1)
    for i, (r, cl, x0, y0) in enumerate(tiles):
        if i == cur:
            c.setFillColorRGB(0, 0, 0, alpha=0.18); c.setStrokeGray(0); c.setLineWidth(1)
            c.rect(x + x0 * s, y + y0 * s, FW * s, FH * s, stroke=1, fill=1)
        else:
            c.setStrokeGray(0.55); c.setLineWidth(0.3); c.rect(x + x0 * s, y + y0 * s, FW * s, FH * s, stroke=1, fill=0)
        if label:
            c.setFillGray(0); c.setFont('SansB' if i == cur else 'Sans', 6 if w < 80 * mm else 11)
            c.drawCentredString(x + (x0 + FW / 2) * s, y + (y0 + FH / 2) * s - 2, str(i + 1))
    c.restoreState()

def grid(c, tx, x0, y0):
    """25 m reference squares with letters (columns) and numbers (rows), clipped to this tile."""
    c.setStrokeGray(0.6); c.setLineWidth(0.4); c.setDash(2, 2)
    k = 1
    while k * SQ < W:
        gx = k * SQ
        if x0 < gx < x0 + FW: c.line(*tx((gx, y0)), *tx((gx, y0 + FH)))
        k += 1
    k = 1
    while k * SQ < H:
        gy = k * SQ
        if y0 < gy < y0 + FH: c.line(*tx((x0, gy)), *tx((x0 + FW, gy)))
        k += 1
    c.setDash()

def legend_line(c):
    c.setFillGray(0.3); c.setFont('Sans', 7)
    c.drawString(FX * mm, 9 * mm, 'Grey bands: light 3–6 m · 6–10 m · 10–15 m · dark over 15 m.  ? = check on site.  '
                 'Numbers match the tree schedule.  At 1:200, 1 m is 5 mm: a 10 m tree is 50 mm tall.')
    c.drawString(FX * mm, 5 * mm, 'Gleniff Barytes Mill · ATU Sligo · ARCT06004 · tree heights from the Oct 2025 drone lidar (±1 m)')

pdf = canvas.Canvas(OUT_PDF, pagesize=(PW * mm, PH * mm))
pdf.setTitle('Gleniff Mill · trees · 1:200 · A3 tiles'); pdf.setAuthor('ATU Sligo · ARCT06004')

# ---------- page 1: tile index
pdf.setFillGray(0); pdf.setFont('SansB', 14); pdf.drawString(FX * mm, (PH - 16) * mm, f'Trees on the site · 1:200 · A3 tiles · index ({N} tiles)')
pdf.setFont('Sans', 9); pdf.setFillGray(0.25)
pdf.drawString(FX * mm, (PH - 22) * mm, f'The whole 1:200 model is {W:.0f} × {H:.0f} mm. Print every tile at 100% (actual size), A3 landscape, no "fit to page".')
iw = 300 * mm; ix = FX * mm; iy = 40 * mm
keymap(pdf, ix, iy, iw, cur=None)
pdf.setFillGray(0); pdf.setFont('SansB', 9); pdf.drawString((FX + 312) * mm, (PH - 40) * mm, 'Putting the tiles together')
pdf.setFont('Sans', 8); pdf.setFillGray(0.2)
steps = ['1  Check the 10 m scale bar on any tile', '    measures 50 mm. If not, reprint at 100%.',
         '2  Trim each tile on its frame line on the', '    top and left, keep the overlap on the', '    bottom and right.',
         '3  Lay tiles over each other so the dashed', '    25 m squares and the tree crosses line up,', '    then tape. Tiles overlap by a few cm.',
         '4  The numbers on this plan match the', '    "tile N of ' + str(N) + '" titles. The small map on', '    each tile shows where it goes.']
for i, s in enumerate(steps): pdf.drawString((FX + 312) * mm, (PH - 47 - i * 4.4) * mm, s)
north(pdf, (FX + 330) * mm, 70 * mm)
legend_line(pdf)
pdf.showPage()

# ---------- tiles
for i, (row, col, x0, y0) in enumerate(tiles):
    tx = lambda p, x0=x0, y0=y0: ((FX + p[0] - x0) * mm, (FY + p[1] - y0) * mm)
    pdf.setFillGray(0); pdf.setFont('SansB', 11)
    pdf.drawString(FX * mm, (PH - 9) * mm, f'Trees on the site · 1:200 · tile {i + 1} of {N}')
    pdf.setFont('Sans', 8); pdf.setFillGray(0.25)
    pdf.drawString(FX * mm, (PH - 14) * mm, 'Tiles overlap: line up the dashed 25 m squares (125 mm) and the tree crosses · print at 100%, A3 landscape')
    pdf.saveState()
    p = pdf.beginPath(); p.rect(FX * mm, FY * mm, FW * mm, FH * mm); pdf.clipPath(p, stroke=0, fill=0)
    site(pdf, tx, mm, view=(x0, y0, x0 + FW, y0 + FH))
    grid(pdf, tx, x0, y0)
    pdf.restoreState()
    pdf.saveState(); pdf.setFillGray(0.3); pdf.setFont('Mono', 8)
    # labels outside the frame (drawn without clip)
    for k in range(math.ceil(W / SQ)):
        cx = min((k + 0.5) * SQ, (k * SQ + W) / 2)
        if x0 + 4 < cx < x0 + FW - 4:
            pdf.drawCentredString(tx((cx, 0))[0], (FY + FH) * mm + 2 * mm, chr(65 + k))
    for j in range(math.ceil(H / SQ)):
        cy = min((j + 0.5) * SQ, (j * SQ + H) / 2)
        if y0 + 4 < cy < y0 + FH - 4:
            pdf.drawRightString(FX * mm - 2 * mm, tx((0, cy))[1] - 3, str(j + 1))
    pdf.restoreState()
    pdf.setStrokeGray(0); pdf.setLineWidth(0.6); pdf.setDash(3, 2)
    pdf.rect(FX * mm, FY * mm, FW * mm, FH * mm, stroke=1, fill=0); pdf.setDash()
    # key map + north + scale bar along the top right
    kw = 28 * mm
    keymap(pdf, (FX + FW) * mm - kw, 2 * mm, kw, cur=i, label=False)
    north(pdf, (FX + FW - 36) * mm, 12 * mm)
    scalebar(pdf, (FX + FW - 120) * mm, 13 * mm)
    legend_line(pdf)
    pdf.showPage()
pdf.save()

# ---------- DXF of the tree positions at 1:200 (true size, mm)
doc = ezdxf.new('R2010'); doc.units = ezdxf.units.MM; msp = doc.modelspace()
for name, col in [('FRAME', 7), ('SURVEY_EDGE', 8), ('CONTOURS_2M', 9), ('WATER', 5), ('ROAD', 8), ('MILL', 7),
                  ('TREE_CROWN', 3), ('TREE_CENTRE', 1), ('TREE_NUMBER', 7), ('GRID_25M', 9)]:
    doc.layers.add(name, color=col)
for layer, items in [('FRAME', plines('FRAME')), ('SURVEY_EDGE', plines('SURVEY_EDGE')), ('CONTOURS_2M', contours),
                     ('WATER', water), ('ROAD', road), ('MILL', mill)]:
    for pts, cl in items: msp.add_lwpolyline(pts, close=cl, dxfattribs={'layer': layer})
k = 1
while k * SQ < W: msp.add_line((k * SQ, 0), (k * SQ, H), dxfattribs={'layer': 'GRID_25M'}); k += 1
k = 1
while k * SQ < H: msp.add_line((0, k * SQ), (W, k * SQ), dxfattribs={'layer': 'GRID_25M'}); k += 1
for t in sorted(T, key=lambda t: t['id']):
    x, y = t['x'], t['y']
    msp.add_circle((x, y), t['r'], dxfattribs={'layer': 'TREE_CROWN'})
    msp.add_line((x - 2, y), (x + 2, y), dxfattribs={'layer': 'TREE_CENTRE'})
    msp.add_line((x, y - 2), (x, y + 2), dxfattribs={'layer': 'TREE_CENTRE'})
    msp.add_text(f"{t['id']}{'?' if t['check'] else ''}", dxfattribs={'layer': 'TREE_NUMBER', 'height': 3}).set_placement((x + 2, y + 1.2))
doc.saveas(OUT_DXF)
print(f'{N} tiles ({NC} x {NR} grid), model {W:.0f} x {H:.0f} mm ->', OUT_PDF, OUT_DXF)
