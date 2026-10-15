// Why does evenness (scored outside the keepout corner) stay below 65 %? Tests each suspect in turn.
// CAD geometry (lit aperture, bosses, default keepout); flux derated at the heat map's hottest LED chip.
// Usage: node checks/gap21-why.js  (~3 min)
'use strict';
const path = require('path');
const E = require(path.join(__dirname, '..', 'engine.js'))();
function where(c, pts) {
  const g = E.buildGeo(c, c.res), F = E.Field(g, c); F.setAll(pts);
  const m = E.metrics(g, F.E, pts.length);
  let mc = -1, mv = Infinity;
  for (let k = 0; k < g.nD; k++) if (!g.camMask[k] && g.dEval[k] && F.E[k] < mv) { mv = F.E[k]; mc = k; }
  const x = g.dx[mc], y = g.dy[mc], K = c.keep;
  // distance of the darkest cell to the outline
  let dEdge = Infinity; const P = g.poly;
  for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], vx = b[0] - a[0], vy = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * vx + (y - a[1]) * vy) / (vx * vx + vy * vy))); dEdge = Math.min(dEdge, Math.hypot(x - a[0] - t * vx, y - a[1] - t * vy)); }
  // evenness over the interior only (cells >= gap from the wall)
  let s = 0, n = 0, mi = Infinity;
  for (let k = 0; k < g.nD; k++) if (!g.camMask[k] && g.dEval[k]) { let d = Infinity; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], vx = b[0] - a[0], vy = b[1] - a[1], t = Math.max(0, Math.min(1, ((g.dx[k] - a[0]) * vx + (g.dy[k] - a[1]) * vy) / (vx * vx + vy * vy))); d = Math.min(d, Math.hypot(g.dx[k] - a[0] - t * vx, g.dy[k] - a[1] - t * vy)); } if (d >= c.gap) { s += F.E[k]; n++; mi = Math.min(mi, F.E[k]); } }
  return { ev: m.minAvg, cv: m.cv, x, y, dEdge, dLens: K.on ? Math.hypot(x - K.x, y - K.y) - K.r : NaN, interiorEv: mi / (s / n) };
}
function run(label, c, opt) {
  const pl = E.buildPlacer(c), start = E.hex(c, pl, c.count);
  const r = E.optimize(c, start, Object.assign({ iters: 15000, seed: 11 }, opt));
  const w = where(c, r.pts);
  console.log(`${label.padEnd(44)} evenness ${(w.ev * 100).toFixed(0)}%  CV ${(w.cv * 100).toFixed(1)}%  darkest at (${w.x.toFixed(0)}, ${w.y.toFixed(0)}): ${w.dEdge.toFixed(1)} mm from wall${Number.isFinite(w.dLens) ? ', ' + w.dLens.toFixed(1) + ' mm from lens' : ''}  | evenness ignoring cells < gap from wall ${(w.interiorEv * 100).toFixed(0)}%`);
  return r;
}
const base = E.defaults();
for (const gap of [10, base.gap, 21]) {
  const c = E.clone(base); c.gap = gap;
  run(`gap ${gap} mm, default`, c, { deskLimit: true });
}
const c21 = E.clone(base); c21.gap = 21;
run('21 mm, desk limit off', c21, { deskLimit: false });
const nc = E.clone(c21); nc.keep.on = false; run('21 mm, no camera', nc, { deskLimit: true });
const sm = E.clone(c21); sm.edgeMargin = 0; sm.minPitch = 3.6; run('21 mm, LEDs allowed right at the wall', sm, { deskLimit: true });
const rim = E.clone(c21); rim.evalInset = 5; run(`21 mm, 5 mm rim not scored (default ${base.evalInset})`, rim, { deskLimit: true });
const n90 = E.clone(c21); n90.count = 90; run('21 mm, 90 LEDs', n90, { deskLimit: true });

// Follow-up: the desk limit is the cause. How much light does the even layout give, and what current lets both pass?
console.log('\nDesk light of the even (limit-off) layout, and current needed with the limit on:');
function desk(c, pts) { const g = E.buildGeo(c, c.res), F = E.Field(g, c); F.setAll(pts); const m = E.metrics(g, F.E, pts.length), th = E.thermalMap(c, pts), L = E.led(c, th.TjMax); return { m, d: E.taskLight(g, F.E, L.flux, c), lm: pts.length * L.flux * m.util * c.tau, util: m.util }; }
for (const gap of [base.gap, 21]) { const c = E.clone(base); c.gap = gap; const r = E.optimize(c, E.hex(c, E.buildPlacer(c), 60), { iters: 15000, seed: 11, deskLimit: false }); const q = desk(c, r.pts); console.log(`  ${gap} mm, limit off: evenness ${(q.m.minAvg * 100).toFixed(0)}%, light reaching diffuser ${(q.util * 100).toFixed(0)}%, light out ${q.lm.toFixed(0)} lm, desk min ${q.d.min.toFixed(0)} lx`); }
for (const I of [27, 29, 31, 33]) { const c = E.clone(c21); c.current = I; const r = E.optimize(c, E.hex(c, E.buildPlacer(c), 60), { iters: 15000, seed: 11, deskLimit: true }); const q = desk(c, r.pts); const th = E.thermalMap(c, r.pts); console.log(`  21 mm, ${I} mA, limit on: evenness ${(q.m.minAvg * 100).toFixed(0)}%, desk min ${q.d.min.toFixed(0)} lx, power ${(60 * E.led(c).Pel).toFixed(2)} W, board ${th.Tmax.toFixed(0)} °C worst case (heat map)`); }
