# Trail Explorer (Breckenridge and Zermatt / Cervinia)

**Live site: https://brecktrails.github.io**

Interactive versions of official ski trail maps for planning a trip. The home page lets you pick a resort: **Breckenridge, Colorado** (`/breck/`) or **Zermatt / Cervinia** (`/zermatt/`, which also covers Valtournenche). Both run the same app. Tap any run on the official map to see its length, vertical drop, steepness and elevation profile (from [OpenSkiMap](https://openskimap.org)), and jump to YouTube videos of it. Tools for first-time visitors: run suggestions by level, a filterable list of all runs, a guide to the five peaks, side-by-side run comparison, a "Compared to Vail" view on every run (stats and commentary against a signature Vail run), difficulty highlighting, live mountain weather (from [Open-Meteo](https://open-meteo.com)) and tips.

Zermatt / Cervinia differs where the mountain does: pistes are numbered rather than named on the map, ratings are European (blue, red, black, and yellow off-piste itineraries, read from the color printed on the map), and measurements default to meters (a button switches between meters and feet at either resort).

Unofficial planning tool, not affiliated with any ski resort. Trail maps © Breckenridge Ski Resort and Zermatt Bergbahnen AG. Run data © OpenStreetMap contributors via OpenSkiMap.

## What's where

| Path | What it is |
|---|---|
| `public/` | The website itself: everything that gets hosted |
| `public/index.html` | Home page: pick a resort |
| `public/breck/`, `public/zermatt/` | One small page per resort; each loads its settings and the shared app |
| `public/resorts/<resort>.js` | Everything specific to a resort: wording, peaks or sectors, tips, weather spots, map files, units |
| `public/app.js` | The app itself, shared by every resort: page layout, map, tappable runs, panels, suggestions, search |
| `public/styles.css` | Look and layout, including the phone layout |
| `public/data/breck.json`, `zermatt.json` | Run label positions on the map + OpenSkiMap details per run |
| `public/data/vail.json` | Vail runs for the "Compared to Vail" section |
| `public/maps/` | Zermatt / Cervinia map images (built by `tools/build_zermatt.mjs`) |
| `public/icons/`, `manifest.webmanifest`, `sw.js` | Logo, browser tab and home-screen icons, and what lets the site install as an app |
| `public/run/<run>/`, `og-image.jpg` | Share-link pages and preview-card images, one per run (built by `tools/make-share-pages.html`) |
| `public/trailmap*.jpg` | The Breckenridge trail map rendered from the official PDF (with the sponsor/ad panes removed) |
| `tools/` | One-off build tools that produced the data and map images |
| `.github/workflows/pages.yml` | Automatic publishing to GitHub Pages |

## Run it locally

From this folder, in PowerShell:

```
powershell -ExecutionPolicy Bypass -File tools/serve.ps1
```

Then open http://localhost:8765/public/

## Publishing

Every change merged into `main` is published automatically by the GitHub Actions workflow in `.github/workflows/pages.yml`, which deploys the `public/` folder to GitHub Pages. Progress shows on the repo's **Actions** tab; the site updates a minute or two after a merge.

## Rebuilding the map and data

Only needed for a new season's trail map or to refresh run data.

### Breckenridge

1. Download the official trail map PDF from breckenridge.com and save it as `pdf_download/breck_map.pdf`.
2. Start the local server (above) and open http://localhost:8765/tools/extract.html
3. In the browser console run, in order: `saveLabels()`, `saveRuns()`, `saveBundle()`, then
   `renderMap(3, 'public/trailmap.jpg', 0.82)` and `renderMap(1.6, 'public/trailmap-small.jpg', 0.8)`.

Map cleanup (cropping and removed panes) is configured at the top of `tools/extract.html`.

### Zermatt / Cervinia

1. Download the official winter piste map PDF from zermatt.swiss and save it as `pdf_download/zermatt_map.pdf`.
2. Download https://tiles.openskimap.org/geojson/runs.geojson (about 850 MB; every ski run in the world).
3. One-time setup: `npm i --no-save pdfjs-dist@4.10.38 @napi-rs/canvas@0.1.100`
4. Run `node tools/build_zermatt.mjs --bulk path/to/runs.geojson`. It prints which piste numbers it could not match so they can be checked by eye. Later runs can leave out `--bulk`.

How the numbers on the map are matched to names, areas and difficulty is explained at the top of `tools/build_zermatt.mjs`.

## Adding another resort

Add `public/resorts/<id>.js` (copy an existing one), a `public/<id>/index.html` page (copy an existing one and change the names), its data file and map images, and a button on the home page.
