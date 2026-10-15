// Export the bench layouts (20 LEDs, 4 strings of 5, 22 mm minimum pitch) as build files in code/reports/:
// <name>-led-coordinates.csv (mm from the dome centre, string, nearest-neighbour spacing) and <name>-layout.dxf.
// Baseline and Variation A share the hex layout. Usage: node checks/export-bench-layouts.js
'use strict';
const fs = require('fs'), path = require('path');
const E = require(path.join(__dirname, '..', 'engine.js'))();
const c = E.defaults(); c.gap = 21; c.cct = 3000; c.current = 55; c.count = 20; c.minPitch = 22;
const pl = E.buildPlacer(c), g = E.buildGeo(c, c.res), out = path.join(__dirname, '..', 'reports');
fs.mkdirSync(out, { recursive: true });
const layouts = { 'bench-baseline-and-A-hex-20': E.hex(c, pl, 20), 'bench-B-optimized-20': require('./best-layout-20.json').leds };
for (const [name, pts] of Object.entries(layouts)) {
  if (pts.length !== 20) throw new Error(`${name}: ${pts.length} LEDs`);
  const s = E.assignStrings(pts, 5, g.areaD, c.stringMode, pl.sdfAt), nb = E.neighbours(pts);
  let csv = 'led,string,x_mm,y_mm,nearest_neighbour_mm\n';
  pts.forEach((p, i) => { csv += [i + 1, s[i] + 1, p.x.toFixed(2), p.y.toFixed(2), nb.near[i].toFixed(2)].join(',') + '\n'; });
  fs.writeFileSync(path.join(out, `${name}-led-coordinates.csv`), csv);
  fs.writeFileSync(path.join(out, `${name}-layout.dxf`), E.dxfExport(c, pts, s, true));
  const sizes = {}; s.forEach(q => { sizes[q] = (sizes[q] || 0) + 1; });
  console.log(`${name}: ${pts.length} LEDs, ${Object.keys(sizes).length} strings (${Object.values(sizes).join('/')}), spacing ${Math.min(...nb.near).toFixed(1)}–${Math.max(...nb.near).toFixed(1)} mm, placement ok: ${pts.every(p => pl.okRegion(p.x, p.y))}`);
}
