"""Rebuild data/model.json, sheet thumbnails and the sheet zip for the website.
Usage:  python tools/build_site_data.py <work dir with state.pkl + sheets/> <site dir>
state.pkl is written by contours.py (one level above its output folder)."""
import sys, os, json, pickle, glob, zipfile
import cairosvg

W, SITE = sys.argv[1], sys.argv[2]
DATUM = float(sys.argv[3]) if len(sys.argv) > 3 else 103.86   # real level (STL z × 0.2) shown as 0 m: the lowest ground
d = pickle.load(open(os.path.join(W, 'state.pkl'), 'rb'))

def enc(g, t=0.5):
    g = g.simplify(t, preserve_topology=True); out = []
    for q in (g.geoms if hasattr(g, 'geoms') else [g]):
        if q.geom_type != 'Polygon' or q.area < 4: continue
        rings = [list(q.exterior.coords)[:-1]] + [list(r.coords)[:-1] for r in q.interiors if r.envelope.area > 4]
        out.append([[[round(x, 1), round(y, 1)] for x, y in r] for r in rings])
    return out

(x0, y0, _), (x1, y1, _) = d['bounds']
meta = dict(scale=200, interval_m=1, layer_mm=5, footprint_mm=[round(x1 - x0), round(y1 - y0)],
            base_mm=[int(round((x1 - x0) / 10 + 1.4) * 10), int(round((y1 - y0) / 10 + 1.4) * 10)],
            sheets=d['nsheets'], overlap_mm=d['overlap'], bounds=d['bounds'])
model = dict(meta=meta,
             layers=[dict(n=L['i'], m=round(L['real'] - DATUM), full=enc(L['geom'], 0.6)) for L in d['layers']],
             pieces=[dict(id=p['id'], layer=p['layer'], sheet=p['sheet'] + 1, poly=enc(p['poly'])) for p in d['pieces']])
os.makedirs(f'{SITE}/data', exist_ok=True)
json.dump(model, open(f'{SITE}/data/model.json', 'w'), separators=(',', ':'))

os.makedirs(f'{SITE}/img/sheets', exist_ok=True); os.makedirs(f'{SITE}/downloads/sheets', exist_ok=True)
with zipfile.ZipFile(f'{SITE}/downloads/laser_sheets_A1.zip', 'w', zipfile.ZIP_DEFLATED) as z:
    for f in sorted(glob.glob(os.path.join(W, 'sheets', 'sheet_*.*'))):
        z.write(f, os.path.basename(f))
        open(f'{SITE}/downloads/sheets/' + os.path.basename(f), 'wb').write(open(f, 'rb').read())
        if f.endswith('.svg'):
            s = open(f).read().replace('stroke-width="0.1"', 'stroke-width="1.6"').replace('#ff0000', '#c4462a').replace('#0000ff', '#3d63b8')
            cairosvg.svg2png(bytestring=s.encode(), write_to=f'{SITE}/img/sheets/' + os.path.basename(f)[:-4] + '.png',
                             output_width=640, background_color='#f6f5f1')
print('layers', len(model['layers']), 'pieces', len(model['pieces']), 'sheets', meta['sheets'])
