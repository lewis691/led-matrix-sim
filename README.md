# Head LED Placement Studio

LED placement tool for the LeLamp Head: the D-shaped outline from `WT - Lewis.dxf`, the camera lens, 60 × JB2835
LEDs on a TLC59711 (12 strings × 5). Every model part is traced to a paper, Ben's Notion research, the DXF or the
schematic (see **Sources** below). Anything that couldn't be traced has been removed.

## Run

```powershell
py -m http.server 8765 --bind 127.0.0.1
```

Run this from the `code/` folder, then open <http://localhost:8765>. A short walkthrough starts on the first visit;
replay it with **? Walkthrough**.

Proof that each feature works, checked against its source (27 checks, ~1 min):

```powershell
node checks/examples.js
```

## Using it

1. **Head & LEDs**: gap to the diffuser, camera lens (drag it or type its position; keepout = the original DXF corner zone (default,
   used by the new prototype), the camera board footprint, or the lens only), LED count, colour temperature
   (2700–6500 K), typical or worst-case (−7%) flux, drive current (with **Find lowest current that meets the
   targets**), and targets (light, evenness, desk lux at 40 cm, board temperature, power), and room light already on the desk (0 = dark
   room, the default worst case).
2. **Layout**: 🎲 Randomize / Hex grid / Even out to start, ✨ Optimize to improve. Drag LEDs by hand. Optional:
   optimize string dimming at the same time.
3. **Light & dimming**: diffuser transmission, brightness readouts, per-string PWM dimming with Auto-balance, and
   secondary light for the dark camera corner (raised LEDs, side-emitters or a light guide, each with its own lm, beam and
   distance; `checks/aux-corner.js`).
4. **Heat**: Ben's heat-calc network (worst / best / custom case) and Hui's LED chip temperature.
4b. **Heat tools** (step 4): board heat map, warm-up curve, passive-cooling what-ifs, which-assumption-matters-most chart,
   electronics hot spots.
5. **Compare & export**: 📄 one-click report (print to PDF); evidence table; constraint checklist (each limit with its source); snapshots side by side; LED CSV (positions from the head's left/bottom edges, nearest
   neighbour), LED spacing CSV, DXF with LED-to-LED distances. Tick **spacing** above the canvas to see distances.

**🧊 3D** (above the canvas): the head, its light and the desk 40 cm below, drawn from the model's own numbers. Tick
snapshots under "Compare with" to see up to 4 designs side by side, with one camera and one shared scale. The default
"Hot & dark spots" look plus Relief makes layout differences obvious. Scene → *Bedroom nightstand (realistic)* shows the lamp on a
nightstand with shadows. Its light pattern is fitted to the model, so the nightstand top gets the model's desk lux. Needs three.js from cdn.jsdelivr.net (internet on
first load).

## What the model includes, and its sources

| Part | Source |
|---|---|
| LED light on the diffuser: E = Φ(m+1)h^(m+1)/(2π r^(m+3)), m = 1 | Moreno et al. 2006 Eq. 1 (cos^m) × incidence cosine; Ben's Notion "LED research doc + sim" (same formula) |
| Diffuser = transmission loss τ (≥ 0.70) | Ben's derivation; Notion Head page |
| Desk light: each diffuser patch as a Lambertian source; 500 lx over a 40 cm circle at 40 cm | Ben's derivation and targets (EN 12464-1) |
| Head outline, camera position | DXF (12° tilt removed); confirmed by the Head STEP to 0.05 mm |
| Camera lens shadow | Notion Camera Obstruction / Head pages (camera flush with diffuser) |
| Walls | Treated as absorbing, as in Moreno, Yang and Ben's sim. Reflective walls are to be tested on the bench |
| Score = w·CV + w·(1 − evenness) | Su et al. 2012 / Yang et al. 2009 (CV); brief's 65% evenness target |
| Optimizer: simulated annealing, then local-search polish | Su et al. 2012; Lei et al. 2014 |
| Randomize / Even out / Hex grid | Bridson 2007; Du, Faber & Gunzburger 1999; Moreno 2006 / Yang 2009 |
| String dimming (incl. joint with placement) | Moreno 2006 (dimmed centre LED, solved with spacing); Yang 2009 (edge levels) |
| Board temperature map | Ben's Notion "LED array heat calcs" network (front path, reproduced exactly: 247 / 139.3 °C) + metal-core board conduction + back cavity + PLA bosses, geometry from the Head STEP, electronics power from your table |
| Geometry: gap 17.9 mm, lit aperture, camera barrel/ring/board, bosses, meshes | Head STEP, measured in `context/step_extract/` |
| Light budget (every lumen) | the same kernel over the STEP geometry |
| LED temperature, heat share, efficacy vs temperature | Hui & Qin 2009 (Eqs. 2, 3, 5a) |
| LED flux per colour temperature, its temperature slope, ±7% tolerance, T_j / current / ambient ratings | Cree JB2835B F-class Pro9 datasheet pp.4–5 |
| Driver current limit, supply headroom | Head_Board.pdf (R82 = 820 Ω, LMR51420 100k/4.7k) |

**Assumptions still to confirm:** the metal-core PCB stack-up (typical values assumed), where the electronics sit on
the board, PLA properties, motor heat, the diffuser spec ("70 percent diffusion" read as 70% transmission), the J-class
LED data (the model uses the F-class Pro9 datasheet; the board's part is 6500 K), the real LED positions (not in the
CAD), and the head being parallel to the desk. The gap, lens and rim are now measured from the STEP. Full list:
`MODEL_NOTES.md` §10.

**Removed, because they were not sourced:** reflective-wall model, foil-on-back / board-spreading thermal model,
the light-utilisation and heat-clustering score terms, and optimizer camera moves. The last three changed nothing
measurable (see `checks/ablation-output.txt`). Each old-program feature (CCT, copper/fan, frame path, flux margin,
maintenance, crowding, current sweep, checklist, modes) is justified one by one in `MODEL_NOTES.md` §0.

## Files

- `index.html`, `app.js`: UI.
- `evidence.js`: every model value with its source (shown in step 5 → Evidence).
- `view3d.js`: 3D view (three.js): diagram compare, heat-coloured board, realistic nightstand scene.
- `assets/cad/*.stl`: Head STEP meshes (copied from `context/step_extract/meshes`), used by the 3D view at the CAD gap.
- `engine.js`: geometry, light model, desk light, thermal, generators, optimizer, strings, exports. It runs in the
  browser, the background worker and Node.
- `checks/examples.js` (+ `examples-output.txt`): 27 source-checked proofs.
- `checks/cct-output.txt`: Variation A at 3000 / 4000 / 5000 K, typical and −7%, with the lowest current meeting targets.
- `checks/example-variations.js` (+ output): reference numbers for the Baseline / A / B walkthrough.
- `checks/desk-limit.js` (+ output): the 500 lx desk limit at 25 and 20 mA.
- `checks/dimming-compare.js` (+ output): joint vs two-pass dimming.
- `checks/ablation-output.txt`: record of the score-term / camera-move test.
- `checks/gap21-why.js`, `checks/thermal-40c.js` (+ outputs): why evenness misses 65% (the desk limit pulls LEDs inward), and why 40 °C can't be met (the electronics alone exceed it).
- `checks/cct.js` (+ output): colour temperature vs light, desk and lowest current.
- `MODEL_NOTES.md`: point-form notes on every feature (how it works, equations, sources, what changed).
- `READING_LIST.md`, `DESIGN_NOTES.md`: papers, dimension and architecture confirmations, analysis.
