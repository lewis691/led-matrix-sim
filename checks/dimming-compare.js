// Joint (positions + string dimming optimized together) vs two-pass (positions first, then dimming).
// Usage: node checks/dimming-compare.js     (~1-2 min)
'use strict';
const path = require('path');
const E = require(path.join(__dirname, '..', 'engine.js'))();
const c = E.defaults(), pl = E.buildPlacer(c), g = E.buildGeo(c, 1.5);
const J = m => c.w.cv * m.cv + c.w.min * (1 - m.minAvg), p = (v, d = 0) => (v * 100).toFixed(d) + '%';
const rows = [];
console.log('6 runs (3 starts x 2 seeds), 6000 iterations, zone strings, min duty 0.3, 10 mm gap\n');
for (const [sn, S] of [['hex', E.hex(c, pl, 60)], ['random A', E.poisson(c, pl, 60, 4)], ['random B', E.poisson(c, pl, 60, 8)]]) for (const seed of [9, 31]) {
  // two-pass: optimize positions at full power, then group strings and balance duties
  const a = E.optimize(c, S, { iters: 6000, seed });
  const ga = E.assignStrings(a.pts, 5, g.areaD, 'zones', pl.sdfAt), F = E.Field(g, c); F.setAll(a.pts);
  const ba = E.balanceStrings(g, c, F, ga, 12, { minDuty: 0.3 }); F.setWeights(ga.map(q => ba.w[q]));
  const ma = E.metrics(g, F.E, 60);
  // joint: same start; strings regrouped by zone as LEDs move; duties annealed together with positions
  const groups = E.assignStrings(S, 5, g.areaD, 'zones', pl.sdfAt);
  const b = E.optimize(c, S, { iters: 6000, seed, dimming: true, groups, minDuty: 0.3, regroup: { per: 5, mode: 'zones' } });
  // same final duty pass on the fine scoring grid as the two-pass method gets
  const F2 = E.Field(g, c); F2.setAll(b.pts); const bb = E.balanceStrings(g, c, F2, b.groups, 12, { minDuty: 0.3, start: b.duty }); F2.setWeights(b.groups.map(q => bb.w[q])); const mb = E.metrics(g, F2.E, 60);
  b.kept = bb.after.kept;
  rows.push({ ma, ka: ba.after.kept, mb, kb: b.kept });
  console.log(`${sn.padEnd(9)} seed ${String(seed).padEnd(3)}| two-pass: evenness ${p(ma.minAvg)}, CV ${p(ma.cv, 1)}, score ${J(ma).toFixed(3)}, light kept ${p(ba.after.kept)}  | joint: evenness ${p(mb.minAvg)}, CV ${p(mb.cv, 1)}, score ${J(mb).toFixed(3)}, light kept ${p(b.kept)}`);
}
const avg = f => rows.reduce((s, r) => s + f(r), 0) / rows.length;
console.log(`\nAVERAGE two-pass: evenness ${p(avg(r => r.ma.minAvg), 1)}, CV ${p(avg(r => r.ma.cv), 1)}, score ${avg(r => J(r.ma)).toFixed(3)}, light kept ${p(avg(r => r.ka))}`);
console.log(`AVERAGE joint   : evenness ${p(avg(r => r.mb.minAvg), 1)}, CV ${p(avg(r => r.mb.cv), 1)}, score ${avg(r => J(r.mb)).toFixed(3)}, light kept ${p(avg(r => r.kb))}`);
console.log(`joint scored better in ${rows.filter(r => J(r.mb) < J(r.ma)).length} of ${rows.length} runs`);
