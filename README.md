# Breck Trail Explorer

**Live site: https://brecktrails.github.io**

An interactive version of the Breckenridge trail map for planning a ski trip. Tap any run on the official map to see its length, vertical drop, steepness and elevation profile (from [OpenSkiMap](https://openskimap.org)), and jump to YouTube videos of it. Tools for first-time visitors: run suggestions by level, a filterable list of all runs, a guide to the five peaks, difficulty highlighting and tips.

Unofficial planning tool, not affiliated with Breckenridge Ski Resort or Vail Resorts. Trail map © Breckenridge Ski Resort. Run data © OpenStreetMap contributors via OpenSkiMap.

## What's where

| Path | What it is |
|---|---|
| `public/` | The website itself: everything that gets hosted |
| `public/index.html` | Page structure: landing page, toolbar, map, side panel |
| `public/app.js` | All app behavior: map, tappable runs, panels, suggestions, search |
| `public/styles.css` | Look and layout, including the phone layout |
| `public/data/breck.json` | Run label positions on the map + OpenSkiMap details per run |
| `public/icons/`, `manifest.webmanifest`, `sw.js` | Logo, browser tab and home-screen icons, and what lets the site install as an app |
| `public/trailmap*.jpg` | The trail map rendered from the official PDF (with the sponsor/ad panes removed) |
| `tools/` | One-off build tools that produced the data and map images |
| `.github/workflows/pages.yml` | Automatic publishing to GitHub Pages |

## Run it locally

From this folder, in PowerShell:

```
powershell -ExecutionPolicy Bypass -File tools/serve.ps1
```

Then open http://localhost:8765/public/index.html

## Publishing

Every change merged into `main` is published automatically by the GitHub Actions workflow in `.github/workflows/pages.yml`, which deploys the `public/` folder to GitHub Pages. Progress shows on the repo's **Actions** tab; the site updates a minute or two after a merge.

## Rebuilding the map and data

Only needed for a new season's trail map or to refresh run data.

1. Download the official trail map PDF from breckenridge.com and save it as `pdf_download/breck_map.pdf`.
2. Start the local server (above) and open http://localhost:8765/tools/extract.html
3. In the browser console run, in order: `saveLabels()`, `saveRuns()`, `saveBundle()`, then
   `renderMap(3, 'public/trailmap.jpg', 0.82)` and `renderMap(1.6, 'public/trailmap-small.jpg', 0.8)`.

Map cleanup (cropping and removed panes) is configured at the top of `tools/extract.html`.
