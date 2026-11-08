// Builds public/data/vail.json: OpenSkiMap stats for a set of signature Vail runs, used by the
// "Compared to Vail" section of a Breckenridge run. Reuses tools/build_runs.js.
// Run from the project folder:  node tools/build_vail.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

const VAIL = { id: '88a22ba23468cf120025366ef40f004c9043546e', name: 'Vail', bbox: null, sections: true };

// name -> { note: what it's known for (only where we're confident), level: Vail's own rating where it
// differs from OpenSkiMap's ("expert" = double black) }
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
};

// build_runs.js is written for the browser; load its functions into a sandbox that has fetch
const ctx = vm.createContext({ fetch, setTimeout, console, URLSearchParams });
vm.runInContext(readFileSync(new URL('./build_runs.js', import.meta.url), 'utf8'), ctx);
const { runs, unmatched } = await ctx.buildRuns(Object.keys(RUNS), VAIL);

const out = {};
for (const [name, extra] of Object.entries(RUNS)) {
  if (!runs[name]) continue;
  out[name] = { ...runs[name], ...(extra.level ? { difficulty: extra.level, ratingSource: 'Vail' } : {}), note: extra.note || null };
}
writeFileSync(new URL('../public/data/vail.json', import.meta.url), JSON.stringify({ runs: out }));
console.log(`${Object.keys(out).length} Vail runs saved` + (unmatched.length ? `; not found: ${unmatched.join(', ')}` : ''));
