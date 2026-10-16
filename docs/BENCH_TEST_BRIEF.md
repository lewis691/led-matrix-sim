# Bench test brief: Baseline, Variation A, Variation B

**For:** the chat that runs the bench tests. The fixture and probe logger are already built; this brief covers the
three conditions and how to run and record them.

**Bench build: 20 LEDs, 4 strings of 5, at least 22 mm between LED centres.** Hand-wiring needs at least 20–22 mm of
wire between neighbours, which 60 LEDs can't give (hex pitch 12.9 mm). At 22 mm only about 20–24 LEDs fit the face, so
all three conditions use the same 20. The model was rerun for exactly this build, so the bench still validates the
model and the foil effect. It does not reproduce full-Head numbers (a third of the LEDs and power).
**Sources:** the work-trial brief (`context/Lewis Zhang Work Trial (Oct 14 to 16).pdf`, pp. 3–4) for procedure, and
the model in `code/` (`checks/bench-predictions.js`) for predictions.

---

## 1. The three conditions

Everything is held constant except the one change in each row.

| ID | Layout | Walls | What it tests |
|---|---|---|---|
| **BASE** | Hex grid, 20 LEDs, 23.3 mm pitch: `code/reports/bench/bench-baseline-and-A-hex-20-led-coordinates.csv` / `-layout.dxf` | As built (dark/plain) | Reference |
| **A** | Same hex grid as BASE (same files) | **Aluminium foil on the inner side walls**, shiny side in | Does reflecting the wall light raise light out and edge/corner brightness, and does it change temperature? |
| **B** | Optimized layout, 20 LEDs, 22.0–27.9 mm spacing: `code/reports/bench/bench-B-optimized-20-led-coordinates.csv` / `-layout.dxf` (from `node checks/best-layout.js 20 22`) | Same as BASE | Does the optimized layout even out the diffuser at the same power? |

**Held constant for all three (Zoheb's power-budget point):**
- 20 LEDs (JB2835B), 4 strings × 5, **DC 55 mA per string** (no PWM), about 2.97 W of LED power
- **3000 K** parts (record the reel/bag label; the brief warns not to mix F-class and J-class data)
- **21 mm** board → diffuser gap; the same diffuser sample, enclosure, lid, probe positions and cable routing
- The camera keepout (DXF corner zone) left empty in every layout

**Layout files:** coordinates are mm from the dome centre (the same frame as the app and the DXF). Each CSV lists the LED's string (4 strings of 5) and its nearest-neighbour spacing. The hex grid is 23.3 mm everywhere; B's closest pairs are exactly 22.0 mm.

**String maps (print at 100 % / actual size; the 50 mm bar checks the scale):** `code/reports/bench/bench-string-maps.pdf`, with a front page (LED side) and a back page (mirrored, for wiring behind the board) per layout. The 4 strings of 5 are colour-coded and numbered along the chain from "start", with each wire's centre-to-centre length. Strings are grouped for the least total wire, and no wire crosses the camera keepout: hex wires are all 23.3 mm, B's are 22–30 mm. The CSVs carry the same string and position columns. All strings run at the same 55 mA, so the grouping doesn't change any prediction.

**Report PDFs (model output for each condition, with the other layout alongside):** `code/reports/bench/bench-baseline-hex-20-report.pdf`, `bench-A-hex-20-foil-walls-report.pdf`, `bench-B-optimized-20-report.pdf`. The full-Head 60-LED result is `code/reports/full-head/full-head-60-optimized-report.pdf` (for reference, not built).

**Variation A needs a build record:** foil product and thickness, which faces are covered (side walls only; not the
board, the diffuser or the keepout), shiny side in, and how it's fixed (tape type). Photograph it. The model has **no**
foil-wall model (no sourced reflectance), so A has no prediction of its own: the measured A − BASE difference is the
result.

---

## 2. Before the first power-up

1. **Agree the stop limits with Zoheb/Rizwan and write them down.** The model predicts the board at **about
   46–64 °C** with 20 LEDs at 55 mA (section 5):
   - LED chip limit 125 °C (Cree Pro9 datasheet p.4); the chip runs about 1–2 °C above the board.
   - The DS18B20 probes are rated ±0.5 °C only up to 85 °C; their absolute maximum is 125 °C.
   - **Any PLA touching the board softens at about 55–60 °C, and the still-air prediction is 64 °C**, so check what
     the board sits on.
   - Suggested default until agreed: stop if the board probe reaches 85 °C, or for any smoke, smell, PLA deforming,
     sensor fault or unstable current.
2. **Drive:** use the checked current-regulated bench driver, never raw 24 V on a string. Each string needs about
   5 × 2.7 V = 13.5 V plus the driver's dropout.
3. **Ramp the current:** 10 mA → 25 mA → 55 mA, checking the probes and string currents at each step.

---

## 3. Per-run thermal procedure (from the work-trial brief, p.4)

1. **Record the configuration:** condition ID, LED count and identity, gap, sensor map (probe ROM IDs → room air /
   board hot spot / diffuser touch point), room temperature, lid on, time.
2. **Start cold:** board and case within 1 °C of ambient.
3. **Log every 2 s:** 2 min with the LEDs off, then switch on at 55 mA.
4. **Power:** measure each string's V and I downstream of the driver and sum V × I. Match LED power within 5% across
   conditions or report the mismatch. Log the supply input power separately.
5. **Run 30 min** (45 min if time allows). "Settled" means the slope over the final 5 minutes is under
   0.2 °C/min; otherwise report the 30-min value plus the slope. The model expects 63% of the rise after
   7–14 min and 95% after 21–43 min, so a 30-min run may not be fully settled in still air.
6. **Cool down** to the same starting condition before the next run.

**Run order:** BASE → A → B → BASE (repeat) → the preferred variation (repeat). Report the spread between repeat runs;
any A or B difference smaller than that spread is inconclusive.

---

## 4. Optical procedure (each condition, after the same warm-up time)

- **Lux grid:** a 3 × 3 grid on the desk plane **40 cm below the diffuser**, points **200 mm apart**, centred under
  the middle of the lit face. Use the same marks and orientation every time (note which way the camera corner points).
  Subtract the LEDs-off reading at each point. Report mean, min, max and min/mean. A grid average is not total lumens.
- **Diffuser photos:** fixed camera position, manual exposure, ISO, focus and white balance; no clipping. Use the
  same room light every time. They show hotspots, shadows and the dark keepout corner.
- If there is no lux meter, the photos are relative visual evidence only.

---

## 5. Model predictions to compare against

From `node checks/bench-predictions.js` (output in `checks/output/bench-predictions-output.txt`): Head geometry at 21 mm,
3000 K, 55 mA, 20 LEDs, LED heat only (the 4.6 W of Head electronics isn't in the fixture), room 25 °C. "Still / moving air"
are Ben's two air cases.

| | BASE (hex) | A (hex + foil) | B (optimized) |
|---|---|---|---|
| LED power (datasheet V_f) | 2.97 W | 2.97 W | 2.97 W |
| Board hottest, still / moving air | 63.8 / 46.7 °C | not modelled (≈ BASE) | 63.8 / 46.7 °C |
| Hottest LED chip, still / moving air | 65.4 / 48.3 °C | — | 65.4 / 48.3 °C |
| Diffuser outer surface max, still / moving air | 44.1 / 30.0 °C | not modelled | 44.1 / 30.0 °C |
| Warm-up to 95%, still / moving air | 42 / 21 min | — | 43 / 21 min |
| Diffuser evenness, outside the keepout corner | 35% | not modelled | **86%** |
| Diffuser evenness, whole face (corner included) | 2% | not modelled | 4% |
| Diffuser variation (CV) | 35.6% | not modelled | 22.9% |
| Light out, still air | 275 lm | not modelled | 234 lm |
| Lux grid mean, still air | 322 lx | not modelled | 274 lx |
| Lux grid min/mean | 73% | not modelled | 74% |
| Lux grid centre point | 536 lx | not modelled | 455 lx |

**How to read these:**
- **The fixture is not the Head.** Its enclosure, materials and air path differ, so compare **differences between
  conditions** and the **rise above ambient**, not absolute temperatures.
- **The model predicts no thermal difference between BASE and B** (same power, near-isothermal metal-core board).
  A measured difference bigger than the repeat spread would point to something the model misses.
- **B trades light for evenness:** it spreads LEDs towards the walls, so about 15% less light reaches the desk while
  the diffuser gets much more even. The desk grid barely changes (73% vs 74%), because at 40 cm the desk light is
  already smooth.
- **For A:** expect more lux, mostly at the edge grid points, if the foil returns wall light. The model says 32% of
  the LED light currently hits the walls (42% for B).
- **The light and desk targets (300 lm, 500 lx) are full-Head targets.** 20 LEDs can't meet them; the reports show
  them as fails, which is expected for this section.

---

## 6. Files to hand back

- One raw CSV per run: timestamp, condition ID, sensor ROM ID, °C, fault flag (CRC, disconnected, stale), and a
  drive/power log (per-string V and I, supply input).
- File naming, e.g. `2026-10-16_BASE_run1.csv`, `..._A_run1.csv`, `..._B_run1.csv`, `..._BASE_run2.csv`.
- Lux grid table per condition (LEDs on, LEDs off, net) and the photo set with camera settings.
- Build records: foil details for A; BASE and B as built against their coordinate CSVs (note any LED moved); sensor-location photos.
- A comparison table covering:
  - LED and input power
  - lux mean, min, max and min/mean
  - peak and 30-min rise above ambient, and the final 5-min slope
  - repeat spread
  - mechanical impact (foil thickness, assembly effort)

**Feeding results back into the model:**
- Measured rise vs predicted (still or moving air) → which of Ben's air cases the fixture behaves like.
- A − BASE lux → the first evidence for a wall-reflectance value.
- Measured string voltages → the real V_f at 55 mA.
