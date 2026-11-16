// Zermatt (Switzerland) with Breuil-Cervinia and Valtournenche (Italy): one linked ski area around the
// Matterhorn. Everything about it that the shared app (app.js) needs to know.
window.RESORT = {
  id: 'zermatt',
  name: 'Zermatt / Cervinia',
  title: 'Zermatt · Cervinia Trail Explorer',
  eyebrow: 'Zermatt, Switzerland · Cervinia, Italy · 5 sectors',
  lead: 'Plan your days around the Matterhorn. Tap any piste number on the map to see its name, how long and steep it is, get ideas for your level, and watch videos before you go.',
  features: [
    ['Tap any piste number', 'Its name, length, vertical drop, steepness and an elevation profile.'],
    ['Pistes for your level', 'Tell it how you ski and get suggestions, or highlight every blue, red, black or yellow itinerary.'],
    ['Both sides of the border', 'Zermatt, Cervinia and Valtournenche on one map, with tips for crossing over and getting back.'],
  ],
  disclaimer: 'Unofficial planning tool, not affiliated with Zermatt Bergbahnen, Zermatt Tourismus or Cervino S.p.A. Piste map © Zermatt Bergbahnen AG. Run data © OpenStreetMap contributors via OpenSkiMap. Always check conditions, lift closing times and the official map on the mountain.',

  units: 'metric', // meters and kilometers by default; visitors can switch
  scheme: 'eu', // European ratings: blue, red and black pistes, yellow off-piste itineraries

  data: 'data/zermatt.json', // built by tools/build_zermatt.mjs
  lifts: 'data/zermatt-lifts.json', // built by tools/build_lifts.mjs
  liftSource: 'Lift details are from OpenSkiMap (© OpenStreetMap contributors), with years, builders and gaps filled from skiresort.info.',
  liftSearch: l => (['cervinia', 'valtournenche'].includes(l.area) ? 'cervinia ' : 'zermatt ') + l.name + ' lift',
  map: {
    small: 'maps/zermatt-small.jpg', sharp: 'maps/zermatt.jpg',
    owner: 'Zermatt Bergbahnen AG',
    official: 'https://zermatt.a.bigcontent.io/v1/static/Winter-2026-2027',
    top: 0,
    focus: { x: 520, y: 300, span: 520 }, // on a phone, start around Riffelberg and Furi with most of the height showing
  },

  // Sectors, as they appear left to right on the map. Each piste's sector comes from the map's own legend.
  areas: [
    { id: 'rothorn', name: 'Sunnegga-Rothorn', blurb: 'The sunny side above Zermatt, reached by the Sunnegga funicular. The beginner park is at Sunnegga, with blues and reds up to Rothorn (3,103 m) and classic Matterhorn views.' },
    { id: 'gornergrat', name: 'Gornergrat', blurb: 'Reached by the Gornergrat cog railway up to 3,089 m. Wide, friendly blues and reds around Riffelberg, with steeper yellow itineraries off Hohtälli.' },
    { id: 'glacier', name: 'Matterhorn Glacier Paradise', blurb: 'The highest sector: lifts from Zermatt via Furi, Schwarzsee and Trockener Steg up to 3,883 m. Long glacier runs, the long descents back to Zermatt, and the crossing to Italy.' },
    { id: 'cervinia', name: 'Breuil-Cervinia', blurb: 'The Italian side: wide, sunny cruising reds and blues above Plan Maison, including the long Ventina (7) from Plateau Rosa down to the village.' },
    { id: 'valtournenche', name: 'Valtournenche', blurb: 'The quiet far end of the Italian side, past Colle Inferiore delle Cime Bianche, with the long Reine Blanche (1) down to Valtournenche at 1,524 m.' },
  ],
  areaOf: l => l.area,
  text: {
    areas: 'Sectors', area: 'Sector', anyArea: 'Anywhere', allAreas: 'All sectors',
    areasTitle: 'The five sectors',
    areasIntro: 'One lift pass area in two countries: three sectors above Zermatt in Switzerland, linked over the Theodulpass to Breuil-Cervinia and Valtournenche in Italy. Piste numbers repeat between Zermatt, Cervinia and Valtournenche, so check which side you’re on.',
    areasSource: 'Sectors follow the legend on the official piste map.',
    search: 'Find a piste, number or lift…',
  },

  tips: [
    ['Check your pass covers Italy', 'A Zermatt-only lift pass doesn’t include Cervinia and Valtournenche. Buy the International pass, or add a day’s extension, before you ski over.'],
    ['Watch the clock coming back', 'The last lifts back toward the border leave mid-afternoon, earlier than you’d expect, and times are posted at the lifts. Miss them and it’s a long, expensive taxi around the mountains. Start heading back early.'],
    ['The crossing closes in wind', 'The link runs over Plateau Rosa / Testa Grigia (3,480 m) and Matterhorn Glacier Paradise (3,883 m), both very exposed. Check that the connection is open before you cross, and again before lunch.'],
    ['Take it easy on the altitude', 'Lifts go up to 3,883 m (12,740 ft), the highest lift station in Europe. Drink water, go easy on day one, and expect to get winded faster up top.'],
    ['Where beginners should start', 'On the Zermatt side, the beginner park at Sunnegga and the gentle blues around Riffelberg. On the Italian side, the wide blues around Plan Maison above Cervinia.'],
    ['Yellow means off-piste', 'Yellow numbers are itineraries: marked routes that are not groomed or checked. Treat them as off-piste, only ski them in good conditions, and not alone.'],
    ['Piste numbers repeat', 'Zermatt, Cervinia and Valtournenche each have their own piste 1, 2, 3 and so on. Go by the sector as well as the number when you’re meeting someone.'],
    ['Zermatt is car-free', 'The three base stations (Sunnegga funicular, Gornergrat railway, Matterhorn Express gondola) are spread around the village. Electric ski buses link them.'],
    ['Weather changes fast', 'Sun in the village can be a whiteout on the glacier. Bring goggles for flat light and an extra layer for the high lifts.'],
  ],

  // Forecast spots: [base, summit]. elev is in meters.
  weather: {
    timezone: 'Europe/Zurich',
    spots: [
      { name: 'Village', place: 'Zermatt', lat: 46.0207, lon: 7.7491, elev: 1620 },
      { name: 'Summit', place: 'Matterhorn Glacier Paradise', lat: 45.9383, lon: 7.7297, elev: 3883 },
    ],
    windNote: 'The top lifts and the crossing between Zermatt and Cervinia may be on wind hold.',
  },

  // What to look up on YouTube for a run: the Italian side is better known as Cervinia
  videoSearch: r => (['cervinia', 'valtournenche'].includes(r.area) ? 'cervinia' : 'zermatt') + ' piste ' + r.name,
  sharePath: slug => 'zermatt/#run/' + slug,
};
