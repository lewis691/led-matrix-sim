// Colour temperature: Variation A (re-optimized at the CAD geometry, desk limit on) at 3000 / 4000 / 5000 K,
// typical and worst-case (-7 %) flux, plus the lowest current that meets 300 lm and 500 lx for each.
// Flux derating uses the full heat map's hottest LED chip, as the app does.
// Usage: node checks/cct.js   (~1 min)
'use strict';
const path = require('path');
const E = require(path.join(__dirname, '..', 'engine.js'))();
const base = E.defaults(), pl = E.buildPlacer(base);
const A = E.optimize(base, E.hex(base, pl, 60), { iters: 15000, seed: 11, deskLimit: true }).pts;
const g = E.buildGeo(base, base.res), F = E.Field(g, base); F.setAll(A);
const m = E.metrics(g, F.E, 60), d1 = E.taskLight(g, F.E, 1, base).min;
console.log(`Variation A at the CAD geometry (gap ${base.gap} mm), 25 mA, ${base.thermalCase} case heat\n`);
for (const k of [3000, 4000, 5000]) for (const fc of ['typ', 'tol']) {
  const c = E.clone(base); c.cct = k; c.fluxCase = fc;
  const M = E.thermalMap(c, A), L = E.led(c, M.TjMax), d = E.taskLight(g, F.E, L.flux, c);
  const s = E.sweepCurrent(c, g.area, A, { lmPerFlux: 60 * m.util * c.tau, luxPerFlux: d1 });
  console.log(`${k} K ${fc === 'typ' ? 'typical' : '-7 %   '} | flux/LED ${L.flux.toFixed(2)} lm | out ${(60 * L.flux * m.util * c.tau).toFixed(0)} lm | desk min ${d.min.toFixed(0)} lx | lowest current meeting 300 lm + 500 lx: ${s.best ? s.best.I.toFixed(1) + ' mA (' + s.best.P.toFixed(2) + ' W, board ' + s.best.Tboard.toFixed(0) + ' °C, chip ' + s.best.TjMax.toFixed(1) + ' °C' + (s.best.TjMax > E.LED_LIMITS.maxTj ? ' > 125 limit' : '') + ')' : 'none up to ' + s.tlcMax.toFixed(1) + ' mA'}`);
}
