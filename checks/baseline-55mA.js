// Zoheb's power-budget baseline: hex layout, 3000 K, 55 mA, 21 mm gap, vs Variation B (same settings, optimized layout).
// Every constraint from the checklist, in Ben's worst and best air cases (full heat map, 4.6 W electronics on the board).
// Usage: node checks/baseline-55mA.js   (~1 min)
'use strict';
const path = require('path');
const E = require(path.join(__dirname, '..', 'engine.js'))();
const c = E.defaults(); c.gap = 21; c.cct = 3000; c.current = 55;
const pl = E.buildPlacer(c), H = E.hex(c, pl, 60);
const B = E.optimize(c, H, { iters: 15000, seed: 11, deskLimit: true }).pts;
function report(name, pts) {
  const g = E.buildGeo(c, c.res), F = E.Field(g, c); F.setAll(pts);
  const m = E.metrics(g, F.E, pts.length), nb = E.neighbours(pts), bud = E.lightBudget(c, g, pts);
  console.log(`\n${name}`);
  console.log(`  evenness ${(m.minAvg * 100).toFixed(0)}% whole face (outside the keepout corner ${(m.minAvgOut * 100).toFixed(0)}%), CV ${(m.cv * 100).toFixed(1)}%, dimmest 5% ${(m.p5Avg * 100).toFixed(0)}% | light: out ${(bud.out * 100).toFixed(1)}%, walls ${(bud.walls * 100).toFixed(1)}% | spacing ${Math.min(...nb.near).toFixed(1)}–${Math.max(...nb.near).toFixed(1)} mm`);
  for (const kase of ['worst', 'best']) {
    const k = E.clone(c); k.thermalCase = kase;
    const M = E.thermalMap(k, pts), L = E.led(k, M.TjMax), d = E.taskLight(g, F.E, L.flux, k);
    const chk = E.checklist(k, { lm: pts.length * L.flux * m.util * k.tau, deskMin: d.min, evenness: m.minAvg, evenAlt: (E.evenAlt(k, m) || {}).v, Tboard: M.Tmax, TjMax: M.TjMax, TdOut: M.TdOutMax, Tboss: M.Tboss, TshellIn: M.TshellIn, P: pts.length * L.Pel, bad: 0, drv: E.drive(k, pts.length) });
    console.log(`  [${kase} air] ` + chk.map(x => `${x.ok ? 'ok' : 'FAIL'} ${x.k} ${x.val}`).join(' | '));
  }
}
console.log(`Hex vs optimized at ${c.gap} mm, ${c.cct} K, ${c.current} mA (${(60 * E.led(c).Pel).toFixed(2)} W of LEDs at 25 °C) + ${c.elecW} W electronics`);
report('Baseline: hex grid', H);
report('Variation B: optimized layout (same current, gap and CCT)', B);
