# Trail Explorer (Breckenridge and Zermatt / Cervinia)

**Live site: https://brecktrails.github.io**

Interactive versions of official ski trail maps for planning a trip. The home page lets you pick a resort: **Breckenridge, Colorado** (`/breck/`) or **Zermatt / Cervinia** (`/zermatt/`, which also covers Valtournenche). Both run the same app. Tap any run on the official map to see its length, vertical drop, steepness and elevation profile (from [OpenSkiMap](https://openskimap.org)), and jump to YouTube videos of it. Tap a lift's line (or, at Breckenridge, its name) to see what kind of lift it is, seats and capacity, whether it is a high-speed detachable, ride time, vertical rise, a short description, a photo where a freely licensed one exists, and the runs you can reach from the top. Tools for first-time visitors: run suggestions by level, a filterable list of all runs, a guide to the five peaks, side-by-side run comparison, a "Compared to Vail" view on every run (stats and commentary against a signature Vail run), difficulty highlighting, live mountain weather (from [Open-Meteo](https://open-meteo.com)) and tips.

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
| `public/runstats.js` | Looks runs up on OpenSkiMap and works out their stats; shared by the app (live) and the build tools (saved copy) |
| `public/data/breck.json`, `zermatt.json` | Run label positions on the map + a saved copy of OpenSkiMap details per run |
| `public/data/breck-lifts.json`, `zermatt-lifts.json` | Lifts: where each one's line is on the map, its details, photo credit and the runs from its top (built by `tools/build_lifts.mjs`) |
| `tools/lifts/<resort>.mjs` | The hand-written part of the lift data: descriptions, year opened, which photo, and for Zermatt where each lift's line is |
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

## Where run stats come from

Opening a run looks it up on OpenSkiMap there and then, so its stats, elevation profile and "View on OpenSkiMap" link match what OpenSkiMap shows at that moment. Length, slope and profile colors are worked out the way OpenSkiMap's own site does it (`public/runstats.js`).

The data files hold a saved copy of every run. It is what lists, search, suggestions and comparisons start from, what shows for a moment while a lookup is in flight, and what shows with no signal (labeled with the date it was saved). Runs someone has opened are remembered in their browser, so lists catch up as they go.

- Breckenridge and Vail runs are found by name, so they keep working when OpenSkiMap changes its IDs.
- Zermatt pistes are matched by number when the data is built, and looked up live by the OpenSkiMap IDs saved then. If a piste is re-edited and its ID changes, it shows the saved copy until the data is rebuilt.

To refresh the saved copies: `node tools/build_breck.mjs`, `node tools/build_vail.mjs`, and `node tools/build_zermatt.mjs --no-images` (the last one needs the setup under Zermatt below, and a fresh `--bulk` download to pick up changes).

## Where lift details come from

`node tools/build_lifts.mjs breck` and `node tools/build_lifts.mjs zermatt` write the lift files (same one-time setup and PDFs as Zermatt below; add `--fetch` to download OpenSkiMap's current lift list, about 70 MB, read once and not kept).

- **The line on the map** is read out of the trail map PDF, where lift lines are drawn in one color and width. Breckenridge prints each lift's name along its line, which says whose line it is. Zermatt prints no lift names, so `tools/lifts/zermatt.mjs` gives a point on each lift's line; the tool lists any line no lift has claimed.
- **Type, seats, capacity, ride time, length and elevations** are OpenSkiMap's. Breckenridge's seats and vertical rise come from the "Lift stats" table printed on its map. Where OpenSkiMap has no figure, the panel leaves it out.
- **Descriptions and years** are written by hand in `tools/lifts/<resort>.mjs`.
- **Photos** are shown straight from Wikimedia Commons, with author and license under each. Only lifts with a suitable photo there have one.
- **Runs from the top** are worked out from where runs start on OpenSkiMap: runs that begin by a top station, then runs that branch off those on the way down, staying between the lift's bottom and top. It is a guide, not a route planner.

Unlike runs, lifts are not looked up live: the panel shows the saved copy and its date. Small beginner carpets are left out.

## Rebuilding the map and data

Only needed for a new season's trail map.

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
