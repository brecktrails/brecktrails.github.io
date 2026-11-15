// Builds everything the Zermatt / Cervinia app needs from the official piste map PDF and OpenSkiMap:
//   public/data/zermatt.json                      piste labels on the map + stats per piste
//   public/maps/zermatt.jpg, zermatt-small.jpg    the mountain painting, cropped out of the PDF
//
// One-time setup (not committed):  npm i --no-save pdfjs-dist@4.10.38 @napi-rs/canvas@0.1.100
// Inputs (not committed):
//   pdf_download/zermatt_map.pdf      the official winter piste map (page 1), from zermatt.swiss
//   tools/out/zermatt_runs.json       this resort's runs from OpenSkiMap. Created on first use with
//                                     --bulk <path to runs.geojson>, downloaded from
//                                     https://tiles.openskimap.org/geojson/runs.geojson
// Run from the project folder:  node tools/build_zermatt.mjs [--bulk path/to/runs.geojson] [--no-images]
//
// How it works: unlike Breckenridge, pistes here are numbered. The PDF holds every number printed on the
// map as text (with its position), and a legend that gives each number a name. Numbers repeat between
// Zermatt, Cervinia and Valtournenche, so each printed number is assigned to one of the three by where
// it sits on the map. The color of the disc behind it gives the official difficulty.
import { readFileSync, writeFileSync, existsSync, mkdirSync, createReadStream } from 'node:fs';
import readline from 'node:readline';
import vm from 'node:vm';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';

const root = new URL('../', import.meta.url);
const arg = k => { const i = process.argv.indexOf(k); return i < 0 ? null : process.argv[i + 1] || true; };

// The mountain painting within the PDF page (PDF points, origin top-left)
const CROP = { x0: 213, y0: 15, x1: 1785.5, y1: 575.5 };
const SKI_AREAS = ['fc76f378a2f19efc5228c60d97c895dde82ac2c5', '097fee0cf52b5c5a295f4a2ca1af6e8b261e5da9']; // Matterhorn area, Valtournenche
// Legend heading -> [region, sector id used by the app]
const SECTORS = {
  'Sunnegga-Rothorn': ['Z', 'rothorn'], 'Gornergrat': ['Z', 'gornergrat'], 'Matterhorn Glacier Paradise': ['Z', 'glacier'],
  'Sommerski / Theodulgletscher': ['Z', 'glacier'], 'Breuil-Cervinia': ['C', 'cervinia'], 'Valtournenche': ['V', 'valtournenche'],
};
const REGION_NAME = { Z: 'Zermatt', C: 'Cervinia', V: 'Valtournenche' };
const key = ref => ref.toLowerCase().replace(/\s+/g, '');
const r1 = n => +n.toFixed(1);
const plain = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// ---------- Read the PDF ----------
const pdf = await getDocument({ data: new Uint8Array(readFileSync(new URL('pdf_download/zermatt_map.pdf', root))) }).promise;
const page = await pdf.getPage(1);
const pageH = page.getViewport({ scale: 1 }).height;
const items = (await page.getTextContent()).items.filter(i => i.str.trim()).map(i => {
  const [a, b, c, d, e, f] = i.transform;
  return { s: i.str.trim(), x: e, y: pageH - f, h: Math.hypot(c, d), w: i.width, font: i.fontName };
});

// Legend: bold numbers and headings in columns, each number with its name on the same line to the right
const legendArea = i => i.y > 600 && i.x > 230 && i.x < 1600;
const heads = items.filter(i => legendArea(i) && /_f10$/.test(i.font) && Math.abs(i.h - 8.5) < 0.2).sort((a, b) => Math.round(a.x) - Math.round(b.x) || a.y - b.y);
const names = items.filter(i => legendArea(i) && /_f11$/.test(i.font));
const legend = {}; // "Z|52" -> { ref, name, region, area }
let sector = null;
for (const h of heads) {
  if (SECTORS[h.s]) { sector = SECTORS[h.s]; continue; }
  if (!sector || !/^\d/.test(h.s)) continue;
  const name = names.filter(n => Math.abs(n.y - h.y) < 1.5 && n.x > h.x && n.x - h.x < 60).sort((a, b) => a.x - b.x)[0];
  if (name) legend[sector[0] + '|' + key(h.s)] = { ref: h.s, name: name.s.replace(/`/g, '’').replace(/'/g, '’'), region: sector[0], area: sector[1] };
}

// Which of the three areas a number printed on the map belongs to. Boundaries drawn by eye along the
// Swiss-Italian border and the ridge between Cervinia and Valtournenche.
function regionOf(l) {
  const n = parseInt(l.s, 10);
  if (l.x < 1120) return 'Z';
  if (l.x < 1190 && l.y < 230 && n >= 80) return 'Z'; // summer-ski pistes on the Theodul glacier
  if (l.x > 1500) return 'V';
  if (l.x > 1425 && l.y < 245 && [10, 11, 12].includes(n)) return 'V'; // Du Col, Gran Sometta, Gran Lago
  return 'C';
}

// Render the page once at 3x: used for the map images and to read the disc color behind each number
const S = 3;
const vp = page.getViewport({ scale: S });
const canvas = createCanvas(Math.round(vp.width), Math.round(vp.height));
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
await page.render({ canvasContext: ctx, viewport: vp }).promise;

function officialColor(l) {
  const x0 = Math.round((l.x - 1) * S), y0 = Math.round((l.y - l.h - 0.8) * S), w = Math.round((l.w + 2) * S), h = Math.round((l.h + 2) * S);
  const d = ctx.getImageData(x0, y0, w, h).data, votes = {};
  for (let i = 0; i < d.length; i += 4) {
    const [r, g, b] = [d[i], d[i + 1], d[i + 2]], max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (min > 190) continue; // the white number itself
    const c = max - min < 40 ? (max < 130 ? 'black' : null) : r > 180 && g > 120 && b < 110 ? 'yellow' : r > g + 50 && r > b + 50 ? 'red' : b > r + 30 ? 'blue' : null;
    if (c) votes[c] = (votes[c] || 0) + 1;
  }
  return Object.entries(votes).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

// ---------- Numbers printed on the map ----------
const printed = items.filter(i => /_f3$/.test(i.font) && Math.abs(i.h - 4.06) < 0.2 && /^\d/.test(i.s) &&
  i.x > CROP.x0 && i.x < CROP.x1 && i.y > CROP.y0 && i.y < CROP.y1);
const labels = [], noLegend = [];
for (const l of printed) {
  const region = regionOf(l), entry = legend[region + '|' + key(l.s)];
  if (!entry) noLegend.push(`${l.s} (${REGION_NAME[region]})`);
  labels.push({
    region, ref: entry?.ref.replace(/Bis$/, 'bis') || l.s, title: entry?.name || null, area: entry?.area || null,
    official: officialColor(l), x: r1(l.x - CROP.x0), y: r1(l.y - CROP.y0), w: r1(l.w), h: r1(l.h), rot: 0, lines: 1, lead: 0, pad: 2.2,
  });
}
// Numbers missing from the legend: take the sector of the nearest number that has one
for (const l of labels.filter(l => !l.area)) {
  const near = labels.filter(o => o.area && o.region === l.region).sort((a, b) => Math.hypot(a.x - l.x, a.y - l.y) - Math.hypot(b.x - l.x, b.y - l.y))[0];
  l.area = near?.area || { Z: 'glacier', C: 'cervinia', V: 'valtournenche' }[l.region];
}
// Display name: "52 Stafelalp". Unnamed numbers become "Piste 6a", with the area added if that isn't unique.
const unnamed = {};
for (const l of labels) if (!l.title) (unnamed[key(l.ref)] ||= new Set()).add(l.region);
const used = {};
for (const l of labels) {
  l.name = l.title ? `${l.ref} ${l.title}` : `Piste ${l.ref}` + (unnamed[key(l.ref)].size > 1 ? ` (${REGION_NAME[l.region]})` : '');
  (used[l.name] ||= new Set()).add(l.region);
}
const clashes = Object.entries(used).filter(([, s]) => s.size > 1).map(([n]) => n);

// ---------- OpenSkiMap ----------
const VALTOURNENCHE = SKI_AREAS[1];
const firstPoint = f => (f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.type === 'LineString' ? f.geometry.coordinates : [[0, 0]])[0];
const inBox = ([lon, lat]) => lon > 7.6 && lon < 7.85 && lat > 45.87 && lat < 46.05;
const osmPath = new URL('tools/out/zermatt_runs.json', root);
if (arg('--bulk')) {
  const keep = [];
  for await (const line of readline.createInterface({ input: createReadStream(arg('--bulk')), crlfDelay: Infinity })) {
    // The off-piste itineraries (yellow on the map) aren't tied to a ski area on OpenSkiMap, so also keep
    // any run with no ski area that starts inside a box around the resort
    const loose = line.includes('"skiAreas":[]');
    if (!loose && !SKI_AREAS.some(id => line.includes(id))) continue;
    let f; try { f = JSON.parse(line.replace(/,\s*$/, '')); } catch { continue; /* first and last lines of the file */ }
    if (!loose || inBox(firstPoint(f))) keep.push(f);
  }
  mkdirSync(new URL('tools/out/', root), { recursive: true });
  writeFileSync(osmPath, JSON.stringify(keep));
}
if (!existsSync(osmPath)) throw new Error('tools/out/zermatt_runs.json is missing: run once with --bulk <runs.geojson>');
const features = JSON.parse(readFileSync(osmPath, 'utf8')).filter(f => f.properties.uses?.includes('downhill') &&
  ['LineString', 'Polygon'].includes(f.geometry.type));

// Swiss side or Italian side, from where the middle of the run is. The border follows the ridge from the
// Matterhorn to the Theodulpass and Testa Grigia, then runs east. Valtournenche is south of Cime Bianche.
function osmRegion(f) {
  const pts = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates;
  const [lon, lat] = pts[Math.floor(pts.length / 2)];
  if (lon > 7.709 || lat > 45.976 - (lon - 7.658) * 0.647) return 'Z';
  if (f.properties.skiAreas.some(s => s.properties.id === VALTOURNENCHE)) return 'V';
  return lat < 45.914 ? 'V' : 'C';
}
const byRef = {};
for (const f of features) {
  if (!f.properties.ref) continue;
  const region = osmRegion(f);
  for (const ref of f.properties.ref.split(/[\/,;]/)) {
    const k = key(ref).replace(/^85\.[12]$/, '85');
    // Cervinia and Valtournenche share some runs ("37 / 11"): each number counts for the area whose legend has it
    const home = region === 'Z' ? 'Z' : [region, 'C', 'V'].find(r => legend[r + '|' + k]);
    if (home) (byRef[home + '|' + k] ||= []).push(f);
  }
}
// build_runs.js (shared with Breckenridge and Vail) turns a run's pieces into stats and an elevation profile
const sandbox = vm.createContext({ fetch, setTimeout, console, URLSearchParams });
vm.runInContext(readFileSync(new URL('tools/build_runs.js', root), 'utf8'), sandbox);
const runs = {}, noData = [];
for (const name of [...new Set(labels.map(l => l.name))]) {
  const l = labels.find(o => o.name === name);
  // By number; failing that, by name (a few runs on OpenSkiMap have a name but no number)
  const fs = byRef[l.region + '|' + key(l.ref)] || (l.title ? features.filter(f => (osmRegion(f) === 'Z') === (l.region === 'Z') &&
    [l.title, l.ref + ' ' + l.title].some(n => plain(n) === plain(f.properties.name || ''))) : []);
  if (!fs.length) { noData.push(name); continue; }
  runs[name] = { osmName: fs[0].properties.name, ...sandbox.summarize(fs) };
}

// ---------- Output ----------
const W = r1(CROP.x1 - CROP.x0), H = r1(CROP.y1 - CROP.y0);
const out = labels.map(({ region, title, ...l }) => l);
mkdirSync(new URL('public/data/', root), { recursive: true });
writeFileSync(new URL('public/data/zermatt.json', root), JSON.stringify({ width: W, height: H, labels: out, runs }));

if (!arg('--no-images')) {
  mkdirSync(new URL('public/maps/', root), { recursive: true });
  for (const [file, scale, quality] of [['zermatt.jpg', 3, 80], ['zermatt-small.jpg', 1.25, 72]]) {
    const c = createCanvas(Math.round(W * scale), Math.round(H * scale));
    c.getContext('2d').drawImage(canvas, CROP.x0 * S, CROP.y0 * S, W * S, H * S, 0, 0, c.width, c.height);
    writeFileSync(new URL('public/maps/' + file, root), c.toBuffer('image/jpeg', quality));
  }
  // The Matterhorn in the middle of the map: the picture on the home page's Zermatt button (zermatt-card.jpg)
  // and the preview card when a Zermatt link is shared (zermatt-og.jpg, with the title on it)
  for (const [file, w, h, x, y, span, title] of [['zermatt-card.jpg', 900, 600, 640, 150, 430], ['zermatt-og.jpg', 1200, 630, 520, 120, 640, 'Zermatt · Cervinia Trail Explorer']]) {
    const c = createCanvas(w, h), g = c.getContext('2d');
    g.drawImage(canvas, (CROP.x0 + x) * S, (CROP.y0 + y) * S, span * S, span * h / w * S, 0, 0, w, h);
    if (title) {
      const shade = g.createLinearGradient(0, h - 240, 0, h);
      shade.addColorStop(0, 'rgba(8,22,40,0)'); shade.addColorStop(1, 'rgba(8,22,40,.92)');
      g.fillStyle = shade; g.fillRect(0, h - 240, w, 240);
      g.fillStyle = '#fff'; g.font = 'bold 58px Arial, sans-serif'; g.fillText(title, 56, h - 96);
      g.font = '30px Arial, sans-serif'; g.fillText('Tap any piste on the map for its name, length and steepness', 56, h - 48);
    }
    writeFileSync(new URL('public/maps/' + file, root), c.toBuffer('image/jpeg', 84));
  }
}

const count = k => labels.reduce((o, l) => (o[l[k]] = (o[l[k]] || 0) + 1, o), {});
console.log(`${labels.length} numbers on the map -> ${Object.keys(used).length} pistes, ${Object.keys(runs).length} with OpenSkiMap stats`);
console.log('by area', count('area'), 'by color', count('official'));
if (noLegend.length) console.log('not in the legend:', noLegend.join(', '));
if (clashes.length) console.log('NAME USED IN TWO AREAS:', clashes.join(', '));
if (noData.length) console.log('no OpenSkiMap stats:', noData.join(', '));
const unusedLegend = Object.values(legend).filter(e => !labels.some(l => l.region === e.region && key(l.ref) === key(e.ref)));
if (unusedLegend.length) console.log('in the legend but not found on the map:', unusedLegend.map(e => `${e.ref} ${e.name} (${REGION_NAME[e.region]})`).join(', '));
