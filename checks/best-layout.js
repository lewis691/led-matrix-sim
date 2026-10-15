// Search for the best 60-LED layout at the bench conditions (21 mm, 3000 K, 55 mA, desk limit on, whole-face evenness
// scoring). Many starts (hex + Poisson/CVT seeds), each annealed; the best by the model's own score is polished with a
// longer run. Writes checks/best-layout.json (the app's design format: cfg + leds) for loading into the app.
// Usage: node checks/best-layout.js   (~3–5 min)
'use strict';
const fs = require('fs'), path = require('path');
const E = require(path.join(__dirname, '..', 'engine.js'))();
const c = E.defaults(); c.gap = 21; c.cct = 3000; c.current = 55;
const pl = E.buildPlacer(c), g = E.buildGeo(c, c.res), ITERS = 20000;
const starts = [];
for (const s of [11, 23, 37]) starts.push({ name: `hex, seed ${s}`, pts: E.hex(c, pl, 60), seed: s });
for (let k = 0; k < 9; k++) { const s = 101 + 97 * k; starts.push({ name: `Poisson+CVT ${s}`, pts: E.cvt(c, pl, E.poisson(c, pl, 60, s), 25), seed: s }); }
const evalPts = pts => { const F = E.Field(g, c); F.setAll(pts); const m = E.metrics(g, F.E, 60); return { m, J: E.objective(c, m) }; };
const rows = [];
for (const st of starts) {
  const t = Date.now(), r = E.optimize(c, st.pts, { iters: ITERS, seed: st.seed, deskLimit: true }), e = evalPts(r.pts);
  rows.push({ ...st, r, ...e });
  console.log(`${st.name.padEnd(18)} score ${e.J.toFixed(4)} | evenness whole face ${(e.m.minAvg * 100).toFixed(1)}%, outside corner ${(e.m.minAvgOut * 100).toFixed(1)}% | CV ${(e.m.cv * 100).toFixed(1)}% | desk ok ${r.deskOk} | ${((Date.now() - t) / 1000).toFixed(0)} s`);
}
rows.sort((a, b) => a.J - b.J);
const top = rows[0];
const pol = E.optimize(c, top.r.pts, { iters: 60000, seed: top.seed + 1, deskLimit: true }), ep = evalPts(pol.pts);
const best = ep.J < top.J ? { pts: pol.pts, ...ep, how: `${top.name} + 60k-iteration polish` } : { pts: top.r.pts, J: top.J, m: top.m, how: top.name };
const hex = evalPts(E.hex(c, pl, 60));
console.log(`\nBest: ${best.how}: score ${best.J.toFixed(4)} (hex ${hex.J.toFixed(4)}) | evenness whole face ${(best.m.minAvg * 100).toFixed(1)}% (hex ${(hex.m.minAvg * 100).toFixed(1)}%), outside corner ${(best.m.minAvgOut * 100).toFixed(1)}% (hex ${(hex.m.minAvgOut * 100).toFixed(1)}%) | CV ${(best.m.cv * 100).toFixed(1)}% (hex ${(hex.m.cv * 100).toFixed(1)}%)`);
console.log(`Spread of the ${rows.length} starts: score ${rows[0].J.toFixed(4)}–${rows[rows.length - 1].J.toFixed(4)}`);
const bad = pl.okRegion ? best.pts.filter(p => !pl.okRegion(p.x, p.y)).length : 0;
console.log(`LEDs breaking a placement limit: ${bad}`);
fs.writeFileSync(path.join(__dirname, 'best-layout.json'), JSON.stringify({ cfg: c, leds: best.pts.map(p => ({ x: +p.x.toFixed(3), y: +p.y.toFixed(3) })), note: best.how }, null, 1));
