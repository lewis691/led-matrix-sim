# Head LED Placement Studio: model notes

Point-form reference for every feature. For each one: what it does, how it works, the source, and what changed
from the old **LED Matrix Lab** (`context/HCL_EE_Simulations-main/.../Lighting Simulations`).
Values are the program defaults (`engine.js → defaults()`), checked against the code on 14 Oct 2026.

**Source key**
- **[Moreno06]** Moreno, Avendaño-Alejo & Tzonchev, Applied Optics 45(10) 2006
- **[Yang09]** Yang et al., IEEE Trans. Signal Processing 57(3) 2009
- **[Su12]** Su, Xue & Ji, Optics Express 20 2012
- **[Lei14]** Lei, Wang & Zou, JEOS:RP 9 2014 (abstract only)
- **[Bridson07]** Bridson, SIGGRAPH 2007 sketch
- **[DFG99]** Du, Faber & Gunzburger, SIAM Review 41(4) 1999
- **[Hui09]** Hui & Qin, IEEE APEC 2009
- **[Ben-Light]** Ben Tran-Pugh, Notion "LED research doc + sim"
- **[Ben-Heat]** Ben Tran-Pugh, Notion "LED array heat calcs"
- **[Ben-Ranges]** Notion "Find LED baseline ranges"
- **[Notion-Head]** Notion "Head:" page
- **[Notion-Cam]** Notion "Camera Obstruction"
- **[Brief]** Work-trial brief PDF
- **[DXF]** `WT - Lewis.dxf`
- **[Sch]** `Head_Board.pdf` (git c274ace)
- **[Cree]** Cree JB2835B F-class Pro9 datasheet point, as carried in the old program's LED profile
- **[STEP]** `Head 1 Assembly.step`, measured into `context/step_extract/` (head_geometry.json, REPORT.md, meshes): see §1
- **[User]** your answers (14 Oct): PLA shell, opaque; diffuser "70 percent diffusion"; metal-core PCB, no stack-up yet; worst-case electronics power table; no vents; sealed joints
- **[Old]** the old LED Matrix Lab code
- **[Mine]** my own engineering choice (no external source)
- **[Textbook]** standard physics or maths

---

## 0. Overall: what changed from LED Matrix Lab

**Evidence audit (14 Oct, after the CAD update)**
- **Method:** an independent pass opened every source file and checked every number in `engine.js`, `app.js` and `view3d.js`. I re-checked each mismatch myself (datasheet drawing, Moreno's paper, Notion) before changing anything. The full list, with each value's source, is in the app (step 5 → Evidence) and in `evidence.js`.
- **Fixed:**

  | Item | Was | Now | Evidence |
  |---|---|---|---|
  | LED package height (optical height) | 0.8 mm (17.1 mm) | **0.62 mm (17.28 mm)** | Pro9 p.23 side view; optical origin on the top face |
  | LED package outline (body clearances) | 2.8 × 3.5 mm, PKG_R 2.24 | **3.58 × 2.97 mm**, PKG_R 2.33 | Pro9 p.23 top view |
  | Pad area under the LED (chip temperature) | 9.8 mm² | **6.47 mm²** (dielectric ≈ 7.7 K/W) | Pro9 p.23 recommended footprint |
  | Front screw bosses (heat map) | 5 mm long, 62.15 mm² | **3 mm, 62.13 mm²**; joined to Head Back through the butt joint (lumped, [Mine]) | STEP |
  | Light-formula citation | "Moreno Eq. 3" | Moreno **Eq. 1** (cos^m) × incidence cosine = Ben's derivation. Moreno's Eq. 3 writes z^m/R^(m+2), so their m counts the incidence cosine | Moreno 2006 text |
  | Driver-limit citation | "Head_Board.pdf" | R82 from Head_Board.pdf; 41 × 1.21 V/R from the TLC59711 datasheet (not in the project files) | schematic text |
  | Unlabelled constants | — | labelled: FR4 k (now in-plane 0.8), shell-surface linearisation, derating floor, 25 mA default, 0.4 V headroom | — |
  | Stale comment, notes | "8 mm lens"; "lens clearance 1.5" | removed; 1.0 mm (as coded) | — |
- **Confirmed (not wrong, just not in the local files):** 500 lx and 40 cm with EN 12464-1, and "diffuser must pass at least 70%". Both are in Ben's Notion pages ('LED research doc + sim', 'Head:'), checked 14 Oct.
- **Still assumed (labelled):** metal-core stack-up, PLA properties, electronics placement, FR4 comparison values, display-only values, optimizer settings.
- **Known minor:** the DXF's right lower corner is R 33.84 vs the left R 33.64; the outline mirrors the left one (the STEP width still matches to 0.05 mm).
- **Effect:** board and chip temperatures change by about 1 °C; light changes by under 1%. All 22 checks pass. Saved designs update automatically (cadV 2).

**Latest: measured CAD geometry, full heat map, light budget (14 Oct, from the Head STEP)**

| What | Before (assumed) | Now (measured or answered) | Source |
|---|---|---|---|
| Board → diffuser gap | 10 mm | **17.9 mm**, uniform; light starts 0.62 mm up (LED height, Pro9 p.23), so the optical height is 17.28 mm | [STEP] |
| Where light reaches the diffuser | whole outline, 2 mm rim excluded from scoring | only the Head Front **lip opening**, 3.6 mm inside the board edge (10,530 mm²); anything outside hits the walls, 43° chamfer or lip | [STEP] |
| Camera | Ø 8 mm lens (assumed) | **Ø 14 barrel** flush with the diffuser in a **Ø 16 hole**: 1 mm open ring to the room. The **25 × 24 camera board** sits on the LED board; LED keepout = the original DXF corner zone, which contains it (default) | [STEP] |
| Screw holes | DXF positions, 3.5 mm clearance | STEP positions; TL/TR carry Ø 8.6 Head Front bosses (clearance 4.3) | [STEP] |
| Heat | Ben's 1-D front path, LEDs only, one temperature | **2-D map**: metal-core board conduction + Ben's front path + the 727 cm³ back cavity + PLA bosses, LEDs **and 4.6 W of electronics** | [Ben-Heat] + [STEP] + [User] |
| Light accounting | "light reaching diffuser" only | **every lumen**: out through the diffuser, diffuser loss, walls/chamfer/lip, camera barrel, the open camera ring, other openings (0) | [STEP] + [User] |
| 3D | extruded outline, mirror-image world | real Head Front/Back, camera, neck and motor meshes; board coloured by the heat map; correct handedness | [STEP] |

**What it means (Variation A re-optimized at the CAD geometry with the original DXF keepout, 25 mA; `checks/example-variations-output.txt`, regenerated 15 Oct):**
- **About 22–28% of the LED light hits the walls, chamfer and lip** (22% even at a 10 mm gap, because the lip opening sits 3.6 mm inside the board edge) and is lost into dark PLA. Only 50–54% leaves through the diffuser.
- **At 25 mA the hex start misses the 500 lx desk minimum** (455 lx); the optimizer's desk limit pulls LEDs inward to reach exactly 500 lx.
- **Evenness (min/avg) is 1–2%** for every layout, because the diffuser over the keepout corner is scored and its far end is about 42 mm from any legal LED (§ camera keepout). CV (33% optimized vs 41% hex) is the more useful comparison with this keepout.
- Reference numbers: Baseline hex 1% evenness, CV 40.7%, 373 lm, desk 455 lx; Variation A 2%, CV 33.1%, 400 lm, 500 lx; board 85–124 °C for both (Ben's best–worst air cases).
- **The board runs about 124 °C (worst case) or 85 °C (best case)**, because the 4.6 W of electronics roughly doubles the heat. LED chips sit about 0.5 °C above the board, right at the 125 °C datasheet limit in the worst case.
- **The PLA screw bosses touch the board.** At these temperatures they would soften (PLA glass transition about 55–60 °C). This is the biggest physical risk the model now shows.
- **The camera ring leaks about 0.03–0.1% of the light (about 0.2–0.6 lm) directly**, undiffused: a thin bright ring around the lens. With the corner keepout no LED is near the lens, so the leak is smaller than with the board-footprint keepout.
- **A metal-core board is nearly one temperature** (within about 2–3 °C); FR4 would spread 105–127 °C. So where the LEDs sit hardly changes the heat; total power does.

**Rebuilt for the Head:**
- Real D-shaped outline from the DXF, with the camera and screw holes.
- Driver and strings from the schematic.

**Why it was rebuilt:**
- **Drag lag.** The old app recomputed all the optics on every pointer move (~150 ms per update) and rebuilt the whole page's HTML. The new one updates only the moved LED (~5–8 ms measured).
- **No randomize, no placement optimizer.** The old app only optimized *current*.

**Old-program features: what each was, and why it was kept, restored or removed**

Old program = `context/HCL_EE_Simulations-main/.../Lighting Simulations/dist/model.mjs` + `app.js`. Rule used: keep it if its numbers trace to a datasheet, paper, Ben's Notion work, the schematic, the DXF or the brief; remove it if it rests on an assumed constant that changes the answer; restore anything removed without that reason.

| Old feature | What it was in the old program | Now | Justification |
|---|---|---|---|
| **Light variations (CCT)** | "LED family" + "Color / reference CCT" selects. The Cree profile offered only 2700 / 3000 K; 5000 K existed only in the Nichia 3030 profile (36.9 lm). | **Restored:** 2700, 3000, 3500, 4000, 5000, 5700, 6500 K | My removal wasn't justified, since the data is sourced. Flux and temperature slope now come from one datasheet (Cree Pro9 p.5, 90 CRI, 65 mA), so 4000 / 5000 K no longer borrow from a different package. The brief says the native family is 3000–6500 K / 90 CRI. The board MPN `JB2835BWT-J-U65EA…` decodes as 90 CRI, 6500 K. |
| **7% flux margin** | `fluxMargin: 7` (default on), multiplied into every flux: × (1 − 0.07). | **Restored as an option:** "LED flux: Worst case (−7% tolerance)", default Typical | Source: Pro9 datasheet, flux measured to ±7%. Default stays Typical because the tolerance is ± (a measurement spread, not a systematic loss), and Ben's targets (13.69 lm/LED) and heat calcs use typical values. Tick worst case to check margins: Variation A at 3000 K drops from 544 to 506 lx and still passes 500 lx (`checks/cct-output.txt`). |
| **Current sweep** | `optimizeCurrent`: 241 currents between min and max; picks the lowest input power (incl. driver loss and fan) meeting every constraint. | **Restored:** "Find lowest current that meets the targets" (step 1) | My removal wasn't justified. With no driver-loss or fan model, LED power rises monotonically with current, so lowest power = lowest current. It requires light out and desk minimum. Board temperature is reported but not required: in Ben's worst case the board is above 40 °C at any current that gives useful light, so requiring it would always return "none". Steps of 0.5 mA up to the 60.5 mA TLC59711 limit. |
| **Constraint checklist** | Pass/fail on lumens, lux, board, junction (85 °C design limit), shell (40 °C), power, uniformity, placement, driver (headroom + PWM), rating, cooling. | **Restored:** table in step 5; failed items not already on the status strip go to the issues chip | Each limit now names its source (see §3). Changes: junction limit = **125 °C** (Pro9 datasheet; the old 85 °C had no source). Shell → diffuser outside (touch) vs the brief's 40 °C goal; the brief asks for a touch-point probe, and the old program itself noted the 40 °C wasn't clear about board vs shell. Added LED current ≤ 480 mA and ambient −40…105 °C (datasheet). Dropped "cooling" (no fan) and the PWM-frequency check (the brief says a model PWM value doesn't configure hardware; core tests are DC). |
| **Copper back layer + rear fan** | `rearMode` none / copper / bare. Copper k 400 W/mK and emissivity 0.03 (labelled "assumed"), board→copper contact R, rear h, rear air rise. Fan: local air velocity, coverage, flow length, flat-plate correlation Nu = 0.664 Re^½ Pr^⅓, fan input power. | **Removed** | (1) The Head has no fan and no copper plate (Head_Board.pdf, DXF). (2) The old program's own notes said the copper result is set by the assumed contact resistance and emissivity ("copper conductivity alone does not remove heat"); none of those inputs has a source for this board. (3) The flat-plate correlation is textbook, but its input (air velocity at the plate) is unknown with no fan. (4) The brief treats passive heat paths as a **variation to build and measure**, so foil/copper on the back is a bench test against the model's front-only baseline. |
| **Frame thermal path** | `rback = 3` K/W board → frame → ambient, in parallel with the front path. The old UI labelled it "assumed 3 K/W". | **Removed** | Unsourced, and decisive: a 3 K/W path in parallel with Ben's ~16 K/W front path would carry most of the heat, so the board temperature would come from a guess. Ben's network leaves it out on purpose (front only = conservative). Measure the real back path with the fixture's board probe. |
| **Maintenance factor** | `maintenance: 100` (%), multiplied into flux. | **Removed** | At its default (100%) it had no effect. No LM-80 / TM-21 lumen-maintenance data for this LED is in the context, and the trial measures initial output over hours, not years. Restore it if lifetime targets appear. |
| **Hotspot "crowding" term** | Added to board temperature: hotspot = (heat per LED) × `spreadR` (2 K/W) × crowd, where crowd = max over LEDs of Σ exp(−d²/2σ²), σ = `spreadLength` 15 mm. Substrate presets set spreadR to 2 / 8 / 15 K/W. | **Removed** | spreadR and σ have no source (the old UI called them "local spreading coefficient" and "heat spreading length"), and the presets are arbitrary. Ben's network treats the board as one temperature. My interim heat-clustering score term (the same idea) was ablation-tested and changed nothing beyond run-to-run noise (`checks/ablation-output.txt`). |
| **Ambient / lamp modes** | Two separate saved states. Ambient: 300 lm, 4 W budget, no lux target. Lamp: 500 lx task target, 6 W budget, 0 lm target. | **Merged** | The Head does both jobs with one layout, so both are now always computed and checked: 300 lm + 65% evenness (brief) and 500 lx at 40 cm (Ben). Separate states let a design pass one while failing the other. The power budget field covers the lamp's 6 W if wanted. |
| Other LED profiles (Lumileds, Samsung, Nichia, WS2812B) | Selectable families with their own datasheet points | **Removed** | Not the board's part. The brief says to use the actual parts and not mix the J / F-class data; Nichia is a 3030; RGB is outside the trial (brief). |
| Estimated-V_f mode | V_f from current and temperature | **Removed (could restore)** | V_f is fixed at the datasheet 2.70 V (65 mA). The datasheet curve gives about 2.65 V at 25 mA (read by eye) and −2.6 mV/°C, i.e. about 2% less LED power. Small, but sourced; restore if power accuracy matters. |
| Driver efficiency, overhead, 24 V rail, 6 in series | Generic driver: η 90%, quiescent current, 24 V input | **Replaced** | By the board's real chain from the schematic: TLC59711 (60.5 mA limit via R82), LMR51420 at 13.37 V, 5 in series (§4). Driver losses aren't in Ben's network, and Head driver work is outside the trial (brief). |
| Generic rectangle / ellipse / cylinder shapes, 10% crop | Placeholder geometry | **Replaced** | By the DXF outline, lens and screw holes, plus a 2 mm hidden rim (assumed, §10). |
| "Optical" heat mode (LER 300 lm/W) | Heat = electrical − radiant (lm ÷ LER) | **Replaced** | By Hui & Qin's measured k_h = 0.85 (§5). |

**Removed from my own interim versions (not sourced):**
- The reflective-wall model, the 2-D board-spreading thermal model with foil options, the light-utilisation and heat-clustering score terms, and optimizer camera moves.
- An ablation test showed the last three changed nothing beyond run-to-run noise (`checks/ablation-output.txt`).

**Proof:** `node checks/examples.js` runs 19 checks against the sources (all pass).

---

## 1. Head geometry

**Outline**
- **What:** the head face the LEDs sit in and the diffuser covers.
- **How:**
  - Top semicircle R 69.55 mm.
  - Lower corners R 33.64 mm, tangent to the side and to a bottom arc.
  - Bottom arc R 482.38 mm, lowest point y = −35.47 mm.
  - Built as a 184-point polygon. Result: 139.1 × 105.0 mm, ≈ 11,916 mm².
- **Tilt:** the DXF is drawn tilted 12.0°. Every circle in it has aspect 0.9781 = cos 12°, so vertical values are divided by 0.9781.
- **Coordinates:** mm, origin at the centre of the dome arc. DXF-drawn coordinates are x + 201.545, y × 0.9781 + 108.46 (used in exports).
- **Source:** [DXF] (dimensions); tilt inferred by me from the ellipse ratios [Mine].
- **Changed:** the old program used a generic rectangle, circle or cylinder.
- **Adjustable:** width and height scale (step 1, Advanced).

**Screw holes**
- **What:** three Ø 2.6 mm holes at (−36.658, 53.885), (36.299, 53.885), (−46.808, −27.989). TL and TR carry the Head Front screw bosses (Ø 8.6, 3 mm tall on the board front), so the LED body stays outside r 4.3; BL has only a screw head (3.5).
- **Source:** positions and bosses [STEP] (agree with the DXF to 0.04 mm); 3.5 mm screw-head clearance [Mine].
- **Changed:** positions refined and boss clearance added from the STEP.

**Measured from the Head STEP** [STEP] (full report: `context/step_extract/REPORT.md`)
- **Frame:** the STEP and the DXF agree to within 0.05 mm (6 anchors), so the model's coordinates are unchanged.
- **Gap:** board front → diffuser inner face **17.9 mm**, uniform (18.3 over four 0.4 mm recess pads). Diffuser 1.0 mm thick, exactly flat.
- **Lit aperture:** light enters the diffuser only through the Head Front lip opening, 131.9 × 97.8 mm, 3.6 mm inside the board edge all round (`apInset`). The diffuser rests on a 1 mm ledge outside it, and nothing covers its front face (`evalInset` 0).
- **Front-cavity wall:** straight with 4° outward draft from the board to z 11.9, then a 43° chamfer inward to the lip at z 16.35.
- **Not in the CAD:** LED positions (the LED Array is a 5 mm slab), the real PCB thickness and stack-up, and the in-use head angle.

**Camera**
- **What:** the camera board sits on the LED board; its barrel rises to the diffuser and shades light passing it; the diffuser has a hole around it.
- **How (STEP values):**
  - Centre (42.4, −13.3): the centre of the IMX219 board's 4 M2 holes (STEP 42.400, −13.295).
  - **Barrel Ø 14** at the top, flush with the diffuser's outer face (2° taper to Ø 13.1 at its base). **Diffuser hole Ø 16**: the 1 mm ring between them (47 mm²) is open to the room, so light landing there leaves directly (§2, light budget).
  - **Camera board footprint** 25 × 24 mm (x 30–55, y −21.9 to 2.1) on the LED board front, with a 1 mm body clearance: an option (`zone: 'module'`). "Barrel circle only" is kept as a what-if.
  - Cells inside the Ø 16 hole are excluded from the diffuser. Shading: a ray from an LED to a diffuser cell is blocked if its 2-D path crosses the barrel circle (r 7), treated as full height.
- **Movable:** drag on the canvas, or type the centre and diameter (step 1). "Reset to DXF" puts it back. Moving it doesn't rebuild the grid, only the lens mask.
- **Source:** geometry [STEP]; shadow concept [Notion-Cam] / [Notion-Head] (camera flush with diffuser); ray test [Textbook].
- **Changed:** was an assumed Ø 8 lens circle; now the measured barrel, hole and board footprint. Designs saved earlier are migrated automatically on load (a notice says so; snapshots keep their gap).
- **Original DXF keepout (the default since 15 Oct; the new prototype uses it, per the user):** step 1 → "Keep LEDs out of" → *Original DXF keepout zone (corner)*. Saved designs are moved to it on load (geometry version 3, with a notice).
  - **Zone:** the corner region drawn in `WT - Lewis.dxf`, x ≥ 19.0 and y ≤ 19.22 mm (de-tilted), clipped to the outline (about 2,200 mm² inside the head). It is stored relative to the lens (dx −23.4, dy +32.52 mm), so it moves with the camera.
  - **Clearance:** the original 2.3 mm from LED centre, i.e. 0.06 mm from the LED body.
  - **Drawn as:** a hatched block with a dashed clearance line on the canvas, a dark patch on the board in 3D, and layer `CAMERA_KEEPOUT` in the DXF export.
  - **Contains** the whole 25 × 24 mm camera board, so the board-footprint rule is implied.
  - **Scoring:** the diffuser over the corner is still scored for evenness, because the whole face should glow evenly (user, 15 Oct).
  - **Effect** (CAD geometry, 25 mA, desk limit on, 6,000 iterations): placeable area 7,948 mm² (9,350 with the board footprint only, 9,970 with the barrel only). The far corner of the face (58.7, −19.7) is 41.7 mm from the nearest legal LED position, where one LED gives only 2% of what it gives straight above it (h⁴/(h² + r²)² at h = 17.28 mm). So the darkest point stays near 1% of the average whatever the placement: optimized evenness (min/avg) 1%, 5th percentile/avg 24%, CV 31%, vs 46%, 57% and 20% with the board footprint. 7.6% of the lit face is more than one optical height from any legal LED spot. Min/avg can't reach the 65% target with this keepout; the fixes are physical (a lighter-coloured or reflective camera cover in the corner, a bigger gap, or LEDs allowed closer to the camera).
  - **Why it isn't the default:** that corner is mostly LED board, not camera. The lens only needs its circle. Confirm with Zoheb/Rizwan which applies.
  - **Source:** [DXF]; clearance [Old]/[Mine].

**Clearances (the dotted lines)**
- **What:** every dotted line is a limit for the whole LED **body**:
  - wall gap 1.3 mm (dashed yellow line)
  - camera clearance 1.0 mm (barrel circle and camera-board footprint)
  - screw-head radius 3.5 mm
- **How:** an LED centre must be at least (clearance + 2.33 mm) away. 2.33 mm = half the diagonal of the 3.58 × 2.97 mm JB2835B package (Pro9 p.23).
- **Spacing:** minimum LED centre-to-centre distance 4.5 mm (package + 1 mm gap).
- **Source:** package size [Cree] (2835); gap values [Mine]. Notion says LEDs should be within 2 mm of the camera board [Notion-Head].
- **Changed:** the old program used a simple package-overlap test. Earlier versions of this program checked LED centres only, so bodies could cross the lines.

**Grid**
- **What:** the diffuser is split into square cells: 1.5 mm by default (1 / 1.5 / 2 mm selectable).
- **How:** inside test by ray casting. Distance-to-wall field on a 0.75 mm grid, used for fast placement checks.
- **Source:** [Textbook].
- **Changed:** the old program used a 30-wide grid scaled to the shape.

---

## 2. Light model

**Light from each LED onto the diffuser**
- **Equation (per unit LED flux):** E(r) = (m+1)·h^(m+1) / (2π·(r² + h²)^((m+3)/2))
  - h = optical height = gap − LED height = 17.9 − 0.62 = 17.28 mm [STEP], [Cree] p.23; r = horizontal distance, m = 1 (Lambertian).
  - For m = 1 this is **E = Φh² / (π(h² + r²)²)**.
- **Total:** the sum over all LEDs. Light adds linearly.
- **Source:**
  - [Moreno06] Eq. 1 (cos^m intensity) × the incidence cosine on a plane [Textbook]. Moreno's own Eq. 3 is written z^m/R^(m+2): their m also counts the incidence cosine, so their m = 2 is this m = 1. Check 3 reproduces their 0.192 z within 0.001 for that reason.
  - [Ben-Light] derives exactly the m = 1 form: inverse square × cosine incidence × Lambertian emission.
  - Check 1 matches the formula to 7 digits.
- **Changed:**
  - **Formula:** the old program used the same Lambertian physics but divided each LED's light by max(1, captured share). I dropped that.
  - **Speed:** contributions are now stored per LED, so moving one LED recomputes only that LED.

**Head walls**
- **What:** light that would land outside the lit aperture is lost: it hits the drafted walls, the chamfer or the lip [STEP], which are opaque dark PLA [User] (#751b00 in the CAD), so absorbing.
- **Source:** [Moreno06], [Yang09] and [Ben-Light] all model no wall reflection. Reflective walls are left for bench testing.
- **Changed:** an interim reflective/foil wall model was **removed** (not sourced).

**Diffuser transmission τ**
- **What:** the share of light passing through (default 0.70).
- **How:** light out = light on the diffuser × τ.
- **Source:** diffuser as an efficiency loss [Ben-Light]; ≥ 70% requirement [Notion-Head].
- **Changed:** same idea as the old program's τ (default 76%, opal acrylic).

**Light budget: where every lumen goes** (step 3, "Where the light goes")
- **How:** for each LED, the cos^m spot (same equation) is integrated over the diffuser plane at the optical height and split into:
  - **diffuser** (the lit aperture; × τ out, × (1 − τ) absorbed or scattered back)
  - **camera barrel**: lands on its top, or is blocked by it on the way
  - **open camera ring**: Ø 14 to Ø 16, polar integration, leaves undiffused
  - **walls / chamfer / lip**: everything else
- **Zero by geometry:** board windows, edge gap and screw holes have no line of sight from any LED [STEP]. Seams are sealed and the shell is opaque [User].
- **Typical (hex, 25 mA):** out 50%, diffuser loss 22%, walls 28%, barrel 0.24%, ring 0.03% (default corner keepout). Check 22: the shares sum to 100% and the diffuser share equals the field model's.
- **Not modelled:** light piped inside the diffuser to its 1 mm edge (seen through the groove), and light scattered back from the diffuser and reflected (treated as absorbed).
- **Source:** the same kernel as above; geometry [STEP]; materials [User]. **Changed:** new.

**Hotspot ripple check**
- **What:** check 4 shows the model reproduces Yang's Fourier prediction for a large hex array.
  - RMS ripple vs Yang's prediction at 10, 14 and 21 mm optical height, at our LED spacing (this check sets the LED height to 0 so h = gap, as in the prediction).
- **Source:** [Yang09] Eq. 12. The LED spot transform kh·K₁(kh) is [Textbook].

---

## 3. Scores and readouts

**Evenness (darkest spot ÷ average)**
- **What:** E_min / E_avg over the visible diffuser. Target 65%.
- **How:** over the lit aperture (the whole visible lit area, [STEP]), excluding the camera hole.
- **Source:** metric and 65% target [Brief] (the old model's provisional goal). The same idea as the lighting U₀ ratio.
- **Changed:** the old program used the same min/avg, but on a 10%-cropped area.

**Brightness variation (CV)**
- **What:** RMS deviation ÷ mean over the same cells.
- **Source:** [Yang09] (relative RMSE); [Su12] (σ/mean is his objective).
- **Changed:** new. The old program had a "perceived contrast" √(max/min) − 1, now dropped.

**Other readouts:**
- **Dimmest 5% vs average:** the 5th-percentile value ÷ mean [Mine; display only].
- **Light reaching the diffuser:** share of LED light landing on the diffuser (not walls or lens) [Textbook].
- **Light out (lm):** N × Φ_LED × (light reaching the diffuser) × τ [Ben-Light], [Textbook]. Target 300 lm [Brief].
- **Diffuser brightness (cd/m²):** mean exit illuminance ÷ π, the Lambertian luminance [Textbook].
- **LED spacing ÷ gap:** mean nearest-neighbour distance ÷ gap. Below ~1.0, spots merge [Moreno06] spacing/height ratio; [Yang09] scaling property.

**Desk light at 40 cm**
- **What:** min / average / max illuminance over a **40 cm-diameter circle, 40 cm below the diffuser**. Target **≥ 500 lx**.
- **How:**
  - Each diffuser patch (merged into ~6 mm blocks) becomes a Lambertian source carrying E·A·Φ·τ lumens.
  - Desk E = Σ Φ_block·z² / (π(z² + d²)²), on a 21 × 21 grid inside the circle plus 36 points on its edge and the centre.
  - The circle is centred under the diffuser. The head is assumed parallel to the desk.
- **Source:** method, target and geometry [Ben-Light] (citing EN 12464-1); `target_lx: 500` [Ben-Ranges].
  - Check 14 reproduces his example: 251 lm gives ≈ 500 lx below.
- **Assumptions:** the diffuser is treated as Lambertian (Ben himself noted it may not be); head tilt (12°) ignored.
- **Changed:** the old program had a similar task-plane calculation (25 × 25 grid) for its lamp mode. My interim version used a rough on-axis estimate, now replaced.

**Status strip**
- **What:** five tiles: evenness, light out, desk light (min), board temperature, LED power. Plus an issues chip.
- **Colours:**
  - Green = target met.
  - Amber = within 20% (evenness), 15% (light, desk), +10 °C (board) or 20% (power).
  - Red otherwise.
- **Issues chip:** every failed checklist item not already shown as a tile, plus uneven strings.
- **Source:** targets [Brief] / [Ben-Light] / [Ben-Ranges]; colour thresholds [Mine].
- **Changed:** replaces the old metric cards.

**Constraint checklist** (step 5; restored from the old program)

| Check | Limit | Limit from |
|---|---|---|
| Light out | ≥ 300 lm | [Brief] (provisional) |
| Desk light (min) | ≥ 500 lx | [Ben-Light] / [Ben-Ranges] (EN 12464-1) |
| Evenness | ≥ 65% | [Brief] (provisional) |
| Board temperature | ≤ 40 °C | [Brief] (provisional 40 °C goal) |
| LED junction | ≤ 125 °C | [Cree] p.4 |
| Diffuser outside (touch) | ≤ 40 °C | [Brief] 40 °C goal, at the touch point it asks you to probe |
| LED power | ≤ 4 W | [Brief] / [Ben-Heat] 4 W reference |
| Placement | 0 violations | DXF, 2835 body size |
| Driver current | ≤ 60.5 mA | [Sch] R82 + TLC59711 |
| LED current rating | ≤ 480 mA | [Cree] p.4 |
| Ambient rating | −40 to 105 °C | [Cree] p.4 |
| Supply headroom | ≥ 0.4 V | [Sch] divider; 0.4 V [Mine] |
| Driver channels | ≤ 12 strings | [Sch] TLC59711 |

- **Changed from the old list:** junction 125 °C (datasheet) instead of an unsourced 85 °C; shell → diffuser touch point; "cooling" (fan) and PWM frequency dropped; LED current and ambient ratings added.

---

## 4. LEDs, driver and strings

**LED output and power**
- **How:**
  - Flux Φ = Φ_typ(CCT) × (I / 65 mA) × [1 − s(CCT) × (T_j − 25)], with a floor of 0.2; × 0.93 if "worst case" flux is chosen.
  - s(CCT) = (1 − Φ_85 / Φ_typ) / 60 K, the straight line through the datasheet's 25 °C and 85 °C values.
  - Power P = V_f × I with V_f = 2.70 V. Default 3000 K, 25 mA → 13.9 lm (13.0 lm at the worst-case board temperature) and 67.5 mW per LED.
- **Colour temperature table** (Pro9 p.5, 90 CRI, 65 mA, typical lm at T_j 25 / 85 °C):

  | CCT | 2700 | 3000 | 3500 | 4000 | 5000 | 5700 | 6500 |
  |---|---|---|---|---|---|---|---|
  | 25 °C | 34.5 | 36.2 | 37.5 | 38.0 | 38.0 | 37.5 | 37.5 |
  | 85 °C | 32.2 | 33.7 | 35.0 | 35.4 | 35.4 | 35.0 | 35.0 |
  | slope %/°C | 0.111 | 0.115 | 0.111 | 0.114 | 0.114 | 0.111 | 0.111 |

- **Source:**
  - Reference point (2.70 V, 65 mA, R_θj-s 5 K/W, 120° beam, T_j max 125 °C, 480 mA max) and the flux table [Cree] pp.4–5.
  - ±7% flux tolerance [Cree].
  - Linear efficacy drop with temperature: the form is [Hui09] Eq. 2. The slope is now sourced (datasheet 85 °C column), and it equals the old program's 0.00115. Cross-check: the datasheet's relative-flux-vs-T_j graph (p.8) reads about 87% at 125 °C vs the linear model's 88.5%.
  - "Flux ∝ current" [Old]. Cross-check: the datasheet's relative-flux-vs-current graph (p.6) reads about 40% at 25 mA (by eye) vs the linear model's 38.5%, so the model is about 4% conservative at 25 mA.
- **Changed:** CCT select restored and extended (old: 2700 / 3000 K for Cree only); ±7% restored as an option instead of always on. Removed estimated-V_f mode, droop and maintenance (see §0).
- **Cross-check:** Ben's 13.69 lm/LED target [Ben-Heat] vs our 13.9 lm at 25 mA, 3000 K.
- **Effect on Variation A** (re-optimized at the CAD geometry with the default keepout, 25 mA, worst-case heat map; `checks/cct-output.txt`):

  | CCT | Flux | Light out | Desk min | Lowest current meeting 300 lm + 500 lx (chip temperature) |
  |---|---|---|---|---|
  | 3000 K typical | 12.3 lm | 400 lm | 500 lx | 25.0 mA, 4.05 W (chip 124.5 °C) |
  | 3000 K −7% | 11.5 lm | 372 lm | 465 lx | 27.0 mA, 4.37 W (chip 127.1 °C, over 125) |
  | 4000 / 5000 K typical | 13.0 lm | 420 lm | 526 lx | 24.0 mA, 3.89 W (chip 123.2 °C) |
  | 4000 / 5000 K −7% | 12.1 lm | 391 lm | 489 lx | 26.0 mA, 4.21 W (chip 125.8 °C, over 125) |

  With worst-case flux and worst-case heat, no current meets the desk target within the chip limit.

**Lowest-current search** (restored from the old program)
- **What:** finds the lowest current on a 0.5 mA grid (1 mA to the 60.5 mA driver limit) that meets the light-out and desk-minimum targets with the current layout. One click applies it. If the hottest LED chip is then over 125 °C it says so: no current meets both the light targets and the chip limit.
- **How:** light out and desk lux are linear in per-LED flux, so they are scaled from the current result. Each step solves the full heat map (as the app shows it) and derates the flux at the hottest chip. Light rises with current, so the grid is bisected (about 8 map solves); check 25 confirms it matches a full scan.
- **Fixed in the 15 Oct review:** the search (and the optimizer's desk-limit flux) used Ben's LED-only network, which ignores the 4.6 W of electronics. It offered 26 mA, which then showed 482 lx in the app; the map-based answer is 28 mA, with the chip at about 129 °C (hex, worst case).
- **Source:** [Old] `optimizeCurrent`; targets [Brief] / [Ben-Res].
- **Changed:** the old version minimised input power including the driver and fan. Neither is modelled now, so the lowest power is the lowest current.

**Driver and supply**
- **How:**
  - TLC59711 max current = 41 × 1.21 V / R_IREF; R82 = 820 Ω gives **60.5 mA** (current slider maximum).
  - VDD_LED = 0.6 V × (1 + 100k / 4.7k) = **13.37 V**.
  - Headroom = VDD_LED − 5 × V_f = −0.13 V, flagged if below 0.4 V.
- **Source:** resistor values [Sch]; TLC59711 and LMR51420 formulas from my datasheet knowledge (not re-checked against the PDFs); 0.4 V threshold [Mine].
- **Changed:** the old program checked headroom against a 24 V rail with 6 LEDs per string.

**Strings**
- **What:** 12 strings of 5 in series, one per TLC59711 channel.
- **Grouping:**
  - **Rows:** serpentine rows, chunks of 5.
  - **Zones:** rings by distance from the rim (outer ≈ 1/2, middle ≈ 1/3, centre ≈ 1/6 of the strings), each ring cut by angle.
- An LED keeps its string when dragged (wiring is physical). Strings regroup only on new layouts, count changes or **Re-group strings**.
- **Source:** 12 × 5 and channels [Sch]; grouping schemes [Mine].
- **Changed:** new. The old program had a series count only.

**Per-string dimming**
- **What:** one PWM duty slider (0–100%) per string. A string's light and heat scale with its duty.
- **Source:** per-channel PWM [Sch] (TLC59711 16-bit PWM); duty → average light is linear [Textbook]. For DC bench tests, use current × duty.
- **Changed:** new.

**Auto-balance**
- **What:** finds string duties (within your minimum duty, default 0.3) that improve the score.
- **How:**
  - Coordinate descent: step sizes 0.2, 0.1, 0.05, 0.02, 0.01, 0.005.
  - Then rescales so the brightest string is at 100%.
  - Respects the desk minimum (never goes below 500 lx once met).
- **Source:** the principle of dimming the centre to flatten light [Moreno06] §3C (ring with a dimmed centre LED); edge levels may differ [Yang09] §III; algorithm [Mine].
- **Changed:** new.

---

## 5. Thermal model

**Full heat map (the main result)**
- **What:** temperature at every point of the LED board (🌡 Heat above the canvas), each LED chip's temperature, where the heat goes, and the temperatures of the PLA parts and the diffuser surface.
- **Grid:** 2.5 mm cells over the board outline. Each cell exchanges heat with its 4 neighbours through the board (Fourier's law; in-plane conductance = k·t of the base plus the copper).
- **Heat in:**
  - each LED: k_h × P × duty [Hui09]
  - electronics: **4.6 W** worst case from the 24 V input [User], spread evenly (positions unknown), with the camera's 0.5 W on its footprint
  - motor: 0 W (not given)
- **Heat out:**
  - **Front:** Ben's network per unit area (air gap with Nu, PC diffuser, outside h + radiation), unchanged [Ben-Heat].
  - **Back:** across the back cavity, using the **local depth from the STEP** (5 mm map, mean 59 mm): k_air·Nu / L (Ben's Nu for the case) + radiation (board back ε 0.1 bare aluminium, shell 0.9) to the Head Back inner surface; then the 3 mm PLA wall (k 0.13) and outside convection (Ben's h) + radiation over the STEP room-facing area 36,467 mm².
  - **Bosses:** 6 PLA screw bosses touching the board (STEP contact areas 52–62 mm², 5 mm long) into the same Head Back node.
- **Solver:** conjugate gradients with a two-level (Jacobi + 10 mm aggregate) preconditioner; radiation re-linearised over 4 outer iterations. About 40–150 ms.
- **LED chip:** T_j = T_board under it + heat × (R_j-s 5 K/W [Cree] p.4 + dielectric 0.1 mm / (2 W/m·K × 6.47 mm² recommended pad, [Cree] p.23) ≈ 7.7 K/W; dielectric values ASSUMED).
- **Board:** metal-core [User]; ASSUMED typical values until the stack-up exists: 1.6 mm aluminium (k 138), 1 oz copper, 0.1 mm dielectric (k 2). "FR4" is a comparison option. Editable in step 4 → "Board and electronics".
- **Checks:**
  - **Check 20:** with the back path off, no electronics and a near-perfect board, the map gives **exactly Ben's board temperature** (90.69 °C).
  - **Check 21:** heat out = heat in (8.04 W), and the 2.5 mm and 1.5 mm grids agree to 0.05 °C.
- **Results (hex layout, 25 mA, 3000 K):**
  - Board 124 °C worst case / 85 °C best case, flat to about 2.5 °C.
  - LED chips about 124.5 °C worst case (limit 125).
  - Heat out (8.04 W): front 5.84 W, back 1.86 W, bosses 0.34 W (check 21).
  - Diffuser surface up to 77 °C; Head Back inside 35 °C.
  - **PLA bosses at board temperature**, far above PLA's 55–60 °C softening.
- **Not modelled:** the Head Front walls as a separate path; air movement between the two cavities through the board windows and edge gap; heat from light absorbed on the walls; contact resistances at the bosses; where on the board the electronics actually sit.
- **Source:** [Ben-Heat] front path and cases; [STEP] geometry; [User] materials and power; k_PLA, ε, aluminium/dielectric values [Textbook] typical (assumed). **Changed:** new; replaces "one board temperature".

**Boss → shell spreading (added with the what-ifs)**
- **Why:** treating the PLA shell as one temperature let heat entering at a small boss reach the whole shell for free. That made aluminium standoffs look like a 60 °C fix.
- **Now:** each boss path = boss column L/(kA) + radial spreading into the 3 mm wall, ln(R/r_b)/(2π k t) [Textbook], with r_b = 4.3 mm (STEP) and R = the radius of an equal share of the shell's inside area (ASSUMED share).
- **Effect:** about 1,000 K/W per boss in PLA, so the bosses carry about 0.3 W and the board is about 124 °C (was 119). Aluminium standoffs alone now help about 2 °C; they only pay off with a conductive shell (check 24).

**Warm-up (step 4)**
- **Model:** a lumped 3-node RC network (board, diffuser, shell).
  - Conductances: from the steady map (Ben's air-gap and diffuser/outside resistances, the map's board → shell and shell → room values).
  - Heat capacities: STEP volumes × typical material values (ASSUMED: aluminium 2700 kg/m³ × 900 J/kg·K, PC 1200 × 1200, PLA 1240 × 1800).
  - Implicit Euler.
- **Result (worst case):** 63% of the rise after about 11 min, 95% after about 35 min. Bench runs need at least that long.
- **Check 23:** it settles on the steady map's board average.

**Passive-cooling what-ifs (step 4)**
- **How:** the full map rerun with one change each (typical values, ASSUMED):
  - board back black (ε 0.1 → 0.9)
  - aluminium standoffs
  - Head Back in PC or aluminium
  - electronics at typical power (2.0 W, your table) or off the board
  - a combination
- **Worst-case results:**

  | Option | Board |
  |---|---|
  | Black back | 91 °C |
  | Standoffs alone | 122 °C |
  | Aluminium Head Back | 119 °C |
  | Typical electronics | 98 °C |
  | No electronics | 75 °C |
  | Black back + standoffs + aluminium Head Back | 58 °C |
- **Lesson:** the back cavity is radiation-limited, so the board-back finish is the cheapest big lever.

**Which assumption matters most (step 4)**
- **How:** each uncertain input moved to its low/high end, one at a time, shown as a sensitivity bar chart.
- **Worst case, largest first:**

  | Input | Board range |
  |---|---|
  | Air movement (Ben's cases) | 85–124 °C |
  | Board-back emissivity | 129–91 °C |
  | Electronics power | 98–124 °C |
  | Room temperature | 122–127 °C |
  | k_h | 123–126 °C |

  The PLA conductivity, aluminium thickness and shell emissivity matter little. So: pin down the back finish and the real air movement, i.e. measure.

**Electronics hot spots (step 4 → Board and electronics)**
- **What:** "name, x, y, W[, size]" lines place parts of the electronics power on squares; the rest stays even.
- **Example:** a 2.4 W SoC on 14 mm raises the hottest point by about 3 °C on the metal-core board.

**Ben's network (reference, unchanged)**
- **Network** (heat leaves through the **front only**, Ben's conservative assumption):
  - **Air gap:** R_conv = L / (k_air·A·Nu), in parallel with radiation R_rad = 1 / (ε_PCB·σ·A·(T₁² + T₂²)(T₁ + T₂)).
  - **Through the diffuser:** R_PC = t / (k_PC·A).
  - **Diffuser to room:** convection 1 / (h·A), in parallel with radiation (ε_PC).
  - **Result:** T_board = T_room + Q × (R_gap + R_PC + R_out).
- **Constants:** k_air 0.026, ν 1.51e-5, α 18.46e-6, ε_PCB 0.85, ε_PC 0.90, PC 1 mm with k 0.2. A = outline area.
- **Cases:**
  - Worst: Nu 1, h 2 W/m²K. Best: Nu 3, h 25 W/m²K. Or custom.
  - The strip shows the selected case, plus the best–worst range.
- **Rayleigh number:** Ra = g·β·ΔT·L³ / (ν·α) shown, with Ben's 1708 convection threshold.
- **Radiation:** evaluated at the solved temperatures (iterative).
- **Source:** [Ben-Heat], the entire network, constants and cases.
  - Check 5 reproduces his 247 °C and 139.3 °C exactly, using his fixed 330/310 K radiation temperatures in that check only.
- **Differences from Ben:** our outline area instead of his 12,000 mm², your gap instead of 21 mm, Q from Hui instead of a flat 10 W.
- **Changed:**
  - Replaces the old program's two-node network with copper/fan/frame paths (sources unclear).
  - An interim 2-D board map with foil options was removed earlier (not sourced). The new map above is built only from Ben's network, the STEP geometry and your answers, and reduces exactly to Ben's network (check 20).
  - Ben's network still runs and is shown under "Ben's network (reference)"; the strip shows the map.

**Heat and LED chip temperature**
- **How:**
  - Heat Q = k_h × Σ(P_LED × duty), with k_h = 0.85.
  - T_j = T_board + R × k_h × P_LED, with R = R_j-s (junction to solder point) = 5 K/W.
  - T_j also sets the flux derating.
- **Source:** [Hui09] Eqs. 3 and 5a (k_h = 0.85 is their measured value, for 2009-era LEDs); R_j-s [Cree] p.4 (Hui's equation uses R_jc; the datasheet gives junction-to-solder-point).
- **Changed:** the old program used electrical power minus radiant light (via 300 lm/W) plus a hotspot term. Replaced by Hui's form.

---

## 6. Layout generators

**🎲 Randomize: Poisson-disk**
- **What:** random but evenly spread positions with guaranteed spacing.
- **How:**
  - Bridson's algorithm: a background grid of cell size r/√2, 30 candidates per active point in the ring [r, 2r].
  - The radius starts at 0.85 × √(area/N) and is tuned over up to 10 tries to reach ≥ N points. Extras are dropped at random; any shortfall is filled by best-candidate sampling.
  - Seeded, so the same seed gives the same layout.
- **Source:** [Bridson07]; radius tuning [Mine].
- **Changed:** new. The old program had no randomize.
- **Uniform-random mode:** plain rejection sampling, for comparison [Textbook].

**⬡ Hex grid**
- **What:** rows offset by d/2, spaced 0.866·d apart. Uses the largest spacing that still fits N LEDs.
- **How:** bisection on d (22 steps) with a 5 × 5 offset search. Extras are removed from the most crowded spots.
- **Source:**
  - Geometry [Moreno06] "triangular (hexagonal)" array; check 3 reproduces his 7 × 7 optimum (0.191 vs 0.192 z).
  - Hex beats square [Yang09].
  - Fitting procedure [Mine].
- **Changed:** the old program had rectangular, staggered and sunflower patterns.

**◎ Even out: CVT / Lloyd**
- **What:** each LED moves to the centre of the area it "owns". 30 iterations on a 1 mm sample grid; moves that would break a limit are halved.
- **Source:** [DFG99]. Check 9: the spread of per-LED area drops from 41% to 17%.
- **Changed:** new.

**↯ Jitter**
- **What:** random ±1 mm nudge of every LED (6 tries each), keeping limits.
- **Source:** [Mine].
- **Changed:** new.

---

## 7. Optimizer

**Score**
- **Equation:** J = 1.0 × CV + 0.6 × (1 − evenness). Lower is better; both weights are sliders.
- **Source:** CV [Su12] / [Yang09]; evenness target [Brief]; weights [Mine].
- **Changed:** the old program had no placement score. My interim light-utilisation and heat-clustering terms were removed after the ablation test.

**Hard limits:** wall, lens and screw clearances, minimum spacing, and the desk minimum (§7, Desk limit).

**Stage 1: simulated annealing**
- **How:**
  - Each iteration moves one random LED by a Gaussian step. The step size shrinks from 35% of the LED pitch to ~1% of it.
  - Moves that break a limit are rejected.
  - Otherwise the move is accepted if J improves, or with probability e^(−ΔJ/T).
  - T starts at 0.6 × the average uphill ΔJ (sampled over 40 trial moves) and cools geometrically to 0.001 × that.
  - The best layout seen is kept. Effort: 2,500 / 6,000 / 15,000 iterations.
- **Source:** method (LED x, y as variables, CV objective, Metropolis rule, geometric cooling) [Su12]; schedule numbers [Mine].
- **Changed:** new.

**Stage 2: local-search polish**
- **How:** each LED tries 8 directions at 1, 0.5, 0.25 and 0.125 mm (up to 6 passes per step) and keeps only improvements.
- **Source:** local search on LED positions [Lei14] (abstract only); details [Mine].

**Grid used:** the same 1.5 mm grid as the display, so the reported result can't be worse than the optimizer's own result.
- **Changed:** an interim version optimized on a coarser 3 mm grid, which could make the displayed result worse. Fixed.

**Desk limit (on by default)**
- **How:**
  - Each move's desk minimum is checked against 500 lx (block-to-desk matrix precomputed).
  - Below target, the score gets a 50 × (shortfall ÷ target) penalty, so a layout that starts too dim climbs toward the target.
  - Once met, any move that would break it is rejected.
  - You get a warning if 500 lx can't be reached at the current setting.
- **Source:** target [Ben-Light]; method [Mine]. Check 15 confirms it holds.
- **Finding (CAD geometry, default keepout, `checks/desk-limit.js`):** at 25 mA the limit is met (500 lx) by pulling LEDs inward (CV 34% vs 24% with the limit off). At 20 mA it can't be met: the LEDs bunch up (CV 108%) and still only reach 473 lx.

**Optimize string dimming at the same time (option)**
- **How:**
  - 5% of iterations change one string's duty (Gaussian step, shrinking).
  - Strings are regrouped (zones) every 500 iterations as LEDs move, each new string taking its LEDs' average duty.
  - Auto-balance runs at the end.
- **Source:** solving spacing and centre-LED flux together [Moreno06] §3C; method [Mine].
- **Test (CAD geometry, default keepout, regenerated 15 Oct):** a slightly better score than placing first and then pressing Auto-balance (better in 5 of 6 runs; CV 24.1% vs 24.3%, min/avg 4.4% vs 4.1%), but it keeps less light (69% vs 79%). See `checks/dimming-compare.js`.

**Find best from scratch (multi-start)**
- **How:** K fresh starts (default 3): Poisson → CVT (25 iterations) → optimize. Keeps the best.
- **Source:** [Mine], standard multi-start practice.

**Background running and live view**
- Runs in a Web Worker, so the page stays usable.
- Progress every 150 ms; the canvas previews the best layout every 200 ms.
- A chart shows evenness and variation vs iterations, with plain-language stage text (temperature, step size, share of moves kept, desk minimum).
- Ctrl+Z undoes the whole run, including any dimming change.
- **Source:** [Mine]. **Changed:** new.

**Camera auto-move:** **removed.** It made no measurable difference, and the score ignores the camera's field of view.

---

## 8. Editing and interface

**Canvas editing**
- **Drag:**
  - Updates are coalesced to animation frames, ~5–8 ms each (the old app took ~150 ms).
  - "Slide along limits" binary-searches the furthest legal point along the drag direction, so LEDs stop at the dotted lines instead of sticking.
  - Optional snap.
- **Tools and keys:**
  - Add / Remove tools; V / A / X switch tools.
  - Arrow keys nudge 0.5 mm (Shift = 2 mm); Delete removes.
  - Exact x/y entry under the canvas.
- **Footer:** the selected LED's 3 nearest neighbours, and its distance from the head's left and bottom edges.
- **Source:** [Mine]. **Changed:** the old app had drag (throttled 35 ms, full recompute) and arrow keys.

**Spacing view**
- **What:** "spacing (mm)" draws a line and distance label between each pair of neighbouring LEDs. A pair counts as neighbours if within 1.35 × either LED's nearest-neighbour distance.
- **Source:** [Mine]. **Changed:** new.

**Undo / redo**
- **What:** up to 200 steps, covering LED positions and the camera position (Ctrl+Z, Ctrl+Y).
- **Changed:** new.

**Five-step layout, tooltips, walkthrough**
- **What:**
  - One step's controls at a time; rarely used settings under "Advanced".
  - **?** tooltips in plain language.
  - A 7-card first-run walkthrough (replay with **? Walkthrough**).
- **Changed:** replaces the old app's single long page of every control.

**Snapshots and side-by-side comparison**
- **What:**
  - Save the current design with a name, a 320 px diffuser thumbnail and its key numbers.
  - The compare view shows the current design next to all snapshots, with ★ on the best value in each row: evenness (highest), variation (lowest), light (highest), board temperature (lowest), power (lowest).
  - ↺ Restore any snapshot.
- **Changed:** the old app had no snapshots.

**New, Open, Save, theme**
- **New:** resets to defaults (hex grid, no snapshots), after a confirmation.
- **Open:** this program's JSON, an old LED Matrix Lab JSON (layout only), or any CSV with x/y columns.
- **Save:** JSON with settings, layout, strings and snapshots.
- **Autosave:** the session (and current step) is kept in the browser.
- **Theme:** ◐ toggles light/dark.
- **Changed:** the old app had Save/Open JSON and CSV import. New, autosave and theme are new.

**Exports (step 5)**
- **LED positions CSV:** id, string, duty, x/y, x from the left edge, y from the bottom edge, nearest LED and its distance, DXF-drawn coordinates.
- **LED spacing CSV:** every neighbouring pair and its distance.
- **DXF:** layers OUTLINE, CAMERA (lens circle), LED_BODY (3.58 × 2.97 package rectangles, Pro9 p.23), LED_CENTRE, LED_LABEL, SPACING (lines and distance labels; optional).
- **Source:** [Mine]. **Changed:** the old app exported an x/y CSV only.

**3D view and 3D compare** (🧊 3D above the canvas; `view3d.js`, three.js r147)
- **What:** the LED board and LEDs, walls, camera barrel, the diffuser, and the desk at the set distance with the target circle.
  - Shows **this design plus up to 3 snapshots side by side**, ticked under "Compare with".
  - **One camera for all panels:** orbiting one orbits all.
  - **One shared scale:** the same colour or height means the same value in every panel.
  - Each panel's label shows evenness, variation, darkest 5%, light out and desk min/avg.
  - "Snapshot is reference" puts the first ticked snapshot (e.g. Baseline) first, as the reference.
- **Where the brightness comes from:** only the model.
  - **Diffuser:** exit luminance L = E·Φ·τ / π, computed per design from its own layout, duty, current and colour temperature.
  - **Desk:** `deskMap`, Ben's method on an 80 × 80 grid, plus room light.
  - Three.js lights only make the board and walls visible.
- **Looks** (made so differences are obvious):
  - **Hot & dark spots** (default): each cell's % above or below *its own design's* average. Diverging colours: blue = darker, white = average, red = brighter; full colour at ±10 / 25 / 50%.
    - Hex Baseline vs optimized A at 10 mm: the hex's darkest 5% of the diffuser is at 54% of average (deep blue rim), A's at 84% (pale). Its CV is 20.7% vs 10.8%.
  - **Brightness (shared scale):** absolute cd/m² on the diffuser and lx on the desk, on one range set by the brightest panel. Shows which design is brighter overall.
  - **Real look:** one camera exposure for every panel, set by the reference panel. Tone curve x / (1 + x).
- **Relief:** exaggerated height, h = (value ÷ reference average − 1) × scale (diffuser 1.5 × gap per ×1; desk 0.25 × desk distance per ×1). The reference is the first panel, shared by all. It turns ripple into visible bumps and dark edges into slopes. 0 = flat.
- **Why the old single view looked the same for hex and optimized:**
  - **Whole-scene view:** it was exposed for the desk, so the diffuser was blown out to white, hiding its pattern.
  - **"Lux colours":** it re-scaled each design to its own average.
  - **The desk itself barely differs:** at 40 cm every desk point sees the whole diffuser. Hex vs A desk evenness is 81.7% vs 82.0%; only the overall level differs (hex about 9% brighter, because its LEDs sit further from the absorbing walls).
- **Other options:** walls see-through / solid / hidden; "open up" separates board and diffuser; beam cones (θ½ = acos(0.5^(1/m)), 60° for m = 1, [Moreno06] Eq. 2); camera presets (head and from-below fit the head to the panel); one PNG of all panels; full screen.
- **Display-only assumptions:** desk reflectance 0.5 (Real look only); LED colour from an approximate blackbody RGB; screw holes drawn as small posts.
- **Not shown:** wall reflections (absorbing in the model), head tilt, heat (one board temperature).
- **Source:** physics from §2–3; rendering [Mine]. **Changed:** new.

**Realistic scene: lamp on a bedroom nightstand** (3D → Scene → *Bedroom nightstand (realistic)*)
- **What:** a bedroom with these items, all with soft shadows:
  - an oak nightstand (top 560 × 440 mm) whose top sits exactly the desk distance (40 cm) below the diffuser
  - the lamp: base, two arm links, the head shell extruded from the DXF outline, and the glowing diffuser
  - props on the nightstand: books, a mug, a phone, a glasses case
  - a bed, walls and a floor
- **How the light is made to match the model:**
  - The lamp's light is **one shadow-casting SpotLight** at the diffuser centre, using three.js physically-correct lights. Intensity is in candela, and E = I·cos θ / d².
  - Its intensity pattern (`SpotLight.map`) is fitted to the model's desk calculation. A ray hitting the nightstand plane at (u, v) gets I(θ) = E_model(u, v) · r² / cos θ, using `E.deskMap` on a 256 × 256 grid out to 75°.
  - So the nightstand top receives **exactly the model's desk illuminance**. Walls, bed, floor and props are lit by the same intensity pattern with correct inverse-square and angle.
  - The diffuser is an emissive surface carrying the model's luminance map (cd/m², linear), passed through the same camera tone curve (ACES), so it blows out like a real lamp in a photo.
  - **Room light** = step 1's room-light value, plus a faint 0.3 lx fill so the room isn't pitch black.
  - **Exposure** is metered on the nightstand top, like a phone camera, and adjustable in EV.
- **Not modelled:**
  - **Light bouncing off walls, bedding and furniture (no global illumination).** Shadowed and indirectly lit areas look darker than in a real room.
  - **Exact shadow shape.** Shadows come from a point at the diffuser centre, blurred to suggest the 14 cm-wide source; real penumbras will differ.
  - Light beyond 75° from straight down (about 7% of a Lambertian source's light).
  - The furniture, props and lamp arm are illustrative, not LeLamp CAD.
- **Display-only assumptions:** material colours and roughness; nightstand albedo about 0.45 for the exposure meter; blackbody LED colour.
- **Source:** light pattern from the model ([Ben-Light] desk method, [Moreno06] Lambertian); rendering [Mine]. **Changed:** new.

**Thermal-camera view** (3D → Bedroom nightstand → Look: *Thermal camera*)
- **What:** the nightstand scene coloured like an IR camera, on one °C scale (room temperature → hottest board point).
- **Only computed temperatures are coloured:**
  - the diffuser outer surface, per cell (thermalMap: Ben's outside resistance over each cell)
  - the Head Back outer surface, one lumped value
  - with "see inside": the LED board map

  Everything the model doesn't compute is plain grey: Head Front, camera, neck, motor, furniture, room. No temperature is invented for them.
- **Source:** thermalMap (§5). **Changed:** new.

**Heat cutaway (3D → Scene → Heat cutaway)**
- **What:** a section through the head, movable with a slider: the LED board and diffuser per cell, the screw bosses and Head Back (lumped), on one °C scale.
- **Labels:** temperatures, including bosses flagged above the PLA limit, and heat-flow arrows in W (front, back cavity, bosses).
- **Not modelled, so grey:** Head Front and camera. Cavity air is not drawn.
- **Thermal camera (nightstand):** its scale is now fitted to the visible surfaces (room → diffuser surface), and it opens in a close-up of the lamp. It still only shows what an IR camera would see from outside; the cutaway is the view that explains the heat.

**Report (step 5 → 📄 Report)**
- **What:** one click builds a printable report (print → Save as PDF) from the current model:
  - summary of pass/fail and the biggest passive lever
  - every design and snapshot recomputed side by side
  - light and heat map images and the 3D view
  - where the light goes, heat numbers, the warm-up curve, what-ifs and sensitivity (if run)
  - the constraint checklist with sources
  - every assumed value, the LED-position build record, and a short methods/sources list
- "Report (.html)" downloads it instead.

**Other usability additions**
- **Cursor readout:** hovering the canvas shows the board and diffuser-surface temperature (🌡 Heat), or brightness as % of average and lx (☀ Light).
- **Fix buttons:** each failed checklist row offers the tool that addresses it: Find current, Optimize, See heat.
- **Evidence panel:** step 5. Every model value with its source, filterable (assumed only, not in the project files, your answers, CAD, datasheet) and searchable.

**Room light (dark room vs lit room)**
- **The model is a dark room:** every lux and luminance value is the lamp's own light.
- **Ben's documentation:** room light appears only qualitatively. "Find LED baseline ranges" cites a power law for perceived brightness (Stevens' law, my attribution; Ben doesn't name it), S ∝ Iⁿ with n between 1/3 and 1/2, and notes that the same lux feels brighter in a dark room than in sunlight. He used the law to turn lux ratios into perceived differences (1200/1000 lx → about 9.5%; 700/500 lx → about 18.3%), not to add room light. His heat calcs' "ambient" is 25 °C air, not light. Elsewhere in Notion, the software side has an `ambient_light` input meant to regulate lamp output ("Data Collection") and an adaptive mode that uses "only a low fill light during daylight" ("Polish Adaptive Light Experience"). So the lamp is expected to run brightest in the dark.
- **Effect:**
  - **Desk:** illuminances add. E_desk = E_lamp + E_room, so the 500 lx check, which is a total task illuminance in EN 12464-1, is met with less lamp light in a lit room. Desk evenness also improves: (min + E_room) / (avg + E_room).
  - **Diffuser:** room light adds about E_room·ρ/π to its luminance: ~100 cd/m² for 300–500 lx on a white diffuser, under 1% of ~12,000 cd/m². Diffuser evenness and the hotspot score are effectively unchanged.
  - **Perception:** in a dark room the eye adapts to the lamp, so diffuser hotspots and desk-edge fall-off are most noticeable. Dark room is the worst case for how it looks and for desk light, and since firmware dims in daylight, also for current and heat.
- **In the app:** **step 1 → "Room light already on the desk (lx)"** (`cfg.roomLux`, default **0 = dark room**). It is added to every desk point in:
  - the desk tile, which says "incl. N lx room light" or "dark room (lamp only)"
  - the optimizer's hard desk limit
  - Auto-balance's desk limit
  - the lowest-current search
  - the checklist
  - the 3D view

  It is not added to the diffuser (under 1% there).
  - Example (check 19, regenerated 15 Oct): with 300 lx room light, the desk minimum goes from 369 to 669 lx at the reference current. The lowest current meeting 300 lm and 500 lx drops from 28 to 20 mA, where light out becomes the limit.
  - Keep 0 for design sign-off (worst case). Use a measured value, from a lux meter on the desk with the lamp off, to see how much the firmware could dim in a lit room.
- **Source:** superposition of illuminance [Textbook]; 500 lx as total task illuminance [Ben-Light] (EN 12464-1); room value [user input]. **Changed:** new.

---

## 9. Checks you can run

All from `code/`:
- `node checks/examples.js`: 25 checks with source, expected and actual values:
  - light formula, energy conservation, Moreno spacing, Yang ripple
  - Ben's heat calc, Hui's equations, driver limits
  - Randomize, Even out, Optimize, dimming
  - camera keepout clearance, spacing table, desk light, desk limit
  - colour-temperature flux vs datasheet, lowest-current search, constraint checklist, room light
  - heat map vs Ben's network, heat-map energy balance and grid convergence, light budget accounts for every lumen
  - warm-up settles on the steady map, passive-cooling what-ifs behave physically
  - current-sweep bisection matches a full scan with heat-map derating
- `checks/cct-output.txt`: Variation A at 3000 / 4000 / 5000 K, typical and −7%.
- *(The next two were run at the old assumed 10 mm geometry; their conclusions still hold, and the numbers shift at 17.9 mm.)*
- `node checks/gap21-why.js`: why evenness stays below 65% (10, 17.9 and 21 mm). With the original DXF keepout the darkest point is always next to the lens inside the keepout corner, so min/avg is 0–5% at every gap, current and LED count; with no camera at 21 mm it is 42%. The desk limit at 25 mA also pulls LEDs inward (5% → 0% at 21 mm).
- `node checks/thermal-40c.js`: with the full heat map the electronics alone (LEDs off) put the board at 62–90 °C, so 40 °C is impossible at any LED current. Even with the electronics off the board, 40 °C allows only 6.6 mA (1.08 W, 110 lm, 134 lx) in the worst case.
- `node checks/example-variations.js`: reference numbers for the Baseline / A / B walkthrough.
- `node checks/dimming-compare.js`: joint vs two-pass dimming.
- `node checks/desk-limit.js`: desk limit at 25 and 20 mA.
- `node checks/cct.js`: the colour-temperature table above.
- `checks/ablation-output.txt`: record only (14 Oct, old model; the script no longer runs) of the test that removed the extra score terms and camera moves.

---

## 10. Assumptions still to confirm

| Item | Current value | How to resolve |
|---|---|---|
| ~~Gap, lens, hidden rim~~ | **settled by the STEP**: 17.9 mm, barrel Ø 14 in a Ø 16 hole, 1 mm rim on a ledge (lit aperture 3.6 mm inside the board edge) | done |
| PCB stack-up (metal-core) | ASSUMED 1.6 mm Al k 138, 1 oz Cu, 0.1 mm dielectric k 2, bare back ε 0.1 | PCB fab stack-up |
| Electronics placement on the board | spread evenly (4.6 W worst case) | Board layout (where the SoC and DC/DC sit) |
| Are the SoC/DC/DC really on the metal-core LED board? | yes, per the schematic and your power table | Board layout |
| PLA properties | k 0.13 W/m·K, ε 0.9, softening ~55–60 °C (textbook) | Material datasheet of the filament used |
| Motor heat into the head | 0 W | Motor current while the lamp holds pose |
| Diffuser "70 percent diffusion" | read as transmission τ = 0.70 | Diffuser datasheet (transmission vs haze) |
| LED positions on the real board | not in the CAD | Board layout file |
| LED flux, V_f, temperature slope, flux vs current | F-class Pro9 datasheet per CCT; flux linear in current (about 4% conservative at 25 mA) | J-class datasheet pp.9–10 (the brief warns not to mix classes); the board part is 6500 K |
| Heat share k_h | 0.85 (Hui's 2009 LEDs) | Bench: power vs light |
| Diffuser as a Lambertian source (desk light) | assumed | Lux at 40 cm on the bench |
| Head parallel to the desk | assumed (DXF shows 12° tilt) | Confirm head angle in use |
| Clearances, headroom threshold | 1.3 / 1.5 / 3.5 / 4.5 mm, 0.4 V | Zoheb/Rizwan; TLC59711 datasheet |
| Optimizer tuning | cooling, step sizes, move mix, penalty 50 | Affects speed, not physics; outcomes covered by the checks |
