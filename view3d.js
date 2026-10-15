// 3D view of the Head: LED board, LEDs, walls, camera barrel, diffuser and the desk below. Shows 1-4 designs side by
// side with one synced camera and ONE shared colour/height scale, so designs can be compared directly.
// Every brightness drawn comes from the model (engine.js): diffuser = computed diffuser irradiance, desk = computed desk
// illuminance. Three.js lights only make the unlit parts (board, walls) visible. Display-only assumptions: desk
// reflectance 0.5 (Real look), approximate blackbody RGB for the LED colour.
'use strict';
function HeadView3D(host, E) {
  const THREE = window.THREE;
  const opt = { scene: 'diagram', cutY: 17, roomLook: 'real', irInside: false, board: 'leds', mode: 'spots', range: 25, relief: 1, ev: 0, expose: 'diffuser', beams: false, walls: 'glass', explode: 0, rho: 0.5, fill: 0.3 };
  const roomOf = d => d.cfg.roomLux || 0; // room light on the desk (model input, step 1)
  let designs = [], panels = [], placed = false, autoCam = null, lastRoomMode = false; // autoCam: preset to re-fit on resize until the user moves the camera
  const orb = { th: 0.75, ph: 2.1, r: 340, tgt: new THREE.Vector3() };

  // ---------------------------------------------------------------- helpers
  // model (x, y, height h) -> three (x, h, y). Model frame (STEP): x right and y up as seen looking AT the lit face,
  // z toward the diffuser; three y = -z (the light goes down). Proper rotation (det +1), so not a mirror image.
  const P = (x, y, h) => new THREE.Vector3(x, h, y);
  function cctRGB(K) { // Tanner Helland blackbody approximation (display only)
    const t = K / 100; let r, g, b;
    r = t <= 66 ? 255 : 329.7 * Math.pow(t - 60, -0.1332);
    g = t <= 66 ? 99.47 * Math.log(t) - 161.12 : 288.12 * Math.pow(t - 60, -0.0755);
    b = t >= 66 ? 255 : t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04;
    const c = v => Math.max(0, Math.min(255, v)) / 255; return [c(r), c(g), c(b)];
  }
  const ramp = st => { const out = new Float32Array(256 * 3); for (let i = 0; i < 256; i++) { const t = i / 255; let k = 0; while (k < st.length - 2 && t > st[k + 1][0]) k++; const [t0, c0] = st[k], [t1, c1] = st[k + 1], f = (t - t0) / (t1 - t0); for (let c = 0; c < 3; c++) out[i * 3 + c] = (c0[c] + (c1[c] - c0[c]) * f) / 255; } return out; };
  const SEQ = ramp([[0, [0, 0, 4]], [0.2, [40, 11, 84]], [0.4, [101, 21, 110]], [0.6, [188, 55, 84]], [0.8, [249, 142, 9]], [1, [252, 255, 164]]]);
  const DIV = ramp([[0, [5, 48, 97]], [0.25, [67, 147, 195]], [0.5, [247, 247, 247]], [0.75, [214, 96, 77]], [1, [103, 0, 31]]]); // dark spots blue, hotspots red
  const lut = (L, t) => { const i = Math.max(0, Math.min(255, Math.round(t * 255))) * 3; return [L[i], L[i + 1], L[i + 2]]; };
  const srgb = v => v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  const tone = (Y, k) => { const x = Y * k; return x / (1 + x); };
  function shapeFromPoly(poly) { const s = new THREE.Shape(); poly.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); s.closePath(); return s; }

  // ---------------------------------------------------------------- CAD meshes from the Head STEP (binary STL, mm, model frame)
  const CAD_PARTS = { Head_Front: 0x751b00, Head_Back: 0x751b00, Camera: 0x43484d, Neck: 0x751b00, DM_J3507_Mounting_Plate: 0xeaeaea, DM_J3507_motor_ASSUMED_PLACEMENT: 0x2b2e33, Mic_Array: 0x43484d };
  const CAD_GAP = 17.9;   // the meshes are only valid at the CAD gap
  const cad = { geoms: {}, loading: null, failed: false };
  function parseStl(buf) {
    const dv = new DataView(buf), n = dv.getUint32(80, true), pos = new Float32Array(n * 9);
    for (let t = 0; t < n; t++) { const o = 84 + t * 50 + 12; for (let v = 0; v < 3; v++) { const x = dv.getFloat32(o + v * 12, true), y = dv.getFloat32(o + v * 12 + 4, true), z = dv.getFloat32(o + v * 12 + 8, true); pos.set([x, -z, y], t * 9 + v * 3); } }   // (x, y, z) -> three (x, -z, y)
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
  }
  function loadCad() {
    if (cad.loading) return cad.loading;
    cad.loading = Promise.all(Object.keys(CAD_PARTS).map(nm => fetch(`assets/cad/${nm}.stl`).then(r => { if (!r.ok) throw new Error(nm); return r.arrayBuffer(); }).then(b => { cad.geoms[nm] = parseStl(b); })))
      .then(() => { if (designs.length) build(); }).catch(() => { cad.failed = true; });
    return cad.loading;
  }
  const cadReady = cfg => !cad.failed && Object.keys(cad.geoms).length === Object.keys(CAD_PARTS).length && Math.abs(cfg.gap - CAD_GAP) < 0.05;
  function cadMesh(nm, m) { const o = new THREE.Mesh(cad.geoms[nm], m); o.castShadow = true; o.receiveShadow = true; return o; }

  // ---------------------------------------------------------------- per-design numbers (cached on the design object)
  function prep(d) {
    if (d._p) return d._p;
    const { cfg, geo } = d, k = d.flux * cfg.tau * 1e6 / Math.PI;               // irradiance per lm -> exit luminance cd/m2
    let s = 0, n = 0; for (let c = 0; c < geo.nD; c++) if (!geo.camMask[c] && geo.dEval[c]) { s += d.E[c]; n++; }
    const half = Math.max(cfg.taskD * 0.9, cfg.taskZ * 0.9), nd = 80, dm = E.deskMap(geo, d.E, d.flux, cfg, half, nd);
    let ds = 0, dc = 0; const R2 = (cfg.taskD / 2) ** 2;
    for (let j = 0; j < nd; j++) for (let i = 0; i < nd; i++) { const u = ((i + 0.5) / nd - 0.5) * 2 * half, v = ((j + 0.5) / nd - 0.5) * 2 * half; if (u * u + v * v <= R2) { ds += dm.lux[j * nd + i]; dc++; } }
    d._p = { k, meanE: s / n, meanL: s / n * k, half, nd, dm, deskAvg: ds / dc };
    return d._p;
  }
  // one scale for all panels, so equal colours / heights mean equal values in every design
  function sharedScale() {
    const ps = designs.map(prep);
    let Lmax = 0, Dmax = 0;
    designs.forEach((d, i) => { const p = ps[i]; for (let c = 0; c < d.geo.nD; c++) if (!d.geo.camMask[c]) Lmax = Math.max(Lmax, d.E[c] * p.k); for (const v of p.dm.lux) Dmax = Math.max(Dmax, v + roomOf(d)); });
    const ref = ps[0]; // exposure set by the first design, used for all
    const room0 = roomOf(designs[0]), deskLumRef = (ref.deskAvg + room0) * opt.rho / Math.PI;
    let Tlo = Infinity, Thi = -Infinity; for (const d of designs) if (d.map) { Tlo = Math.min(Tlo, d.map.Tmin); Thi = Math.max(Thi, d.map.Tmax); }
    return { Lmax, Dmax, Tlo, Thi, Lref: ref.meanL, Dref: ref.deskAvg + room0, kExp: Math.pow(2, opt.ev) / (opt.expose === 'desk' ? deskLumRef : ref.meanL) };
  }

  // ---------------------------------------------------------------- one panel's scene
  function buildPanel(pn, d, S) {
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b0f15);
    scene.add(new THREE.HemisphereLight(0x9fb3cc, 0x202428, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 0.35); key.position.set(300, 500, 400); scene.add(key);
    const { cfg, geo, leds } = d, p = prep(d), gap = cfg.gap, ex = opt.explode, rgb = cctRGB(E.CCT[cfg.cct] ? cfg.cct : 4000);
    const yBoard = ex * 35, yDiff = -gap - ex * 35, yDesk = -gap - cfg.taskZ, poly = geo.poly;
    const add = o => { scene.add(o); return o; };
    // board coloured by the heat map (shared °C scale over the panels)
    const heatBoard = opt.board === 'heat' && d.map;
    if (heatBoard) {
      const c = d.map.cells, h0 = c.res / 2, pos = [], col = [];
      for (let k = 0; k < c.x.length; k++) {
        const t = (c.T[k] - S.Tlo) / Math.max(0.5, S.Thi - S.Tlo), cl = lut(SEQ, t);
        for (const [ax, ay] of [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]]) { pos.push(c.x[k] + ax * h0, yBoard + 0.02, c.y[k] + ay * h0); col.push(cl[0], cl[1], cl[2]); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));
    }

    // board + LEDs (brightness = duty)
    { const g = new THREE.ShapeGeometry(shapeFromPoly(poly)); g.rotateX(Math.PI / 2); g.translate(0, yBoard + 0.01, 0); if (!heatBoard) add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x1f5a3a, roughness: 0.8, side: THREE.DoubleSide }))); }
    const ledGeo = new THREE.BoxGeometry(E.PKG_W, E.PKG_H, E.PKG_L);   // Pro9 datasheet p.23
    leds.forEach((q, i) => { const du = d.duty[i] == null ? 1 : d.duty[i]; const m = add(new THREE.Mesh(ledGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(rgb[0], rgb[1], rgb[2]).multiplyScalar(0.25 + 0.75 * du) }))); m.position.copy(P(q.x, q.y, yBoard - E.PKG_H / 2)); });
    // half-intensity beam cones, theta_1/2 = acos(0.5^(1/m)) (Moreno Eq. 2)
    if (opt.beams) {
      const th = Math.acos(Math.pow(0.5, 1 / cfg.m)), h = yBoard - cfg.ledH - yDiff, cg = new THREE.ConeGeometry(h * Math.tan(th), h, 40, 1, true); cg.translate(0, -h / 2, 0);
      const cm = new THREE.MeshBasicMaterial({ color: new THREE.Color(rgb[0], rgb[1], rgb[2]), transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      for (const q of leds) { const m = add(new THREE.Mesh(cg, cm)); m.position.copy(P(q.x, q.y, yBoard - cfg.ledH)); }
    }
    // walls (absorbing in the model): the real Head Front (STEP) at the CAD gap, else a straight band
    const useCad = cadReady(cfg) && ex === 0;
    if (opt.walls !== 'hide' && useCad) {
      add(new THREE.Mesh(cad.geoms.Head_Front, new THREE.MeshStandardMaterial({ color: 0x751b00, roughness: 0.8, side: THREE.DoubleSide, transparent: opt.walls === 'glass', opacity: opt.walls === 'glass' ? 0.22 : 1, depthWrite: opt.walls !== 'glass' })));
      add(new THREE.Mesh(cad.geoms.Camera, new THREE.MeshStandardMaterial({ color: 0x43484d, roughness: 0.5 })));
    }
    if (opt.walls !== 'hide' && !useCad) {
      const pos = [], n = poly.length;
      for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n], q = [P(a[0], a[1], yBoard), P(b[0], b[1], yBoard), P(b[0], b[1], yDiff), P(a[0], a[1], yDiff)]; for (const k of [0, 1, 2, 0, 2, 3]) pos.push(q[k].x, q[k].y, q[k].z); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
      add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 0.9, side: THREE.DoubleSide, transparent: opt.walls === 'glass', opacity: opt.walls === 'glass' ? 0.18 : 1, depthWrite: opt.walls !== 'glass' })));
      const edge = new THREE.LineBasicMaterial({ color: 0x6c7a8f });
      for (const h of [yBoard, yDiff]) add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(poly.map(([x, y]) => P(x, y, h))), edge));
    }
    // original DXF keepout zone, drawn as a dark patch on the board's LED side
    if (cfg.keep.on && cfg.keep.zone === 'dxf') {
      const z = E.zonePoly(cfg.keep, poly);
      if (z.length > 2) { const g = new THREE.ShapeGeometry(shapeFromPoly(z)); g.rotateX(Math.PI / 2); g.translate(0, yBoard - 0.05, 0); add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x20262f, roughness: 0.9, side: THREE.DoubleSide }))); }
    }
    if (cfg.keep.on && !useCad) { const K = cfg.keep, m = add(new THREE.Mesh(new THREE.CylinderGeometry(K.r, K.r, yBoard - yDiff, 32), new THREE.MeshStandardMaterial({ color: 0x15181d, roughness: 0.4 }))); m.position.copy(P(K.x, K.y, (yBoard + yDiff) / 2)); }
    for (const h of cfg.holes) { const m = add(new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 1.2, 16), new THREE.MeshStandardMaterial({ color: 0xa0a8b4, metalness: 0.6, roughness: 0.4 }))); m.position.copy(P(h.x, h.y, yBoard - 0.6)); }

    // colour + relief height for a value, shared across panels
    //   spots: % from THIS design's own average (diverging, +/- range)   abs: absolute value on the shared range
    //   real:  one camera exposure, set by the first design
    const colour = (val, mean, max, isDesk, lampPart) => {
      if (opt.mode === 'spots') return lut(DIV, 0.5 + (val / mean - 1) / (2 * opt.range / 100));
      if (opt.mode === 'abs') return lut(SEQ, val / max);
      const Y = isDesk ? val * opt.rho / Math.PI : val;
      if (isDesk) { const vl = tone(lampPart * opt.rho / Math.PI, S.kExp), vr = tone((val - lampPart) * opt.rho / Math.PI, S.kExp); return rgb.map(c => srgb(Math.min(1, vl * c + vr * 0.9))); }
      const v = tone(Y, S.kExp); return rgb.map(c => srgb(Math.min(1, v * c)));
    };
    // relief: height = (value / shared reference - 1) x scale; diffuser bumps hang toward the desk
    const relD = opt.relief * gap * 1.5, relK = opt.relief * cfg.taskZ * 0.25;

    // diffuser as a grid mesh (cell centres), lens cells left out
    {
      const nx = geo.nx, ny = geo.ny, vid = new Int32Array(nx * ny).fill(-1), pos = [], col = [], idx = [];
      for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) {
        const j = iy * nx + ix, c = geo.dIdx[j]; if (c < 0 || geo.camMask[c]) continue;
        const L = d.E[c] * p.k, h = yDiff - Math.max(-1, L / S.Lref - 1) * relD;
        vid[j] = pos.length / 3; pos.push(geo.dx[c], h, geo.dy[c]); col.push(...colour(L, p.meanL, S.Lmax, false));
      }
      for (let iy = 0; iy < ny - 1; iy++) for (let ix = 0; ix < nx - 1; ix++) {
        const a = vid[iy * nx + ix], b = vid[iy * nx + ix + 1], c = vid[(iy + 1) * nx + ix], e = vid[(iy + 1) * nx + ix + 1];
        if (a >= 0 && b >= 0 && e >= 0) idx.push(a, b, e); if (a >= 0 && e >= 0 && c >= 0) idx.push(a, e, c);
        if (a < 0 && b >= 0 && c >= 0 && e >= 0) idx.push(b, e, c); if (e < 0 && a >= 0 && b >= 0 && c >= 0) idx.push(a, b, c);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
      add(new THREE.Mesh(g, new THREE.MeshBasicMaterial(heatBoard ? { vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.12, depthWrite: false } : { vertexColors: true, side: THREE.DoubleSide })));   // Board = temperature: see-through diffuser so the board shows
    }
    // desk
    {
      const nd = p.nd, half = p.half, g = new THREE.PlaneGeometry(2 * half, 2 * half, nd - 1, nd - 1); g.rotateX(Math.PI / 2);
      const pa = g.attributes.position, col = new Float32Array(pa.count * 3), room = roomOf(d), mean = p.deskAvg + room;
      for (let v = 0; v < pa.count; v++) {
        const i = v % nd, jr = Math.floor(v / nd), j = nd - 1 - jr;      // plane rows run from -z (far, +y) to +z
        const lamp = p.dm.lux[j * nd + i], lux = lamp + room;
        pa.setY(v, Math.max(-1, lux / S.Dref - 1) * relK);
        const c = colour(lux, mean, S.Dmax, true, lamp); col[v * 3] = c[0]; col[v * 3 + 1] = c[1]; col[v * 3 + 2] = c[2];
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const m = add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }))); m.position.set(p.dm.cx, yDesk, p.dm.cy);
      // target circle (on the relief surface) and the drop line
      const ring = [], R = cfg.taskD / 2;
      for (let a = 0; a <= 72; a++) { const t = a / 72 * 2 * Math.PI, u = R * Math.cos(t), w = R * Math.sin(t), i = Math.min(nd - 1, Math.max(0, Math.round((u / (2 * half) + 0.5) * nd - 0.5))), j = Math.min(nd - 1, Math.max(0, Math.round((w / (2 * half) + 0.5) * nd - 0.5))); ring.push(P(p.dm.cx + u, p.dm.cy + w, yDesk + Math.max(-1, (p.dm.lux[j * nd + i] + room) / S.Dref - 1) * relK + 1)); }
      add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring), new THREE.LineBasicMaterial({ color: 0x22b8cf })));
      add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([P(p.dm.cx, p.dm.cy, yDiff), P(p.dm.cx, p.dm.cy, yDesk)]), new THREE.LineDashedMaterial({ color: 0x6c7a8f, dashSize: 6, gapSize: 6 }))).computeLineDistances();
    }
    pn.scene = scene;
  }


  // ---------------------------------------------------------------- realistic room: the lamp on a bedroom nightstand
  // Units stay mm. Physically-correct lights: a light's intensity is in candela, illuminance = I cos(theta) / d^2, so
  // with d in mm the candela values are multiplied by 1e6.
  // The lamp's light = ONE shadow-casting SpotLight at the diffuser centre whose intensity pattern (SpotLight.map) is
  // fitted to the model: for a ray hitting the nightstand plane (taskZ below the diffuser) at (u, v), the map gives
  // I(theta) = E_model(u, v) r^2 / cos(theta), so the nightstand top receives exactly the model's desk illuminance
  // (E.deskMap); walls, floor and props get the same intensity pattern with correct distance and angle.
  // Not modelled: light bouncing off walls and furniture (no interreflection), so shadowed areas look darker than in a
  // real room; shadows come from a point at the diffuser centre, softened by a blur to suggest the 14 cm-wide source.
  function buildRoom(pn, d, S) {
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x020203);
    const { cfg, geo } = d, p = prep(d), gap = cfg.gap, h = cfg.taskZ, rgb = cctRGB(E.CCT[cfg.cct] ? cfg.cct : 4000);
    const lampCol = new THREE.Color(rgb[0], rgb[1], rgb[2]), poly = geo.poly;
    const yDiff = -gap, yTop = -gap - h, standH = 620, yFloor = yTop - standH, cx = p.dm.cx, cy = p.dm.cy;
    // furniture is laid out with z = -(model y); this group mirrors z so it lines up with the true-frame head
    const fur = new THREE.Group(); fur.scale.z = -1; scene.add(fur);
    const add = o => { fur.add(o); return o; }, addH = o => { scene.add(o); return o; };
    const mat = (color, rough, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough == null ? 0.8 : rough }, extra || {}));
    const box = (w, hh, dd, m, x, y, z, cast = true) => { const o = add(new THREE.Mesh(new THREE.BoxGeometry(w, hh, dd), m)); o.position.set(x, y, z); o.castShadow = cast; o.receiveShadow = true; return o; };

    // --- the lamp's light, fitted to the model
    const alpha = 75 * Math.PI / 180, half = h * Math.tan(alpha), n = 256;
    const fit = E.deskMap(geo, d.E, d.flux, cfg, half, n);                 // lamp-only lux on the nightstand plane
    const I = new Float32Array(n * n); let Imax = 0;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const u = ((i + 0.5) / n - 0.5) * 2 * half, v = ((j + 0.5) / n - 0.5) * 2 * half, r = Math.hypot(u, v, h);
      const val = fit.lux[j * n + i] * (r / 1000) ** 3 / (h / 1000);        // I = E r^2 / cos(theta), r and h in metres -> cd
      I[j * n + i] = val; Imax = Math.max(Imax, val);
    }
    // the light's shadow camera looks down with up = -z, so screen right = +x and screen up = model -y: flip the rows
    const tex = new Uint8Array(n * n * 4);
    for (let t = 0; t < n; t++) for (let i = 0; i < n; i++) { const k = (n - 1 - t) * n + i, o = (t * n + i) * 4, v = Math.round(255 * I[k] / Imax); tex[o] = tex[o + 1] = tex[o + 2] = v; tex[o + 3] = 255; }
    const spotMap = new THREE.DataTexture(tex, n, n, THREE.RGBAFormat); spotMap.magFilter = THREE.LinearFilter; spotMap.needsUpdate = true;
    const spot = new THREE.SpotLight(lampCol, Imax * 1e6, 0, alpha, 0, 2);   // candela x 1e6 (mm units), decay 2
    spot.map = spotMap;
    spot.position.set(cx, yDiff - 1.2, cy); spot.target.position.set(cx, yTop, cy); addH(spot.target);
    spot.castShadow = true; spot.shadow.mapSize.set(2048, 2048); spot.shadow.camera.near = 5; spot.shadow.camera.far = 6000;
    spot.shadow.camera.up.set(0, 0, -1);
    spot.shadow.radius = 9; spot.shadow.blurSamples = 16; spot.shadow.bias = -0.0004;
    addH(spot);
    // room light (model input, lx on horizontal surfaces) + a faint fill so the room isn't pitch black
    const room = cfg.roomLux || 0;
    const hemi = addH(new THREE.HemisphereLight(0xd8e0ff, 0x3a3028, room + opt.fill)); const cadObjs = {};

    // --- room: floor, two walls, skirting
    const floor = add(new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), mat(0x6b4a32, 0.65))); floor.rotation.x = -Math.PI / 2; floor.position.y = yFloor; floor.receiveShadow = true;
    const wallM = mat(0xbfb6a8, 0.95, { side: THREE.DoubleSide });
    const back = add(new THREE.Mesh(new THREE.PlaneGeometry(5000, 2800), wallM)); back.position.set(cx, yFloor + 1400, -cy - 330); back.receiveShadow = true;
    const side = add(new THREE.Mesh(new THREE.PlaneGeometry(5000, 2800), wallM)); side.rotation.y = Math.PI / 2; side.position.set(cx - 900, yFloor + 1400, -cy); side.receiveShadow = true;
    box(5000, 80, 15, mat(0xe8e2d8, 0.6), cx, yFloor + 40, -cy - 322, false);
    // --- nightstand (oak): top centred under the lamp, drawer, legs
    const oak = mat(0x8a5a35, 0.55), oakDark = mat(0x6f4527, 0.6), W = 560, D = 440, T = 28, bx = cx, bz = -cy - 80;
    box(W, T, D, oak, bx, yTop - T / 2, bz);
    box(W - 30, standH - T - 140, D - 30, oakDark, bx, yTop - T - (standH - T - 140) / 2, bz);
    box(W - 60, 150, 8, oak, bx, yTop - T - 95, bz + (D - 30) / 2 + 4);
    const knob = add(new THREE.Mesh(new THREE.SphereGeometry(11, 20, 12), mat(0xc9a36a, 0.3, { metalness: 0.8 }))); knob.position.set(bx, yTop - T - 95, bz + (D - 30) / 2 + 16); knob.castShadow = true;
    for (const sxn of [-1, 1]) for (const szn of [-1, 1]) box(30, 140, 30, oakDark, bx + sxn * (W / 2 - 35), yFloor + 70, bz + szn * (D / 2 - 35));
    // --- bed to the right
    const bedX = bx + W / 2 + 80 + 1000;
    box(2000, 300, 2100, mat(0x4a3a30, 0.7), bedX, yFloor + 150, bz + 800);
    box(1950, 220, 2050, mat(0xf2efe8, 0.9), bedX, yFloor + 410, bz + 800);
    box(1980, 60, 1500, mat(0x5d7186, 0.95), bedX, yFloor + 545, bz + 1080);
    box(700, 140, 420, mat(0xf7f5f0, 0.95), bedX - 450, yFloor + 590, bz - 30);
    box(1990, 900, 60, mat(0x4a3a30, 0.7), bedX, yFloor + 450, bz - 280);
    // --- props on the nightstand (they cast the shadows)
    box(150, 22, 210, mat(0x7a2e2e, 0.7), bx - 170, yTop + 11, bz + 60).rotation.y = 0.25;
    box(140, 18, 200, mat(0x2f4b6e, 0.7), bx - 165, yTop + 31, bz + 55).rotation.y = 0.05;
    const mug = add(new THREE.Mesh(new THREE.CylinderGeometry(42, 38, 100, 32, 1, true), mat(0xe9e4da, 0.35, { side: THREE.DoubleSide }))); mug.position.set(bx + 150, yTop + 50, bz + 90); mug.castShadow = mug.receiveShadow = true;
    const mugBase = add(new THREE.Mesh(new THREE.CylinderGeometry(38, 38, 6, 32), mat(0xe9e4da, 0.35))); mugBase.position.set(bx + 150, yTop + 3, bz + 90); mugBase.castShadow = true;
    const handle = add(new THREE.Mesh(new THREE.TorusGeometry(26, 7, 12, 24, Math.PI), mat(0xe9e4da, 0.35))); handle.position.set(bx + 192, yTop + 52, bz + 90); handle.rotation.z = -Math.PI / 2; handle.castShadow = true;
    box(75, 8, 155, mat(0x111214, 0.25, { metalness: 0.3 }), bx + 40, yTop + 4, bz + 150).rotation.y = -0.3;
    box(160, 40, 60, mat(0x3b3f45, 0.5), bx + 120, yTop + 20, bz - 110).rotation.y = 0.4;

    // --- the head: real STEP shells, camera, neck and (assumed) motor when the CAD gap applies; else an extruded shell
    const grey = mat(0x9aa0a8, 0.4, { metalness: 0.5 });
    let neckEnd = null, headLow = null;   // headLow = the head part whose underside surrounds the diffuser
    if (cadReady(cfg)) {
      for (const nm of Object.keys(CAD_PARTS)) {
        const m = addH(cadMesh(nm, mat(CAD_PARTS[nm], nm.startsWith('DM') ? 0.4 : 0.7, nm.startsWith('DM') ? { metalness: 0.5 } : {}))); cadObjs[nm] = m;
        if (nm === 'Neck') { m.geometry.computeBoundingBox(); const bb = m.geometry.boundingBox; neckEnd = new THREE.Vector3((bb.min.x + bb.max.x) / 2, (bb.min.y + bb.max.y) / 2, bb.max.z); }
      }
    } else {
      const shellH = gap + 18, sg = new THREE.ExtrudeGeometry(shapeFromPoly(poly), { depth: shellH, bevelEnabled: true, bevelThickness: 2, bevelSize: 2, bevelSegments: 3 });
      sg.rotateX(Math.PI / 2); sg.translate(0, yDiff + 0.4 + shellH, 0);
      const shell = addH(new THREE.Mesh(sg, mat(0x751b00, 0.7))); headLow = shell; shell.castShadow = true; shell.receiveShadow = true;
      let y1 = -Infinity; for (const [, y] of poly) y1 = Math.max(y1, y);
      neckEnd = new THREE.Vector3(0, -40, y1 + 40);
    }
    // illustrative stand (not CAD): from the neck end down to a base on the nightstand
    const yB = yTop, nb = new THREE.Vector3(neckEnd.x, yB + 30, Math.min(neckEnd.z, cy + D / 2 - 90));
    const link = (a2, b2, r) => { const v = new THREE.Vector3().subVectors(b2, a2), L = v.length(); const m = addH(new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 20), grey)); m.position.copy(a2).addScaledVector(v, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()); m.castShadow = true; return m; };
    const elbow = new THREE.Vector3(nb.x, neckEnd.y, nb.z);
    link(nb, elbow, 11); link(elbow, neckEnd, 11);
    const base = addH(new THREE.Mesh(new THREE.CylinderGeometry(70, 78, 30, 48), mat(0x751b00, 0.6))); base.position.set(nb.x, yB + 15, nb.z); base.castShadow = base.receiveShadow = true;
    // diffuser: emissive, luminance pattern from the model (cd/m2, linear), just outside its outer face
    const nx = geo.nx, ny = geo.ny, dt = new Uint8Array(nx * ny * 4); let Lmax = 0;
    for (let c = 0; c < geo.nD; c++) if (!geo.camMask[c]) Lmax = Math.max(Lmax, d.E[c] * p.k);
    for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) {
      const c = geo.dIdx[iy * nx + ix], o = (iy * nx + ix) * 4; dt[o + 3] = 255;
      if (c < 0 || geo.camMask[c]) continue; const v = Math.round(255 * d.E[c] * p.k / Lmax); dt[o] = dt[o + 1] = dt[o + 2] = v;
    }
    const dtex = new THREE.DataTexture(dt, nx, ny, THREE.RGBAFormat); dtex.magFilter = THREE.LinearFilter; dtex.needsUpdate = true;
    const dg = new THREE.ShapeGeometry(shapeFromPoly(poly)), uv = dg.attributes.uv, pa = dg.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (pa.getX(i) - geo.gx0) / (nx * geo.res), (pa.getY(i) - geo.gy0) / (ny * geo.res));
    dg.rotateX(Math.PI / 2); dg.translate(0, yDiff - 1.05, 0);
    const diffMesh = addH(new THREE.Mesh(dg, new THREE.MeshBasicMaterial({ map: dtex, color: lampCol.clone().multiplyScalar(Lmax), side: THREE.DoubleSide })));

    // ---- thermal-camera look: colour ONLY the surfaces the heat map computes; everything else is plain grey
    //   diffuser outer surface: per-cell temperature from thermalMap (Ben's outside resistance over each cell)
    //   (or, with "see inside", the LED board map itself)
    //   Head Back outer surface: one lumped temperature (thermalMap's shell node -> outside)
    //   Head Front, camera, neck, motor, furniture, room: NOT modelled -> grey (no invented temperatures)
    if (opt.roomLook === 'thermal' && d.map) {
      // scale fitted to what is visible: outside surfaces, or the board when looking inside
      const M = d.map, Ta = cfg.ambient, Thi = Math.max(Ta + 1, opt.irInside ? S.Thi : Math.max(M.TdOutMax, M.TshellOut));
      const tcol = T => { const c = lut(SEQ, Math.max(0, Math.min(1, (T - Ta) / (Thi - Ta)))); return new THREE.Color(c[0], c[1], c[2]); };
      scene.remove(spot); scene.remove(spot.target); scene.remove(hemi); scene.background = new THREE.Color(0x050608);
      scene.add(new THREE.AmbientLight(0xffffff, 0.55)); const dl = new THREE.DirectionalLight(0xffffff, 0.5); dl.position.set(-800, 1500, 900); scene.add(dl);
      const grey = new THREE.MeshLambertMaterial({ color: 0x3b3f46 }), greyH = new THREE.MeshLambertMaterial({ color: 0x5a5f68 });
      fur.traverse(o => { if (o.isMesh) o.material = grey; });
      for (const nm of Object.keys(cadObjs)) cadObjs[nm].material = nm === 'Head_Back' && Number.isFinite(M.TshellOut) ? new THREE.MeshBasicMaterial({ color: tcol(M.TshellOut) }) : greyH;
      scene.traverse(o => { if (o.isMesh && o.material && o.material.isMeshStandardMaterial) o.material = greyH; });   // stand, base, fallback shell
      scene.remove(diffMesh);
      // the diffuser's outer face sits inside the Head Front lip, so the IR surface is drawn just below the lowest Head Front point
      let yLow = yDiff - 1.05; const lowObj = cadReady(cfg) ? cadObjs.Head_Front : headLow; if (!opt.irInside && lowObj) { const bb = new THREE.Box3().setFromObject(lowObj); if (Number.isFinite(bb.min.y)) yLow = Math.min(yLow, bb.min.y - 0.4); }
      const c = M.cells, h0 = c.res / 2, pos = [], col = [], vals = opt.irInside ? c.T : c.Tdo, yy = opt.irInside ? 0.5 : yLow;
      for (let k = 0; k < c.x.length; k++) { const cl = tcol(vals[k]); for (const [ax, ay] of [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]]) { pos.push(c.x[k] + ax * h0, yy, c.y[k] + ay * h0); col.push(cl.r, cl.g, cl.b); } }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));
      // hottest point of what is shown (diffuser outer surface, or the board with "see inside"): ring + label, facing the IR camera below
      let kMax = 0; for (let k = 1; k < vals.length; k++) if (vals[k] > vals[kMax]) kMax = k;
      const ring = new THREE.Mesh(new THREE.RingGeometry(3.2, 4.4, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, depthTest: false }));
      ring.rotation.x = Math.PI / 2; ring.position.set(c.x[kMax], yy - 0.3, c.y[kMax]); ring.renderOrder = 9; scene.add(ring);
      const lab = textSprite(`${opt.irInside ? 'board' : 'diffuser'} max ${vals[kMax].toFixed(1)} °C`, '#ffffff'); lab.scale.multiplyScalar(0.55);
      lab.position.set(c.x[kMax], yy - 6, c.y[kMax] + 9); scene.add(lab);
      let vMin = Infinity; for (let k = 0; k < vals.length; k++) vMin = Math.min(vMin, vals[k]);
      view.irMax = { T: vals[kMax], Tmin: vMin, x: c.x[kMax], y: c.y[kMax], what: opt.irInside ? 'board' : 'diffuser' };
      if (opt.irInside) { for (const nm of ['Head_Front', 'Camera']) if (cadObjs[nm]) cadObjs[nm].visible = false; }
      pn.thermal = { Ta, Thi }; view.irScale = { Ta, Thi };
    } else pn.thermal = null;
    if (cfg.keep.on && !cadReady(cfg)) { const K = cfg.keep, lens = addH(new THREE.Mesh(new THREE.CircleGeometry(K.r, 32), mat(0x050506, 0.15, { metalness: 0.6 }))); lens.rotation.x = Math.PI / 2; lens.position.set(K.x, yDiff - 1.1, K.y); }

    // exposure: like a camera metered on the nightstand top (average luminance there), adjustable in EV
    const topLum = (p.deskAvg + room) * 0.45 / Math.PI;
    pn.exposure = Math.pow(2, opt.ev) * 0.35 / Math.max(1e-3, topLum);
    pn.room = { yTop, yFloor, cx, cy };
    pn.scene = scene;
  }


  // ---------------------------------------------------------------- heat cutaway: a section through the head
  // Coloured only with temperatures the heat map computes (one °C scale, room -> hottest board point):
  //   LED board per cell, diffuser outer surface per cell, PLA screw bosses (board temperature at the boss),
  //   Head Back (lumped shell node, mean of inside and outside). Head Front and camera: grey (not modelled).
  // Arrows: where the heat leaves (front / back cavity / bosses), in W. Section plane at y = cutY (model mm).
  function textSprite(text, color) {
    const c = document.createElement('canvas'), x = c.getContext('2d'), fs = 34; x.font = `600 ${fs}px system-ui`;
    const w = Math.ceil(x.measureText(text).width) + 24; c.width = w; c.height = fs + 22;
    x.font = `600 ${fs}px system-ui`; x.fillStyle = 'rgba(10,14,20,.82)'; x.fillRect(0, 0, w, c.height); x.fillStyle = color || '#e8edf3'; x.textBaseline = 'middle'; x.fillText(text, 12, c.height / 2);
    const t = new THREE.CanvasTexture(c), sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
    const k = 0.26; sp.scale.set(w * k, c.height * k, 1); sp.renderOrder = 10; return sp;
  }
  function buildCutaway(pn, d, S) {
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b0f15);
    scene.add(new THREE.AmbientLight(0xffffff, 0.75)); const dl = new THREE.DirectionalLight(0xffffff, 0.35); dl.position.set(200, 300, 400); scene.add(dl);
    const { cfg } = d, M = d.map, gap = cfg.gap; if (!M) { pn.scene = scene; return; }
    const Ta = cfg.ambient, Thi = Math.max(S.Thi, Ta + 1), cutY = opt.cutY;
    const tcol = T => { const c = lut(SEQ, Math.max(0, Math.min(1, (T - Ta) / (Thi - Ta)))); return new THREE.Color(c[0], c[1], c[2]); };
    const clip = [new THREE.Plane(new THREE.Vector3(0, 0, -1), cutY)];   // keep model y <= cutY
    const add = o => { scene.add(o); return o; };
    const cells = M.cells, n = cells.x.length, r = cells.res, tB = cfg.pcb.type === 'fr4' ? 1.6 : cfg.pcb.tBase;
    // board and diffuser as coloured cell blocks
    const slab = (y0, th, vals) => {
      const g = new THREE.BoxGeometry(r, th, r), m = new THREE.MeshLambertMaterial({ clippingPlanes: clip }), im = new THREE.InstancedMesh(g, m, n), o = new THREE.Object3D();
      for (let k = 0; k < n; k++) { o.position.set(cells.x[k], y0 + th / 2, cells.y[k]); o.updateMatrix(); im.setMatrixAt(k, o.matrix); im.setColorAt(k, tcol(vals[k])); }
      im.instanceColor.needsUpdate = true; return add(im);
    };
    slab(0, tB, cells.T);                                  // board: front face at y 0, back face up into the back cavity
    slab(-gap - 1, 1, cells.Tdo);                          // diffuser (outer-surface temperature), 1 mm thick
    // bosses (PLA unless the what-if changed them): back 5 mm above the board back, front 3 mm below the front
    const Tb = M.Tboss, bossCol = tcol(Tb);
    E.CAD.bosses.forEach(b => {
      const L = b.L, g = new THREE.CylinderGeometry(4.3, 4.3, L, 20), m = add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: bossCol, clippingPlanes: clip })));
      m.position.set(b.x, L === 5 ? tB + L / 2 : -L / 2, b.y);
    });
    // shells
    const shellT = (M.TshellIn + M.TshellOut) / 2;
    if (cad.geoms.Head_Back) {
      const hb = cad.geoms.Head_Back.clone(); hb.translate(0, 0, 0);
      add(new THREE.Mesh(hb, new THREE.MeshLambertMaterial({ color: tcol(shellT), side: THREE.DoubleSide, clippingPlanes: clip })));
      add(new THREE.Mesh(cad.geoms.Head_Front, new THREE.MeshLambertMaterial({ color: 0x5a5f68, side: THREE.DoubleSide, clippingPlanes: clip })));
      if (cad.geoms.Camera) add(new THREE.Mesh(cad.geoms.Camera, new THREE.MeshLambertMaterial({ color: 0x4a4f57, clippingPlanes: clip })));
    }
    // labels and heat-flow arrows (in the section plane, just in front of it)
    const zL = cutY + 2, cx = M.hot.x;
    const lab = (txt, x, y, col) => { const s = textSprite(txt, col); s.position.set(x, y, zL); add(s); };
    const arrow = (x, y, dy, len, W, txt) => { const a = new THREE.ArrowHelper(new THREE.Vector3(0, dy, 0), new THREE.Vector3(x, y, zL), len, 0xffc857, 8, 6); add(a); lab(`${txt} ${W.toFixed(2)} W`, x + 34, y + dy * len * 0.6, '#ffc857'); };
    lab(`Board ${M.Tmax.toFixed(0)} °C (LED chips ${M.TjMax.toFixed(0)}, limit 125)`, cx, -6, '#ffffff');
    lab(`Diffuser outside ≤ ${M.TdOutMax.toFixed(0)} °C`, cx, -gap - 9, '#ffffff');
    lab(`Head Back ${shellT.toFixed(0)} °C (lumped)`, 45, 60, '#ffffff');
    lab(`Bosses ${Tb.toFixed(0)} °C${Tb > cfg.plaMax ? ` > PLA ${cfg.plaMax} ⚠` : ''}`, -75, -10, Tb > cfg.plaMax ? '#ff8787' : '#ffffff');
    arrow(cx - 30, -gap - 2, -1, 45, M.Q.front, 'out the front');
    arrow(cx - 30, tB + 2, 1, 45, M.Q.back, 'across the back cavity');
    arrow(-60, tB + 7, 1, 22, M.Q.mounts, 'through bosses');
    pn.scene = scene;
  }

  // ---------------------------------------------------------------- panels (one canvas each, one shared camera)
  function makePanel() {
    const div = document.createElement('div'); div.className = 'v3panel';
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setPixelRatio(window.devicePixelRatio || 1);
    div.appendChild(renderer.domElement); const lab = document.createElement('div'); lab.className = 'v3lab'; div.appendChild(lab);
    host.appendChild(div);
    const pn = { div, renderer, lab, cam: new THREE.PerspectiveCamera(40, 1, 1, 20000), scene: null };
    const el = renderer.domElement; let drag = null;
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, pan: e.button === 2 || e.shiftKey }; try { el.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ } });
    el.addEventListener('pointermove', e => {
      if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
      if (drag.pan) { const s = orb.r / 900, right = new THREE.Vector3().setFromMatrixColumn(pn.cam.matrix, 0), up = new THREE.Vector3().setFromMatrixColumn(pn.cam.matrix, 1); orb.tgt.addScaledVector(right, -dx * s).addScaledVector(up, dy * s); }
      else { orb.th -= dx * 0.008; orb.ph = Math.max(0.05, Math.min(Math.PI - 0.05, orb.ph - dy * 0.008)); }
      autoCam = null; renderAll();
    });
    el.addEventListener('pointerup', () => { drag = null; });
    el.addEventListener('wheel', e => { e.preventDefault(); autoCam = null; orb.r = Math.max(40, Math.min(6000, orb.r * Math.exp(e.deltaY * 0.001))); renderAll(); }, { passive: false });
    return pn;
  }
  function layout() {
    const n = panels.length; host.style.gridTemplateColumns = n <= 1 ? '1fr' : 'repeat(2, 1fr)'; host.style.gridTemplateRows = n <= 2 ? '1fr' : 'repeat(2, 1fr)';
    for (const pn of panels) { const w = pn.div.clientWidth || 400, h = pn.div.clientHeight || 300; pn.renderer.setSize(w, h); pn.cam.aspect = w / h; pn.cam.updateProjectionMatrix(); }
  }
  function renderAll() {
    const { th, ph, r, tgt } = orb;
    for (const pn of panels) {
      if (!pn.scene) continue;
      pn.cam.position.set(tgt.x + r * Math.sin(ph) * Math.sin(th), tgt.y + r * Math.cos(ph), tgt.z + r * Math.sin(ph) * Math.cos(th));
      pn.cam.up.set(0, 1, 0); if (Math.sin(ph) < 0.2) pn.cam.up.set(0, 0, Math.cos(ph) < 0 ? 1 : -1);   // near straight up/down: keep model +y up the screen
      pn.cam.lookAt(tgt);
      pn.renderer.render(pn.scene, pn.cam);
    }
  }
  function disposeScene(sc) { if (!sc) return; sc.traverse(n => { if (n.geometry) n.geometry.dispose(); if (n.material) (Array.isArray(n.material) ? n.material : [n.material]).forEach(m => m.dispose()); }); }
  function build() {
    if (!designs.length) return;
    while (panels.length < designs.length) panels.push(makePanel());
    while (panels.length > designs.length) { const pn = panels.pop(); disposeScene(pn.scene); pn.renderer.dispose(); pn.div.remove(); }
    layout();
    const S = sharedScale();
    const roomMode = opt.scene === 'room', cutMode = opt.scene === 'cutaway';
    designs.forEach((d, i) => {
      const pn = panels[i], r = pn.renderer; disposeScene(pn.scene);
      // renderer set-up differs: the diagram computes its own display colours; the room uses physical lights + tone mapping
      const ir = roomMode && opt.roomLook === 'thermal', real = roomMode && !ir;   // thermal look: computed colours, no photometry
      r.physicallyCorrectLights = real; r.shadowMap.enabled = real; r.shadowMap.type = THREE.VSMShadowMap; r.localClippingEnabled = cutMode;
      r.toneMapping = real ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping; r.outputEncoding = real ? THREE.sRGBEncoding : THREE.LinearEncoding;
      if (cutMode) buildCutaway(pn, d, S); else if (roomMode) { buildRoom(pn, d, S); r.toneMappingExposure = pn.exposure; } else buildPanel(pn, d, S);
      pn.lab.innerHTML = d.label || '';
    });
    const sceneKey = opt.scene + (roomMode && opt.roomLook === 'thermal' ? '-ir' : '');
    if (sceneKey !== lastRoomMode) { lastRoomMode = sceneKey; placed = false; autoCam = null; }
    if (!placed || autoCam) { const w = autoCam || (cutMode ? 'cut' : roomMode ? (opt.roomLook === 'thermal' ? 'irUp' : 'room') : 'head'); home(w); placed = true; autoCam = w; }
    renderAll();
    if (view.onInfo) view.onInfo(S, opt, designs.map(prep));
  }
  function home(which) {
    const d = designs[0]; if (!d) return; const g = d.cfg.gap, z = d.cfg.taskZ;
    // fit the head (its outline's bounding circle) to the panel, whatever its size
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const [x, y] of d.geo.poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, Rh = Math.hypot(x1 - x0, y1 - y0) / 2, asp = panels[0] ? panels[0].cam.aspect : 1.5;
    const vf = 40 * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * asp), fit = Rh * 1.08 / Math.sin(Math.min(vf, hf) / 2);
    if (which === 'cut') { orb.tgt.set(0, 5, opt.cutY); orb.r = 240; orb.th = 0.22; orb.ph = 1.45; }
    else if (which === 'room') { orb.tgt.set(cx + 60, -g - z - 40, cy - 40); orb.r = 1500; orb.th = Math.PI - 0.55; orb.ph = 1.2; }
    else if (which === 'roomLamp') { orb.tgt.set(cx, -g - 20, cy); orb.r = 520; orb.th = Math.PI - 0.6; orb.ph = 1.95; }
    else if (which === 'irUp') { orb.tgt.set(cx, -g, cy); orb.r = Math.min(z - 20, fit * 1.15); orb.th = 0; orb.ph = Math.PI - 0.03; }   // IR camera on the desk, looking straight up at the diffuser
    else if (which === 'roomLow') { orb.tgt.set(cx, -g - z + 120, cy); orb.r = 800; orb.th = Math.PI - 0.35; orb.ph = 1.45; }
    else if (which === 'head') { orb.tgt.set(cx, -g, cy); orb.r = fit; orb.th = 0.6; orb.ph = 2.2; }
    else if (which === 'below') { orb.tgt.set(cx, -g, cy); orb.r = fit; orb.th = 0; orb.ph = Math.PI - 0.02; }
    else if (which === 'side') { orb.tgt.set(0, -(g + z) / 2, 0); orb.r = 900; orb.th = 0; orb.ph = Math.PI / 2; }
    else { orb.tgt.set(0, -(g + z) * 0.62, 0); orb.r = 980; orb.th = 0.75; orb.ph = 1.43; }
    renderAll();
  }
  const view = {
    // list: [{ label, cfg, geo, E, leds, duty, flux }], first = reference for the Real-look exposure
    update(list) { designs = list; loadCad(); build(); },
    debug() { const out = []; if (panels[0] && panels[0].scene) panels[0].scene.traverse(o => { if (o.isMesh) out.push([o.material.type, o.material.color ? o.material.color.getHexString() : '', o.material.vertexColors ? 'vc' : '', o.geometry.type, o.visible]); }); return out; },
    resize() { layout(); if (autoCam) home(autoCam); renderAll(); }, home(w) { autoCam = ['head', 'below', 'room', 'roomLow', 'roomLamp', 'irUp', 'cut'].includes(w) ? w : null; home(w); }, opt, onInfo: null,
    set(k, v) { opt[k] = v; build(); },
    png() { // all panels side by side in one image
      renderAll(); const cs = panels.map(p => p.renderer.domElement), cols = cs.length <= 1 ? 1 : 2, rows = Math.ceil(cs.length / cols), w = cs[0].width, h = cs[0].height;
      const out = document.createElement('canvas'); out.width = w * cols; out.height = h * rows; const x = out.getContext('2d');
      cs.forEach((c, i) => { x.drawImage(c, (i % cols) * w, Math.floor(i / cols) * h); x.fillStyle = '#fff'; x.font = `${Math.round(h / 22)}px system-ui`; x.fillText((designs[i].name || ''), (i % cols) * w + 12, Math.floor(i / cols) * h + h / 18); });
      return out.toDataURL('image/png');
    },
  };
  return view;
}
if (typeof window !== 'undefined') window.HeadView3D = HeadView3D;
