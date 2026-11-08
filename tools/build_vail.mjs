// Builds public/data/vail.json: OpenSkiMap stats for every named Vail run, used by the "Compared to Vail"
// section of a Breckenridge run. The hand-picked RUNS below are the "trademark" runs the app suggests first;
// every other named run (from OpenStreetMap) can be searched. Reuses tools/build_runs.js.
// Run from the project folder:  node tools/build_vail.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

const VAIL = { id: '88a22ba23468cf120025366ef40f004c9043546e', name: 'Vail', bbox: null, sections: true };

// Trademark runs. name -> { note: what it's known for (only where we're confident), level: Vail's own
// rating where it differs from OpenSkiMap's ("expert" = double black) }
const RUNS = {
  'Born Free': { note: 'the long, wide green down to Lionshead', level: 'easy' },
  'Lionsway': { note: 'the long, gentle road down to Lionshead' },
  'Gitalong Road': { note: 'the winding green road beginners use to get down the front side' },
  'Overeasy': {}, 'Sourdough': { note: 'the mellow runs off the Sourdough lift' },
  'Riva Ridge': { note: 'the classic long run from the top of the front side down to Vail Village' },
  'Simba': { note: 'the wide, popular blue groomer on the Lionshead side' },
  'Lodgepole': {}, 'Avanti': { note: 'the busy front-side blue off the Avanti lift' },
  'Ramshorn': {}, 'Bwana': { note: 'the blue cruiser down into Lionshead' },
  'Christmas': {}, 'Cloud 9': {}, 'Northwoods': {}, 'Showboat': {}, 'Pickeroon': {}, 'Dealer’s Choice': {},
  'Poppyfields': { note: 'the wide, rolling China Bowl blue in the Back Bowls' },
  'Big Rock Park': {},
  // Pepi's Face left out: OpenSkiMap only has a short fragment of it
  'Prima': { note: 'the long, steep, bumpy black in the Northeast Bowl' },
  'Look Ma': {}, 'Ouzo': {}, 'Forever': {}, 'Seldom': {}, 'Wow': {}, 'Headwall': {},
  'Gandy Dancer': {}, 'Windows': {}, 'Chicken Yard': {},
  'Blue Ox': { note: 'the notorious double-black bump run in the Northeast Bowl', level: 'expert' },
  'Lover’s Leap': { note: 'the steep double black in Blue Sky Basin', level: 'expert' },
  'Rasputin’s Revenge': { note: 'the double black far out in Mongolia Bowl', level: 'expert' },
  'Highline': { note: 'the long double-black bump run off the Highline lift', level: 'expert' },
  'Prima Cornice': { note: 'the steep double-black entrance at the top of Prima', level: 'expert' },
};

// Every other named downhill run in the Vail area, from OpenStreetMap (what OpenSkiMap is built from).
// Pieces like "Riva Ridge - Upper" count as their run.
const OVERPASS = 'https://overpass-api.de/api/interpreter';
const query = '[out:json][timeout:60];(way["piste:type"="downhill"]["name"](39.56,-106.45,39.67,-106.27);' +
  'relation["piste:type"="downhill"]["name"](39.56,-106.45,39.67,-106.27););out tags;';
const osm = await (await fetch(OVERPASS, { method: 'POST', headers: { 'User-Agent': 'brecktrails-build/1.0' },
  body: new URLSearchParams({ data: query }) })).json();
const curly = n => n.replace(/'/g, '’'); // match the app's spelling of apostrophes
const allNames = [...new Set([...Object.keys(RUNS), ...osm.elements.map(e => curly(e.tags.name.split(' - ')[0].trim()))])];

// build_runs.js is written for the browser; load its functions into a sandbox that has fetch
const ctx = vm.createContext({ fetch, setTimeout, console, URLSearchParams });
vm.runInContext(readFileSync(new URL('./build_runs.js', import.meta.url), 'utf8'), ctx);
const { runs, unmatched } = await ctx.buildRuns(allNames, VAIL);

const out = {};
for (const name of allNames.sort((a, b) => a.localeCompare(b))) {
  if (!runs[name]) continue;
  const extra = RUNS[name];
  out[name] = { ...runs[name], note: extra?.note || null, signature: !!extra,
    ...(extra?.level ? { difficulty: extra.level, ratingSource: 'Vail' } : {}) };
}
writeFileSync(new URL('../public/data/vail.json', import.meta.url), JSON.stringify({ runs: out }));
console.log(`${Object.keys(out).length} of ${allNames.length} Vail runs saved (${Object.values(out).filter(r => r.signature).length} trademark)` +
  (unmatched.length ? `; not found on OpenSkiMap: ${unmatched.join(', ')}` : ''));
