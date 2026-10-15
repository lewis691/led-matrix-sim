// Reference numbers for the walkthrough example: Baseline vs Variation A vs Variation B, done the way the app does it.
// Usage: node checks/example-variations.js   (~1 min). The app uses random seeds, so its numbers differ by a few %.
'use strict';
const path = require('path');
const E = require(path.join(__dirname, '..', 'engine.js'))();
function report(name, c, pts) {
  const g = E.buildGeo(c, c.res), F = E.Field(g, c); F.setAll(pts);
  const m = E.metrics(g, F.E, pts.length), th = E.thermal(c, g.area, pts, {}), thb = E.thermal(c, g.area, pts, { thermalCase: 'best' });
  const M = E.thermalMap(c, pts), Mb = E.thermalMap(c, pts, { thermalCase: 'best' }), B = E.lightBudget(c, g, pts);
  const L = E.led(c, M.TjMax), desk = E.taskLight(g, F.E, L.flux, c), nb = E.neighbours(pts);
  const ds = nb.pairs.map(q => q.d);
  console.log(`${name}\n  evenness ${(m.minAvg * 100).toFixed(0)}% (whole face ${(m.minAvgFace * 100).toFixed(0)}%) | variation ${(m.cv * 100).toFixed(1)}% | light out ${(60 * L.flux * m.util * c.tau).toFixed(0)} lm | desk min ${desk.min.toFixed(0)} lx (avg ${desk.avg.toFixed(0)})` +
    ` | board map ${Mb.Tmax.toFixed(0)}–${M.Tmax.toFixed(0)} °C (Ben front-only ${thb.Tboard.toFixed(0)}–${th.Tboard.toFixed(0)}) | LED chip ≤ ${M.TjMax.toFixed(0)} °C | light: out ${(B.out * 100).toFixed(1)}%, walls ${(B.walls * 100).toFixed(1)}%, camera ring ${(B.annulus * 100).toFixed(2)}% | power ${(60 * L.Pel).toFixed(2)} W | LED spacing ${Math.min(...ds).toFixed(1)}–${Math.max(...ds).toFixed(1)} mm (avg ${(ds.reduce((a, b) => a + b) / ds.length).toFixed(1)})`);
}
const base = E.defaults(), pl = E.buildPlacer(base);
const B0 = E.hex(base, pl, 60);
report('Baseline: hex grid, CAD geometry (17.9 mm gap), 25 mA', base, B0);
const A = E.optimize(base, B0, { iters: 15000, seed: 11, deskLimit: true }).pts;
report('Variation A: optimized layout, CAD geometry', base, A);
for (const gap of [10, 25]) {   // what-if gaps (the CAD gap is 17.9)
  const c = E.clone(base); c.gap = gap;
  const Bp = E.optimize(c, A, { iters: 15000, seed: 11, deskLimit: true }).pts;
  report(`What-if: optimized layout at a ${gap} mm gap`, c, Bp);
}
