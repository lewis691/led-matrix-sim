// Runnable proof that each feature does what it claims, checked against the source it comes from.
// Usage (from the code folder):  node checks/examples.js        (~1 min)
'use strict';
const path = require('path');
const E = require(path.join(__dirname, '..', 'engine.js'))();
let pass = 0, fail = 0;
function check(name, source, expected, got, ok) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}\n      source:   ${source}\n      expected: ${expected}\n      got:      ${got}\n`);
  ok ? pass++ : fail++;
}
const f = (v, d = 2) => Number(v).toFixed(d);
const cfg = E.defaults(), placer = E.buildPlacer(cfg);

// 1. Light from one LED (Ben's Notion derivation; Moreno 2006 Eq. 1 cos^m source × incidence cosine, m = 1): E = Φ h² / (π (h² + r²)²)
{
  const c = E.clone(cfg); c.keep.on = false; const g = E.buildGeo(c, 0.5), out = new Float32Array(g.nD);
  E.ledContrib(g, c, 0, 0, out);
  // nearest cell to (x, y); r = that cell's distance from the LED at (0, 0)
  const h = c.gap - c.ledH, at = (x, y) =>   // optical height: LED top (0.62 mm above the board, Pro9 p.23) to the diffuser
   { let best = 0, bd = Infinity; for (let k = 0; k < g.nD; k++) { const d = Math.hypot(g.dx[k] - x, g.dy[k] - y); if (d < bd) { bd = d; best = k; } } return { E: out[best], r: Math.hypot(g.dx[best], g.dy[best]) }; };
  const a = at(0, 0), b = at(h, 0), fa = h * h / (Math.PI * (h * h + a.r * a.r) ** 2), fb = h * h / (Math.PI * (h * h + b.r * b.r) ** 2);
  check('1. Single-LED light matches the closed-form formula', "Ben's 'LED research doc + sim'; Moreno 2006 Eq. 1 + incidence cosine",
    `directly above: ${f(fa * 1e3, 4)} ‰/mm²; one gap sideways: ${f(fb * 1e3, 4)} ‰/mm²`, `${f(a.E * 1e3, 4)} and ${f(b.E * 1e3, 4)}`,
    Math.abs(a.E / fa - 1) < 1e-6 && Math.abs(b.E / fb - 1) < 1e-6);
}

// 2. Energy: an LED far from the walls puts almost all of its light on the diffuser (Lambertian: share within radius R = R²/(R²+h²))
{
  const c = E.clone(cfg); c.keep.on = false; c.gap = 3; const g = E.buildGeo(c, 0.5), out = new Float32Array(g.nD);
  E.ledContrib(g, c, -10, 20, out); let s = 0; for (const v of out) s += v * g.res * g.res;
  const R = 40, h = c.gap - c.ledH, bound = R * R / (R * R + h * h);   // lit-aperture edge is >= 43 mm from (-10, 20)
  check('2. Light is conserved (nothing created or lost inside the head)', 'Lambertian integral (Ben\'s derivation: Φ = π I₀)',
    `≥ ${f(bound * 100, 1)}% lands on the diffuser (nearest wall ≥ 40 mm away), never > 100%`, `${f(s * 100, 2)}%`, s >= bound - 0.005 && s <= 1.0001);
}

// 3. Moreno's maximally flat spacing for a triangular (hex) array, 7x7, m = 50: d0 = 0.192 z. (Moreno's Eq. 3 counts the
//    incidence cosine inside m, so at m = 50 our kernel equals theirs at m = 51: hence 0.191 vs 0.192, within the tolerance.)
{
  const m = 50, Ef = (x, pts) => pts.reduce((a, [px, py]) => a + 1 / (((x - px) ** 2 + py * py + 1) ** ((m + 3) / 2)), 0);
  const tri = D => { const P = []; for (let j = 1; j <= 7; j++) { const Nj = 7 - (j + 1) % 2; for (let i = 1; i <= Nj; i++) P.push([(Nj + 1 - 2 * i) * D / 2, (7 + 1 - 2 * j) * Math.sqrt(3) / 4 * D]); } return P; };
  let zero = null, prev = null;
  for (let D = 0.10; D < 0.30; D += 0.0005) { const P = tri(D), e = 1e-3, c2 = Ef(e, P) - 2 * Ef(0, P) + Ef(-e, P); if (prev !== null && Math.sign(c2) !== Math.sign(prev)) { zero = D; break; } prev = c2; }
  check("3. Hex layout geometry reproduces Moreno's published optimum", 'Moreno, Avendaño-Alejo & Tzonchev 2006, Fig. 7 (d0 = 0.192 z)',
    'd0 ≈ 0.192 z', `${f(zero, 3)} z`, Math.abs(zero - 0.192) < 0.003);
}

// 4. Hotspot ripple between LEDs vs gap, in a large hex array (Yang 2009 analyses an effectively infinite array).
//    The head is scaled up 3x and filled with a hex grid at our pitch (12.5 mm); the centre 60 x 60 mm is compared
//    with the Fourier (sampling) prediction for an infinite hex grid of Lambertian LEDs: RMS ripple 2.37% / 0.27% / 0.01%.
{
  const pitch = 12.5, pred = { 10: 2.37, 14: 0.27, 21: 0.01 }, got = [];
  for (const gap of [10, 14, 21]) {
    const c = E.clone(cfg); c.gap = gap; c.ledH = 0; c.apInset = 0; c.keep.on = false; c.shape.sx = 3; c.shape.sy = 3;   // h = gap, as in the prediction
    const pts = []; for (let row = -14, y; row <= 14; row++) { y = row * pitch * Math.sqrt(3) / 2; for (let x = -220 + (row & 1 ? pitch / 2 : 0); x <= 220; x += pitch) pts.push({ x, y: y + 20 }); }
    const g = E.buildGeo(c, 1.0), inside = pts.filter(p => E.pointInPoly(g.poly, p.x, p.y)), F = E.Field(g, c); F.setAll(inside);
    let n = 0, s1 = 0, s2 = 0; for (let k = 0; k < g.nD; k++) { if (Math.abs(g.dx[k]) > 30 || Math.abs(g.dy[k] - 20) > 30) continue; n++; s1 += F.E[k]; s2 += F.E[k] ** 2; }
    const mu = s1 / n; got.push(Math.sqrt(Math.max(0, s2 / n - mu * mu)) / mu * 100);
  }
  check('4. Hotspot ripple between LEDs matches the infinite-array (Fourier) prediction', 'Yang et al. 2009, Eq. 12 (ripple = LED spectrum sampled at the grid frequencies)',
    'RMS ripple ≈ 2.37% (10 mm), 0.27% (14 mm); at 21 mm the ripple (0.01%) is below the test array\'s own finite-size shape, so < 0.2%', got.map(v => f(v, 2) + '%').join(', '),
    Math.abs(got[0] - pred[10]) < 0.15 && Math.abs(got[1] - pred[14]) < 0.05 && got[2] < 0.2);
}

// 5. Ben's heat calc reproduced exactly (Q = 10 W, A = 0.012 m², gap 21 mm, PC 1 mm)
{
  const c = E.clone(cfg); c.gap = 21;
  const w = E.thermal(c, 12000, [], { Q: 10, benTemps: true, thermalCase: 'worst' }), b = E.thermal(c, 12000, [], { Q: 10, benTemps: true, thermalCase: 'best' });
  check("5. Thermal network reproduces Ben's hand calculation", "Ben Tran-Pugh, Notion 'LED array heat calcs'",
    'worst case 247 °C, best case 139.3 °C (R: 11 + 0.42 + 10.77, 8.3 + 0.42 + 2.71 K/W)',
    `${f(w.Tboard, 1)} °C (${f(w.Rint)} + ${f(w.Rpc)} + ${f(w.Rext)}), ${f(b.Tboard, 1)} °C (${f(b.Rint)} + ${f(b.Rpc)} + ${f(b.Rext)})`,
    Math.abs(w.Tboard - 247) < 0.6 && Math.abs(b.Tboard - 139.3) < 0.3);
}

// 6. LED chip temperature and efficacy drop (Hui & Qin 2009 Eqs. 2, 3, 5a)
{
  const pts = E.hex(cfg, placer, 60), th = E.thermal(cfg, E.buildGeo(cfg, 2).area, pts, {}), Pd = E.led(cfg, 25).Pel;
  const tj = th.Tboard + cfg.rjs * cfg.kh * Pd, q = cfg.kh * Pd * 60, eff = E.led(cfg, 125).flux / E.led(cfg, 25).flux;
  check('6. Heat and LED temperature follow Hui & Qin', 'Hui & Qin 2009, Eqs. 2, 3, 5a',
    `Q = k_h·N·P_d = ${f(q, 3)} W; T_j = T_board + R_j-s·k_h·P_d = ${f(tj, 2)} °C; flux at 125 °C = 1 − (1 − 33.7/36.2)/60·100 = ${f(1 - (1 - 33.7 / 36.2) / 60 * 100, 4)} (Pro9 p.5 85 °C column)`,
    `Q = ${f(th.Q, 3)} W; T_j = ${f(th.TjMax, 2)} °C; flux ratio ${f(eff, 3)}`,
    Math.abs(th.Q - q) < 1e-9 && Math.abs(th.TjMax - tj) < 1e-9 && Math.abs(eff - (1 - (1 - 33.7 / 36.2) / 60 * 100)) < 1e-9);
}

// 7. Driver numbers from the schematic
{
  const d = E.drive(cfg, 60);
  check('7. Driver limits from the Head schematic', 'Head_Board.pdf: R82 = 820 Ω on TLC59711 IREF; LMR51420 FB 100k/4.7k',
    'max 41 × 1.21 V / 820 Ω = 60.5 mA; 12 strings × 5; headroom 13.37 − 5 × 2.70 = −0.13 V',
    `${f(d.tlcMax, 1)} mA; ${d.strings} strings; ${f(d.headroom, 2)} V`, Math.abs(d.tlcMax - 60.5) < 0.05 && d.strings === 12 && Math.abs(d.headroom + 0.13) < 1e-9);
}

// 8. Randomize: reproducible and always legal (Bridson 2007 Poisson-disk)
{
  const a = E.poisson(cfg, placer, 60, 123), b = E.poisson(cfg, placer, 60, 123), c = E.poisson(cfg, placer, 60, 124);
  const same = a.every((p, i) => p.x === b[i].x && p.y === b[i].y), diff = a.some((p, i) => p.x !== c[i].x);
  const legal = a.every((p, i) => placer.okRegion(p.x, p.y) && placer.okPitch(a, i, p.x, p.y));
  check('8. Randomize is reproducible by seed and never breaks a limit', 'Bridson 2007',
    'same seed → same layout; new seed → new layout; 60 LEDs, all legal', `same: ${same}, different: ${diff}, count ${a.length}, legal: ${legal}`, same && diff && legal && a.length === 60);
}

// 9. Even out: Lloyd/CVT makes the area each LED "owns" more equal (Du, Faber & Gunzburger 1999)
{
  const start = E.uniformRandom(cfg, placer, 60, 5), relaxed = E.cvt(cfg, placer, start, 30);
  // Lloyd equalises the area each LED owns within the region where LEDs may be placed, so measure it there
  const cellCV = pts => { const g = E.buildGeo(cfg, 1), cnt = new Array(pts.length).fill(0); for (let k = 0; k < g.nD; k++) { if (!placer.okRegion(g.dx[k], g.dy[k])) continue; let bi = 0, bd = Infinity; pts.forEach((p, i) => { const d = (p.x - g.dx[k]) ** 2 + (p.y - g.dy[k]) ** 2; if (d < bd) { bd = d; bi = i; } }); cnt[bi]++; } const m = cnt.reduce((a, b) => a + b) / cnt.length; return Math.sqrt(cnt.reduce((a, b) => a + (b - m) ** 2, 0) / cnt.length) / m; };
  const a = cellCV(start), b = cellCV(relaxed);
  check('9. Even out equalises the area per LED', 'Du, Faber & Gunzburger 1999 (Lloyd iteration)',
    'spread of per-LED area drops a lot', `${f(a * 100, 0)}% → ${f(b * 100, 0)}%`, b < a * 0.5);
}

// 10. Optimizer: improves the score, keeps every constraint, repeatable by seed (Su 2012 annealing + Lei 2014 local search)
{
  const g = E.buildGeo(cfg, 1.5), F = E.Field(g, cfg), H = E.hex(cfg, placer, 60); F.setAll(H); const m0 = E.metrics(g, F.E, 60);
  const r1 = E.optimize(cfg, H, { iters: 4000, seed: 3 }), r2 = E.optimize(cfg, H, { iters: 4000, seed: 3 });
  F.setAll(r1.pts); const m1 = E.metrics(g, F.E, 60);
  const legal = r1.pts.every((p, i) => placer.okRegion(p.x, p.y) && placer.okPitch(r1.pts, i, p.x, p.y));
  const same = r1.pts.every((p, i) => p.x === r2.pts[i].x && p.y === r2.pts[i].y);
  check('10. Optimize improves evenness and variation without breaking limits', 'Su, Xue & Ji 2012; Lei, Wang & Zou 2014',
    'evenness ↑, variation ↓, no LED outside limits, same seed → same answer',
    `evenness ${f(m0.minAvg * 100, 0)}% → ${f(m1.minAvg * 100, 0)}%, variation ${f(m0.cv * 100, 1)}% → ${f(m1.cv * 100, 1)}%, legal ${legal}, repeatable ${same}`,
    m1.minAvg > m0.minAvg && m1.cv < m0.cv && legal && same);
}

// 11. Dimming is linear and auto-balance helps (Moreno 2006 centre-LED weighting; Yang 2009 edge levels)
{
  const g = E.buildGeo(cfg, 1.5), F = E.Field(g, cfg), pts = E.optimize(cfg, E.hex(cfg, placer, 60), { iters: 2000, seed: 1 }).pts;
  const s = E.assignStrings(pts, 5, g.areaD, 'zones', placer.sdfAt); F.setAll(pts);
  const total = F.E.reduce((a, b) => a + b, 0); F.setWeights(pts.map((_, i) => (s[i] === 0 ? 0.5 : 1)));
  const one = new Float32Array(g.nD), str0 = pts.filter((_, i) => s[i] === 0).reduce((acc, p) => { E.ledContrib(g, cfg, p.x, p.y, one); return acc + one.reduce((a, b) => a + b, 0); }, 0);
  const halved = F.E.reduce((a, b) => a + b, 0); F.setWeights(pts.map(() => 1));
  const r = E.balanceStrings(g, cfg, F, s, 12, { minDuty: 0.3 });
  check('11. String dimming is linear; auto-balance raises evenness', 'Moreno 2006 §3.C (dimmed centre LED); Yang 2009 §III',
    'halving string 1 removes exactly half its light; evenness after ≥ before', `light change ${f((total - halved) / (str0 / 2) * 100, 3)}% of expected; evenness ${f(r.before.minAvg * 100, 0)}% → ${f(r.after.minAvg * 100, 0)}% (light kept ${f(r.after.kept * 100, 0)}%)`,
    Math.abs((total - halved) / (str0 / 2) - 1) < 1e-6 && r.after.minAvg >= r.before.minAvg);
}

// 12. Camera lens keepout respected, and its area produces no light
{
  const pts = E.optimize(cfg, E.poisson(cfg, placer, 60, 2), { iters: 2000, seed: 2 }).pts, K = cfg.keep, g = E.buildGeo(cfg, 1.5), out = new Float32Array(g.nD);
  const minD = Math.min(...pts.map(p => Math.hypot(p.x - K.x, p.y - K.y)));
  E.ledContrib(g, cfg, pts[0].x, pts[0].y, out); let lit = 0; for (let k = 0; k < g.nD; k++) if (g.camMask[k] && out[k] > 0) lit++;
  const zoneD = K.zone === 'dxf' ? Math.min(...pts.map(p => E.zoneDist(K, p.x, p.y))) - K.boxMargin : K.zone === 'module' ? Math.min(...pts.map(p => E.modDist(K, p.x, p.y))) - K.margin : Infinity;
  check(`12. Camera keepout (${K.zone}): no LED body inside it, no light on the lens`, 'Original keepout from WT - Lewis.dxf (zone); lens and hole from the Head STEP',
    `LED centres ≥ ${f(K.r + K.margin + E.PKG_R, 2)} mm from the lens centre and ≥ ${f(E.PKG_R, 2)} mm (body half-diagonal) beyond the zone's clearance line; 0 lit lens cells`,
    `closest to lens ${f(minD, 2)} mm; closest to zone ${f(zoneD, 2)} mm; ${lit} lit lens cells`, minD >= K.r + K.margin + E.PKG_R - 1e-6 && zoneD >= E.PKG_R - 1e-6 && lit === 0);
}

// 13. Spacing export: every listed neighbour pair respects the minimum spacing and matches the coordinates
{
  const pts = E.hex(cfg, placer, 60), nb = E.neighbours(pts);
  const ok = nb.pairs.every(q => q.d >= cfg.minPitch - 1e-9 && Math.abs(q.d - Math.hypot(pts[q.a].x - pts[q.b].x, pts[q.a].y - pts[q.b].y)) < 1e-9);
  check('13. LED spacing table is consistent', 'Geometry (for building Baseline/A/B)', `all pairs ≥ ${cfg.minPitch} mm, distances match positions`, `${nb.pairs.length} pairs, min ${f(Math.min(...nb.pairs.map(q => q.d)), 1)} mm, consistent ${ok}`, ok);
}

// 14. Desk light: Ben's worked number. 251 lm from a small source gives 500 lx straight below at 40 cm (E = flux / (pi h^2)).
{
  const c = E.clone(cfg); c.keep.on = false; c.tau = 1; const g = E.buildGeo(c, 1.5), Eu = new Float64Array(g.nD);
  for (let k = 0; k < g.nD; k++) Eu[k] = 1 / (g.nD * g.res * g.res); // uniform diffuser carrying exactly 251 lm in total
  const t = E.taskLight(g, Eu, 251, c), point = 251 / (Math.PI * 400 * 400) * 1e6;
  check("14. Desk light reproduces Ben's worked example", "Ben's Notion 'LED research doc + sim' (flux = E pi h^2 -> 251 lm for 500 lx at 40 cm)",
    `about ${f(point, 0)} lx straight below for a point source; a few % less for our 14 cm-wide diffuser`, `${f(t.centre, 1)} lx at the centre`,
    t.centre < point && t.centre > point * 0.95);
}

// 15. Desk limit: with joint dimming the optimizer would otherwise dim below 500 lx; with the limit it must stay >= 500 lx
{
  const H = E.hex(cfg, placer, 60), g = E.buildGeo(cfg, cfg.res), groups = E.assignStrings(H, 5, g.areaD, 'zones', placer.sdfAt);
  const r = E.optimize(cfg, H, { iters: 4000, seed: 3, deskLimit: true, dimming: true, groups, minDuty: 0.3, regroup: { per: 5, mode: 'zones' } });
  const F = E.Field(g, cfg); F.setAll(r.pts, r.groups.map(q => r.duty[q]));
  const th = E.thermalMap(cfg, r.pts, { weights: r.groups.map(q => r.duty[q]) }), d = E.taskLight(g, F.E, E.led(cfg, th.TjMax).flux, cfg);   // derated as the optimizer does
  check('15. Desk-light limit holds through optimization and dimming', "Ben's Notion target: >= 500 lx over a 40 cm circle at 40 cm",
    'desk minimum >= 500 lx after Optimize with joint dimming', `${f(d.min, 0)} lx (optimizer reported ${f(r.deskMin, 0)} lx, met: ${r.deskOk})`, d.min >= 500 - 0.5 && r.deskOk);
}

// 16. Colour temperature: at 65 mA the model must give the datasheet's typical flux at 25 C and at 85 C, for each CCT
{
  const DS = { 3000: [36.2, 33.7], 4000: [38.0, 35.4], 5000: [38.0, 35.4] }, c = E.clone(cfg); c.current = 65;
  const got = [], ok = Object.entries(DS).every(([k, [a, b]]) => { c.cct = +k; const x = E.led(c, 25).flux, y = E.led(c, 85).flux; got.push(`${k} K: ${f(x, 1)} / ${f(y, 1)}`); return Math.abs(x - a) < 0.01 && Math.abs(y - b) < 0.01; });
  c.cct = 3000; c.fluxCase = 'tol'; const tol = E.led(c, 25).flux;
  check('16. Colour temperature flux matches the datasheet', 'Cree JB2835B F-class Pro9 datasheet p.5 (90 CRI, 65 mA, Tj 25 / 85 C); +/-7 % flux tolerance',
    '3000 K 36.2/33.7, 4000 K 38.0/35.4, 5000 K 38.0/35.4 lm; worst case 3000 K = 33.7 lm', `${got.join(' · ')} · worst case ${f(tol, 1)} lm`, ok && Math.abs(tol - 36.2 * 0.93) < 0.01);
}

// 17. Lowest-current sweep: the current it returns meets both targets and 0.5 mA less does not
{
  const pts = E.optimize(cfg, E.hex(cfg, placer, 60), { iters: 3000, seed: 5 }).pts, g = E.buildGeo(cfg, cfg.res), F = E.Field(g, cfg); F.setAll(pts);
  const m = E.metrics(g, F.E, 60), d1 = E.taskLight(g, F.E, 1, cfg).min;
  const s = E.sweepCurrent(cfg, g.area, pts, { lmPerFlux: 60 * m.util * cfg.tau, luxPerFlux: d1 }), b = s.best, prev = b && s.rows.find(q => Math.abs(q.I - (b.I - 0.5)) < 1e-9);
  check('17. Lowest-current search finds the threshold', "Old program's optimizeCurrent (lowest power meeting all constraints); targets 300 lm and 500 lx",
    'returned current meets 300 lm and 500 lx; 0.5 mA lower misses one of them', b ? `${f(b.I, 1)} mA → ${f(b.lm, 0)} lm, ${f(b.lux, 0)} lx; at ${f(b.I - 0.5, 1)} mA: ${f(prev.lm, 0)} lm, ${f(prev.lux, 0)} lx` : 'none found',
    !!b && b.lm >= 300 && b.lux >= 500 && (!prev || !prev.ok));
}

// 18. Constraint checklist flags datasheet limits: 70 mA exceeds the TLC59711 limit, 115 C room exceeds the LED rating
{
  const c = E.clone(cfg); c.current = 70; c.ambient = 115;
  const L = E.checklist(c, { lm: 400, deskMin: 600, evenness: 0.8, Tboard: 150, TjMax: 151, TdOut: 140, P: 3, bad: 0, drv: E.drive(c, 60) });
  const bad = L.filter(q => !q.ok).map(q => q.k);
  const want = ['Driver current', 'Ambient rating', 'LED junction', 'Board temperature', 'Diffuser outside (touch)', 'Supply headroom'];
  check('18. Constraint checklist catches limit breaks', 'Pro9 datasheet p.4 (Tj 125 C, -40..105 C); TLC59711 60.5 mA (R82); brief 40 C goal',
    want.join(', '), bad.join(', '), want.every(k => bad.includes(k)) && !bad.includes('Light out'));
}

// 19. Room light: it adds to every desk point (EN 12464-1's 500 lx is the total on the task), and the lowest-current
//     search then needs less current. 0 lx = dark room (default).
{
  const pts = E.hex(cfg, placer, 60), g = E.buildGeo(cfg, cfg.res), F = E.Field(g, cfg); F.setAll(pts);
  const m = E.metrics(g, F.E, 60), c0 = E.clone(cfg), c3 = E.clone(cfg); c3.roomLux = 300;
  const d0 = E.taskLight(g, F.E, 10, c0), d3 = E.taskLight(g, F.E, 10, c3), lpf = E.taskLight(g, F.E, 1, c0).min;
  const s0 = E.sweepCurrent(c0, g.area, pts, { lmPerFlux: 60 * m.util * cfg.tau, luxPerFlux: lpf }), s3 = E.sweepCurrent(c3, g.area, pts, { lmPerFlux: 60 * m.util * cfg.tau, luxPerFlux: lpf });
  check('19. Room light adds to the desk and lowers the current needed', 'Illuminances add (superposition); EN 12464-1 target is total task illuminance',
    'desk min/avg rise by exactly 300 lx; lowest current with 300 lx room light < dark-room value',
    `min ${f(d0.min, 0)} → ${f(d3.min, 0)}, avg ${f(d0.avg, 0)} → ${f(d3.avg, 0)} lx; lowest current ${s0.best ? f(s0.best.I, 1) : '-'} → ${s3.best ? f(s3.best.I, 1) : '-'} mA (light-out target still applies)`,
    Math.abs(d3.min - d0.min - 300) < 1e-6 && Math.abs(d3.avg - d0.avg - 300) < 1e-6 && s3.best && s0.best && s3.best.I <= s0.best.I);
}

// 20. Full heat map reduces to Ben's network: with the back path off, no electronics and a near-perfect board conductor
//     the map must give Ben's single board temperature (his network is the map's front path)
{
  const pts = E.hex(cfg, placer, 60), k = E.clone(cfg); k.elecW = 0; k.pcb.kBase = 1e5;
  const ben = E.thermal(k, E.polyArea(E.outline(k)), pts, {}), M = E.thermalMap(k, pts, { noBack: true });
  check("20. Heat map reduces to Ben's network", "Ben's Notion 'LED array heat calcs' network (front path); Fourier conduction in the board",
    `board ${f(ben.Tboard, 2)} °C (Ben), flat to 0.01 °C`, `${f(M.Tmax, 2)} / ${f(M.Tmin, 2)} °C`, Math.abs(M.Tmax - ben.Tboard) < 0.01 && M.Tmax - M.Tmin < 0.01);
}

// 21. Heat map conserves energy and its grid has converged: heat out (front + back + bosses) = heat in (LEDs + electronics);
//     2.5 mm and 1.5 mm grids agree
{
  const pts = E.hex(cfg, placer, 60), M = E.thermalMap(cfg, pts), c2 = E.clone(cfg); c2.mapRes = 1.5; const M2 = E.thermalMap(c2, pts);
  const out = M.Q.front + M.Q.back + M.Q.mounts;
  check('21. Heat map conserves energy; grid converged', 'Energy conservation; grid refinement',
    `out = in = ${f(M.Q.total, 3)} W (LEDs ${f(M.Q.led, 2)} + electronics ${f(M.Q.elec, 2)}); hottest point within 0.5 °C on a finer grid`,
    `out ${f(out, 3)} W (front ${f(M.Q.front, 2)}, back ${f(M.Q.back, 2)}, bosses ${f(M.Q.mounts, 2)}); ${f(M.Tmax, 2)} vs ${f(M2.Tmax, 2)} °C`,
    Math.abs(out - M.Q.total) < 1e-3 * M.Q.total && Math.abs(M.Tmax - M2.Tmax) < 0.5);
}

// 22. Light budget accounts for every lumen: the shares add to 100 % and the diffuser share equals the field's own total
{
  const pts = E.hex(cfg, placer, 60), g = E.buildGeo(cfg, cfg.res), F = E.Field(g, cfg); F.setAll(pts);
  const m = E.metrics(g, F.E, 60), B = E.lightBudget(cfg, g, pts), sum = B.diffuser + B.annulus + B.camera + B.walls;
  check('22. Light budget accounts for every lumen', 'Energy conservation; STEP geometry (aperture, camera ring)',
    'shares sum to 100 %; diffuser share = light landing on the aperture in the field model',
    `diffuser ${f(B.diffuser * 100, 2)}% (field ${f(m.util * 100, 2)}%), walls ${f(B.walls * 100, 2)}%, camera ${f(B.camera * 100, 2)}%, ring ${f(B.annulus * 100, 3)}% → ${f(sum * 100, 3)}%`,
    Math.abs(sum - 1) < 1e-9 && Math.abs(B.diffuser - m.util) < 1e-6 && B.annulus > 0);
}

// 23. Warm-up model settles on the steady heat map (same conductances, so the end value must match), and the time
//     constants are positive and ordered
{
  const pts = E.hex(cfg, placer, 60), M = E.thermalMap(cfg, pts), w = E.warmUp(cfg, M, { tEnd: 6 * 3600 }), end = w.board[w.board.length - 1];
  check('23. Warm-up settles on the steady heat map', 'Lumped RC model with the heat map\'s conductances (energy balance at steady state)',
    `board average → ${f(M.Tavg, 1)} °C; 63 % time < 95 % time`, `${f(end, 1)} °C after 6 h; t63 ${f(w.t63 / 60, 1)} min, t95 ${f(w.t95 / 60, 1)} min`,
    Math.abs(end - M.Tavg) < 1.0 && w.t63 > 0 && w.t95 > w.t63);
}

// 24. What-ifs move the right way: removing heat or adding a better heat path never makes the board hotter;
//     the boss path with PLA bosses is limited by spreading in the PLA shell (aluminium standoffs alone help little)
{
  const pts = E.hex(cfg, placer, 60), base = E.thermalMap(cfg, pts).Tmax, r = {};
  for (const w of E.WHATIFS) r[w.key] = E.whatIf(cfg, pts, w.key).Tmax;
  const ok = ['paint', 'standoffs', 'pcShell', 'alShell', 'typical', 'noElec', 'combo'].every(k => r[k] <= base + 0.05) && r.noElec < r.typical && r.combo < r.paint && base - r.standoffs < 5;
  check('24. Passive-cooling what-ifs behave physically', 'Monotonic heat paths; radial spreading in a thin wall ln(R/r)/(2πkt)',
    'every option ≤ base; no electronics < typical; combination < paint alone; standoffs alone < 5 °C gain', Object.entries(r).map(([k, v]) => `${k} ${f(v, 0)}`).join(', ') + ` (base ${f(base, 0)} °C)`, ok);
}

// 25. The current sweep's bisection gives the same answer as evaluating every 0.5 mA step with the full heat map
{
  const pts = E.hex(cfg, placer, 60), g = E.buildGeo(cfg, cfg.res), F = E.Field(g, cfg); F.setAll(pts);
  const m = E.metrics(g, F.E, 60), o = { lmPerFlux: 60 * m.util * cfg.tau, luxPerFlux: E.taskLight(g, F.E, 1, cfg).min };
  const a = E.sweepCurrent(cfg, g.area, pts, o), b = E.sweepCurrent(cfg, g.area, pts, { ...o, full: true });
  const mono = b.rows.every((q, i) => !i || (q.lm >= b.rows[i - 1].lm && q.lux >= b.rows[i - 1].lux));
  check('25. Current sweep: bisection = full scan (heat-map derating)', 'Light rises monotonically with current, so bisection is exact on the 0.5 mA grid',
    'same lowest current; light and desk rise with every step', `bisection ${a.best ? f(a.best.I, 1) : 'none'} mA (${a.rows.length} maps), full ${b.best ? f(b.best.I, 1) : 'none'} mA (${b.rows.length} maps); monotonic ${mono}`,
    mono && (a.best ? a.best.I : -1) === (b.best ? b.best.I : -1));
}

console.log(`${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
