# Gleniff Mill · Exhibition

The exhibition version of the Gleniff Mill Site Model Kit (ATU Sligo, Department of Architecture): the whole student website, plus **`kiosk.html`**, the public screen for the exhibition. Visitors cut the site, lay old Ordnance Survey maps over the model, switch ten map layers on and off, and play sounds recorded on the site. The kiosk drives the projector over the 1:200 model (`project.html?out`) and the section on the 75-inch display (`sections.html?display`). Set-up, staff exit and how to add maps, layers and sounds: **[exhibition/README.md](exhibition/README.md)**.

Static website for the 1:200 Gleniff Mill contour site model.
Students download the laser sheets, follow the build sequence and use the 3D assembly guide to find every piece.

## Publishing this copy
Make a new repository (for example `Gleniff-Exhibition`), add these files with **GitHub Desktop** or git (the web uploader takes at most 100 files at a time and 25 MB per file; `data/gleniff-lite.spz` is 28 MB), then Settings › Pages › Deploy from branch › `main` / root. The launch scripts in `exhibition/` assume the address `https://raymondmcnally.github.io/gleniff-mill-exhibition`.

## Trying it on your own computer
The pages load data and the 3D viewer as separate files, which browsers block when a page is opened straight from the folder (a `file://` address). The Sections page then says so; other pages show "needs the website served over http". To test locally, open Terminal in the website folder and run `python3 -m http.server 8000`, then go to http://localhost:8000. VS Code's Live Server works too. GitHub Pages needs nothing extra.

## Publish on GitHub Pages
1. Create a repository (e.g. `gleniff-site-model`) and upload the contents of this folder to the root.
2. Settings → Pages → Deploy from branch → `main` / root.
3. The site appears at `https://<user>.github.io/<repo>/`.

No build step. three.js is bundled in `vendor/`, so the site also runs from a university web server.
The 3D guide loads `data/model.json`, so it must be served over http — opening `index.html` straight from disk won't load it.
To preview locally: `python -m http.server` in this folder, then open http://localhost:8000.

## Pages
- `index.html` — Start here. It opens with a splash screen, once per browser session: either a laser tracing the contours or a scan line over the survey points, picked at random. Replay it with `?intro`, `?intro=laser` or `?intro=sweep`; the files are `js/splash.js` and `css/splash.css`, with the title set in `window.SPLASH` in the head. Every footer carries the credit "Created by R McNally".
  The page itself: the Stage 1 brief mapped to tasks A–E and the four analysis headings, base drawing downloads, SDGs, guide index, reading list
- `sun.html` — Sun and climate: sun path, terrain shadows for any date/time, hours of sun, aspect map, wind/rain sources, microclimate prompts (uses `js/plan.js` + `js/sun.js`)
- `sun.html` also has the rainfall chart and wind rose tool (`js/climate.js`): students drop a Met Éireann monthly/daily/hourly CSV (or a filled template from `downloads/climate/`) and save PNG/CSV. Runs entirely in the browser.
- `model.html` — Your model. Students drag a square over the survey and download a 1:100 contour plan PDF, plus one of these:
  - **Laser cutter**, as one of:
    - contour layers: a cutting kit ZIP with SVG, DXF and PDF sheets and an assembly guide;
    - waffle sections: slotted A/B section pieces, nested on sheets;
    - engraved relief: a greyscale PNG with its dpi set.
  - **3D print** for the Bambu P1S: a 230 mm model or a plaster mould, as 3MF or STL.
  - **CNC carving** for the Mantech Falcon 1325 through VCarve Pro: an STL plus a setup sheet. Sizes run from 300 to 1200 mm, at true scale or fitted to the material.

  **Class tile model** snaps squares to a grid named A1, B2… from the south-west corner, with one site-wide base level so the tiles join up, and downloads an A3 tile map.

  This is the same code as the multi-site Site Model Kit (`js/model.js`, `js/model-core.js`), loaded through `js/sitepack.js`. Squares are saved in `localStorage` as `gleniff-model`, as before, and file names read `<name>_gleniff_…`.
- `advanced.html` — the Advanced section: links to the Lidar, Splat, Sections and Projection pages, which are no longer in the main menu (their menu shows Advanced as the current item)
- `kit.html` — the model kit for the whole site at 1:100, 1:200, 1:500 or 1:1000: Cesium story, tile plan, kit maker (laser sheets ZIP, assembly guide PDF, contour DXF, made in the browser by `js/kit.js` with `js/model-core.js` and `js/nest-worker.js`), build sequence and 3D assembly guide. It makes the 1:200 kit on load; results are cached in the browser. The ready-made 1:200 files in `downloads/` are still linked. Board 1, 2, 3 or 5 mm, with *Sheets per layer* (1–5) for thin card: each piece is cut that many times and the copies glued into one thicker layer (1 mm × 5 = 1 m contours at 1:200). A kit of more than 900 pieces is not made on load; the page explains and waits for Make the kit. `model.html` has the same board and *Sheets glued per layer* options for contour layers.
- `lidar.html` — how the lidar ground model was made (flight, point cloud, classification, DSM/DEM, accuracy); uses `js/lidar.js` and `img/lidar/`.
- `splat.html` — Gaussian splat. It covers:
  - how the 3DGS was made: 500 L1 photos from the lidar flight, DJI Terra Education, about 4 hours on the Precision 5820;
  - what a splat is and what is in the file (the full scan as SPZ, 3,686,822 splats);
  - the splat lined up on the lidar, where it does and doesn't see the ground, a canopy height map, a section, and its limits.

  The figures in `img/splat/` were rendered straight from the splat file with a CPU Gaussian rasteriser, in the survey frame (see `data/site.json` → `splat`). Statistics come from 1 m cells: the splat reaches the ground (within 0.5 m of the lidar) in 56% of its 1.1 ha; trees reach about 21 m.
- `sections.html` — Sections. It cuts the splat along any vertical plane drawn on the plan, with the lidar ground drawn solid. Controls:
  - section, 3D and plan views;
  - slice depth and a level above which the canopy is hidden;
  - a section drawing as PDF (1:100, 1:200 or 1:500) or SVG, and a PNG of the view;
  - **Open big-screen window** (`sections.html?display`): the section full screen on a large monitor (F for full screen, R to reframe), following every move of the line. While it is connected the Sections page stops drawing its own 3D view so the graphics card draws the scan once (*Keep the 3D view on this screen too* turns that off); it sends a heartbeat every 2 s, so closing it hands the view back. A scan loaded from the computer is not passed to the big screen, which shows the site's own scan.

  It uses Spark 2.3.1 (`vendor/spark`) on three.js 0.180 (`vendor/three`, ES modules via an import map). The scan is **`data/gleniff-lite.spz`** (23.4 MB, 1.45 million splats, small enough for GitHub's web uploader): the full Terra scan (293 MB .ply, 3.69 million splats) thinned for the web, keeping every splat around the mill. It is not in the zip; copy it into `data/`. The page first looks for `data/gleniff-full.spz` (the whole scan as SPZ, 61.8 MB) and uses it if present; both share the same fit. The fit to the survey (turn 0.4°, east 309.25 m, north 89.5 m, up 66.766 m) is stored in `data/site.json` under `splat`. The older `data/gleniff-2026.glb` (2.04 million splats, Cesium download) is no longer used and can be deleted. Students can also load their own .spz, .ply, .sog or .glb scan and fit it to the survey.
- `project.html` — Projection. It projects layers onto a white site model from a projector pointing straight down:
  - layers: elevation, hillshade, contours, slope for access, features, water level, sun and shadow, an image;
  - four-corner calibration plus lens height and projector offset, which corrects for the height of the model;
  - a second projector window (`project.html?out`) kept in step by BroadcastChannel;
  - **GIS layers** (`js/gis-layers.js`, with the map projections in `js/dem-import.js`): GeoJSON files from QGIS or ArcGIS, a GeoJSON or WFS URL, or an ArcGIS feature service layer (`…/FeatureServer/0`, fetched near the model only). Coordinates are read from the file or worked out (WGS 84, ITM, Irish Grid, Web Mercator, site metres). The Gleniff survey came from an STL in its own coordinates, so its map position is estimated from its latitude and longitude until the ITM easting and northing of its south-west corner is typed under *Where the data sits* (nudges and a turn for fine alignment). Per layer: colour, width, strength, fill, *Colour by* a field with a key, *Animate*. Kept in IndexedDB (`sitekit-gis`) and sent to the projector window;
  - **Model scale** (1:200 to 1:2500), for the height correction, projector offsets and GIS line widths;
  - **Section cut**: the cut from the Sections page drawn on the model (line, plane, viewing arrows, A/B, the cut-away side darkened), live over the BroadcastChannel `sitekit-link-gleniff`.

  **Section on a big screen and on the model:** one computer with the monitor and projector as extended displays. Open the Projection page and its projector window (Section cut on), then the Sections page and its big-screen window; drag the line on the plan and both follow.

  Defaults suit a 2.55 m room: lens about 1400 mm above the table, 16:10 output. "Your model square" reads the square saved on `model.html`.
- `js/sitepack.js` and `data/site.json` — the Gleniff survey as a Site Model Kit site pack. The pack holds a 0.4 m grid with the same levels as `data/dem.json`, the site features in metres, and the splat alignment `{yaw −0.5°, x 69.03, y 108.454, z 20.321, scale 1}`. The Sections and Projection pages are the same code as the multi-site Site Model Kit, so fixes can be copied across.
- `contours.html` — Reading contours: slicing demo, landforms, annotated Gleniff plan, gradient + section tool (TGD M 2022 thresholds), water flow, building on slopes, self-check quiz. Uses `data/dem.json` and `img/hillshade.png`.

Site features on the contours page (river, tributary, mill platform) are hand-placed in `js/contours.js` (RIVER, TRIB, MILL, FEATS) in model mm, north up.

## Cesium story
The "Site" section embeds the Cesium ion story in an iframe. The story must be shared publicly in Cesium ion for students to see it.
Change the story link in `index.html` (two places) for a new site.

## Folder
- `index.html`, `css/`, `js/viewer.js` — the site
- `data/dem.json` — 1 m height grid for the contours page
- `data/model.json` — layer outlines and pieces of the ready-made 1:200 kit (used by the old `js/viewer.js`; the kit page no longer needs it)
- `downloads/` — laser sheet zip, per-sheet DXF/SVG, assembly guide PDF, 1:200 contour plan DXF, source STL
- `img/sheets/` — sheet thumbnails
- `downloads/base/` — 1:500 (A2 ×2, A1) and 1:20,000 (A3) base underlays; regenerate with `tools/make_base.py`
- `js/plan.js` — shared survey loader and plan drawing (used by sun.html and contours)
- `js/sitepack.js` + `data/site.json` — the survey as a site pack, for the model, sections and projection pages and the splash
- `js/gis-layers.js`, `js/dem-import.js` — GIS layers and map projections for the projection page (same files as the Site Model Kit)
- `kiosk.html`, `js/kiosk.js`, `css/kiosk.css` — the exhibition kiosk; `exhibition/` holds its `config.json`, layer files, old maps, sounds and launch scripts. `js/project.js` here also draws the kiosk's old maps (`overlays` in the projection state) and loads layer files by address.
- `tools/` — the scripts that generated everything

## A new site next year
```
pip install trimesh shapely ezdxf scipy pillow matplotlib cairosvg
python tools/contours.py new_site.stl work/sheets        # slice, tile, hollow, nest  -> work/sheets + work/state.pkl
python tools/docs.py work work/docs                       # guide PDF + contour plan DXF
python tools/build_site_data.py work .                    # model.json, thumbnails, sheet zip
```
Then copy the guide PDF, contour DXF and STL into `downloads/`, update the figures in `index.html` and the Cesium link.
Settings (scale, interval, sheet size, overlap) are constants at the top of `tools/contours.py`.
Levels are relative: 0 m is the lowest ground of the mesh. `contours.py` finds it from the up-facing surface (so the flat base QGIS adds under the terrain is ignored) and starts the first layer 1 m above it; set `Z0` (STL mm) to override. For Gleniff the lowest ground is STL z 519.3 mm, about 3.9 m above the base, so `docs.py` and `build_site_data.py` use a datum of 103.86 m (= 519.3 × 0.2). Check against a known spot height.
For a new site, the separate Site Model Kit website does all of this in the browser.
GitHub warns on files over 50 MB and rejects files over 100 MB; the STL is 23 MB.
