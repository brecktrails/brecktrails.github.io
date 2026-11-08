// Breck Trail Explorer: the official trail map with tappable run names, plus tools for first-time visitors.
// Data comes from data/breck.json, built by tools/extract.html:
//   labels: where each run name is printed on the map (PDF points, origin top-left)
//   runs:   OpenSkiMap details for each run name that could be matched
const OFFICIAL_PDF = 'https://www.breckenridge.com/-/aemasset/sitecore/breckenridge/maps/winter-2025-2026/20250926_BR_winter-trail_map_001.pdf';
const FT = 3.28084;
const isTouch = matchMedia('(pointer: coarse)').matches;
const isMobile = () => matchMedia('(max-width: 767px)').matches;
const $ = id => document.getElementById(id);

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const fmtFt = m => Math.round(m * FT).toLocaleString() + ' ft';
const fmtLen = m => m * FT >= 5280 ? (m * FT / 5280).toFixed(1) + ' mi' : fmtFt(m);
const deg = pct => Math.round(Math.atan(pct / 100) * 180 / Math.PI) + '°';
// "Lower 4 O’Clock" -> "lower-4-oclock": used in share links and the run/<slug>/ preview pages
const slugOf = name => norm(name).replace(/ /g, '-');
const SITE_URL = 'https://brecktrails.github.io/';

// ---------- Difficulty ----------
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
const LEVELS = {
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
const diffOf = run => DIFFICULTY[run?.difficulty] || UNRATED;
const iconFor = run => { const d = diffOf(run); return `<span class="icon">${signIcon(d.icon, d.color)}</span>`; };

// ---------- Peaks ----------
const PEAKS = [
  { id: 10, blurb: 'The quietest peak and mostly advanced: black runs and tree skiing off the Falcon SuperChair.' },
  { id: 9, blurb: 'Gentle greens and blues on the lower mountain, with steep expert runs up top off E-Chair. Quicksilver connects it to town.' },
  { id: 8, blurb: 'The hub. Learning areas at the base, cruisers in the middle, and high-alpine bowls up top, including the Imperial SuperChair.' },
  { id: 7, blurb: 'Wide, easygoing blue cruisers off the Independence SuperChair, with bowls above treeline.' },
  { id: 6, blurb: 'Big, open above-treeline bowls and intermediate terrain off the Kensho SuperChair and Zendo Chair.' },
];
// Which peak a run belongs to, from where its name sits on the map (peaks run left to right: 10 → 6).
// Approximate: boundaries are drawn by eye, with overrides for names that sit across a boundary.
const PEAK_OVERRIDES = { 'Upper Lehman': 9, 'Whale’s Tail': 8, 'Easiest Way to Peak 9': 8 };
function peakOf(l) {
  if (PEAK_OVERRIDES[l.name]) return PEAK_OVERRIDES[l.name];
  if (l.x < 225 && l.y < 620) return 10;
  if (l.x < 470) return 9;
  if (l.x < 850) return 8;
  if (l.x < 1075) return 7;
  return 6;
}

// ---------- Tips ----------
const TIPS = [
  ['Take it easy on the altitude', 'The base is about 9,600 ft and lifts go above 12,800 ft. Drink lots of water, go easy on day one, and expect to get winded faster than usual.'],
  ['Get there on the free gondola', 'The BreckConnect Gondola runs from the North Gondola lot in town to the Peak 7 and Peak 8 bases. The Quicksilver SuperChair also leaves from the Peak 9 base near town.'],
  ['Where beginners should start', 'Head to the learning areas at the Peak 8 and Peak 9 bases. Peak 9’s lower mountain has the most green runs to progress to.'],
  ['Ski back to town', 'Lower 4 O’Clock and Lowest 4 O’Clock bring you from Peak 8 back down toward town at the end of the day, skipping the gondola line.'],
  ['Above treeline is serious terrain', 'The bowls and chutes up high (Imperial, Horseshoe, Peak 6 bowls) are expert terrain, can be very windy, and some are hike-to. They also close for weather, so check what’s open.'],
  ['Respect slow zones', 'Areas near the bases and lift lines are marked slow zones. Patrol enforces them.'],
  ['Weather changes fast', 'Sun at the base can be a whiteout up top. Bring goggles for low light and an extra layer for the high lifts.'],
];

// ---------- Install as an app ----------
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
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
// Forecast from Open-Meteo (free, no account) for two spots: the Peak 8 base and the top of the
// Imperial SuperChair. Open-Meteo adjusts temperatures to the elevation we pass in.
const WX_SPOTS = [
  { name: 'Base', sub: 'Peak 8 base · 9,600 ft', lat: 39.4808, lon: -106.0666, elev: 2926 },
  { name: 'Summit', sub: 'Top of Imperial · 12,840 ft', lat: 39.4757, lon: -106.0961, elev: 3914 },
];
const WX_URL = 'https://api.open-meteo.com/v1/forecast?' + new URLSearchParams({
  latitude: WX_SPOTS.map(s => s.lat).join(','), longitude: WX_SPOTS.map(s => s.lon).join(','),
  elevation: WX_SPOTS.map(s => s.elev).join(','),
  current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,is_day',
  daily: 'weather_code,temperature_2m_max,temperature_2m_min,snowfall_sum,wind_gusts_10m_max',
  temperature_unit: 'fahrenheit', wind_speed_unit: 'mph', precipitation_unit: 'inch',
  timezone: 'America/Denver', forecast_days: 5,
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
let wxCache = null; // { at, data } so reopening the panel doesn't refetch every time
async function getWeather() {
  if (wxCache && Date.now() - wxCache.at < 15 * 60e3) return wxCache.data;
  const res = await fetch(WX_URL);
  if (!res.ok) throw new Error('weather ' + res.status);
  const data = await res.json();
  wxCache = { at: Date.now(), data };
  return data;
}

(async function main() {
  const data = await fetch('data/breck.json').then(r => r.json());
  const { width: W, height: H, labels, runs } = data;

  // One entry per run name (a name can be printed in several places on the map)
  const RUNS = {};
  for (const l of labels) {
    RUNS[l.name] ||= { name: l.name, run: runs[l.name] || null, peak: peakOf(l), labels: [] };
    RUNS[l.name].labels.push(l);
  }
  const ALL = Object.values(RUNS).sort((a, b) => a.name.localeCompare(b.name));
  for (const r of ALL) r.level = diffOf(r.run).level;
  $('run-count').textContent = ALL.length;
  $('official-link').href = OFFICIAL_PDF;

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
    const boxes = [textBox(l.x, l.y, l.w, l.h, l.rot, 2, l.lines === 1 ? l.h * 1.2 : 0)];
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
      `Trail map © Breckenridge Ski Resort (<a href="${OFFICIAL_PDF}" target="_blank" rel="noopener">official PDF</a>) · ` +
      'Run data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> via <a href="https://openskimap.org" target="_blank" rel="noopener">OpenSkiMap</a>');

    // Low-res map shows immediately; the sharp one swaps in once downloaded
    const imgBounds = L.latLngBounds(ll(0, H), ll(W, 0));
    L.imageOverlay('trailmap-small.jpg', imgBounds).addTo(map);
    const sharp = new Image();
    sharp.onload = () => L.imageOverlay('trailmap.jpg', imgBounds).addTo(map);
    sharp.src = 'trailmap.jpg';

    // Start on the mountain itself, not the header text.
    // On a phone, fill the screen height (centered on Peak 8) and let people pan sideways.
    if (isMobile()) map.setView(ll(640, 500), Math.round(Math.log2(map.getSize().y / 760) * 4) / 4);
    else map.fitBounds(L.latLngBounds(ll(0, H), ll(W, 120)));

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
    const r = RUNS[name], d = diffOf(r.run);
    $('hovercard').innerHTML = `${signIcon(d.icon, d.color)}<div><div class="hc-name">${esc(name)}</div>
      <div class="hc-meta">${d.label} · Peak ${r.peak}${r.run?.lengthM ? ' · ' + fmtLen(r.run.lengthM) : ''}</div></div>`;
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
      const r = RUNS[name], run = r.run, d = diffOf(run);
      const yt = 'https://www.youtube.com/results?search_query=' + encodeURIComponent('breckenridge ' + name.replace(/’/g, "'"));
      let html = `<div class="run-head"><h2>${esc(name)}</h2>
          <button class="share" data-share="${esc(name)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Share</button></div>
        <div class="diff">${signIcon(d.icon, d.color)}<span>${d.label}</span><span class="sub">· Peak ${r.peak}</span></div>
        ${compareButton(name)}`;
      if (run) {
        html += `<p class="diff-note">Rating from OpenSkiMap. The run’s color on the trail map is the resort’s official rating.</p>`;
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
        html += profileSvg(run.profile);
      } else {
        html += `<p class="empty">OpenSkiMap doesn’t have details for this run yet. Its color on the trail map shows the official difficulty.</p>`;
      }
      html += `<div class="actions">
        <a class="btn btn-yt" href="${yt}" target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8zM9.8 15.1V8.9L15.6 12l-5.8 3.1z"/></svg>
          Watch on YouTube</a>`;
      if (run) html += `<a class="btn btn-outline" href="https://openskimap.org/?obj=${encodeURIComponent(run.primaryId)}" target="_blank" rel="noopener">View on OpenSkiMap</a>`;
      html += `</div>`;
      if (run) html += `<p class="source">Data © OpenStreetMap contributors, via OpenSkiMap.</p>`;
      body.innerHTML = html;
    },

    suggest() {
      const s = suggestState;
      let html = `<h2>Suggest a run</h2><p class="intro">Tell us how you ski and we’ll pick a few runs to try.</p>
        <h3>Your level</h3><div class="choices">${Object.entries(LEVELS).map(([k, v]) => `
          <button class="choice" data-set="level" data-val="${k}" aria-pressed="${s.level === k}">
            <span class="icon">${signIcon(v.icon, v.color)}</span><strong>${v.name}</strong><span>${v.blurb}</span></button>`).join('')}</div>
        <h3>What sounds fun?</h3><div class="chips">${Object.entries(STYLES).map(([k, v]) =>
          `<button class="chip" data-set="style" data-val="${k}" aria-pressed="${s.style === k}">${v.label}</button>`).join('')}</div>
        <h3>Where?</h3><div class="chips">${['any', ...PEAKS.map(p => p.id)].map(p =>
          `<button class="chip" data-set="peak" data-val="${p}" aria-pressed="${String(s.peak) === String(p)}">${p === 'any' ? 'Any peak' : 'Peak ' + p}</button>`).join('')}</div>`;
      if (s.level) {
        const picks = suggestRuns(s);
        html += `<h3>Try these</h3>`;
        html += picks.length
          ? `<ul class="cards">${picks.map(p => `<li><button class="card" data-run="${esc(p.name)}">${iconFor(p.run)}
              <span><strong>${esc(p.name)}</strong><span class="why">${p.why}</span></span></button></li>`).join('')}</ul>
             <p><button class="btn btn-outline btn-sm" data-action="reshuffle">Show me different ones</button></p>`
          : `<p class="empty">No ${STYLES[s.style].label.toLowerCase()} runs at this level${s.peak !== 'any' ? ' on Peak ' + s.peak : ''}. Try another style or “Any peak”.</p>`;
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
            <select data-set-list="peak" aria-label="Peak">${['any', ...PEAKS.map(p => p.id)].map(p =>
              `<option value="${p}" ${String(s.peak) === String(p) ? 'selected' : ''}>${p === 'any' ? 'All peaks' : 'Peak ' + p}</option>`).join('')}</select>
            <select data-set-list="sort" aria-label="Sort by">${Object.entries(SORTS).map(([k, v]) =>
              `<option value="${k}" ${s.sort === k ? 'selected' : ''}>Sort: ${v.label}</option>`).join('')}</select>
          </div>
        </div>
        <p class="count">${rows.length} run${rows.length === 1 ? '' : 's'}</p>
        <ul class="row-list">${rows.map(r => `<li><button class="row" data-run="${esc(r.name)}">${iconFor(r.run)}
          <span class="name">${esc(r.name)}</span><span class="meta">Peak ${r.peak}${SORTS[s.sort].meta(r)}</span></button></li>`).join('')}</ul>`;
    },

    peaks() {
      body.innerHTML = `<h2>The five peaks</h2>
        <p class="intro">Breck is five connected peaks, numbered 6 to 10 from right to left on the map. Lifts and runs link them all.</p>
        ${PEAKS.map(p => {
          const mine = ALL.filter(r => r.peak === p.id);
          const mix = Object.entries(LEVELS).map(([k, v]) => [v, mine.filter(r => r.level === k).length]).filter(([, n]) => n);
          return `<section class="peak"><h4>Peak ${p.id}</h4><p>${p.blurb}</p>
            <div class="mix">${mix.map(([v, n]) => `<span title="${v.sign}">${signIcon(v.icon, v.color)}${n}</span>`).join('')}<span class="sub">${mine.length} runs</span></div>
            <div class="btns"><button class="btn btn-outline btn-sm" data-show-peak="${p.id}">Show on map</button>
            <button class="btn btn-outline btn-sm" data-list-peak="${p.id}">List runs</button></div></section>`;
        }).join('')}
        <p class="source">Peak groupings are based on where each run sits on the trail map.</p>`;
    },

    weather() {
      body.innerHTML = `<h2>Mountain weather</h2><p class="intro">Loading the latest forecast…</p>`;
      getWeather().then(([base, top]) => {
        if (stack[stack.length - 1]?.type !== 'weather') return; // panel moved on while loading
        const spot = (s, w) => {
          const [label, icon] = wxCode(w.current.weather_code, w.current.is_day);
          return `<div class="wx-spot"><div class="wx-name">${s.name}</div><div class="sub">${s.sub}</div>
            <div class="wx-now"><span class="wx-icon">${icon}</span><span class="wx-temp">${Math.round(w.current.temperature_2m)}°</span></div>
            <div class="wx-cond">${label}</div>
            <div class="sub">Feels like ${Math.round(w.current.apparent_temperature)}°</div>
            <div class="sub">Wind ${Math.round(w.current.wind_speed_10m)} mph, gusts ${Math.round(w.current.wind_gusts_10m)}</div></div>`;
        };
        // Callouts a first-timer would want to know about
        const alerts = [];
        if (top.current.wind_gusts_10m >= 40) alerts.push(['💨', 'Strong winds up top', 'Upper lifts like Imperial and the T-bar may be on wind hold.']);
        const snow24 = top.daily.snowfall_sum[0] + top.daily.snowfall_sum[1];
        if (snow24 >= 3) alerts.push(['❄️', 'Fresh snow coming', `About ${snow24.toFixed(0)}" forecast up top today and tomorrow.`]);
        if (top.current.apparent_temperature <= 0) alerts.push(['🥶', 'Bitter cold up top', 'Cover all skin; frostbite can happen fast in wind.']);
        const days = top.daily.time.map((t, i) => {
          const [label, icon] = wxCode(base.daily.weather_code[i]);
          const day = i === 0 ? 'Today' : new Date(t + 'T12:00').toLocaleDateString(undefined, { weekday: 'short' });
          const snow = top.daily.snowfall_sum[i];
          return `<li><span class="wx-day">${day}</span><span title="${label}">${icon}</span>
            <span class="wx-hilo">${Math.round(base.daily.temperature_2m_max[i])}° <span class="sub">/ ${Math.round(base.daily.temperature_2m_min[i])}°</span></span>
            <span class="wx-snow">${snow >= 0.1 ? '❄️ ' + snow.toFixed(1) + '"' : '<span class="sub">no snow</span>'}</span></li>`;
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
        ['Difficulty', r => diffOf(r.run).label],
        ['Peak', r => 'Peak ' + r.peak],
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
        <ul class="tips">${TIPS.map(([t, d]) => `<li><strong>${t}</strong><span>${d}</span></li>`).join('')}</ul>
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
  function profileSvg(profile) {
    if (!profile || profile.length < 3) return '';
    const maxD = profile[profile.length - 1][0];
    const els = profile.map(p => p[1]);
    const lo = Math.min(...els), hi = Math.max(...els), span = Math.max(hi - lo, 1);
    const pts = profile.map(([d, e]) => `${(d / maxD * 300).toFixed(1)},${(85 - (e - lo) / span * 75).toFixed(1)}`);
    return `<div class="profile"><h3>Elevation profile</h3>
      <svg viewBox="0 0 300 90" preserveAspectRatio="none" role="img" aria-label="Elevation profile">
        <polygon class="area" points="0,90 ${pts.join(' ')} 300,90"/></svg></div>`;
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
    const pool = ALL.filter(r => r.run && r.level === s.level && (s.peak === 'any' || r.peak === Number(s.peak)) &&
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
    return [`Peak ${r.peak}`, ...bits, ...tags].join(' · ');
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
    return ALL.filter(r => (!s.levels.size || s.levels.has(r.level)) && (s.peak === 'any' || r.peak === Number(s.peak)))
      .sort((a, b) => sort.asc ? a.name.localeCompare(b.name) : sort.key(b) - sort.key(a) || a.name.localeCompare(b.name));
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

  // ---------- Sharing ----------
  // Links point at run/<slug>/, a small page with a preview card (built by tools/make-share-pages.html)
  // that forwards to #run/<slug>.
  async function shareRun(name) {
    const r = RUNS[name], d = diffOf(r.run);
    const url = SITE_URL + 'run/' + slugOf(name) + '/';
    const text = `${name} at Breckenridge: ${d.label}, Peak ${r.peak}`;
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
      const ls = ALL.filter(r => r.peak === Number(t.dataset.showPeak)).flatMap(r => hotspots[r.name]);
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
  const keepScroll = fn => { const y = panel.scrollTop; fn(); panel.scrollTop = y; };

  $('back').addEventListener('click', back);
  $('close').addEventListener('click', closePanel);
  document.querySelectorAll('.tool[data-open]').forEach(b => b.addEventListener('click', () => {
    const open = stack.length && stack[stack.length - 1].type === b.dataset.open;
    open ? closePanel() : showView({ type: b.dataset.open });
  }));

  // ---------- Level highlight toggles ----------
  document.querySelectorAll('.level').forEach(b => {
    const v = LEVELS[b.dataset.level];
    b.innerHTML = signIcon(v.icon, v.color);
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
      ? hits.map((r, i) => `<li role="option" data-name="${esc(r.name)}" aria-selected="${i === 0}">${iconFor(r.run)}${esc(r.name)}<span class="meta">Peak ${r.peak}</span></li>`).join('')
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
  getWeather().then(([base]) => {
    $('wx-chip').textContent = `${wxCode(base.current.weather_code, base.current.is_day)[1]} ${Math.round(base.current.temperature_2m)}°`;
  }).catch(() => {});

  route();
  window.APP = { get map() { return map; }, RUNS, openRun, showView, levelsOn }; // handy for debugging in the console
})();
