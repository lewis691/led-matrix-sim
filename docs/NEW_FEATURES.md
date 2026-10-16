# New features (15–16 Oct 2026) and the papers behind them

*Lewis Zhang · 16 Oct 2026 · covers the features added in the 15–16 Oct work, not the earlier program.*

**How to read this.** Each feature starts with the paper passage that justifies it, then a few bullets on what the
passage says, then what the feature does and where it lives in the code.

**About the excerpts.** Long verbatim passages from the papers can't be reproduced here (copyright). Each excerpt is
therefore given as:
- an exact **locator**: paper, page and equation number, so it can be checked in `context/papers`;
- the **equation** itself, where the passage is an equation;
- a close **paraphrase** of the text around it.

One short direct quotation is used (§3). Page numbers are journal pages where the PDF shows them, otherwise PDF pages.

| Tag | Paper (in `context/papers`) |
|---|---|
| [Moreno06] | Moreno, Avendaño-Alejo & Tzonchev (2006), *Applied Optics* 45(10), 2265–2272. `ApplOpt2006.pdf` |
| [Yang09] | Yang, Bergmans, Schenk, Linnartz & Rietman (2009), *IEEE Trans. Signal Processing* 57(3), 1044–1057. `tsp.2008.2009269.pdf` |
| [Hui09] | Hui & Qin (2009), "A general photo-electro-thermal theory for LED systems", IEEE APEC. `apec.2009.4802712.pdf` |
| [Qin10] | Qin & Hui (2010), *IEEE Trans. Power Electron.* 25(2), 507–513. `tpel.2009.2026752.pdf` |

---

## 1. Secondary light for the dark camera corner

### What the papers say

**[Moreno06] p. 2266, Eq. (1) and Eq. (2)**
- *Eq. (1):* E(r, θ) = E₀(r) cos<sup>m</sup>θ
- *Eq. (2):* m = −ln 2 / ln(cos θ<sub>½</sub>)
- *Paraphrase:*
  - A real LED is not exactly Lambertian. Its irradiance falls off with viewing angle as a power of the cosine.
  - The exponent m depends on where the chip sits relative to the encapsulant's curvature. m ≈ 1 is a near-perfect Lambertian source; many typical LEDs have m above 30.
  - m follows from θ<sub>½</sub>, the angle at which the irradiance falls to half its on-axis value, which manufacturers usually quote.

**[Moreno06] p. 2266, Eq. (3)**
- *Equation:* irradiance on a flat screen at distance z from a cos<sup>m</sup> LED, written in Cartesian coordinates. It is the basis for summing many LEDs on one target plane.

**[Qin10] p. 509 (Fig. 3 discussion) and p. 512 (conclusions)**
- *Paraphrase:*
  - For the same total power, a distributed system of five 1 W LEDs gave more light than one 5 W LED (120 lm at 24 lm/W against 90 lm at 18 lm/W).
  - The gap widens as power, and so junction temperature, rises.
  - The conclusions state the system-level rule: a higher number of low-power LEDs has the same advantage over a concentrated system.

**[Hui09] p. 2 (PDF), Eq. (3)**
- *Equation:* P<sub>heat</sub> = k<sub>h</sub> P<sub>d</sub> = k<sub>h</sub> V<sub>d</sub> I<sub>d</sub>
- *Paraphrase:* only part of the LED's electrical power becomes heat. k<sub>h</sub> is that share; the paper's example is k<sub>h</sub> = 0.85, and its measured cases use 0.85 and 0.83.

### Summary
- A source's beam is set by **one number from its datasheet**, the half-power angle, through m = −ln 2 / ln cos θ<sub>½</sub>. A 120° FWHM gives m = 1 (Lambertian); narrower beams give larger m.
- **Irradiance on a flat target** is intensity × incidence cosine / r². That is the same physics the main LEDs already use, so the extra sources sit on the same footing.
- **Several low-power sources beat one high-power source** for light per watt when the heat path is poor, which it is in the head.
- **Heat:** about 85% of a source's electrical power becomes heat.

### The feature
**Step 3 → Secondary light.** It adds sources that are *not* the main LEDs, to light the diffuser over the blocked keepout corner. That region is ≈ 42 mm from any allowed main-LED position, so with the main LEDs alone whole-face evenness stays at ≈ 1–5%.

**Source types:**
- **Raised top-emitters:** LEDs on a mount inside the corner, a chosen distance below the diffuser, facing it.
- **Side-emitters:** LEDs on the board just outside the corner (the corner itself is blocked), at a chosen height, aimed into it and tilted up.
- **Light guide:** an edge-lit plate over the corner, a chosen distance below the diffuser, glowing over its whole area.
- **Light pipes from behind the board:** LEDs on the board's back (or a small back board), each feeding a clear pipe through a hole in the board up into the corner. The pipe exit is the source: LED lm × pipe efficiency, with the exit's own beam angle, a chosen distance below the diffuser. The LEDs' heat still goes into the metal-core board.

**Inputs, per source:** light output (lm), power (W), count, beam angle (FWHM), and the type's distance, height, tilt or guide efficiency. They are entered from the chosen part's datasheet. The defaults are example values, labelled assumed in `evidence.js`; nothing is copied from the main LEDs.

**How it's modelled:**
- **Beam:** intensity I = I₀ cos<sup>m</sup>(angle from the source's own axis), with I₀ = Φ(m + 1)/(2π), so the beam integrates to the source's flux Φ. m comes from the FWHM by [Moreno06] Eq. (2): `mFromFwhm`, `engine.js:356`.
- **Light on the diffuser:** irradiance = I × incidence cosine / r², summed per diffuser cell (`auxField`, `engine.js:414`). The source axis can point anywhere, so side-emitters aim sideways; the main LEDs only point up.
- **Shading:** the camera barrel blocks rays exactly as it does for the main LEDs.
- **Adding it to the model:** the result is added to the light field as a fixed base, in the same units as one main LED (`F.setBase`, `engine.js:331`; `auxBase`, `engine.js:433`). So evenness, light out, desk lux, the optimizer (`engine.js:1107`), snapshots and the report all include it. "Light reaching diffuser" still reports the main LEDs' own share.
- **Heat:** k<sub>h</sub> × power is added to the heat map at the board under each source, per [Hui09] Eq. (3) (`engine.js:732`).
- **Automatic placement:** raised sources are spread to serve equal shares of the dark area (k-means over the corner cells). Side sources are spaced along the keepout's two inner edges. Positions can also be typed.
- **Display:** sources are drawn on the canvas and summarised in step 3: lm emitted, lm reaching the diffuser, lm out, power, evenness.
- **Check 27:** a single raised source matches the closed form straight above it to 10⁻⁹; no type puts more light on the diffuser than it emits; type *None* leaves the field unchanged.

**What it predicts** (`checks/aux-corner.js`; CAD geometry, 60 LEDs at 25 mA; example source values):

| Secondary light | Whole-face evenness after optimizing |
|---|---|
| None | 1% |
| Light guide, 120 / 240 lm in (efficiency 0.5) | 24% / 45% |
| Light pipes from behind, 4 × 60 lm LEDs, efficiency 0.5, exit 12 mm below | 29% |
| Raised, 4 × 30 lm, 12 mm below the diffuser | 29% |
| Raised, 4 × 30 lm, 6 mm below | 16% (hot spots) |
| Side-emitters at the edge, 6 × 20 lm | 3% |

**Two results follow directly from the physics above:**
- **Side-emitters barely help.** From ≈ 1 mm up, about half of a cos<sup>m</sup> beam aimed sideways points into the board, and the rest reaches the diffuser at grazing incidence (small cosine, large r).
- **Raised sources set too close make hot spots.** The cos<sup>m</sup> × cosine / r² spot is narrow when r is small. This is the same spacing-to-height effect [Moreno06] analyses for arrays.

**Not from a paper (assumed, labelled in the app and `evidence.js`):**
- **The light guide's exit:** taken as uniform and Lambertian at efficiency × input. That is a best case; a real guide needs a dot pattern to get close to it.
- **Not modelled:**
  - shading by the corner parts or the mount;
  - wall bounces;
  - flux droop of the extra sources with temperature (lm is used as entered).

---

## 2. Evenness scored over the whole face, with an outside-the-corner option

### What the paper says

**[Yang09] p. 1044 (abstract) and §III, p. 1046**
- *Paraphrase:* the authors propose the **relative mean squared error** between the realised illumination and a uniform target as the cost function that measures uniformity, and analyse that cost. In §III they define the error as the difference between the rendered pattern and a constant target. Any convex cost of that error, such as the mean squared error, then ranks LED settings by uniformity.

### Summary
- **Variation (CV) is the paper's metric.** Relative RMS error against a uniform target is the standard deviation ÷ mean, i.e. the coefficient of variation the program reports as "variation". It is part of the optimizer's score (weight 1.0).
- **The same metric covers both scoring areas.** The paper measures uniformity over the area that is meant to be lit; which area that is was a design decision here.

### The feature
- **Scored area:** evenness (min/avg, and CV per [Yang09]) is scored and optimized over the **whole lit face, keepout corner included**, as you asked on 16 Oct. A step 1 box, "Score evenness over the keepout corner too" (`keep.scoreCorner`), switches scoring to the face outside the corner.
- **Both values shown:**
  - `metrics()` returns both (`minAvgFace` / `minAvgOut`), and `evenAlt` (`engine.js:979`) picks the one not being scored.
  - The other value appears in the evenness tile, the light panel, the checklist, the compare panel and the report.
  - The mask that decides which cells are scored is set at `engine.js:188`.
- **Check 26:** confirms which cells are scored in each mode.
- **Why min/avg is also kept:** the brief's provisional 65% target is a min/avg figure. CV is what [Yang09] supports; min/avg is what the brief asks for.

---

## 3. Current search and optimizer derated with the full heat map

### What the paper says

**[Hui09] p. 1 (abstract)**
- *Short quotation:* the thermal design "will strongly influence the peak luminous output of LED systems".
- *Paraphrase:*
  - The optimal operating power, where luminous flux peaks, need not be the rated power.
  - The theory lets the optimal operating point be found for a given thermal design.

**[Hui09] p. 2 (PDF), Eq. (3):** P<sub>heat</sub> = k<sub>h</sub> P<sub>d</sub>, as in §1.

### Summary
- **Light output depends on how hot the LEDs run**, and that depends on the whole thermal design, not on the LEDs alone.
- **So the temperature used to derate the flux** must come from the full thermal path the LEDs actually sit in.

### The feature
- **What was wrong:** the lowest-current search and the optimizer's desk-limit flux used Ben's LED-only front-path network. That leaves out the 4.6 W of head electronics and the back cavity, so it under-predicted the chip temperature. It offered 26 mA, which then showed only 482 lx in the app.
- **Now:**
  - Both derate the flux at the hottest LED chip of the **full heat map**: board conduction, front path, back cavity, bosses, electronics. That follows [Hui09]'s point that the thermal design sets the light (`sweepCurrent`, `engine.js:928`).
  - The search bisects the 0.5 mA grid, about 8 heat-map solves. Check 25 confirms it matches a full scan.
  - It warns when the answer puts the hottest chip over the datasheet's 125 °C. In that case no current meets both the light targets and the chip limit.

---

## 4. Features with no paper behind them (geometry or assumption)

These were added in the same period. They rest on the CAD, the DXF or a stated assumption, not on a paper, so they are listed without excerpts.

| Feature | Basis |
|---|---|
| **Original DXF corner keepout restored as the default** (x ≥ 19.0, y ≤ 19.22 mm) | `WT - Lewis.dxf`, and your confirmation that the new prototype uses it |
| **DXF corner outlines drawn in the zone** (8 part outlines + camera-board holes, `DXF_CORNER`, `engine.js:197`) | Re-reading `WT - Lewis.dxf`: it has no single keepout outline, and the zone is the envelope of these parts. Heights are not in the DXF |
| **Brightness and heat maps visible through the keepout** | Display only |
| **IR camera view from the desk** (thermal look, hottest point ringed and labelled, `view3d.js:312`, `:449`) | The heat map's diffuser-surface temperatures. Assumed: the 1 mm PC diffuser is opaque to infrared |
| **Bench layouts:** 20 LEDs, 4 strings of 5, ≥ 22 mm pitch; best-layout search; 1:1 string maps with wiring-aware string grouping | Hand-wiring limit (≥ 20–22 mm of wire to strip). The search uses the program's existing optimizer and score; grouping minimises total wire and keeps wires out of the keepout |
| **Report PDFs per bench condition** | Program output; Variation A carries a banner because foil walls are not modelled |
