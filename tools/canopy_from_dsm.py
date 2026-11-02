"""Make data/canopy.json for sun.html from a DJI Terra DSM GeoTIFF.
Usage: python3 tools/canopy_from_dsm.py dsm.tif . data/canopy.json
The DSM must be in WGS 84 / UTM 29N; edit E0T, N0T and px below to match its .tfw.
Canopy = highest DSM point in each 1 m cell of data/dem.json minus the bare ground,
with the vertical offset found from open ground. Under 1.5 m is set to 0; 255 = no DSM."""
import sys, json, base64, numpy as np, tifffile
dsm_path, repo, out = sys.argv[1:4]
A = tifffile.imread(dsm_path).astype(np.float32)
A[A < -1000] = np.nan
E0T, N0T, px = 538866.9585931469, 6028066.3619162850, 0.0245
site = json.load(open(f'{repo}/data/site.json')); E0, N0 = site['geo']['origin']
dem = json.load(open(f'{repo}/data/dem.json'))
GW, GH = dem['w'], dem['h']
u16 = np.frombuffer(base64.b64decode(dem['data']), dtype=np.uint16).reshape(GH, GW)
DATUM = 103.86
Hm = np.where(u16 == 0, np.nan, dem['offset_m'] + u16 * dem['scale'] - DATUM)
# 10x10 block means (0.245 m) to drop single-pixel noise
b = 10; R, C = (A.shape[0] // b) * b, (A.shape[1] // b) * b
with np.errstate(all='ignore'):
    B = np.nanmean(A[:R, :C].reshape(R // b, b, C // b, b), axis=(1, 3))
del A
bp = px * b
S = np.full((GH, GW), np.nan, np.float32)
for i in range(GH):
    N = N0 + i
    r0 = int((N0T - (N + 0.5)) / bp); r1 = int((N0T - (N - 0.5)) / bp) + 1
    if r1 <= 0 or r0 >= B.shape[0]: continue
    r0 = max(r0, 0)
    for j in range(GW):
        E = E0 + j
        c0 = int((E - 0.5 - E0T) / bp); c1 = int((E + 0.5 - E0T) / bp) + 1
        if c1 <= 0 or c0 >= B.shape[1]: continue
        w = B[r0:r1, max(c0, 0):c1]
        if w.size and np.isfinite(w).any(): S[i, j] = np.nanmax(w)
D = S - Hm
ok = np.isfinite(D)
off = np.nanpercentile(D[ok], 10)        # open ground: DSM ≈ DEM, so the low end of the difference is the vertical offset
hist = np.histogram(D[ok], bins=np.arange(-5 + off, off + 5, 0.1))
print('cells', ok.sum(), 'offset p10', round(float(off), 3), 'p5..p50', [round(float(np.nanpercentile(D[ok], q)), 2) for q in (5, 10, 25, 50, 75, 95, 99)])
mode = hist[1][np.argmax(hist[0])] + 0.05; print('mode', round(float(mode), 3))
CHM = np.where(ok, D - mode, 0); CHM[CHM < 1.5] = 0; CHM = np.clip(CHM, 0, 25.5)
print('canopy cover %', round(100 * (CHM > 0).sum() / ok.sum(), 1), 'max', CHM.max(), 'p95 of trees', np.percentile(CHM[CHM > 0], 95))
q = np.round(CHM / 0.1).astype(np.uint8); q[~ok] = 255   # 255 = outside the DSM: fall back to the woodland layer
print('no-dsm cells', (~ok).sum())
json.dump({'w': GW, 'h': GH, 'step_mm': dem['step_mm'], 'scale': 0.1, 'enc': 'u8-b64',
           'source': 'DJI Terra DSM (Zenmuse L1, Oct 2025) minus the bare-earth DEM, highest point in each 1 m cell; under 1.5 m set to 0; 255 = no DSM here',
           'offset_m': round(float(mode), 3), 'data': base64.b64encode(q.tobytes()).decode()}, open(out, 'w'))
