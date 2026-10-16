# Reducing stray light from the main LED matrix

*Lewis Zhang · 16 Oct 2026 · Geometry comes from `context/step_extract` (STEP). Light figures come from the program's light budget (`checks/example-variations-output.txt`) and from hand estimates, not bench results.*

**Scope.** Three ways light from the 60-LED face goes where it shouldn't:
1. **Escape:** light lost inside the head (walls, board openings, the back cavity, edge glow) instead of leaving through the diffuser.
2. **Camera:** LED light reaching the camera lens and causing flare or haze.
3. **Glare:** the lit face dazzling the person the lamp looks at.

**How to read this.** Each section starts with what the sources say, then what it means for the Head, then the recommendation. Summaries are paraphrased. Source tags:

| Tag | Meaning |
|---|---|
| **[full text]** | The paper itself was read |
| **[abstract]** | Only the abstract or a listing was read |
| **[secondary]** | Not peer-reviewed: vendor, patent, app note, or a standard quoted by someone else |

The sources here were gathered by research sub-agents and carry the tags they reported. **I have checked three of them against the PDFs in `context/papers`: [E2] Sun et al., [G1] Tashiro et al. and [G2] Yang et al.** Their tags read **[full text, checked]**. Every other tag is still as the agents reported it.

### Corrections after checking the full texts (16 Oct)

1. **[E2] Sun et al.**
   - The efficiency η = T / (1 − R<sub>b</sub>·R) is defined *relative to the same cavity without the diffuser*. It is not the share of LED light that gets out.
   - R<sub>b</sub> is one lumped reflectance for all the other cavity surfaces.
   - The model ignores side-wall interaction, which caused deviations up to ≈ 10% in their tests.
   - Their walls were white scatter sheet or silver coating, not dark walls.
2. **[G1] Tashiro's "effective glare luminance" (checked against the full text).**
   - The paper's own abstract describes it as "the sum of luminances in the luminaire area divided by the effective area". That is where the first version's wording came from.
   - In the body (§6.2, eq. 7) each pixel is first weighted by WF = 4.0 × 10⁻⁵ × L<sup>0.811</sup>. The divisor is the *effective area* (the non-zero pixels), not every pixel in the frame.
   - The unweighted version is the paper's separate "average luminance of the effective area", and it did *not* unify uniform and non-uniform sources.
   - So the weighted definition is the right one to use. [G2] summarises it correctly, except for writing the divisor as N pixels.
   - **Size limit.** Tashiro's sources spanned ≤ 5° × 5°. This head's 134 mm face spans ≈ 15° at 0.5 m and ≈ 7.6° at 1 m, so their glare formula is also an extrapolation here.
3. **[G2] Yang et al. tested a very different viewing case.**
   - Panels were 16 cm at 2.5 m, seen 10° or 20° above the line of sight (≈ 0.004 sr). Diffused panels were at most ≈ 3,000 cd/m².
   - This head is seen head-on, at ≈ 0.04 sr and ≈ 12,000 cd/m², so applying their models here is extrapolation.
   - In their data, the three diffused panels did not differ significantly from one another in glare; raw and patterned LED matrices were the more glaring ones. §3's mitigation order is revised to match.
4. **[G2] year:** published online 2016; print issue 49(6), 2017.

## Summary

| Problem | Biggest cause in this head | Best fix | Rough size of effect |
|---|---|---|---|
| Escape | Dark PLA walls absorb ≈ 95% of what hits them (22–28% of all LED light on the first pass) | White, high-reflectance wall liner + white solder mask | Light out ≈ 59% → ≈ 72–83% (estimate, §1) |
| Escape | Board openings, mainly the 776 mm² edge gap | Close the edge gap | ≈ 1% now; ≈ 2.6% once the walls are white |
| Camera | Open 1 mm ring around the barrel; glowing diffuser hole edge right beside the lens | Black seal or sleeve, black hole edge, short hood | Unknown; no source gives the split, so measure it (§2) |
| Glare | Face luminance ≈ 12,000 cd/m² at today's ≈ 400 lm, plus hotspots | Dim when facing a person; keep the face out of view in task mode | Only desk-lamp limit found: 2,000 cd/m² (secondary source) |

---

## 1. Light escaping the wrong way

### What the sources say

**Integrating-cavity theory** (Labsphere guide [E1], full text, vendor)
- A diffuse cavity multiplies light by M = ρ / (1 − ρ(1 − f)), where f is the share of area that is ports or holes.
- With mixed surfaces, ρ(1 − f) becomes the area-weighted average reflectance, so every surface counts by area × reflectance.
- M is very sensitive to ρ when ρ is close to 1.
- It is a mixing approximation; the exact result depends on geometry and how each surface scatters.

**Sun, Chien, Moreno et al. [E2]** (full text, checked)
- **The model.** One "equivalent ray" stands in for all scattered rays, as in integrating-sphere theory. That gives η = T + T·R<sub>b</sub>·R + T·R<sub>b</sub>²·R² + … = T / (1 − R<sub>b</sub>·R) (eq. 1).
  - T and R are the diffuser's one-pass transmission and reflection; R<sub>b</sub> is the reflection of the other cavity surfaces.
  - η is output with the diffuser divided by output without it.
  - T and R are taken at an effective angle: ≈ 45° for low-scatter walls with Lambertian LEDs, ≈ 30° for white scatter walls. Absorption is implicit in T and R.
- **Validation.** 24 LED cavities with white-scatter or silver walls. The model matched within 4.96% (white) and 4.7% (silver). Side walls aren't modelled; they caused up to ≈ 10% deviation in some cavities.
- **Fig. 8.** For their 70%-transmission diffuser, η rises from ≈ 0.81 at R<sub>b</sub> = 0.70 to ≈ 0.95 at R<sub>b</sub> = 0.99. Walls above 96% give ≈ 92%.
- **Summary point:** a diffuser on a cavity reduces glare by turning point sources into a larger, softer glowing area.
- **Check on §1's assumption.** Solving eq. 1 for their T70 curve (η ≈ 0.90 at R<sub>b</sub> = 0.90) gives R ≈ 0.25 for a 70% diffuser. That matches the R = 0.25 assumed below (my derivation, not a value they state).

**3M hollow-backlight patent [E3]** (secondary)
- Recycling gain is T / (1 − R<sub>front</sub>·R<sub>back,eff</sub>), where R<sub>back,eff</sub> is the area-weighted reflectance of everything on the back plane: LED packages, circuitry, bare board and gaps.
- The LED packages were taken as ≈ 50% reflective.
- Small changes in R<sub>back,eff</sub> have a large effect on brightness.

**Reflectance values**

| Material | Reflectance | Source |
|---|---|---|
| White solder mask, one 20 µm coat | 87–90% | [E4] abstract; loses up to 10% after 1000 h at 100 °C, mostly in the blue |
| White solder mask, four coats (80 µm) | ≈ 95% | [E4] abstract |
| Standard white mask (patent) | ≈ 80% or less | [E5] secondary |
| 3M ESR film | ≥ 98%, specular | [E6] secondary |
| MCPET foam | ≈ 99% total, almost all diffuse | [E7] secondary |
| White PC, high-reflectance grades | ≈ 95% diffuse | [E8] secondary |
| White 3D-printed PLA | 65–75% of a reference reflector, and not fully opaque | [E9] full text |
| This head's walls (#751b00 PLA) | ≈ 5–8%: ≈ 4.5% diffuse from the sRGB colour, plus ≈ 3.5% gloss reflection | Calculated, not measured |

**Two further points from the sources**
- **Translucent PC [E8]:** a 1 mm diffusing grade that transmits 72% spreads light widely and hides the LEDs well. That matches this head's τ ≈ 0.70 diffuser.
- **Mini-LED cavity study [E10]** (full text): reflective cavities raised luminance 1.18× and uniformity from 75% to 90%. That result includes the films, so it isn't a pure wall-only effect.

**Gap.** No peer-reviewed source was found that measures **edge glow** in diffuser sheets, or the edge darkening caused by absorbing walls.

### What this means for the Head

**First pass (program light budget).**
- 22–28% of the LED light lands on the drafted walls, the 43° chamfer and the lip.
- That share is high even at a 10 mm gap, because the lip opening sits 3.6 mm inside the board edge.
- Only 50–54% leaves through the diffuser on the first pass.

**With recycling.** I applied the cavity model ([E1], [E3]) to the real CAD areas:

| Surface | Area | Assumed reflectance |
|---|---|---|
| Diffuser aperture | 10,530 mm² | T 0.70, R 0.25 |
| Walls, chamfer, lip, bosses | 9,186 mm² | as varied below |
| Board front, net | ≈ 8,700 mm² | as varied below |
| LED packages | 588 mm² | 0.5 |
| Camera board | 600 mm² | 0.1 |
| Edge gap | 776 mm² | 0 (open) |
| Board windows and notches | 207 mm² | 0 (open) |
| Camera annulus | 47 mm² | 0 (open) |

75% of LED light reaches the diffuser first (0.72–0.78 gives ± 2 points).

| Case | Light out | To the back cavity | Diffuse light out of the camera ring |
|---|---|---|---|
| Now: dark walls (0.06), board ≈ 0.5 | **≈ 59%** | 0.9% | 0.04% |
| Seal board openings only | 59% | 0 | 0.04% |
| White solder mask (0.88) | 60% | 1.0% | 0.05% |
| + white PLA walls (0.70) | **≈ 72%** | 2.6% | 0.13% |
| + walls lined to 0.95 (white PC / MCPET class), openings sealed | **≈ 83%** | 0 | 0.19% |

These are estimates from a well-mixed-cavity model in a shallow cavity (17.9 mm deep, ≈ 130 mm wide), so they are rough. The reflectances of the board, PLA and diffuser are assumed, not measured.

**What follows from them**
1. **The walls are the main loss.** White walls are worth ≈ 13 points of output, about +22% more light for the same power. That is the biggest single improvement on the table, and it lets the LEDs run cooler for the same light.
2. **The board's whiteness matters little while the walls stay dark** (+1 point), because little light gets a second bounce. It is worth more once the walls are white.
3. **The board openings matter little now**, about 1%. Once the cavity is white they lose more (≈ 2.6%), and the 776 mm² edge gap is ≈ 70% of that open area. Close it with a white lip or gasket when the walls change.
4. **White PLA is a partial fix.** It reaches only 65–75% and lets light through [E9], so it needs thick walls or a backing. A white PC or MCPET liner gets most of the gain.
5. **Watch the edges.** Specular film (ESR) on the walls tends to make a bright band at the edge [E6]; diffuse liners don't.
6. **Edge glow** (my reasoning, no source):
   - The diffuser's 1 mm edge face is exposed all round in a 1 mm groove.
   - Light that enters near the rim is trapped and spread sideways inside the sheet, then leaks out of that edge.
   - The current 1.0 mm ledge is short. A frame lip overlapping the diffuser by ≥ 2–3 mm, or a dark edge face, would cut it.
   - White walls will add light near the rim and so make edge glow worse.

**Recommendation.** Line the front-cavity walls with a diffuse white liner and use a white solder mask. Close the board edge gap at the same time. Check edge glow before and after.

## 2. Stray light into the camera

### What the sources say

**Wueller, image flare to ISO 18844 [C1]** (full text)
- Lists flare sources. Two match this head: light reflecting off the lens barrel, camera body and nearby lit surfaces, and leakage from an LED near the camera that isn't fully shielded from the sensor.
- Method C works for cameras without exposure control. Flare = Y<sub>black</sub> / Y<sub>white</sub> × 100%, from one image of a white field with black light traps, on linearised values.
- Practical points:
  - Subtract a dark frame taken at the same exposure.
  - A fingerprint on the lens can raise flare ≈ 10×.
- **IEC 62676-5** puts a diffusely lit white plate with a central hole in front of the camera and compares plate on and plate off. That is essentially this lamp face.

**Standards [C2, C3]** (abstract; secondary)
- ISO 18844 defines the test but sets no pass/fail limits.
- It does not cover light sources *outside* the field of view, which is this head's main problem. ISO 9358 covers lens veiling glare.

**Talvala et al. [C4]** (full text)
- Veiling glare comes from scattering in the lens elements, reflections off the barrel and lens surfaces, and reflection from the sensor.
- Glare from outside the field of view can usually be avoided with a lens hood.
- Masking parts of the scene separates direct light from glare, which is the basis of the bench test below.

**Black coatings**
- **Marshall et al. [C5]** (full text): black-dyed anodising becomes reflective above ≈ 700 nm, and bead-blasting before anodising gives the lowest reflectance. Black marker and black paper are poor. Looking black to the eye doesn't mean a material blocks light well.
- **Plesseria et al. [C6]** (full text):
  - Acktar Magic Black reflects < 2% at 400–1100 nm.
  - Edges of baffles that the optics can see are a major stray-light source, so keep edges thin.
  - In their simulation, Acktar beat a black paint only slightly.

**Small lenses, Lin [C7]** (abstract): in a phone lens, baffle and aperture changes cut stray light from 0.083% to 0.019%. Reshaping the lens rim outside the clear aperture cut it to 0.003%.

**Flash-to-camera leakage** (patents and app notes)
- **[C8]:** flash light piped inside a shared cover window reaches the sensor. Fix: an opaque barrier through the window between the two zones.
- **[C9]:** light leaks through lens side faces, joints and gaps. Fixes: black ink on side faces and edges, opaque adhesive, closed-cell foam gaskets.
- **[C10, C11]:**
  - The main crosstalk path is reflection off the cover's underside.
  - Fix: an opaque matte barrier from the sensor to the cover.
  - A diffuser over the window makes crosstalk worse.
- These are secondary and from phones and proximity sensors, but the mechanism matches.

**Gap.** No source gives how much flare comes from the glowing diffuser beside the lens versus direct leakage through the ring. It has to be measured. No under-display-camera paper measures leakage of the display's own light into the camera either [C12].

### What this means for the Head

From the STEP extraction and the program:
- **Direct path.** The Ø14 barrel sits in a Ø16 diffuser hole, leaving a 1 mm open ring (47 mm²). Direct LED light reaches that ring from 99% of board positions. The program estimates ≈ 0.03–0.1% of LED light (≈ 0.2–0.6 lm) leaves through it undiffused.
- **Barrel sides.** Inside the cavity the barrel sides are lit directly by the LEDs.
- **Diffuser glow at the lens.** The barrel top is flush with the diffuser's outer face, so glowing diffuser, including the lit 1 mm wall of the cut hole, sits right at the edge of the front lens element at grazing angles.
- **White walls make this worse.** §1's model shows the diffuse light reaching the ring rises from ≈ 0.04% to ≈ 0.19%. Fix the camera before or together with whitening the walls.

**Countermeasures, in order**
1. **Close the ring.** Use a black closed-cell foam or elastomer ring between the hole edge and the barrel [C9]. Better: a **black sleeve from the board to the diffuser's inner face** around the barrel [C10, C11]. The LEDs then see neither the ring nor the barrel sides.
2. **Blacken the diffuser's hole edge** [C9]. Consider a black printed ring a few mm wide on the diffuser's outer face around the hole.
3. **Add a short black hood** (1–2 mm proud), or recess the lens slightly, to block the grazing view of the lit diffuser [C4]. Keep its inner edge thin [C6, C7].
4. **Coatings.** Bead-blasted black anodise, flock, or matte black for the sleeve and hood; Acktar is optional [C5, C6]. If the camera is a NoIR IMX219 (no IR-cut filter), don't rely on dyed anodise, which reflects above 700 nm [C5].

**Bench test** (adapted from [C1] and IEC 62676-5)
1. Photograph a white chart with black light traps at fixed exposure, with the lamp LEDs **off**, then **on**. Subtract a dark frame and clean the lens first.
2. Flare from the lamp = F(on) − F(off).
3. Find where it comes from, one change at a time: tape the ring, then mask the diffuser around the hole, then add a hood.
4. A chart with > 3000:1 white-to-black contrast resolves ≈ 0.03% [C1].

## 3. Glare from the face

### What the sources say

**Non-uniform LED sources**
- **Tashiro et al. [G1]** (full text, checked):
  - *Setup:*
    - Four experiments with 5000 K LED sources at ≈ 3 m, 8.5° above the line of sight, simulating a pedestrian under a street light.
    - Backgrounds of 0 (dark), 0.1, 1 and 10 cd/m²; ratings on a 1–9 scale (Matsuda), 11–19 observers per experiment, mostly in their twenties.
    - Stimuli:
      - raw LEDs, LEDs with lens caps, and LEDs under frosted glass (Exp. 1);
      - different LED spacing (Exp. 2) and density (Exp. 3);
      - a microlens diffuser at 0°, 20° and 60° diffusion angle (Exp. 4).
    - Sources spanned 0.4°–5.0°.
  - *Findings:*
    - At the same illuminance at the eye, non-uniform sources were rated more glaring than uniform ones.
    - More diffusion lowered glare at the same eye illuminance: 0° vs 20° and 0° vs 60° were both significant (Exp. 4).
    - Changing the LED density within a fixed area (2 × 2, 3 × 3, 5 × 5) did not change glare (Exp. 3).
    - Nor did changing the luminaire size from ≈ 0.4° to 5° with a fixed element count.
  - *Two luminance measures (§6.2, from HDR images):*
    - The *average luminance of the effective area* is the sum of pixel luminances divided by the effective area, i.e. the non-zero pixels. That is the definition the abstract gives.
    - The *effective glare luminance* weights each pixel first: Σ(L × WF(L)) / effective area, with WF = 4.0 × 10⁻⁵ × L<sup>0.811</sup> (eq. 7). Bright pixels count more.
    - Only the weighted version brought uniform and non-uniform sources onto one curve. R² was 0.917–0.938 against glare rating, depending on background.
  - *Modified UGR (eq. 11):* mUGR1 = 0.60 × log(L<sub>eff</sub>²ω / (L<sub>B</sub>P²)) + 5.41, R² = 0.887 against ratings. [G2]'s r = 0.942 for the same model is √0.887.
  - *Limit the authors state:* predictions hold for small sources (< 5° × 5°). Whether they apply to several luminaires at once is untested.
- **Yang, Luo & Ma [G2]** (full text, checked):
  - *Setup:*
    - 15 luminaires on a 16 × 16 cm panel at 2.5 m, seen 10° or 20° above the line of sight (0.004 / 0.0036 sr).
    - Four types: raw, holed, diffused and patterned LED matrices.
    - Dark and bright backgrounds (L<sub>b</sub> 1.6 and 14.3 cd/m²).
    - 20 observers aged 18–35 per group, 5,040 ratings on a 7-point scale.
    - Average luminance of the diffused panels was 126–3,037 cd/m².
  - *Findings:*
    - Ratings were higher with the dark background and at the smaller angle.
    - Raw and patterned matrices caused more glare than holed and diffused ones.
    - There was **no significant difference among the three diffused panels**, nor among the holed ones.
    - Standard UGR correlated poorly across all luminaires (r = 0.640). The Tashiro modification (0.937) and the authors' contrast-intercept models (0.944–0.949) did much better, and the two modified models didn't differ significantly.
  - *Measurement lesson:* their luminance camera wasn't linear across ND filters. They imaged at the lowest level and scaled by illuminance-meter ratios.
- **CIE 232:2019 [G3]** (abstract) and **Thorns [G4]** (secondary):
  - Correct UGR with a uniformity factor k: R'<sub>UG</sub> = UGR + 8·log(k²).
  - k = 1–3 adds ≈ 0 to +7.6 UGR points.
  - UGR applies to sources of 0.0003–0.1 sr.
- **Geerdinck et al. [G7]** (secondary): for spotty LED patterns, UGR didn't correlate with perceived glare at all (R² = 0.04). For smooth centre-to-rim gradients it worked reasonably (R² = 0.74).
- **Kasahara et al. [G8]** (abstract):
  - Discomfort falls as the luminance between LEDs approaches the LED luminance; filling in hotspots helps.
  - A larger lit area lowers the tolerable luminance, but less than in proportion.
- **Bullough & Sweater Hickcox [G13]** (abstract): once a source spans ≈ 0.3° or more, its luminance, not just the light reaching the eye, drives discomfort.

**How to measure**
- **Abboushi & Miller [G5]** (full text):
  - Use an imaging luminance meter.
  - L<sub>eff</sub> is the average of pixels above 500 cd/m², over their solid angle ω<sub>eff</sub>.
  - Report L<sub>max</sub> for non-uniform sources.
  - Don't use max:min uniformity, which depends on resolution.
  - With a spot meter, the average is valid only when the source just fills the measuring circle.
- **Abboushi et al. [G6]** (full text): perceived uniformity is predicted well by the coefficient of variation (R² 0.91), which they recommend for simplicity.

**Limits**
- **GB/T 9473-2017**, Chinese reading-desk-lamp standard [G9] (secondary, quoted by a regulator's notice):
  - Viewed from 400 mm above the desk and 600 mm from the lamp, every luminous part must be **≤ 2,000 cd/m²**.
  - A 2022 edition exists and hasn't been checked.
- **EN 12464-1** [G10] (secondary):
  - Shielding angles scale with lamp luminance.
  - Luminaires that could reflect in a screen are limited to 1,500 / 3,000 cd/m².
  - It assumes ceiling luminaires, not a face aimed at the user, so it fits poorly.
- **Kent, Fotios & Cheung [G11]** (abstract): glare judgements around 5–10 kcd/m² shift by a whole category depending on the range shown. Thresholds in this region are real but soft.

### What this means for the Head

**Face luminance** (Lambertian diffuser, 0.0107 m² net): L = Φ / (πA)

| Light out through the face | Mean luminance |
|---|---|
| 300 lm | ≈ 8,900 cd/m² |
| 373–405 lm (program, 4 W) | ≈ 11,000–12,000 cd/m² |
| ≈ 67 lm | ≈ 2,000 cd/m² |

**Hotspots.** A peak-to-mean of 2–3 puts local peaks at ≈ 25–35 kcd/m².
- [G3, G7] say strongly spotty sources add glare beyond what the mean suggests.
- In [G2], raw and patterned matrices were worse, but the three diffused panels did not differ from one another.
- So once the face is properly diffused, its **mean luminance and where it sits in the view** are likely to matter more than small uniformity gains. This is an inference from viewing conditions unlike this head's.

**At the eye.** The face's intensity is ≈ 125 cd at 400 lm, giving ≈ 500 lx on-axis at 0.5 m. It spans ≈ 0.04 sr at 0.5 m, so it is well inside the size range where luminance governs.

**Two situations**
1. **The head looks at the person** (conversation, video call). The face is in the line of sight against a dim background, the worst case [G2]. To meet 2,000 cd/m², the face has to drop to **≤ ≈ 65–70 lm** while facing someone.
2. **Task mode** (face aimed at the desk). The desk needs ≈ 400 lm through the face for 500 lx, so the face can't be dimmed. The diffuser is Lambertian, so its luminance is the same from every angle. Meeting 2,000 cd/m² at 400 lm would need a lit area ≈ 6× larger, which isn't possible. The only way to pass is **geometry**: the face must not be visible from the seated user's eye position (e.g. GB/T's 400 mm / 600 mm point). That means a cut-off from the head angle or the shell lip, or a shallow louver or hood.

**Mitigation, in order**
1. **Dim when facing a person.** The camera already knows when the head is looking at someone. Cap the face at ≈ 2,000–3,000 cd/m² (≈ 65–100 lm) in that pose.
2. **Keep the face fully diffused, with no visible LED dots.** Visible dots move the face towards the "raw matrix" case, which is the most glaring in [G2]. In [G1] Exp. 4, more diffusion lowered glare significantly at the same eye illuminance. Beyond that, lowering CV helps perceived uniformity [G6]. Its glare benefit among already-diffused faces wasn't significant in [G2], so rank it below dimming. White walls (§1) also lift the dark edges.
3. **Cut-off in task mode.** Check whether the seated eye can see the face at the working head angle. If it can, add a shallow hood or louver, or limit the pitch.
4. **Rear light (see `REAR_LIGHT_NOTES.md`).** While the face is dimmed in conversation, the rear wall light keeps some light in the room. This is untested, but it fits the evening-comfort role already planned for option A.

**Bench test** [G5, G6]
1. In a dark room, use a luminance camera, or a phone camera in multi-exposure HDR with no clipped pixels.
2. Image the face from 0.5 m and 1 m, on-axis and at 15°, 30° and 45°.
3. Report L<sub>avg</sub>, L<sub>max</sub>, CV, L<sub>eff</sub> (pixels > 500 cd/m²) and the background luminance.
4. With only a spot meter: measure L<sub>avg</sub> with the circle just filled, then L<sub>max</sub> by scanning. Expect poor repeatability.
5. Also measure from the GB/T 400 mm / 600 mm position in task pose.

## 4. How the fixes interact

| Change | Escape | Camera | Glare |
|---|---|---|---|
| White walls / board | Better (+13–24 points out) | **Worse** (more diffuse light at the ring), so seal the camera first | Better uniformity at the edges; the face is brighter at the same power, so dim to compensate |
| Close the board edge gap | Small gain (more once white) | Neutral | Neutral |
| Camera sleeve, black hole edge, hood | Slightly less light out (the sleeve shades a little diffuser) | **Better** | Neutral |
| Dim when facing a person | — | Better (less light overall) | **Better** |
| Lower peak-to-mean (layout, diffusion) | Small loss with more diffusion | Neutral | **Better** |

**Suggested order**
1. Camera sleeve and seal.
2. White walls and white mask, with the edge gap closed.
3. Dimming rule for when the head faces a person.
4. Check the task-mode cut-off.

Each step has a bench test above.

**Fits the trial's variation format.**
- **Baseline:** today's dark walls.
- **Variation A:** white-lined walls (diffuse white PC or MCPET strips) on the same LED section.
  - Measure output on the 3 × 3 lux grid, the diffuser's CV from a photo, and temperature.
  - Prediction: more light, a brighter rim, more edge glow.
- **Camera seal:** can be checked with a dummy barrel and a phone camera through a Ø16 hole.
- **Note (16 Oct review):** `BENCH_TEST_BRIEF.md` currently defines Variation A as **aluminium foil** on the side walls. Foil is specular, so by [E6] expect a brighter band at the rim rather than the even lift a diffuse white liner gives. Decide which A is built, and keep this section and the brief consistent.

## 5. What still needs measuring or sourcing

**Measure**
- Reflectance of the board (mask colour), the PLA walls and the diffuser (T and R). These replace the assumed values in §1.
- Where the camera flare comes from (§2 bench test).
- The face's luminance map, and whether the seated eye can see the face in task pose (§3).

**Get the full texts**
- [G3] CIE 232:2019.
- [G9] GB/T 9473 (2017 and 2022).
- The EN 12464-1 tables [G10].
- [C2] ISO 18844.

## 6. Filling the dark camera corner with secondary light (16 Oct)

The face's darkest region is the diffuser over the blocked DXF corner (x ≥ 19.0, y ≤ 19.22 mm). Its far end is ≈ 42 mm from any allowed LED position, so whole-face min/avg stays at ≈ 1–5% whatever the main layout. White walls (§1) lift the rim but not this corner much: well-mixed light spreads over the whole cavity. A source *in or next to the corner* can.

**Re-check against the DXF.** `WT - Lewis.dxf` has no single keepout outline in the corner. It draws the camera board's four mounting holes, two lens-side circles, and eight part outlines (rectangles, e.g. x 19–29 × y −29.9…10.1, x 56–66 × y −19.9…10.1, x 30–50 × y −32.9…−22.9). The keepout zone is their outer envelope: its left and top edges are those outlines' x = 19.0 and y = 19.22. The program now draws these outlines inside the zone. Their heights aren't in the DXF, so any raised mount must be checked against the prototype.

**The program option (step 3 → Secondary light).** Each type has its own flux, beam (FWHM → cos<sup>m</sup>), power and distance, entered from the part's datasheet; none is assumed to be a main LED. The camera barrel shades them like the main LEDs; their power is added as board heat. Not modelled: shading by the corner parts or the mount, wall bounces, and flux droop.
- **Raised top-emitters:** LEDs on a mount inside the corner, a set distance below the diffuser.
- **Side-emitters:** on the board just outside the corner, aimed into it.
- **Light guide:** an edge-lit plate over the corner; its top face is taken as a uniform Lambertian emitter of efficiency × input. That is the best case; a real guide needs a dot pattern to get close to it.

**What it predicts** (`checks/aux-corner.js`; CAD geometry, 60 LEDs at 25 mA, desk limit on, whole-face scoring; the source values are examples):

| Secondary light | Out through the face | Whole-face evenness, hex → optimized | CV, optimized |
|---|---|---|---|
| None | 0 lm | 1% → 1% | 34.5% |
| Raised, 4 × 15 lm, 12 mm below the diffuser | 31 lm | 14% → 19% | 18.9% |
| Raised, 4 × 30 lm, 12 mm below | 61 lm | 23% → 29% | 13.1% |
| Raised, 4 × 30 lm, 6 mm below | 74 lm | 13% → 16% | 39.7% (hot spots) |
| Side-emitters at the edge, 6 × 20 lm, tilted 30° | 40 lm | 2% → 3% | 22.8% |
| Light guide, 4 × 30 lm in, efficiency 0.5, 3 mm below | 38 lm | 22% → 24% | 14.7% |
| Light guide, 4 × 60 lm in, efficiency 0.5, 3 mm below | 77 lm | 40% → 45% | 13.6% |
| Light pipes fed from behind, 4 × 30 lm LEDs, efficiency 0.5, exit 12 mm below | 31 lm | 14% → 19% | 18.9% |
| Light pipes fed from behind, 4 × 60 lm LEDs, efficiency 0.5, exit 12 mm below | 61 lm | 23% → 29% | 13.1% |

**What follows**
1. **A light guide is the best fit** for an evenly lit corner: it spreads light over the whole dark area. ≈ 40–80 lm out of the face (120–240 lm of LEDs into the guide at efficiency 0.5, ≈ 0.6–1.6 W of mid-power LEDs at 150–206 lm/W) takes whole-face evenness from ≈ 1% to ≈ 25–45%. At that power the extra board heat is ≈ 4–12 K (≈ 9 K per W of heat, from the sweep), not the ≈ 3 °C the sweep shows (the sweep charges every row 0.1 W per source).
2. **Raised point sources work if they sit far enough back** (≈ 12 mm below the diffuser here). Too close (6 mm) gives hot spots: d/h is too large for 4 sources over ≈ 2,100 mm².
3. **Light pipes from behind the board act like raised sources at the pipe exits**, with the pipe's efficiency as a loss (same results as the raised rows at the same output). They keep the LEDs and wiring out of the front cavity but need holes through the board in the corner, and their heat still enters the metal-core board.
4. **Side-emitters at the keepout edge barely help.** At ≈ 1 mm height about half their beam goes into the board, the rest reaches the diffuser at grazing angles, and the barrel shades the far corner.
5. **None of them reaches 65% whole-face evenness** at these powers. The cells right beside the camera hole stay darkest (the barrel shades them).
6. **Interactions:** the extra light also raises desk lux, so the optimizer can spread the main LEDs more. It adds ≈ 3 °C of board heat at 0.4 W. A guide or mount near the barrel puts more light near the lens, so do the camera sleeve (§2) first.
7. **Bench check:** build a guide coupon over a mock corner, photograph the diffuser at fixed exposure with the guide on and off, and compare the corner's luminance with the model.

## Sources

Tags marked **checked** were verified by me against the PDF. All others are as reported by the research sub-agents and have not been re-checked.

**Escape**
- E1. Labsphere, *Integrating Sphere Theory and Applications*, technical guide (2017). <https://www.labsphere.com/wp-content/uploads/2021/09/Integrating-Sphere-Theory-and-Applications.pdf> [full text; vendor]
- E2. Sun, C.-C., Chien, W.-T., Moreno, I., Hsieh, C.-T., Lin, M.-C., Hsiao, S.-L. & Lee, X.-H. (2010). Calculating model of light transmission efficiency of diffusers attached to a lighting cavity. *Optics Express* 18(6), 6137–6148. doi:10.1364/OE.18.006137 **[full text, checked]** `context/papers/sun et al.pdf`
- E3. Nevitt, T. J., Weber, M. F., Freier, D. G., Wheatley, J. A., Ouderkirk, A. J. et al. (3M). Thin hollow backlights with beneficial design characteristics. US 8,926,159 B2. <https://patents.google.com/patent/US8926159B2> [secondary]
- E4. Peels, W. et al. (2013). Assessment of low cost, sustainable, reflective layers for optical mixing. *Key Engineering Materials* 572, 62–65. doi:10.4028/www.scientific.net/KEM.572.62 [abstract]
- E5. LED lighting system with reflective board, US 7,201,497. [secondary; snippet only]
- E6. 3M, Enhanced Specular Reflector (ESR) films, technical data (2021). <https://multimedia.3m.com/mws/media/2111087O> [secondary]
- E7. Gombos, Á. (Furukawa Electric), MCPET talk, X. LED Konferencia, Budapest (2019). [secondary]
- E8. Covestro, *Optical properties of Makrolon and Apec* (2017). [secondary]
- E9. PROSPECT Collaboration (2019). A low mass optical grid for the PROSPECT reactor antineutrino detector. arXiv:1902.06430 / *JINST*. [full text]
- E10. Ye, Z. T., Cheng, Y. H., Liu, K. H. & Yang, K. S. (2021). Mini-LEDs with diffuse reflection cavity arrays… *Nanomaterials* 11(9), 2395. doi:10.3390/nano11092395 [full text]

**Camera**
- C1. Wueller, D. (2016). Image flare measurement according to ISO 18844. IS&T Electronic Imaging, DPMI-005. doi:10.2352/ISSN.2470-1173.2016.18.DPMI-005 [full text]
- C2. ISO 18844:2017, Photography — Digital cameras — Image flare measurement. <https://www.iso.org/standard/63552.html> [abstract]
- C3. Image Engineering, Image quality factors: flare. <https://image-engineering.de/en/resources/image-quality-factors/flare> [secondary]
- C4. Talvala, E.-V., Adams, A., Horowitz, M. & Levoy, M. (2007). Veiling glare in high dynamic range imaging. *ACM Trans. Graphics* 26(3). <https://graphics.stanford.edu/papers/glare_removal/glare_removal.pdf> [full text]
- C5. Marshall, J. L. et al. (2014). Characterization of the reflectivity of various black materials. Proc. SPIE; arXiv:1407.8265 [full text]
- C6. Plesseria, J.-Y. et al. (2018). Utilisation of Acktar Black coatings in space applications. ISME 2018. <https://orbi.uliege.be/bitstream/2268/229987> [full text]
- C7. Lin, Y.-J. (2008). Study on stray light suppressing in cell phone lens. MSc thesis, National Formosa University. [abstract]
- C8. Meierling, K.-D. (BlackBerry). Barrier for a lens. US 9,823,468 B2 (2017). [secondary]
- C9. Ranjeva, M. L. et al. (Otter Products). Camera and flash lens for protective case. US 2019/0288726 A1 / US 10,547,342 B2. [secondary]
- C10. Vishay, Designing the VCNL4035X01 into an application, App. Note 84417 (2019). <https://www.vishay.com/docs/84417/designingvcnl4035x01.pdf> [secondary]
- C11. ams AN000709 and TAOS/ams AN000523, proximity/ALS through cover glass. [secondary; snippets only]
- C12. Wang, Q. et al. (2023). Modeling light propagation in a smartphone's under-display sensors. SID Digest, paper 88-2. [full text]

**Glare**
- G1. Tashiro, T., Kawanobe, S., Kimura-Minoda, T., Kohko, S., Ishikawa, T. & Ayama, M. Discomfort glare for white LED light sources with different spatial arrangements. *Lighting Res. Technol.* (online first 24 Apr 2014; print 47, 316–337, 2015). doi:10.1177/1477153514532122 **[full text, checked]** `context/papers/tashiro et al.pdf`. The checked file is the online-first version; the print page range is from the agent's report.
- G2. Yang, Y., Luo, M. R. & Ma, S. N. Assessing glare. Part 2: Modifying Unified Glare Rating for uniform and non-uniform LED luminaires. *Lighting Res. Technol.* (online 2016; print 49(6), 727–742, 2017). doi:10.1177/1477153516642622 **[full text, checked]** `context/papers/yang et al.pdf`
- G3. CIE 232:2019, Discomfort caused by glare from luminaires with a non-uniform source luminance. doi:10.25039/TR.232.2019 [abstract]
- G4. Thorns, P. (2020). Discomfort caused by glare from luminaires with a non-uniform source luminance. *LED professional*. [secondary]
- G5. Abboushi, B. & Miller, N. (2022). What to measure and report in studies of discomfort from glare for pedestrian applications. *Lighting Res. Technol.* doi:10.1177/14771535221087133 [full text]
- G6. Abboushi, B., Irvin, L., Rodriguez-Feo Bermudez, E. & Royer, M. (2023). Evaluating luminance uniformity metrics using online experiments. *LEUKOS* 19(3), 308–323. doi:10.1080/15502724.2022.2133964 [full text]
- G7. Geerdinck, L. M., Van Gheluwe, J. R. & Vissenberg, M. C. J. M. (2014). Discomfort glare perception of non-uniform light sources in an office setting, summarised in *LED professional*. [secondary]
- G8. Kasahara, T., Aizawa, D., Irikura, T. et al. (2006). Discomfort glare caused by white LED light sources. *J. Light & Visual Environment* 30(2), 95–103. doi:10.2150/jlve.30.95 [abstract]
- G9. GB/T 9473-2017, Reading and writing desk lamp performance requirements, as quoted by Shanghai Market Supervision (2022). [secondary]
- G10. TRILUX, shielding angle and EN 12464-1 guidance pages. [secondary]
- G11. Kent, M. G., Fotios, S. & Cheung, T. (2019). Stimulus range bias leads to different settings when using luminance adjustment to evaluate discomfort due to glare. *Building and Environment* 153, 281–287. doi:10.1016/j.buildenv.2018.12.061 [abstract]
- G12. CIE 244:2021, Characterization of imaging luminance measurement devices (ILMDs). doi:10.25039/TR.244.2021 [abstract]
- G13. Bullough, J. D. & Sweater Hickcox, K. (2012). SAE 2012-01-0269. [abstract]
