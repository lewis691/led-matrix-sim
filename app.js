/* Head LED Placement Studio — UI. Depends on engine.js (HeadLEDEngine). */
(() => {
  'use strict';
  const E = HeadLEDEngine();
  const $ = id => document.getElementById(id);
  const fmt = (v, d = 1) => Number.isFinite(v) ? v.toFixed(d) : '—';
  const STORE = 'headLedStudio.v1';
  const GEO_KEYS = /^(shape\.|gap$|ledH$|apInset$|m$|evalInset$|res$|edgeMargin$|holeClear$)/;

  let cfg = E.defaults(), leds = [], snapshots = [];
  let geo, field, placer, therm = null, thermRange = null, strings = [], res = null, rangeT = 0, cadMigrated = false;
  let selected = -1, tool = 'move', drag = null, worker = null, optStartLeds = null, camDrag = null;
  const undoStack = [], redoStack = [];

  // ------------------------------------------------------------ helpers
  const getPath = (o, p) => p.split('.').reduce((a, k) => a == null ? a : a[k], o);
  const setPath = (o, p, v) => { const ks = p.split('.'), last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; };
  function merge(base, over) { for (const k in over) { if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && base[k] && typeof base[k] === 'object') merge(base[k], over[k]); else base[k] = over[k]; } return base; }
  function toast(t, ms = 4500) { let e = $('toast'); if (!e) { e = document.createElement('div'); e.id = 'toast'; e.setAttribute('role', 'status'); document.body.append(e); } e.textContent = t; clearTimeout(toast.t); toast.t = setTimeout(() => e.remove(), ms); }
  function status(t) { $('status').textContent = t; }
  function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
  function persist() { try { localStorage.setItem(STORE, JSON.stringify({ cfg, leds, snapshots })); } catch (e) { /* storage unavailable */ } }
  // older designs stored the camera as a corner quadrant or a rectangle; replace it with the lens circle
  function migrate(c, keepGap) {
    if (c && c.keep && (c.keep.r == null || c.keep.x == null)) { const d = E.defaults().keep; c.keep = { ...d, on: c.keep.on !== false, occlude: c.keep.occlude !== false }; }
    // designs saved before the Head STEP was measured: switch to the CAD geometry (camera barrel + module footprint,
    // screw bosses, lit aperture, LED height; gap 17.9 mm unless keepGap, e.g. a snapshot deliberately at 21 mm)
    if (c && !c.cadV) {
      const d = E.defaults();
      c.keep = { ...d.keep, on: c.keep ? c.keep.on !== false : true, occlude: c.keep ? c.keep.occlude !== false : true, x: d.keep.x, y: d.keep.y };
      c.holes = d.holes; c.apInset = d.apInset; c.evalInset = d.evalInset; c.ledH = d.ledH;
      if (!keepGap) c.gap = d.gap;
      c.cadV = 1; cadMigrated = true;
    }
    if (c && !c.bodyMargins) { if (c.edgeMargin != null) c.edgeMargin = Math.max(0, +(c.edgeMargin - E.PKG_R).toFixed(2)); c.bodyMargins = true; } // margins now limit the LED body
    return c;
  }
  function restore() { try { const s = JSON.parse(localStorage.getItem(STORE) || 'null'); if (s && s.cfg && Array.isArray(s.leds)) { cfg = merge(E.defaults(), migrate(s.cfg)); leds = s.leds; snapshots = (s.snapshots || []).map(x => ({ ...x, cfg: migrate(x.cfg, true) })); return true; } } catch (e) { /* ignore */ } return false; }
  const copyLeds = a => a.map(p => p.s == null ? { x: p.x, y: p.y } : { x: p.x, y: p.y, s: p.s });
  const nStrings = () => Math.max(1, Math.ceil(leds.length / cfg.perString));
  // string membership is stored on each LED (wiring is physical: dragging an LED keeps its string)
  function ensureStrings(force) {
    const nS = nStrings();
    if (force || leds.some(p => p.s == null || p.s >= nS)) {
      const a = E.assignStrings(leds, cfg.perString, geo.areaD, cfg.stringMode, placer.sdfAt);
      leds.forEach((p, i) => { p.s = a[i]; });
    }
    if (!Array.isArray(cfg.duty)) cfg.duty = [];
    while (cfg.duty.length < nS) cfg.duty.push(1);
  }
  const wts = () => leds.map(p => { const d = cfg.duty[p.s]; return d == null ? 1 : d; });
  function applyWeights(full) { field.setWeights(wts()); computeThermal(full); refresh(!full); if (full) persist(); }
  const snapLayout = () => Object.assign(copyLeds(leds), { cam: { ...cfg.keep } });
  function pushUndo() { undoStack.push(snapLayout()); if (undoStack.length > 200) undoStack.shift(); redoStack.length = 0; }
  function undo() { if (!undoStack.length) return; redoStack.push(snapLayout()); setLeds(undoStack.pop(), false); }
  function redo() { if (!redoStack.length) return; undoStack.push(snapLayout()); setLeds(redoStack.pop(), false); }
  // move the camera without rebuilding the grids
  function applyCam(k) { cfg.keep = { ...cfg.keep, ...k }; E.setCam(geo, cfg.keep); placer.setCam(cfg.keep); syncCam(); }

  // ------------------------------------------------------------ model plumbing
  function rebuild() {
    const t = performance.now();
    geo = E.buildGeo(cfg, cfg.res);
    placer = E.buildPlacer(cfg);
    field = E.Field(geo, cfg);
    ensureStrings(false); field.setAll(leds, wts());
    therm = null;
    computeThermal(true);
    refresh();
    status(`Geometry rebuilt in ${Math.round(performance.now() - t)} ms · ${geo.nD} diffuser cells`);
  }
  function setLeds(next, undoable = true) {
    if (undoable) pushUndo();
    const recount = next.length !== leds.length;
    if (next.cam && (next.cam.x !== cfg.keep.x || next.cam.y !== cfg.keep.y || next.cam.r !== cfg.keep.r)) applyCam(next.cam);
    leds = copyLeds(next); cfg.count = leds.length; syncInputs(['count']);
    if (selected >= leds.length) selected = -1;
    ensureStrings(recount); field.setAll(leds, wts()); computeThermal(true); refresh(); dutyPanel(); persist();
  }
  // Heat: the full board map (engine thermalMap: board conduction + Ben's front path + back cavity + mounts, all heat
  // sources) is the main result; Ben's own 1-D front-only network is kept alongside as the reference he published.
  function computeThermal() {
    if (!leds.length) { therm = thermRange = null; return; }
    const o = { weights: wts() };
    const ben = E.thermal(cfg, geo.area, leds, o), map = E.thermalMap(cfg, leds, o);
    therm = { ...ben, ben, map, Tboard: map.Tmax, Tmax: map.Tmax, TjMax: map.TjMax, TdOut: map.TdOutMax };
    const mine = { Tboard: map.Tmax };
    if (!thermRange) thermRange = { worst: mine, best: mine };
    thermRange[map.case] = mine;
    clearTimeout(rangeT);
    rangeT = setTimeout(() => {                                   // the other bounding case, off the edit path
      if (!leds.length) return;
      for (const k of ['worst', 'best']) if (k !== map.case) thermRange[k] = { Tboard: E.thermalMap(cfg, leds, { ...o, thermalCase: k }).Tmax };
      panels();
    }, 300);
  }
  function validity() {
    const bad = new Set();
    leds.forEach((p, i) => { if (!placer.okRegion(p.x, p.y) || !placer.okPitch(leds, i, p.x, p.y)) bad.add(i); });
    return bad;
  }
  function results() {
    const n = leds.length, m = E.metrics(geo, field.E, n), wSum = wts().reduce((a, b) => a + b, 0);
    const L = E.led(cfg, therm ? therm.TjMax : 25), drv = E.drive(cfg, n);   // flux derated at the hottest LED chip (map)
    const outLm = n * L.flux * m.util * cfg.tau, meanLux = m.mean * L.flux * 1e6 * cfg.tau;
    let nnSum = 0, nnMin = Infinity;
    for (let i = 0; i < n; i++) { let d = Infinity; for (let j = 0; j < n; j++) if (i !== j) d = Math.min(d, Math.hypot(leds[i].x - leds[j].x, leds[i].y - leds[j].y)); if (Number.isFinite(d)) { nnSum += d; nnMin = Math.min(nnMin, d); } }
    const nn = n > 1 ? nnSum / n : 0;
    const desk = n ? E.taskLight(geo, field.E, L.flux, cfg) : null;
    return { m, L, drv, n, outLm, meanLux, lum: meanLux / Math.PI, desk, P: wSum * L.Pel, kept: n ? wSum / n : 0, nn, nnMin, dh: nn / (cfg.gap - (cfg.ledH || 0)), bad: validity() };
  }

  // ------------------------------------------------------------ rendering
  const cv = $('view'), ctx = cv.getContext('2d');
  let T = { s: 1, ox: 0, oy: 0 }, dpr = 1;
  const hm = document.createElement('canvas'), hmx = hm.getContext('2d');
  const LUT = (() => { const st = [[0, [0, 0, 4]], [0.2, [40, 11, 84]], [0.4, [101, 21, 110]], [0.6, [188, 55, 84]], [0.8, [249, 142, 9]], [1, [252, 255, 164]]], out = new Uint8ClampedArray(256 * 3); for (let i = 0; i < 256; i++) { const t = i / 255; let k = 0; while (k < st.length - 2 && t > st[k + 1][0]) k++; const [t0, c0] = st[k], [t1, c1] = st[k + 1], f = (t - t0) / (t1 - t0); for (let c = 0; c < 3; c++) out[i * 3 + c] = c0[c] + (c1[c] - c0[c]) * f; } return out; })();
  const HUES = Array.from({ length: 24 }, (_, i) => `hsl(${(i * 137.5) % 360} 80% 60%)`);
  function resize() {
    dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth; if (!w) return;
    const h = Math.max(320, Math.round(Math.min(w * 0.74, window.innerHeight - 250)));
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.height = h + 'px';
    const poly = geo.poly; let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const pad = 8, s = Math.min(cv.width / (x1 - x0 + 2 * pad), cv.height / (y1 - y0 + 2 * pad));
    T = { s, ox: cv.width / 2 - (x0 + x1) / 2 * s, oy: cv.height / 2 + (y0 + y1) / 2 * s };
    draw();
  }
  const sx = x => T.ox + x * T.s, sy = y => T.oy - y * T.s;
  const wx = px => (px * dpr - T.ox) / T.s, wy = py => (T.oy - py * dpr) / T.s;
  function outlinePath() { ctx.beginPath(); geo.poly.forEach(([x, y], i) => i ? ctx.lineTo(sx(x), sy(y)) : ctx.moveTo(sx(x), sy(y))); ctx.closePath(); }
  function heatImage(g, vals, lo, hi, isCell) {
    if (hm.width !== g.nx || hm.height !== g.ny) { hm.width = g.nx; hm.height = g.ny; }
    const img = hmx.createImageData(g.nx, g.ny), d = img.data, span = hi - lo || 1;
    for (let iy = 0; iy < g.ny; iy++) for (let ix = 0; ix < g.nx; ix++) {
      const j = iy * g.nx + ix, c = g.dIdx[j], o = ((g.ny - 1 - iy) * g.nx + ix) * 4;
      if (c < 0 || (isCell && !isCell(c))) continue;
      const t = Math.max(0, Math.min(255, Math.round((vals[c] - lo) / span * 255)));
      d[o] = LUT[t * 3]; d[o + 1] = LUT[t * 3 + 1]; d[o + 2] = LUT[t * 3 + 2]; d[o + 3] = 255;
    }
    hmx.putImageData(img, 0, 0);
    ctx.save(); outlinePath(); ctx.clip(); ctx.imageSmoothingEnabled = true;
    ctx.drawImage(hm, sx(g.gx0), sy(g.gy0 + g.ny * g.res), g.nx * g.res * T.s, g.ny * g.res * T.s);
    ctx.restore();
  }
  function legend(title, lo, hi, unit, d) {
    $('legTitle').textContent = title; $('legLo').textContent = fmt(lo, d) + unit; $('legHi').textContent = fmt(hi, d) + unit;
    const lc = $('legBar').getContext('2d'); for (let i = 0; i < 180; i++) { const t = Math.round(i / 179 * 255); lc.fillStyle = `rgb(${LUT[t * 3]},${LUT[t * 3 + 1]},${LUT[t * 3 + 2]})`; lc.fillRect(i, 0, 1, 9); }
    $('legend').style.display = '';
  }
  function draw() {
    if (!geo) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--canvas') || '#10151d';
    ctx.fillRect(0, 0, cv.width, cv.height);
    // grid
    ctx.strokeStyle = 'rgba(160,180,210,.07)'; ctx.lineWidth = 1;
    for (let x = -80; x <= 80; x += 10) { ctx.beginPath(); ctx.moveTo(sx(x), sy(-50)); ctx.lineTo(sx(x), sy(80)); ctx.stroke(); }
    for (let y = -50; y <= 80; y += 10) { ctx.beginPath(); ctx.moveTo(sx(-80), sy(y)); ctx.lineTo(sx(80), sy(y)); ctx.stroke(); }
    // diffuser base
    ctx.save(); outlinePath(); ctx.fillStyle = '#1b2230'; ctx.fill(); ctx.restore();
    const ov = $('overlay').value;
    if (ov === 'diffuser' && leds.length) {
      const m = res ? res.m : E.metrics(geo, field.E, leds.length);
      let lo, hi;
      if ($('scale').value === 'mean') { lo = m.mean * 0.6; hi = m.mean * 1.4; } else { lo = m.min; hi = m.max; }
      heatImage(geo, field.E, lo, hi);
      if ($('scale').value === 'mean') legend('Diffuser irradiance (relative to mean)', 60, 140, '%', 0);
      else { const k = (res ? res.L.flux : 1) * 1e6 * cfg.tau; legend('Diffuser exit illuminance', lo * k, hi * k, ' lx', 0); }
    } else if (ov === 'heat' && therm && therm.map) {
      const M = therm.map, c = M.cells, lo = M.Tmin, hi = Math.max(M.Tmax, lo + 0.5), h0 = c.res / 2;
      ctx.save(); outlinePath(); ctx.clip();
      for (let k = 0; k < c.x.length; k++) { const t = Math.round((c.T[k] - lo) / (hi - lo) * 255); ctx.fillStyle = `rgb(${LUT[t * 3]},${LUT[t * 3 + 1]},${LUT[t * 3 + 2]})`; ctx.fillRect(sx(c.x[k] - h0) - 0.5, sy(c.y[k] + h0) - 0.5, c.res * T.s + 1, c.res * T.s + 1); }
      ctx.restore();
      legend(`Board temperature, ${M.case} case (LED chips up to ${fmt(M.TjMax, 1)} °C)`, lo, hi, ' °C', 1);
    } else $('legend').style.display = 'none';
    // keepout block
    if (cfg.keep.on) {
      const K = camDrag ? camDrag.k : cfg.keep;
      if (K.zone === 'module' && K.mod) { // camera board + lens holder footprint (STEP)
        const z = E.modPoly(K);
        ctx.save(); ctx.beginPath(); z.forEach(([x, y], i) => i ? ctx.lineTo(sx(x), sy(y)) : ctx.moveTo(sx(x), sy(y))); ctx.closePath();
        ctx.fillStyle = 'rgba(32,38,47,.85)'; ctx.fill(); ctx.clip();
        ctx.strokeStyle = 'rgba(201,210,222,.18)'; ctx.lineWidth = dpr; for (let t = -400; t < 400; t += 6) { ctx.beginPath(); ctx.moveTo(sx(t), sy(-60)); ctx.lineTo(sx(t + 140), sy(80)); ctx.stroke(); }
        ctx.restore();
        const g = K.margin; ctx.setLineDash([4 * dpr, 4 * dpr]); ctx.lineWidth = dpr; ctx.strokeStyle = 'rgba(255,200,87,.5)';
        ctx.strokeRect(sx(z[0][0] - g), sy(z[2][1] + g), (z[1][0] - z[0][0] + 2 * g) * T.s, (z[2][1] - z[0][1] + 2 * g) * T.s); ctx.setLineDash([]);
        ctx.fillStyle = '#c9d2de'; ctx.font = `${10 * dpr}px system-ui`; ctx.textAlign = 'left'; ctx.fillText('camera board', sx(z[0][0]) + 3 * dpr, sy(z[2][1]) + 12 * dpr);
      }
      if (K.zone === 'dxf') { // original DXF keepout zone: hatched, clipped to the outline, dashed clearance line
        const z = E.zonePoly(K, geo.poly);
        if (z.length > 2) {
          ctx.save(); ctx.beginPath(); z.forEach(([x, y], i) => i ? ctx.lineTo(sx(x), sy(y)) : ctx.moveTo(sx(x), sy(y))); ctx.closePath();
          ctx.fillStyle = 'rgba(32,38,47,.85)'; ctx.fill(); ctx.clip();
          ctx.strokeStyle = 'rgba(201,210,222,.18)'; ctx.lineWidth = dpr; for (let t = -400; t < 400; t += 6) { ctx.beginPath(); ctx.moveTo(sx(t), sy(-60)); ctx.lineTo(sx(t + 140), sy(80)); ctx.stroke(); }
          ctx.restore();
          const X0 = K.x + K.boxDx - K.boxMargin, Y1 = K.y + K.boxDy + K.boxMargin;
          ctx.setLineDash([4 * dpr, 4 * dpr]); ctx.lineWidth = dpr; ctx.strokeStyle = 'rgba(255,200,87,.5)';
          ctx.beginPath(); ctx.moveTo(sx(X0), sy(-60)); ctx.lineTo(sx(X0), sy(Y1)); ctx.lineTo(sx(90), sy(Y1)); ctx.stroke(); ctx.setLineDash([]);
          ctx.fillStyle = '#c9d2de'; ctx.font = `${11 * dpr}px system-ui`; ctx.textAlign = 'left'; ctx.fillText('DXF keepout', sx(K.x + K.boxDx) + 4 * dpr, sy(K.y + K.boxDy) + 14 * dpr);
        }
      }
      ctx.fillStyle = camDrag ? 'rgba(60,70,88,.95)' : '#20262f'; ctx.beginPath(); ctx.arc(sx(K.x), sy(K.y), K.r * T.s, 0, 7); ctx.fill();
      ctx.strokeStyle = '#c9d2de'; ctx.lineWidth = 1.5 * dpr; ctx.stroke();
      ctx.beginPath(); ctx.arc(sx(K.x), sy(K.y), K.r * 0.45 * T.s, 0, 7); ctx.stroke();
      ctx.setLineDash([4 * dpr, 4 * dpr]); ctx.lineWidth = dpr; ctx.strokeStyle = 'rgba(255,200,87,.5)';
      ctx.beginPath(); ctx.arc(sx(K.x), sy(K.y), (K.r + K.margin) * T.s, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#c9d2de'; ctx.font = `${11 * dpr}px system-ui`; ctx.textAlign = 'center';
      ctx.fillText('camera', sx(K.x), sy(K.y - K.r) + 14 * dpr);
    }
    // outline + inset (placement limit)
    ctx.lineWidth = 1.5 * dpr; ctx.strokeStyle = '#6c7a8f';
    outlinePath(); ctx.stroke();
    ctx.setLineDash([3 * dpr, 4 * dpr]); ctx.lineWidth = 1 * dpr; ctx.strokeStyle = 'rgba(255,200,87,.35)';
    ctx.beginPath(); const P = geo.poly, n = P.length;
    for (let i = 0; i < n; i++) { const a = P[(i - 1 + n) % n], b = P[i], c = P[(i + 1) % n]; let nx = -(c[1] - a[1]), ny = c[0] - a[0]; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l; const x = b[0] + nx * cfg.edgeMargin, y = b[1] + ny * cfg.edgeMargin; i ? ctx.lineTo(sx(x), sy(y)) : ctx.moveTo(sx(x), sy(y)); }
    ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
    // holes
    for (const h of cfg.holes) { ctx.strokeStyle = '#8b96a8'; ctx.lineWidth = dpr; ctx.beginPath(); ctx.arc(sx(h.x), sy(h.y), 1.3 * T.s, 0, 7); ctx.stroke(); ctx.setLineDash([2 * dpr, 3 * dpr]); ctx.beginPath(); ctx.arc(sx(h.x), sy(h.y), cfg.holeClear * T.s, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
    // LED-to-LED spacing for building the prototype
    if ($('showSpacing').checked && leds.length > 1) {
      const nb = E.neighbours(leds);
      ctx.lineWidth = dpr; ctx.strokeStyle = 'rgba(130,200,255,.55)'; ctx.font = `${10 * dpr}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const q of nb.pairs) {
        const a = leds[q.a], b = leds[q.b], mx = sx((a.x + b.x) / 2), my = sy((a.y + b.y) / 2);
        ctx.beginPath(); ctx.moveTo(sx(a.x), sy(a.y)); ctx.lineTo(sx(b.x), sy(b.y)); ctx.stroke();
        const t = q.d.toFixed(1), tw = ctx.measureText(t).width + 4 * dpr;
        ctx.fillStyle = 'rgba(10,14,20,.85)'; ctx.fillRect(mx - tw / 2, my - 6 * dpr, tw, 12 * dpr);
        ctx.fillStyle = '#bfe3ff'; ctx.fillText(t, mx, my);
      }
      ctx.textBaseline = 'alphabetic';
    }
    // LEDs
    const bad = res ? res.bad : new Set(), showS = $('showStrings').checked, showL = $('showLabels').checked;
    const w = 2.8 * T.s, h = 3.5 * T.s;
    leds.forEach((p, i) => {
      const x = sx(p.x), y = sy(p.y);
      const du = cfg.duty[p.s] == null ? 1 : cfg.duty[p.s];
      ctx.globalAlpha = 0.25 + 0.75 * du;
      ctx.fillStyle = showS ? HUES[(strings[i] || 0) % HUES.length] : '#fff4cf';
      ctx.fillRect(x - w / 2, y - h / 2, w, h);
      ctx.globalAlpha = 1;
      if (hlString >= 0 && p.s === hlString) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2 * dpr; ctx.strokeRect(x - w / 2 - 3 * dpr, y - h / 2 - 3 * dpr, w + 6 * dpr, h + 6 * dpr); }
      ctx.lineWidth = (bad.has(i) ? 2.5 : 1) * dpr; ctx.strokeStyle = bad.has(i) ? '#ff4d4f' : 'rgba(0,0,0,.6)'; ctx.strokeRect(x - w / 2, y - h / 2, w, h);
      if (i === selected) { ctx.strokeStyle = '#22b8cf'; ctx.lineWidth = 2 * dpr; ctx.beginPath(); ctx.arc(x, y, Math.max(4.2 * T.s, 9 * dpr), 0, 7); ctx.stroke(); }
      if (showL) { ctx.fillStyle = '#dfe6ee'; ctx.font = `${10 * dpr}px system-ui`; ctx.textAlign = 'left'; ctx.fillText(showS ? `${i + 1}·S${(strings[i] || 0) + 1}${(cfg.duty[p.s] ?? 1) < 0.995 ? ' ' + Math.round(cfg.duty[p.s] * 100) + '%' : ''}` : `${i + 1}`, x + w / 2 + 2 * dpr, y - h / 2); }
    });
    // scale bar
    ctx.fillStyle = '#cfd6e0'; ctx.fillRect(cv.width - 20 * dpr - 10 * T.s, cv.height - 18 * dpr, 10 * T.s, 3 * dpr);
    ctx.font = `${11 * dpr}px system-ui`; ctx.textAlign = 'right'; ctx.fillText('10 mm', cv.width - 20 * dpr, cv.height - 24 * dpr);
  }

  // ------------------------------------------------------------ panels
  let panelT = 0;
  function refresh(light) {
    strings = leds.map(p => p.s || 0);
    const prevBudget = res && res.budget;
    res = results();
    res.budget = light && prevBudget ? prevBudget : (leds.length ? E.lightBudget(cfg, geo, leds, wts()) : null); // full refresh only
    draw(); if (v3on) v3schedule();
    const now = performance.now();
    if (light && now - panelT < 90) return;
    panelT = now; panels(); dutyPanel();
  }
  const tip = t => `<span class="q" data-tip="${t}">?</span>`;
  const kv = rows => rows.map(([a, b]) => `<span>${a}</span><span>${b}</span>`).join('');
  function tile(stp, cls, k, help, v, unit, t) { return `<button class="tile ${cls}" data-goto="${stp}"><div class="k">${k} ${tip(help)}</div><div class="v">${v}<small>${unit}</small></div><div class="t">${t}</div></button>`; }
  function panels() {
    const r = res, m = r.m, th = therm, d = r.drv;
    const tU = cfg.targetUniformPct / 100, ev = m.minAvg;
    // constraint checklist (restored from the old program); the strip tiles already show light, desk, evenness,
    // board and power, so the issues chip lists the remaining failed checks
    const chk = E.checklist(cfg, { lm: r.outLm, deskMin: r.desk ? r.desk.min : null, evenness: ev, Tboard: th ? th.Tboard : null, TjMax: th ? th.TjMax : null, TdOut: th ? th.TdOut : null, Tboss: th ? th.map.Tboss : null, TshellIn: th ? th.map.TshellIn : null, P: r.P, bad: r.bad.size, drv: d });
    const TILED = ['Light out', 'Desk light (min)', 'Evenness', 'Board temperature', 'LED power'];
    const issues = chk.filter(c => !c.ok && !TILED.includes(c.k)).map(c => `${c.k}: ${c.val} (limit ${c.lim})`);
    if (!d.full) issues.push('Strings are uneven: LED count is not a multiple of LEDs per string');
    $('checkList').innerHTML = `<table class="chk-t"><tr><th></th><th>Check</th><th>Now</th><th>Limit</th><th>Limit from</th></tr>${chk.map(c => `<tr><td class="${c.ok ? 'good' : 'bad'}">${c.ok ? '✓' : '✕'}</td><td>${c.k}</td><td>${esc(c.val)}</td><td>${esc(c.lim)}</td><td class="src">${esc(c.src)}</td></tr>`).join('')}</table>`;
    $('strip').innerHTML =
      tile(2, ev >= tU ? 'ok' : ev >= tU * 0.8 ? 'mid' : 'no', 'Evenness', 'Darkest spot on the diffuser ÷ average brightness. 100% = perfectly even. Click to go to Layout.', fmt(ev * 100, 0), '%', `target ≥ ${fmt(cfg.targetUniformPct, 0)}% · variation ${fmt(m.cv * 100, 1)}%`) +
      tile(3, r.outLm >= cfg.targetLm ? 'ok' : r.outLm >= cfg.targetLm * 0.85 ? 'mid' : 'no', 'Light out', 'Lumens leaving the diffuser. Click to go to Light &amp; dimming.', fmt(r.outLm, 0), 'lm', `target ≥ ${fmt(cfg.targetLm, 0)} lm`) +
      tile(3, !r.desk ? '' : r.desk.min >= cfg.targetLux ? 'ok' : r.desk.min >= cfg.targetLux * 0.85 ? 'mid' : 'no', 'Desk light (min)', 'Lowest illuminance over a ' + (cfg.taskD / 10) + ' cm circle, ' + (cfg.taskZ / 10) + ' cm below the diffuser (Notion target 500 lx, from EN 12464-1). Each diffuser patch is treated as a Lambertian source and the head as parallel to the desk. Click to go to Light and dimming.', r.desk ? fmt(r.desk.min, 0) : '—', 'lx', r.desk ? `target ≥ ${fmt(cfg.targetLux, 0)} · avg ${fmt(r.desk.avg, 0)} · ${cfg.roomLux ? `incl. ${fmt(cfg.roomLux, 0)} lx room light` : 'dark room (lamp only)'}` : '') +
      tile(4, !th ? '' : th.Tboard <= cfg.maxBoard ? 'ok' : th.Tboard <= cfg.maxBoard + 10 ? 'mid' : 'no', 'Board temperature (hottest)', 'Hottest point of the LED board from the full heat map: heat spreads through the metal-core board and leaves through the diffuser (Ben\'s network), the back cavity and the PLA bosses. Includes the LEDs and the on-board electronics (worst case 4.6 W). Click to go to Heat.', th ? fmt(th.Tboard, 1) : '—', '°C', th ? `${th.case} case · range ${fmt(thermRange.best.Tboard, 0)}–${fmt(thermRange.worst.Tboard, 0)} °C · LED chip ${fmt(th.TjMax, 0)} · limit ${fmt(cfg.maxBoard, 0)}` : '') +
      tile(1, r.P <= cfg.powerBudget * 1.001 ? 'ok' : r.P <= cfg.powerBudget * 1.2 ? 'mid' : 'no', 'LED power', 'Electrical power into the LEDs. Click to go to Head &amp; LEDs.', fmt(r.P, 2), 'W', `budget ${fmt(cfg.powerBudget, 1)} W · ${fmt(cfg.current, 1)} mA`) +
      `<div class="issues ${issues.length ? 'has' : ''}" data-tip="${issues.length ? issues.join(' · ') : 'No placement, wiring or supply problems found.'}">${issues.length ? `⚠ ${issues.length} issue${issues.length > 1 ? 's' : ''}` : '✓ No issues'}</div>`;
    $('driveKv').innerHTML = kv([
      [`Light per LED ${tip('Datasheet typical flux at 65 mA for the chosen colour temperature, scaled to this current and derated for the LED chip temperature.')}`, `${fmt(r.L.flux, 1)} lm <span class="hint">(${E.CCT[cfg.cct] ? cfg.cct + ' K' : 'custom'}, ${fmt(E.ledRef(cfg).flux, 1)} lm @ 65 mA${cfg.fluxCase === 'tol' ? ', −7%' : ''})</span>`],
      [`Strings ${tip('The board wires 5 LEDs in series per driver channel. The TLC59711 has 12 channels.')}`, `${d.strings} × ${cfg.perString} <span class="${d.channelsOk ? 'good' : 'bad'}">(${d.strings}/12 ch)</span>`],
      [`Supply headroom ${tip('VDD_LED minus the voltage 5 LEDs in series need. The driver needs about 0.4 V left over to regulate. Negative means the LEDs cannot reach full current.')}`, `<span class="${d.headOk ? 'good' : 'bad'}">${fmt(d.headroom, 2)} V</span>`],
    ]);
    $('layoutKv').innerHTML = kv([
      [`LED spacing ÷ gap ${tip('Average distance to the nearest LED divided by the LED-to-diffuser gap. Below about 1.0 the light spots merge; above about 1.2 you start to see hotspots.')}`, `<span class="${r.dh > 1.2 ? 'bad' : r.dh > 1 ? 'warn' : 'good'}">${fmt(r.dh, 2)}</span> (${fmt(r.nn, 1)} mm)`],
      [`Closest two LEDs ${tip('Smallest centre-to-centre distance in the layout.')}`, fmt(r.nnMin, 1) + ' mm'],
      [`LEDs breaking a limit ${tip('LEDs too close to a wall, the camera, a screw hole or another LED. Shown with a red outline.')}`, `<span class="${r.bad.size ? 'bad' : 'good'}">${r.bad.size}</span>`],
    ]);
    $('lightKv').innerHTML = kv([
      [`Brightness variation ${tip('How much brightness varies across the diffuser (standard deviation ÷ average). Below about 10% looks smooth.')}`, fmt(m.cv * 100, 1) + '%'],
      [`Dimmest 5% vs average ${tip('A gentler evenness measure that ignores the single darkest point.')}`, fmt(m.p5Avg * 100, 0) + '%'],
      [`Light reaching diffuser ${tip('Share of the LED light that lands on the lit aperture of the diffuser (the Head Front lip opening, from the STEP).')}`, fmt(m.util * 100, 0) + '%'],
      [`Diffuser brightness ${tip('Average luminance of the diffuser surface.')}`, fmt(r.lum, 0) + ' cd/m²'],
      [`Desk: min / avg / max ${tip('Over the desk circle set in step 1. Each diffuser patch treated as a Lambertian source, head parallel to the desk.')}`, r.desk ? `${fmt(r.desk.min, 0)} / ${fmt(r.desk.avg, 0)} / ${fmt(r.desk.max, 0)} lx` : '—'],
      [`Desk evenness ${tip('Darkest divided by average on the desk circle.')}`, r.desk ? fmt(r.desk.uniform * 100, 0) + '%' : '—'],
    ]);
    // where the light goes (every lumen)
    const B = r.budget, Lm = n0 => fmt(n0 * r.n * r.L.flux, n0 * r.n * r.L.flux < 10 ? 1 : 0) + ' lm';
    $('budgetKv').innerHTML = B ? kv([
      [`Out through the diffuser ${tip('Lands on the lit aperture and passes the diffuser (× transmission). This is the useful light.')}`, `<b>${fmt(B.out * 100, 1)}%</b> · ${Lm(B.out)}`],
      [`Absorbed or scattered back in the diffuser ${tip('Lands on the aperture but does not pass (1 − transmission). Most of it is absorbed in the diffuser or by the dark walls after scattering back.')}`, `${fmt(B.diffLoss * 100, 1)}% · ${Lm(B.diffLoss)}`],
      [`Hits walls, chamfer and lip ${tip('Misses the lit aperture: hits the drafted Head Front walls, the 43° chamfer or the lip (STEP). Opaque dark PLA, so treated as absorbed (heat).')}`, `${fmt(B.walls * 100, 1)}% · ${Lm(B.walls)}`],
      [`Hits the camera barrel ${tip('Lands on the barrel top or is blocked by the barrel on its way. Absorbed.')}`, `${fmt(B.camera * 100, 1)}% · ${Lm(B.camera)}`],
      [`<b>Escapes round the camera</b> ${tip('Lands in the open 1 mm ring between the Ø14 barrel and the Ø16 diffuser hole (STEP) and leaves the head directly, undiffused: seen as a bright ring or glare around the lens.')}`, `<span class="warn">${fmt(B.annulus * 100, 2)}% · ${Lm(B.annulus)}</span>`],
      [`Other openings ${tip('Board windows, edge gap and screw holes: no straight line of sight from any LED (STEP). Seams sealed and shell opaque (your answers). The diffuser edge glows faintly through the 1 mm groove (light piped inside the diffuser, not modelled).')}`, '0 (sealed, opaque)'],
    ]) : '';
    if (th) $('thermKv').innerHTML = kv([
      [`Heat in the head ${tip('LEDs: k_h × electrical power (Hui & Qin 2009). Electronics: your worst-case figure from the 24 V input (SoC, XVF3800, camera, mics and DC/DC losses).')}`, `${fmt(th.map.Q.total, 2)} W (LEDs ${fmt(th.map.Q.led, 2)} + electronics ${fmt(th.map.Q.elec, 2)})`],
      [`Board: hottest / coolest ${tip('From the 2-D map. A metal-core board spreads heat so well that it is nearly one temperature.')}`, `${fmt(th.map.Tmax, 1)} / ${fmt(th.map.Tmin, 1)} °C`],
      [`Hottest LED chip ${tip('Board under the LED + heat × (R_jc 5 K/W [Cree] + dielectric under the pad, assumed 0.1 mm, k 2).')}`, fmt(th.map.TjMax, 1) + ' °C (limit 125)'],
      [`Heat leaves via ${tip('Front: through the air gap and diffuser (Ben). Back: across the back cavity to Head Back and out. Mounts: through the PLA screw bosses.')}`, `front ${fmt(th.map.Q.front, 2)} · back ${fmt(th.map.Q.back, 2)} · bosses ${fmt(th.map.Q.mounts, 2)} W`],
      [`Diffuser outside (hottest) ${tip('Outer surface of the diffuser, the part people can touch.')}`, fmt(th.map.TdOutMax, 1) + ' °C'],
      [`PLA bosses / Head Back inside ${tip('PLA softens near 55–60 °C (glass transition). The bosses touch the board directly.')}`, `<span class="${th.map.Tboss > cfg.plaMax ? 'bad' : 'good'}">${fmt(th.map.Tboss, 1)}</span> / <span class="${th.map.TshellIn > cfg.plaMax ? 'bad' : 'good'}">${fmt(th.map.TshellIn, 1)}</span> °C`],
    ]);
    if (th) $('benKv').innerHTML = kv([
      [`Ben's network: board ${tip('Ben\'s published method, unchanged: LED heat only, front path only, one board temperature. The map above reduces to exactly this when the back path, the electronics and the board conduction limit are switched off (check 20).')}`, fmt(th.ben.Tboard, 1) + ' °C'],
      [`Heat (LEDs, front)`, `${fmt(th.ben.Q, 2)} W`],
      [`Gap: air + radiation ${tip('R_conv = L/(k_air·A·Nu) in parallel with radiation, as in Ben\'s calc.')}`, `${fmt(th.Rint, 2)} K/W`],
      [`Through the diffuser ${tip('R_PC = t/(k·A)')}`, `${fmt(th.Rpc, 2)} K/W`],
      [`Diffuser to room ${tip('Outside convection 1/(h·A) in parallel with radiation.')}`, `${fmt(th.Rext, 2)} K/W`],
      [`Total ${tip('Series sum. Board temperature = room + heat × total.')}`, `${fmt(th.Rtotal, 2)} K/W`],
      [`Rayleigh number in the gap ${tip('Ben\'s check: above 1708 the air in the gap circulates (convection); below it only conducts.')}`, `${fmt(th.Ra, 0)} ${th.Ra > 1708 ? '(convection)' : '(conduction only)'}`],
    ]);
    $('violations').innerHTML = r.bad.size ? `<b class="bad">${r.bad.size} LED(s) break a limit</b>` : '';
    $('undo').disabled = !undoStack.length; $('redo').disabled = !redoStack.length;
    selPanel(); if (step === 5 && $('comparePanel').style.display !== 'none') snapsPanel();
  }
  function selPanel() {
    const ok = selected >= 0 && leds[selected];
    $('selName').textContent = ok ? `LED ${selected + 1} · string ${(strings[selected] || 0) + 1}` : 'none';
    if (ok) {
      const p = leds[selected], d = leds.map((q, j) => ({ j, d: j === selected ? Infinity : Math.hypot(q.x - p.x, q.y - p.y) })).sort((a, b) => a.d - b.d).slice(0, 3);
      const xs = geo.poly.map(v => v[0]), ys = geo.poly.map(v => v[1]);
      $('selDist').textContent = `· nearest ${d.map(o => `LED ${o.j + 1}: ${fmt(o.d, 1)}`).join(', ')} mm · from left edge ${fmt(p.x - Math.min(...xs), 1)}, from bottom edge ${fmt(p.y - Math.min(...ys), 1)} mm`;
    } else $('selDist').textContent = '';
    $('selX').disabled = $('selY').disabled = !ok;
    if (ok && document.activeElement !== $('selX')) $('selX').value = leds[selected].x.toFixed(2);
    if (ok && document.activeElement !== $('selY')) $('selY').value = leds[selected].y.toFixed(2);
  }
  function snapSummary() { return { minAvg: res.m.minAvg, cv: res.m.cv, outLm: res.outLm, Tmax: therm ? therm.Tmax : NaN, P: res.P, util: res.m.util }; }
  function snapDesc(c) {
    return `${c.count} LEDs · ${c.gap} mm gap · ${c.current} mA · ${E.CCT[c.cct] ? c.cct + ' K' : 'custom LED'}${c.fluxCase === 'tol' ? ' (−7%)' : ''} · lens at (${(+c.keep.x).toFixed(1)}, ${(+c.keep.y).toFixed(1)})`;
  }
  const esc = t => String(t).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  function snapsPanel() {
    if (v3on) v3pickPanel(); // keep the 3D compare list in step with the snapshots
    const cur = { name: 'Current design (unsaved)', desc: snapDesc(cfg), sum: snapSummary(), current: true };
    const all = [cur, ...snapshots];
    const rows = [['Evenness', 'minAvg', v => fmt(v * 100, 0) + '%', 1], ['Variation', 'cv', v => fmt(v * 100, 1) + '%', -1], ['Light out', 'outLm', v => fmt(v, 0) + ' lm', 1], ['Hottest', 'Tmax', v => fmt(v, 1) + ' °C', -1], ['Power', 'P', v => fmt(v, 2) + ' W', -1]];
    const best = {};
    if (all.length > 1) for (const [, k, , dir] of rows) { const vals = all.map(s => s.sum[k]).filter(Number.isFinite); if (vals.length) best[k] = dir > 0 ? Math.max(...vals) : Math.min(...vals); }
    $('snaps').innerHTML = all.map((s, i) => `<div class="snap ${s.current ? 'current' : ''}">
      ${s.current ? '<div class="noimg">What you are editing now</div>' : s.thumb ? `<img src="${s.thumb}" alt="${esc(s.name)} diffuser map">` : '<div class="noimg">no preview</div>'}
      <div class="body"><div class="name">${esc(s.name)}</div><div class="desc">${esc(s.desc || '')}</div>
      <div class="m">${rows.map(([lab, k, f]) => `<span>${lab}</span><span class="${Number.isFinite(s.sum[k]) && s.sum[k] === best[k] ? 'best' : ''}">${f(s.sum[k])}</span>`).join('')}</div>
      ${s.current ? '' : `<div class="acts"><button data-load="${i - 1}">↺ Restore</button><button data-del="${i - 1}">✕ Delete</button></div>`}</div></div>`).join('') +
      (snapshots.length ? '' : '<p class="hint" style="grid-column:1/-1">No snapshots yet. Save one on the left (e.g. "Baseline"), change something, and save again to compare.</p>');
  }
  function thumbnail() {
    const ov = $('overlay').value; $('overlay').value = 'diffuser'; draw();
    const t = document.createElement('canvas'); t.width = 320; t.height = Math.round(320 * cv.height / cv.width);
    t.getContext('2d').drawImage(cv, 0, 0, t.width, t.height);
    $('overlay').value = ov; draw();
    try { return t.toDataURL('image/jpeg', 0.75); } catch (e) { return null; }
  }

  // ------------------------------------------------------------ inputs
  function syncInputs(only) {
    document.querySelectorAll('[data-k]').forEach(el => {
      const k = el.dataset.k; if (only && !only.includes(k)) return;
      const v = getPath(cfg, k);
      if (el.type === 'checkbox') el.checked = !!v; else el.value = v;
    });
    $('curLbl').textContent = `${fmt(cfg.current, 1)} mA`;
    for (const k of ['cv', 'min']) $('w_' + k).value = cfg.w[k];
    $('customCase').style.display = cfg.thermalCase === 'custom' ? '' : 'none';
    syncCam();
  }
  function syncCam() {
    const K = cfg.keep, set = (id, v) => { if (document.activeElement !== $(id)) $(id).value = +v.toFixed(2); };
    set('camCx', K.x); set('camCy', K.y); set('camD', 2 * K.r);
  }
  ['camCx', 'camCy', 'camD'].forEach(id => $(id).addEventListener('change', () => {
    const x = Number($('camCx').value), y = Number($('camCy').value), d = Number($('camD').value);
    if (![x, y, d].every(Number.isFinite) || d <= 0) return;
    pushUndo(); applyCam({ x, y, r: d / 2, holeR: d / 2 + 1 }); field.setAll(leds, wts()); computeThermal(true); refresh(); persist();   // STEP: 1 mm open ring round the barrel
    if (res.bad.size) toast(`${res.bad.size} LED(s) now overlap the camera clearance (red). Run ✨ Optimize to re-place them.`, 6000);
  }));
  $('camReset').onclick = () => { const d = E.defaults().keep; pushUndo(); applyCam({ x: d.x, y: d.y, r: d.r }); field.setAll(leds, wts()); computeThermal(true); refresh(); persist(); };
  function onCfg(k, raw, el) {
    let v = el.type === 'checkbox' ? el.checked : (el.tagName === 'SELECT' && !/^\-?\d/.test(raw)) ? raw : Number(raw);
    if (typeof v === 'number' && !Number.isFinite(v)) return;
    if (k === 'count') { changeCount(Math.max(1, Math.round(v))); return; }
    setPath(cfg, k, v);
    if (k === 'current') $('curLbl').textContent = `${fmt(cfg.current, 1)} mA`;
    if (k === 'perString' || k === 'stringMode') { ensureStrings(true); field.setAll(leds, wts()); computeThermal(true); refresh(); dutyPanel(); $('showStrings').checked = true; draw(); persist(); return; }
    if (k === 'minDuty' || k === 'dimJoint' || k === 'deskLimit') { persist(); return; }
    if (k === 'thermalCase') $('customCase').style.display = v === 'custom' ? '' : 'none';
    if (k.startsWith('keep.')) {
      applyCam({}); field.setAll(leds, wts()); computeThermal(true); refresh(); persist();
      if (k === 'keep.zone' && res.bad.size) toast(`${res.bad.size} LED(s) are now inside the keepout (red). Run ✨ Optimize or Randomize to re-place them.`, 6000);
      return;
    }
    if (['targetLm', 'targetUniformPct', 'maxBoard', 'powerBudget', 'targetLux'].includes(k)) { panels(); persist(); return; }
    if (k === 'roomLux') { refresh(); persist(); return; }
    if (GEO_KEYS.test(k)) { status('Rebuilding geometry…'); setTimeout(() => { rebuild(); resize(); persist(); }, 10); return; }
    computeThermal(true); refresh(); persist();
  }
  // lowest current that meets the light-out and desk targets (restored current sweep)
  $('sweepI').onclick = () => {
    if (!leds.length || !res.L.flux) return;
    const o = { weights: wts(), lmPerFlux: res.outLm / res.L.flux, luxPerFlux: res.desk ? (res.desk.min - (cfg.roomLux || 0)) / res.L.flux : 0 }; // lamp-only part; the engine adds room light
    const s = E.sweepCurrent(cfg, geo.area, leds, o), b = s.best;
    const line = q => `${fmt(q.I, 1)} mA → ${fmt(q.lm, 0)} lm, desk min ${fmt(q.lux, 0)} lx, ${fmt(q.P, 2)} W, board ${fmt(q.Tboard, 0)} °C (${cfg.thermalCase} case)`;
    if (b) { $('sweepOut').innerHTML = `Lowest: ${line(b)} <button id="sweepApply">Use ${fmt(b.I, 1)} mA</button>`; $('sweepApply').onclick = () => { cfg.current = b.I; syncInputs(['current']); computeThermal(true); refresh(); persist(); }; }
    else $('sweepOut').innerHTML = `<span class="bad">No current up to ${fmt(s.tlcMax, 1)} mA (driver limit) meets both targets with this layout.</span> At the limit: ${line(s.rows[s.rows.length - 1])}`;
  };
  function changeCount(N) {
    let next = copyLeds(leds);
    if (N > next.length) next = E.fillBestCandidate(cfg, placer, next, N, E.rng(Date.now() & 0xffff));
    else next = next.slice(0, N);
    if (next.length < N) toast(`Only ${next.length} LEDs fit with the current pitch/margins.`);
    setLeds(next);
  }
  document.querySelectorAll('[data-k]').forEach(el => {
    const evt = el.type === 'range' ? 'input' : 'change';
    el.addEventListener(evt, () => onCfg(el.dataset.k, el.value, el));
    if (el.type === 'range') el.addEventListener('change', () => { computeThermal(true); refresh(); persist(); });
  });
  for (const k of ['cv', 'min']) $('w_' + k).addEventListener('input', e => { cfg.w[k] = Number(e.target.value); persist(); });
  document.querySelectorAll('[data-gap]').forEach(b => b.onclick = () => { cfg.gap = Number(b.dataset.gap); syncInputs(['gap']); rebuild(); persist(); });
  ['overlay', 'scale', 'showStrings', 'showLabels', 'showSpacing'].forEach(id => $(id).addEventListener('change', draw));
  document.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => setTool(b.dataset.tool));
  function setTool(t) { tool = t; document.querySelectorAll('[data-tool]').forEach(x => x.classList.toggle('on', x.dataset.tool === t)); cv.style.cursor = t === 'move' ? 'crosshair' : t === 'add' ? 'copy' : 'not-allowed'; }
  ['selX', 'selY'].forEach(id => $(id).addEventListener('change', () => {
    if (selected < 0) return; pushUndo();
    const x = Number($('selX').value), y = Number($('selY').value);
    leds[selected] = { ...leds[selected], x, y }; field.update(selected, x, y); computeThermal(true); refresh(); persist();
  }));

  // ------------------------------------------------------------ strings & dimming
  let hlString = -1;
  function dutyPanel() {
    if (!field) return;
    const nS = nStrings(), cnt = new Array(nS).fill(0); leds.forEach(p => { if (p.s < nS) cnt[p.s]++; });
    const list = $('dutyList');
    if (list.childElementCount !== nS) {
      list.innerHTML = Array.from({ length: nS }, (_, q) => `<label data-s="${q}"><span><i style="background:${HUES[q % HUES.length]}"></i>S${q + 1}</span><input type="range" min="0" max="1" step="0.01" data-duty="${q}"><b></b></label>`).join('');
    }
    list.querySelectorAll('label').forEach((lab, q) => {
      const inp = lab.querySelector('input'), d = cfg.duty[q] == null ? 1 : cfg.duty[q];
      if (document.activeElement !== inp) inp.value = d;
      lab.querySelector('b').textContent = Math.round(d * 100) + '%';
      lab.title = `String ${q + 1}: ${cnt[q]} LEDs · ${fmt(cfg.current * d, 1)} mA average`;
    });
    const kept = res ? res.kept : 1;
    $('dutyInfo').innerHTML = `${nS} strings (${nS <= 12 ? 'fits' : '<b class="bad">exceeds</b>'} the 12 TLC59711 channels) · light kept <b>${fmt(kept * 100, 0)}%</b>${cnt.some(c => c !== cfg.perString) ? ' · <b class="warn">uneven strings</b>' : ''}`;
  }
  $('dutyList').addEventListener('input', e => {
    const q = e.target.dataset.duty; if (q == null) return;
    cfg.duty[Number(q)] = Number(e.target.value); applyWeights(false); dutyPanel();
  });
  $('dutyList').addEventListener('change', e => { if (e.target.dataset.duty != null) { applyWeights(true); dutyPanel(); } });
  $('dutyList').addEventListener('pointerover', e => { const l = e.target.closest('label[data-s]'); const q = l ? Number(l.dataset.s) : -1; if (q !== hlString) { hlString = q; draw(); } });
  $('dutyList').addEventListener('pointerleave', () => { hlString = -1; draw(); });
  $('dutyReset').onclick = () => { cfg.duty = cfg.duty.map(() => 1); applyWeights(true); dutyPanel(); };
  $('reassign').onclick = () => { ensureStrings(true); field.setAll(leds, wts()); computeThermal(true); refresh(); dutyPanel(); $('showStrings').checked = true; draw(); persist(); status(`Strings re-assigned (${cfg.stringMode})`); };
  $('balance').onclick = () => {
    const t = performance.now(), nS = nStrings();
    const r = E.balanceStrings(geo, cfg, field, leds.map(p => p.s), nS, { minDuty: cfg.minDuty, desk: cfg.deskLimit ? { target: cfg.targetLux, scale: res.L.flux * cfg.tau } : null });
    cfg.duty = r.w; applyWeights(true); dutyPanel(); $('showStrings').checked = true; draw();
    toast(`Auto-balance (${Math.round(performance.now() - t)} ms): min/avg ${fmt(r.before.minAvg * 100, 0)}→${fmt(r.after.minAvg * 100, 0)}%, CV ${fmt(r.before.cv * 100, 1)}→${fmt(r.after.cv * 100, 1)}%, light kept ${fmt(r.after.kept * 100, 0)}%. "All 100%" resets.`, 9000);
  };

  // ------------------------------------------------------------ generators
  function nextSeed() { if ($('autoSeed').checked) $('seed').value = Math.floor(Math.random() * 1e6); return Number($('seed').value) || 1; }
  $('randomize').onclick = () => {
    const seed = nextSeed(), N = cfg.count, t = performance.now();
    const pts = $('randMode').value === 'poisson' ? E.poisson(cfg, placer, N, seed) : E.uniformRandom(cfg, placer, N, seed);
    setLeds(pts); status(`Randomized (${$('randMode').value}, seed ${seed}) in ${Math.round(performance.now() - t)} ms`);
  };
  $('hex').onclick = () => { const pts = E.hex(cfg, placer, cfg.count); if (pts.length < cfg.count) toast('Hex lattice could not fit all LEDs at minimum pitch.'); setLeds(pts); status('Hexagonal fit'); };
  $('cvt').onclick = () => { const t = performance.now(); setLeds(E.cvt(cfg, placer, leds, 30)); status(`Lloyd/CVT relaxation (30 it) in ${Math.round(performance.now() - t)} ms`); };
  $('jitter').onclick = () => {
    const r = E.rng(nextSeed()), next = copyLeds(leds);
    next.forEach((p, i) => { for (let t = 0; t < 6; t++) { const x = p.x + (r() - 0.5) * 2, y = p.y + (r() - 0.5) * 2; if (placer.okRegion(x, y) && placer.okPitch(next, i, x, y)) { next[i] = { x, y }; break; } } });
    setLeds(next);
  };

  // ------------------------------------------------------------ optimizer worker
  function makeWorker() {
    const src = `const ENG=(${HeadLEDEngine.toString()})();
onmessage=e=>{const d=e.data;let last=0;
const prog=p=>{const t=Date.now();if(t-last<150&&p.phase==='anneal')return;last=t;postMessage({type:'progress',p:{phase:p.phase,it:p.it,iters:p.iters,J:p.J,best:p.best,m:p.m,pts:p.pts,start:p.start,starts:p.starts,step:p.step,T:p.T,sig:p.sig,acc:p.acc,desk:p.desk,duty:p.duty,groups:p.groups,dimTried:p.dimTried,dimKept:p.dimKept}});};
try{const r=d.cmd==='auto'?ENG.autoDesign(d.cfg,d.n,d.opt,prog):ENG.optimize(d.cfg,d.leds,d.opt,prog);postMessage({type:'done',r});}
catch(err){postMessage({type:'error',msg:String(err&&err.stack||err)});}};`;
    return new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
  }
  let lastPreview = 0, hist = [], runInfo = null;
  function drawChart() {
    const c = $('optChart'), g = c.getContext('2d'), d = window.devicePixelRatio || 1, W = c.clientWidth, H = c.clientHeight;
    if (!W) return;
    c.width = W * d; c.height = H * d; g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, W, H);
    const css = getComputedStyle(document.documentElement), ink = css.getPropertyValue('--muted') || '#888', line = css.getPropertyValue('--line') || '#ddd';
    const L = 30, R = 34, T = 6, B = 16, pw = W - L - R, ph = H - T - B;
    g.strokeStyle = line; g.lineWidth = 1; g.font = '10px system-ui'; g.fillStyle = ink;
    for (const v of [0, 50, 100]) { const y = T + ph * (1 - v / 100); g.beginPath(); g.moveTo(L, y); g.lineTo(L + pw, y); g.stroke(); g.textAlign = 'right'; g.fillText(v + '%', L - 4, y + 3); }
    if (!hist.length) return;
    const xmax = Math.max(1, runInfo ? runInfo.total : hist[hist.length - 1].x), cvMax = Math.max(0.05, ...hist.map(h => h.cv)) * 1.1;
    g.textAlign = 'left'; g.fillText((cvMax * 100).toFixed(0) + '%', L + pw + 4, T + 8); g.fillText('0%', L + pw + 4, T + ph);
    if (runInfo && runInfo.starts > 1) { g.strokeStyle = line; g.setLineDash([2, 3]); for (let k = 1; k < runInfo.starts; k++) { const x = L + pw * k / runInfo.starts; g.beginPath(); g.moveTo(x, T); g.lineTo(x, T + ph); g.stroke(); } g.setLineDash([]); }
    const plot = (f, col) => { g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); hist.forEach((h, i) => { const x = L + pw * h.x / xmax, y = T + ph * (1 - f(h)); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); };
    plot(h => h.even, '#ff8a3d'); plot(h => h.cv / cvMax, '#4dabf7');
    g.fillStyle = ink; g.textAlign = 'center'; g.fillText('iterations →', L + pw / 2, H - 3);
  }
  window.addEventListener('resize', drawChart);
  function runOpt(cmd) {
    if (worker) return;
    const startM = res.m, startJ = E.objective(cfg, startM, 0);
    optStartLeds = snapLayout();
    worker = makeWorker(); setBusy(true);
    const nStarts = cmd === 'auto' ? Number($('starts').value) : 1, itersN = Number($('iters').value);
    hist = [{ x: 0, even: startM.minAvg, cv: startM.cv }]; runInfo = { total: nStarts * itersN, starts: nStarts };
    $('optTitle').textContent = cmd === 'auto' ? `Finding best of ${nStarts} fresh starts` : 'Improving this layout'; drawChart();
    const t0 = performance.now();
    worker.onmessage = e => {
      const d = e.data;
      if (d.type === 'progress') {
        const p = d.p, starts = p.starts || 1, k = p.start || 0;
        const frac = p.phase === 'anneal' ? (k + 0.85 * p.it / p.iters) / starts : (k + 0.9) / starts;
        $('progbar').style.width = Math.round(frac * 100) + '%';
        status(`${cmd === 'auto' ? `Start ${k + 1}/${starts} · ` : ''}${p.phase === 'anneal' ? 'annealing' : 'polishing'} · evenness ${fmt(p.m.minAvg * 100, 0)}% · variation ${fmt(p.m.cv * 100, 1)}%`);
        const gx = k * p.iters + (p.it || 0);
        if (!hist.length || gx > hist[hist.length - 1].x || p.phase === 'polish') hist.push({ x: gx, even: p.m.minAvg, cv: p.m.cv });
        $('optStats').innerHTML = p.phase === 'anneal'
          ? `<b>Annealing</b>: tries random moves, sometimes keeping worse ones early on so it doesn't get stuck. Temperature ${fmt(p.T * 100, 0)}% · step size ${fmt(p.sig, 1)} mm · ${fmt(p.acc * 100, 0)}% of moves kept${p.desk != null ? ` · desk min ${fmt(p.desk, 0)} lx` : ''}${p.dimTried ? ` · dimming: ${p.dimKept}/${p.dimTried} duty changes kept` : ''}`
          : `<b>Polishing</b>: nudges each LED ${fmt(p.step, 2)} mm in 8 directions and keeps only improvements.`;
        drawChart();
        const now = performance.now();
        if (p.pts && now - lastPreview > 200) {
          lastPreview = now;
          leds = copyLeds(p.pts); if (cfg.dimJoint && p.duty && p.groups) { leds.forEach((q, i) => { q.s = p.groups[i]; }); cfg.duty = p.duty.slice(); } ensureStrings(false); field.setAll(leds, wts()); refresh(true);
        }
      } else if (d.type === 'done') {
        finishOpt(); undoStack.push(optStartLeds); redoStack.length = 0;
        leds = copyLeds(d.r.pts); cfg.count = leds.length;
        if (cfg.dimJoint && d.r.duty && d.r.groups) { leds.forEach((q, i) => { q.s = d.r.groups[i]; }); cfg.duty = d.r.duty.slice(); } else ensureStrings(cmd === 'auto'); field.setAll(leds, wts()); computeThermal(true); refresh(); dutyPanel(); persist();
        hist.push({ x: runInfo.total, even: res.m.minAvg, cv: res.m.cv }); drawChart();
        if (cfg.deskLimit && d.r.deskOk === false) toast(`Could not reach ${fmt(cfg.targetLux, 0)} lx on the desk at ${fmt(cfg.current, 1)} mA (best ${fmt(d.r.deskMin, 0)} lx). Raise the current or LED count, or untick the desk limit.`, 10000);
        $('optStats').innerHTML = `<b>Done</b>: evenness ${fmt(startM.minAvg * 100, 0)}% → <b>${fmt(res.m.minAvg * 100, 0)}%</b>, variation ${fmt(startM.cv * 100, 1)}% → <b>${fmt(res.m.cv * 100, 1)}%</b>, light ${fmt(startM.util * 100, 0)}% → ${fmt(res.m.util * 100, 0)}% reaching the diffuser${res.desk ? `, desk min ${fmt(res.desk.min, 0)} lx` : ''}.`;
        const m = res.m;
        toast(`Done in ${fmt((performance.now() - t0) / 1000, 1)} s: min/avg ${fmt(startM.minAvg * 100, 0)}→${fmt(m.minAvg * 100, 0)}%, CV ${fmt(startM.cv * 100, 1)}→${fmt(m.cv * 100, 1)}%, light ${fmt(startM.util * 100, 0)}→${fmt(m.util * 100, 0)}% utilised. Ctrl+Z to revert.`, 9000);
        status('Optimization finished');
      } else if (d.type === 'error') { finishOpt(); toast('Optimizer error: ' + d.msg, 9000); console.error(d.msg); }
    };
    worker.postMessage({ cmd, cfg, leds, n: cfg.count, opt: { iters: itersN, starts: nStarts, seed: nextSeed(), weights: cmd === 'auto' ? null : wts(), deskLimit: !!cfg.deskLimit, flux: res.L.flux, dimming: !!cfg.dimJoint, minDuty: cfg.minDuty, groups: cmd === 'auto' ? null : leds.map(p => p.s), regroup: cfg.dimJoint ? { per: cfg.perString, mode: cfg.stringMode } : null } });
    void startJ;
  }
  function finishOpt() { if (worker) worker.terminate(); worker = null; setBusy(false); $('progbar').style.width = '0'; }
  function setBusy(b) { ['optimize', 'auto', 'randomize', 'hex', 'cvt', 'jitter'].forEach(id => $(id).disabled = b); $('stop').disabled = !b; }
  $('optimize').onclick = () => runOpt('optimize');
  $('auto').onclick = () => runOpt('auto');
  $('stop').onclick = () => { finishOpt(); undoStack.push(optStartLeds); field.setAll(leds, wts()); computeThermal(true); refresh(); persist(); status('Stopped. Kept the best layout found so far (Ctrl+Z reverts).'); };

  // ------------------------------------------------------------ canvas interaction
  let pending = null, raf = 0;
  function hit(px, py) { const x = wx(px), y = wy(py), tol = Math.max(3, 12 * dpr / T.s); let bi = -1, bd = tol; leds.forEach((p, i) => { const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; bi = i; } }); return bi; }
  cv.addEventListener('pointerdown', e => {
    if (worker) return;
    cv.focus();
    const r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top, x = wx(px), y = wy(py), i = hit(px, py);
    if (tool === 'add') {
      if (!placer.okRegion(x, y) || !placer.okPitch(leds, -1, x, y)) { toast('Outside the placeable area or too close to another LED.'); return; }
      pushUndo(); leds.push({ x, y }); cfg.count = leds.length; ensureStrings(true); field.setAll(leds, wts()); selected = leds.length - 1; syncInputs(['count']); dutyPanel();
      computeThermal(true); refresh(); persist(); return;
    }
    if (tool === 'remove') { if (i >= 0) { pushUndo(); leds.splice(i, 1); selected = -1; cfg.count = leds.length; ensureStrings(true); field.setAll(leds, wts()); syncInputs(['count']); computeThermal(true); refresh(); dutyPanel(); persist(); } return; }
    selected = i;
    if (i >= 0) { pushUndo(); drag = { i, dx: leds[i].x - x, dy: leds[i].y - y, moved: false }; try { cv.setPointerCapture(e.pointerId); } catch (err) { /* pointer already released */ } }
    else if (cfg.keep.on && Math.hypot(x - cfg.keep.x, y - cfg.keep.y) <= cfg.keep.r + Math.max(1, 6 * dpr / T.s)) {
      camDrag = { k: { ...cfg.keep }, ox: x, oy: y, moved: false }; try { cv.setPointerCapture(e.pointerId); } catch (err) { /* pointer already released */ } status('Moving the camera: release to re-simulate');
    }
    refresh();
  });
  // drag the camera block: preview while moving, rebuild the optics on release
  function moveCam(x, y) {
    const K0 = cfg.keep, dx = x - camDrag.ox, dy = y - camDrag.oy;
    camDrag.k = { ...K0, x: K0.x + dx, y: K0.y + dy };
    camDrag.moved = Math.hypot(dx, dy) > 0.2; draw();
  }
  function endCamDrag() {
    const c = camDrag; camDrag = null; if (!c.moved) { draw(); return; }
    pushUndo(); applyCam(c.k); status('Re-simulating with the new camera position…');
    setTimeout(() => {
      field.setAll(leds, wts()); computeThermal(true); refresh(); persist();
      const n = res.bad.size; if (n) toast(`${n} LED(s) now overlap the camera or its clearance (red). Run ✨ Optimize to re-place them around it.`, 7000);
    }, 10);
  }
  cv.addEventListener('pointermove', e => {
    const r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
    $('cursor').textContent = `x ${fmt(wx(px), 1)}, y ${fmt(wy(py), 1)} mm`;
    if (camDrag) { moveCam(wx(px), wy(py)); return; }
    if (!drag) return;
    pending = { x: wx(px) + drag.dx, y: wy(py) + drag.dy };
    if (!raf) raf = requestAnimationFrame(applyDrag);
  });
  function applyDrag() {
    raf = 0; if (!drag || !pending) return;
    const i = drag.i, sn = Number($('snap').value) || 0;
    let x = pending.x, y = pending.y;
    if (sn > 0) { x = Math.round(x / sn) * sn; y = Math.round(y / sn) * sn; }
    if ($('keepValid').checked && !(placer.okRegion(x, y) && placer.okPitch(leds, i, x, y))) {
      // slide: binary search along the segment from the current (valid) position toward the target
      const a = leds[i]; if (!(placer.okRegion(a.x, a.y) && placer.okPitch(leds, i, a.x, a.y))) { /* start invalid: follow freely */ }
      else { let lo = 0, hi = 1; for (let k = 0; k < 10; k++) { const t = (lo + hi) / 2, tx = a.x + (x - a.x) * t, ty = a.y + (y - a.y) * t; if (placer.okRegion(tx, ty) && placer.okPitch(leds, i, tx, ty)) lo = t; else hi = t; } x = a.x + (x - a.x) * lo; y = a.y + (y - a.y) * lo; }
    }
    if (Math.abs(x - leds[i].x) < 1e-9 && Math.abs(y - leds[i].y) < 1e-9) return;
    drag.moved = true;
    leds[i] = { ...leds[i], x, y }; field.update(i, x, y);
    computeThermal(false); refresh(true);
  }
  function endDrag() {
    if (camDrag) { endCamDrag(); return; }
    if (!drag) return;
    if (!drag.moved) undoStack.pop();
    drag = null; pending = null;
    setTimeout(() => { computeThermal(true); refresh(); persist(); }, 0);
  }
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', endDrag);
  cv.addEventListener('keydown', e => {
    if (selected < 0) return;
    const st = e.shiftKey ? 2 : 0.5, mv = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, st], ArrowDown: [0, -st] }[e.key];
    if (mv) { e.preventDefault(); pushUndo(); const p = leds[selected], x = p.x + mv[0], y = p.y + mv[1]; leds[selected] = { ...p, x, y }; field.update(selected, x, y); computeThermal(false); refresh(true); clearTimeout(cv.kt); cv.kt = setTimeout(() => { computeThermal(true); refresh(); persist(); }, 250); }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); pushUndo(); leds.splice(selected, 1); selected = -1; cfg.count = leds.length; ensureStrings(true); field.setAll(leds, wts()); syncInputs(['count']); computeThermal(true); refresh(); dutyPanel(); persist(); }
  });
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
    else if (!e.ctrlKey && !e.metaKey) { if (e.key === 'v') setTool('move'); if (e.key === 'a') setTool('add'); if (e.key === 'x') setTool('remove'); }
  });
  $('undo').onclick = undo; $('redo').onclick = redo;

  // ------------------------------------------------------------ snapshots
  $('snapSave').onclick = () => {
    const name = $('snapName').value.trim() || `Snapshot ${snapshots.length + 1}`;
    const wasCompare = $('comparePanel').style.display !== 'none';
    if (wasCompare) showCompare(false);
    snapshots.push({ name, desc: snapDesc(cfg), cfg: E.clone(cfg), leds: copyLeds(leds), sum: snapSummary(), thumb: thumbnail() });
    $('snapName').value = ''; showCompare(true); persist(); toast(`Saved “${name}”`);
  };
  $('snaps').addEventListener('click', e => {
    const l = e.target.dataset.load, d = e.target.dataset.del;
    if (l != null) { const s = snapshots[Number(l)]; pushUndo(); cfg = merge(E.defaults(), migrate(E.clone(s.cfg))); leds = copyLeds(s.leds); syncInputs(); showCompare(false); rebuild(); resize(); dutyPanel(); persist(); toast(`Restored “${s.name}”`); }
    if (d != null) { snapshots.splice(Number(d), 1); snapsPanel(); persist(); }
  });

  // ------------------------------------------------------------ file I/O
  $('saveJson').onclick = () => download('head-led-design.json', JSON.stringify({ app: 'head-led-placement-studio', version: 1, saved: new Date().toISOString(), cfg, leds, strings, snapshots }, null, 2), 'application/json');
  $('saveCsv').onclick = () => {
    const rows = ['id,string,duty,x_mm,y_mm,x_from_left_edge_mm,y_from_bottom_edge_mm,nearest_led,nearest_mm,x_dxf_drawn,y_dxf_drawn'], w = wts();
    const xs = geo.poly.map(v => v[0]), ys = geo.poly.map(v => v[1]), x0 = Math.min(...xs), y0 = Math.min(...ys);
    leds.forEach((p, i) => {
      const q = E.toDxfDrawn(p); let nj = -1, nd = Infinity; leds.forEach((o, j) => { const dd = Math.hypot(o.x - p.x, o.y - p.y); if (j !== i && dd < nd) { nd = dd; nj = j; } });
      rows.push([i + 1, (strings[i] || 0) + 1, w[i].toFixed(3), p.x.toFixed(3), p.y.toFixed(3), (p.x - x0).toFixed(2), (p.y - y0).toFixed(2), nj + 1, nd.toFixed(2), q.x.toFixed(3), q.y.toFixed(3)].join(','));
    });
    download('head-led-positions.csv', rows.join('\n'), 'text/csv');
  };
  $('saveDxf').onclick = () => download('head-led-positions.dxf', E.dxfExport(cfg, leds, strings, $('dxfSpacing').checked), 'application/dxf');
  $('saveSpacing').onclick = () => {
    const rows = ['led_a,led_b,distance_mm'];
    for (const q of E.neighbours(leds).pairs) rows.push([q.a + 1, q.b + 1, q.d.toFixed(2)].join(','));
    download('head-led-spacing.csv', rows.join('\n'), 'text/csv');
  };
  $('newDesign').onclick = () => {
    if (!confirm('Start a new design? The current layout and all snapshots will be cleared. Use Save first if you want to keep them.')) return;
    if (worker) finishOpt();
    cfg = E.defaults(); snapshots = []; undoStack.length = 0; redoStack.length = 0; selected = -1; hist = []; runInfo = null;
    geo = E.buildGeo(cfg, cfg.res); placer = E.buildPlacer(cfg); leds = E.hex(cfg, placer, cfg.count); ensureStrings(true);
    syncInputs(); rebuild(); resize(); dutyPanel(); drawChart(); $('optStats').textContent = 'Runs in the background, so you can watch it work. Ctrl+Z undoes it.';
    setStep(1); persist(); toast('New design: default head, 60 LEDs on a hex grid.');
  };
  $('open').onclick = () => $('file').click();
  $('file').onchange = async e => {
    const f = e.target.files[0]; if (!f) return; const text = await f.text(); e.target.value = '';
    try {
      if (/^\s*[{[]/.test(text)) {
        const j = JSON.parse(text);
        if (j.cfg && j.leds) { pushUndo(); cfg = merge(E.defaults(), migrate(j.cfg)); leds = copyLeds(j.leds); if (j.snapshots) snapshots = j.snapshots.map(x => ({ ...x, cfg: migrate(x.cfg) })); }
        else if (j.states) { const s = j.states[j.active] || j.states.lamp || j.states.ambient; pushUndo(); leds = copyLeds(s.layout || []); cfg.count = leds.length; toast('Imported LED Matrix Lab layout. Its coordinates were relative to a generic rectangle, so check the fit.'); }
        else throw new Error('Unrecognised JSON');
      } else {
        const lines = text.trim().split(/\r?\n/), head = lines[0].toLowerCase().split(/[,;\t]/);
        let xi = head.findIndex(h => /^x(_mm)?$|^x\b/.test(h.trim())), yi = head.findIndex(h => /^y(_mm)?$|^y\b/.test(h.trim()));
        const hasHead = xi >= 0 && yi >= 0; if (!hasHead) { xi = 0; yi = 1; }
        const pts = lines.slice(hasHead ? 1 : 0).map(l => l.split(/[,;\t]/)).map(c => ({ x: Number(c[xi]), y: Number(c[yi]) })).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
        pushUndo(); leds = pts; cfg.count = pts.length;
      }
      syncInputs(); rebuild(); resize(); persist(); toast(`Loaded ${leds.length} LEDs from ${f.name}`);
    } catch (err) { toast('Could not read file: ' + err.message); }
  };
  // ------------------------------------------------------------ steps, overlay buttons, tooltips
  let step = 1;
  const STEP_HINT = { 1: 'Set the gap, LED count and current on the left', 2: 'Drag LEDs, or use Randomize / Optimize on the left', 3: 'Diffuser brightness: yellow = bright, purple = dark', 4: 'Click 🌡 Heat to see the board temperature map; numbers on the left', 5: 'Save snapshots on the left to compare them' };
  // ------------------------------------------------------------ 3D view (view3d.js): drawn from the model's own numbers.
  // Shows the current design and up to 3 snapshots side by side, one camera, one shared scale.
  var v3 = null, v3on = false, v3t = 0, v3timer = 0, v3pick = null; // var: refresh() may run before this line during start-up
  const v3cache = new WeakMap();
  function v3state(c, ls, name) { // model state of any design (snapshot or current); flux derated at its hottest LED chip
    const geoS = E.buildGeo(c, c.res), F = E.Field(geoS, c), duty = ls.map(p => c.duty[p.s] == null ? 1 : c.duty[p.s]);
    F.setAll(ls, duty);
    const th = E.thermalMap(c, ls, { weights: duty }), L = E.led(c, th.TjMax);
    return { name, cfg: c, geo: geoS, E: F.E, leds: ls, duty, flux: L.flux, map: th };
  }
  function v3stats(d) {
    const m = E.metrics(d.geo, d.E, d.leds.length), desk = E.taskLight(d.geo, d.E, d.flux, d.cfg);
    return { m, desk, lm: d.leds.length * d.flux * m.util * d.cfg.tau };
  }
  function v3label(d, st) {
    return `<b>${esc(d.name)}</b> · ${d.cfg.gap} mm gap · ${d.cfg.current} mA${d.map ? ` · board ${fmt(d.map.Tmax, 0)} °C (${d.map.case})` : ''}<br>evenness <b>${fmt(st.m.minAvg * 100, 0)}%</b> · variation ${fmt(st.m.cv * 100, 1)}% · darkest 5% at ${fmt(st.m.p5Avg * 100, 0)}% of avg<br>${fmt(st.lm, 0)} lm out · desk min ${fmt(st.desk.min, 0)} / avg ${fmt(st.desk.avg, 0)} lx${d.cfg.roomLux ? ` (incl. ${d.cfg.roomLux} room)` : ''}`;
  }
  function v3designs() {
    const cur = { name: 'This design (live)', cfg, geo, E: field.E, leds, duty: wts(), flux: res.L.flux, map: therm && therm.map };
    const list = [cur];
    if (!v3pick) v3pick = new Set();
    snapshots.forEach(sn => {
      if (!v3pick.has(sn) || list.length >= 4) return;
      let st = v3cache.get(sn);
      if (!st) { st = v3state(merge(E.defaults(), migrate(E.clone(sn.cfg))), copyLeds(sn.leds), sn.name); v3cache.set(sn, st); }
      list.push(st);
    });
    // the first ticked snapshot (e.g. Baseline) can go first: it sets the Real-look exposure and the relief reference
    if (list.length > 1 && $('v3refSnap').checked) list.push(list.shift());
    for (const d of list) d.label = v3label(d, v3stats(d));
    return list;
  }
  function v3pickPanel() {
    if (!v3pick) v3pick = new Set();
    for (const sn of [...v3pick]) if (!snapshots.includes(sn)) v3pick.delete(sn);
    $('v3cmp').innerHTML = snapshots.length ? snapshots.map((sn, i) => `<label class="chk"><input type="checkbox" data-v3s="${i}" ${v3pick.has(sn) ? 'checked' : ''}> ${esc(sn.name)}</label>`).join('') : '<span style="opacity:.7">save snapshots in step 5 to compare them here</span>';
  }
  $('v3cmp').addEventListener('change', e => {
    const i = e.target.dataset.v3s; if (i == null) return; const sn = snapshots[Number(i)];
    if (e.target.checked) { if (v3pick.size >= 3) { e.target.checked = false; toast('Up to 3 snapshots plus this design.'); return; } v3pick.add(sn); } else v3pick.delete(sn);
    v3draw();
  });
  function v3draw() { if (v3on && v3 && leds.length) v3.update(v3designs()); }
  function v3schedule() {
    clearTimeout(v3timer);
    const wait = Math.max(0, 200 - (performance.now() - v3t));
    v3timer = setTimeout(() => { v3t = performance.now(); v3draw(); }, wait);
  }
  function v3infoText(S, o) {
    if (o.scene === 'room') {
      $('v3info').innerHTML = `<b>Bedroom nightstand</b>: diffuser ${cfg.taskZ / 10} cm above the nightstand top. The lamp's light is one shadow-casting light whose brightness pattern is fitted to the model, so the nightstand top gets exactly the model's desk lux; walls, bed and props get the same light with correct distance and angle. The diffuser glows with the model's brightness map. Room light: ${cfg.roomLux || 0} lx (step 1) + a faint ${o.fill} lx fill so the room is visible.` +
        '<br><span style="opacity:.75">Not modelled: light bouncing off walls and furniture, so shadows look darker than in a real room. Shadows are softened to suggest the 14 cm-wide diffuser; real penumbras will differ. The camera exposure is metered on the nightstand top, like a phone camera.</span>';
      return;
    }
    let leg;
    if (o.mode === 'spots') leg = `<span class="v3grad div"></span> each design vs <b>its own</b> average: blue = darker, white = average, red = brighter (±${o.range}% at full colour). Same colour = same % in every panel.`;
    else if (o.mode === 'abs') leg = `<span class="v3grad seq"></span> one shared scale for all panels: diffuser 0 → ${fmt(S.Lmax, 0)} cd/m², desk 0 → ${fmt(S.Dmax, 0)} lx.`;
    else leg = `Real look: one camera exposure for all panels, set on the ${o.expose} of the first panel. The diffuser is ~150× brighter than the desk, so both can't look well exposed at once.`;
    if (o.board === 'heat') leg = `<b>Board = temperature</b>: <span class="v3grad seq"></span> ${fmt(S.Tlo, 1)} → ${fmt(S.Thi, 1)} °C, one scale for all panels (diffuser made see-through). ` + leg;
    const rel = o.relief ? ` · <b>Relief ×${o.relief}</b>: height = brightness vs the first panel's average (diffuser bumps hang down, desk bumps rise). Same height = same brightness in every panel.` : '';
    $('v3info').innerHTML = leg + rel + '<br><span style="opacity:.75">All values come from the model; walls absorb. At 40 cm every desk point sees the whole diffuser, so layouts differ mostly on the diffuser and only a little on the desk. Drag to orbit · right-drag to pan · wheel to zoom.</span>';
  }
  function show3d(on) {
    if (on && !window.THREE) { toast('3D needs three.js from cdn.jsdelivr.net, which did not load (offline?).', 6000); return; }
    v3on = on; $('v3d').style.display = on ? '' : 'none'; $('btn3d').classList.toggle('on', on);
    if (on) {
      if (!v3) { v3 = HeadView3D($('v3dHost'), E); v3.onInfo = v3infoText; new ResizeObserver(() => v3 && v3on && v3.resize()).observe($('v3dHost')); }
      v3pickPanel(); v3draw();
    }
  }
  $('btn3d').onclick = () => show3d(!v3on);
  $('v3scene').addEventListener('change', e => {
    const room = e.target.value === 'room';
    $('v3diagOpts').style.display = room ? 'none' : ''; $('v3roomOpts').style.display = room ? '' : 'none';
    document.querySelectorAll('.v3bar [data-v3cam="head"], .v3bar [data-v3cam="below"], .v3bar [data-v3cam="scene"], .v3bar [data-v3cam="side"]').forEach(b => { b.style.display = room ? 'none' : ''; });
    if (v3) { v3.opt.ev = room ? Number($('v3roomEv').value) : Number($('v3ev').value); v3.set('scene', e.target.value); }
  });
  $('v3roomEv').addEventListener('input', e => { if (v3) v3.set('ev', Number(e.target.value)); });
  $('v3refSnap').addEventListener('change', v3draw);
  const v3modeUi = () => { const m = $('v3mode').value; $('v3realOpts').style.display = m === 'real' ? '' : 'none'; $('v3rangeL').style.display = m === 'spots' ? '' : 'none'; };
  [['v3mode', 'mode'], ['v3expose', 'expose'], ['v3walls', 'walls'], ['v3range', 'range'], ['v3board', 'board']].forEach(([id, k]) => $(id).addEventListener('change', e => { if (k === 'mode') v3modeUi(); if (v3) v3.set(k, k === 'range' ? Number(e.target.value) : e.target.value); }));
  [['v3ev', 'ev'], ['v3explode', 'explode'], ['v3relief', 'relief']].forEach(([id, k]) => $(id).addEventListener('input', e => { const v = Number(e.target.value); if (Number.isFinite(v) && v3) v3.set(k, v); }));
  $('v3beams').addEventListener('change', e => v3 && v3.set('beams', e.target.checked));
  document.querySelectorAll('[data-v3cam]').forEach(b => b.onclick = () => {
    if (!v3) return; const w = b.dataset.v3cam, ex = (w === 'head' || w === 'below') ? 'diffuser' : 'desk'; // close-ups expose for the diffuser
    if (v3.opt.scene !== 'room' && v3.opt.expose !== ex) { $('v3expose').value = ex; v3.opt.expose = ex; v3draw(); }
    v3.home(w);
  });
  $('v3full').onclick = () => { const el = $('v3d'); if (document.fullscreenElement) document.exitFullscreen(); else if (el.requestFullscreen) el.requestFullscreen(); };
  document.addEventListener('fullscreenchange', () => { if (v3) setTimeout(() => v3.resize(), 50); });
  $('v3png').onclick = () => { if (!v3) return; const a = document.createElement('a'); a.href = v3.png(); a.download = 'head-3d-compare.png'; a.click(); };
  function setOverlay(v) { $('overlay').value = v; document.querySelectorAll('[data-ov]').forEach(b => b.classList.toggle('on', b.dataset.ov === v)); draw(); }
  function showCompare(on) { $('comparePanel').style.display = on ? '' : 'none'; $('canvasPanel').style.display = on ? 'none' : ''; if (on) snapsPanel(); else resize(); }
  function setStep(n) {
    step = n;
    document.querySelectorAll('section.step').forEach(sec => sec.classList.toggle('active', Number(sec.dataset.step) === n));
    document.querySelectorAll('#steps [data-step]').forEach(b => b.classList.toggle('active', Number(b.dataset.step) === n));
    showCompare(n === 5 && snapshots.length > 0);
    setOverlay('diffuser');
    $('showStrings').checked = n === 3; $('showSpacing').checked = n === 5;
    $('hintbar').textContent = STEP_HINT[n];
    try { localStorage.setItem(STORE + '.step', String(n)); } catch (e) { /* ignore */ }
    panels(); dutyPanel(); draw();
  }
  document.addEventListener('click', e => { const g = e.target.closest('[data-goto]'); if (g) { setStep(Number(g.dataset.goto)); window.scrollTo({ top: 0, behavior: 'smooth' }); } });
  document.querySelectorAll('#steps [data-step]').forEach(b => b.onclick = () => setStep(Number(b.dataset.step)));
  document.querySelectorAll('[data-ov]').forEach(b => b.onclick = () => setOverlay(b.dataset.ov));
  $('backToCanvas').onclick = () => showCompare(false);
  const tipEl = $('tip');
  document.addEventListener('pointerover', e => {
    const t = e.target.closest && e.target.closest('[data-tip]'); if (!t) { tipEl.style.display = 'none'; return; }
    tipEl.textContent = t.dataset.tip; tipEl.style.display = 'block';
    const r = t.getBoundingClientRect(), w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    const x = Math.min(window.innerWidth - w - 8, Math.max(8, r.left + r.width / 2 - w / 2));
    let y = r.bottom + 8; if (y + h > window.innerHeight - 8) y = r.top - h - 8;
    tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px';
  });

  // ------------------------------------------------------------ first-run walkthrough
  const TOUR = [
    { sel: null, title: 'Welcome 👋', text: 'This tool helps you place the Head LEDs so the diffuser glows evenly without overheating. This walkthrough takes about a minute.' },
    { sel: '#steps', title: 'Work left to right', text: 'Five steps: set up the head, lay out the LEDs, check the light and dimming, check the heat, then compare and export for building. You can jump between steps at any time.' },
    { sel: '#stepPanel', title: 'Controls for this step', text: 'Only the controls for the current step are shown. Hover any ? for a plain-English explanation. Rarely needed settings are tucked under "Advanced".' },
    { sel: '#strip', title: 'Your four key numbers', text: 'Evenness, light out, board temperature and power, each checked against your targets: green = met, amber = close, red = not met. Click a tile to jump to the step that affects it.' },
    { sel: '#canvasPanel', title: 'The head, live', text: 'Drag LEDs and every number updates instantly. The colour map is the brightness on the diffuser (yellow = bright). Tick "spacing" to see LED-to-LED distances for building.', step: 2 },
    { sel: '#randomize', title: 'Quick start', text: 'Click 🎲 Randomize for a fresh layout, then ✨ Optimize this layout to let the computer improve it. Ctrl+Z undoes anything.', step: 2 },
    { sel: '#snapName', title: 'Compare designs', text: 'In step 5, save a snapshot of each design (Baseline, A, B…) to see them side by side, with the best values starred.', step: 5 },
  ];
  let tourI = -1, tourEls = null;
  function tourShow() {
    const s = TOUR[tourI];
    if (s.step && s.step !== step) setStep(s.step);
    if (!tourEls) {
      tourEls = { block: document.createElement('div'), hole: document.createElement('div'), card: document.createElement('div') };
      tourEls.block.id = 'tourBlock'; tourEls.hole.id = 'tourHole'; tourEls.card.id = 'tourCard';
      tourEls.card.setAttribute('role', 'dialog'); tourEls.card.setAttribute('aria-modal', 'true');
      document.body.append(tourEls.block, tourEls.hole, tourEls.card);
    }
    const el = s.sel && document.querySelector(s.sel), H = tourEls.hole, C = tourEls.card;
    if (el) { el.scrollIntoView({ block: 'nearest' }); const r = el.getBoundingClientRect(); Object.assign(H.style, { left: r.left - 6 + 'px', top: r.top - 6 + 'px', width: r.width + 12 + 'px', height: r.height + 12 + 'px' }); }
    else Object.assign(H.style, { left: '50%', top: '35%', width: '0px', height: '0px' });
    C.innerHTML = `<h4>${s.title}</h4><p>${s.text}</p><div class="row"><span class="dots">${tourI + 1} / ${TOUR.length}</span><span class="row">${tourI ? '<button data-t="back">Back</button>' : '<button data-t="skip">Skip</button>'}<button class="primary" data-t="next">${tourI === TOUR.length - 1 ? 'Start' : 'Next'}</button></span></div>`;
    const cw = C.offsetWidth, ch = C.offsetHeight;
    let x, y;
    if (el) {
      const r = el.getBoundingClientRect(); x = r.right + 16; y = r.top;
      if (x + cw > window.innerWidth - 8) { x = r.left + r.width / 2 - cw / 2; y = r.bottom + 16; if (y + ch > window.innerHeight - 8) y = r.top - ch - 16; }
      if (y < 8 || y + ch > window.innerHeight - 8) { x = window.innerWidth - cw - 24; y = window.innerHeight - ch - 24; }
    } else { x = window.innerWidth / 2 - cw / 2; y = window.innerHeight * 0.3; }
    C.style.left = Math.max(8, Math.min(window.innerWidth - cw - 8, x)) + 'px'; C.style.top = Math.max(8, Math.min(window.innerHeight - ch - 8, y)) + 'px';
    C.querySelector('[data-t=next]').focus();
  }
  function tourEnd() { if (tourEls) { Object.values(tourEls).forEach(e => e.remove()); tourEls = null; } tourI = -1; try { localStorage.setItem(STORE + '.toured', '1'); } catch (e) { /* ignore */ } setStep(2); }
  function startTour() { tourI = 0; tourShow(); }
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('#tourCard [data-t]'); if (!b) return;
    if (b.dataset.t === 'next') { if (tourI >= TOUR.length - 1) tourEnd(); else { tourI++; tourShow(); } }
    else if (b.dataset.t === 'back') { tourI--; tourShow(); } else tourEnd();
  });
  document.addEventListener('keydown', e => { if (tourI >= 0 && e.key === 'Escape') tourEnd(); });
  window.addEventListener('resize', () => { if (tourI >= 0) tourShow(); });
  $('tour').onclick = startTour;

  $('theme').onclick = () => { const r = document.documentElement, cur = r.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); r.dataset.theme = cur === 'dark' ? 'light' : 'dark'; draw(); };

  // ------------------------------------------------------------ boot
  const restored = restore();
  syncInputs();
  if (cadMigrated) setTimeout(() => persist(), 1500);   // save the migrated design so the notice shows only once
  if (cadMigrated) setTimeout(() => toast('Updated your saved design to the measured CAD geometry: 17.9 mm gap, camera board footprint, screw bosses, lit aperture. LEDs now inside a keepout show red; re-optimize. Snapshots kept their gap.', 9000), 600);
  geo = E.buildGeo(cfg, cfg.res); placer = E.buildPlacer(cfg);
  if (!restored || !leds.length) leds = E.hex(cfg, placer, cfg.count);
  ensureStrings(false);
  field = E.Field(geo, cfg); field.setAll(leds, wts());
  dutyPanel();
  computeThermal(true); refresh();
  window.addEventListener('resize', resize); resize();
  let savedStep = 1; try { savedStep = Number(localStorage.getItem(STORE + '.step')) || 1; } catch (e) { /* ignore */ }
  setStep(restored ? savedStep : 1);
  status(restored ? 'Restored your last session' : 'Hex layout loaded');
  let toured = false; try { toured = localStorage.getItem(STORE + '.toured') === '1'; } catch (e) { /* ignore */ }
  if (!toured) setTimeout(startTour, 400);
  window.__studio = { E, get cfg() { return cfg; }, get leds() { return leds; }, get res() { return res; }, get therm() { return therm; } };
})();
