// Search for the best 60-LED layout at the bench conditions (21 mm, 3000 K, 55 mA, desk limit on, whole-face evenness
// scoring). Many starts (hex + Poisson/CVT seeds), each annealed; the best by the model's own score is polished with a
// longer run. Writes checks/data/best-layout.json (the app's design format: cfg + leds) for loading into the app.
// Usage: node checks/best-layout.js [count] [minPitch mm]   (default 60 LEDs at the model's minimum pitch; ~2–5 min)
// Writes checks/data/best-layout.json (60 LEDs) or checks/data/best-layout-<count>.json. The desk limit is only applied for the full
// 60-LED array: a reduced bench section can't reach the full head's 500 lx, and chasing it would bunch the LEDs.
'use strict';
const fs = require('fs'), path = require('path');
const E = require(path.join(__dirname, '..', 'engine.js'))();
const N = +(process.argv[2] || 60), c = E.defaults(); c.gap = 21; c.cct = 3000; c.current = 55; c.count = N; if (process.argv[3]) c.minPitch = +process.argv[3];
const deskLimit = N === 60;
console.log(`${N} LEDs, minimum pitch ${c.minPitch} mm, ${c.gap} mm gap, ${c.current} mA, desk limit ${deskLimit ? 'on' : 'off'}`);
const pl = E.buildPlacer(c), g = E.buildGeo(c, c.res), ITERS = 20000;
const starts = [];
for (const s of [11, 23, 37]) starts.push({ name: `hex, seed ${s}`, pts: E.hex(c, pl, N), seed: s });
for (let k = 0; k < 9; k++) { const s = 101 + 97 * k; starts.push({ name: `Poisson+CVT ${s}`, pts: E.cvt(c, pl, E.poisson(c, pl, N, s), 25), seed: s }); }
// only full-count layouts compete: at a wide pitch some random starts can't fit all N LEDs
for (let i = starts.length - 1; i >= 0; i--) if (starts[i].pts.length !== N) { console.log(`${starts[i].name}: placed only ${starts[i].pts.length} of ${N}, skipped`); starts.splice(i, 1); }
for (let k = 0, s = 1001; starts.length < 12 && k < 40; k++, s += 89) { const pts = E.cvt(c, pl, E.poisson(c, pl, N, s), 25); if (pts.length === N) starts.push({ name: `Poisson+CVT ${s}`, pts, seed: s }); }
for (let s = 53; starts.length < 12; s += 16) starts.push({ name: `hex, seed ${s}`, pts: E.hex(c, pl, N), seed: s });   // top up with more annealing seeds
const evalPts = pts => { const F = E.Field(g, c); F.setAll(pts); const m = E.metrics(g, F.E, N); return { m, J: E.objective(c, m) }; };
const rows = [];
for (const st of starts) {
  const t = Date.now(), r = E.optimize(c, st.pts, { iters: ITERS, seed: st.seed, deskLimit }), e = evalPts(r.pts);
  rows.push({ ...st, r, ...e });
  console.log(`${st.name.padEnd(18)} score ${e.J.toFixed(4)} | evenness whole face ${(e.m.minAvg * 100).toFixed(1)}%, outside corner ${(e.m.minAvgOut * 100).toFixed(1)}% | CV ${(e.m.cv * 100).toFixed(1)}% | desk ok ${r.deskOk} | ${((Date.now() - t) / 1000).toFixed(0)} s`);
}
rows.sort((a, b) => a.J - b.J);
const top = rows[0];
const pol = E.optimize(c, top.r.pts, { iters: 60000, seed: top.seed + 1, deskLimit }), ep = evalPts(pol.pts);
if (pol.pts.length !== N || top.r.pts.length !== N) throw new Error('layout lost LEDs');
const best = ep.J < top.J ? { pts: pol.pts, ...ep, how: `${top.name} + 60k-iteration polish` } : { pts: top.r.pts, J: top.J, m: top.m, how: top.name };
const hex = evalPts(E.hex(c, pl, N));
console.log(`\nBest: ${best.how}: score ${best.J.toFixed(4)} (hex ${hex.J.toFixed(4)}) | evenness whole face ${(best.m.minAvg * 100).toFixed(1)}% (hex ${(hex.m.minAvg * 100).toFixed(1)}%), outside corner ${(best.m.minAvgOut * 100).toFixed(1)}% (hex ${(hex.m.minAvgOut * 100).toFixed(1)}%) | CV ${(best.m.cv * 100).toFixed(1)}% (hex ${(hex.m.cv * 100).toFixed(1)}%)`);
console.log(`Spread of the ${rows.length} starts: score ${rows[0].J.toFixed(4)}–${rows[rows.length - 1].J.toFixed(4)}`);
const bad = pl.okRegion ? best.pts.filter(p => !pl.okRegion(p.x, p.y)).length : 0;
console.log(`LEDs breaking a placement limit: ${bad}`);
fs.writeFileSync(path.join(__dirname, 'data', N === 60 ? 'best-layout.json' : `best-layout-${N}.json`), JSON.stringify({ cfg: c, leds: best.pts.map(p => ({ x: +p.x.toFixed(3), y: +p.y.toFixed(3) })), note: best.how }, null, 1));
