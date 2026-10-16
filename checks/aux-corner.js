// Secondary light for the dark keepout corner: does it lift whole-face evenness, and how much light does it need?
// CAD geometry, original DXF keepout, 60 LEDs at 25 mA (worst-case heat), whole-face scoring. For each source type the
// total light is swept; "hex" keeps the hex grid, "opt" re-optimizes the 60 LEDs around the fixed secondary light.
// Source values are EXAMPLES (lm, beam, distance, efficiency), not a chosen part. Light pipes and the guide are fed
// with 2x the lm so their OUTPUT matches the other rows at efficiency 0.5. Usage: node checks/aux-corner.js   (~3 min)
'use strict';
const path = require('path');
const E = require(path.join(__dirname, '..', 'engine.js'))();
const base = E.defaults(), pl = E.buildPlacer(base), H = E.hex(base, pl, 60);
const pct = v => (v * 100).toFixed(0).padStart(3) + '%';
function run(label, aux, optimize) {
  const c = E.clone(base); c.aux = { ...c.aux, ...aux };
  const g = E.buildGeo(c, c.res), F = E.Field(g, c);
  const pts = optimize ? E.optimize(c, H, { iters: 8000, seed: 11, deskLimit: true }).pts : H;
  const M = E.thermalMap(c, pts), L = E.led(c, M.TjMax);
  if (E.auxOn(c)) F.setBase(E.auxBase(g, c, L.flux));
  F.setAll(pts);
  const m = E.metrics(g, F.E, 60), d = E.taskLight(g, F.E, L.flux, c), f = E.auxOn(c) ? E.auxField(g, c) : null;
  console.log(`${label.padEnd(58)} ${optimize ? 'opt' : 'hex'} | whole face ${pct(m.minAvg)}  outside corner ${pct(m.minAvgOut)}  CV ${(m.cv * 100).toFixed(1).padStart(4)}% | light out ${(60 * L.flux * m.util * c.tau).toFixed(0)} lm (aux ${f ? (f.onDiffuserLm * c.tau).toFixed(0) : 0}) | desk min ${d.min.toFixed(0)} lx | board ${M.Tmax.toFixed(0)} °C`);
}
for (const opt of [false, true]) {
  run('none', { type: 'none' }, opt);
  for (const tot of [30, 60, 120]) {
    run(`raised top-emitters: 4 × ${tot / 4} lm, 120°, 6 mm below`, { type: 'top', n: 4, lm: tot / 4, w: 0.1, fwhm: 120, dist: 6 }, opt);
    run(`raised top-emitters: 4 × ${tot / 4} lm, 120°, 12 mm below`, { type: 'top', n: 4, lm: tot / 4, w: 0.1, fwhm: 120, dist: 12 }, opt);
    run(`side-emitters at the edge: 6 × ${tot / 6} lm, 120°, tilt 30°`, { type: 'side', n: 6, lm: tot / 6, w: 0.1, fwhm: 120, h: 0.8, tilt: 30 }, opt);
    run(`light guide: 4 × ${tot / 2} lm in, eff 0.5, 3 mm below`, { type: 'guide', n: 4, lm: tot / 2, w: 0.1, eff: 0.5, dist: 3 }, opt);
    run(`light pipes from behind: 4 × ${tot / 2} lm LEDs, eff 0.5, exit 120°, 12 mm below`, { type: 'pipe', n: 4, lm: tot / 2, w: 0.1, eff: 0.5, fwhm: 120, dist: 12 }, opt);
  }
  console.log('');
}
