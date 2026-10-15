// Desk-light limit (>= 500 lx over the 40 cm circle at 40 cm): does the optimizer respect it, and what does it cost?
// Usage: node checks/desk-limit.js   (~1 min)
'use strict';
const path = require('path');
const E = require(path.join(__dirname, '..', 'engine.js'))();
const base = E.defaults(), pl = E.buildPlacer(base), H = E.hex(base, pl, 60);
const pct = v => (v * 100).toFixed(0) + '%';
function show(label, c, r) {
  const g = E.buildGeo(c, c.res), F = E.Field(g, c); F.setAll(r.pts, r.duty ? r.groups.map(q => r.duty[q]) : null);
  const m = E.metrics(g, F.E, 60), th = E.thermal(c, g.area, r.pts, {}), desk = E.taskLight(g, F.E, E.led(c, th.TjMax).flux, c);
  console.log(`${label.padEnd(44)} | evenness ${pct(m.minAvg).padStart(4)} | CV ${(m.cv * 100).toFixed(1).padStart(4)}% | desk min ${desk.min.toFixed(0).padStart(4)} lx (avg ${desk.avg.toFixed(0)}) | limit met: ${desk.min >= c.targetLux ? 'yes' : 'NO'}${r.deskOk === false ? ' (optimizer reported it could not reach the limit)' : ''}`);
  return desk.min;
}
for (const mA of [25, 20]) {
  const c = E.clone(base); c.current = mA;
  console.log(`\n--- ${mA} mA (${(60 * c.vf * mA / 1000).toFixed(2)} W), hex start ---`);
  const g = E.buildGeo(c, c.res), F = E.Field(g, c); F.setAll(H);
  const th = E.thermal(c, g.area, H, {}), d0 = E.taskLight(g, F.E, E.led(c, th.TjMax).flux, c), m0 = E.metrics(g, F.E, 60);
  console.log(`${'hex start'.padEnd(44)} | evenness ${pct(m0.minAvg).padStart(4)} | CV ${(m0.cv * 100).toFixed(1).padStart(4)}% | desk min ${d0.min.toFixed(0).padStart(4)} lx (avg ${d0.avg.toFixed(0)})`);
  show('optimize, limit OFF', c, E.optimize(c, H, { iters: 6000, seed: 3 }));
  show('optimize, limit ON', c, E.optimize(c, H, { iters: 6000, seed: 3, deskLimit: true }));
  const groups = E.assignStrings(H, 5, g.areaD, 'zones', pl.sdfAt);
  show('optimize + joint dimming, limit OFF', c, E.optimize(c, H, { iters: 6000, seed: 3, dimming: true, groups, minDuty: 0.3, regroup: { per: 5, mode: 'zones' } }));
  show('optimize + joint dimming, limit ON', c, E.optimize(c, H, { iters: 6000, seed: 3, deskLimit: true, dimming: true, groups, minDuty: 0.3, regroup: { per: 5, mode: 'zones' } }));
}
