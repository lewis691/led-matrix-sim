// Model predictions for the three bench conditions (hex baseline, Variation A = hex + foil walls, Variation B = optimized),
// all at 21 mm, 3000 K, 55 mA, 20 LEDs (4 strings of 5) at a 22 mm minimum pitch (hand-wiring limit). Bench conditions: LED heat only (the brief keeps the driver and logger outside,
// so the 4.6 W of Head electronics is NOT in the fixture). Foil walls are not modelled, so A's prediction is the hex
// baseline's; the measured A − baseline difference is the result.
// Usage: node checks/bench-predictions.js   (~1 min)
'use strict';
const path = require('path');
const E = require(path.join(__dirname, '..', 'engine.js'))();
const N = 20, c = E.defaults(); c.gap = 21; c.cct = 3000; c.current = 55; c.count = N; c.minPitch = 22; c.elecW = 0; c.camW = 0; c.elecSpots = [];
const pl = E.buildPlacer(c), H = E.hex(c, pl, N);
const B = require(path.join(__dirname, 'best-layout-20.json')).leds;   // Variation B = node checks/best-layout.js 20 22
const f = (v, d = 1) => v.toFixed(d);
console.log(`Bench predictions: ${c.gap} mm gap, ${c.cct} K, ${c.current} mA, ${N} LEDs (${N / 5} strings of 5), min pitch ${c.minPitch} mm, LED heat only (no Head electronics), room ${c.ambient} °C`);
console.log(`Per string: 5 × ${f(c.vf, 2)} V = ${f(5 * c.vf, 2)} V at ${c.current} mA = ${f(5 * c.vf * c.current / 1000, 3)} W; ${N / 5} strings = ${f(N * c.vf * c.current / 1000, 2)} W (datasheet Vf at 65 mA; the real Vf at 55 mA is a little lower)\n`);
for (const [name, pts] of [['Baseline (hex)', H], ['Variation A (hex + foil walls): model = baseline, foil not modelled', H], ['Variation B (optimized, checks/best-layout-20.json)', B]]) {
  const g = E.buildGeo(c, c.res), F = E.Field(g, c); F.setAll(pts);
  const m = E.metrics(g, F.E, N), nb = E.neighbours(pts);
  console.log(`${name}: LED spacing ${f(Math.min(...nb.near))}–${f(Math.max(...nb.near))} mm`);
  console.log(`  diffuser evenness (min/avg): whole face ${f(m.minAvg * 100, 0)}%, outside the keepout corner ${f(m.minAvgOut * 100, 0)}% | CV ${f(m.cv * 100, 1)}%`);
  for (const kase of ['worst', 'best']) {
    const k = E.clone(c); k.thermalCase = kase;
    const M = E.thermalMap(k, pts), L = E.led(k, M.TjMax), w = E.warmUp(k, M);
    const dm = E.deskMap(g, F.E, L.flux, k, 300, 3), grid = dm.lux;   // 3 × 3 points 200 mm apart, 400 mm below the diffuser, centred under the lit face
    const g9 = Array.from(grid), mean = g9.reduce((a, b) => a + b, 0) / 9, mn = Math.min(...g9), mx = Math.max(...g9);
    console.log(`  [${kase} air] board ${f(M.Tmin)}–${f(M.Tmax)} °C (rise ${f(M.Tmax - k.ambient)} K), hottest chip ${f(M.TjMax)} °C, diffuser outer surface up to ${f(M.TdOutMax)} °C, Head Back outside ${f(M.TshellOut)} °C`);
    console.log(`               warm-up: 63% of the rise after ${f(w.t63 / 60, 0)} min, 95% after ${f(w.t95 / 60, 0)} min | light out ${f(N * L.flux * m.util * k.tau, 0)} lm`);
    console.log(`               3 × 3 lux grid at 40 cm (rows = y +200 / 0 / −200 mm, cols = x −200 / 0 / +200 mm): ${[2, 1, 0].map(j => [0, 1, 2].map(i => f(grid[j * 3 + i], 0)).join(' ')).join(' | ')} → mean ${f(mean, 0)}, min ${f(mn, 0)}, max ${f(mx, 0)}, min/mean ${f(mn / mean * 100, 0)}%`);
  }
  console.log('');
}
