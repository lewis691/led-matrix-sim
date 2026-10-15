/*
 * Head LED Placement Studio — engine.
 * Pure computation (no DOM). Runs in the page, inside a Web Worker (via Function#toString), and in Node for checks.
 *
 * Coordinates: true flat millimetres, origin at the centre of the dome arc of "WT - Lewis.dxf",
 * +x right, +y up. The DXF is drawn with a 12.0° tilt (all circles have ratio 0.9781 = cos 12°); the
 * vertical values here are de-projected (drawn / 0.9781).
 */
function HeadLEDEngine() {
  'use strict';
  const SIGMA = 5.670374419e-8, G = 9.81;
  const TILT_K = 0.9781, DXF_X0 = 201.545, DXF_Y0 = 108.46;
  // JB2835B package (Pro9 datasheet p.23): 3.58 x 2.97 mm over the terminals (body 3.30), 0.62 mm tall, optical model
  // origin on the top face. PKG_R = farthest point of the package from its centre = 2.33 mm.
  const PKG_W = 2.97, PKG_L = 3.58, PKG_H = 0.62;
  const PKG_R = Math.hypot(PKG_W, PKG_L) / 2;

  // ---------------------------------------------------------------- config
  function defaults() {
    return {
      shape: { R: 69.55, sx: 1, sy: 1, cornerR: 33.64, bottomR: 482.38, bottomY: -35.47 },
      // camera = lens circle only. Centre = centre of the IMX219 board's 4 mounting holes in the DXF;
      // camera, from the Head STEP (context/step_extract): barrel Ø14 at the top (r 7), flush with the diffuser's outer
      // face, in a Ø16 diffuser hole (holeR 8): the 1 mm ring between them is open to the room. The camera board +
      // lens holder (25 x 24 mm, x 30..55, y -21.945..2.055) sits ON the LED board front.
      // LED keepout (zone): 'dxf' (default) = the original corner keepout drawn in WT - Lewis.dxf, which the new
      // prototype uses (user, 15 Oct); 'module' = camera board footprint only; 'lens' = barrel circle only (what-if).
      keep: { on: true, x: 42.4, y: -13.3, r: 7, holeR: 8, occlude: true, margin: 1.0,
        mod: { dx0: -12.4, dx1: 12.6, dy0: -8.645, dy1: 15.355 },
        // 'dxf' zone: the corner region x >= 19.0, y <= 19.22 mm (relative to the lens: dx = -23.4, dy = +32.52, so it
        // moves with the camera); it contains the whole camera board. Original clearance: LED centre >= 2.3 mm from the
        // zone; with the datasheet package (PKG_R 2.33) that is a body clearance of about 0, so 0 is used. The diffuser
        // over the corner is still scored for evenness (the whole face should glow evenly; user, 15 Oct).
        zone: 'dxf', boxDx: -23.4, boxDy: 32.52, boxMargin: 0 },
      // board screw holes (STEP). TL/TR carry the Head Front screw bosses (Ø8.6, 3 mm tall on the board front), so the
      // LED body must clear r 4.3; BL has only a screw head (holeClear).
      holes: [{ x: -36.658, y: 53.885, clear: 4.3 }, { x: 36.299, y: 53.885, clear: 4.3 }, { x: -46.808, y: -27.989 }],
      // clearances are for the LED BODY (the dotted lines on the canvas): screw-head radius, body-to-wall gap
      holeClear: 3.5,
      edgeMargin: 1.3, bodyMargins: true,
      // STEP: light reaches the diffuser only through the Head Front lip opening, 3.6 mm inside the board edge all round
      // (the diffuser sits on a 1 mm ledge outside that). Light landing outside it hits the lip/chamfer/walls.
      apInset: 3.6,
      evalInset: 0,         // the whole lit aperture is visible (STEP: no lip over the diffuser's front face)
      minPitch: 4.5,        // LED centre-to-centre clearance (2835 = 2.8 x 3.5 mm)
      gap: 17.9,            // board front -> diffuser inner face (STEP: 17.9 everywhere). Used by the heat calculation.
      ledH: 0.62,           // JB2835B package height (Pro9 datasheet p.23; optical origin on the top face): optical height = gap - ledH
      m: 1,
      tau: 0.70,            // diffuser transmission (Notion Head page: diffuser must pass >= 70%; user: '70 percent diffusion')
      // LED + drive (Cree JB2835B 3V F-class Pro9, 90 CRI; flux per colour temperature from its datasheet p.5, see CCT below)
      count: 60, perString: 5, stringMode: 'rows', duty: [], minDuty: 0.3, dimJoint: false, current: 25, refI: 65, vf: 2.70, rjs: 5,   // current 25 mA [Mine]: 60 x 2.70 V x 25 mA = 4.05 W, the brief's 4 W reference; rjs = R_j-s (junction to solder point) [Cree p.4]
      cct: 3000,            // colour temperature (K): picks the datasheet flux and its temperature slope
      fluxCase: 'typ',      // 'typ' = datasheet typical; 'tol' = typical - 7 % (datasheet flux measurement tolerance; old program default)
      refFlux: 36.2, tempSlope: 0.00115,   // used only if cct is not in the table (custom part)
      vddLed: 13.37,        // 0.6 V x (1 + 100k/4.7k): divider from Head_Board.pdf; the LMR51420 0.6 V reference is datasheet knowledge (not in the context files)
      tlcKnee: 0.4,         // [Mine] assumed regulation headroom for the TLC59711
      // thermal: Ben's Notion "LED array heat calcs" network (front path only) + Hui & Qin 2009
      ambient: 25, thermalCase: 'worst', Nu: 1, hOut: 2, kh: 0.85,
      emissBoard: 0.85, emissDiff: 0.90, diffT: 1.0, diffK: 0.2,
      res: 1.5,
      // ---- full heat map (thermalMap): board conduction + front path (Ben) + back cavity + mounts.
      // PCB: metal-core (user). No stack-up yet, so typical MCPCB values are ASSUMED: 1.6 mm aluminium (k 138, 5052),
      // 1 oz copper, 0.1 mm dielectric (k 2.0), bare-aluminium back (emissivity 0.1). 'fr4' = 1.6 mm FR4 for comparison.
      pcb: { type: 'mcpcb', kBase: 138, tBase: 1.6, kCu: 385, tCu: 0.035, kDiel: 2.0, tDiel: 0.1, epsBack: 0.1 },
      // other heat on the board: user's power table, worst case = 4.6 W from the 24 V input (SoC + XVF3800 + camera +
      // mics, incl. ~73 % DC/DC efficiency, all on this board). Positions unknown: spread evenly, except the camera's
      // share (camW) on its 25 x 24 module footprint. Motor heat: not given (0); it would enter via the Head Back cup.
      elecW: 4.6, camW: 0.5, motorW: 0,
      // shell: PLA (user), opaque. k 0.13 W/mK, emissivity 0.9 (textbook values, ASSUMED), 3.0 mm walls (STEP).
      // PLA softens near its glass transition (about 55-60 C), so parts touching the board are checked against 55 C.
      kPla: 0.13, epsShell: 0.9, plaMax: 55,
      bossK: null,          // screw-boss material k (null = PLA). What-if: aluminium standoffs (138)
      shellK: null,         // Head Back wall k (null = PLA). What-if: PC 0.2, aluminium 138
      // electronics hot spots on the board: [{ name, x, y, w (W), s (side, mm) }]. Their power is part of elecW; the rest
      // (minus camW) is spread evenly. Empty = all spread evenly (positions unknown).
      elecSpots: [],
      mapRes: 2.5,
      cadV: 3,              // geometry version: 1 = measured from the Head STEP; 2 = + datasheet package size/height (audit); 3 = original DXF keepout
      targetLm: 300, targetUniformPct: 65, maxBoard: 40, powerBudget: 4,
      // desk target (Ben's Notion 'LED research doc + sim', citing EN 12464-1): >= 500 lx over a 40 cm circle at 40 cm
      taskZ: 400, taskD: 400, targetLux: 500, deskLimit: true,
      // room light already on the desk (lx), added to the lamp's desk illuminance. 0 = dark room (worst case, default).
      // EN 12464-1's 500 lx is the total on the task, so room light counts toward it. No measured value: user input.
      roomLux: 0,   // deskLimit: optimizer only accepts layouts meeting targetLux
      w: { cv: 1, min: 0.6 },   // score = w.cv*CV (Su 2012 / Yang 2009) + w.min*(1 - evenness) (brief's target metric)
    };
  }
  const clone = o => JSON.parse(JSON.stringify(o));

  // ---------------------------------------------------------------- outline
  function outline(cfg) {
    const s = cfg.shape, R = s.R, rc = s.cornerR, BR = s.bottomR, bcY = s.bottomY + BR;
    const cx = -R + rc, cy = bcY - Math.sqrt((BR - rc) ** 2 - cx * cx);
    // tangent point between the left corner arc and the bottom arc
    const vx = cx, vy = cy - bcY, vl = Math.hypot(vx, vy), tpx = vx / vl * BR, tpy = bcY + vy / vl * BR;
    const thT = Math.atan2(tpy - cy, tpx - cx) + 2 * Math.PI; // ~265°
    const pts = [];
    const N1 = 96;
    for (let i = 0; i <= N1; i++) { const a = Math.PI * i / N1; pts.push([R * Math.cos(a), R * Math.sin(a)]); }
    const N2 = 28;
    for (let i = 0; i <= N2; i++) { const a = Math.PI + (thT - Math.PI) * i / N2; pts.push([cx + rc * Math.cos(a), cy + rc * Math.sin(a)]); }
    const N3 = 30;
    for (let i = 1; i < N3; i++) { const x = tpx + (-2 * tpx) * i / N3; pts.push([x, bcY - Math.sqrt(BR * BR - x * x)]); }
    for (let i = 0; i <= N2; i++) { const a = (3 * Math.PI - thT) + (2 * Math.PI - (3 * Math.PI - thT)) * i / N2; pts.push([-cx + rc * Math.cos(a), cy + rc * Math.sin(a)]); }
    const out = []; // de-duplicate, scale
    for (const [x, y] of pts) {
      const p = [x * s.sx, y * s.sy], q = out[out.length - 1];
      if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6) out.push(p);
    }
    const f = out[0], l = out[out.length - 1];
    if (Math.hypot(f[0] - l[0], f[1] - l[1]) < 1e-6) out.pop();
    return out; // CCW
  }
  function polyArea(p) { let a = 0; for (let i = 0; i < p.length; i++) { const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length]; a += x1 * y2 - x2 * y1; } return a / 2; }
  function pointInPoly(p, x, y) {
    let c = false;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const [xi, yi] = p[i], [xj, yj] = p[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  // nearest point on polygon boundary; returns {d, qx, qy, s (arc length), seg}
  function nearestOnPoly(p, cum, x, y) {
    let best = { d: Infinity };
    for (let i = 0; i < p.length; i++) {
      const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length], dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy;
      let t = L2 ? ((x - x1) * dx + (y - y1) * dy) / L2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = x1 + t * dx, qy = y1 + t * dy, d = Math.hypot(x - qx, y - qy);
      if (d < best.d) best = { d, qx, qy, s: cum[i] + t * Math.sqrt(L2), seg: i };
    }
    return best;
  }
  // does the straight path (ax,ay)->(bx,by) pass through the camera (a full-height cylinder of radius r)?
  function segHitsCircle(ax, ay, bx, by, K) {
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    let t = L2 ? ((K.x - ax) * dx + (K.y - ay) * dy) / L2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const ex = ax + t * dx - K.x, ey = ay + t * dy - K.y;
    return ex * ex + ey * ey < K.r * K.r;
  }

  // ---------------------------------------------------------------- geometry / grids
  function buildGeo(cfg, res, opt) {
    opt = opt || {};
    res = res || cfg.res;
    const poly = outline(cfg), n = poly.length, cum = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) { const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % n]; cum[i + 1] = cum[i] + Math.hypot(x2 - x1, y2 - y1); }
    const perim = cum[n];
    let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
    for (const [x, y] of poly) { minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); }
    const gx0 = minx - res, gy0 = miny - res;
    const nx = Math.ceil((maxx - minx + 2 * res) / res), ny = Math.ceil((maxy - miny + 2 * res) / res), N = nx * ny;
    const type = new Uint8Array(N), dIdx = new Int32Array(N).fill(-1), sdf = new Float32Array(N);
    const dx = [], dy = [], dEval = [];
    for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) {
      const j = iy * nx + ix, x = gx0 + (ix + 0.5) * res, y = gy0 + (iy + 0.5) * res;
      const inside = pointInPoly(poly, x, y), nb = nearestOnPoly(poly, cum, x, y);
      sdf[j] = inside ? nb.d : -nb.d;
      if (!inside) { type[j] = 2; continue; }
      if (nb.d < (cfg.apInset || 0)) { type[j] = 1; continue; }   // under the lip: light here is absorbed by the shell
      type[j] = 0; dIdx[j] = dx.length; dx.push(x); dy.push(y); dEval.push(nb.d - (cfg.apInset || 0) >= cfg.evalInset ? 1 : 0);
    }
    const nD = dx.length;
    const geo = {
      cfgKey: geoKey(cfg), res, poly, cum, perim, gx0, gy0, nx, ny, N, type, dIdx, sdf,
      nD, dx: Float32Array.from(dx), dy: Float32Array.from(dy), dEvalBase: Uint8Array.from(dEval), dEval: new Uint8Array(nD),
      camMask: new Uint8Array(nD), evalInset: cfg.evalInset, area: polyArea(poly), areaD: nD * res * res,
    };
    setCam(geo, cfg.keep);
    return geo;
  }
  // move the camera without rebuilding the grid: cells under the lens are excluded and lose their light
  function setCam(geo, cam) {
    geo.keep = { ...cam }; geo.keepOn = !!cam.on;
    for (let c = 0; c < geo.nD; c++) {
      const d = Math.hypot(geo.dx[c] - cam.x, geo.dy[c] - cam.y);
      geo.camMask[c] = cam.on && d <= (cam.holeR || cam.r) ? 1 : 0;   // diffuser hole: barrel top + open ring
      geo.dEval[c] = geo.dEvalBase[c] && !geo.camMask[c] && !(cam.on && d < cam.r + geo.evalInset) ? 1 : 0;   // the hole is never scored
    }
  }
  function geoKey(cfg) { return JSON.stringify([cfg.shape, cfg.keep, cfg.gap, cfg.ledH, cfg.apInset, cfg.m, cfg.evalInset]); }

  // signed distance from (x, y) to the DXF keepout zone {x >= X0, y <= Y1} (negative inside)
  function zoneDist(K, x, y) {
    const X0 = K.x + K.boxDx, Y1 = K.y + K.boxDy, dx = X0 - x, dy = y - Y1;
    if (dx <= 0 && dy <= 0) return Math.max(dx, dy);
    return dx > 0 && dy > 0 ? Math.hypot(dx, dy) : Math.max(dx, dy);
  }
  // signed distance to the camera module footprint (rectangle relative to the lens centre; negative inside)
  function modDist(K, x, y) {
    const M = K.mod, x0 = K.x + M.dx0, x1 = K.x + M.dx1, y0 = K.y + M.dy0, y1 = K.y + M.dy1;
    const ox = Math.max(x0 - x, x - x1), oy = Math.max(y0 - y, y - y1);
    return ox > 0 && oy > 0 ? Math.hypot(ox, oy) : Math.max(ox, oy);
  }
  function modPoly(K) { const M = K.mod; return [[K.x + M.dx0, K.y + M.dy0], [K.x + M.dx1, K.y + M.dy0], [K.x + M.dx1, K.y + M.dy1], [K.x + M.dx0, K.y + M.dy1]]; }
  // LED body clear of the camera keepout?
  function camClear(K, x, y) {
    if (Math.hypot(x - K.x, y - K.y) < K.r + K.margin + PKG_R) return false;
    if (K.zone === 'dxf' && zoneDist(K, x, y) < K.boxMargin + PKG_R) return false;
    if (K.zone === 'module' && K.mod && modDist(K, x, y) < K.margin + PKG_R) return false;
    return true;
  }
  // the zone clipped to the head outline (Sutherland-Hodgman with two half-planes), for drawing and DXF export
  function zonePoly(K, poly) {
    const X0 = K.x + K.boxDx, Y1 = K.y + K.boxDy;
    const clip = (pts, inside, cut) => { const out = []; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], ia = inside(a), ib = inside(b); if (ia) out.push(a); if (ia !== ib) out.push(cut(a, b)); } return out; };
    let p = clip(poly, q => q[0] >= X0, (a, b) => { const t = (X0 - a[0]) / (b[0] - a[0]); return [X0, a[1] + t * (b[1] - a[1])]; });
    p = clip(p, q => q[1] <= Y1, (a, b) => { const t = (Y1 - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), Y1]; });
    return p;
  }
  // placement checker (fine SDF grid for the outline + analytic keepout / holes)
  function buildPlacer(cfg) {
    const g = buildGeo(cfg, 0.75, { noBand: true, noW: true });
    let K = { ...cfg.keep };
    function sdfAt(x, y) {
      const fx = (x - g.gx0) / g.res - 0.5, fy = (y - g.gy0) / g.res - 0.5;
      const ix = Math.floor(fx), iy = Math.floor(fy);
      if (ix < 0 || iy < 0 || ix >= g.nx - 1 || iy >= g.ny - 1) return -1e3;
      const tx = fx - ix, ty = fy - iy, j = iy * g.nx + ix, s = g.sdf;
      return (s[j] * (1 - tx) + s[j + 1] * tx) * (1 - ty) + (s[j + g.nx] * (1 - tx) + s[j + g.nx + 1] * tx) * ty;
    }
    function okRegion(x, y) {
      if (sdfAt(x, y) < cfg.edgeMargin + PKG_R) return false;
      if (K.on && !camClear(K, x, y)) return false;
      for (const h of cfg.holes) if (Math.hypot(x - h.x, y - h.y) < (h.clear || cfg.holeClear) + PKG_R) return false;
      return true;
    }
    function okPitch(leds, i, x, y) {
      const p2 = cfg.minPitch * cfg.minPitch;
      for (let k = 0; k < leds.length; k++) if (k !== i) { const ddx = leds[k].x - x, ddy = leds[k].y - y; if (ddx * ddx + ddy * ddy < p2) return false; }
      return true;
    }
    // area of placeable region (Monte-Carlo free: count fine cells)
    let cnt = 0; for (let iy = 0; iy < g.ny; iy++) for (let ix = 0; ix < g.nx; ix++) { const x = g.gx0 + (ix + 0.5) * g.res, y = g.gy0 + (iy + 0.5) * g.res; if (okRegion(x, y)) cnt++; }
    // can the camera sit here? inside the head, clear of screw holes and of every LED
    function camOk(cam, leds) {
      if (sdfAt(cam.x, cam.y) < cam.r + 0.5) return false;
      for (const h of cfg.holes) if (Math.hypot(cam.x - h.x, cam.y - h.y) < (h.clear || cfg.holeClear) + cam.r) return false;
      if (leds) for (const p of leds) if (!camClear(cam, p.x, p.y)) return false;
      return true;
    }
    return { sdfAt, okRegion, okPitch, camOk, setCam: c => { K = { ...c }; }, area: cnt * g.res * g.res, bbox: [g.gx0, g.gy0, g.gx0 + g.nx * g.res, g.gy0 + g.ny * g.res] };
  }

  // ---------------------------------------------------------------- optics
  // Irradiance per unit LED flux (1/mm^2) on each diffuser cell. Lambertian (m = 1) / cos^m point source:
  // E = (m+1) h^(m+1) / (2 pi r^(m+3)): a cos^m intensity (Moreno et al. 2006, Eq. 1; m from their Eq. 2 and the 120 deg
  // FWHM) landing on a plane, x cos(theta) incidence, normalised to unit flux [Textbook]. For m = 1 this is
  // E = h^2 / (pi r^4), exactly Ben's Notion derivation. (Moreno's own Eq. 3 is written z^m / R^(m+2), i.e. with m
  // counting the incidence cosine too, so their m = 2 is this m = 1.)
  // Light reaching the head walls is absorbed (no reflection model); light on the lens or blocked by its barrel is lost.
  function ledContrib(geo, cfg, x, y, outD) {
    outD.fill(0);
    const h = cfg.gap - (cfg.ledH || 0), h2 = h * h, m = cfg.m;   // optical height: LED top -> diffuser inner face
    const c0 = (m + 1) / (2 * Math.PI) * Math.pow(h, m + 1), pw = -(m + 3) / 2;
    const K = geo.keep, occ = geo.keepOn && K.occlude, camMask = geo.camMask;
    for (let c = 0; c < geo.nD; c++) {
      if (camMask[c]) continue;
      const px = geo.dx[c], py = geo.dy[c];
      if (occ && segHitsCircle(x, y, px, py, K)) continue;
      const ddx = px - x, ddy = py - y, r2 = ddx * ddx + ddy * ddy + h2;
      outD[c] = m === 1 ? c0 / (r2 * r2) : c0 * Math.pow(r2, pw);
    }
  }

  // incremental field: per-LED contributions kept so a moved LED costs one kernel pass.
  // Each LED carries a drive weight wt[i] (its string's PWM duty, 0..1); contributions are stored unweighted.
  function Field(geo, cfg) {
    const nD = geo.nD;
    const F = { geo, cfg, contrib: [], wt: [], E: new Float64Array(nD) };
    const tmpD = new Float32Array(nD);
    F.setAll = function (leds, wts) {
      F.contrib = []; F.wt = []; F.E.fill(0);
      leds.forEach((l, i) => {
        const cd = new Float32Array(nD), w = wts ? wts[i] : 1;
        ledContrib(geo, cfg, l.x, l.y, cd);
        F.contrib.push(cd); F.wt.push(w);
        for (let c = 0; c < nD; c++) F.E[c] += w * cd[c];
      });
    };
    F.save = () => ({ contrib: F.contrib, wt: F.wt.slice(), E: F.E.slice() });
    F.restore = sv => { F.contrib = sv.contrib; F.wt = sv.wt; F.E.set(sv.E); };
    // change drive weights without recomputing geometry
    F.setWeights = function (wts) {
      let any = false;
      for (let i = 0; i < F.wt.length; i++) {
        const dw = wts[i] - F.wt[i]; if (Math.abs(dw) < 1e-12) continue; any = true;
        const cd = F.contrib[i]; for (let c = 0; c < nD; c++) F.E[c] += dw * cd[c];
        F.wt[i] = wts[i];
      }
      return any;
    };
    // propose a new position for LED i: writes the would-be E into out without committing (optimizer)
    F.trial = function (i, x, y, out) {
      ledContrib(geo, cfg, x, y, tmpD);
      const cd = F.contrib[i], w = F.wt[i];
      for (let c = 0; c < nD; c++) out[c] = F.E[c] + w * (tmpD[c] - cd[c]);
      return out;
    };
    F.commitTrial = function (i) { // after trial(): adopt tmpD
      const cd = F.contrib[i], w = F.wt[i];
      for (let c = 0; c < nD; c++) F.E[c] += w * (tmpD[c] - cd[c]);
      cd.set(tmpD);
    };
    F.update = function (i, x, y) { ledContrib(geo, cfg, x, y, tmpD); F.commitTrial(i); };
    F.add = function (x, y, w) {
      w = w == null ? 1 : w;
      const cd = new Float32Array(nD); ledContrib(geo, cfg, x, y, cd);
      F.contrib.push(cd); F.wt.push(w); for (let c = 0; c < nD; c++) F.E[c] += w * cd[c];
    };
    F.remove = function (i) {
      const cd = F.contrib[i], w = F.wt[i];
      for (let c = 0; c < nD; c++) F.E[c] -= w * cd[c];
      F.contrib.splice(i, 1); F.wt.splice(i, 1);
    };
    return F;
  }

  // Auto-balance string duties (Moreno 2006 dims the centre LED of a ring; Yang 2009: edge LEDs may need different
  // levels): coordinate descent on one PWM duty per string, minimising w.cv*CV + w.min*(1 - min/avg); duties stay in [minDuty, 1].
  function balanceStrings(geo, cfg, F, groups, nS, opt) {
    opt = opt || {};
    const nD = geo.nD, lo = opt.minDuty == null ? 0.3 : opt.minDuty, Wt = cfg.w;
    // optional desk limit (opt.desk = { target, scale }): per-string desk illuminance, so a duty change is cheap to check
    let deskD = null, dmT = 0;
    if (opt.desk) {
      const dm = deskModel(geo, cfg); dmT = dm.T; deskD = Array.from({ length: nS }, () => new Float64Array(dm.T));
      const SB = Array.from({ length: nS }, () => new Float64Array(dm.nB));
      groups.forEach((q, i) => { if (q == null || q < 0 || q >= nS) return; const cd = F.contrib[i]; for (let c = 0; c < nD; c++) { const b = dm.blockOf[c]; if (b >= 0) SB[q][b] += cd[c]; } });
      for (let q = 0; q < nS; q++) for (let b = 0; b < dm.nB; b++) { const v = SB[q][b] * dm.A * opt.desk.scale; if (!v) continue; const o = b * dm.T; for (let t = 0; t < dm.T; t++) deskD[q][t] += v * dm.K[o + t]; }
    }
    const deskMinOf = wv => { if (!deskD) return Infinity; let mn = Infinity; for (let t = 0; t < dmT; t++) { let v = 0; for (let q = 0; q < nS; q++) v += wv[q] * deskD[q][t]; mn = Math.min(mn, v); } return mn + (cfg.roomLux || 0); };
    const ev = []; for (let c = 0; c < nD; c++) if (geo.dEval[c]) ev.push(c);
    const nE = ev.length, S = Array.from({ length: nS }, () => new Float64Array(nE)), cnt = new Float64Array(nS);
    groups.forEach((q, i) => {
      if (q == null || q < 0 || q >= nS) return; cnt[q]++;
      const cd = F.contrib[i]; for (let k = 0; k < nE; k++) S[q][k] += cd[ev[k]];
    });
    const N = groups.length;
    let w = (opt.start || []).slice(0, nS); while (w.length < nS) w.push(1); w = w.map(v => Math.min(1, Math.max(lo, v)));
    const E = new Float64Array(nE); for (let q = 0; q < nS; q++) for (let k = 0; k < nE; k++) E[k] += w[q] * S[q][k];
    const score = (Earr, wv) => {
      let s = 0, s2 = 0, mn = Infinity; for (let k = 0; k < nE; k++) { const v = Earr[k]; s += v; s2 += v * v; if (v < mn) mn = v; }
      const m = s / nE, cv = Math.sqrt(Math.max(0, s2 / nE - m * m)) / m;
      let kept = 0; for (let q = 0; q < nS; q++) kept += cnt[q] * wv[q]; kept /= N;
      const dmin = deskMinOf(wv), pen = deskD ? DESK_PENALTY * Math.max(0, (opt.desk.target - dmin) / opt.desk.target) : 0;
      return { J: Wt.cv * cv + Wt.min * (1 - mn / m) + pen, cv, minAvg: mn / m, kept, deskMin: dmin };
    };
    const before = score(E, w);
    let cur = before;
    const tryE = new Float64Array(nE);
    for (const st of [0.2, 0.1, 0.05, 0.02, 0.01, 0.005]) {
      let improved = true, guard = 0;
      while (improved && guard++ < 40) {
        improved = false;
        for (let q = 0; q < nS; q++) for (const dir of [1, -1]) {
          const nw = Math.min(1, Math.max(lo, w[q] + dir * st)), dw = nw - w[q]; if (Math.abs(dw) < 1e-9) continue;
          for (let k = 0; k < nE; k++) tryE[k] = E[k] + dw * S[q][k];
          const w2 = w.slice(); w2[q] = nw; const sc = score(tryE, w2);
          if (deskD && cur.deskMin >= opt.desk.target && sc.deskMin < opt.desk.target) continue; // never drop below the desk limit
          if (sc.J < cur.J - 1e-9) { E.set(tryE); w = w2; cur = sc; improved = true; }
        }
      }
    }
    const mx = Math.max(...w); if (mx > 0 && mx < 1) { w = w.map(v => Math.min(1, v / mx)); for (let k = 0; k < nE; k++) E[k] /= mx; cur = score(E, w); }
    return { w, before, after: cur };
  }

  // metrics over evaluated diffuser cells; E is per unit LED flux (1/mm^2)
  function metrics(geo, E, nLed, fast) {
    let n = 0, s = 0, s2 = 0, mn = Infinity, mx = -Infinity, all = 0;
    const vals = [];
    for (let c = 0; c < geo.nD; c++) {
      if (geo.camMask[c]) continue;
      all += E[c];
      if (!geo.dEval[c]) continue;
      const v = E[c]; n++; s += v; s2 += v * v; if (v < mn) mn = v; if (v > mx) mx = v; if (!fast) vals.push(v);
    }
    const mean = n ? s / n : 0, sd = n ? Math.sqrt(Math.max(0, s2 / n - mean * mean)) : 0;
    vals.sort((a, b) => a - b);
    const p5 = vals.length ? vals[Math.floor(vals.length * 0.05)] : 0;
    return { mean, min: mn, max: mx, cv: mean ? sd / mean : 0, minAvg: mean ? mn / mean : 0, maxMin: mn ? mx / mn : Infinity, p5Avg: mean ? p5 / mean : 0, util: nLed ? all * geo.res * geo.res / nLed : 0 };
  }

  // Light on the desk (Ben's Notion method): each diffuser patch is treated as a Lambertian source emitting the light
  // that passes through it (E*A*flux*tau), summed on a plane taskZ below the diffuser over a taskD-diameter circle centred
  // under the diffuser. Patches are merged into ~6 mm blocks (far field: 6 mm << 400 mm). Head assumed parallel to the desk.
  // The block-to-desk matrix is built once and reused, so the optimizer can check the desk minimum on every move.
  function deskModel(geo, cfg) {
    const K0 = geo.keep || {}, key = [cfg.taskZ, cfg.taskD, K0.on, K0.x, K0.y, K0.r].join(',');
    if (geo._desk && geo._desk.key === key) return geo._desk;
    const blk = Math.max(1, Math.round(6 / geo.res)), bs = geo.res * blk, ids = new Map(), blockOf = new Int32Array(geo.nD).fill(-1), bx = [], by = [], bn = [];
    let cx = 0, cy = 0, cn = 0;
    for (let c = 0; c < geo.nD; c++) {
      if (geo.camMask[c]) continue;
      cx += geo.dx[c]; cy += geo.dy[c]; cn++;
      const k = Math.floor((geo.dx[c] - geo.gx0) / bs) + ',' + Math.floor((geo.dy[c] - geo.gy0) / bs);
      let b = ids.get(k); if (b == null) { b = bx.length; ids.set(k, b); bx.push(0); by.push(0); bn.push(0); }
      blockOf[c] = b; bx[b] += geo.dx[c]; by[b] += geo.dy[c]; bn[b]++;
    }
    cx /= cn; cy /= cn;
    const nB = bx.length; for (let b = 0; b < nB; b++) { bx[b] /= bn[b]; by[b] /= bn[b]; }
    const z = cfg.taskZ, R = cfg.taskD / 2, n = 21, pts = [];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const u = ((i + 0.5) / n - 0.5) * 2 * R, v = ((j + 0.5) / n - 0.5) * 2 * R; if (u * u + v * v <= R * R) pts.push({ u, v }); }
    for (let k = 0; k < 36; k++) { const a = k / 36 * 2 * Math.PI; pts.push({ u: R * Math.cos(a), v: R * Math.sin(a) }); } // edge of the circle
    pts.push({ u: 0, v: 0, centre: true });
    const T = pts.length, Km = new Float32Array(nB * T);
    for (let b = 0; b < nB; b++) for (let t = 0; t < T; t++) {
      const r2 = (cx + pts[t].u - bx[b]) ** 2 + (cy + pts[t].v - by[b]) ** 2 + z * z;
      Km[b * T + t] = z * z / (Math.PI * r2 * r2) * 1e6;                 // lux per lm/mm2... per lm emitted by the block
    }
    geo._desk = { key, blockOf, nB, T, K: Km, pts, cx, cy, bx, by, A: geo.res * geo.res, B: new Float64Array(nB), lux: new Float64Array(T) };
    return geo._desk;
  }
  // desk illuminance for diffuser irradiance E (per unit LED flux) and scale = flux per LED * tau
  function deskLux(dm, E, scale, room) {
    const B = dm.B, lux = dm.lux, T = dm.T, Km = dm.K; B.fill(0); lux.fill(room || 0);
    for (let c = 0; c < E.length; c++) { const b = dm.blockOf[c]; if (b >= 0) B[b] += E[c]; }
    for (let b = 0; b < dm.nB; b++) { const v = B[b] * dm.A * scale; if (!v) continue; const o = b * T; for (let t = 0; t < T; t++) lux[t] += v * Km[o + t]; }
    let mn = Infinity, mx = 0, sum = 0, cnt = 0, centre = 0;
    for (let t = 0; t < T; t++) { if (dm.pts[t].centre) { centre = lux[t]; continue; } mn = Math.min(mn, lux[t]); mx = Math.max(mx, lux[t]); sum += lux[t]; cnt++; }
    return { min: mn, max: mx, avg: sum / cnt, centre, uniform: mn / (sum / cnt) };
  }
  // Desk illuminance on an n x n grid of a square (side 2*half, centred under the diffuser) - same method as deskLux,
  // for drawing the desk in the 3D view. Returns lux per grid point (row 0 = most negative v).
  function deskMap(geo, E, fluxPerLed, cfg, half, n) {
    const dm = deskModel(geo, cfg), B = new Float64Array(dm.nB), z2 = cfg.taskZ * cfg.taskZ, out = new Float32Array(n * n);
    for (let c = 0; c < E.length; c++) { const b = dm.blockOf[c]; if (b >= 0) B[b] += E[c] * dm.A * fluxPerLed * cfg.tau; }
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = dm.cx + ((i + 0.5) / n - 0.5) * 2 * half, y = dm.cy + ((j + 0.5) / n - 0.5) * 2 * half;
      let l = 0; for (let b = 0; b < dm.nB; b++) { if (!B[b]) continue; const r2 = (x - dm.bx[b]) ** 2 + (y - dm.by[b]) ** 2 + z2; l += B[b] * z2 / (Math.PI * r2 * r2); }
      out[j * n + i] = l * 1e6;
    }
    return { lux: out, cx: dm.cx, cy: dm.cy };
  }
  function taskLight(geo, E, fluxPerLed, cfg) {
    const dm = deskModel(geo, cfg), r = deskLux(dm, E, fluxPerLed * cfg.tau, cfg.roomLux);
    return { ...r, pts: dm.pts.filter(p => !p.centre).map((p, t) => ({ u: p.u, v: p.v, lux: dm.lux[t] })), cx: dm.cx, cy: dm.cy };
  }

  // ---------------------------------------------------------------- electrical / photometric
  // Cree JB2835B 3V F-class Pro9 datasheet (CDJ-DS135), p.5, 90 CRI, I_F = 65 mA: typical flux at Tj = 25 C and at
  // Tj = 85 C (lm). The temperature slope per CCT = (1 - at85/typ)/60 K (Hui & Qin 2009 Eq. 2 form, linear in Tj).
  // The brief: the J-class datasheet covers the native 3000-6500 K / 90 CRI family, but the model uses the Pro9
  // pages; do not mix the two. The board's MPN (JB2835BWT-J-U65EA...) decodes as 90 CRI, 6500 K.
  const CCT = {
    2700: { typ: 34.5, at85: 32.2 }, 3000: { typ: 36.2, at85: 33.7 }, 3500: { typ: 37.5, at85: 35.0 },
    4000: { typ: 38.0, at85: 35.4 }, 5000: { typ: 38.0, at85: 35.4 }, 5700: { typ: 37.5, at85: 35.0 }, 6500: { typ: 37.5, at85: 35.0 },
  };
  const FLUX_TOL = 0.07;   // datasheet: luminous flux measured to +/-7 %
  const LED_LIMITS = { maxI: 480, maxTj: 125, opMin: -40, opMax: 105 };   // datasheet p.4
  function ledRef(cfg) {
    const c = CCT[cfg.cct];
    const typ = c ? c.typ : cfg.refFlux, slope = c ? (1 - c.at85 / c.typ) / 60 : cfg.tempSlope;
    return { typ, slope, flux: typ * (cfg.fluxCase === 'tol' ? 1 - FLUX_TOL : 1) };
  }
  function led(cfg, Tj) {
    const I = cfg.current / 1000, Pel = cfg.vf * I, ref = ledRef(cfg);
    const derate = Math.max(0.2, 1 - ref.slope * ((Tj == null ? 25 : Tj) - 25));   // floor 0.2 [Mine]: numerical guard only
    const flux = ref.flux * (cfg.current / cfg.refI) * derate; // linear in current; derate = Hui & Qin 2009 Eq. 2
    return { I, Pel, flux };
  }
  function drive(cfg, n) {
    const strings = Math.ceil(n / cfg.perString), stringV = cfg.perString * cfg.vf, head = cfg.vddLed - stringV;
    const tlcMax = 41 * 1.21 / 820 * 1000; // mA, TLC59711 with R82 = 820 R
    return { strings, stringV, headroom: head, tlcMax, channelsOk: strings <= 12, currentOk: cfg.current <= tlcMax + 1e-9, headOk: head >= cfg.tlcKnee, full: n % cfg.perString === 0 };
  }

  // ---------------------------------------------------------------- thermal
  // Ben Tran-Pugh, "LED array heat calcs" (Notion, Aug 2026): PCB -> air gap -> PC diffuser -> room, heat through
  // the front only (his stated, conservative assumption).
  //   gap:      R_cond = L/(k_air A), R_conv = R_cond/Nu  in parallel with  R_rad = 1/(eps_PCB sigma A (T1^2+T2^2)(T1+T2))
  //   diffuser: R_PC = t/(k_PC A)
  //   outside:  R_conv,ext = 1/(h A)  in parallel with  R_rad,ext = 1/(eps_PC sigma A (T1^2+T2^2)(T1+T2))
  //   T_PCB = T_amb + Q (R_int + R_PC + R_ext)
  // His bounding cases: worst Nu = 1, h = 2 W/m2K; best Nu = 3 (Ra ~ 2.2e4), h = 25 W/m2K.
  // Hui & Qin 2009: Q = k_h * P_LED (Eq. 3), T_j = T_board + R_jc * k_h * P_d (Eq. 5a).
  const BEN = { kAir: 0.026, nu: 1.51e-5, alpha: 18.46e-6, cases: { worst: { Nu: 1, h: 2 }, best: { Nu: 3, h: 25 } } };
  function thermal(cfg, areaMm2, leds, opt) {
    opt = opt || {};
    const A = areaMm2 / 1e6, L = cfg.gap / 1000, Ta = cfg.ambient + 273.15;
    const kase = opt.thermalCase || cfg.thermalCase;
    const cs = kase === 'custom' ? { Nu: cfg.Nu, h: cfg.hOut } : BEN.cases[kase];
    const wts = opt.weights || leds.map(() => 1), Pd = led(cfg, 25).Pel;
    let wSum = 0, wMax = 0; for (const v of wts) { wSum += v; wMax = Math.max(wMax, v); }
    const Q = opt.Q != null ? opt.Q : cfg.kh * Pd * wSum;
    const Rcond = L / (BEN.kAir * A), Rconv = Rcond / cs.Nu, Rpc = (cfg.diffT / 1000) / (cfg.diffK * A), RconvExt = 1 / (cs.h * A);
    const radR = (eps, T1, T2) => 1 / (eps * SIGMA * A * (T1 * T1 + T2 * T2) * (T1 + T2));
    let Tb = Ta + 20, Tdi = Ta + 10, Tdo = Ta + 8, Rint = 0, Rext = 0, RradInt = 0, RradExt = 0;
    for (let it = 0; it < 200; it++) {
      // opt.benTemps reproduces Ben's hand calc: radiation linearised at 330/310 K inside and 310/298 K outside
      RradInt = opt.benTemps ? radR(cfg.emissBoard, 330, 310) : radR(cfg.emissBoard, Tb, Tdi);
      RradExt = opt.benTemps ? radR(cfg.emissDiff, 310, 298) : radR(cfg.emissDiff, Tdo, Ta);
      Rint = 1 / (1 / Rconv + 1 / RradInt); Rext = 1 / (1 / RconvExt + 1 / RradExt);
      const nTdo = Ta + Q * Rext, nTdi = nTdo + Q * Rpc, nTb = nTdi + Q * Rint;
      const done = Math.abs(nTb - Tb) < 1e-6;
      Tb = (Tb + nTb) / 2; Tdi = (Tdi + nTdi) / 2; Tdo = (Tdo + nTdo) / 2;
      if (done || opt.benTemps) { Tb = nTb; Tdi = nTdi; Tdo = nTdo; if (done || it > 3) break; }
    }
    const dT = Math.max(0, Tb - Tdi), Ra = G * (1 / Ta) * dT * L ** 3 / (BEN.nu * BEN.alpha);
    const Tj = Tb + cfg.rjs * cfg.kh * Pd * wMax;
    const C = T => T - 273.15;
    return { Tboard: C(Tb), Tmax: C(Tb), TjMax: C(Tj), TdIn: C(Tdi), TdOut: C(Tdo), Q, Rint, Rcond, Rconv, RradInt, Rpc, Rext, RconvExt, RradExt, Rtotal: Rint + Rpc + Rext, Ra, case: kase, Nu: cs.Nu, h: cs.h };
  }


  // ---------------------------------------------------------------- where every lumen goes (light budget)
  // Per unit LED flux, the same cos^m-on-a-plane spot as ledContrib, on the diffuser plane at the optical height. Categories:
  //   diffuser  - lands on the lit aperture (out through the diffuser = x tau; the rest is absorbed/scattered back)
  //   annulus   - lands in the open ring between the camera barrel (r) and the diffuser hole (holeR): leaves the head
  //               as direct, undiffused light (STEP: open to the room)
  //   camera    - lands on the barrel top or is blocked by the barrel on its way (absorbed, dark camera)
  //   walls     - everything else: hits the drafted walls, the 43-degree chamfer or the lip (opaque dark PLA: absorbed)
  // Board windows, edge gap and screw holes have no line of sight from the LEDs (STEP); seams are sealed (user).
  function lightBudget(cfg, geo, leds, wts) {
    const h = cfg.gap - (cfg.ledH || 0), h2 = h * h, m = cfg.m, A = geo.res * geo.res;
    const c0 = (m + 1) / (2 * Math.PI) * Math.pow(h, m + 1), pw = -(m + 3) / 2;
    const Ef = r2 => m === 1 ? c0 / (r2 * r2) : c0 * Math.pow(r2, pw);
    const K = geo.keep, camOn = geo.keepOn, occ = camOn && K.occlude, hr = K.holeR || K.r;
    let W = 0, D = 0, Dno = 0, An = 0, Bt = 0;
    leds.forEach((p, i) => {
      const w = wts ? wts[i] : 1; if (!w) return; W += w;
      let d = 0, dno = 0;
      for (let c = 0; c < geo.nD; c++) {
        if (geo.camMask[c]) continue;
        const ddx = geo.dx[c] - p.x, ddy = geo.dy[c] - p.y, e = Ef(ddx * ddx + ddy * ddy + h2) * A;
        dno += e; if (!(occ && segHitsCircle(p.x, p.y, geo.dx[c], geo.dy[c], K))) d += e;
      }
      let an = 0, bt = 0;
      if (camOn) {
        const NA = 96;
        for (let a = 0; a < NA; a++) {
          const th = (a + 0.5) / NA * 2 * Math.PI, ca = Math.cos(th), sa = Math.sin(th);
          for (let k = 0; k < 6; k++) { // barrel top disk
            const r = (k + 0.5) / 6 * K.r, x = K.x + r * ca, y = K.y + r * sa, dA = r * (K.r / 6) * (2 * Math.PI / NA);
            bt += Ef((x - p.x) ** 2 + (y - p.y) ** 2 + h2) * dA;
          }
          for (let k = 0; k < 4; k++) { // open ring
            const r = K.r + (k + 0.5) / 4 * (hr - K.r), x = K.x + r * ca, y = K.y + r * sa, dA = r * ((hr - K.r) / 4) * (2 * Math.PI / NA);
            const e = Ef((x - p.x) ** 2 + (y - p.y) ** 2 + h2) * dA;
            if (occ && segHitsCircle(p.x, p.y, x, y, { x: K.x, y: K.y, r: K.r * 0.999 })) bt += e; else an += e;
          }
        }
      }
      D += w * d; Dno += w * dno; An += w * an; Bt += w * (bt + dno - d);
    });
    if (!W) return null;
    const f = { diffuser: D / W, annulus: An / W, camera: Bt / W };
    f.walls = Math.max(0, 1 - f.diffuser - f.annulus - f.camera);
    f.out = f.diffuser * cfg.tau; f.diffLoss = f.diffuser * (1 - cfg.tau);
    return f;
  }

  // ---------------------------------------------------------------- full heat map of the board
  // Back-cavity depth (mm) from the board back face to Head Back, STEP ray cast on a 5 mm grid, x -65..65, y -35..65
  // (-1 = outside the board). Source: context/step_extract/head_geometry.json back_cavity.height_map_5mm.
  const BACK_GAP = '-1,-1,-1,-1,-1,-1,-1,-1,-1,14.0,11.8,10.3,9.4,9.1,9.4,10.3,11.8,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,6.1,5.1,43.6,29.0,21.8,17.0,13.6,11.1,9.4,8.4,8.1,8.4,9.4,11.1,13.6,17.0,21.8,29.0,43.5,5.1,6.1,-1,-1,-1,-1,-1,37.2,56.7,5.0,43.6,27.9,20.8,16.0,12.5,10.0,8.3,7.4,7.1,7.4,8.3,10.0,12.5,16.0,20.8,27.9,43.6,5.0,56.5,-1,-1,-1,-1,37.1,58.4,66.4,71.7,42.6,26.8,19.7,14.9,11.4,9.0,7.3,6.3,6.0,6.3,7.3,9.0,11.4,14.9,19.7,26.8,42.6,71.6,66.3,58.3,36.5,-1,23.7,55.9,65.7,71.9,76.4,41.6,25.8,19.2,15.6,15.1,15.1,15.1,15.1,15.1,15.1,15.1,15.1,15.1,15.6,19.2,25.8,41.5,76.4,71.9,65.6,55.6,23.0,45.5,62.2,70.1,75.5,79.6,43.8,38.6,38.6,38.6,38.6,38.6,38.6,38.6,38.6,38.6,38.6,38.6,38.6,38.6,38.6,38.6,43.8,79.6,75.5,70.0,62.1,45.3,54.0,65.7,72.7,77.8,81.7,84.7,86.9,62.1,62.1,62.1,62.1,62.1,62.1,62.1,62.1,62.1,62.1,62.1,62.1,62.1,86.8,84.6,81.7,77.8,72.7,65.7,53.9,57.1,67.5,74.2,79.1,82.9,85.7,87.9,89.4,90.4,90.8,91.0,91.0,91.1,91.1,91.1,91.0,90.9,90.8,90.4,89.4,-1,-1,-1,-1,74.2,67.5,57.0,57.8,68.0,74.6,79.4,83.2,86.0,88.2,89.7,90.6,91.1,91.2,91.2,91.3,91.3,91.3,91.2,91.2,91.0,90.6,89.7,88.1,86.0,83.1,79.4,74.6,68.0,57.7,56.5,67.2,74.0,78.9,82.7,85.6,87.7,89.2,90.2,90.6,90.7,90.8,90.8,90.8,90.8,90.8,90.7,90.6,90.2,89.2,87.7,85.5,82.6,78.9,74.0,67.2,56.5,52.6,65.0,72.3,77.4,81.3,84.3,86.5,88.1,89.1,89.5,89.6,89.6,89.6,89.6,89.6,89.6,89.5,89.5,-1,-1,86.5,84.3,81.3,77.4,-1,-1,-1,45.1,61.4,69.4,74.9,79.0,82.2,84.5,86.1,87.2,87.6,87.6,87.6,87.6,87.6,87.6,87.6,87.6,87.6,87.1,86.1,84.5,82.2,79.0,74.9,69.4,61.4,45.0,-1,56.3,65.5,71.6,76.0,79.3,81.7,83.4,84.5,84.9,84.9,84.9,84.9,84.9,84.9,84.9,84.9,84.9,84.4,83.4,81.7,79.3,76.0,71.5,65.5,56.3,-1,-1,48.6,60.5,67.4,72.2,75.7,78.3,80.1,81.3,81.7,81.8,81.8,81.8,81.8,81.8,81.8,81.8,81.7,81.2,80.2,78.3,75.8,72.2,67.4,60.5,48.5,-1,-1,25.7,53.6,62.1,67.6,71.5,74.4,76.3,77.5,78.1,78.1,78.1,78.1,78.1,78.1,78.1,78.1,78.0,77.5,76.3,74.3,71.5,67.6,62.1,53.7,25.7,-1,-1,-1,42.1,55.1,61.8,66.5,69.6,71.8,73.2,73.8,73.9,73.9,73.9,73.9,73.9,73.9,73.9,73.9,73.2,71.8,69.6,66.5,61.8,55.1,42.2,-1,-1,-1,-1,-1,44.4,54.3,60.1,63.9,66.5,68.1,68.9,69.1,69.1,69.1,69.1,69.1,69.1,69.1,68.9,68.1,66.5,63.9,60.1,54.3,44.4,-1,-1,-1,-1,-1,-1,-1,42.8,51.6,5.0,60.0,62.0,63.1,63.5,63.5,63.5,63.5,63.5,63.5,63.5,63.1,62.0,59.9,5.0,51.6,42.8,-1,-1,-1,-1,-1,-1,-1,-1,-1,5.2,0.1,51.6,54.5,56.1,56.7,56.8,56.8,56.8,56.8,56.8,56.7,56.1,54.5,51.6,0.4,5.2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,6.2,39.1,44.2,47.0,48.3,48.5,48.6,48.5,48.5,48.5,48.3,47.0,44.2,39.2,6.2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,32.8,36.2,37.6,37.7,37.7,37.7,37.5,36.2,32.8,-1,-1,-1,-1,-1,-1,-1,-1,-1'.split(',').map(Number);
  function backGapAt(x, y) {
    const fx = (x + 65) / 5, fy = (y + 35) / 5, i = Math.max(0, Math.min(26, Math.round(fx))), j = Math.max(0, Math.min(20, Math.round(fy)));
    let best = -1, bd = Infinity; // nearest valid grid point
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii > 26 || jj > 20) continue;
      const v = BACK_GAP[jj * 27 + ii]; if (v < 0) continue;
      const d = (ii - fx) ** 2 + (jj - fy) ** 2; if (d < bd) { bd = d; best = v; }
    }
    return best < 0 ? 59.1 : best;   // 59.1 = STEP mean
  }
  // STEP areas (mm2) and the board mounts
  const CAD = {
    backIn: 41036, backOut: 36467, frontIn: 9186,
    // bosses touching the board: 4 Head Back bosses (z -10..-5, L 5 mm) and 2 Head Front bosses (z 0..3, L 3 mm). The front
    // ones end in Head Front, which is butt-joined to Head Back (1,259 mm2, STEP); both shells are lumped into one node [Mine].
    bosses: [{ x: -37.92, y: 54.95, a: 54.25, L: 5 }, { x: 37.63, y: 55.02, a: 56.0, L: 5 }, { x: 47.54, y: -28.57, a: 53.0, L: 5 }, { x: -48.23, y: -28.52, a: 52.48, L: 5 },
      { x: -36.658, y: 53.885, a: 62.13, L: 3 }, { x: 36.299, y: 53.885, a: 62.13, L: 3 }],
    padA: 6.47,  // recommended PCB footprint, Pro9 p.23: 2.26 x 2.08 + 0.85 x 2.08 mm (heat assumed to cross the dielectric over it)
  };
  // Model: a 2-D grid over the board (mapRes mm). Each cell exchanges heat with its 4 neighbours through the board
  // (in-plane conductance = k t of the base + copper, Fourier's law), and loses heat
  //   front: Ben's network per unit area (air gap Nu, PC diffuser, outside h + radiation), as in thermal()
  //   back:  across the back cavity, local depth L from the STEP: k_air Nu / L (Ben's Nu for the case) + radiation
  //          (board back emissivity, shell 0.9) to the Head Back inner surface node, then through the 3 mm PLA wall and
  //          outside convection (Ben's h) + radiation over the STEP room-facing area
  //   mounts: PLA bosses (STEP contact areas, 5 mm tall) into the same Head Back node.
  // Heat in: each LED k_h P (Hui & Qin), plus the electronics (elecW, camera share on its footprint).
  // Solved with conjugate gradients; radiation re-linearised over 4 outer iterations. Tj = T_cell + P (Rjs + R_diel).
  // Not modelled: the Head Front walls and front-cavity air paths besides Ben's 1-D path, air flow between the cavities
  // through the board windows/edge gap, heat from light absorbed on the walls, contact resistances.
  function thermalMap(cfg, leds, opt) {
    opt = opt || {};
    const pc = cfg.pcb, res = cfg.mapRes || 2, poly = outline(cfg), Ta = cfg.ambient + 273.15;
    const kase = opt.thermalCase || cfg.thermalCase, cs = kase === 'custom' ? { Nu: cfg.Nu, h: cfg.hOut } : BEN.cases[kase];
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const [x, y] of poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const nx = Math.ceil((x1 - x0) / res), ny = Math.ceil((y1 - y0) / res), id = new Int32Array(nx * ny).fill(-1), cx = [], cy = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const x = x0 + (i + 0.5) * res, y = y0 + (j + 0.5) * res; if (pointInPoly(poly, x, y)) { id[j * nx + i] = cx.length; cx.push(x); cy.push(y); } }
    const N = cx.length, areaMm2 = polyArea(poly), Ab = areaMm2 * 1e-6, Ac = Ab / N;   // cell area scaled so the cells sum to the board area
    // FR4 comparison: 1.6 mm, in-plane k 0.8 W/mK (typical laminate value, ASSUMED) + the copper layer
    const fr4 = pc.type === 'fr4', kt = fr4 ? 0.8 * 1.6e-3 + pc.kCu * pc.tCu * 1e-3 : pc.kBase * pc.tBase * 1e-3 + pc.kCu * pc.tCu * 1e-3;
    const cellOf = (x, y) => { const i = Math.floor((x - x0) / res), j = Math.floor((y - y0) / res); return i < 0 || j < 0 || i >= nx || j >= ny ? -1 : id[j * nx + i]; };
    const nearest = (x, y) => { let c = cellOf(x, y); if (c >= 0) return c; let b = 0, bd = Infinity; for (let k = 0; k < N; k++) { const d = (cx[k] - x) ** 2 + (cy[k] - y) ** 2; if (d < bd) { bd = d; b = k; } } return b; };
    // heat sources
    const q = new Float64Array(N), wts = opt.weights || leds.map(() => 1), Pd = led(cfg, 25).Pel, ledCell = leds.map(p => nearest(p.x, p.y));
    let Qled = 0; leds.forEach((p, i) => { const w = cfg.kh * Pd * wts[i]; q[ledCell[i]] += w; Qled += w; });
    const K = cfg.keep, camW = K.on ? Math.min(cfg.camW || 0, cfg.elecW || 0) : 0, rest = (cfg.elecW || 0) - camW;
    const camCells = []; if (camW > 0) for (let k = 0; k < N; k++) if (K.mod && modDist(K, cx[k], cy[k]) <= 0) camCells.push(k);
    // named hot spots (e.g. SoC, DC/DC) on a square of side s; the remainder spread evenly
    let spotW = 0;
    for (const sp of (cfg.elecSpots || [])) {
      const half = Math.max(res / 2, (sp.s || 10) / 2), cells = [];
      for (let k = 0; k < N; k++) if (Math.abs(cx[k] - sp.x) <= half && Math.abs(cy[k] - sp.y) <= half) cells.push(k);
      if (!cells.length) cells.push(nearest(sp.x, sp.y));
      const w = Math.max(0, +sp.w || 0); cells.forEach(k => { q[k] += w / cells.length; }); spotW += w;
    }
    const evenW = Math.max(0, rest - spotW);
    for (let k = 0; k < N; k++) q[k] += evenW / N;
    if (camW > 0) { if (camCells.length) camCells.forEach(k => { q[k] += camW / camCells.length; }); else for (let k = 0; k < N; k++) q[k] += camW / N; }
    const Qtot = Qled + camW + spotW + evenW;   // = LEDs + elecW (unless the spots exceed it)
    // back cavity depth per cell (m), boss contacts
    const Lb = new Float64Array(N); for (let k = 0; k < N; k++) Lb[k] = Math.max(5, backGapAt(cx[k], cy[k])) * 1e-3;
    const gBoss = new Float64Array(N); if (!opt.noBack) for (const b of CAD.bosses) {
      // boss column L/(kA) in series with radial spreading into the 3 mm shell wall, ln(Reff/rb)/(2 pi k t) [Textbook],
      // rb = 4.3 mm (boss radius, STEP), Reff = radius of an equal share of the shell's inner area (ASSUMED share)
      const Reff = Math.sqrt(CAD.backIn / (Math.PI * CAD.bosses.length)), Rsp = Math.log(Reff / 4.3) / (2 * Math.PI * (cfg.shellK || cfg.kPla) * 3e-3);
      gBoss[nearest(b.x, b.y)] += 1 / ((b.L * 1e-3) / ((cfg.bossK || cfg.kPla) * b.a * 1e-6) + Rsp);
    }
    // shell: inner node -> wall -> outside
    const Aout = CAD.backOut * 1e-6, Ain = CAD.backIn * 1e-6, Rwall = 3e-3 / ((cfg.shellK || cfg.kPla) * Ain);
    const T = new Float64Array(N + 1).fill(Ta + 30); // last entry = Head Back inner surface
    const gF = new Float64Array(N), gB = new Float64Array(N);
    let th = null, Qf = Qtot * 0.8, GBA = 0, iters = 0, hOutLast = 0;
    const nb = []; // neighbour lists
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const k = id[j * nx + i]; if (k < 0) continue; const l = []; if (i + 1 < nx && id[j * nx + i + 1] >= 0) l.push(id[j * nx + i + 1]); if (i > 0 && id[j * nx + i - 1] >= 0) l.push(id[j * nx + i - 1]); if (j + 1 < ny && id[(j + 1) * nx + i] >= 0) l.push(id[(j + 1) * nx + i]); if (j > 0 && id[(j - 1) * nx + i] >= 0) l.push(id[(j - 1) * nx + i]); nb[k] = l; }
    if (opt.T0 && opt.T0.length === N + 1) T.set(opt.T0);   // warm start from a previous solution
    const aggN = Math.max(1, Math.round(10 / res)), anx = Math.ceil(nx / aggN), aggId = new Map(), agg = new Int32Array(N);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const k = id[j * nx + i]; if (k < 0) continue; const key = Math.floor(j / aggN) * anx + Math.floor(i / aggN); if (!aggId.has(key)) aggId.set(key, aggId.size); agg[k] = aggId.get(key); }
    const nAgg = aggId.size;
    const epsEff = 1 / (1 / pc.epsBack + 1 / cfg.epsShell - 1);
    for (let outer = 0; outer < (opt.outer || 4); outer++) {
      th = thermal(cfg, areaMm2, leds, { weights: wts, thermalCase: kase, Q: Math.max(1e-3, Qf) });
      const Rpp = (th.Rint + th.Rpc + th.Rext) * Ab;        // m2K/W, Ben's 1-D front path per unit area
      const TB = T[N];
      let Tsum = 0; for (let k = 0; k < N; k++) Tsum += T[k];
      const Tm = Tsum / N, ToutS = Ta + (TB - Ta) * 0.5;   // [Mine] outer-surface guess only for linearising its radiation
      const hRadOut = cfg.epsShell * SIGMA * (ToutS * ToutS + Ta * Ta) * (ToutS + Ta);
      hOutLast = cs.h + hRadOut;
      GBA = opt.noBack ? 0 : 1 / (Rwall + 1 / (hOutLast * Aout));
      for (let k = 0; k < N; k++) {
        gF[k] = Ac / Rpp;
        if (opt.noBack) { gB[k] = 0; continue; }
        const Tk = T[k], hr = epsEff * SIGMA * (Tk * Tk + TB * TB) * (Tk + TB);
        gB[k] = Ac * (BEN.kAir * cs.Nu / Lb[k] + hr);
      }
      // conjugate gradients on  A T = b  (A symmetric positive definite), Jacobi preconditioner
      const diag = new Float64Array(N + 1), b = new Float64Array(N + 1);
      let gBsum = 0;
      for (let k = 0; k < N; k++) { const gb = gB[k] + gBoss[k]; diag[k] = nb[k].length * kt + gF[k] + gb; b[k] = q[k] + gF[k] * Ta; gBsum += gb; }
      diag[N] = gBsum + GBA + (opt.noBack ? 1 : 0); b[N] = GBA * Ta + (opt.noBack ? Ta : (cfg.motorW || 0));
      const Amul = (x, out) => {
        let sB = 0;
        for (let k = 0; k < N; k++) { let v = diag[k] * x[k]; for (const n of nb[k]) v -= kt * x[n]; const gb = gB[k] + gBoss[k]; v -= gb * x[N]; sB += gb * x[k]; out[k] = v; }
        out[N] = diag[N] * x[N] - sB;
      };
      // two-level preconditioner: Jacobi + an exact solve on 10 mm aggregates (the aluminium makes the board nearly
      // isothermal, which plain Jacobi resolves slowly); additive, so it stays symmetric positive definite
      const nC = nAgg + 1, Ac2 = new Float64Array(nC * nC);
      for (let k = 0; k < N; k++) {
        const a = agg[k], gb = gB[k] + gBoss[k];
        Ac2[a * nC + a] += diag[k]; for (const n of nb[k]) Ac2[a * nC + agg[n]] -= kt;
        Ac2[a * nC + nAgg] -= gb; Ac2[nAgg * nC + a] -= gb;
      }
      Ac2[nAgg * nC + nAgg] += diag[N];
      const LU = Ac2.slice(), piv = new Int32Array(nC);   // LU with partial pivoting
      for (let c = 0; c < nC; c++) { let pm = c, mv = Math.abs(LU[c * nC + c]); for (let r2 = c + 1; r2 < nC; r2++) { const v = Math.abs(LU[r2 * nC + c]); if (v > mv) { mv = v; pm = r2; } } piv[c] = pm;
        if (pm !== c) for (let k2 = 0; k2 < nC; k2++) { const t2 = LU[c * nC + k2]; LU[c * nC + k2] = LU[pm * nC + k2]; LU[pm * nC + k2] = t2; }
        const d0 = LU[c * nC + c]; for (let r2 = c + 1; r2 < nC; r2++) { const f2 = LU[r2 * nC + c] / d0; if (!f2) continue; LU[r2 * nC + c] = f2; for (let k2 = c + 1; k2 < nC; k2++) LU[r2 * nC + k2] -= f2 * LU[c * nC + k2]; } }
      const rc = new Float64Array(nC);
      const precond = (rr, zz) => {
        rc.fill(0); for (let k = 0; k < N; k++) rc[agg[k]] += rr[k]; rc[nAgg] += rr[N];
        for (let c = 0; c < nC; c++) { const pm = piv[c]; if (pm !== c) { const t2 = rc[c]; rc[c] = rc[pm]; rc[pm] = t2; } for (let r2 = c + 1; r2 < nC; r2++) rc[r2] -= LU[r2 * nC + c] * rc[c]; }
        for (let c = nC - 1; c >= 0; c--) { let v = rc[c]; for (let k2 = c + 1; k2 < nC; k2++) v -= LU[c * nC + k2] * rc[k2]; rc[c] = v / LU[c * nC + c]; }
        for (let k = 0; k < N; k++) zz[k] = rr[k] / diag[k] + rc[agg[k]]; zz[N] = rr[N] / diag[N] + rc[nAgg];
      };
      const r = new Float64Array(N + 1), z = new Float64Array(N + 1), p = new Float64Array(N + 1), Ap = new Float64Array(N + 1);
      Amul(T, Ap); for (let k = 0; k <= N; k++) r[k] = b[k] - Ap[k]; precond(r, z); for (let k = 0; k <= N; k++) p[k] = z[k];
      let rz = 0; for (let k = 0; k <= N; k++) rz += r[k] * z[k];
      const bn = Math.sqrt(b.reduce((a, v) => a + v * v, 0));
      for (let it = 0; it < 6000; it++) {
        Amul(p, Ap); let pAp = 0; for (let k = 0; k <= N; k++) pAp += p[k] * Ap[k];
        const al = rz / pAp; let rn = 0;
        for (let k = 0; k <= N; k++) { T[k] += al * p[k]; r[k] -= al * Ap[k]; rn += r[k] * r[k]; }
        iters++; if (Math.sqrt(rn) < 1e-9 * bn) break;
        precond(r, z); let rz2 = 0; for (let k = 0; k <= N; k++) rz2 += r[k] * z[k];
        const be = rz2 / rz; rz = rz2; for (let k = 0; k <= N; k++) p[k] = z[k] + be * p[k];
      }
      Qf = 0; for (let k = 0; k < N; k++) Qf += gF[k] * (T[k] - Ta);
    }
    // results
    let Tmax = -Infinity, Tmin = Infinity, Tsum = 0, Qb = 0, Qm = 0, kMax = 0, TdMax = -Infinity, Tboss = -Infinity;
    const Rext = th.Rext * Ab, Tdo = new Float64Array(N);
    for (let k = 0; k < N; k++) {
      if (T[k] > Tmax) { Tmax = T[k]; kMax = k; } Tmin = Math.min(Tmin, T[k]); Tsum += T[k];
      Qb += gB[k] * (T[k] - T[N]); Qm += gBoss[k] * (T[k] - T[N]);
      Tdo[k] = Ta + gF[k] * (T[k] - Ta) / Ac * Rext;   // diffuser outer surface over this cell (Ben's outside resistance)
      TdMax = Math.max(TdMax, Tdo[k]);
      if (gBoss[k] > 0) Tboss = Math.max(Tboss, T[k]);
    }
    const Rdiel = pc.tDiel * 1e-3 / (pc.kDiel * CAD.padA * 1e-6);
    const Tj = leds.map((p, i) => T[ledCell[i]] + cfg.kh * Pd * wts[i] * (cfg.rjs + (fr4 ? 0 : Rdiel)));
    const C = v => v - 273.15;
    return {
      cells: { x: Float32Array.from(cx), y: Float32Array.from(cy), res, T: Float64Array.from(T.subarray(0, N), C), Tdo: Float64Array.from(Tdo, C) },
      // Head Back outer surface (lumped): heat through the shell node -> outside resistance
      TshellOut: opt.noBack ? NaN : C(Ta + GBA * (T[N] - Ta) / (hOutLast * Aout)),
      Tmax: C(Tmax), Tmin: C(Tmin), Tavg: C(Tsum / N), hot: { x: cx[kMax], y: cy[kMax] },
      Tj: Tj.map(C), TjMax: Tj.length ? C(Math.max(...Tj)) : NaN, TshellIn: C(T[N]), TdOutMax: C(TdMax), Tboss: Tboss > -Infinity ? C(Tboss) : NaN,
      Q: { total: Qtot, led: Qled, elec: camW + spotW + evenW, front: Qf, back: Qb, mounts: Qm },
      // lumped conductances (W/K) for the warm-up model: board -> shell (cavity + bosses), shell -> room
      G: { bs: (Qb + Qm) / Math.max(1e-6, Tsum / N - T[N]), sa: GBA }, case: kase, Rdiel, kt, ben: th, iters, Tk: Float64Array.from(T),
    };
  }


  // ---------------------------------------------------------------- warm-up (transient) - lumped 3-node RC model
  // Nodes: board (aluminium base), diffuser (PC), shell (Head Back + Head Front, PLA). Conductances: board -> diffuser =
  // Ben's air-gap resistance, diffuser -> room = Ben's PC + outside resistances (from the steady map's front path);
  // board -> shell and shell -> room from the steady map. Heat capacities from the STEP volumes and textbook (ASSUMED)
  // material values: Al 2700 kg/m3 x 900 J/kgK; PC 1200 x 1200; PLA 1240 x 1800. Implicit Euler.
  // The hottest point is the board average plus the steady (max - average) offset, scaled with the rise.
  const HEATCAP = { al: 2700 * 900, pc: 1200 * 1200, pla: 1240 * 1800, vDiff: 10708e-9, vShell: (169590 + 27024) * 1e-9 };
  function warmUp(cfg, map, opt) {
    opt = opt || {};
    const Ta = cfg.ambient, ben = map.ben, Ab = polyArea(outline(cfg)) * 1e-6;
    const Cb = HEATCAP.al * Ab * (cfg.pcb.type === 'fr4' ? 1.6e-3 * 1850 * 1100 / HEATCAP.al : cfg.pcb.tBase * 1e-3);   // FR4: 1850 kg/m3 x 1100 (ASSUMED)
    const Cd = HEATCAP.pc * HEATCAP.vDiff, Cs = HEATCAP.pla * HEATCAP.vShell;
    const Gbd = 1 / ben.Rint, Gda = 1 / (ben.Rpc + ben.Rext), Gbs = map.G.bs, Gsa = map.G.sa || 1e-9, Q = map.Q.total;
    const dt = opt.dt || 5, tEnd = opt.tEnd || 4 * 3600;
    let Tb = Ta, Td = Ta, Ts = Ta;
    const out = { t: [], board: [], hot: [], diffuser: [], shell: [] };
    const off = map.Tmax - map.Tavg, rise = Math.max(1e-6, map.Tavg - Ta);
    for (let t = 0; t <= tEnd; t += dt) {
      if (t % 30 === 0) { out.t.push(t); out.board.push(Tb); out.hot.push(Tb + off * (Tb - Ta) / rise); out.diffuser.push(Td); out.shell.push(Ts); }
      // implicit Euler: solve the 3x3 linear system for the next step (Cramer's rule)
      const a11 = Cb / dt + Gbd + Gbs, a12 = -Gbd, a13 = -Gbs, b1 = Cb / dt * Tb + Q;
      const a21 = -Gbd, a22 = Cd / dt + Gbd + Gda, a23 = 0, b2 = Cd / dt * Td + Gda * Ta;
      const a31 = -Gbs, a32 = 0, a33 = Cs / dt + Gbs + Gsa, b3 = Cs / dt * Ts + Gsa * Ta;
      const det = a11 * (a22 * a33 - a23 * a32) - a12 * (a21 * a33 - a23 * a31) + a13 * (a21 * a32 - a22 * a31);
      Tb = (b1 * (a22 * a33 - a23 * a32) - a12 * (b2 * a33 - a23 * b3) + a13 * (b2 * a32 - a22 * b3)) / det;
      Td = (a11 * (b2 * a33 - a23 * b3) - b1 * (a21 * a33 - a23 * a31) + a13 * (a21 * b3 - b2 * a31)) / det;
      Ts = (a11 * (a22 * b3 - b2 * a32) - a12 * (a21 * b3 - b2 * a31) + b1 * (a21 * a32 - a22 * a31)) / det;
    }
    const fin = out.board[out.board.length - 1], at = f => { for (let i = 0; i < out.t.length; i++) if (out.board[i] - Ta >= f * (fin - Ta)) return out.t[i]; return NaN; };
    out.t63 = at(0.632); out.t95 = at(0.95); out.C = { board: Cb, diffuser: Cd, shell: Cs };
    return out;
  }

  // ---------------------------------------------------------------- passive-cooling what-ifs (same heat map, one change each)
  // Each changes one input; material values are typical textbook values (ASSUMED), labelled in the UI.
  const WHATIFS = [
    { key: 'paint', passive: true, name: 'Board back painted / anodised black', note: 'emissivity 0.1 → 0.9 (bare vs black-anodised aluminium, typical)', apply: c => { c.pcb.epsBack = 0.9; } },
    { key: 'standoffs', passive: true, name: 'Aluminium standoffs instead of PLA bosses', note: 'boss k 0.13 → 138 W/m·K', apply: c => { c.bossK = 138; } },
    { key: 'pcShell', passive: true, name: 'Head Back in PC instead of PLA', note: 'wall k 0.13 → 0.2 W/m·K (Ben\'s PC value)', apply: c => { c.shellK = 0.2; } },
    { key: 'alShell', passive: true, name: 'Head Back in aluminium', note: 'wall k → 138 W/m·K; outside emissivity 0.85 (anodised, typical)', apply: c => { c.shellK = 138; c.epsShell = 0.85; } },
    { key: 'typical', name: 'Electronics at typical power', note: 'your table: 2.0 W instead of 4.6 W worst case', apply: c => { c.elecW = 2.0; c.camW = Math.min(c.camW, 0.33); } },
    { key: 'noElec', name: 'Electronics off this board', note: 'LED heat only (as in Ben\'s calc)', apply: c => { c.elecW = 0; c.camW = 0; c.elecSpots = []; } },
    { key: 'combo', passive: true, name: 'Black back + aluminium standoffs + Al Head Back', note: 'the three passive changes together', apply: c => { c.pcb.epsBack = 0.9; c.bossK = 138; c.shellK = 138; c.epsShell = 0.85; } },
  ];
  function whatIf(cfg, leds, key, opt) {
    const w = WHATIFS.find(x => x.key === key), c = clone(cfg); if (w) w.apply(c);
    return thermalMap(c, leds, opt);
  }

  // ---------------------------------------------------------------- uncertainty: one assumed input at a time, low / high
  // Ranges: typical spreads for the values marked ASSUMED, plus Ben's two air-movement bounds and your power range.
  const UNCERTAIN = [
    { name: 'Air movement (Ben\'s cases)', src: 'Ben: Nu 1–3, h 2–25', lo: c => { c.thermalCase = 'best'; }, hi: c => { c.thermalCase = 'worst'; } },
    { name: 'Electronics power', src: 'your table: 2.0 typical – 4.6 W worst', lo: c => { c.elecW = 2.0; c.camW = Math.min(c.camW, 0.33); }, hi: c => { c.elecW = 4.6; } },
    { name: 'Board back emissivity', src: 'bare 0.05 – painted 0.9 (finish unknown)', lo: c => { c.pcb.epsBack = 0.05; }, hi: c => { c.pcb.epsBack = 0.9; } },
    { name: 'Aluminium thickness', src: 'MCPCB 1.0–2.0 mm (stack-up unknown)', lo: c => { c.pcb.tBase = 1.0; }, hi: c => { c.pcb.tBase = 2.0; } },
    { name: 'PLA conductivity', src: '0.10–0.20 W/m·K (filament unknown)', lo: c => { c.kPla = 0.10; }, hi: c => { c.kPla = 0.20; } },
    { name: 'Shell emissivity', src: '0.80–0.95', lo: c => { c.epsShell = 0.80; }, hi: c => { c.epsShell = 0.95; } },
    { name: 'LED heat share k_h', src: 'Hui & Qin: 0.85; Qin & Hui: 85–90 %', lo: c => { c.kh = 0.80; }, hi: c => { c.kh = 0.90; } },
    { name: 'Room temperature', src: '20–30 °C', lo: c => { c.ambient = 20; }, hi: c => { c.ambient = 30; } },
    { name: 'Dielectric k (chip only)', src: 'MCPCB 1–3 W/m·K', lo: c => { c.pcb.kDiel = 3; }, hi: c => { c.pcb.kDiel = 1; }, chipOnly: true },
  ];
  function uncertainRun(cfg, leds, i, side, opt) {
    const c = clone(cfg); UNCERTAIN[i][side](c);
    return thermalMap(c, leds, opt);
  }

  // ---------------------------------------------------------------- lowest current meeting the light targets
  // Restores the old program's current sweep (optimizeCurrent: lowest input power meeting all constraints). With no
  // driver-loss or fan model, LED power rises monotonically with current, so "lowest power" = "lowest current".
  // Light out and desk lux scale with flux, which depends on current and (via Tj) on the board temperature.
  // opt: { weights, lmPerFlux, luxPerFlux } with lmPerFlux = n*util*tau (light out per lm/LED),
  // luxPerFlux = lamp-only desk minimum per lm/LED (room light cfg.roomLux is added on top). Steps of 0.5 mA up to the TLC59711 limit.
  // Lowest current (0.5 mA steps up to the driver limit) meeting the light-out and desk targets. Each step derates the
  // flux at the full heat map's hottest LED chip. Light rises with current, so the grid is bisected (about 7 map solves);
  // opt.full evaluates every step (used by the checks to confirm the bisection). areaMm2 is unused (kept for callers).
  function sweepCurrent(cfg, areaMm2, leds, opt) {
    const tlcMax = drive(cfg, leds.length).tlcMax, grid = [];
    for (let I = 1; I <= tlcMax + 1e-9; I += 0.5) grid.push(I);
    const wSum = (opt.weights || leds.map(() => 1)).reduce((a, b) => a + b, 0), memo = new Map();
    const at = i => {
      if (memo.has(i)) return memo.get(i);
      const c = clone(cfg); c.current = grid[i];
      const th = thermalMap(c, leds, { weights: opt.weights, thermalCase: opt.thermalCase }), L = led(c, th.TjMax);
      const row = { I: grid[i], lm: L.flux * opt.lmPerFlux, lux: L.flux * opt.luxPerFlux + (cfg.roomLux || 0), P: wSum * L.Pel, Tboard: th.Tmax, TjMax: th.TjMax };
      row.ok = row.lm >= cfg.targetLm && (!opt.luxPerFlux || row.lux >= cfg.targetLux);
      memo.set(i, row); return row;
    };
    let best = null;
    if (opt.full) { for (let i = 0; i < grid.length; i++) { const r = at(i); if (r.ok && !best) best = r; } }
    else if (grid.length && at(grid.length - 1).ok) {
      let lo = -1, hi = grid.length - 1;   // at(hi) ok; at(lo) not ok (or below the grid)
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (at(mid).ok) hi = mid; else lo = mid; }
      best = at(hi); if (hi > 0) at(hi - 1);
    }
    const rows = [...memo.values()].sort((a, b) => a.I - b.I);
    return { best, rows, tlcMax };
  }


  // ---------------------------------------------------------------- constraint checklist
  // Restores the old program's checklist (lumens, lux, board, junction, shell, power, uniform, placement, driver,
  // rating). Each item names where its limit comes from. s = { lm, deskMin, evenness, Tboard, TjMax, TdOut, P, bad, drv }
  function checklist(cfg, s) {
    const d = s.drv, L = [];
    const add = (k, ok, val, lim, src) => L.push({ k, ok, val, lim, src });
    add('Light out', s.lm >= cfg.targetLm, s.lm.toFixed(0) + ' lm', '≥ ' + cfg.targetLm + ' lm', 'Brief (provisional 300 lm)');
    if (s.deskMin != null) add('Desk light (min)', s.deskMin >= cfg.targetLux, s.deskMin.toFixed(0) + ' lx' + (cfg.roomLux ? ` (incl. ${cfg.roomLux} room)` : ''), '≥ ' + cfg.targetLux + ' lx', "Ben's Notion target (EN 12464-1)");
    add('Evenness', s.evenness * 100 >= cfg.targetUniformPct, (s.evenness * 100).toFixed(0) + ' %', '≥ ' + cfg.targetUniformPct + ' %', 'Brief (provisional 65 %)');
    if (s.Tboard != null) {
      add('Board temperature', s.Tboard <= cfg.maxBoard, s.Tboard.toFixed(1) + ' °C', '≤ ' + cfg.maxBoard + ' °C', 'Brief (provisional 40°C goal)');
      add('LED junction', s.TjMax <= LED_LIMITS.maxTj, s.TjMax.toFixed(1) + ' °C', '≤ ' + LED_LIMITS.maxTj + ' °C', 'Cree Pro9 datasheet p.4 (Tj max)');
      if (s.Tboss != null && Number.isFinite(s.Tboss)) add('PLA bosses touching the board', s.Tboss <= cfg.plaMax, s.Tboss.toFixed(1) + ' °C', '≤ ' + cfg.plaMax + ' °C', 'PLA glass transition ≈ 55–60 °C (textbook); bosses from the STEP');
      if (s.TshellIn != null) add('Head Back inside (PLA)', s.TshellIn <= cfg.plaMax, s.TshellIn.toFixed(1) + ' °C', '≤ ' + cfg.plaMax + ' °C', 'PLA glass transition ≈ 55–60 °C (textbook)');
      add('Diffuser outside (touch)', s.TdOut <= cfg.maxBoard, s.TdOut.toFixed(1) + ' °C', '≤ ' + cfg.maxBoard + ' °C', "Brief's 40°C goal applied to the touch point it asks you to probe");
    }
    add('LED power', s.P <= cfg.powerBudget * 1.001, s.P.toFixed(2) + ' W', '≤ ' + cfg.powerBudget + ' W', 'Brief / heat-calc doc (4 W reference)');
    add('Placement', s.bad === 0, s.bad + ' LED(s) break a limit', '0', 'DXF outline, lens, screw holes, 2835 body size');
    add('Driver current', d.currentOk, cfg.current.toFixed(1) + ' mA', '≤ ' + d.tlcMax.toFixed(1) + ' mA', 'R82 = 820 Ω (Head_Board.pdf); 41 × 1.21 V / R from the TLC59711 datasheet (not in the context files)');
    add('LED current rating', cfg.current <= LED_LIMITS.maxI, cfg.current.toFixed(1) + ' mA', '≤ ' + LED_LIMITS.maxI + ' mA', 'Cree Pro9 datasheet p.4');
    add('Ambient rating', cfg.ambient >= LED_LIMITS.opMin && cfg.ambient <= LED_LIMITS.opMax, cfg.ambient + ' °C', LED_LIMITS.opMin + ' to ' + LED_LIMITS.opMax + ' °C', 'Cree Pro9 datasheet p.4');
    add('Supply headroom', d.headOk, d.headroom.toFixed(2) + ' V', '≥ ' + cfg.tlcKnee + ' V', 'LMR51420 divider (13.37 V) − 5 × Vf; TLC59711 regulation');
    add('Driver channels', d.channelsOk, d.strings + ' strings', '≤ 12', 'TLC59711 (12 channels)');
    return L;
  }

  // ---------------------------------------------------------------- objective
  const DESK_PENALTY = 50; // per unit relative shortfall below the desk target: dominates the score until it is met
  function objective(cfg, m) {
    const w = cfg.w;
    return w.cv * m.cv + w.min * (1 - m.minAvg);
  }

  // ---------------------------------------------------------------- RNG + seeds
  function rng(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function gauss(r) { let u = 0, v = 0; while (u === 0) u = r(); v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

  // Bridson (2007) Poisson-disk sampling, radius tuned to land >= N points; extras dropped at random
  function poisson(cfg, placer, N, seed) {
    const r = rng(seed), [bx0, by0, bx1, by1] = placer.bbox;
    let rad = Math.max(cfg.minPitch, Math.sqrt(placer.area / N) * 0.85), best = [];
    for (let attempt = 0; attempt < 10; attempt++) {
      const pts = bridson(placer, rad, r, bx0, by0, bx1, by1);
      if (pts.length >= N) { best = pts; break; }
      if (pts.length > best.length) best = pts;
      rad = Math.max(cfg.minPitch, rad * Math.sqrt(pts.length / N) * 0.97);
    }
    while (best.length > N) best.splice(Math.floor(r() * best.length), 1);
    if (best.length < N) best = fillBestCandidate(cfg, placer, best, N, r);
    return best;
  }
  function bridson(placer, rad, r, bx0, by0, bx1, by1) {
    const cs = rad / Math.SQRT2, gw = Math.ceil((bx1 - bx0) / cs), gh = Math.ceil((by1 - by0) / cs), grid = new Int32Array(gw * gh).fill(-1);
    const pts = [], active = [], k = 30, r2 = rad * rad;
    const gi = (x, y) => Math.floor((y - by0) / cs) * gw + Math.floor((x - bx0) / cs);
    const far = (x, y) => {
      const gx = Math.floor((x - bx0) / cs), gy = Math.floor((y - by0) / cs);
      for (let yy = Math.max(0, gy - 2); yy <= Math.min(gh - 1, gy + 2); yy++) for (let xx = Math.max(0, gx - 2); xx <= Math.min(gw - 1, gx + 2); xx++) {
        const p = grid[yy * gw + xx]; if (p >= 0) { const dx = pts[p].x - x, dy = pts[p].y - y; if (dx * dx + dy * dy < r2) return false; }
      }
      return true;
    };
    for (let t = 0; t < 500 && !pts.length; t++) { const x = bx0 + r() * (bx1 - bx0), y = by0 + r() * (by1 - by0); if (placer.okRegion(x, y)) { pts.push({ x, y }); active.push(0); grid[gi(x, y)] = 0; } }
    while (active.length) {
      const ai = Math.floor(r() * active.length), p = pts[active[ai]]; let found = false;
      for (let t = 0; t < k; t++) {
        const a = r() * 2 * Math.PI, d = rad * (1 + r());
        const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
        if (x < bx0 || y < by0 || x >= bx1 || y >= by1 || !placer.okRegion(x, y) || !far(x, y)) continue;
        pts.push({ x, y }); active.push(pts.length - 1); grid[gi(x, y)] = pts.length - 1; found = true; break;
      }
      if (!found) active.splice(ai, 1);
    }
    return pts;
  }
  function fillBestCandidate(cfg, placer, pts, N, r) {
    const [bx0, by0, bx1, by1] = placer.bbox; pts = pts.slice();
    let guard = 0;
    while (pts.length < N && guard++ < 50 * N) {
      let best = null, bd = -1;
      for (let t = 0; t < 40; t++) {
        const x = bx0 + r() * (bx1 - bx0), y = by0 + r() * (by1 - by0);
        if (!placer.okRegion(x, y) || !placer.okPitch(pts, -1, x, y)) continue;
        let d = Infinity; for (const p of pts) d = Math.min(d, Math.hypot(p.x - x, p.y - y));
        if (d > bd) { bd = d; best = { x, y }; }
      }
      if (best) pts.push(best);
    }
    return pts;
  }
  function uniformRandom(cfg, placer, N, seed) {
    const r = rng(seed), [bx0, by0, bx1, by1] = placer.bbox, pts = [];
    let guard = 0;
    while (pts.length < N && guard++ < 200000) { const x = bx0 + r() * (bx1 - bx0), y = by0 + r() * (by1 - by0); if (placer.okRegion(x, y) && placer.okPitch(pts, -1, x, y)) pts.push({ x, y }); }
    return pts;
  }
  // hexagonal lattice: largest pitch that still fits N; best offset of a small search
  function hex(cfg, placer, N) {
    const [bx0, by0, bx1, by1] = placer.bbox;
    const lattice = (p, ox, oy) => {
      const pts = [], dyR = p * Math.sqrt(3) / 2;
      for (let row = -1, y = by0 + oy; y < by1; row++, y += dyR) for (let x = bx0 + ox + ((row & 1) ? p / 2 : 0); x < bx1; x += p) if (placer.okRegion(x, y)) pts.push({ x, y });
      return pts;
    };
    let lo = cfg.minPitch, hi = Math.sqrt(placer.area) , best = null;
    for (let it = 0; it < 22; it++) {
      const p = (lo + hi) / 2; let got = null;
      for (let a = 0; a < 5 && !got; a++) for (let b = 0; b < 5 && !got; b++) { const pts = lattice(p, a * p / 5, b * p * 0.866 / 5); if (pts.length >= N) got = pts; }
      if (got) { lo = p; best = got; } else hi = p;
    }
    if (!best) return [];
    // drop extras: remove the point whose removal keeps spacing most even (the most crowded)
    while (best.length > N) {
      let wi = 0, wv = -1;
      for (let i = 0; i < best.length; i++) { let s = 0; for (let j = 0; j < best.length; j++) if (i !== j) s += Math.exp(-((best[i].x - best[j].x) ** 2 + (best[i].y - best[j].y) ** 2) / (2 * lo * lo)); if (s > wv) { wv = s; wi = i; } }
      best.splice(wi, 1);
    }
    return best;
  }
  // Lloyd relaxation toward a centroidal Voronoi tessellation of the placeable region
  function cvt(cfg, placer, leds, iters, density) {
    const [bx0, by0, bx1, by1] = placer.bbox, st = 1.0, samples = [];
    for (let y = by0 + st / 2; y < by1; y += st) for (let x = bx0 + st / 2; x < bx1; x += st) if (placer.okRegion(x, y)) samples.push(x, y, density ? density(x, y) : 1);
    const n = leds.length, pts = leds.map(p => ({ ...p }));
    for (let it = 0; it < iters; it++) {
      const sx = new Float64Array(n), sy = new Float64Array(n), sw = new Float64Array(n);
      for (let s = 0; s < samples.length; s += 3) {
        const x = samples[s], y = samples[s + 1]; let bi = 0, bd = Infinity;
        for (let i = 0; i < n; i++) { const d = (pts[i].x - x) ** 2 + (pts[i].y - y) ** 2; if (d < bd) { bd = d; bi = i; } }
        sx[bi] += x * samples[s + 2]; sy[bi] += y * samples[s + 2]; sw[bi] += samples[s + 2];
      }
      for (let i = 0; i < n; i++) if (sw[i] > 0) {
        let nx = sx[i] / sw[i], ny = sy[i] / sw[i];
        for (let t = 0; t < 8 && !(placer.okRegion(nx, ny) && placer.okPitch(pts, i, nx, ny)); t++) { nx = (nx + pts[i].x) / 2; ny = (ny + pts[i].y) / 2; }
        if (placer.okRegion(nx, ny) && placer.okPitch(pts, i, nx, ny)) pts[i] = { ...pts[i], x: nx, y: ny };
      }
    }
    return pts;
  }

  // ---------------------------------------------------------------- optimiser (simulated annealing + local-search polish)
  // Simulated annealing on LED positions (Su et al. 2012), then local-search polish (Lei et al. 2014).
  // opt.dimming: optimize each string's PWM duty at the same time as the positions (as Moreno 2006 solves the ring
  // radius and the centre-LED flux together). opt.groups = string index per LED; duties stay in [opt.minDuty, 1].
  function optimize(cfg, leds, opt, progress) {
    opt = opt || {};
    const geo = buildGeo(cfg, opt.res || cfg.res), placer = opt.placer || buildPlacer(cfg), F = Field(geo, cfg); // same grid as the displayed result
    const cam = { ...cfg.keep };
    placer.setCam(cam); setCam(geo, cam);
    let pts = leds.map(p => ({ ...p }));
    // repair any invalid start positions
    const r = rng(opt.seed || 1);
    for (let i = 0; i < pts.length; i++) if (!placer.okRegion(pts[i].x, pts[i].y) || !placer.okPitch(pts, i, pts[i].x, pts[i].y)) {
      const others = pts.filter((_, k) => k !== i), fill = fillBestCandidate(cfg, placer, others, others.length + 1, r);
      if (fill.length > others.length) pts[i] = { ...pts[i], x: fill[fill.length - 1].x, y: fill[fill.length - 1].y };
    }
    const n = pts.length;
    let groups = opt.groups && opt.groups.length === n ? opt.groups.slice() : null;
    const dimOn = !!(opt.dimming && groups), regroup = dimOn && opt.regroup; // regroup = { per, mode }: keep strings spatially coherent as LEDs move
    const lo = opt.minDuty == null ? 0.3 : opt.minDuty;
    const nS = dimOn ? Math.max(...groups) + 1 : 0;
    let members = Array.from({ length: nS }, () => []);
    if (dimOn) groups.forEach((q, i) => members[q].push(i));
    let wts = opt.weights && opt.weights.length === n ? opt.weights.slice() : pts.map(() => 1);
    let duty = dimOn ? members.map(mm => (mm.length ? Math.min(1, Math.max(lo, wts[mm[0]])) : 1)) : null;
    if (dimOn) wts = groups.map(q => duty[q]);
    F.setAll(pts, wts);
    const E2 = new Float64Array(geo.nD);
    // desk limit: penalise any shortfall below targetLux (so an infeasible start climbs toward it), and once the limit
    // is met never accept a move that breaks it
    const limitOn = !!opt.deskLimit, target = cfg.targetLux;
    const flux = limitOn ? (opt.flux || led(cfg, thermalMap(cfg, pts, { weights: wts }).TjMax).flux) : 0;   // derated at the heat map's hottest chip, as the app shows
    const dm = limitOn ? deskModel(geo, cfg) : null;
    const evalJ = E => {
      const m = metrics(geo, E, n, true), J = objective(cfg, m);
      if (!limitOn) return { J, m, desk: Infinity };
      const desk = deskLux(dm, E, flux * cfg.tau, cfg.roomLux).min;
      return { J: J + DESK_PENALTY * Math.max(0, (target - desk) / target), m, desk };
    };
    const breaks = nxt => limitOn && cur.desk >= target && nxt.desk < target;
    let cur = evalJ(F.E);
    const snap = () => ({ J: cur.J, pts: pts.map(p => ({ ...p })), m: cur.m, desk: cur.desk, duty: duty && duty.slice(), groups: groups && groups.slice() });
    // re-assign strings by the chosen grouping on the current layout; each new string takes the mean duty of its LEDs
    const doRegroup = () => {
      const ng = assignStrings(pts, regroup.per, geo.areaD, regroup.mode, placer.sdfAt), nd = new Array(nS).fill(0), cnt = new Array(nS).fill(0);
      ng.forEach((q, i) => { if (q < nS) { nd[q] += F.wt[i]; cnt[q]++; } });
      groups = ng; duty = nd.map((v, q) => (cnt[q] ? Math.min(1, Math.max(lo, v / cnt[q])) : 1));
      members = Array.from({ length: nS }, () => []); groups.forEach((q, i) => members[q].push(i));
      F.setWeights(groups.map(q => duty[q])); return evalJ(F.E);
    };
    let best = snap();
    const iters = opt.iters || 6000, pitch = Math.sqrt(placer.area / n);
    // temperature from typical uphill moves
    let up = 0, cu = 0;
    for (let t = 0; t < 40; t++) {
      const i = Math.floor(r() * n), x = pts[i].x + gauss(r) * pitch * 0.3, y = pts[i].y + gauss(r) * pitch * 0.3;
      if (!placer.okRegion(x, y) || !placer.okPitch(pts, i, x, y)) continue;
      F.trial(i, x, y, E2); const d = evalJ(E2).J - cur.J; if (d > 0) { up += d; cu++; }
    }
    const T0 = (cu ? up / cu : 0.01) * 0.6, T1 = T0 * 1e-3;
    let accepted = 0, tried = 0, dimTried = 0, dimKept = 0;
    const t0 = Date.now();
    for (let it = 0; it < iters; it++) {
      const f = it / iters, T = T0 * Math.pow(T1 / T0, f), sig = pitch * (0.35 * Math.pow(0.03, f));
      if (progress && it % 250 === 0) progress({ phase: 'anneal', it, iters, J: cur.J, best: best.J, pts: best.pts, duty: best.duty, groups: best.groups, m: best.m, desk: limitOn ? best.desk : null, T: T / T0, sig, acc: tried ? accepted / tried : 0, dimTried, dimKept, ms: Date.now() - t0 });
      if (regroup && it > 0 && it % 500 === 0) { cur = doRegroup(); if (cur.J < best.J) best = snap(); }
      if (dimOn && r() < 0.05) { // duty move: change one string's PWM duty
        const q = Math.floor(r() * nS), nd = Math.min(1, Math.max(lo, duty[q] + gauss(r) * 0.15 * Math.pow(0.1, f))), dw = nd - duty[q];
        if (Math.abs(dw) < 1e-6 || !members[q].length) continue;
        dimTried++;
        E2.set(F.E); for (const i of members[q]) { const cd = F.contrib[i]; for (let c = 0; c < geo.nD; c++) E2[c] += dw * cd[c]; }
        const nxt = evalJ(E2), dJ = nxt.J - cur.J;
        if (!breaks(nxt) && (dJ < 0 || r() < Math.exp(-dJ / T))) {
          F.E.set(E2); for (const i of members[q]) F.wt[i] = nd; duty[q] = nd; cur = nxt; dimKept++;
          if (cur.J < best.J) best = snap();
        }
        continue;
      }
      const i = Math.floor(r() * n), x = pts[i].x + gauss(r) * sig, y = pts[i].y + gauss(r) * sig;
      if (!placer.okRegion(x, y) || !placer.okPitch(pts, i, x, y)) continue;
      tried++;
      F.trial(i, x, y, E2);
      const old = pts[i]; pts[i] = { ...old, x, y };
      const nxt = evalJ(E2), dJ = nxt.J - cur.J;
      if (!breaks(nxt) && (dJ < 0 || r() < Math.exp(-dJ / T))) {
        F.commitTrial(i); cur = nxt; accepted++;
        if (cur.J < best.J) best = snap();
      } else pts[i] = old;
    }
    // polish: coordinate local search on positions (Lei et al. 2014 style), then on string duties
    pts = best.pts.map(p => ({ ...p })); duty = best.duty;
    if (dimOn) { groups = best.groups; members = Array.from({ length: nS }, () => []); groups.forEach((q, i) => members[q].push(i)); wts = groups.map(q => duty[q]); }
    F.setAll(pts, wts); cur = evalJ(F.E);
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.707, 0.707], [-0.707, 0.707], [0.707, -0.707], [-0.707, -0.707]];
    for (let step = 1.0; step >= 0.124; step /= 2) {
      let improved = true, guard = 0;
      while (improved && guard++ < 6) {
        improved = false;
        for (let i = 0; i < n; i++) for (const [ux, uy] of dirs) {
          const x = pts[i].x + ux * step, y = pts[i].y + uy * step;
          if (!placer.okRegion(x, y) || !placer.okPitch(pts, i, x, y)) continue;
          F.trial(i, x, y, E2); const old = pts[i]; pts[i] = { ...old, x, y };
          const nxt = evalJ(E2);
          if (!breaks(nxt) && nxt.J < cur.J - 1e-9) { F.commitTrial(i); cur = nxt; improved = true; } else pts[i] = old;
        }
        if (progress) progress({ phase: 'polish', it: iters, iters, step, J: cur.J, best: cur.J, pts, duty, groups, m: cur.m, ms: Date.now() - t0 });
      }
    }
    if (regroup) cur = doRegroup();
    if (dimOn) {
      const bal = balanceStrings(geo, cfg, F, groups, nS, { minDuty: lo, start: duty, desk: limitOn ? { target, scale: flux * cfg.tau } : null });
      if (bal.after.J <= cur.J + 1e-12) { duty = bal.w; F.setWeights(groups.map(q => duty[q])); cur = evalJ(F.E); }
      if (progress) progress({ phase: 'polish', it: iters, iters, step: 0, J: cur.J, best: cur.J, pts, duty, groups, m: cur.m, ms: Date.now() - t0 });
    }
    let kept = 1; if (dimOn) { kept = 0; groups.forEach(q => { kept += duty[q]; }); kept /= n; }
    return { pts, J: cur.J, m: cur.m, duty, groups, kept, accepted, dimTried, dimKept, deskMin: cur.desk, deskOk: !limitOn || cur.desk >= target, ms: Date.now() - t0 };
  }
  // multi-start: K Poisson seeds -> CVT -> anneal; keep best. With dimming, strings are grouped per start.
  function autoDesign(cfg, N, opt, progress) {
    const placer = buildPlacer(cfg), K = opt.starts || 4;
    let best = null;
    for (let k = 0; k < K; k++) {
      const seed = (opt.seed || 7) + k * 101;
      let pts = poisson(cfg, placer, N, seed);
      pts = cvt(cfg, placer, pts, 25);
      const extra = opt.dimming ? { groups: assignStrings(pts, cfg.perString, placer.area, cfg.stringMode, placer.sdfAt), weights: null, regroup: { per: cfg.perString, mode: cfg.stringMode } } : {};
      const r = optimize(cfg, pts, { ...opt, ...extra, seed, placer }, p => progress && progress({ ...p, start: k, starts: K, bestSoFar: best && best.J }));
      if (!best || r.J < best.J) best = r;
    }
    return best;
  }

  // ---------------------------------------------------------------- strings (TLC59711: 12 channels x 5 LEDs)
  // mode 'rows': serpentine rows (short wiring). mode 'zones': rings by distance from the rim (outer ≈ 1/2,
  // middle ≈ 1/3, centre ≈ 1/6 of the strings), each ring cut into strings by angle, so one PWM channel
  // controls one region of the diffuser.
  function assignStrings(leds, per, areaD, mode, sdfAt) {
    const n = leds.length; if (!n) return [];
    const s = new Array(n);
    if (mode === 'zones' && sdfAt) {
      const nS = Math.ceil(n / per);
      let cx = 0, cy = 0; for (const p of leds) { cx += p.x; cy += p.y; } cx /= n; cy /= n;
      const byRim = leds.map((p, i) => ({ i, d: sdfAt(p.x, p.y), a: Math.atan2(p.y - cy, p.x - cx) })).sort((a, b) => a.d - b.d);
      const frac = [3, 2, 1], tot = 6; let ringStr = frac.map(f => Math.max(nS >= 3 ? 1 : 0, Math.round(nS * f / tot)));
      while (ringStr.reduce((a, b) => a + b, 0) > nS) ringStr[ringStr.indexOf(Math.max(...ringStr))]--;
      while (ringStr.reduce((a, b) => a + b, 0) < nS) ringStr[0]++;
      let k = 0, sid = 0;
      for (const rs of ringStr) {
        const ring = byRim.slice(k, Math.min(n, k + rs * per)); k += ring.length;
        ring.sort((a, b) => a.a - b.a);
        ring.forEach((o, j) => { s[o.i] = sid + Math.floor(j / per); });
        sid += rs;
      }
      for (let j = k; j < n; j++) s[byRim[j].i] = Math.min(nS - 1, sid + Math.floor((j - k) / per));
      return s;
    }
    const rowH = Math.sqrt(areaD / n) * 1.0;
    const ys = leds.map(p => p.y), top = Math.max(...ys);
    const order = leds.map((p, i) => ({ i, row: Math.floor((top - p.y) / rowH + 0.5), x: p.x }));
    order.sort((a, b) => a.row - b.row || ((a.row & 1) ? b.x - a.x : a.x - b.x));
    order.forEach((o, k) => s[o.i] = Math.floor(k / per));
    return s;
  }

  // neighbouring LED pairs for build drawings: j is a neighbour of i if it is within 1.35x i's nearest distance
  function neighbours(leds, factor) {
    factor = factor || 1.35;
    const n = leds.length, near = new Array(n).fill(Infinity), pairs = [], seen = new Set();
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j) near[i] = Math.min(near[i], Math.hypot(leds[i].x - leds[j].x, leds[i].y - leds[j].y));
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const d = Math.hypot(leds[i].x - leds[j].x, leds[i].y - leds[j].y), key = i < j ? i + ',' + j : j + ',' + i;
      if (d <= factor * near[i] && !seen.has(key)) { seen.add(key); pairs.push({ a: Math.min(i, j), b: Math.max(i, j), d }); }
    }
    return { pairs, near };
  }

  // ---------------------------------------------------------------- export helpers
  function toDxfDrawn(p) { return { x: p.x + DXF_X0, y: p.y * TILT_K + DXF_Y0 }; }
  function dxfExport(cfg, leds, strings, withSpacing) {
    const L = [];
    const add = (...a) => L.push(...a.map(String));
    add(0, 'SECTION', 2, 'HEADER', 9, '$INSUNITS', 70, 4, 0, 'ENDSEC', 0, 'SECTION', 2, 'ENTITIES');
    const poly = outline(cfg);
    for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; add(0, 'LINE', 8, 'OUTLINE', 10, a[0].toFixed(4), 20, a[1].toFixed(4), 30, 0, 11, b[0].toFixed(4), 21, b[1].toFixed(4), 31, 0); }
    const K = cfg.keep;
    if (K.on) add(0, 'CIRCLE', 8, 'CAMERA', 10, K.x.toFixed(4), 20, K.y.toFixed(4), 30, 0, 40, K.r);
    if (K.on && K.zone === 'module' && K.mod) { const z = modPoly(K); for (let i = 0; i < 4; i++) { const a = z[i], b = z[(i + 1) % 4]; add(0, 'LINE', 8, 'CAMERA_MODULE', 10, a[0].toFixed(4), 20, a[1].toFixed(4), 30, 0, 11, b[0].toFixed(4), 21, b[1].toFixed(4), 31, 0); } }
    if (K.on && K.zone === 'dxf') { const z = zonePoly(K, poly); for (let i = 0; i < z.length; i++) { const a = z[i], b = z[(i + 1) % z.length]; add(0, 'LINE', 8, 'CAMERA_KEEPOUT', 10, a[0].toFixed(4), 20, a[1].toFixed(4), 30, 0, 11, b[0].toFixed(4), 21, b[1].toFixed(4), 31, 0); } }
    leds.forEach((p, i) => {
      const w = PKG_W / 2, h = PKG_L / 2; // JB2835B package, Pro9 p.23
      const c = [[p.x - w, p.y - h], [p.x + w, p.y - h], [p.x + w, p.y + h], [p.x - w, p.y + h]];
      for (let k = 0; k < 4; k++) add(0, 'LINE', 8, 'LED_BODY', 10, c[k][0].toFixed(4), 20, c[k][1].toFixed(4), 30, 0, 11, c[(k + 1) % 4][0].toFixed(4), 21, c[(k + 1) % 4][1].toFixed(4), 31, 0);
      add(0, 'POINT', 8, 'LED_CENTRE', 10, p.x.toFixed(4), 20, p.y.toFixed(4), 30, 0);
      add(0, 'TEXT', 8, 'LED_LABEL', 10, (p.x + 2).toFixed(3), 20, (p.y + 2).toFixed(3), 30, 0, 40, 1.2, 1, `L${i + 1}${strings ? '/S' + (strings[i] + 1) : ''}`);
    });
    if (withSpacing) for (const q of neighbours(leds).pairs) {
      const a = leds[q.a], b = leds[q.b];
      add(0, 'LINE', 8, 'SPACING', 10, a.x.toFixed(4), 20, a.y.toFixed(4), 30, 0, 11, b.x.toFixed(4), 21, b.y.toFixed(4), 31, 0);
      add(0, 'TEXT', 8, 'SPACING', 10, ((a.x + b.x) / 2).toFixed(3), 20, ((a.y + b.y) / 2).toFixed(3), 30, 0, 40, 0.9, 1, q.d.toFixed(1));
    }
    add(0, 'ENDSEC', 0, 'EOF');
    return L.join('\n');
  }

  return {
    PKG_W, PKG_L, PKG_H, defaults, clone, zoneDist, zonePoly, modDist, modPoly, lightBudget, thermalMap, warmUp, WHATIFS, whatIf, UNCERTAIN, uncertainRun, HEATCAP, backGapAt, CAD, CCT, FLUX_TOL, LED_LIMITS, ledRef, sweepCurrent, checklist, outline, polyArea, pointInPoly, buildGeo, buildPlacer, ledContrib, Field, metrics, led, drive,
    thermal, BEN, objective, rng, poisson, uniformRandom, hex, cvt, fillBestCandidate, optimize, autoDesign,
    assignStrings, balanceStrings, neighbours, taskLight, deskMap, deskModel, deskLux, toDxfDrawn, dxfExport, segHitsCircle, setCam, geoKey, PKG_R, TILT_K, DXF_X0, DXF_Y0,
  };
}
if (typeof module !== 'undefined' && module.exports) module.exports = HeadLEDEngine;
