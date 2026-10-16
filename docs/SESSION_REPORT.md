# Session report: LED placement studio for the LeLamp Head

*Lewis Zhang · 14–16 Oct 2026 · what was built and found in this chat. Details are in `MODEL_NOTES.md`, `NEW_FEATURES.md`
and the scripts in `checks/`.*

## Built

**The app** (`code/`, served as a web page):
- LED placement: randomize, hex grid, even-out, smooth dragging, and an optimizer (simulated annealing with local search).
- Five-step workflow with tooltips, a walkthrough and a constraint checklist where every limit names its source.

**The light model** (papers in `context/papers`):
- Moreno 2006 cos<sup>m</sup> LEDs on the measured Head geometry: 17.9 mm gap, lit aperture, camera barrel and ring, screw bosses.
- Desk light at 40 cm (Ben's 500 lx target), room light, colour temperature (3000 / 4000 / 5000 K, ±7% flux).
- String dimming, and a light budget that accounts for every lumen.

**The heat model:**
- Ben's front-path network, reproduced exactly (247 / 139.3 °C).
- Extended into a 2-D board map: metal-core conduction, back cavity from the STEP, PLA bosses, 4.6 W of electronics, hot spots, warm-up curve, passive what-ifs and sensitivity.

**Views and outputs:**
- 3D diagram, nightstand scene, heat cutaway, and an IR view looking up from the desk.
- One-click PDF report.
- Evidence panel listing every value and its source.
- 27 automated checks against sources and physics.

## Changed or fixed on 15–16 Oct

**Value review:**
- The current search and the optimizer now derate the flux with the full heat map, not Ben's LED-only network.
- Several display and report errors fixed.
- Unsourced claims now cited or labelled.

**Camera keepout:**
- The original DXF corner zone is the default again.
- Evenness is scored over the whole face, with the outside-corner value shown alongside.
- A DXF re-check showed the zone is the envelope of eight part outlines plus the camera-board holes. These are now drawn in the zone.

**Secondary light for the dark camera corner:** raised LEDs, side-emitters, an edge-lit light guide, or light pipes fed from behind the board. Each has its own lm, beam, power and distance, and is included in light, heat and the optimizer.

**Notes:** `REAR_LIGHT_NOTES.md` and `SCATTERING_NOTES.md` were reviewed and corrected:
- the Moreno fall-off;
- the head pose for the rear light;
- the PLA heat cap;
- the LED efficacy range.

**Bench prep:**
- Zoheb's 55 mA baseline study.
- A best-layout search.
- A 20-LED bench build (4 strings of 5, ≥ 22 mm pitch, for hand wiring) with predictions, condition-report PDFs, coordinate CSV/DXF files and 1:1 string maps.
- `BENCH_TEST_BRIEF.md`.

**Repo:**
- Moved to github.com/lewis691/led-matrix-sim, with commits authored as lewis@humancomputerlab.com.
- Files reorganized into `docs/`, `checks/output/`, `checks/data/` and `reports/`.

## Main findings

- **The board can't meet the 40 °C goal.** The 4.6 W of electronics alone puts it at 62–90 °C. At 25 mA the board is ≈ 124 °C in still air.
- **55 mA (the power-budget baseline) is far more than the light targets need.** It gives ≈ 740 lm and ≈ 900 lx, but the chips reach ≈ 161 °C in still air, over the datasheet's 125 °C. The light targets need ≈ 28–30 mA.
- **The supply can't drive 5-LED strings properly.** 5 × 2.70 V is more than the 13.37 V LED supply.
- **Whole-face evenness is limited by the blocked corner, not the layout.** It is ≈ 1–5% with the main LEDs alone. A light guide over the corner (≈ 120–240 lm of LEDs) lifts it to ≈ 25–45%. Outside the corner, the optimized layout reaches ≈ 85–95% when the desk limit allows.
- **Ben's heat work is calculation only.** His arithmetic is right. His fixed radiation temperatures overstate the 10 W worst case (247 → 168 °C), and he left out the electronics.

## Open items

- Agree the bench stop limits with Zoheb/Rizwan. Any PLA touching the board softens near 55 °C.
- Decide Variation A: aluminium foil (in the bench brief) or a white liner (in the scattering notes).
- Get datasheets: the J-class LED, the TLC59711, the PLA filament, and any secondary-light part.
- Run the bench tests, and use the results to pick Ben's air case and a wall-reflectance value for the model.
