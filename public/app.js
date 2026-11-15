// Trail explorer: a resort's official trail map with tappable run names, plus tools for first-time visitors.
// One copy of this file serves every resort. Each resort has a page (breck/, zermatt/) that loads its
// settings from resorts/<id>.js into window.RESORT, then this file. A resort's data file holds:
//   labels: where each run name or number is printed on the map (PDF points, origin top-left)
//   runs:   OpenSkiMap details for each run that could be matched, as of the day the file was built.
//           Opening a run looks it up on OpenSkiMap again (see "Live data"), so this copy is only what
//           lists and search start from, and what shows when there is no signal.
const R = window.RESORT;
const BASE = '../'; // resort pages live one folder down from the shared files
const FT = 3.28084;
const isTouch = matchMedia('(pointer: coarse)').matches;
const isMobile = () => matchMedia('(max-width: 767px)').matches;
const $ = id => document.getElementById(id);

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
// Feet and miles or meters and kilometers: each resort has a default, and the choice is remembered
const UNITS_KEY = 'units:' + R.id;
let units = R.units;
try { units = localStorage.getItem(UNITS_KEY) || R.units; } catch { /* private browsing */ }
const metric = () => units === 'metric';
// Heights (elevation, vertical drop) and distances along a run. Everything is stored in meters.
const fmtFt = m => (metric() ? Math.round(m).toLocaleString() + ' m' : Math.round(m * FT).toLocaleString() + ' ft');
const fmtLen = m => (metric()
  ? (m >= 1000 ? (m / 1000).toFixed(2) + ' km' : Math.round(m).toLocaleString() + ' m')
  : (m * FT >= 5280 ? (m * FT / 5280).toFixed(2) + ' mi' : fmtFt(m)));
const deg = pct => Math.round(Math.atan(pct / 100) * 180 / Math.PI) + '°';
// "Lower 4 O’Clock" -> "lower-4-oclock": used in share links and the run/<slug>/ preview pages
const slugOf = name => norm(name).replace(/ /g, '-');
const SITE_URL = new URL(BASE, location.href).href;

// ---------- Difficulty ----------
// Two rating systems. North America (green circle, blue square, black diamonds): the rating comes from
// OpenSkiMap. Europe (blue, red, black pistes and yellow off-piste itineraries): the rating is the color
// of the number printed on the official map, read when the data was built.
// OpenSkiMap difficulty -> North American trail sign. `level` groups them for filters.
const DIFFICULTY = {
  novice: { label: 'Easiest', icon: 'circle', color: 'var(--green)', level: 'green' },
  easy: { label: 'Easiest', icon: 'circle', color: 'var(--green)', level: 'green' },
  intermediate: { label: 'More Difficult', icon: 'square', color: 'var(--blue)', level: 'blue' },
  advanced: { label: 'Most Difficult', icon: 'diamond', color: 'var(--black)', level: 'black' },
  expert: { label: 'Expert', icon: 'double', color: 'var(--black)', level: 'expert' },
  extreme: { label: 'Extreme', icon: 'double', color: 'var(--black)', level: 'expert' },
  freeride: { label: 'Freeride', icon: 'double', color: 'var(--black)', level: 'expert' },
};
const UNRATED = { label: 'Not rated', icon: 'none', color: 'var(--muted)', level: null };
const EU = R.scheme === 'eu';
const EU_DIFFICULTY = {
  blue: { label: 'Easy', icon: 'circle', color: 'var(--blue)', level: 'blue' },
  red: { label: 'Intermediate', icon: 'circle', color: 'var(--red)', level: 'red' },
  black: { label: 'Difficult', icon: 'circle', color: 'var(--black)', level: 'black' },
  yellow: { label: 'Itinerary (not groomed)', icon: 'circle', color: 'var(--yellow)', level: 'yellow' },
};
const EU_FROM_OSM = { novice: 'blue', easy: 'blue', intermediate: 'red', advanced: 'black', expert: 'black', freeride: 'yellow', extreme: 'yellow' };
// Roughly how European colors line up with North American signs, for comparing against Vail
const EU_TO_NA = { blue: 'green', red: 'blue', black: 'black', yellow: 'expert' };
const LEVELS = EU ? {
  blue: { name: 'Beginner', sign: 'Blue', icon: 'circle', color: 'var(--blue)', blurb: 'New or still learning to turn and stop' },
  red: { name: 'Intermediate', sign: 'Red', icon: 'circle', color: 'var(--red)', blurb: 'Comfortable on most groomed pistes' },
  black: { name: 'Advanced', sign: 'Black', icon: 'circle', color: 'var(--black)', blurb: 'Happy on steep, sometimes icy or bumpy pistes' },
  yellow: { name: 'Off-piste', sign: 'Yellow itinerary', icon: 'circle', color: 'var(--yellow)', blurb: 'Marked but ungroomed routes, for strong skiers' },
} : {
  green: { name: 'Beginner', sign: 'Green circle', icon: 'circle', color: 'var(--green)', blurb: 'New or still learning to turn and stop' },
  blue: { name: 'Intermediate', sign: 'Blue square', icon: 'square', color: 'var(--blue)', blurb: 'Comfortable on most groomed runs' },
  black: { name: 'Advanced', sign: 'Black diamond', icon: 'diamond', color: 'var(--black)', blurb: 'Happy on steeper runs and some bumps' },
  expert: { name: 'Expert', sign: 'Double black', icon: 'double', color: 'var(--black)', blurb: 'Bowls, chutes and the steepest terrain' },
};
function signIcon(kind, color = 'var(--muted)') {
  const shapes = {
    circle: `<circle cx="10" cy="10" r="8" fill="${color}"/>`,
    square: `<rect x="2.5" y="2.5" width="15" height="15" fill="${color}"/>`,
    diamond: `<rect x="5" y="5" width="10" height="10" transform="rotate(45 10 10)" fill="${color}"/>`,
    double: `<rect x="1.5" y="6" width="7.5" height="7.5" transform="rotate(45 5.25 9.75)" fill="${color}"/><rect x="11" y="6" width="7.5" height="7.5" transform="rotate(45 14.75 9.75)" fill="${color}"/>`,
    none: `<circle cx="10" cy="10" r="7" fill="none" stroke="var(--muted)" stroke-width="2"/>`,
  };
  return `<svg viewBox="0 0 20 20" aria-hidden="true">${shapes[kind]}</svg>`;
}
// diffOf: the North American sign for an OpenSkiMap rating (Breck and Vail runs).
// Runs of this resort carry their own `diff` (see main), which follows the resort's rating system.
const diffOf = run => DIFFICULTY[run?.difficulty] || UNRATED;
const iconFor = r => `<span class="icon">${signIcon(r.diff.icon, r.diff.color)}</span>`;

// ---------- Areas (Breck's peaks, Zermatt's sectors) ----------
const AREAS = R.areas.map(a => ({ ...a, id: String(a.id) }));
const areaName = id => AREAS.find(a => a.id === id)?.name || '';
const T = R.text; // the resort's own wording: "Peaks" or "Sectors", and so on

// ---------- Page ----------
// The page itself is the same for every resort, so it is built here and filled in from the resort's settings.
document.body.innerHTML = `
  <section id="landing" class="landing">
    <div class="landing-bg" aria-hidden="true" style="background-image:url('${BASE + R.map.small}')"></div>
    <div class="landing-inner">
      <a class="all-resorts" href="${BASE}">‹ All resorts</a>
      <img class="landing-logo" src="${BASE}icons/logo.svg" alt="" width="72" height="72">
      <p class="eyebrow">${R.eyebrow} · <span id="run-count"></span> runs</p>
      <h1>${R.title}</h1>
      <p class="lead">${R.lead}</p>
      <div class="cta-row">
        <a class="cta" href="#map">Open Trail Map
          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M13 6l6 6-6 6"/></svg></a>
        <button id="install" class="cta-secondary" hidden>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M12 3v12m0 0-5-5m5 5 5-5M5 21h14"/></svg>
          Add to home screen</button>
      </div>
      <p id="install-help" class="install-help" hidden></p>
      <ul class="features">${R.features.map(([t, d]) => `<li><strong>${t}</strong><span>${d}</span></li>`).join('')}</ul>
    </div>
    <p class="disclaimer">${R.disclaimer}</p>
  </section>

  <section id="app" class="app" hidden>
    <header class="topbar">
      <div class="header-row">
        <a class="brand" href="#" aria-label="${R.title} home">
          <img src="${BASE}icons/logo.svg" alt="" width="30" height="30">
          <span>${R.title}</span>
        </a>
        <div class="search">
          <svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="m20 20-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          <input id="search" type="search" placeholder="${T.search}" autocomplete="off" aria-label="Find a run">
          <ul id="results" class="results" role="listbox" hidden></ul>
        </div>
        <a class="official" id="official-link" href="${R.map.official}" target="_blank" rel="noopener">Official map ↗</a>
      </div>
      <nav class="toolbar" aria-label="Tools">
        <button class="tool" data-open="suggest">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/></svg>
          Suggest a run</button>
        <button class="tool" data-open="list">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
          All runs</button>
        <button class="tool" data-open="compare">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16M17 4v16M3 8h8M13 16h8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
          Compare <span id="cmp-count" class="badge" hidden></span></button>
        <button class="tool" data-open="peaks">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M2 20 9 7l4 7 2-3 7 9z"/></svg>
          ${T.areas}</button>
        <button class="tool" data-open="weather">
          <span id="wx-chip" class="wx-chip" aria-hidden="true">⛅</span>
          Weather</button>
        <div class="levels" role="group" aria-label="Highlight runs on the map by difficulty">
          <span class="levels-label">Show</span>
          ${Object.entries(LEVELS).map(([k, v]) => `<button class="level" data-level="${k}" aria-pressed="false" title="Highlight ${v.sign.toLowerCase()} runs">${signIcon(v.icon, v.color)}</button>`).join('')}
        </div>
        <button class="tool" data-open="tips">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 11v6M12 7.5v.01" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
          First-timer tips</button>
        <button class="tool" id="units" title="Switch between feet and meters"></button>
      </nav>
    </header>

    <div class="map-wrap">
      <div id="map" aria-label="${R.name} trail map"></div>
      <div id="hovercard" class="hovercard" hidden></div>
    </div>

    <div id="toast" class="toast" role="status" hidden></div>

    <aside id="panel" class="panel" aria-live="polite" hidden>
      <div class="panel-head">
        <button id="back" class="icon-btn" aria-label="Back" hidden>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <div class="grabber"></div>
        <button id="close" class="icon-btn" aria-label="Close">×</button>
      </div>
      <div id="panel-body"></div>
    </aside>
  </section>`;

// ---------- Install as an app ----------
if ('serviceWorker' in navigator) navigator.serviceWorker.register(BASE + 'sw.js').catch(() => {});
(function setupInstall() {
  const btn = $('install'), help = $('install-help');
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone) return; // already installed
  // Chrome, Edge and Android offer a real install prompt
  let deferred = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; btn.hidden = false; });
  window.addEventListener('appinstalled', () => { btn.hidden = true; help.hidden = true; });
  // iPhone/iPad Safari has no prompt, so show how to do it by hand
  const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (iOS) btn.hidden = false;
  btn.addEventListener('click', async () => {
    if (deferred) { deferred.prompt(); await deferred.userChoice; deferred = null; return; }
    help.innerHTML = 'On iPhone: tap the <strong>Share</strong> button <span aria-hidden="true">(□↑)</span> in Safari, then <strong>Add to Home Screen</strong>.';
    help.hidden = false;
  });
})();

// ---------- Weather ----------
// Forecast from Open-Meteo (free, no account) for two spots: the base and the top of the mountain.
// Open-Meteo adjusts temperatures to the elevation we pass in, and answers in the units we ask for
// (°F, mph and inches, or °C, km/h and cm).
const WX_SPOTS = R.weather.spots; // [base, summit]
const wxUrl = () => 'https://api.open-meteo.com/v1/forecast?' + new URLSearchParams({
  latitude: WX_SPOTS.map(s => s.lat).join(','), longitude: WX_SPOTS.map(s => s.lon).join(','),
  elevation: WX_SPOTS.map(s => s.elev).join(','),
  current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,is_day',
  daily: 'weather_code,temperature_2m_max,temperature_2m_min,snowfall_sum,wind_gusts_10m_max',
  ...(metric() ? {} : { temperature_unit: 'fahrenheit', wind_speed_unit: 'mph', precipitation_unit: 'inch' }),
  timezone: R.weather.timezone, forecast_days: 5,
});
// WMO weather codes -> [label, emoji]
function wxCode(code, day = 1) {
  if (code === 0) return ['Clear', day ? '☀️' : '🌙'];
  if (code <= 2) return ['Partly cloudy', day ? '🌤️' : '☁️'];
  if (code === 3) return ['Cloudy', '☁️'];
  if (code <= 48) return ['Fog', '🌫️'];
  if (code <= 57) return ['Drizzle', '🌦️'];
  if (code <= 67) return ['Rain', '🌧️'];
  if (code <= 77) return ['Snow', '🌨️'];
  if (code <= 82) return ['Rain showers', '🌦️'];
  if (code <= 86) return ['Snow showers', '❄️'];
  return ['Thunderstorms', '⛈️'];
}
let wxCache = null; // { at, units, data } so reopening the panel doesn't refetch every time
async function getWeather() {
  if (wxCache && wxCache.units === units && Date.now() - wxCache.at < 15 * 60e3) return wxCache.data;
  const asked = units;
  const res = await fetch(wxUrl());
  if (!res.ok) throw new Error('weather ' + res.status);
  const data = await res.json();
  wxCache = { at: Date.now(), units: asked, data };
  return data;
}

(async function main() {
  const [data, VAIL] = await Promise.all([
    fetch(BASE + R.data).then(r => r.json()),
    // Signature Vail runs for the "Compared to Vail" section (built by tools/build_vail.mjs); optional
    fetch(BASE + 'data/vail.json').then(r => r.json()).then(d => d.runs).catch(() => ({})),
  ]);
  const { width: W, height: H, labels, runs } = data;
  const builtText = data.built ? new Date(data.built + 'T12:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'earlier';

  // One entry per run name (a name can be printed in several places on the map)
  const byName = (a, b) => a.localeCompare(b, undefined, { numeric: true }); // "9 Tuftern" before "10 Paradise"
  const RUNS = {};
  for (const l of labels) {
    RUNS[l.name] ||= { name: l.name, run: runs[l.name] || null, area: String(R.areaOf(l)), labels: [] };
    RUNS[l.name].labels.push(l);
  }
  const ALL = Object.values(RUNS).sort((a, b) => byName(a.name, b.name));
  // Sets a run's rating from its details; called again whenever fresher details arrive
  function rate(r) {
    if (EU) {
      // The color printed most often for this run on the map; OpenSkiMap's rating if the map had none
      const votes = {};
      for (const l of r.labels) if (l.official) votes[l.official] = (votes[l.official] || 0) + 1;
      const color = Object.keys(votes).sort((a, b) => votes[b] - votes[a])[0] || EU_FROM_OSM[r.run?.difficulty];
      r.diff = EU_DIFFICULTY[color] || UNRATED;
    } else r.diff = diffOf(r.run);
    r.level = r.diff.level;
    r.naLevel = EU ? EU_TO_NA[r.level] : r.level; // the closest North American rating, for the Vail comparison
  }
  // Runs this browser has already looked up live are newer than the saved copy: start from those
  const LIVE_KEY = 'live:' + R.id;
  let liveSaved = {};
  try { liveSaved = JSON.parse(localStorage.getItem(LIVE_KEY)) || {}; } catch { /* private browsing */ }
  for (const r of ALL) {
    const c = liveSaved[r.name];
    if (c && c.at > Date.parse(data.built || 0)) r.run = c.run; else delete liveSaved[r.name];
    rate(r);
  }
  $('run-count').textContent = ALL.length;

  // ---------- Landing <-> map routing ----------
  // #map shows the map; #run/<slug> shows the map with that run open (what share links point to)
  const BY_SLUG = Object.fromEntries(ALL.map(r => [slugOf(r.name), r.name]));
  let mapReady = false;
  function route() {
    const runName = BY_SLUG[decodeURIComponent(location.hash.match(/^#run\/(.+)$/)?.[1] || '')];
    const showMap = location.hash === '#map' || !!runName;
    $('landing').hidden = showMap;
    $('app').hidden = !showMap;
    document.body.style.overflow = showMap ? 'hidden' : '';
    if (showMap && !mapReady) { initMap(); mapReady = true; }
    else if (showMap) map.invalidateSize();
    if (runName && selected !== runName) { showView({ type: 'run', name: runName }); flyToRun(runName); }
  }
  window.addEventListener('hashchange', route);
  // Keep the address bar pointing at what's on screen, without adding history entries
  const setHash = h => { if (location.hash !== h) history.replaceState(null, '', h); };

  // ---------- Map ----------
  let map;
  const ll = (x, y) => [-y, x]; // PDF point -> Leaflet lat/lng (CRS.Simple, y flipped)
  const hotspots = {}; // run name -> polygons

  const IDLE = { stroke: false, fill: true, fillOpacity: 0 };
  const HOVER = { stroke: true, color: '#0b63ce', weight: 1.5, opacity: 0.9, fill: true, fillColor: '#0b63ce', fillOpacity: 0.15 };
  const SELECTED = { stroke: true, color: '#e0a800', weight: 2.5, opacity: 1, fill: true, fillColor: '#ffd400', fillOpacity: 0.45 };
  const LEVEL_STYLE = {
    green: { stroke: true, color: '#138a45', weight: 2, opacity: 1, fill: true, fillColor: '#3ddc84', fillOpacity: 0.35 },
    red: { stroke: true, color: '#8f0f16', weight: 2, opacity: 1, fill: true, fillColor: '#ff8a80', fillOpacity: 0.45 },
    yellow: { stroke: true, color: '#8a6100', weight: 2, opacity: 1, fill: true, fillColor: '#ffe066', fillOpacity: 0.5 },
    blue: { stroke: true, color: '#0d47a1', weight: 2, opacity: 1, fill: true, fillColor: '#64b5f6', fillOpacity: 0.4 },
    black: { stroke: true, color: '#111', weight: 2, opacity: 1, fill: true, fillColor: '#ffffff', fillOpacity: 0.55 },
    expert: { stroke: true, color: '#111', weight: 2.5, opacity: 1, dashArray: '4 3', fill: true, fillColor: '#ffffff', fillOpacity: 0.55 },
  };
  const levelsOn = new Set();
  const baseStyle = name => (levelsOn.has(RUNS[name].level) ? LEVEL_STYLE[RUNS[name].level] : IDLE);

  // A rotated box around a line of text. (x, y) is the left end of the baseline.
  // `lead` extends the box to the left to cover the difficulty symbol printed before the name.
  function textBox(x, y, w, h, rotDeg, pad = 2, lead = 0) {
    const r = rotDeg * Math.PI / 180;
    const d = [Math.cos(r), -Math.sin(r)], u = [-Math.sin(r), -Math.cos(r)];
    const pt = (a, b) => ll(x + a * d[0] + b * u[0], y + a * d[1] + b * u[1]);
    const left = -pad - lead;
    return [pt(left, -0.3 * h - pad), pt(w + pad, -0.3 * h - pad), pt(w + pad, h + pad), pt(left, h + pad)];
  }
  function labelShapes(l) {
    if (l.pts) { // curved label stored letter by letter: one small box per letter
      return l.pts.map((p, i) => {
        const q = l.pts[i + 1] || [p[0] + (p[0] - l.pts[i - 1][0]), p[1] + (p[1] - l.pts[i - 1][1])];
        const rot = -Math.atan2(q[1] - p[1], q[0] - p[0]) * 180 / Math.PI;
        return textBox(p[0], p[1], Math.hypot(q[0] - p[0], q[1] - p[1]), l.h, rot, 1.5);
      });
    }
    // Breck prints a difficulty symbol before each name; a resort's data can say otherwise with lead/pad
    const boxes = [textBox(l.x, l.y, l.w, l.h, l.rot, l.pad ?? 2, l.lead ?? (l.lines === 1 ? l.h * 1.2 : 0))];
    if (l.lines === 2) boxes.push(textBox(l.x2, l.y2, l.w2, l.h, l.rot));
    return boxes;
  }

  function initMap() {
    map = L.map('map', {
      crs: L.CRS.Simple, minZoom: -3, maxZoom: 2.5, zoomSnap: 0.25, zoomDelta: 0.5,
      wheelPxPerZoomLevel: 90, attributionControl: true, zoomControl: true,
      maxBounds: L.latLngBounds(ll(-200, H + 200), ll(W + 200, -200)), maxBoundsViscosity: 0.8,
    });
    map.attributionControl.setPrefix(false).addAttribution(
      `Trail map © ${R.map.owner} (<a href="${R.map.official}" target="_blank" rel="noopener">official PDF</a>) · ` +
      'Run data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> via <a href="https://openskimap.org" target="_blank" rel="noopener">OpenSkiMap</a>');

    // Low-res map shows immediately; the sharp one swaps in once downloaded
    const imgBounds = L.latLngBounds(ll(0, H), ll(W, 0));
    L.imageOverlay(BASE + R.map.small, imgBounds).addTo(map);
    const sharp = new Image();
    sharp.onload = () => L.imageOverlay(BASE + R.map.sharp, imgBounds).addTo(map);
    sharp.src = BASE + R.map.sharp;

    // Start on the mountain itself, not the header text.
    // On a phone, fill the screen height (centered on the resort's chosen spot) and let people pan sideways.
    const f = R.map.focus;
    if (isMobile()) map.setView(ll(f.x, f.y), Math.round(Math.log2(map.getSize().y / f.span) * 4) / 4);
    else map.fitBounds(L.latLngBounds(ll(0, H), ll(W, R.map.top)));

    map.createPane('hotspots').style.zIndex = 450;
    const renderer = L.canvas({ pane: 'hotspots', tolerance: isTouch ? 10 : 3 });
    for (const l of labels) {
      const poly = L.polygon(labelShapes(l), { ...IDLE, renderer, interactive: true });
      poly.on('click', e => { L.DomEvent.stopPropagation(e); openRun(l.name); });
      if (!isTouch) {
        poly.on('mouseover', () => { showHover(l.name); if (selected !== l.name) setStyle(l.name, HOVER); });
        poly.on('mouseout', () => { hideHover(); if (selected !== l.name) setStyle(l.name, baseStyle(l.name)); });
      }
      poly.addTo(map);
      (hotspots[l.name] ||= []).push(poly);
    }
    map.on('click', closePanel);
    // The map can move out from under the cursor without a mouseout
    map.on('movestart zoomstart', hideHover);
  }
  const setStyle = (name, style) => hotspots[name].forEach(p => p.setStyle({ dashArray: null, ...style }));
  const boundsOf = name => L.featureGroup(hotspots[name]).getBounds();

  // ---------- Hover card (desktop) ----------
  function showHover(name) {
    const r = RUNS[name], d = r.diff;
    $('hovercard').innerHTML = `${signIcon(d.icon, d.color)}<div><div class="hc-name">${esc(name)}</div>
      <div class="hc-meta">${d.label} · ${areaName(r.area)}${r.run?.lengthM ? ' · ' + fmtLen(r.run.lengthM) : ''}</div></div>`;
    $('hovercard').hidden = false;
  }
  const hideHover = () => { $('hovercard').hidden = true; };

  // ---------- Selection ----------
  let selected = null;
  function highlightRun(name) {
    if (selected && selected !== name) setStyle(selected, baseStyle(selected));
    selected = name;
    if (!name) return;
    setStyle(name, SELECTED);
    hotspots[name].forEach(p => p.bringToFront());
  }
  // Nudge the map so the selected label isn't hidden behind the panel / bottom sheet
  function keepClearOfPanel(name) {
    const size = map.getSize();
    const p = map.latLngToContainerPoint(boundsOf(name).getCenter());
    if (isMobile()) {
      const sheetTop = size.y - $('panel').offsetHeight;
      if (p.y > sheetTop - 40 || p.y < 20) map.panBy([0, p.y - sheetTop / 2]);
    } else {
      const free = size.x - $('panel').offsetWidth - 24;
      if (p.x > free - 40 || p.x < 20) map.panBy([p.x - free / 2, 0]);
    }
  }
  function flyToRun(name) {
    map.flyTo(boundsOf(name).getCenter(), Math.max(map.getZoom(), 0.5), { duration: 0.6 });
    map.once('moveend', () => keepClearOfPanel(name));
  }

  // ---------- Live data ----------
  // The saved copy of a run goes out of date whenever the run is redrawn on OpenStreetMap. So each time a
  // run is opened it is looked up on OpenSkiMap again: by name where that works (Breckenridge, Vail),
  // otherwise by the OpenSkiMap IDs saved with it (Zermatt, whose pistes are matched by number; if those
  // IDs have changed since the data was built, the saved copy stays, labeled with its date).
  // The panel shows the saved copy at once and redraws when the answer arrives.
  const liveState = {}; // 'run:Wirepatch' -> { state: 'loading' | 'live' | 'saved' | 'offline', at }
  function refresh(kind, name) {
    const key = kind + ':' + name, was = liveState[key];
    if (was && (was.state !== 'offline' || Date.now() - was.at < 60e3)) return; // one lookup per visit; retry if it failed
    const saved = kind === 'vail' ? VAIL[name] : RUNS[name].run;
    const area = RunStats.AREAS[kind === 'vail' ? 'vail' : R.id];
    if (!area && !saved?.osmIds?.length) return;
    liveState[key] = { state: 'loading', at: Date.now() };
    (area ? RunStats.fetchRun(name, area) : RunStats.fetchIds(saved.osmIds)).then(run => {
      liveState[key] = { state: run ? 'live' : 'saved', at: Date.now() };
      if (!run) return; // OpenSkiMap no longer has it under this name: keep what we have
      if (kind === 'vail') {
        // Keep what the build added by hand: the blurb, and Vail's own rating where it differs
        VAIL[name] = { ...run, note: saved?.note || null, signature: !!saved?.signature,
          ...(saved?.ratingSource ? { difficulty: saved.difficulty, ratingSource: saved.ratingSource } : {}) };
      } else {
        RUNS[name].run = run;
        rate(RUNS[name]);
        liveSaved[name] = { at: Date.now(), run };
        try { localStorage.setItem(LIVE_KEY, JSON.stringify(liveSaved)); } catch { /* full or private browsing */ }
      }
    }).catch(() => { liveState[key] = { state: 'offline', at: Date.now() }; }).finally(() => {
      // Redraw if that run is still on screen (but not while someone is typing in the Vail search box)
      const view = stack[stack.length - 1];
      if (view?.type !== 'run' || (kind === 'run' && view.name !== name)) return;
      if (document.activeElement?.matches?.('[data-vail-search]')) return;
      keepScroll(() => VIEWS.run(view));
    });
  }
  function liveNote(kind, name, run) {
    const s = liveState[kind + ':' + name]?.state;
    const extra = run && run.pieces > run.mainPieces ? ' OpenSkiMap draws more than one line under this name; these stats are for the main one.' : '';
    if (s === 'loading') return 'Checking OpenSkiMap for the latest…';
    if (s === 'live') return 'Up to date with OpenSkiMap as of now.' + extra;
    if (s === 'offline') return `Couldn’t reach OpenSkiMap, so this is the copy saved ${builtText}.` + extra;
    return (run ? `Saved copy from ${builtText}.` : '') + extra;
  }
  // OpenSkiMap's IDs change when a run is re-edited, so the link uses the ID from the live lookup
  // (the saved one until that arrives)
  const openSkiMapUrl = run => 'https://openskimap.org/?obj=' + encodeURIComponent(run.primaryId);

  // ---------- Panel views ----------
  // The panel shows one view at a time; views opened from another view get a Back button.
  const panel = $('panel'), body = $('panel-body');
  let stack = [];
  function showView(view, { push = false } = {}) {
    stack = push ? [...stack, view] : [view];
    renderTop();
  }
  function renderTop() {
    const view = stack[stack.length - 1];
    $('back').hidden = stack.length < 2;
    VIEWS[view.type](view);
    panel.hidden = false;
    document.body.classList.add('panel-open');
    panel.scrollTop = view.scroll || 0;
    document.querySelectorAll('.tool[data-open]').forEach(b => b.setAttribute('aria-current', b.dataset.open === view.type));
    highlightRun(view.type === 'run' ? view.name : null);
    setHash(view.type === 'run' ? '#run/' + slugOf(view.name) : '#map');
  }
  function back() {
    stack.pop();
    renderTop();
  }
  function closePanel() {
    stack = [];
    panel.hidden = true;
    document.body.classList.remove('panel-open');
    highlightRun(null);
    document.querySelectorAll('.tool[data-open]').forEach(b => b.setAttribute('aria-current', 'false'));
    setHash('#map');
  }
  // Remember scroll position of the view we're leaving, so Back returns to the same spot
  const saveScroll = () => { if (stack.length) stack[stack.length - 1].scroll = panel.scrollTop; };

  function openRun(name, { from } = {}) {
    if (from) { saveScroll(); showView({ type: 'run', name }, { push: true }); flyToRun(name); }
    else { showView({ type: 'run', name }); keepClearOfPanel(name); }
  }

  const VIEWS = {
    run({ name }) {
      refresh('run', name);
      const r = RUNS[name], run = r.run, d = r.diff;
      const yt = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(R.videoSearch(r).replace(/’/g, "'"));
      let html = `<div class="run-head"><h2>${esc(name)}</h2>
          <button class="share" data-share="${esc(name)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Share</button></div>
        <div class="diff">${signIcon(d.icon, d.color)}<span>${d.label}</span><span class="sub">· ${areaName(r.area)}</span></div>
        ${compareButton(name)}`;
      if (run) {
        html += `<p class="diff-note">${EU ? 'Rating is the color printed on the official piste map.' : 'Rating from OpenSkiMap. The run’s color on the trail map is the resort’s official rating.'}</p>`;
        const stats = [];
        if (run.lengthM) stats.push(['Length', fmtLen(run.lengthM)]);
        if (run.verticalM) stats.push(['Vertical drop', fmtFt(run.verticalM)]);
        if (run.topM) stats.push(['Top elevation', fmtFt(run.topM)]);
        if (run.bottomM) stats.push(['Bottom elevation', fmtFt(run.bottomM)]);
        if (run.avgGradePct) stats.push(['Average grade', run.avgGradePct + '%', deg(run.avgGradePct)]);
        if (run.maxGradePct) stats.push(['Steepest pitch', run.maxGradePct + '%', deg(run.maxGradePct)]);
        html += `<dl class="stats">${stats.map(([k, v, s]) => `<div class="stat"><dt>${k}</dt><dd>${v}${s ? `<small>${s}</small>` : ''}</dd></div>`).join('')}</dl>`;
        const tags = tagsOf(run);
        if (tags.length) html += `<ul class="tags">${tags.map(t => `<li>${t}</li>`).join('')}</ul>`;
        if (run.description) html += `<p>${esc(run.description)}</p>`;
        html += profileChart(run.profile);
        html += vailSection(name);
      } else {
        html += `<p class="empty">OpenSkiMap doesn’t have details for this run yet.${EU ? '' : ' Its color on the trail map shows the official difficulty.'}</p>`;
      }
      html += `<div class="actions">
        <a class="btn btn-yt" href="${yt}" target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8zM9.8 15.1V8.9L15.6 12l-5.8 3.1z"/></svg>
          Watch on YouTube</a>`;
      if (run) html += `<a class="btn btn-outline" href="${openSkiMapUrl(run)}" target="_blank" rel="noopener">View on OpenSkiMap</a>`;
      html += `</div>`;
      html += `<p class="source">${liveNote('run', name, run)}${run ? ' Data © OpenStreetMap contributors, via OpenSkiMap.' : ''}</p>`;
      body.innerHTML = html;
      wireProfileCharts(body);
    },

    suggest() {
      const s = suggestState;
      let html = `<h2>Suggest a run</h2><p class="intro">Tell us how you ski and we’ll pick a few runs to try.</p>
        <h3>Your level</h3><div class="choices">${Object.entries(LEVELS).map(([k, v]) => `
          <button class="choice" data-set="level" data-val="${k}" aria-pressed="${s.level === k}">
            <span class="icon">${signIcon(v.icon, v.color)}</span><strong>${v.name}</strong><span>${v.blurb}</span></button>`).join('')}</div>
        <h3>What sounds fun?</h3><div class="chips">${Object.entries(STYLES).map(([k, v]) =>
          `<button class="chip" data-set="style" data-val="${k}" aria-pressed="${s.style === k}">${v.label}</button>`).join('')}</div>
        <h3>Where?</h3><div class="chips">${['any', ...AREAS.map(a => a.id)].map(p =>
          `<button class="chip" data-set="peak" data-val="${p}" aria-pressed="${s.peak === p}">${p === 'any' ? T.anyArea : areaName(p)}</button>`).join('')}</div>`;
      if (s.level) {
        const picks = suggestRuns(s);
        html += `<h3>Try these</h3>`;
        html += picks.length
          ? `<ul class="cards">${picks.map(p => `<li><button class="card" data-run="${esc(p.name)}">${iconFor(p)}
              <span><strong>${esc(p.name)}</strong><span class="why">${p.why}</span></span></button></li>`).join('')}</ul>
             <p><button class="btn btn-outline btn-sm" data-action="reshuffle">Show me different ones</button></p>`
          : `<p class="empty">No ${STYLES[s.style].label.toLowerCase()} runs at this level${s.peak !== 'any' ? ' (' + areaName(s.peak) + ')' : ''}. Try another style or “${T.anyArea}”.</p>`;
      } else {
        html += `<p class="empty">Pick your level to see suggestions.</p>`;
      }
      body.innerHTML = html;
    },

    list() {
      const s = listState;
      const rows = filteredRuns(s);
      body.innerHTML = `<h2>All runs</h2>
        <div class="list-controls">
          <div class="chips">${Object.entries(LEVELS).map(([k, v]) =>
            `<button class="chip" data-toggle-level="${k}" aria-pressed="${s.levels.has(k)}">${signIcon(v.icon, v.color)}${v.sign}</button>`).join('')}</div>
          <div class="line">
            <select data-set-list="peak" aria-label="${T.area}">${['any', ...AREAS.map(a => a.id)].map(p =>
              `<option value="${p}" ${s.peak === p ? 'selected' : ''}>${p === 'any' ? T.allAreas : areaName(p)}</option>`).join('')}</select>
            <select data-set-list="sort" aria-label="Sort by">${Object.entries(SORTS).map(([k, v]) =>
              `<option value="${k}" ${s.sort === k ? 'selected' : ''}>Sort: ${v.label}</option>`).join('')}</select>
          </div>
        </div>
        <p class="count">${rows.length} run${rows.length === 1 ? '' : 's'}</p>
        <ul class="row-list">${rows.map(r => `<li><button class="row" data-run="${esc(r.name)}">${iconFor(r)}
          <span class="name">${esc(r.name)}</span><span class="meta">${areaName(r.area)}${SORTS[s.sort].meta(r)}</span></button></li>`).join('')}</ul>`;
    },

    peaks() {
      body.innerHTML = `<h2>${T.areasTitle}</h2>
        <p class="intro">${T.areasIntro}</p>
        ${AREAS.map(p => {
          const mine = ALL.filter(r => r.area === p.id);
          const mix = Object.entries(LEVELS).map(([k, v]) => [v, mine.filter(r => r.level === k).length]).filter(([, n]) => n);
          return `<section class="peak"><h4>${p.name}</h4><p>${p.blurb}</p>
            <div class="mix">${mix.map(([v, n]) => `<span title="${v.sign}">${signIcon(v.icon, v.color)}${n}</span>`).join('')}<span class="sub">${mine.length} runs</span></div>
            <div class="btns"><button class="btn btn-outline btn-sm" data-show-peak="${p.id}">Show on map</button>
            <button class="btn btn-outline btn-sm" data-list-peak="${p.id}">List runs</button></div></section>`;
        }).join('')}
        <p class="source">${T.areasSource}</p>`;
    },

    weather() {
      body.innerHTML = `<h2>Mountain weather</h2><p class="intro">Loading the latest forecast…</p>`;
      getWeather().then(([base, top]) => {
        if (stack[stack.length - 1]?.type !== 'weather') return; // panel moved on while loading
        const m = wxCache.units === 'metric', windUnit = m ? 'km/h' : 'mph', snowUnit = m ? ' cm' : '"';
        const spot = (s, w) => {
          const [label, icon] = wxCode(w.current.weather_code, w.current.is_day);
          return `<div class="wx-spot"><div class="wx-name">${s.name}</div><div class="sub">${s.place} · ${fmtFt(s.elev)}</div>
            <div class="wx-now"><span class="wx-icon">${icon}</span><span class="wx-temp">${Math.round(w.current.temperature_2m)}°</span></div>
            <div class="wx-cond">${label}</div>
            <div class="sub">Feels like ${Math.round(w.current.apparent_temperature)}°</div>
            <div class="sub">Wind ${Math.round(w.current.wind_speed_10m)} ${windUnit}, gusts ${Math.round(w.current.wind_gusts_10m)}</div></div>`;
        };
        // Callouts a first-timer would want to know about (thresholds: 40 mph gusts, 3" of snow, 0°F)
        const alerts = [];
        if (top.current.wind_gusts_10m >= (m ? 65 : 40)) alerts.push(['💨', 'Strong winds up top', R.weather.windNote]);
        const snow24 = top.daily.snowfall_sum[0] + top.daily.snowfall_sum[1];
        if (snow24 >= (m ? 8 : 3)) alerts.push(['❄️', 'Fresh snow coming', `About ${snow24.toFixed(0)}${snowUnit} forecast up top today and tomorrow.`]);
        if (top.current.apparent_temperature <= (m ? -18 : 0)) alerts.push(['🥶', 'Bitter cold up top', 'Cover all skin; frostbite can happen fast in wind.']);
        const days = top.daily.time.map((t, i) => {
          const [label, icon] = wxCode(base.daily.weather_code[i]);
          const day = i === 0 ? 'Today' : new Date(t + 'T12:00').toLocaleDateString(undefined, { weekday: 'short' });
          const snow = top.daily.snowfall_sum[i];
          return `<li><span class="wx-day">${day}</span><span title="${label}">${icon}</span>
            <span class="wx-hilo">${Math.round(base.daily.temperature_2m_max[i])}° <span class="sub">/ ${Math.round(base.daily.temperature_2m_min[i])}°</span></span>
            <span class="wx-snow">${snow >= (m ? 0.5 : 0.1) ? '❄️ ' + snow.toFixed(m ? 0 : 1) + snowUnit : '<span class="sub">no snow</span>'}</span></li>`;
        }).join('');
        const updated = new Date(wxCache.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        body.innerHTML = `<h2>Mountain weather</h2><p class="intro">Updated ${updated}</p>
          <div class="wx-spots">${spot(WX_SPOTS[0], base)}${spot(WX_SPOTS[1], top)}</div>
          ${alerts.map(([i, t, d]) => `<div class="wx-alert"><span>${i}</span><div><strong>${t}</strong><span>${d}</span></div></div>`).join('')}
          <h3>Next 5 days</h3>
          <ul class="wx-days">${days}</ul>
          <p class="source">Temperatures for the base; snow for the summit. Forecast by <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a>, modeled for these elevations, not live station readings. Check the resort for lift and wind holds.</p>`;
      }).catch(() => {
        if (stack[stack.length - 1]?.type !== 'weather') return;
        body.innerHTML = `<h2>Mountain weather</h2><p class="empty">Couldn’t load the forecast. Check your connection and try again.</p>`;
      });
    },

    compare() {
      if (compareList.length < 2) {
        body.innerHTML = `<h2>Compare runs</h2>
          <p class="intro">See up to ${MAX_COMPARE} runs side by side: stats and elevation profiles on one chart.</p>
          ${compareList.length ? `<ul class="cmp-runs">${compareList.map(cmpChip).join('')}</ul>` : ''}
          <p class="empty">Open any run (tap it on the map, or use search or All runs) and tap <strong>Add to compare</strong>. ${compareList.length ? 'Pick one more.' : 'Pick at least two.'}</p>`;
        return;
      }
      const rs = compareList.map(n => RUNS[n]);
      // Each row: label, value per run, and which way is "most" (to bold the standout)
      const rows = [
        ['Difficulty', r => r.diff.label],
        [T.area, r => areaName(r.area)],
        ['Length', r => r.run?.lengthM ? fmtLen(r.run.lengthM) : '—', r => r.run?.lengthM],
        ['Vertical drop', r => r.run?.verticalM ? fmtFt(r.run.verticalM) : '—', r => r.run?.verticalM],
        ['Top', r => r.run?.topM ? fmtFt(r.run.topM) : '—', r => r.run?.topM],
        ['Bottom', r => r.run?.bottomM ? fmtFt(r.run.bottomM) : '—'],
        ['Avg grade', r => r.run?.avgGradePct ? `${r.run.avgGradePct}% (${deg(r.run.avgGradePct)})` : '—', r => r.run?.avgGradePct],
        ['Steepest', r => r.run?.maxGradePct ? `${r.run.maxGradePct}% (${deg(r.run.maxGradePct)})` : '—', r => r.run?.maxGradePct],
        ['Surface', r => (r.run ? tagsOf(r.run).filter(t => t !== 'Snowmaking').join(', ') : '') || '—'],
      ];
      const table = rows.map(([label, val, num]) => {
        const nums = num ? rs.map(r => num(r) ?? -Infinity) : null;
        const best = nums && Math.max(...nums) > -Infinity ? Math.max(...nums) : null;
        return `<tr><th scope="row">${label}</th>${rs.map((r, i) =>
          `<td class="${best !== null && nums[i] === best && rs.length > 1 ? 'best' : ''}">${val(r)}</td>`).join('')}</tr>`;
      }).join('');
      body.innerHTML = `<h2>Compare runs</h2>
        <ul class="cmp-runs">${compareList.map(cmpChip).join('')}</ul>
        ${compareProfiles(rs)}
        <div class="cmp-table-wrap"><table class="cmp-table">
          <thead><tr><th></th>${rs.map((r, i) => `<th scope="col"><span class="swatch" style="background:${CMP_COLORS[i]}"></span>${esc(r.name)}</th>`).join('')}</tr></thead>
          <tbody>${table}</tbody></table></div>
        <p class="source">Bold = the most of that stat. Stats from OpenSkiMap.</p>`;
    },

    tips() {
      body.innerHTML = `<h2>First-timer tips</h2>
        <ul class="tips">${R.tips.map(([t, d]) => `<li><strong>${t}</strong><span>${d}</span></li>`).join('')}</ul>
        <p class="source">General advice for planning. On the mountain, follow posted signs, closures and ski patrol.</p>`;
    },
  };

  function tagsOf(run) {
    const tags = [];
    if (run.isArea) tags.push('Open area / bowl');
    if (run.grooming.some(g => g === 'classic' || g === 'skating' || g === 'classic+skating')) tags.push('Groomed');
    if (run.grooming.includes('mogul')) tags.push('Moguls');
    if (run.grooming.includes('backcountry')) tags.push('Ungroomed');
    if (run.gladed) tags.push('Gladed / trees');
    if (run.snowmaking) tags.push('Snowmaking');
    if (run.lit) tags.push('Lit at night');
    return tags;
  }
  // Elevation profile matching OpenSkiMap's: the area under the line is colored by the difficulty each
  // stretch's steepness would rate (their scale: under 5% unrated, under 25% easy, under 40% intermediate,
  // up to 100% advanced or expert, beyond that extreme), in the resort's own colors. Hovering (or tapping)
  // shows elevation and slope at that point.
  const SLOPE_BANDS = [ // max grade % for the band, color, legend label
    [5, '#b8bec7', 'Nearly flat'],
    [25, EU ? '#4a85c4' : '#4cb85c', 'Easy pitch, under 14°'],
    [40, EU ? '#d9363e' : '#4a85c4', 'Intermediate, 14–22°'],
    [100, '#3b4048', 'Steep, 22–45°'],
    [Infinity, '#e8730c', 'Extreme, 45°+'],
  ];
  const bandOf = grade => SLOPE_BANDS.findIndex(([max]) => grade < max);
  // One band per stretch of the profile. Like OpenSkiMap, long profiles are colored in at most ~50 blocks,
  // each taking its steepest stretch, so a short steep pitch still shows.
  function slopeBands(profile) {
    const raw = profile.slice(1).map(([d, e], i) => bandOf(Math.abs(e - profile[i][1]) / Math.max(d - profile[i][0], 1) * 100));
    let block = 1;
    while (raw.length / block > 50) block *= 2;
    return raw.map((_, i) => Math.max(...raw.slice(i - i % block, i - i % block + block)));
  }
  const CH = { w: 320, h: 168, l: 50, r: 312, t: 10, b: 136 }; // chart size and plot area
  function niceStep(span, target) {
    const raw = span / target, mag = 10 ** Math.floor(Math.log10(raw));
    return [1, 2, 2.5, 5, 10].map(m => m * mag).find(st => st >= raw);
  }
  function profileChart(profile) {
    if (!profile || profile.length < 3) return '';
    const maxD = profile[profile.length - 1][0];
    const EL = metric() ? 1 : FT, elUnit = metric() ? ' m' : ' ft';
    const ftEls = profile.map(q => q[1] * EL);
    const step = niceStep(Math.max(...ftEls) - Math.min(...ftEls), 4);
    const lo = Math.floor(Math.min(...ftEls) / step) * step, hi = Math.ceil(Math.max(...ftEls) / step) * step;
    const X = d => CH.l + d / maxD * (CH.r - CH.l), Y = ft => CH.b - (ft - lo) / (hi - lo) * (CH.b - CH.t);
    // Colored bands: merge consecutive stretches of the same steepness into one shape
    const bands = slopeBands(profile);
    let shapes = '', run = null;
    const flush = () => { if (run) shapes += `<polygon fill="${SLOPE_BANDS[run.band][1]}" points="${run.pts.join(' ')} ${run.x1},${CH.b} ${run.x0},${CH.b}"/>`; };
    for (let i = 0; i < profile.length - 1; i++) {
      const [d0, e0] = profile[i], [d1, e1] = profile[i + 1];
      const band = bands[i];
      const a = `${X(d0).toFixed(1)},${Y(e0 * EL).toFixed(1)}`, b = `${X(d1).toFixed(1)},${Y(e1 * EL).toFixed(1)}`;
      if (run && run.band === band) { run.pts.push(b); run.x1 = X(d1).toFixed(1); }
      else { flush(); run = { band, pts: [a, b], x0: X(d0).toFixed(1), x1: X(d1).toFixed(1) }; }
    }
    flush();
    const line = profile.map(([d, e]) => `${X(d).toFixed(1)},${Y(e * EL).toFixed(1)}`).join(' ');
    // Axes: elevation on the left, distance along the bottom ending with the total
    let axes = '';
    for (let ft = lo; ft <= hi + 1; ft += step) {
      axes += `<line x1="${CH.l}" x2="${CH.r}" y1="${Y(ft)}" y2="${Y(ft)}" class="grid"/><text x="${CH.l - 4}" y="${Y(ft) + 3}" class="axis" text-anchor="end">${Math.round(ft).toLocaleString()}${elUnit}</text>`;
    }
    // Long runs are marked in miles or kilometers, short ones in feet or meters
    const miles = metric() ? maxD >= 1000 : maxD * FT >= 2640;
    const perM = metric() ? (miles ? 1 / 1000 : 1) : (miles ? FT / 5280 : FT);
    const toUnit = m => m * perM, bigUnit = metric() ? ' km' : ' mi';
    const xStep = niceStep(toUnit(maxD), 4);
    for (let u = 0; u < toUnit(maxD) * 0.88; u += xStep) {
      const x = X(u / perM);
      axes += `<line x1="${x}" x2="${x}" y1="${CH.t}" y2="${CH.b}" class="grid"/><text x="${x}" y="${CH.b + 14}" class="axis" text-anchor="middle">${u === 0 ? '0' : miles ? +u.toFixed(2) + bigUnit : Math.round(u).toLocaleString() + elUnit}</text>`;
    }
    axes += `<text x="${CH.r}" y="${CH.b + 14}" class="axis" text-anchor="end">${miles ? toUnit(maxD).toFixed(2) + bigUnit : fmtFt(maxD)}</text>`;
    const used = [...new Set(bands)].sort();
    return `<div class="profile"><h3>Elevation profile</h3>
      <div class="elev" data-profile='${JSON.stringify(profile)}' data-lo="${lo}" data-hi="${hi}">
        <svg viewBox="0 0 ${CH.w} ${CH.h}" class="elev-chart" role="img" aria-label="Elevation profile, colored by steepness">
          ${axes}${shapes}<polyline points="${line}" class="elev-line"/>
          <g class="elev-cursor" visibility="hidden"><line y1="${CH.t}" y2="${CH.b}" class="elev-guide"/><circle r="5" class="elev-dot"/></g>
        </svg>
        <div class="elev-tip" hidden></div>
      </div>
      <ul class="elev-legend">${used.map(i => `<li><span class="swatch" style="background:${SLOPE_BANDS[i][1]}"></span>${SLOPE_BANDS[i][2]}</li>`).join('')}</ul>
      <p class="source">Elevation data from OpenSkiMap, colored the way their chart is. Hover or tap for elevation and slope.</p></div>`;
  }
  // Hover/tap readout for every profile chart in the panel
  function wireProfileCharts(root) {
    root.querySelectorAll('.elev').forEach(el => {
      const profile = JSON.parse(el.dataset.profile), lo = +el.dataset.lo, hi = +el.dataset.hi;
      const svg = el.querySelector('svg'), cursor = el.querySelector('.elev-cursor'), tip = el.querySelector('.elev-tip');
      const maxD = profile[profile.length - 1][0];
      const show = e => {
        const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
        const d = Math.min(Math.max((pt.x - CH.l) / (CH.r - CH.l), 0), 1) * maxD;
        let i = 0;
        while (i < profile.length - 1 && profile[i + 1][0] <= d) i++;
        const j = Math.min(i + 1, profile.length - 1), k = j === i ? i - 1 : i; // the stretch under the cursor
        const grade = Math.abs(profile[j][1] - profile[k][1]) / Math.max(profile[j][0] - profile[k][0], 1) * 100;
        const near = d - profile[i][0] < (profile[j][0] - d) ? i : j;
        const ft = profile[near][1] * (metric() ? 1 : FT);
        const x = CH.l + profile[near][0] / maxD * (CH.r - CH.l), y = CH.b - (ft - lo) / (hi - lo) * (CH.b - CH.t);
        cursor.setAttribute('visibility', 'visible');
        cursor.querySelector('line').setAttribute('x1', x); cursor.querySelector('line').setAttribute('x2', x);
        cursor.querySelector('circle').setAttribute('cx', x); cursor.querySelector('circle').setAttribute('cy', y);
        tip.innerHTML = `<strong>${Math.round(ft).toLocaleString()}${metric() ? ' m' : ' ft'}</strong><span>${deg(grade)} (${Math.round(grade)}%)</span><span class="sub">${fmtLen(profile[near][0])} in</span>`;
        tip.hidden = false;
        const box = el.getBoundingClientRect();
        const px = (x / CH.w) * box.width;
        tip.style.left = Math.min(Math.max(px + 12, 0), box.width - tip.offsetWidth) + 'px';
        if (px + 12 + tip.offsetWidth > box.width) tip.style.left = Math.max(px - 12 - tip.offsetWidth, 0) + 'px';
        tip.style.top = Math.max((y / CH.h) * box.height - tip.offsetHeight - 10, 0) + 'px';
      };
      const hide = () => { cursor.setAttribute('visibility', 'hidden'); tip.hidden = true; };
      svg.addEventListener('pointermove', show);
      svg.addEventListener('pointerdown', show);
      svg.addEventListener('pointerleave', hide);
    });
  }

  // ---------- Suggest a run ----------
  const suggestState = { level: null, style: 'any', peak: 'any', shuffle: 0 };
  const isGroomed = run => run.grooming.some(g => g.includes('classic') || g === 'skating');
  // Each style filters the candidates and scores them (higher = better fit)
  const STYLES = {
    any: { label: 'Surprise me', ok: () => true, score: r => (r.run.lengthM || 300) },
    cruise: { label: 'Long cruisers', ok: r => !r.run.isArea && r.run.lengthM > 500, score: r => r.run.lengthM + (isGroomed(r.run) ? 400 : 0) },
    mellow: { label: 'Easy warm-up', ok: r => !r.run.isArea && r.run.avgGradePct != null, score: r => -r.run.avgGradePct },
    steep: { label: 'Steep', ok: r => r.run.maxGradePct != null || r.run.isArea, score: r => (r.run.maxGradePct ?? 0) + (r.run.isArea ? 15 : 0) },
    bumps: { label: 'Moguls', ok: r => r.run.grooming.includes('mogul'), score: r => r.run.lengthM || 0 },
    trees: { label: 'Trees', ok: r => r.run.gladed, score: r => r.run.lengthM || 0 },
    bowls: { label: 'Bowls & open terrain', ok: r => r.run.isArea || /bowl|chute/i.test(r.name), score: r => r.run.verticalM || 0 },
  };
  function suggestRuns(s) {
    const style = STYLES[s.style];
    // Skip short connectors: they're on the map but not much of a run on their own
    const pool = ALL.filter(r => r.run && r.level === s.level && (s.peak === 'any' || r.area === s.peak) &&
      (r.run.isArea || r.run.lengthM >= 250) && style.ok(r))
      .sort((a, b) => style.score(b) - style.score(a)).slice(0, 12);
    // Rotate through the best matches, three at a time
    const start = (s.shuffle * 3) % Math.max(pool.length, 1);
    const picks = [...pool.slice(start), ...pool.slice(0, start)].slice(0, 3);
    return picks.map(r => ({ ...r, why: whyText(r) }));
  }
  function whyText(r) {
    const run = r.run, bits = [];
    if (run.lengthM) bits.push(fmtLen(run.lengthM));
    if (run.verticalM) bits.push(fmtFt(run.verticalM) + ' drop');
    if (run.avgGradePct) bits.push(`avg ${deg(run.avgGradePct)} slope`);
    const tags = tagsOf(run).filter(t => t !== 'Snowmaking');
    return [areaName(r.area), ...bits, ...tags].join(' · ');
  }

  // ---------- All runs ----------
  const listState = { levels: new Set(), peak: 'any', sort: 'az' };
  const SORTS = {
    az: { label: 'Name', key: r => r.name, asc: true, meta: r => (r.run?.lengthM ? ' · ' + fmtLen(r.run.lengthM) : '') },
    length: { label: 'Longest', key: r => r.run?.lengthM ?? -1, meta: r => (r.run?.lengthM ? ' · ' + fmtLen(r.run.lengthM) : '') },
    vertical: { label: 'Most vertical', key: r => r.run?.verticalM ?? -1, meta: r => (r.run?.verticalM ? ' · ' + fmtFt(r.run.verticalM) : '') },
    steep: { label: 'Steepest', key: r => r.run?.maxGradePct ?? -1, meta: r => (r.run?.maxGradePct ? ' · ' + deg(r.run.maxGradePct) + ' max' : '') },
  };
  function filteredRuns(s) {
    const sort = SORTS[s.sort];
    return ALL.filter(r => (!s.levels.size || s.levels.has(r.level)) && (s.peak === 'any' || r.area === s.peak))
      .sort((a, b) => sort.asc ? byName(a.name, b.name) : sort.key(b) - sort.key(a) || byName(a.name, b.name));
  }

  // ---------- Compare runs ----------
  const MAX_COMPARE = 3;
  const CMP_COLORS = ['#0b63ce', '#e8590c', '#2b8a3e'];
  let compareList = [];
  function compareButton(name) {
    const on = compareList.includes(name);
    return `<button class="cmp-toggle" data-compare="${esc(name)}" aria-pressed="${on}">${on ? '✓ In compare' : '+ Add to compare'}</button>`;
  }
  function toggleCompare(name) {
    if (compareList.includes(name)) compareList = compareList.filter(n => n !== name);
    else if (compareList.length >= MAX_COMPARE) return toast(`You can compare up to ${MAX_COMPARE} runs`);
    else {
      compareList.push(name);
      if (compareList.length >= 2) toast(`${compareList.length} runs ready: tap Compare`);
    }
    $('cmp-count').textContent = compareList.length;
    $('cmp-count').hidden = !compareList.length;
  }
  const cmpChip = (n, i) => `<li><span class="swatch" style="background:${CMP_COLORS[i]}"></span>
    <button class="link" data-run="${esc(n)}">${esc(n)}</button>
    <button class="icon-btn sm" data-uncompare="${esc(n)}" aria-label="Remove ${esc(n)}">×</button></li>`;
  // Elevation profiles on one chart, in real feet, so you can see which run is longer, higher and steeper
  function compareProfiles(rs) {
    const withProfile = rs.map((r, i) => ({ r, i, p: r.run?.profile })).filter(x => x.p && x.p.length > 2);
    if (!withProfile.length) return '';
    const maxD = Math.max(...withProfile.map(x => x.p[x.p.length - 1][0]));
    const els = withProfile.flatMap(x => x.p.map(q => q[1]));
    const lo = Math.min(...els), hi = Math.max(...els), span = Math.max(hi - lo, 1);
    const X = d => 40 + d / maxD * 250, Y = e => 10 + (1 - (e - lo) / span) * 120;
    const lines = withProfile.map(x => `<polyline points="${x.p.map(([d, e]) => X(d).toFixed(1) + ',' + Y(e).toFixed(1)).join(' ')}"
      fill="none" stroke="${CMP_COLORS[x.i]}" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`).join('');
    return `<div class="profile"><h3>Elevation profiles</h3>
      <svg viewBox="0 0 300 150" class="cmp-chart" role="img" aria-label="Elevation profiles of the compared runs">
        <line x1="40" y1="10" x2="290" y2="10" class="grid"/><line x1="40" y1="130" x2="290" y2="130" class="grid"/>
        <text x="36" y="14" class="axis" text-anchor="end">${fmtFt(hi)}</text>
        <text x="36" y="133" class="axis" text-anchor="end">${fmtFt(lo)}</text>
        <text x="40" y="146" class="axis">0</text>
        <text x="290" y="146" class="axis" text-anchor="end">${fmtLen(maxD)}</text>
        ${lines}</svg>
      <p class="source">Each line is the longest continuous stretch OpenSkiMap has for that run, so it can be shorter than the run’s full length.</p></div>`;
  }

  // ---------- Compared to Vail ----------
  // Every rated Breck run gets a trademark Vail run of the same difficulty to compare against, picked
  // automatically (closest in average slope and length, favoring the famous ones). Users can search all
  // Vail runs to compare against any other.
  const vailPick = {}; // Breck run name -> Vail run name the user chose
  let vailSearchFor = null; // Breck run whose Vail search box is open
  const vailLevel = name => diffOf(VAIL[name]).level;
  const VAIL_NAMES = Object.keys(VAIL).sort((a, b) => a.localeCompare(b));
  function defaultVail(r) {
    const run = r.run;
    const score = ([n, v]) => {
      let s = v.note ? -0.4 : 0; // a run they'll recognize beats a slightly closer match
      if (run.avgGradePct != null && v.avgGradePct != null) s += Math.abs(run.avgGradePct - v.avgGradePct) / 6;
      if (run.lengthM && v.lengthM) s += Math.abs(Math.log(run.lengthM / v.lengthM));
      else if (run.verticalM && v.verticalM) s += Math.abs(Math.log(run.verticalM / v.verticalM));
      return s;
    };
    const same = Object.entries(VAIL).filter(([n]) => vailLevel(n) === r.naLevel);
    const trademark = same.filter(([, v]) => v.signature);
    return (trademark.length ? trademark : same).sort((a, b) => score(a) - score(b))[0]?.[0] || null;
  }
  // Search results: with no query, trademark runs (this run's level first); otherwise every matching Vail run
  function vailResults(breckName, q) {
    const level = RUNS[breckName].naLevel, nq = norm(q);
    const names = !nq
      ? VAIL_NAMES.filter(n => VAIL[n].signature).sort((a, b) => (vailLevel(b) === level) - (vailLevel(a) === level) || a.localeCompare(b))
      : VAIL_NAMES.filter(n => norm(n).includes(nq)).sort((a, b) => norm(b).startsWith(nq) - norm(a).startsWith(nq));
    if (!names.length) return '<li class="sub vail-none">No Vail runs match</li>';
    return names.slice(0, 40).map(n => {
      const v = VAIL[n], d = diffOf(v);
      return `<li><button class="vail-option" data-vail-choose="${esc(n)}" data-for="${esc(breckName)}">${signIcon(d.icon, d.color)}
        <span class="name">${esc(n)}</span>${v.signature ? '<span class="tm">Trademark</span>' : ''}
        <span class="meta">${v.lengthM ? fmtLen(v.lengthM) : v.isArea ? 'Bowl' : ''}</span></button></li>`;
    }).join('');
  }

  function vailSection(name) {
    const r = RUNS[name];
    if (!r.run || !r.level || !Object.keys(VAIL).length) return '';
    const vName = vailPick[name] || defaultVail(r);
    if (!vName) return '';
    refresh('vail', vName);
    const b = r.run, v = VAIL[vName], vd = diffOf(v);
    const cell = (x, f) => (x ? f(x) : '—');
    const rows = [
      ['Difficulty', r.diff.label, vd.label],
      ['Length', cell(b.lengthM, fmtLen), cell(v.lengthM, fmtLen)],
      ['Vertical drop', cell(b.verticalM, fmtFt), cell(v.verticalM, fmtFt)],
      ['Average slope', cell(b.avgGradePct, deg), cell(v.avgGradePct, deg)],
      ['Steepest pitch', cell(b.maxGradePct, deg), cell(v.maxGradePct, deg)],
      ['Top elevation', cell(b.topM, fmtFt), cell(v.topM, fmtFt)],
    ];
    const notes = vailCommentary(r, vName, v);
    return `<section class="vail">
      <h3>Compared to Vail</h3>
      <div class="vail-pick"><span>Compare with</span>
        <button class="vail-current" data-vail-open="${esc(name)}" aria-expanded="${vailSearchFor === name}">
          ${signIcon(vd.icon, vd.color)}<span class="name">${esc(vName)}</span><span class="change">Change</span></button></div>
      ${vailSearchFor === name ? `<div class="vail-search">
        <input type="search" data-vail-search="${esc(name)}" placeholder="Search all ${VAIL_NAMES.length} Vail runs…" autocomplete="off" aria-label="Search Vail runs">
        <p class="sub">Trademark runs shown first. Type to search every Vail run.</p>
        <ul class="vail-results">${vailResults(name, '')}</ul></div>` : ''}
      <p class="vail-headline">${notes.headline}</p>
      ${EU ? '<p class="sub">Ratings differ: a European blue is about a US green, a red is about a US blue, and black is black.</p>' : ''}
      <table class="cmp-table vail-table">
        <thead><tr><th></th>
          <th scope="col"><span class="swatch" style="background:${CMP_COLORS[0]}"></span>${esc(name)}</th>
          <th scope="col"><span class="swatch" style="background:${CMP_COLORS[1]}"></span>${esc(vName)} <span class="sub">(Vail)</span></th></tr></thead>
        <tbody>${rows.map(([k, x, y]) => `<tr><th scope="row">${k}</th><td>${x}</td><td>${y}</td></tr>`).join('')}</tbody></table>
      <ul class="vail-notes">${notes.points.map(p => `<li>${p}</li>`).join('')}</ul>
      ${compareProfiles([{ run: b }, { run: v }])}
    </section>`;
  }

  // Plain-English comparison, written from the stats (no hand-written text per run pair)
  function vailCommentary(r, vName, v) {
    const b = r.run, V = esc(vName), points = [];
    const slope = p => Math.atan(p / 100) * 180 / Math.PI;
    const dSlope = b.avgGradePct != null && v.avgGradePct != null ? slope(b.avgGradePct) - slope(v.avgGradePct) : null;
    const lenRatio = b.lengthM && v.lengthM ? b.lengthM / v.lengthM : null;
    const pct = x => Math.round(Math.abs(x - 1) * 100);

    // One-line takeaway: "a steeper, shorter Riva Ridge"
    const traits = [];
    if (dSlope !== null && dSlope >= 2.5) traits.push('steeper');
    if (dSlope !== null && dSlope <= -2.5) traits.push('gentler');
    if (lenRatio && lenRatio >= 1.15) traits.push('longer');
    if (lenRatio && lenRatio <= 0.87) traits.push('shorter');
    let headline = traits.length
      ? `Think of it as a ${traits.join(', ')} ${V}.`
      : `Skis a lot like ${V}${lenRatio ? ': similar length and pitch' : ''}.`;
    if (v.note) headline += ` <span class="sub">(${V} is ${esc(v.note)}.)</span>`;
    if (b.isArea) headline = `It’s an open bowl, not a trail, so there’s no set line to compare with ${V}: you choose how steep to ski it.` +
      (v.note ? ` <span class="sub">(${V} is ${esc(v.note)}.)</span>` : '');

    if (lenRatio && b.verticalM && v.verticalM) {
      const len = lenRatio < 1.15 && lenRatio > 0.87 ? `about the same length as ${V}` : `${pct(lenRatio)}% ${lenRatio > 1 ? 'longer' : 'shorter'} than ${V}`;
      const dv = b.verticalM - v.verticalM; // meters; "about the same" is within 100 ft
      const vert = Math.abs(dv) < 30 ? 'about the same vertical' : `${fmtFt(Math.abs(dv))} ${dv > 0 ? 'more' : 'less'} vertical`;
      points.push(`At ${fmtLen(b.lengthM)}, it’s ${len}, with ${vert}.`);
    } else if (b.verticalM && v.verticalM) {
      points.push(`It drops ${fmtFt(b.verticalM)} top to bottom, compared with ${fmtFt(v.verticalM)} on ${V}.`);
    }
    if (dSlope !== null) {
      const feel = Math.abs(dSlope) < 2.5 ? 'about the same overall pitch' : dSlope > 0 ? 'noticeably steeper overall' : 'noticeably gentler overall';
      points.push(`Average slope is ${Math.round(slope(b.avgGradePct))}° vs ${Math.round(slope(v.avgGradePct))}°: ${feel}.`);
    }
    if (b.maxGradePct && v.maxGradePct) {
      const dMax = slope(b.maxGradePct) - slope(v.maxGradePct);
      points.push(Math.abs(dMax) < 3
        ? `Its steepest pitch (${Math.round(slope(b.maxGradePct))}°) is about as steep as the steepest part of ${V}.`
        : `Its steepest pitch is ${Math.round(slope(b.maxGradePct))}° vs ${Math.round(slope(v.maxGradePct))}° on ${V}, so the hardest part is ${dMax > 0 ? 'tougher' : 'easier'}.`);
    }
    // The big Breck vs Vail difference: altitude
    if (b.topM && v.topM) {
      const dTop = b.topM - v.topM; // meters; only worth a mention beyond about 400 ft
      const round = x => fmtFt(metric() ? Math.round(x / 50) * 50 : Math.round(x * FT / 100) * 100 / FT);
      if (dTop > 120) points.push(`It starts ${round(dTop)} higher than ${V} (${fmtFt(b.topM)}). The air is thinner, so expect to tire sooner on your first days.`);
      else if (dTop < -120) points.push(`It sits ${round(-dTop)} lower than ${V}.`);
    }
    const bt = tagsOf(b), vt = tagsOf(v);
    if (bt.includes('Moguls') && !vt.includes('Moguls')) points.push(`OpenSkiMap lists it as a mogul run, unlike ${V}.`);
    if (bt.includes('Gladed / trees') && !vt.includes('Gladed / trees')) points.push('It’s gladed: expect to ski through trees.');
    if (bt.includes('Groomed') && vt.includes('Moguls')) points.push(`It’s groomed, so smoother than ${V}’s bumps.`);
    if (diffOf(v).level !== r.naLevel) points.push(`Heads up: ${V} is rated ${diffOf(v).label}${EU ? ' at Vail' : ''}, this run is ${r.diff.label}${EU ? ' (' + LEVELS[r.level].sign.toLowerCase() + ')' : ''}.`);
    return { headline, points };
  }

  // ---------- Sharing ----------
  // Links point at run/<slug>/, a small page with a preview card (built by tools/make-share-pages.html)
  // that forwards to #run/<slug>.
  async function shareRun(name) {
    const r = RUNS[name], d = r.diff;
    const url = SITE_URL + R.sharePath(slugOf(name));
    const text = `${name} at ${R.name}: ${d.label}, ${areaName(r.area)}`;
    if (navigator.share && isTouch) {
      try { await navigator.share({ title: name, text, url }); } catch { /* closed the share sheet */ }
      return;
    }
    try { await navigator.clipboard.writeText(url); toast('Link copied: paste it anywhere'); }
    catch { prompt('Copy this link:', url); }
  }
  let toastTimer;
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
  }

  // ---------- Panel interactions (one delegated handler) ----------
  body.addEventListener('click', e => {
    const t = e.target.closest('button');
    if (!t) return;
    const view = stack[stack.length - 1];
    if (t.dataset.share) return shareRun(t.dataset.share);
    if (t.dataset.vailOpen) {
      vailSearchFor = vailSearchFor === t.dataset.vailOpen ? null : t.dataset.vailOpen;
      keepScroll(() => VIEWS.run({ name: t.dataset.vailOpen }));
      return body.querySelector('[data-vail-search]')?.focus({ preventScroll: true });
    }
    if (t.dataset.vailChoose) {
      vailPick[t.dataset.for] = t.dataset.vailChoose;
      vailSearchFor = null;
      return keepScroll(() => VIEWS.run({ name: t.dataset.for }));
    }
    if (t.dataset.compare) { toggleCompare(t.dataset.compare); t.outerHTML = compareButton(t.dataset.compare); return; }
    if (t.dataset.uncompare) { toggleCompare(t.dataset.uncompare); return keepScroll(() => VIEWS.compare()); }
    if (t.dataset.run) return openRun(t.dataset.run, { from: view.type });
    if (t.dataset.set) {
      suggestState[t.dataset.set] = t.dataset.val;
      suggestState.shuffle = 0;
      return keepScroll(() => VIEWS.suggest());
    }
    if (t.dataset.action === 'reshuffle') { suggestState.shuffle++; return keepScroll(() => VIEWS.suggest()); }
    if (t.dataset.toggleLevel) {
      const k = t.dataset.toggleLevel;
      listState.levels.has(k) ? listState.levels.delete(k) : listState.levels.add(k);
      return keepScroll(() => VIEWS.list());
    }
    if (t.dataset.showPeak) {
      const ls = ALL.filter(r => r.area === t.dataset.showPeak).flatMap(r => hotspots[r.name]);
      if (isMobile()) closePanel();
      return map.flyToBounds(L.featureGroup(ls).getBounds(), { padding: [30, 30], duration: 0.7 });
    }
    if (t.dataset.listPeak) {
      Object.assign(listState, { peak: t.dataset.listPeak, levels: new Set() });
      saveScroll();
      return showView({ type: 'list' }, { push: true });
    }
  });
  body.addEventListener('change', e => {
    const k = e.target.dataset.setList;
    if (k) { listState[k] = e.target.value; keepScroll(() => VIEWS.list()); }
  });
  body.addEventListener('input', e => {
    const breckRun = e.target.dataset.vailSearch;
    if (breckRun) body.querySelector('.vail-results').innerHTML = vailResults(breckRun, e.target.value);
  });
  const keepScroll = fn => { const y = panel.scrollTop; fn(); panel.scrollTop = y; };

  $('back').addEventListener('click', back);
  $('close').addEventListener('click', closePanel);
  document.querySelectorAll('.tool[data-open]').forEach(b => b.addEventListener('click', () => {
    const open = stack.length && stack[stack.length - 1].type === b.dataset.open;
    open ? closePanel() : showView({ type: b.dataset.open });
  }));

  // ---------- Feet / meters ----------
  const unitsLabel = () => { $('units').textContent = metric() ? 'Units: m · km' : 'Units: ft · mi'; };
  unitsLabel();
  $('units').addEventListener('click', () => {
    units = metric() ? 'imperial' : 'metric';
    try { localStorage.setItem(UNITS_KEY, units); } catch { /* private browsing */ }
    unitsLabel();
    if (stack.length) keepScroll(renderTop);
    showWxChip();
  });

  // ---------- Level highlight toggles ----------
  document.querySelectorAll('.level').forEach(b => {
    b.addEventListener('click', () => {
      const k = b.dataset.level;
      levelsOn.has(k) ? levelsOn.delete(k) : levelsOn.add(k);
      b.setAttribute('aria-pressed', levelsOn.has(k));
      for (const r of ALL) if (r.level === k && r.name !== selected) setStyle(r.name, baseStyle(r.name));
    });
  });

  // ---------- Search ----------
  const searchInput = $('search'), resultsList = $('results');
  let active = -1;
  function showResults() {
    const q = norm(searchInput.value);
    if (!q) return hideResults();
    const hits = ALL.filter(r => norm(r.name).includes(q))
      .sort((a, b) => norm(b.name).startsWith(q) - norm(a.name).startsWith(q)).slice(0, 8);
    active = hits.length ? 0 : -1;
    resultsList.innerHTML = hits.length
      ? hits.map((r, i) => `<li role="option" data-name="${esc(r.name)}" aria-selected="${i === 0}">${iconFor(r)}${esc(r.name)}<span class="meta">${areaName(r.area)}</span></li>`).join('')
      : '<li aria-disabled="true">No matching runs</li>';
    resultsList.hidden = false;
  }
  function hideResults() { resultsList.hidden = true; active = -1; }
  function choose(name) {
    hideResults(); searchInput.value = ''; searchInput.blur();
    showView({ type: 'run', name });
    flyToRun(name);
  }
  searchInput.addEventListener('input', showResults);
  searchInput.addEventListener('keydown', e => {
    const items = [...resultsList.querySelectorAll('li[data-name]')];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!items.length) return;
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach((li, i) => li.setAttribute('aria-selected', i === active));
    } else if (e.key === 'Enter' && items[active]) choose(items[active].dataset.name);
  });
  resultsList.addEventListener('click', e => { const li = e.target.closest('li[data-name]'); if (li) choose(li.dataset.name); });
  document.addEventListener('click', e => { if (!e.target.closest('.search')) hideResults(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closePanel(); hideResults(); } });

  // Current conditions on the toolbar button, so the weather is visible without opening anything
  function showWxChip() {
    getWeather().then(([base]) => {
      $('wx-chip').textContent = `${wxCode(base.current.weather_code, base.current.is_day)[1]} ${Math.round(base.current.temperature_2m)}°`;
    }).catch(() => {});
  }
  showWxChip();

  route();
  window.APP = { get map() { return map; }, RUNS, openRun, showView, levelsOn }; // handy for debugging in the console
})();
