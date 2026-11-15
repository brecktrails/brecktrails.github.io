// Refreshes the run stats in public/data/breck.json from OpenSkiMap, keeping the label positions already
// in it (those come from the trail map PDF, via tools/extract.html). Stats come from public/runstats.js,
// the same code the app uses when it looks a run up live; this saved copy is what lists, search and
// offline use fall back on.
// Run from the project folder:  node tools/build_breck.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

const path = new URL('../public/data/breck.json', import.meta.url);
const { width, height, labels } = JSON.parse(readFileSync(path, 'utf8'));

// runstats.js is written for the browser; load it into a sandbox that has fetch
const ctx = vm.createContext({ fetch, setTimeout, console, URLSearchParams });
vm.runInContext(readFileSync(new URL('../public/runstats.js', import.meta.url), 'utf8'), ctx);
const names = [...new Set(labels.map(l => l.name))];
const { runs, unmatched } = await ctx.RunStats.buildRuns(names, ctx.RunStats.AREAS.breck);

writeFileSync(path, JSON.stringify({ built: new Date().toISOString().slice(0, 10), width, height, labels, runs }));
console.log(`${Object.keys(runs).length} of ${names.length} runs saved` + (unmatched.length ? `; not found on OpenSkiMap: ${unmatched.join(', ')}` : ''));
