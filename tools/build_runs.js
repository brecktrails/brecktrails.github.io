// Looks up every run name from the trail map on OpenSkiMap and summarizes it for the app.
// Runs inside tools/extract.html. Output: public/runs.json keyed by the name as printed on the map.
const SKI_AREA_ID = 'e1eb4ed2f10fc217647fa66ff48d640814d0c4f7'; // Breckenridge on OpenSkiMap
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Map spelling -> OpenSkiMap spelling, where they differ (filled in after reviewing unmatched names)
const ALIASES = {};

function haversine(a, b) {
  const R = 6371000, toRad = d => d * Math.PI / 180;
  const dLat = toRad(b[1] - a[1]), dLon = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Rough box around the resort, for runs OpenSkiMap hasn't tied to a ski area
const BBOX = { w: -106.14, e: -106.0, s: 39.43, n: 39.52 };
const firstPoint = g => g.type === 'LineString' ? g.coordinates[0] : g.type === 'Polygon' ? g.coordinates[0][0] : g.coordinates[0][0];
const inBreck = f => f.properties.skiAreas.some(s => s.properties.id === SKI_AREA_ID) ||
  (!f.properties.skiAreas.length && (([x, y]) => x > BBOX.w && x < BBOX.e && y > BBOX.s && y < BBOX.n)(firstPoint(f.geometry)));

// The search API returns at most 10 results, so common names need the resort name added
async function searchRuns(query) {
  const r = await fetch('https://api.openskimap.org/search?query=' + encodeURIComponent(query) + '&limit=50');
  if (!r.ok) throw new Error('search ' + r.status);
  return (await r.json()).filter(f => f.properties.type === 'run' && f.properties.uses.includes('downhill') &&
    ['LineString', 'Polygon'].includes(f.geometry.type) && inBreck(f));
}

// Join segments end-to-start into the longest continuous line, for the elevation profile
function longestChain(segs) {
  let best = [];
  for (const start of segs) {
    let chain = [...start], used = new Set([start]), grew = true;
    while (grew) {
      grew = false;
      for (const s of segs) {
        if (used.has(s)) continue;
        if (haversine(chain[chain.length - 1], s[0]) < 40) { chain = chain.concat(s.slice(1)); used.add(s); grew = true; break; }
      }
    }
    if (chain.length > best.length) best = chain;
  }
  return best;
}

function summarize(features) {
  // Bowls and glades are drawn as areas; they count for elevation but not for length/profile
  const lines = features.filter(f => f.geometry.type === 'LineString');
  const isArea = !lines.length;
  const segs = lines.map(f => f.geometry.coordinates);
  const segLen = segs.map(s => s.slice(1).reduce((t, p, i) => t + haversine(s[i], p), 0));
  const length = segLen.reduce((a, b) => a + b, 0);
  const allPts = features.flatMap(f => f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates);
  const elevs = allPts.map(p => p[2]).filter(e => e != null);

  // Difficulty: whichever rating covers the most length
  const byDiff = {};
  (isArea ? features : lines).forEach((f, i) => { const d = f.properties.difficulty || 'unknown'; byDiff[d] = (byDiff[d] || 0) + (isArea ? 1 : segLen[i]); });
  const difficulty = Object.entries(byDiff).sort((a, b) => b[1] - a[1])[0][0];

  // Elevation profile along the longest connected stretch, sampled every ~25 m
  const chain = isArea ? [] : longestChain(segs);
  const profile = []; let dist = 0, nextAt = 0;
  chain.forEach((p, i) => {
    if (i) dist += haversine(chain[i - 1], p);
    if (dist >= nextAt || i === chain.length - 1) { profile.push([Math.round(dist), Math.round(p[2])]); nextAt = dist + 25; }
  });
  // Steepest pitch over ~75 m of the profile
  let maxPitch = 0;
  for (let i = 0; i < profile.length; i++) for (let j = i + 1; j < profile.length; j++) {
    const run = profile[j][0] - profile[i][0];
    if (run >= 75) { maxPitch = Math.max(maxPitch, Math.abs(profile[i][1] - profile[j][1]) / run); break; }
  }
  const any = k => features.some(f => f.properties[k] === true);
  const top = Math.max(...elevs), bottom = Math.min(...elevs);
  const lengths = isArea ? features.map(() => 0) : features.map(f => f.geometry.type === 'LineString' ? segLen[lines.indexOf(f)] : 0);
  return {
    difficulty, isArea,
    lengthM: isArea ? null : Math.round(length),
    topM: Math.round(top), bottomM: Math.round(bottom), verticalM: Math.round(top - bottom),
    avgGradePct: chain.length > 1 ? Math.round(100 * (top - bottom) / Math.max(length, 1)) : null,
    maxGradePct: isArea ? null : Math.round(100 * maxPitch),
    grooming: [...new Set(features.map(f => f.properties.grooming).filter(Boolean))],
    gladed: any('gladed'), snowmaking: any('snowmaking'), lit: any('lit'),
    description: features.map(f => f.properties.description).find(Boolean) || null,
    osmIds: features.map(f => f.properties.id),
    // Longest segment is the best single thing to open on openskimap.org
    primaryId: features[lengths.indexOf(Math.max(...lengths))].properties.id,
    profile,
  };
}

async function buildRuns(names) {
  const runs = {}, unmatched = [];
  for (const name of names) {
    const base = ALIASES[name] || name;
    const target = norm(base);
    let hits = [];
    // Try progressively looser queries until one returns this run
    const loose = norm(base);
    for (const q of [base + ' Breckenridge', loose + ' Breckenridge', base.replace(/’/g, "'"), loose]) {
      hits = (await searchRuns(q)).filter(f => norm(f.properties.name || '') === target);
      await sleep(120);
      if (hits.length) break;
    }
    // The same segment can come back from more than one query
    hits = hits.filter((f, i) => hits.findIndex(g => g.properties.id === f.properties.id) === i);
    if (!hits.length) { unmatched.push(name); continue; }
    runs[name] = { osmName: hits[0].properties.name, ...summarize(hits) };
  }
  return { runs, unmatched };
}
