// Breckenridge, Colorado: everything about this resort that the shared app (app.js) needs to know.
window.RESORT = {
  id: 'breck',
  name: 'Breckenridge',
  title: 'Breck Trail Explorer',
  eyebrow: 'Breckenridge, Colorado · 5 peaks',
  lead: 'Plan your days on the mountain. Tap any run on the trail map to see how long and steep it is, get run ideas for your level, and watch videos before you go.',
  features: [
    ['Tap any run', 'Length, vertical drop, steepness and an elevation profile.'],
    ['Runs for your level', 'Tell it how you ski and get suggestions, or highlight every green, blue or black.'],
    ['See it before you ski it', 'One tap to YouTube videos of any run.'],
  ],
  disclaimer: 'Unofficial planning tool, not affiliated with Breckenridge Ski Resort or Vail Resorts. Trail map © Breckenridge Ski Resort. Run data © OpenStreetMap contributors via OpenSkiMap. Always check conditions and the official map on the mountain.',

  units: 'imperial', // feet and miles by default; visitors can switch
  scheme: 'na', // North American ratings: green circle, blue square, black diamonds

  data: 'data/breck.json', // built by tools/extract.html
  map: {
    small: 'trailmap-small.jpg', sharp: 'trailmap.jpg',
    owner: 'Breckenridge Ski Resort',
    official: 'https://www.breckenridge.com/-/aemasset/sitecore/breckenridge/maps/winter-2025-2026/20250926_BR_winter-trail_map_001.pdf',
    top: 120, // on a computer, start just below the map's header text
    focus: { x: 640, y: 500, span: 760 }, // on a phone, start centered on Peak 8 with this much height showing
  },

  // Peaks, as they appear left to right on the map
  areas: [
    { id: 10, name: 'Peak 10', blurb: 'The quietest peak and mostly advanced: black runs and tree skiing off the Falcon SuperChair.' },
    { id: 9, name: 'Peak 9', blurb: 'Gentle greens and blues on the lower mountain, with steep expert runs up top off E-Chair. Quicksilver connects it to town.' },
    { id: 8, name: 'Peak 8', blurb: 'The hub. Learning areas at the base, cruisers in the middle, and high-alpine bowls up top, including the Imperial SuperChair.' },
    { id: 7, name: 'Peak 7', blurb: 'Wide, easygoing blue cruisers off the Independence SuperChair, with bowls above treeline.' },
    { id: 6, name: 'Peak 6', blurb: 'Big, open above-treeline bowls and intermediate terrain off the Kensho SuperChair and Zendo Chair.' },
  ],
  // Which peak a run belongs to, from where its name sits on the map (peaks run left to right: 10 → 6).
  // Approximate: boundaries are drawn by eye, with overrides for names that sit across a boundary.
  areaOf(l) {
    const overrides = { 'Upper Lehman': 9, 'Whale’s Tail': 8, 'Easiest Way to Peak 9': 8 };
    if (overrides[l.name]) return overrides[l.name];
    if (l.x < 225 && l.y < 620) return 10;
    if (l.x < 470) return 9;
    if (l.x < 850) return 8;
    if (l.x < 1075) return 7;
    return 6;
  },
  text: {
    areas: 'Peaks', area: 'Peak', anyArea: 'Any peak', allAreas: 'All peaks',
    areasTitle: 'The five peaks',
    areasIntro: 'Breck is five connected peaks, numbered 6 to 10 from right to left on the map. Lifts and runs link them all.',
    areasSource: 'Peak groupings are based on where each run sits on the trail map.',
    search: 'Find a run…',
  },

  tips: [
    ['Take it easy on the altitude', 'The base is about 9,600 ft and lifts go above 12,800 ft. Drink lots of water, go easy on day one, and expect to get winded faster than usual.'],
    ['Get there on the free gondola', 'The BreckConnect Gondola runs from the North Gondola lot in town to the Peak 7 and Peak 8 bases. The Quicksilver SuperChair also leaves from the Peak 9 base near town.'],
    ['Where beginners should start', 'Head to the learning areas at the Peak 8 and Peak 9 bases. Peak 9’s lower mountain has the most green runs to progress to.'],
    ['Ski back to town', 'Lower 4 O’Clock and Lowest 4 O’Clock bring you from Peak 8 back down toward town at the end of the day, skipping the gondola line.'],
    ['Above treeline is serious terrain', 'The bowls and chutes up high (Imperial, Horseshoe, Peak 6 bowls) are expert terrain, can be very windy, and some are hike-to. They also close for weather, so check what’s open.'],
    ['Respect slow zones', 'Areas near the bases and lift lines are marked slow zones. Patrol enforces them.'],
    ['Weather changes fast', 'Sun at the base can be a whiteout up top. Bring goggles for low light and an extra layer for the high lifts.'],
  ],

  // Forecast spots: [base, summit]. elev is in meters.
  weather: {
    timezone: 'America/Denver',
    spots: [
      { name: 'Base', place: 'Peak 8 base', lat: 39.4808, lon: -106.0666, elev: 2926 },
      { name: 'Summit', place: 'Top of Imperial', lat: 39.4757, lon: -106.0961, elev: 3914 },
    ],
    windNote: 'Upper lifts like Imperial and the T-bar may be on wind hold.',
  },

  videoSearch: r => 'breckenridge ' + r.name, // what to look up on YouTube for a run
  sharePath: slug => 'run/' + slug + '/', // preview-card pages built by tools/make-share-pages.html
};
