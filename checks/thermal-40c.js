// Why the board never reaches the 40 C goal: the full heat map at 0 mA (electronics only) and at 25 mA, and the
// highest current that keeps the board <= 40 C, per gap and Ben air case. Ben's front network is printed for reference.
// Usage: node checks/thermal-40c.js   (~1 min)
'use strict';
const path = require('path');
const E = require(path.join(__dirname, '..', 'engine.js'))();
const base = E.defaults();
console.log(`Hex layout, 60 LEDs, electronics ${base.elecW} W (worst case, your power table), room ${base.ambient} °C, board goal ${base.maxBoard} °C\n`);
for (const gap of [base.gap, 21]) for (const kase of ['worst', 'best']) {
  const c = E.clone(base); c.gap = gap; c.thermalCase = kase;
  const pl = E.buildPlacer(c), pts = E.hex(c, pl, 60), g = E.buildGeo(c, c.res), F = E.Field(g, c); F.setAll(pts);
  const m = E.metrics(g, F.E, 60);
  const at = I => { const k = E.clone(c); k.current = I; const M = E.thermalMap(k, pts); return { M, L: E.led(k, M.TjMax) }; };
  const r0 = at(0), r25 = at(25), ben = E.thermal(c, g.area, pts, { thermalCase: kase });
  let line = `${String(gap).padStart(4)} mm, ${kase.padEnd(5)} | Ben front network ${ben.Rtotal.toFixed(1)} K/W (gap ${ben.Rint.toFixed(1)}, diffuser ${ben.Rpc.toFixed(2)}, outside ${ben.Rext.toFixed(1)})`;
  line += ` | heat map: 0 mA (electronics only) board ${r0.M.Tmax.toFixed(1)} °C, 25 mA (${(60 * r25.L.Pel).toFixed(2)} W) board ${r25.M.Tmax.toFixed(1)} °C`;
  if (r0.M.Tmax > c.maxBoard) line += ` | 40 °C impossible: the electronics alone exceed it`;
  else {
    let lo = 0, hi = 25; for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (at(mid).M.Tmax <= c.maxBoard) lo = mid; else hi = mid; }
    const r = at(lo), d = E.taskLight(g, F.E, r.L.flux, c);
    line += ` | 40 °C board allows ${lo.toFixed(1)} mA = ${(60 * r.L.Pel).toFixed(2)} W -> ${(60 * r.L.flux * m.util * c.tau).toFixed(0)} lm out, desk min ${d.min.toFixed(0)} lx`;
  }
  console.log(line);
}
{ // with the electronics off the board (Ben's assumption): the LED-only limit
  const c = E.clone(base); c.elecW = 0; c.camW = 0;
  const pl = E.buildPlacer(c), pts = E.hex(c, pl, 60), g = E.buildGeo(c, c.res), F = E.Field(g, c); F.setAll(pts);
  const m = E.metrics(g, F.E, 60), at = I => { const k = E.clone(c); k.current = I; const M = E.thermalMap(k, pts); return { M, L: E.led(k, M.TjMax) }; };
  let lo = 0, hi = 25; for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (at(mid).M.Tmax <= c.maxBoard) lo = mid; else hi = mid; }
  const r = at(lo), d = E.taskLight(g, F.E, r.L.flux, c);
  console.log(`\nElectronics off the board, ${c.gap} mm, worst case: 40 °C allows ${lo.toFixed(1)} mA = ${(60 * r.L.Pel).toFixed(2)} W -> ${(60 * r.L.flux * m.util * c.tau).toFixed(0)} lm out, desk min ${d.min.toFixed(0)} lx (targets ${c.targetLm} lm, ${c.targetLux} lx)`);
}
