// Export the bench layouts (20 LEDs, 4 strings of 5, 22 mm minimum pitch) as build files in code/reports/:
//   <name>-led-coordinates.csv  mm from the dome centre, string, position along the string, nearest-neighbour spacing
//   <name>-layout.dxf           outline, keepout, LEDs and strings
//   bench-strings.json          geometry + series order, for checks/string-maps.py (printable 1:1 string maps)
// Strings are grouped for hand wiring: 4 groups of 5 with the least total wire (shortest chain through each group),
// and no wire crossing the camera keepout. All strings run at the same DC current, so the grouping doesn't change the
// light or heat model. Baseline and Variation A share the hex layout. Usage: node checks/export-bench-layouts.js
'use strict';
const fs = require('fs'), path = require('path');
const E = require(path.join(__dirname, '..', 'engine.js'))();
const c = E.defaults(); c.gap = 21; c.cct = 3000; c.current = 55; c.count = 20; c.minPitch = 22;
const pl = E.buildPlacer(c), out = path.join(__dirname, '..', 'reports'), K = c.keep;
fs.mkdirSync(out, { recursive: true });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
// a wire (straight segment) crosses the keepout if any point along it is inside the zone
const crossesZone = (a, b) => { for (let t = 0; t <= 1; t += 0.02) if (E.zoneDist(K, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t) < 0) return true; return false; };
function chain(pts, ids) {   // shortest open path through the group (5! orders), crossing wires heavily penalised
  let best = null, bc = Infinity;
  const perm = (a, k) => {
    if (k === a.length) { let l = 0; for (let i = 1; i < a.length; i++) { const p = pts[a[i - 1]], q = pts[a[i]]; l += dist(p, q) + (crossesZone(p, q) ? 1000 : 0); } if (l < bc) { bc = l; best = a.slice(); } return; }
    for (let i = k; i < a.length; i++) { [a[k], a[i]] = [a[i], a[k]]; perm(a, k + 1); [a[k], a[i]] = [a[i], a[k]]; }
  };
  perm(ids.slice(), 0); return { order: best, cost: bc };
}
function groupStrings(pts, nS, per) {   // simulated annealing over swaps between groups
  let g = Array.from({ length: nS }, (_, q) => [...Array(per).keys()].map(k => q * per + k));
  // start from rows (sorted by y then x) so the anneal begins near a sensible answer
  const byPos = pts.map((p, i) => i).sort((a, b) => pts[b].y - pts[a].y || pts[a].x - pts[b].x); g = g.map(grp => grp.map(k => byPos[k]));
  const cost = gr => gr.reduce((s, ids) => s + chain(pts, ids).cost, 0);
  let cur = cost(g), best = g.map(x => x.slice()), bc = cur, r = E.rng(7);
  for (let it = 0, T = 20; it < 6000; it++, T *= 0.999) {
    const a = Math.floor(r() * nS); let b = Math.floor(r() * (nS - 1)); if (b >= a) b++;
    const i = Math.floor(r() * per), j = Math.floor(r() * per);
    [g[a][i], g[b][j]] = [g[b][j], g[a][i]];
    const n = cost(g);
    if (n <= cur || r() < Math.exp((cur - n) / T)) { cur = n; if (n < bc) { bc = n; best = g.map(x => x.slice()); } } else [g[a][i], g[b][j]] = [g[b][j], g[a][i]];
  }
  return best.map(ids => chain(pts, ids).order);
}
const layouts = { 'bench-baseline-and-A-hex-20': ['hex', E.hex(c, pl, 20)], 'bench-B-optimized-20': ['B', require('./best-layout-20.json').leds] };
const maps = { outline: E.outline(c), zone: E.zonePoly(K, E.outline(c)), cam: { x: K.x, y: K.y, r: K.r, holeR: K.holeR }, holes: c.holes, layouts: {} };
for (const [file, [key, pts]] of Object.entries(layouts)) {
  if (pts.length !== 20) throw new Error(`${file}: ${pts.length} LEDs`);
  const strings = groupStrings(pts, 4, 5), s = new Array(20), pos = new Array(20), nb = E.neighbours(pts);
  strings.forEach((ids, q) => ids.forEach((i, k) => { s[i] = q; pos[i] = k + 1; }));
  let csv = 'led,string,position_in_string,x_mm,y_mm,nearest_neighbour_mm\n';
  pts.forEach((p, i) => { csv += [i + 1, s[i] + 1, pos[i], p.x.toFixed(2), p.y.toFixed(2), nb.near[i].toFixed(2)].join(',') + '\n'; });
  fs.writeFileSync(path.join(out, `${file}-led-coordinates.csv`), csv);
  fs.writeFileSync(path.join(out, `${file}-layout.dxf`), E.dxfExport(c, pts, s, true));
  maps.layouts[key] = strings.map(ids => ids.map(i => ({ led: i + 1, x: pts[i].x, y: pts[i].y })));
  const wires = strings.map(ids => ids.slice(1).map((i, k) => dist(pts[ids[k]], pts[i])));
  const crossing = strings.some(ids => ids.slice(1).some((i, k) => crossesZone(pts[ids[k]], pts[i])));
  console.log(`${file}: ${strings.map((ids, q) => `S${q + 1} ${ids.map(i => i + 1).join('-')} (${wires[q].map(w => w.toFixed(0)).join('/')} mm)`).join(' | ')} | total wire ${wires.flat().reduce((a, b) => a + b, 0).toFixed(0)} mm, longest ${Math.max(...wires.flat()).toFixed(1)} mm, crosses keepout: ${crossing}, placement ok: ${pts.every(p => pl.okRegion(p.x, p.y))}`);
}
fs.writeFileSync(path.join(out, 'bench-strings.json'), JSON.stringify(maps));
