# Bench test brief: Baseline, Variation A, Variation B

**For:** the chat that runs the bench tests. The fixture, probe logger and LED layouts are already built; this brief
covers only how to run and record the three conditions.
**Sources:** the work-trial brief (`context/Lewis Zhang Work Trial (Oct 14 to 16).pdf`, pp. 3–4) for procedure, and
the model in `code/` (`checks/bench-predictions.js`) for predictions.

---

## 1. The three conditions

Everything is held constant except the one change in each row.

| ID | Layout | Walls | What it tests |
|---|---|---|---|
| **BASE** | Hex grid (app: Layout → Hex grid), 60 LEDs | As built (dark/plain) | Reference |
| **A** | Same hex grid as BASE | **Aluminium foil on the inner side walls**, shiny side in | Does reflecting the wall light raise light out and edge/corner brightness, and does it change temperature? |
| **B** | Optimized layout (from the model) | Same as BASE | Does the optimized layout even out the diffuser at the same power? |

**Held constant for all three (Zoheb's power-budget point):**
- 60 LEDs (JB2835B), 12 strings × 5, **DC 55 mA per string** (no PWM)
- **3000 K** parts (record the reel/bag label; the brief warns not to mix F-class and J-class data)
- **21 mm** board → diffuser gap; the same diffuser sample, enclosure, lid, probe positions and cable routing
- The camera keepout (DXF corner zone) left empty in every layout

**Variation A needs a build record:** foil product and thickness, which faces are covered (side walls only; not the
board, the diffuser or the keepout), shiny side in, and how it's fixed (tape type). Photograph it. The model has **no**
foil-wall model (no sourced reflectance), so A has no prediction of its own: the measured A − BASE difference is the
result.

---

## 2. Before the first power-up

1. **Agree the stop limits with Zoheb/Rizwan and write them down.** The model predicts the board reaching
   **80–122 °C** at 55 mA (section 5), so limits will likely be reached:
   - LED chip limit 125 °C (Cree Pro9 datasheet p.4); the chip runs about 1–2 °C above the board.
   - The DS18B20 probes are rated ±0.5 °C only up to 85 °C; their absolute maximum is 125 °C.
   - Any PLA touching the board softens at about 55–60 °C.
   - Suggested default until agreed: stop if the board probe reaches 85 °C (the probe accuracy limit), or for any
     smoke, smell, sensor fault or unstable current.
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
   7–11 min and 95% after 20–36 min, so a 30-min run may not be fully settled in still air.
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

From `node checks/bench-predictions.js` (output in `checks/bench-predictions-output.txt`): Head geometry at 21 mm,
3000 K, 55 mA, LED heat only (the 4.6 W of Head electronics isn't in the fixture), room 25 °C. "Still / moving air"
are Ben's two air cases.

| | BASE (hex) | A (hex + foil) | B (optimized) |
|---|---|---|---|
| LED power (datasheet V_f) | 8.91 W | 8.91 W | 8.91 W |
| Board hottest, still / moving air | 121.5 / 84.8 °C | not modelled (≈ BASE) | 121.2 / 84.4 °C |
| Diffuser outer surface max, still / moving air | 77.3 / 40.1 °C | not modelled | 77.1 / 40.0 °C |
| Warm-up to 95%, still / moving air | 36 / 20 min | — | 36 / 20 min |
| Diffuser evenness, outside the keepout corner | 32% | not modelled | **83%** |
| Diffuser evenness, whole face (corner included) | 1% | not modelled | 5% |
| Lux grid mean, still air | 915 lx | not modelled | 773 lx |
| Lux grid min/mean | 73% | not modelled | 74% |
| Lux grid centre point | 1525 lx | not modelled | 1286 lx |

**How to read these:**
- **The fixture is not the Head.** Its enclosure, materials and air path differ, so compare **differences between
  conditions** and the **rise above ambient**, not absolute temperatures.
- **The model predicts no thermal difference between BASE and B** (same power, near-isothermal metal-core board).
  A measured difference bigger than the repeat spread would point to something the model misses.
- **B trades light for evenness:** it spreads LEDs towards the walls, so about 15% less light reaches the desk while
  the diffuser gets much more even. The desk grid barely changes (73% vs 74%), because at 40 cm the desk light is
  already smooth.
- **For A:** expect more lux, mostly at the edge grid points, if the foil returns wall light. The model says 31% of
  the LED light currently hits the walls (42% for B).

---

## 6. Files to hand back

- One raw CSV per run: timestamp, condition ID, sensor ROM ID, °C, fault flag (CRC, disconnected, stale), and a
  drive/power log (per-string V and I, supply input).
- File naming, e.g. `2026-10-16_BASE_run1.csv`, `..._A_run1.csv`, `..._B_run1.csv`, `..._BASE_run2.csv`.
- Lux grid table per condition (LEDs on, LEDs off, net) and the photo set with camera settings.
- Build records: foil details for A, B's LED coordinates (app export), sensor-location photos.
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
