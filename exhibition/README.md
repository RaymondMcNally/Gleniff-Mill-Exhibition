# Exhibition mode

`kiosk.html` is the public screen on the terminal. It drives two other windows on the same computer:

| Display | Window | Shows |
|---|---|---|
| Terminal monitor (touch, or mouse) | `kiosk.html` | the controls visitors use |
| Projector over the model | `project.html?out` | contours, the cut, old maps and map layers on the model |
| 75-inch display | `sections.html?display` | the section through the scan |

All three must be open in the **same Chrome profile on the same computer** (they talk to each other inside the browser).

## Setting up

1. Connect the projector and the 75-inch display and set the displays to **extend**, not mirror.
2. Calibrate the projector once: open `project.html`, open its projector window, line up the four corners and the lens height (see the Projection page). It is remembered in that browser profile.
3. Start everything with `start-exhibition.bat` (Windows) or `start-exhibition.command` (Mac). Edit the address and the display positions at the top of the file first. If you use the script, calibrate from the kiosk (staff panel › Calibrate the projector) so the calibration is saved in the exhibition profile.
4. Or by hand: open `kiosk.html`, hold the bottom-right corner for 3 seconds, enter the PIN, then **Open projector window** and **Open big-screen window**; drag each to its display, click it and press F.

## Staff

- Hold the faint lock in the bottom-right corner for 3 seconds, then enter the PIN (`staffPin` in `config.json`, `1234` to start). The PIN only keeps visitors out of the set-up: it is in a public file, so it is not security.
- The staff panel opens the projector and big-screen windows, makes the kiosk full screen, goes to calibration, or leaves exhibition mode.
- After `idleSeconds` (180) with nobody touching it, the kiosk goes back to the start: the default cut, today's map only, rivers on, sound stopped.
- For a locked-down kiosk run Chrome with `--kiosk` or the scripts' `--app` windows: there is no address bar or tabs to wander off to.

## What it shows: `config.json`

- `cut`: the line it starts with (A and B in metres from the survey's south-west corner), the way it looks (−1 south, 1 north) and the slice depth.
- `maps`: the old maps. Each `file` is an image of the **whole survey area, north up**, edge to edge (the survey is 337 × 241 m). The three files in `maps/` are placeholders. To replace one: in QGIS, georeference the licensed OSi sheet, clip it to the survey's extent, export it as PNG or JPG (about 4 px per metre is plenty) and point `file` at it. Tailte Éireann (OSi) historic mapping needs a licence to be shown publicly.
- `layers`: the ten switches. Each `file` is GeoJSON. `crs` is `site` (metres from the survey's south-west corner, like the files made from the survey) or `auto` (WGS 84, ITM, Irish Grid or Web Mercator, worked out from the file). A layer whose file has no features shows **Data to come** and cannot be switched on. Five are made from the survey; woodland, geology, SAC, archaeology and land cover need data. Export from QGIS as GeoJSON in ITM, clipped to the site. Because this survey came from an STL, map coordinates are placed using the site's latitude and longitude until you type the ITM easting and northing of the survey's south-west corner on the Projection page (GIS layers › Where the data sits).
- `sounds`: four recordings with where they were made (`at`, site metres). Put the files in `sounds/` with the names given (`river.mp3`, `waterfall.mp3`, `woodland.mp3`, `hillside.mp3`). MP3 or M4A, stereo, a loop of 1–3 minutes, normalised to the same loudness; they fade in and out and loop. Until a file is there the kiosk says the recording is to come.
