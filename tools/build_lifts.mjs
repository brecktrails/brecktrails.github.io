// Builds public/data/<resort>-lifts.json: every lift on the trail map, where its line is drawn on the map
// (so it can be tapped), its details, and the runs you can reach from the top.
//
// Run from the project folder:  node tools/build_lifts.mjs breck|zermatt [--fetch]
// One-time setup, inputs and PDFs are the same as for tools/build_zermatt.mjs (see the README).
//
// Where each part comes from:
//   - The line on the map: lift lines are drawn in the trail map PDF as plain strokes of one color and
//     width, so they can be picked out and their positions read. At Breckenridge each line has the lift's
//     name printed along it, which says whose line it is. Zermatt prints no lift names, so its table gives
//     a point on each lift's line instead.
//   - Type, seats, capacity, ride time, length, elevations: OpenSkiMap's lift records (lifts.geojson),
//     saved in tools/out/<resort>_lifts.json; --fetch downloads a fresh copy. Breckenridge's seats and
//     vertical rise come from the "Lift stats" table printed on its map.
//   - Year opened and builder, and capacity and ride time where OpenSkiMap has none: tools/lifts/reference.mjs,
//     collected from skiresort.info's lift pages. A ride time nobody publishes is estimated from the lift's
//     length and a typical line speed, and marked as an estimate.
//   - Commentary and which photo to show: written by hand in tools/lifts/<resort>.mjs.
//   - Photos: Wikimedia Commons (the file's link, author and license are looked up and saved with it), and
//     a few Creative Commons photos on Flickr, whose details are in the tables.
//   - Runs from the top: worked out from OpenSkiMap's run lines (see "Runs from the top" below).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import readline from 'node:readline';
import { Readable } from 'node:stream';
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';

const root = new URL('../', import.meta.url);
const id = process.argv[2];
if (!['breck', 'zermatt'].includes(id)) throw new Error('usage: node tools/build_lifts.mjs breck|zermatt [--fetch]');
const T = (await import(`./lifts/${id}.mjs`)).default;
const REF = (await import('./lifts/reference.mjs')).default[id];
const out = p => new URL('tools/out/' + p, root);
mkdirSync(out(''), { recursive: true });
const readJson = (url, fallback) => (existsSync(url) ? JSON.parse(readFileSync(url, 'utf8')) : fallback);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const r1 = n => +n.toFixed(1);
const plain = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

// ---------- Read the PDF: text and stroked lines, in PDF points with the origin top-left ----------
const pdf = await getDocument({ data: new Uint8Array(readFileSync(new URL(T.pdf, root))) }).promise;
const page = await pdf.getPage(1);
const pageH = page.getViewport({ scale: 1 }).height;
const seenText = new Set();
const text = (await page.getTextContent()).items.filter(i => i.str.trim()).map(i => {
  const [a, b, c, d, e, f] = i.transform;
  return { s: i.str.trim(), x: e, y: pageH - f, h: Math.hypot(c, d), w: i.width, rot: Math.atan2(b, a) * 180 / Math.PI, font: i.fontName.replace(/^.*_/, '') };
}).filter(i => { const k = i.s + '|' + i.x.toFixed(1) + '|' + i.y.toFixed(1); return seenText.has(k) ? false : seenText.add(k); }); // labels are in the PDF twice

function strokedPaths(ol) {
  const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  let ctm = [1, 0, 0, 1, 0, 0], st = { color: null, w: 1, dash: false }, path = [], sub = null;
  const stack = [], found = [];
  const P = (x, y) => [ctm[0] * x + ctm[2] * y + ctm[4], pageH - (ctm[1] * x + ctm[3] * y + ctm[5])];
  const add = (...pts) => { if (!sub) { sub = []; path.push(sub); } sub.push(...pts); };
  ol.fnArray.forEach((f, k) => {
    const a = ol.argsArray[k];
    if (f === OPS.save || f === OPS.paintFormXObjectBegin) { stack.push([ctm, { ...st }]); if (f !== OPS.save && a[0]) ctm = mul(ctm, a[0]); }
    else if (f === OPS.restore || f === OPS.paintFormXObjectEnd) { const s = stack.pop(); if (s) [ctm, st] = s; }
    else if (f === OPS.transform) ctm = mul(ctm, a);
    else if (f === OPS.setStrokeRGBColor) st.color = [a[0], a[1], a[2]].join(',');
    else if (f === OPS.setLineWidth) st.w = a[0];
    else if (f === OPS.setDash) st.dash = !!(a[0] && a[0].length);
    else if (f === OPS.constructPath) {
      const [ops, c] = a; let i = 0;
      for (const op of ops) {
        if (op === OPS.moveTo) { sub = [P(c[i], c[i + 1])]; path.push(sub); i += 2; }
        else if (op === OPS.lineTo) { add(P(c[i], c[i + 1])); i += 2; }
        else if (op === OPS.curveTo) { add(P(c[i + 2], c[i + 3]), P(c[i + 4], c[i + 5])); i += 6; }
        else if (op === OPS.curveTo2 || op === OPS.curveTo3) { add(P(c[i + 2], c[i + 3])); i += 4; }
        else if (op === OPS.rectangle) { i += 4; sub = null; }
        else if (op === OPS.closePath && sub) sub.push(sub[0]);
      }
    } else if ([OPS.stroke, OPS.closeStroke, OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke].includes(f)) {
      const scale = Math.sqrt(Math.abs(ctm[0] * ctm[3] - ctm[1] * ctm[2]));
      for (const s of path) if (s.length > 1) found.push({ color: st.color, w: +(st.w * scale).toFixed(2), dash: st.dash, pts: s });
      path = []; sub = null;
    } else if ([OPS.fill, OPS.eoFill, OPS.endPath].includes(f)) { path = []; sub = null; }
  });
  return found;
}
const strokes = strokedPaths(await page.getOperatorList());
const lines = strokes.filter(T.isLiftLine), surface = strokes.filter(s => T.isSurfaceLine?.(s));
const segDist = (p, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy;
  const u = l ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l)) : 0;
  return Math.hypot(p[0] - a[0] - u * dx, p[1] - a[1] - u * dy);
};
const pathDist = (p, s) => Math.min(...s.pts.slice(1).map((q, i) => segDist(p, s.pts[i], q)));
const ends = s => [s.pts[0], s.pts[s.pts.length - 1]];

// ---------- Whose line is whose ----------
const taken = new Map(); // path -> lift name
function claim(lift, s) {
  if (taken.has(s) && taken.get(s) !== lift.name) console.log(`LINE CLAIMED TWICE: ${taken.get(s)} and ${lift.name}`);
  taken.set(s, lift.name); (lift.paths ||= []).includes(s) || lift.paths.push(s);
}
for (const lift of T.lifts) {
  lift.paths = []; lift.labels = [];
  // A point on the line, given by hand
  for (const at of lift.at || []) {
    const best = lines.map(s => [pathDist(at, s), s]).sort((a, b) => a[0] - b[0])[0];
    if (best && best[0] < 4) claim(lift, best[1]); else console.log(`NO LINE at ${at} for ${lift.name}`);
  }
  // The name printed along the line: the line stops either side of the name, in line with it
  for (const word of [lift.label].flat().filter(Boolean)) {
    const l = text.find(i => i.s === word && !i.used && (!lift.labels.length || Math.hypot(i.x - lift.labels[0].x, i.y - lift.labels[0].y) < 40));
    if (!l) { console.log(`LABEL NOT FOUND: ${word}`); continue; }
    l.used = true; lift.labels.push(l);
  }
  const l = lift.labels[0];
  if (l && lift.labels.length === 1 && !lift.at) {
    const r = l.rot * Math.PI / 180, d = [Math.cos(r), -Math.sin(r)], u = [-Math.sin(r), -Math.cos(r)];
    const c0 = [l.x + u[0] * l.h * 0.35, l.y + u[1] * l.h * 0.35]; // middle of the text's height, at its left end
    for (const s of lines) {
      for (const [e, other] of [ends(s), ends(s).reverse()]) {
        const along = (e[0] - c0[0]) * d[0] + (e[1] - c0[1]) * d[1], across = Math.abs((e[0] - c0[0]) * u[0] + (e[1] - c0[1]) * u[1]);
        const gap = along < l.w / 2 ? -along : along - l.w; // how far beyond the end of the name the line starts
        const away = ((other[0] - e[0]) * d[0] + (other[1] - e[1]) * d[1]) * (along < l.w / 2 ? -1 : 1); // heads away from the name
        if (gap > -6 && gap < 14 && across < 6 && away > 0) claim(lift, s);
      }
    }
  } else if (l && !lift.at) { // a learning-area lift: short dashed lines next to a block of text
    const mid = [l.x + l.w / 2, l.y];
    for (const s of surface) if (pathDist(mid, s) < 32) claim(lift, s);
  }
}
// Lines that carry on from one already claimed (after a bend or a mid-station) belong to the same lift
for (let grew = true; grew;) {
  grew = false;
  for (const lift of T.lifts) for (const s of lines) {
    if (taken.has(s)) continue;
    if (lift.paths.some(p => ends(p).some(a => ends(s).some(b => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1.5)))) { claim(lift, s); grew = true; }
  }
}
const crop = T.crop || { x0: 0, y0: 0 };
const unclaimed = lines.filter(s => !taken.has(s) && Math.hypot(s.pts[0][0] - ends(s)[1][0], s.pts[0][1] - ends(s)[1][1]) > 12 && !T.ignore?.(s));
if (unclaimed.length) console.log('lift lines on the map that no lift claimed (start -> end):', unclaimed.map(s => ends(s).map(p => p.map(Math.round).join(',')).join(' -> ')).join(' | '));
for (const lift of T.lifts) if (!lift.paths.length) console.log(`NO LINE ON THE MAP: ${lift.name}`);

// ---------- OpenSkiMap lift records ----------
const liftsPath = out(id + '_lifts.json');
if (process.argv.includes('--fetch') || !existsSync(liftsPath)) {
  console.log('downloading lifts.geojson from OpenSkiMap…');
  const res = await fetch('https://tiles.openskimap.org/geojson/lifts.geojson');
  const keep = [], [w, e, s, n] = T.box;
  for await (const line of readline.createInterface({ input: Readable.fromWeb(res.body), crlfDelay: Infinity })) {
    let f; try { f = JSON.parse(line.replace(/,\s*$/, '')); } catch { continue; }
    if (f.geometry?.type !== 'LineString') continue;
    const [x, y] = f.geometry.coordinates[0];
    if (x > w && x < e && y > s && y < n) keep.push(f);
  }
  writeFileSync(liftsPath, JSON.stringify(keep));
}
const osmLifts = JSON.parse(readFileSync(liftsPath, 'utf8')).filter(f => f.properties.status === 'operating');
const haversine = (a, b) => {
  const R = 6371000, rad = d => d * Math.PI / 180, dLat = rad(b[1] - a[1]), dLon = rad(b[0] - a[0]);
  return 2 * R * Math.asin(Math.sqrt(Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2));
};
// "Colorado SuperChair" finds a lift by name; "ref:C" by the letter or number OpenSkiMap has for it
const findOsm = sel => osmLifts.filter(f => (sel.startsWith('ref:') ? f.properties.ref === sel.slice(4)
  : plain(f.properties.name || '') === plain(sel)) && !['magic_carpet', 'rope_tow'].includes(f.properties.liftType) === !/carpet/i.test(sel));
function osmStats(lift) {
  const fs = (lift.osm || []).flatMap(sel => { const hit = findOsm(sel); if (!hit.length) console.log(`NOT ON OPENSKIMAP: ${sel} (${lift.name})`); return sel.startsWith('ref:') ? hit : hit.filter((f, i) => hit.findIndex(g => plain(g.properties.sources?.[0]?.id || '') === plain(f.properties.sources?.[0]?.id || '')) === i); });
  if (!fs.length) return { tops: [] };
  // Each section from its lower end to its higher end
  const secs = fs.map(f => { const c = f.geometry.coordinates; return c[0][2] <= c[c.length - 1][2] ? c : [...c].reverse(); });
  let length = 0;
  for (const c of secs) for (let i = 1; i < c.length; i++) length += Math.hypot(haversine(c[i - 1], c[i]), (c[i][2] ?? 0) - (c[i - 1][2] ?? 0));
  const p = fs[0].properties, all = k => fs.map(f => f.properties[k]);
  const bottom = Math.min(...secs.map(c => c[0][2])), top = Math.max(...secs.map(c => c[c.length - 1][2]));
  return {
    type: p.liftType, seats: p.occupancy ?? null,
    capacity: all('capacity').every(Boolean) ? Math.min(...all('capacity')) : null,
    rideSec: all('duration').every(Boolean) ? all('duration').reduce((a, b) => a + b, 0) : null,
    detachable: p.detachable, bubble: all('bubble').some(v => v === true) || null, heated: all('heating').some(v => v === true) || null,
    lengthM: Math.round(length), bottomM: Math.round(bottom), topM: Math.round(top), verticalM: Math.round(top - bottom),
    sections: fs.length, osmId: [...fs].sort((a, b) => b.geometry.coordinates.length - a.geometry.coordinates.length)[0].properties.id,
    tops: secs.map(c => c[c.length - 1]),
  };
}

// ---------- Runs from the top ----------
// A run counts as starting at the top if it begins within about 150 m of a top station (or passes within
// 50 m of it; a lift's `reach` widens that where the pistes start a walk away from the station). From those, runs that branch off on the way down are followed two steps further, as long as
// they stay between the lift's bottom and top stations. It is a guide to the terrain a lift serves, not a route planner.
const data = JSON.parse(readFileSync(new URL(T.data, root), 'utf8'));
const geoPath = out(id + '_run_geo.json');
const geo = readJson(geoPath, {});
if (T.runsBulk && existsSync(out(T.runsBulk))) for (const f of JSON.parse(readFileSync(out(T.runsBulk), 'utf8'))) geo[f.properties.id] = f;
const wanted = [...new Set(Object.values(data.runs).flatMap(r => r.osmIds || []))].filter(i => !(i in geo));
if (wanted.length && !T.runsBulk) {
  console.log(`looking up ${wanted.length} run lines on OpenSkiMap…`);
  for (const rid of wanted) {
    const res = await fetch(`https://api.openskimap.org/features/${encodeURIComponent(rid)}.geojson`).catch(() => null);
    geo[rid] = res?.ok ? await res.json() : null; // null: the ID has changed since the run data was built
    await sleep(60);
  }
  writeFileSync(geoPath, JSON.stringify(geo));
}
const [bw, be, bs, bn] = T.box, lat0 = (bs + bn) / 2, lon0 = (bw + be) / 2;
const xy = c => [(c[0] - lon0) * 111320 * Math.cos(lat0 * Math.PI / 180), (c[1] - lat0) * 110540, c[2] ?? 0]; // meters
const RUNS = Object.entries(data.runs).map(([name, r]) => {
  const fs = (r.osmIds || []).map(i => geo[i]).filter(Boolean);
  const segs = [], starts = [];
  for (const f of fs) {
    const c = (f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates).map(xy);
    for (let i = 1; i < c.length; i++) segs.push([c[i - 1], c[i]]);
    if (f.geometry.type === 'Polygon') starts.push(...c); // a bowl can be entered anywhere along its edge
    else starts.push(c[0][2] >= c[c.length - 1][2] ? c[0] : c[c.length - 1]);
  }
  const els = segs.flat().map(p => p[2]);
  return { name, segs, starts, low: Math.min(...els), high: Math.max(...els) };
}).filter(r => r.segs.length);
const near3 = (p, a, b) => { // closest point on a stretch of run: [distance on the map, elevation there]
  const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy;
  const u = l ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l)) : 0;
  return [Math.hypot(p[0] - a[0] - u * dx, p[1] - a[1] - u * dy), a[2] + u * (b[2] - a[2])];
};
function runsFrom(tops, bottomM, reach = 150) {
  const T0 = tops.map(xy), depth = new Map(), topM = Math.max(...T0.map(t => t[2]));
  for (const r of RUNS) {
    const starts = r.starts.some(s => T0.some(t => Math.hypot(s[0] - t[0], s[1] - t[1]) < reach && Math.abs(s[2] - t[2]) < 80));
    const passes = r.segs.some(([a, b]) => T0.some(t => { const [d, e] = near3(t, a, b); return d < 50 && Math.abs(e - t[2]) < 60; }));
    if (starts || passes) depth.set(r, 0);
  }
  for (let d = 1; d <= 2; d++) {
    const from = [...depth].filter(([, v]) => v === d - 1).map(([r]) => r);
    for (const r of RUNS) {
      if (depth.has(r) || r.low < bottomM - 120 || r.high > topM + 20) continue; // belongs to a lift lower down or higher up
      if (r.starts.some(s => s[2] >= bottomM - 30 && from.some(f => f.segs.some(([a, b]) => { const [dist, e] = near3(s, a, b); return dist < 50 && Math.abs(e - s[2]) < 40; })))) depth.set(r, d);
    }
  }
  const names = k => [...depth].filter(([, v]) => (k ? v > 0 : v === 0)).map(([r]) => r.name).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return { top: names(0), below: names(1) };
}

// ---------- Breckenridge's "Lift stats" table: seats per chair and vertical rise, as printed on the map ----------
const printed = {};
if (T.statsTable) {
  for (const n of text.filter(T.statsTable.isName)) {
    const row = text.filter(i => Math.abs(i.y - n.y) < 1 && i.x > n.x + 40);
    const seats = row.find(i => /^\d+$/.test(i.s)), vert = row.find(i => /\d\s*m$/.test(i.s));
    printed[plain(n.s)] = { seats: seats ? +seats.s : null, verticalM: vert ? +vert.s.match(/([\d,]+)\s*m$/)[1].replace(',', '') : null };
  }
}

// ---------- Photos from Wikimedia Commons ----------
const commonsPath = out('commons.json');
const commons = readJson(commonsPath, {});
async function photoOf(file) {
  if (!file) return null;
  if (typeof file === 'object') return file; // a photo from elsewhere, with its link, author and license given in the table
  if (!commons[file]) {
    const u = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({ action: 'query', format: 'json', titles: 'File:' + file, prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: '800', iiextmetadatafilter: 'Artist|LicenseShortName|LicenseUrl' });
    let ii = null;
    for (let i = 0; i < 4 && !ii; i++) {
      const t = await (await fetch(u, { headers: { 'User-Agent': 'trail-explorer-build/1.0' } })).text();
      try { ii = Object.values(JSON.parse(t).query.pages)[0].imageinfo?.[0] || {}; } catch { await sleep(15000); } // asked too fast: wait
    }
    await sleep(1500);
    if (!ii?.thumburl) { console.log(`PHOTO NOT FOUND ON COMMONS: ${file}`); return null; }
    const strip = s => (s || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
    commons[file] = { via: 'Wikimedia Commons', src: ii.thumburl, w: ii.thumbwidth, h: ii.thumbheight, page: ii.descriptionurl,
      credit: strip(ii.extmetadata?.Artist?.value).replace(/ \(talk\).*$| from .*$|^The original uploader was | at (German|English|Italian) Wikipedia.*$/g, '').slice(0, 60) || 'Wikimedia Commons', license: strip(ii.extmetadata?.LicenseShortName?.value) };
    writeFileSync(commonsPath, JSON.stringify(commons, null, 1));
  }
  return commons[file];
}

// ---------- Output ----------
const lifts = [];
for (const lift of T.lifts) {
  const osm = osmStats(lift), table = printed[plain(lift.name)] || {};
  const tops = [...osm.tops, ...(lift.stops || [])];
  const bottomM = lift.bottomM ?? osm.bottomM;
  const ref = REF[lift.name] || {};
  const pick = k => lift[k] ?? table[k] ?? osm[k] ?? ref[k] ?? null;
  const type = pick('type'), lengthM = pick('lengthM'), detachable = pick('detachable');
  // No published ride time: length over a typical line speed for this kind of lift, in meters a second
  let rideSec = pick('rideSec'), rideEstimated = false;
  if (!rideSec && lengthM) {
    const speed = { gondola: 5, mixed_lift: 5, cable_car: 8, funicular: 8, 't-bar': 2.5, platter: 2 }[type] ?? (detachable ? 5 : 2.2);
    rideSec = Math.round(lengthM / speed / 30) * 30; rideEstimated = true;
  }

  lifts.push({
    name: lift.name, area: String(lift.area), type, seats: pick('seats'),
    detachable, bubble: pick('bubble'), heated: pick('heated'),
    capacity: pick('capacity'), rideSec, rideEstimated, lengthM,
    bottomM, topM: pick('topM'), verticalM: lift.verticalM ?? osm.verticalM ?? table.verticalM ?? null,
    mapVerticalM: table.verticalM ?? null, sections: osm.sections || 1, opened: pick('opened'), extended: ref.extended ?? null, maker: ref.maker ?? null,
    blurb: lift.blurb, note: lift.note ?? null, osmId: osm.osmId ?? null, photo: await photoOf(lift.photo),
    lines: lift.paths.map(s => s.pts.map(p => [r1(p[0] - crop.x0), r1(p[1] - crop.y0)])),
    labels: lift.labels.map(l => ({ x: r1(l.x - crop.x0), y: r1(l.y - crop.y0), w: r1(l.w), h: r1(l.h), rot: r1(l.rot) })),
    runs: tops.length && bottomM != null ? runsFrom(tops, bottomM, lift.reach) : { top: [], below: [] },
  });
}
writeFileSync(new URL(`public/data/${id}-lifts.json`, root), JSON.stringify({ built: new Date().toISOString().slice(0, 10), lifts }));
console.log(`${lifts.length} lifts saved; ${lifts.filter(l => l.lines.length).length} with a line on the map, ${lifts.filter(l => l.photo).length} with a photo`);
for (const l of lifts) console.log(`  ${l.name}: ${l.type}, ${l.seats ?? '?'} seats, ${l.lines.length} line(s), ${l.verticalM ?? '?'} m vertical, top: ${l.runs.top.length} runs (+${l.runs.below.length})`);
