// Pulls run-name labels (with positions) out of the Breckenridge trail map PDF.
// Runs inside tools/extract.html after pdf.js has loaded the page into window.PAGE.
// Coordinates are PDF points with the origin at the top-left of the page.
async function buildLabels(page) {
  const H = page.getViewport({ scale: 1 }).height;
  const tc = await page.getTextContent();
  const raw = tc.items.filter(i => i.str.trim()).map(i => {
    const [a, b, c, d, e, f] = i.transform;
    return { s: i.str, x: e, y: H - f, h: Math.hypot(c, d), w: i.width, rot: Math.atan2(b, a) * 180 / Math.PI, font: i.fontName };
  });

  // The PDF contains most labels twice (layered copies)
  const seen = new Set(), uniq = [];
  for (const i of raw) {
    const k = i.s + '|' + i.x.toFixed(1) + '|' + i.y.toFixed(1);
    if (!seen.has(k)) { seen.add(k); uniq.push(i); }
  }

  // Labels that follow a curved path are stored one letter at a time; join them back up
  const merged = []; let cur = null;
  const endOf = i => [i.x + i.w * Math.cos(i.rot * Math.PI / 180), i.y - i.w * Math.sin(i.rot * Math.PI / 180)];
  for (const i of uniq) {
    const single = i.s.length <= 2;
    if (single && cur && Math.hypot(i.x - cur.ex, i.y - cur.ey) < i.h * 1.6 && Math.abs(i.h - cur.h) < 0.5) {
      cur.s += i.s; [cur.ex, cur.ey] = endOf(i); cur.pts.push([i.x, i.y]); continue;
    }
    if (cur) { merged.push(cur); cur = null; }
    if (single) { const [ex, ey] = endOf(i); cur = { ...i, ex, ey, pts: [[i.x, i.y]], chain: true }; continue; }
    merged.push({ ...i, pts: [[i.x, i.y]] });
  }
  if (cur) merged.push(cur);

  // Run names use fonts f1/f3 at ~5-7pt; skip the legend, stats table, header and footer
  const fontOk = o => /_f1$|_f3$/.test(o.font);
  const offMap = o => (o.x >= 1095 && o.y >= 530) || (o.x >= 1330 && o.y >= 400) || o.y >= 900 || o.y < 120 || (o.x < 240 && o.y > 720);
  let c = merged.filter(o => (fontOk(o) && o.h >= 5.2 && o.h <= 7.05 && !offMap(o)) || o.s === 'Easiest Way to Peak 9');

  // Two-line labels ("Imperial" / "Bowl"): consecutive, horizontal, second line just below
  const rows = [];
  for (let i = 0; i < c.length; i++) {
    const a = c[i], b = c[i + 1];
    if (b && Math.abs(a.rot) < 3 && Math.abs(b.rot) < 3 && Math.abs(b.x - a.x) < 10 && b.y - a.y > 6 && b.y - a.y < 10.5) {
      rows.push({ ...a, s: a.s + ' ' + b.s, lines: 2, x2: b.x, y2: b.y, w2: b.w }); i++;
    } else rows.push({ ...a, lines: 1 });
  }

  const EXCLUDE = new Set(['Terrain Park', 'Terrain Only', 'Hike-To Terrain', 'No Lift Access', 'Peak 6', 'Peak 7', 'Peak 8', 'Peak 9', 'Peak 10',
    'The Overlook', 'Vista Haus', 'Pioneer Crossing', 'TenMile Station', 'Horizon Hut', 'GoldRunner Coaster', 'BRECKENRIDGE STATION', 'S', 'M', 'L']);
  const clean = s => s.replace(/\s+/g, ' ').trim().replace(/’s(?=[A-Z])/g, '’s ');
  const r1 = n => +n.toFixed(1);
  const seen2 = new Set(); let L = [];
  for (const r of rows) {
    const name = clean(r.s);
    const k = name + '|' + r.x.toFixed(0) + '|' + r.y.toFixed(0);
    if (seen2.has(k) || EXCLUDE.has(name)) continue;
    seen2.add(k);
    L.push({ name, x: r1(r.x), y: r1(r.y), w: r1(r.w), h: r1(r.h), rot: r1(r.rot), lines: r.lines,
      ...(r.lines === 2 ? { x2: r1(r.x2), y2: r1(r.y2), w2: r1(r.w2) } : {}),
      ...(r.chain ? { pts: r.pts.map(p => [r1(p[0]), r1(p[1])]) } : {}) });
  }
  // A duplicated two-line label can leave its second line behind on its own
  L = L.filter(l => !L.some(m => m.lines === 2 && m !== l && Math.abs(m.x2 - l.x) < 1 && Math.abs(m.y2 - l.y) < 1));

  // Labels split in ways the generic rules don't catch
  const PAIRS = [['American', 'Terrain Park', 'American Terrain Park'], ['Toyota', 'Banked Slalom', 'Toyota Banked Slalom'],
    ['Goodbye', 'Girl', 'Goodbye Girl'], ['Southern', 'Cross', 'Southern Cross'], ['Pat’s', 'Wonderland', 'Pat’s Wonderland']];
  // "Terrain Park" pieces were excluded above, so re-find them in the raw merged list
  const parkPieces = merged.filter(o => o.s === 'Terrain Park' || o.s === 'Banked Slalom');
  for (const [a, b, full] of PAIRS) {
    const A = L.find(l => l.name === a && (a !== 'American' || l.rot > 45));
    if (!A) continue;
    const B = L.find(l => l.name === b) || parkPieces.filter(p => p.s === b).sort((p, q) => Math.hypot(p.x - A.x, p.y - A.y) - Math.hypot(q.x - A.x, q.y - A.y))[0];
    A.name = full;
    if (B) { A.lines = 2; A.x2 = r1(B.x); A.y2 = r1(B.y); A.w2 = r1(B.w); L = L.filter(l => l !== B); }
  }
  return L;
}
