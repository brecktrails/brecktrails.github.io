// Breckenridge's lifts, for tools/build_lifts.mjs. The trail map prints each lift's name along its line and
// has a "Lift stats" table (seats and vertical rise); OpenSkiMap has the rest. What is written by hand here:
//   label       the name as printed along the line on the map (how the line is found)
//   osm         the lift's name on OpenSkiMap, or "ref:C" for its letter/number there
//   area        the peak it is on
//   detachable  true for high-speed lifts whose chairs come off the cable in the stations
//   opened      the year the current lift opened (left out where not sure)
//   blurb       a sentence or two for someone who hasn't skied here
//   photo       a file on Wikimedia Commons
const superchair = { type: 'chair_lift', detachable: true };
const fixed = { type: 'chair_lift', detachable: false };

export default {
  pdf: 'pdf_download/breck_map.pdf',
  data: 'public/data/breck.json',
  box: [-106.14, -106.0, 39.43, 39.52], // west, east, south, north
  // Lift lines are red, 2 pt wide; platters in the learning areas are thinner and dashed
  isLiftLine: s => s.color === '237,28,36' && Math.abs(s.w - 1.99) < 0.05 && !s.dash,
  isSurfaceLine: s => s.color === '237,28,36' && s.dash,
  ignore: s => s.pts[0][0] > 1300, // the sample line in the legend
  // Rows of the "Lift stats" table: lift names in the first column
  statsTable: { isName: i => Math.abs(i.x - 1103.8) < 1 && i.y > 600 && i.y < 776 && Math.abs(i.h - 6.46) < 0.1 },

  lifts: [
    { name: 'BreckConnect Gondola', label: 'BRECKCONNECT GONDOLA', osm: ['BreckConnect Gondola'], area: 8, type: 'gondola', detachable: true, opened: 2006,
      blurb: 'The free gondola from the gondola parking lots in town up to the Peak 7 and Peak 8 bases. You don’t need a lift ticket to ride it, and it runs both ways, so you can take it back down at the end of the day. The Shock Hill stop on the way is for residents only.' },
    { name: 'Colorado SuperChair', label: 'COLORADO SUPERCHAIR', osm: ['Colorado SuperChair'], area: 8, ...superchair, opened: 2014,
      blurb: 'The main lift out of the Peak 8 base: a high-speed six-seater up to the Vista Haus area. Mostly blue cruisers back down to the base, and the first step toward 6-Chair, the T-Bar and Imperial higher up.' },
    { name: 'Rocky Mountain SuperChair', label: 'ROCKY MOUNTAIN SUPERCHAIR', osm: ['Rocky Mountain SuperChair'], area: 8, ...superchair, photo: 'Colorado 2013 (8571782320).jpg',
      blurb: 'High-speed quad from the Peak 8 base, next to the Colorado SuperChair. Worth a look when Colorado has a line: it serves blue runs on the Peak 7 side of Peak 8 and gets you toward the T-Bar.' },
    { name: 'FIVE SuperChair', label: 'FIVE SUPERCHAIR', osm: ['FIVE SuperChair'], area: 8, ...superchair, opened: 2023,
      blurb: 'High-speed quad that replaced the old 5-Chair in 2023. It serves the gentle lower slopes of Peak 8 and the terrain parks: a good next step once the learning area feels easy.' },
    { name: 'Rip’s Ride', label: 'RIP’S RIDE', osm: ['Rip’s Ride'], area: 8, ...superchair, opened: 2022,
      blurb: 'The beginner lift at the Peak 8 base, serving the easiest green runs beside the learning area. Rebuilt in 2022 as a high-speed quad, so the chairs slow right down for getting on and off.' },
    { name: 'Peak 8 SuperConnect', label: 'PEAK 8 SUPERCONNECT', osm: ['Peak 8 SuperConnect Lower', 'Peak 8 SuperConnect Upper'], area: 9, ...superchair, opened: 2002,
      blurb: 'The link from Peak 9 over to Peak 8. A long high-speed quad with a mid-station: you can get on at the bottom or at the mid-station, but nobody gets off until the top, near Vista Haus on Peak 8.' },
    { name: 'Imperial SuperChair', label: 'IMPERIAL SUPERCHAIR', osm: ['Imperial SuperChair'], area: 8, ...superchair, opened: 2005,
      blurb: 'The highest chairlift in North America, ending just below the summit of Peak 8. Everything off the top is expert terrain, bowls and chutes above treeline, with no easy way down. It is very exposed and often closed for wind.' },
    { name: '6-Chair', label: '6-CHAIR', osm: ['ref:6'], area: 8, ...fixed,
      blurb: 'An old, slow two-seater and a local favorite. It climbs to the treeline bowls and short steep pitches on upper Peak 8. Advanced and expert terrain only.' },
    { name: 'Horseshoe Bowl T-Bar', label: 'HORSESHOE BOWL T-BAR', osm: ['Horseshoe Bowl T-Bar'], area: 8, type: 't-bar', seats: 2,
      blurb: 'A surface lift: you stay standing on the snow and a T-shaped bar pulls you up, two people per bar. It reaches Horseshoe, Contest and North bowls on upper Peak 8. Advanced terrain only, and tiring on a snowboard.' },
    { name: 'Independence SuperChair', label: 'INDEPENDENCE SUPERCHAIR', osm: ['Independence SuperChair'], area: 7, ...superchair, opened: 2002, photo: 'LPSixPack.JPG',
      blurb: 'The main lift on Peak 7: a high-speed six-seater from the Peak 7 base, serving wide, rolling blue cruisers. A favorite for intermediates.' },
    { name: 'Freedom SuperChair', label: 'FREEDOM SUPERCHAIR', osm: ['Freedom Superchair'], area: 7, ...superchair, opened: 2021,
      blurb: 'A high-speed quad added in 2021 to take pressure off Independence. It starts partway up Peak 7 and ends near the top of Independence, so you can lap the upper runs without going back to the base.' },
    { name: 'Zendo Chair', label: 'ZENDO CHAIR', osm: ['Zendo Chair'], area: 6, ...fixed, opened: 2013,
      blurb: 'A short, slow four-seater that carries you from Peak 7 across to the bottom of the Kensho SuperChair. Think of it as the connector to Peak 6 more than a lift to lap.' },
    { name: 'Kensho SuperChair', label: 'KENSHO SUPERCHAIR', osm: ['Kensho SuperChair'], area: 6, ...superchair, opened: 2013, photo: 'Kensho SuperChair.JPG',
      blurb: 'High-speed six-seater up Peak 6 to well above treeline. Unusually, there are intermediate bowls right off the top, with hike-to expert terrain above them. Opened with Peak 6 in 2013; it is exposed and can close for wind.' },
    { name: 'Beaver Run SuperChair', label: 'BEAVER RUN SUPERCHAIR', osm: ['Beaver Run SuperChair'], area: 9, ...superchair, photo: 'Beaver Run SuperChair competition terminal.JPG',
      blurb: 'High-speed quad from the Beaver Run base to near the top of Peak 9. The quick way up to Peak 9’s long blue runs, and the start of the route over to Peak 10.' },
    { name: 'Mercury SuperChair', label: 'MERCURY SUPERCHAIR', osm: ['Mercury SuperChair'], area: 9, ...superchair,
      blurb: 'High-speed quad from the middle of Peak 9 to the top, running close to the Beaver Run SuperChair. Good for laps on the upper Peak 9 blues, and it connects toward Peak 10 and E-Chair.' },
    { name: 'Quicksilver SuperChair', label: 'QUICKSILVER SUPERCHAIR', osm: ['QuickSilver SuperChair'], area: 9, ...superchair,
      blurb: 'The beginner workhorse: a high-speed six-seater from the Village at the Peak 9 base, serving the wide green runs on lower Peak 9. It is busy with ski school in the morning.' },
    { name: 'A-Chair', label: 'A-CHAIR', osm: ['A-Chair'], area: 9, ...fixed,
      blurb: 'A slow three-seater on lower Peak 9 serving mellow green and easy blue runs. Often the shortest line on Peak 9.' },
    { name: 'C-Chair', label: 'C-CHAIR', osm: ['ref:C'], area: 9, ...fixed,
      blurb: 'A long, slow two-seater up the middle of Peak 9. Quiet when the high-speed lifts are busy, with mostly intermediate runs off it.' },
    { name: 'E-Chair', label: 'E-CHAIR', osm: ['ref:E'], area: 9, ...fixed,
      blurb: 'A slow two-seater high on Peak 9. It serves short, steep black and double-black bump runs and trees, and there is no easy way down from the top.' },
    { name: 'Falcon SuperChair', label: 'FALCON SUPERCHAIR', osm: ['Falcon SuperChair'], area: 10, ...superchair, opened: 2015,
      blurb: 'The only lift on Peak 10: a high-speed six-seater serving steep groomed runs, bumps and trees. Peak 10 is mostly advanced terrain, with nothing for beginners.' },
    { name: 'Snowflake', label: 'SNOWFLAKE', osm: ['Snowflake'], area: 8, ...fixed, photo: '45-degree bend in the Snowflake lift at Breckenridge.jpg',
      blurb: 'A quirky two-seater that starts in the neighborhood below Peak 8, has a mid-station where you can get on, and bends partway up. Mostly a way onto the mountain for people staying nearby.' },
    { name: 'Trygve’s Platter', label: ['TRYGVE’S', 'PLATTER'], osm: ['Trygve’s Platter'], area: 8, type: 'platter', seats: 1,
      blurb: 'A platter lift in the Peak 8 learning area: you stay standing and a small disc on a pole pulls you up a gentle slope. For first-timers and lessons.' },
    { name: 'Eldorado Platter', label: ['ELDORADO', 'PLATTER', '& CARPET'], osm: ['El Dorado Platter'], area: 9, type: 'platter', seats: 1,
      blurb: 'A platter lift and a moving carpet beside the Eldorado terrain park on Peak 9. You stay standing and get pulled (or carried) up a short slope.' },
    { name: 'Camelback Platter', label: ['CAMELBACK PLATTER', '& LEARNING AREA'], osm: ['Camelback Platter'], area: 9, type: 'platter', seats: 1,
      blurb: 'A platter lift in the learning area at the Peak 9 base, next to the Village. For first-timers and lessons.' },
  ],
};
