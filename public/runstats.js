// Run stats from OpenSkiMap, worked out the same way OpenSkiMap's own site does it.
// Used in two places, so the numbers always agree:
//   - the app, which looks a run up live when it is opened (fetchRun, fetchIds)
//   - the build tools, which save a copy of every run for lists, search and offline use (buildRuns, summarize)
// Plain script: everything hangs off one global, RunStats.
(function (G) {
  const API = 'https://api.openskimap.org';
  const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // Resorts whose runs are found by name. bbox: a rough box around the resort; a run counts if it starts
  // inside. (OpenSkiMap's ski area IDs change when the area is re-edited, so they aren't used.)
  // sections: also take named parts of a run ("Riva Ridge - Upper") as that run.
  const AREAS = {
    breck: { name: 'Breckenridge', bbox: { w: -106.14, e: -106.0, s: 39.43, n: 39.52 }, sections: false },
    vail: { name: 'Vail', bbox: { w: -106.45, e: -106.27, s: 39.56, n: 39.67 }, sections: true },
  };

  function haversine(a, b) {
    const R = 6371000, toRad = d => d * Math.PI / 180;
    const dLat = toRad(b[1] - a[1]), dLon = toRad(b[0] - a[0]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  const firstPoint = g => (g.type === 'LineString' ? g.coordinates[0] : g.coordinates[0][0]);
  const inBox = ([x, y], b) => x > b.w && x < b.e && y > b.s && y < b.n;
  const isDownhill = f => f.properties.type === 'run' && (f.properties.uses || []).includes('downhill') &&
    ['LineString', 'Polygon'].includes(f.geometry.type);

  // ---------- Finding a run ----------
  // The search API returns only a few results, so common names need the resort name added
  async function searchRuns(query, area) {
    const r = await fetch(API + '/search?query=' + encodeURIComponent(query) + '&limit=50');
    if (!r.ok) throw new Error('search ' + r.status);
    return (await r.json()).filter(f => isDownhill(f) && inBox(firstPoint(f.geometry), area.bbox));
  }
  // Every piece OpenSkiMap has under this name at the resort
  async function findRun(name, area, pause = 0) {
    const target = norm(name);
    const isMatch = n => norm(n) === target || (area.sections && n.includes(' - ') && norm(n.split(' - ')[0]) === target);
    let hits = [];
    // Try progressively looser queries until one returns this run
    const queries = [name + ' ' + area.name, target + ' ' + area.name, name.replace(/’/g, "'"), target];
    for (const q of queries.filter((q, i) => queries.indexOf(q) === i)) {
      hits = (await searchRuns(q, area)).filter(f => isMatch(f.properties.name || ''));
      if (pause) await sleep(pause);
      if (hits.length) break;
    }
    return hits.filter((f, i) => hits.findIndex(g => g.properties.id === f.properties.id) === i);
  }

  // ---------- Stats ----------
  // [distance, elevation] down one piece. OpenSkiMap gives every run an elevation reading about every 25 m
  // along its line; the points the line was drawn with are much further apart and hide short steep pitches.
  // Distance is measured the way OpenSkiMap measures it: straight from one reading to the next, which on
  // a winding run is a little shorter than following every bend.
  function linePoints(f) {
    const c = f.geometry.coordinates, cum = [0];
    for (let i = 1; i < c.length; i++) cum.push(cum[i - 1] + haversine(c[i - 1], c[i]));
    const total = cum[cum.length - 1], ep = f.properties.elevationProfile;
    if (!ep || !ep.heights || ep.heights.length < 2 || !total) return c.map((p, i) => [cum[i], p[2]]).filter(p => p[1] != null);
    const n = ep.heights.length - 1, out = [];
    let seg = 1, prev = null, d = 0;
    for (let i = 0; i <= n; i++) {
      const at = total * i / n; // where along the line this reading was taken
      while (seg < c.length - 1 && cum[seg] < at) seg++;
      const t = cum[seg] > cum[seg - 1] ? (at - cum[seg - 1]) / (cum[seg] - cum[seg - 1]) : 0;
      const here = [c[seg - 1][0] + t * (c[seg][0] - c[seg - 1][0]), c[seg - 1][1] + t * (c[seg][1] - c[seg - 1][1])];
      if (prev) d += haversine(prev, here);
      out.push([d, ep.heights[i]]);
      prev = here;
    }
    return out;
  }
  // Length along the slope, total elevation change, and the steepest stretch of one piece. As on OpenSkiMap,
  // the steepest stretch is taken over equal steps of about 25 m, with elevations read off the profile.
  function pieceStats(pts) {
    let inclined = 0, change = 0;
    for (let i = 1; i < pts.length; i++) {
      const dd = pts[i][0] - pts[i - 1][0], de = pts[i][1] - pts[i - 1][1];
      inclined += Math.hypot(dd, de); change += Math.abs(de);
    }
    const flat = pts[pts.length - 1][0];
    let maxPitch = null;
    if (flat >= 12.5) {
      const steps = Math.ceil(flat / 25), step = flat / steps;
      let j = 0;
      const elevAt = d => {
        while (j < pts.length - 2 && pts[j + 1][0] < d) j++;
        const span = pts[j + 1][0] - pts[j][0];
        return span > 0 ? pts[j][1] + Math.min(Math.max((d - pts[j][0]) / span, 0), 1) * (pts[j + 1][1] - pts[j][1]) : pts[j][1];
      };
      maxPitch = 0;
      let last = elevAt(0);
      for (let k = 1; k <= steps; k++) { const e = elevAt(k === steps ? flat : k * step); maxPitch = Math.max(maxPitch, Math.abs(e - last) / step); last = e; }
    }
    return { flat, inclined, change, maxPitch };
  }
  // The run's main line: pieces joined end to start, whichever route is longest. Spurs and parallel
  // variants that share the name are left out, so they don't inflate the length.
  function mainLine(lines) {
    let best = { len: -1, path: [] };
    const walk = (path, len) => {
      if (len > best.len) best = { len, path: [...path] };
      const end = path[path.length - 1].b;
      for (const s of lines) {
        if (path.includes(s) || haversine(end, s.a) > 40) continue;
        path.push(s); walk(path, len + s.len); path.pop();
      }
    };
    for (const s of lines) walk([s], s.len);
    return best.path;
  }

  function summarize(features) {
    // Bowls and glades are drawn as areas; they have elevations but no length or profile
    const lines = features.filter(f => f.geometry.type === 'LineString').map(f => {
      const pts = linePoints(f), c = f.geometry.coordinates;
      return { f, pts, len: pts.length ? pts[pts.length - 1][0] : 0, a: c[0], b: c[c.length - 1] };
    }).filter(l => l.pts.length > 1);
    const isArea = !lines.length;
    const main = mainLine(lines);

    // Elevation profile down the main line. Stats are added up piece by piece, so a small mismatch in
    // elevation where two pieces meet doesn't count as a steep pitch.
    const pts = []; let offset = 0, inclined = 0, change = 0, maxPitch = 0;
    for (const l of main) {
      l.pts.forEach(([d, e], i) => { if (i || !pts.length) pts.push([offset + d, e]); });
      offset += l.len;
      const st = pieceStats(l.pts);
      inclined += st.inclined; change += st.change; maxPitch = Math.max(maxPitch, st.maxPitch || 0);
    }
    const flat = pts.length ? pts[pts.length - 1][0] : 0;
    const elevs = isArea
      ? features.flatMap(f => f.geometry.coordinates[0]).map(p => p[2]).filter(e => e != null)
      : pts.map(p => p[1]);
    const top = Math.max(...elevs), bottom = Math.min(...elevs);

    // Difficulty: whichever rating covers the most length
    const byDiff = {};
    if (isArea) features.forEach(f => { const d = f.properties.difficulty || 'unknown'; byDiff[d] = (byDiff[d] || 0) + 1; });
    else lines.forEach(l => { const d = l.f.properties.difficulty || 'unknown'; byDiff[d] = (byDiff[d] || 0) + l.len; });
    const difficulty = Object.entries(byDiff).sort((a, b) => b[1] - a[1])[0][0];

    const any = k => features.some(f => f.properties[k] === true);
    // The longest piece of the main line is the best single thing to open on openskimap.org
    const primary = isArea ? features[0] : [...main].sort((a, b) => b.len - a.len)[0].f;
    const profile = [];
    for (const [d, e] of pts) {
      const p = [Math.round(d), Math.round(e * 10) / 10];
      if (!profile.length || p[0] > profile[profile.length - 1][0]) profile.push(p);
    }
    return {
      difficulty, isArea,
      lengthM: isArea ? null : Math.round(inclined),
      flatM: isArea ? null : Math.round(flat),
      topM: Math.round(top), bottomM: Math.round(bottom), verticalM: Math.round(top - bottom),
      avgGradePct: flat >= 12.5 ? Math.round(100 * change / flat) : null,
      maxGradePct: isArea || flat < 12.5 ? null : Math.round(100 * maxPitch),
      grooming: [...new Set(features.map(f => f.properties.grooming).filter(Boolean))],
      gladed: any('gladed'), snowmaking: any('snowmaking'), lit: any('lit'),
      description: features.map(f => f.properties.description).find(Boolean) || null,
      // OpenSkiMap's IDs for the pieces. They change whenever a run is re-edited, so they go stale.
      osmIds: features.map(f => f.properties.id), primaryId: primary.properties.id,
      pieces: isArea ? 0 : lines.length, mainPieces: main.length,
      profile,
    };
  }

  // ---------- Live lookups (the app) ----------
  // By name, for resorts in AREAS. null if OpenSkiMap has nothing under that name.
  async function fetchRun(name, area) {
    const hits = await findRun(name, area);
    return hits.length ? { osmName: hits[0].properties.name, ...summarize(hits) } : null;
  }
  // By the OpenSkiMap IDs saved at build time, for resorts whose runs can't be found by name.
  // null if any piece has gone (its ID changed), since stats from only some of the pieces would be wrong;
  // rebuilding the resort's data file picks up the new IDs.
  async function fetchIds(ids) {
    const res = await Promise.all(ids.map(id => fetch(`${API}/features/${encodeURIComponent(id)}.geojson`)));
    if (!res.length || res.some(r => !r.ok)) return null;
    const features = (await Promise.all(res.map(r => r.json()))).filter(isDownhill);
    return features.length === ids.length ? { osmName: features[0].properties.name, ...summarize(features) } : null;
  }

  // ---------- Saved copy (the build tools) ----------
  async function buildRuns(names, area) {
    const runs = {}, unmatched = [];
    for (const name of names) {
      const hits = await findRun(name, area, 120);
      if (!hits.length) { unmatched.push(name); continue; }
      runs[name] = { osmName: hits[0].properties.name, ...summarize(hits) };
    }
    return { runs, unmatched };
  }

  G.RunStats = { AREAS, norm, haversine, searchRuns, findRun, summarize, fetchRun, fetchIds, buildRuns };
})(globalThis);
