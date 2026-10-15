# Head LED Placement: Confirmations, Analysis and Recommended Variations

*Lewis Zhang · work trial, 14 Oct 2026 · numbers from the engine checks (`checks/examples.js`) (model estimates, not measurements)*

## 1. Head envelope: please confirm

Source: `context/WT - Lewis.dxf` (no `$INSUNITS`; values are consistent with mm, "SCALE 1:1").

**The drawing is a tilted view.** Every circle in the file, including the screw holes, is drawn as an ellipse with
an aspect ratio of 0.9781 = cos 12.0°. So the face is drawn rotated about 12° about the horizontal axis. Below,
horizontal values are as drawn and vertical values are de-projected (÷ 0.9781).

| Feature | As drawn | True (flat) |
|---|---|---|
| Overall width | 139.1 mm | **139.1 mm** |
| Overall height | 103.8 mm | **105.0 mm** |
| Top edge | semi-ellipse | **semicircle R 69.55 mm** |
| Lower corners | | **R 33.64 mm** (left), R 33.84 mm (right) |
| Bottom edge | | **R 482.4 mm arc** (sags about 1.5 mm, close to flat) |
| Face area | | **≈ 11,916 mm²** (matches the 12,000 mm² used in the heat calc) |
| Second outline | offset 1.04 mm vertically | consistent with a ≈ 5 mm deep rim/lip seen at 12° (1.04 / sin 12°) |
| Camera (keepout) | lens centre = centre of the 4 M2 holes at (243.95, 95.45) drawn | **lens circle only, Ø 8 mm (assumed; the DXF shows no lens)** at (42.4, −13.3) mm from the dome centre. The IMX219 board (25.3 × 37.4 mm) is assumed to sit behind the LED board. Position is adjustable and can be optimized. |
| Camera module | 4 mounting holes 21.0 × 13.6 mm | lens centre ≈ 42 mm right of and 13 mm below the dome centre |
| Screw holes (Ø 2.6) | 3 | (−36.6, 53.9), (36.3, 53.9), (−46.8, −28.0) mm from the dome centre |
| LED-placeable area | | **≈ 10,390 mm²** with the lens keepout (9,350 mm² with the whole camera module; 8,120 mm² with the original corner keepout, which is the default again since 15 Oct: the new prototype uses it) |

**Diffuser vs back panel.** The DXF has one face outline, so I've assumed the diffuser and the LED back panel
share it: the LED board fills the outline minus the camera block, and the diffuser covers the same outline with
the camera flush through it (per the Notion *Head* page). To confirm with Zoheb/Rizwan:

1. That the 12° tilt is real, and not just how the view was exported.
2. Whether the LED panel is inset from the diffuser outline.
3. The actual LED-to-diffuser gap. The model uses 10 mm, the heat calc 21 mm, and the baseline study says
   ≥ 25 mm minimum.

## 2. LED architecture (Head_Board.pdf, git c274ace, sheets 5 and 7)

- **60 × Cree JB2835BWT-J-U65EA0000-N000P001** (designators D10–D72, with no D12, D64 or D65).
  **12 strings × 5 in series**. Every string's anode goes to **VDD_LED** and its cathode to one TLC59711 output
  (OUTR0–3, OUTG0–3, OUTB0–3).
- **TLC59711** (U6): 12-channel constant-current sink with 16-bit PWM, clocked by the RV1106 (LED_CLK / LED_DATA).
  VCC/VREG come from VCC5V0_SYS. **IREF = R82 = 820 Ω → I<sub>max</sub> = 41 × 1.21 V / 820 Ω ≈ 60.5 mA per string.**
  Full drive is 60 × 60.5 mA × 2.7 V ≈ 9.8 W, which matches the "10 W / 60 LEDs" in the heat calc.
- **VDD_LED = LMR51420 buck (U7) from 24 V.** The feedback divider is R51 = 100 kΩ over R52 = 4.7 kΩ (R53 = 49.9 Ω is in
  series), giving V<sub>out</sub> = 0.6 V × (1 + 100/4.7) ≈ **13.4 V**. R47/R50 (182 k / 12.0 k) set a ≈ 20 V UVLO
  on EN. The inductor is 22 µH.
- ⚠ **Headroom flag:** 5 × 2.70 V (typical Vf at 65 mA, F-class datasheet) = 13.5 V, which is above 13.4 V, so the
  TLC59711 outputs have ≈ 0 V or negative compliance at full current. At 25 mA (≈ 4 W) Vf drops to about 2.6 V,
  leaving roughly 0.4 V. This is marginal and depends on the J-class Vf bin. The brief already says "native
  current-setting, logic and headroom details need review", and this is the concrete number. The tool shows it
  live under *String Vf vs VDD_LED*.
- The brief notes the native revision is 68c596a and this PDF (c274ace) is older. Re-check the divider values
  in the fresh export.

## 3. Placement algorithms (implemented, see READING_LIST.md)

| Button | Algorithm | Source |
|---|---|---|
| 🎲 Randomize | Bridson Poisson-disk: blue-noise random layout that guarantees minimum spacing, with radius auto-tuned to hit N; or plain uniform rejection sampling | Bridson 2007 |
| Hex fit | Largest hexagonal pitch that fits N (hex needs ~13% fewer LEDs than square for equal uniformity) | Yang et al. 2009 |
| Relax (CVT) | Lloyd iterations toward a centroidal Voronoi tessellation of the placeable region | Du, Faber & Gunzburger 1999 |
| Optimize current | Simulated annealing on all (x, y) with hard constraints, then a shrinking-step coordinate local search | Su et al. 2012; Lei et al. 2014 |
| Auto-design | Multi-start: K Poisson seeds → CVT → anneal → polish; keeps the best | Abeysekera et al. 2020 (constrained GA analogue) |

**Objective:** w<sub>cv</sub>·CV + w<sub>min</sub>·(1 − min/avg) + w<sub>util</sub>·(1 − utilisation) +
w<sub>th</sub>·crowding. CV is the RMS uniformity of Yang et al. Crowding is each LED's Gaussian neighbour
density, using the board's own spreading length λ = √(G<sub>sheet</sub>/h), which is the distributed-is-cooler
argument of Hui & Qin. The weights are sliders, because the terms really do conflict (see §5).

**Optics model.** Each LED is a cos<sup>m</sup> source, E = Φ(m+1)h<sup>m+1</sup>/(2πr<sup>m+3</sup>) (Moreno). The
camera block is opaque over the full gap. Specular walls use image sources (mirror across the local wall
tangent, deposited bilinearly). Diffuse walls re-emit from Lambertian wall patches.

**Spacing sanity check (Moreno's criterion, numerical):** on an infinite square grid, the diffuser ripple is
1% at d/h = 0.8, 5% at 1.0, 14% at 1.2 and 34% at 1.45. With 60 LEDs the mean pitch is ≈ 12 mm, so the
**10 mm gap sits at d/h ≈ 1.2, at the edge of visible hotspots**. At 21 mm the interior is flat and
non-uniformity is all edge falloff.

## 4–5. Foil heat sink and reflective walls: removed from the program

> **Superseded (14 Oct 2026).** The earlier foil-on-back and reflective-wall analysis used models that were not
> traceable to the papers or Notion research, so both were removed from the program. The program now models walls
> as absorbing (the baseline) and uses Ben's Notion heat-calc network for temperature.
>
> Treat both foil options as **bench experiments**: Variation A = foil side walls, Variation B = foil on the board
> back. Measure them against the baseline with the lux grid and the 3-probe logger. Two physics points still stand
> as hypotheses to test, not as model results:
> - Shiny foil radiates poorly (emissivity ~0.03–0.05), so bare foil on the back may make the board hotter on
>   average. Matte black tape over it is the comparison case.
> - Mirror-like walls should return light that would otherwise hit the walls, with the biggest effect near the rim.

## 6. Suggested trial variations (10–15 LED section)

Use a 15-LED section (3 strings × 5, so per-string current is identical to the Head), cut from the Head layout
near the rim, because that is where both effects live.

- **Baseline:** current geometry, dark walls, bare board back, at the agreed DC current.
- **Variation A (dispersion):** an optimized layout with **foil side walls** (shiny side in) at the same power.
  Prediction: higher min/avg and more lux, with no thermal penalty. Measure it with the 3 × 3 lux grid and fixed
  camera photos.
- **Variation B (thermal):** baseline layout with **foil + matte black tape on the board back**, at the same
  power. On perfboard/tiles it should give a large drop in peak board temperature and an unchanged average. Also
  try plain shiny foil if time allows, because the model predicts it *raises* the average. That is a good
  falsifiable test.
- Probe placement follows the brief: ambient, likely-hot board point (centre-most LED pair) and diffuser touch
  point. Compare at 30 min, cool down between runs, then repeat Baseline and the preferred variation.

## 7. Open questions for Zoheb / Rizwan

1. Real LED-to-diffuser gap (10 / 21 / 25 mm?), the 12° tilt, and whether the LED panel is inset from the
   diffuser.
2. Head orientation in use. Face-down changes which air gap convects.
3. VDD_LED headroom: confirm R51/R52 in rev 68c596a and the J-class Vf bin, because ≈ 13.4 V for a 5S string
   looks marginal.
4. Board build for the trial section (perfboard, pre-mounted tiles or copper) decides whether back foil helps.
5. Shell/wall material and colour inside the head (sets the "dark shell" baseline reflectance).
6. Board/case temperature ceilings for stop limits. The 40 °C target looks unreachable at 4 W without a real
   heat-sink path.
