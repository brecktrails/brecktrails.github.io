// Zermatt / Cervinia / Valtournenche lifts, for tools/build_lifts.mjs. The piste map draws every lift as a
// black line but prints no lift names, so each lift here says where its line is. What is written by hand:
//   at     a point on each stretch of the lift's line (PDF points, as printed by the tool for lines no lift
//          has claimed). A lift with mid-stations has one point per stretch.
//   osm    the lift's name on OpenSkiMap, or "ref:A" for its letter there (several lifts are called
//          "Plan Maison"). More than one entry: the sections of one lift, added together.
//   area   the sector, as in public/resorts/zermatt.js
//   blurb  a sentence or two for someone who hasn't skied here
//   photo  a file on Wikimedia Commons
//   reach, stops  see "Runs from the top" in the tool: a wider search around the top station, and extra
//          places people get off
// The Gornergrat railway is not a ski lift on OpenSkiMap, so its figures are given here.
export default {
  pdf: 'pdf_download/zermatt_map.pdf',
  data: 'public/data/zermatt.json',
  runsBulk: 'zermatt_runs.json', // run lines saved by tools/build_zermatt.mjs --bulk
  crop: { x0: 213, y0: 15 }, // the mountain painting within the page, as in tools/build_zermatt.mjs
  box: [7.6, 7.85, 45.86, 46.05], // west, east, south, north
  isLiftLine: s => s.color === '0,0,0' && Math.abs(s.w - 1.98) < 0.05,
  // Not ski lifts: the railway into Zermatt, and short carpets and beginner tows
  ignore: s => s.pts[0][0] < 0 || Math.hypot(s.pts[0][0] - s.pts[s.pts.length - 1][0], s.pts[0][1] - s.pts[s.pts.length - 1][1]) < 30,

  lifts: [
    // ----- Sunnegga-Rothorn -----
    { name: 'Sunnegga Express', osm: ['Zermatt–Sunnegga funicular'], area: 'rothorn', at: [[482, 443]], photo: 'Zermatt -Sunnegga funicular.jpg',
      blurb: 'An underground funicular from the village up to Sunnegga in about three minutes. It is the way into the Sunnegga-Rothorn sector, and to the beginner park by the Leisee lake.' },
    { name: 'Sunnegga–Blauherd', osm: ['Sunnegga-Blauherd'], area: 'rothorn', at: [[445, 340]],
      blurb: 'The second stage up from Sunnegga. Blauherd is the junction for the Rothorn cable car and for the runs down toward Gant.' },
    { name: 'Blauherd–Rothorn', osm: ['Blauherd - Rothorn'], area: 'rothorn', at: [[397, 286]],
      blurb: 'A large cable car to the top of the sector at 3,103 m, for long red runs with the classic view of the Matterhorn.' },
    { name: 'Kumme', osm: ['Kumme'], area: 'rothorn', at: [[271, 352], [305, 280]],
      blurb: 'A gondola up the quiet back side of Rothorn, in two sections from Tufternkumme. Sunny red runs that are often uncrowded.' },
    { name: 'Patrullarve', osm: ['Patrullarve'], area: 'rothorn', at: [[388, 367]],
      note: 'The piste map marks this lift as new for 2026/27, so the details here, which come from OpenSkiMap, may describe the lift it replaced.',
      blurb: 'From Patrullarve up to Blauherd. Good for laps on the lower Rothorn-side runs without going back down to the village.' },
    { name: 'Findeln (Eja–Sunnegga)', osm: ['Findelbahn (Eja-Sunnegga)'], area: 'rothorn', at: [[519, 381]],
      blurb: 'A chairlift from Eja, below the hamlet of Findeln, back up to Sunnegga.' },
    { name: 'Findeln (Eja–Breitboden)', osm: ['Findelbahn (Eja-Breitenboden)'], area: 'rothorn', at: [[592, 369]],
      blurb: 'From Eja up the other side of the valley to Breitboden: the link from Sunnegga across toward Gornergrat.' },
    { name: 'Eisfluh', osm: ['Eisfluh'], area: 'rothorn', at: [[485, 393]],
      blurb: 'A short two-seat chair just below Sunnegga, serving the gentle runs around the Leisee.' },
    { name: 'Gant–Blauherd', osm: ['Hublot-Express (Gant - Blauherd)'], area: 'rothorn', at: [[480, 316]],
      blurb: 'A six-seat chair from Gant back up to Blauherd: the way out of the Gant valley toward Rothorn and Sunnegga.' },
    { name: 'Gant–Hohtälli', osm: ['Gant - Hohtälli'], area: 'gornergrat', at: [[590, 267]], photo: 'Funivia Höhtalli.JPG',
      blurb: 'A cable car from Gant up to Hohtälli at 3,286 m. It links the Rothorn side to Gornergrat, and is the way to the yellow itineraries off Hohtälli.' },
    { name: 'Rote Nase', osm: ['Rote Nase'], area: 'gornergrat', at: [[628, 198]],
      blurb: 'A small cable car from Hohtälli out to Rote Nase, for the ungroomed itineraries on that side. It only runs when there is enough snow, usually from midwinter.' },

    // ----- Gornergrat -----
    { name: 'Gornergrat Bahn', area: 'gornergrat', at: [[716.9, 240.7]], type: 'rack_railway', opened: 1898, photo: 'Gornergratbahn Riffelboden Matterhorn.jpg',
      bottomM: 1604, topM: 3089, verticalM: 1485, lengthM: 9340, rideSec: 33 * 60,
      stops: [[7.7847, 45.9834, 3089], [7.7537, 45.9930, 2582]], // Gornergrat, Riffelberg
      blurb: 'A cog railway, not a ski lift: open-air trains climb from Zermatt to Gornergrat at 3,089 m in about 33 minutes, and have done since 1898. Skiers can get on and off at Riffelalp, Riffelberg and Rotenboden on the way.' },
    { name: 'Gifthittli', osm: ['Gifthittli'], area: 'gornergrat', at: [[702, 305]],
      blurb: 'A modern chair from Riffelberg up to Gifthittli, with weather covers. Good for laps on the wide blue and red runs below Gornergrat.' },
    { name: 'Riffelberg Express', osm: ['Riffelberg-Express'], area: 'gornergrat', at: [[724, 385], [731, 445]],
      blurb: 'A gondola from Furi up to Riffelberg: the link from the Matterhorn Glacier Paradise side over to Gornergrat.' },

    // ----- Matterhorn Glacier Paradise -----
    { name: 'Matterhorn Express', osm: ['Matterhorn Express 1', 'Matterhorn Express 2', 'Matterhorn Express 3', 'Matterhorn Express 4'], area: 'glacier',
      at: [[603.8, 511.2], [783, 443], [871, 408], [896, 378], [891, 321]], photo: 'Matterhorn Express.JPG',
      blurb: 'The main gondola out of Zermatt. It runs through Furi, Schwarzsee and Furgg to Trockener Steg at 2,939 m, and you can get off at each. Stay on for the glacier, or get off at Schwarzsee for the runs under the Matterhorn.' },
    { name: 'Zermatt–Furi', osm: ['Zermatt - Furi'], area: 'glacier', at: [[601.9, 508]],
      blurb: 'An older cable car alongside the first section of the Matterhorn Express, adding capacity between the village and Furi.' },
    { name: 'Furi–Trockener Steg', osm: ['Furi - Trockener Steg'], area: 'glacier', at: [[818, 363]], photo: 'Station Furi.JPG',
      blurb: 'A cable car straight from Furi to Trockener Steg, without going around by Schwarzsee.' },
    { name: 'Furgg–Sandiger Boden', osm: ['Furgg - Sandiger Boden'], area: 'glacier', at: [[872, 335]],
      blurb: 'A chair with weather covers from Furgg up to Sandiger Boden, for laps on the runs between Trockener Steg and Furgg.' },
    { name: 'Matterhorn Glacier Ride I', osm: ['Trockener Steg - Klein Matterhorn Glacier Ride'], area: 'glacier', at: [[1023.2, 134.1]], opened: 2018, reach: 400,
      photo: '0 TDn 28 Switzerland Zermatt Matterhorn glacier ride 2018 Snow LEITNER NO-KEYWORD 241.jpg',
      blurb: 'A three-cable gondola from Trockener Steg to Matterhorn Glacier Paradise at 3,883 m, the highest lift station in Europe. Its 28-seat cabins are built to keep running in wind that stops other lifts.' },
    { name: 'Trockener Steg–Matterhorn Glacier Paradise', osm: ['Trockener Steg - Matterhorn glacier paradise'], area: 'glacier', at: [[1011.4, 132.3]], opened: 1979, reach: 400, photo: 'Klein Matterhorn Seilbahn.jpg',
      blurb: 'The original cable car to the top, running alongside the newer Glacier Ride.' },
    { name: 'Matterhorn Glacier Ride II', osm: ['Matterhorn Glacier Ride II'], area: 'glacier', at: [[1105, 156]], opened: 2023, reach: 400, stops: [[7.7076, 45.9348, 3466]], // it is ridden both ways: Testa Grigia counts as a top too
      blurb: 'The link to Italy: a three-cable gondola from Matterhorn Glacier Paradise across the glacier to Testa Grigia / Plateau Rosa. Non-skiers ride it too, as part of the Matterhorn Alpine Crossing.' },
    { name: 'Furggsattel Gletscherbahn', osm: ['Furggsattel Gletscherbahn'], area: 'glacier', at: [[1014, 254]],
      blurb: 'A six-seat chair with weather covers from Trockener Steg up the Theodul glacier to Furggsattel, on the Italian border. Long, wide glacier reds.' },
    { name: 'Hirli', osm: ['Hirli'], area: 'glacier', at: [[962, 461]],
      blurb: 'A chair on the Schwarzsee side, right under the north face of the Matterhorn, from Stafel up to Hirli.' },
    { name: 'Plateau Rosa T-bars', osm: ['Plateau Rosa 1', 'Plateau Rosa 2', 'Plateau Rosa 3'], area: 'glacier', seats: 2, at: [[1130.1, 175.8], [1118.3, 175.8], [1102, 169.2]],
      note: 'Three T-bars side by side. Length and vertical are for the three added together; each one is roughly a third.',
      blurb: 'Drag lifts on the glacier below Plateau Rosa: you stay standing and a T-shaped bar pulls you up. Gentle, very high pistes that are also used for summer skiing.' },

    // ----- Breuil-Cervinia -----
    { name: 'Breuil-Cervinia–Plan Maison', osm: ['ref:A'], area: 'cervinia', at: [[1364.2, 361.8], [1361.3, 363.7]],
      note: 'Two lifts run side by side here, a gondola and a cable car. The figures are for the gondola.',
      blurb: 'The way up from the village to Plan Maison at 2,555 m, and the first stage of everything on the Cervinia side.' },
    { name: 'Cime Bianche Laghi', osm: ['ref:T'], area: 'cervinia', at: [[1350, 312]],
      blurb: 'A gondola from Plan Maison to Cime Bianche Laghi: the middle stage of the route up from Cervinia.' },
    { name: 'Plateau Rosa cableway', osm: ['Funivia del Plateau Rosa, Plateau Rosa cableway'], area: 'cervinia', at: [[1277, 223]], photo: 'Funivia Plateau Rosa\'.JPG',
      blurb: 'A cable car from Cime Bianche Laghi to Plateau Rosa / Testa Grigia at 3,480 m: the top of the Italian side, the crossing point to Zermatt, and the start of the long Ventina run back to Cervinia.' },
    { name: 'Plan Maison chair', osm: ['ref:N'], area: 'cervinia', at: [[1295, 319]],
      blurb: 'A chair with weather covers from Plan Maison up to Fornet: the first of three chairs that climb to the Theodulpass and the Swiss border.' },
    { name: 'Fornet', osm: ['ref:O'], area: 'cervinia', at: [[1226, 265]],
      blurb: 'The middle chair of the three between Plan Maison and the Theodulpass.' },
    { name: 'Bontadini', osm: ['ref:P'], area: 'cervinia', at: [[1160, 231]],
      blurb: 'The top chair of the three from Plan Maison. It ends at the Theodulpass, where you can cross to the Zermatt side.' },
    { name: 'Pancheron', osm: ['Pancheron'], area: 'cervinia', at: [[1243, 370]],
      blurb: 'A six-seat chair with weather covers up the west side of the bowl, under the south face of the Matterhorn.' },
    { name: 'Cretaz', osm: ['Cretaz'], area: 'cervinia', at: [[1383, 432]],
      blurb: 'A six-seat chair with weather covers from the village: the other way out of Cervinia, toward Plan Torrette and Pancheron.' },
    { name: 'Campetto', osm: ['Campetto'], area: 'cervinia', at: [[1411, 454]],
      blurb: 'A short chair at the edge of the village, serving the beginner slopes.' },
    { name: 'Cieloalto', osm: ['Cieloalto'], area: 'cervinia', at: [[1485, 406]],
      blurb: 'A two-seat chair on the quiet Cieloalto side, below the village.' },
    { name: 'Lago Goillet', osm: ['Lago Goillet'], area: 'cervinia', at: [[1408, 250]],
      blurb: 'A six-seat chair from the Goillet lake up to Colle Superiore delle Cime Bianche, the gateway to Valtournenche.' },

    // ----- Valtournenche -----
    { name: 'Gran Sometta', osm: ['Gran Sometta'], area: 'valtournenche', at: [[1443, 226.5]],
      blurb: 'The chair up to Colle Superiore delle Cime Bianche from the Valtournenche side: the way back toward Cervinia.' },
    { name: 'Du Col', osm: ['Du Col'], area: 'valtournenche', at: [[1500, 239]],
      blurb: 'A short link chair by Colle Inferiore delle Cime Bianche.' },
    { name: 'Bec Carré', osm: ['Bec Carré'], area: 'valtournenche', at: [[1539, 285]],
      blurb: 'A six-seat chair with weather covers up to Colle Inferiore delle Cime Bianche, serving the upper Valtournenche runs.' },
    { name: 'Motta', osm: ['Motta'], area: 'valtournenche', at: [[1620, 351]],
      blurb: 'A chair from Salette up toward the Bec Carré lift: the second stage on the way from Valtournenche to Cervinia.' },
    { name: 'Becca d’Aran', osm: ['Becca d’Aran'], area: 'valtournenche', at: [[1670, 336]],
      blurb: 'A three-seat chair above Salette, serving the quiet runs on the Becca d’Aran side.' },
    { name: 'Salette', osm: ['Salette'], area: 'valtournenche', at: [[1701, 413]],
      blurb: 'A gondola from Valtournenche village (1,524 m) up to Salette: the only way in from this end of the area.' },
  ],
};
