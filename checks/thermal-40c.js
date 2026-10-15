// Why the board never reaches the 40 C goal: max LED power (and light) for a 40 C board, per gap and Ben case.
// Usage: node checks/thermal-40c.js
'use strict';
const path = require('path');
const E = require(path.join(__dirname, '..', 'engine.js'))();
const base = E.defaults(), pl = E.buildPlacer(base), pts = E.hex(base, pl, 60);
for (const gap of [10, 21]) for (const kase of ['worst', 'best']) {
  const c = E.clone(base); c.gap = gap; const g = E.buildGeo(c, c.res), F = E.Field(g, c); F.setAll(pts);
  const m = E.metrics(g, F.E, 60);
  const at = I => { const k = E.clone(c); k.current = I; const th = E.thermal(k, g.area, pts, { thermalCase: kase }); return { th, L: E.led(k, th.TjMax) }; };
  let lo = 0.1, hi = 60.5; for (let i = 0; i < 50; i++) { const mid = (lo + hi) / 2; if (at(mid).th.Tboard <= c.maxBoard) lo = mid; else hi = mid; }
  const r25 = at(25), r = at(lo), d = E.taskLight(g, F.E, r.L.flux, c);
  console.log(`${gap} mm, ${kase.padEnd(5)}: R_total ${r25.th.Rtotal.toFixed(1)} K/W (gap ${r25.th.Rint.toFixed(1)}, diffuser ${r25.th.Rpc.toFixed(2)}, outside ${r25.th.Rext.toFixed(1)}) | 25 mA: ${(60 * r25.L.Pel).toFixed(2)} W -> board ${r25.th.Tboard.toFixed(0)} C | 40 C board allows ${lo.toFixed(1)} mA = ${(60 * r.L.Pel).toFixed(2)} W -> ${(60 * r.L.flux * m.util * c.tau).toFixed(0)} lm out, desk min ${d.min.toFixed(0)} lx`);
}
