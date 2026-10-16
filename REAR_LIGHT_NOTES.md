# Second light source at the centre back of the Head

*Lewis Zhang · 15 Oct 2026 · Geometry comes from `context/step_extract` (the STEP, which matches the DXF to within 0.05 mm). Light and heat figures are hand estimates, not model or bench results.*

**Decision (15 Oct 2026).** A white rear light at the centre of the back dome that does two jobs:
- **A:** light the wall behind the lamp (bias light).
- **C:** show status through dimming patterns.

It is built as **H1**, a separate sealed module. The drive route is still open (§7).

**A is conditional on the bench test (§8, step 4).** The corrected estimate puts its contribution at the low edge of the comfortable band (§1), so the bench measurement decides whether A stays. If it fails, the rear light becomes status-only (C).

**How to read this.** Each section starts with what the sources found and what that means for the Head, then gives the rear-light choice. The source summaries are paraphrased, not quoted. Every source carries a tag:

| Tag | Meaning |
|---|---|
| **[full text]** | Checked against the paper in `context/papers` |
| **[abstract]** | Checked against the abstract or a publisher listing only |
| **[secondary]** | Not peer-reviewed, or known only through another document |

No paper studies a rear light on a robot lamp, so all the evidence is borrowed from room lighting, display viewing and mobile robots.

### Corrections after checking the full texts (15 Oct), and a second review (16 Oct)

1. **[6] was compared wrongly.** The earlier version set our 38 cd/m² wall estimate against Zhou et al.'s 21–75 cd/m² range. That range is for **screen** luminance. Their other range, 13–62 lx, is **illuminance at the eye**. Redone in §1, the wall light adds only ≈ 9–17 lx at the eye, at or just below the low end of that band. That makes A a weaker case than the earlier version said.
2. **[5] was overstated.** Higher ambient illuminance improved *arousal and performance* measures: fewer regressive saccades and faster reaction times. It did **not** reduce visual fatigue, and subjective fatigue was unaffected by either ambient or screen light.
3. **[10] is the 2015 conference chapter, not the 2018 journal paper.** The chapter tests which animations people *prefer*, using a video survey. The earlier claim that lights helped people "infer the robot's state from afar" belongs to a different paper that hasn't been checked, so it is removed.
4. **The Moreno fall-off.** On a flat target the irradiance from a cos<sup>m</sup> LED falls as cos<sup>m+3</sup>θ (intensity cos<sup>m</sup> × the incidence cosine × the r² growth). Moreno's eq. 3 is written z<sup>m</sup>/(ρ² + z²)<sup>(m+2)/2</sup> because his m there already counts the incidence cosine, so a Lambertian LED is m = 2 in eq. 3 (the program's `MODEL_NOTES.md` uses the same reading). The window figure is cos⁴(7.8°) ≈ **96%**. *(16 Oct review: an earlier correction had changed this to cos³ and 97%; that was wrong.)*
5. **[1] adds a useful benchmark.** Its photometric table gives the luminance of real office walls behind the workstation, which §1 now uses.
6. **Head pose (16 Oct).** The rear window faces along −z, opposite the face. With the face aimed at the desk, the rear light points at the **ceiling** (the §2 geometry, ≈ 6 lx), not at the wall. It washes the wall behind the lamp only when the head looks roughly horizontally, e.g. at the user. So A and B are the same hardware in different poses, and A applies only in those poses.
7. **Heat (16 Oct).** The program's heat map puts the Head Back's inner surface at ≈ 34–38 °C in still air with the face on (60 LEDs at 25–55 mA plus 4.6 W of electronics). A 0.5 W module adds ≈ 22–25 K at its base, giving ≈ 56–63 °C, which is over the ≈ 55 °C PLA limit. §4 now caps it at ≈ 0.25 W while the face is on; 0.5 W only while the face is dim or off.
8. **Efficacy (16 Oct).** 150 lm/W was a placeholder. The F-class Pro9 datasheet gives 36.2 lm at 65 mA and 2.70 V for 3000 K, i.e. ≈ 206 lm/W at T<sub>j</sub> 25 °C (higher at low current). The board's J-class part still needs its own datasheet (the brief warns not to mix classes), so §1 now carries 150–206 lm/W as a range.

---

## 1. Wall / bias light (option A)

### What the sources say

**Benedetto, Carbone, Drai-Zerbib, Pedrotti & Baccino [5] [full text]**
- *Design:* 48 adults read a novel on an LCD for one hour, in a 2 × 2 between-subjects design.
  - Screen: 20 or 140 cd/m².
  - Ambient: 5 or 85 lx at the eye, measured with the screen off, from 4000 K ceiling fluorescents.
- *Findings:*
  - The high screen luminance cut the blink rate, which the authors read as visual fatigue.
  - Low ambient illuminance gave more regressive saccades and slower reaction times, which they read as lower arousal.
  - Subjective visual fatigue rose over the hour but was **not** affected by either factor.
  - The authors say they cannot explain why some measures respond to the screen and others to the room.
- *For us:* surround light here is linked to **alertness and performance**, not to less eye strain. The ambient light was overhead room light, not a lit wall.

**Zhou, Shi, Chen, Ru & Zhou [6] [full text]**
- *Design:* 33 young participants rated brightness, comfort, satisfaction and fatigue on a 19.5-inch LCD.
  - Screen: six levels, 3.9–107 cd/m².
  - Ambient: five levels, 0–100 lx at eye level, in the evening.
  - Room: windowless, with 90%-reflectance walls and ceiling.
  - The ambient light came from a **desk LED lamp**.
- *Findings:* the best screen luminance rose with ambient illuminance. For comfortable ratings they recommend **13–62 lx at the eye** with **21–75 cd/m² on the screen**.
- *Limits the authors state:*
  - subjective ratings only;
  - ambient levels always run in increasing order;
  - young participants only;
  - results probably not transferable to rooms with other luminance distributions.
- *For us:* in a dim evening room, about 13–62 lx of extra light at the eye is the comfortable band. That comes from one lab room and a desk lamp, not a wall wash.

**Fostervold & Nersveen [1] [full text], Table 3**
- In real offices after the lighting change, the wall behind the workstation measured, as scheme means:
  - **minimum ≈ 21–37 cd/m²;**
  - **maximum ≈ 98–258 cd/m².**
- *For us:* a benchmark for what a lit office wall looks like.

**Weaker supporting sources**
- **Rempel et al. [7] [abstract]:** preferred display settings depend on ambient illumination.
- **Lighting Research Center [8] [secondary]:** surround light behind a TV lowered self-rated eyestrain, but only some measures were significant. No peer-reviewed paper was found.
- **IES RP-1 [9] [secondary]:** task-to-surround luminance within about 3:1, as cited in a patent. Not yet checked in the standard itself.

### What this means for the rear light

The full-text evidence supports giving a **dim evening room some light around the user**. Comfort is rated better at about 13–62 lx at the eye [6], and alertness is higher with more ambient light [5]. Neither paper shows that a lit wall reduces eye strain, and the claim that does say so is the weakest source [8]. So the bias light is a **comfort and ambience feature, not a health claim**.

Estimate at 0.5 W (only allowed while the face is dim or off, §4), head looking roughly horizontally so the module faces the wall (correction 6):

| Step | Assumption | Result |
|---|---|---|
| Light out | Mid-power 2835 at ≈ 150–206 lm/W (correction 8), ≈ 30% window loss | ≈ 50–72 lm |
| Wall | Wall 0.3 m behind the lamp, patch ≈ 0.3 m², reflectance 0.7 | ≈ 170–240 lx; luminance ≈ **38–54 cd/m²** |
| At the user's eye | User facing the lamp, distance d from eye to wall. For a small diffuse patch, E<sub>eye</sub> ≈ L·A/d² = ρΦ/(πd²), whatever the patch size. Assumes all the light lands on the wall, so it is optimistic | User 0.8 m from the lamp (d = 1.1 m): **≈ 9–13 lx**. User 0.5 m from the lamp (d = 0.8 m): **≈ 17–25 lx** |

- **Against [6]:** the wall light alone gives about 9–25 lx at the eye. That is at or **just below** the low end of the 13–62 lx comfortable band at 0.8 m, and inside it at 0.5 m. The lamp's own face and any room light add to it. Use [6] with its own caveats: a desk lamp, one lab room.
- **Against [1]:** 38 cd/m² is about as bright as the *darkest* parts of a lit office wall. It matters in a dim or dark room and is negligible in a lit office.
- **Power:** reaching 13 lx at d = 1.1 m needs ≈ 70 lm, i.e. ≈ 0.48–0.67 W depending on efficacy. With the face on, the ≈ 0.25 W cap in §4 gives only ≈ 5–7 lx at d = 1.1 m. So A works, if at all, as a **face-dim / evening** light.

**Choice: keep A** as an evening / low-light comfort light, accepting that at ≤ 0.5 W it is a modest contribution. Measure the eye-level lux on the bench rather than trusting these estimates.

## 2. Ceiling uplight (option B)

### What the sources say

**Fostervold & Nersveen [1] [full text]**
- *Design:* 64 office workers aged 29–62, in private offices near Oslo; 13 dropped out. Data were collected in winter to keep out daylight.
  - Four ceiling schemes, assigned between subjects: 100%, 70%, 30% and 0% indirect light.
  - Every office kept an identical desk lamp.
  - Glare was physically removed.
  - Measured three times (4 × 3 mixed design).
- *Findings:*
  - The proportions changed the luminous environment, e.g. wall and ceiling luminance.
  - Apart from less severe job stress with direct lighting, the proportion of indirect light did **not** affect symptoms, well-being or cognitive performance.
  - The new installation itself improved symptoms and cognitive performance.

**Earlier work cited in [1] points both ways**
- Lab studies and two 1980s field studies favoured indirect lighting.
- One field study found an indirect furniture-integrated system *less* preferred.
- Another found more visual fatigue with mixed lighting.

**Abstract-level sources**
- **Hedge, Sims & Becker [2] [abstract]:** office workers rated lensed-indirect lighting higher, with fewer screen-glare complaints, and about two-thirds preferred it.
- **Cuttle [4] [abstract]:** how bright a room looks follows the light leaving its walls and ceiling (mean room surface exitance), not the light on the desk.
- **Duff, Kelly & Cuttle [3] [abstract]:** in a small-office study, perceived adequacy and spatial brightness tracked room surface exitance but not desk illuminance.

### What this means for the rear light

The best-controlled study here [1] found **no health or performance benefit from more indirect light**. The case for an uplight would rest on room appearance [3, 4], and that needs a meaningful share of the ceiling lit. With the face pointing at the desk, ≈ 50 lm spread over ≈ 9 m² of ceiling 1 m above the head is about **6 lx**. That is a faint glow that doesn't change how bright the room looks. Room ambient levels would need several watts, which the PLA shell can't shed (§4).

**Choice: drop B.**

## 3. Status / expression light (option C)

### What the sources say

**Baraka, Paiva & Veloso [10] [full text]**
- *Setup:* lights on CoBot, a service robot that moves between floors.
  - Speech is short-lived and only carries a short distance; lights are a persistent display of state.
  - Each animation is built from a small set of intensity shapes: blink, fade in/out, irregular blink, step change and slow ramp.
- *Study:* a **video-based survey** of 38 people, after a pilot with 8 developers. They picked the animation type, speed and colour that best fitted three scenarios.
- *Winners:*

  | Scenario | Animation | Colour | Period |
  |---|---|---|---|
  | Waiting | "Siren" | Light blue | 2 s (most chose the slowest speed) |
  | Blocked | "Push": quick on, slow fade | Red | 1.5 s |
  | Progress | Bottom-up progress bar | — | — |

- *Limits the authors state:*
  - Before applying the results to other robots, check that strip size, placement and diffusion don't change how the lights are read.
  - The study mainly evaluated *informing* people, not changing their behaviour.

**Abstract-level sources**
- **Song & Yamada [11] [abstract]:** on a robot with little expressive appearance, light expressions changed whether people wanted to approach or avoid it; the paper gives four recommended expressions.
- **Hoffman & Breazeal [12] [abstract]:** AUR, a faceless robotic desk lamp, was more efficient and fluent with anticipatory behaviour, and people attributed more human qualities to it.

### What this means for the rear light

The intensity-only shapes in [10] (blink, fade, push, ramp) all work on **one white channel**:
- a slow ≈ 2 s fade for waiting or listening;
- a "push" pulse for attention;
- steady for on.

[10]'s **colour** results need RGB, which is out of scope. Our placement (the back of a head) and diffusion (an opal window) differ from CoBot's, so by [10]'s own caveat the patterns must be tested with people, not assumed. The power is tens of milliwatts.

**Choice: keep C** on the same white hardware as A.

## 4. Heat and power: why a separate module (H1)

### What the sources say

**Hui & Qin [13] [full text]**
- Light output, electrical power and heat are linked in one model.
- Thermal design strongly sets the *peak* light output of an LED system.
- That peak can occur *below* the LEDs' rated power.
- For a given heatsink, the model gives the operating point of maximum light output.

**Qin & Hui [14] [full text]**
- Their eq. 5 gives the power at which light output peaks. It falls as the junction-to-case and heatsink thermal resistances (R<sub>jc</sub>, R<sub>hs</sub>) rise.
- For the same total power, several low-power LEDs beat one high-power LED. Five 1 W LEDs gave 120 lm at 24 lm/W, against 90 lm at 18 lm/W from one 5 W LED, because the heat is spread over more contact area.

**PLA limits [16] [secondary]:** the vendor guide says PLA starts to lose stiffness at about 55–65 °C (glass transition) and creeps under load above about 50–60 °C. Replace this with the datasheet for the filament actually used.

### What this means for the rear light

A module glued to the 3 mm PLA dome has two thermal resistances in series:
- **Through the PLA:** ≈ 8 K/W through a Ø60 effective area.
- **Outer surface to room:** ≈ 36 K/W at h ≈ 10 W/m²K (assumed h).
- **Total: ≈ 45 K/W**, so 0.5 W adds ≈ +22 K at the shell. With Ben's still-air outside coefficient (h ≈ 2 W/m²K convection + ≈ 6 radiation) it is ≈ 50 K/W and ≈ +25 K.
- **Starting point:** the program's heat map puts the Head Back's inner surface at ≈ 34–38 °C in still air with the face on (60 LEDs at 25–55 mA plus 4.6 W of electronics; board ≈ 124–160 °C). So 0.5 W would reach ≈ 56–63 °C at the module base, over the ≈ 55 °C PLA limit. At 0.25 W it is ≈ 45–51 °C. With the face dim or off the cavity is near room temperature, and 0.5 W gives ≈ 47–50 °C.

By [13, 14], a heat path this poor puts the best operating point at **low power**, and [14] favours **several LEDs at low current**. So:
- cap the rear light at **≈ 0.25 W while the face is on**, and allow up to ≈ 0.5 W only while the face is dim or off;
- use 2–4 mid-power LEDs on an aluminium spreader;
- make the window and bezel from PC or PMMA, not PLA.

H1 keeps this heat ≈ 90 mm from the main board.

**Choice: H1, ≈ 0.25 W with the face on (≤ 0.5 W with it dim or off), several LEDs at low current.**

## 5. Optics, the window, and the build options rejected

### What the sources say

**Moreno, Avendaño-Alejo & Tzonchev [15] [full text]**
- Each LED is modelled as a cos<sup>m</sup> emitter.
- On a flat target at distance z, the irradiance from one LED is E ∝ z<sup>m</sup> / (ρ² + z²)<sup>(m+2)/2</sup> (eq. 3). In that equation m already counts the incidence cosine, so a Lambertian LED is **m = 2** and its irradiance falls off-axis as cos⁴θ (correction 4).
- Uniformity between neighbouring LEDs depends on spacing over distance (d/h). For two LEDs the maximally flat spacing is d = √(4/(m+3)) · z (eq. 5), which gives **d ≈ 0.89 z** for a Lambertian LED (m = 2).

**STEP extraction** (`context/step_extract/REPORT.md` §5)
- The back cavity joins the front cavity through two ~78 mm² board windows, the 132 mm² camera slot, two notches and a 776 mm² edge gap.
- The camera annulus already passes direct light from 99% of board positions.

### What this means for the rear light

- **Window uniformity is easy.**
  - A cluster 10 mm behind a Ø25 window with LEDs ≈ 10 mm apart is at d/h ≈ 1, just past the 0.89 flat point, so it shows mild hotspots, which a 1–2 mm opal PC diffuser smooths.
  - From the main board (H2, z ≈ 91 mm), one Lambertian LED would light a Ø25 window to within cos⁴(7.8°) ≈ **96%**.
  - So throw distance doesn't decide between H1 and H2; heat and stray light do.
- **Stray light rules out an open source.** A rear LED open to the cavity reaches the camera through the board openings, so the module must be a sealed, light-tight pod.

| Build | Verdict | Reason |
|---|---|---|
| **H1. Separate sealed module at the dome pole** | **Chosen** | Thermally separate from the board (§4) and light-tight by design |
| H2. LEDs on the main board back, shining through the cavity | Rejected | Metal-core PCBs are normally single-sided; it adds heat to the hottest board; it lights the cavity and so the camera |
| H3. Window lit by light leaking from the front array | Rejected | Can't be controlled: it is on only when the face is on, and its brightness follows the face |
| H4. Glow through a translucent shell | Ruled out | The shell is opaque PLA (user answer, 14 Oct) |

## 6. Where it fits

### What the source says

The STEP meshes, ray-cast along −z (`checks/rear-light-space.py`, output in `checks/rear-light-space-output.txt`, visual in `reports/head-space-walkthrough.html`), show:
- The back is a deep dome; its inside surface reaches z ≈ −96 at the pole, about (0, +5).
- The motor cup, mic ring and DM-J3507 motor occupy everything at the back below y ≈ −5. The neck enters from below.

### What this means for the rear light

| Location | Dome there | Verdict |
|---|---|---|
| **Dome pole, about (0, +5)** | 3.0 mm PLA, normal within 10° of the face axis, ≈ 91 mm of clear air in front | **Best spot.** Window Ø20–25 centred at (0, 7) |
| Clear patch x −30…+30, y 0…+15 | Normal < 20°, wall 3.0–3.5, nothing inside. Usable to y ≈ +30 with up to 35° of curvature | Room for the window and bezel |
| At camera height (0, −13) | Motor cup, mic ring, motor | Not possible |
| Directly behind the lens (42.4, −13.3) | z −87, dome tilted ≈ 41° | Possible, but it needs a printed flat boss and it aims off-axis |

**Choice: the dome pole.** It faces straight back along the camera's axis (the opposite way to the camera), about 20 mm above camera height. Where that points depends on the head pose (correction 6).
- **Harness:** ≈ 95 mm, clear of the four back bosses.
- **Sealing:** the window must be sealed like the other joints.

## 7. Drive (still open)

### What the sources say

- **TLC59711 chaining** [17, 18] [secondary]:
  - Devices can be daisy-chained on one SPI bus.
  - The protocol has no address field, so every update shifts out data for every device in the chain.
  - Replace these with the TI datasheet.
- **DESIGN_NOTES §2:**
  - The current TLC59711 has all 12 channels in use (12 strings × 5).
  - VDD_LED is ≈ 13.4 V, while 5 × 2.70 V = 13.5 V, so 5-LED strings have ≈ 0 V of headroom.

### What this means for the rear light

| Option | Description | Trade-off |
|---|---|---|
| D1 | Second TLC59711, daisy-chained | Clean, with 12 spare channels. Needs a schematic change |
| D2 | Constant-current sink on an RV1106 PWM GPIO | Fewest parts; one channel, which is enough for [10]'s intensity-only shapes |
| D3 | Take one of the 12 front strings | No new hardware, but the front drops to 55 LEDs and its layout must be re-optimised |

Whichever route is used, run a **string of 4 LEDs or fewer** (≈ 2.6 V of headroom) at low current. The choice between D1 and D2 needs Zoheb/Rizwan's view on board space.

## 8. Recommendation and next test

Build a **≤ 0.5 W white rear module at the dome pole**:
- sealed and light-tight;
- 2–4 mid-power LEDs at low current on an aluminium spreader;
- behind a Ø20–25 opal PC window, recessed in a short hood aimed at the wall so the window isn't seen directly (§9);
- with a white-lined pod interior;
- on its own drive channel.

Use it as an evening / low-light wall light (A) with intensity-only status patterns (C). It is not a room-ambient uplight (B), and it shouldn't be presented as an eye-strain fix.

Bench test:
1. Put 2–4 spare JB2835 on an aluminium coupon behind a Ø25 opal PC window.
2. Fix it to a 3 mm PLA plate in the existing enclosure.
3. Log the shell touch-point temperature at 0.25 W and 0.5 W for 30 min, using the same logger and probe protocol. Pre-warm the plate to ≈ 35–40 °C first (the predicted Head Back inner temperature with the face on), or run the front array in the same enclosure. Otherwise the test starts ≈ 10–15 K too cool.
4. **Go / no-go for A.** In a dark room, with the module aimed horizontally at a wall 0.3 m behind it (the head-up pose), measure the **illuminance at the user's eye position**: lux meter vertical, at eye height, facing the lamp. Record whether the face is off, dimmed or at task level, because its light at the eye can be far larger than the module's. Report module on minus module off.
   - Take readings at 0.5 m and 0.8 m from the lamp (d = 0.8 and 1.1 m to the wall).
   - **Keep A** if the module adds **≥ 13 lx at 0.8 m** (the low end of [6]) at a power whose 30 min shell temperature from step 3 is within the limit Zoheb/Rizwan set.
   - Otherwise **drop A** and keep the module as status-only (C), which can then run at much lower power.
   - Record the result in this file, either way.
5. Show 3–4 intensity patterns (fade, push, blink, steady) to a few people and ask what each means, following [10]'s caveat that placement and diffusion change how the lights are read.
6. **Window brightness (§9).** Measure the window's luminance at the power chosen in step 4, and check whether the window can be seen directly from a seated eye position behind or beside the lamp.

Questions to confirm:
- **Zoheb/Rizwan:** the acceptable shell temperature, and whether D1 fits on the board or D2 is preferred.
- **Shavir:** whether a rear/status light is in product scope.

## 9. Links to the main-matrix stray-light work (`SCATTERING_NOTES.md`)

The stray-light study of the front LED matrix affects the rear light in four ways. Numbers are from `SCATTERING_NOTES.md`; tags there show which sources were checked.

**1. It strengthens the case for A.**
- The face runs at ≈ 11,000–12,000 cd/m² at today's ≈ 400 lm.
- The only desk-lamp limit found is 2,000 cd/m², from GB/T 9473 [secondary]. Meeting it means dimming the face to ≈ 65–100 lm whenever the head looks at someone.
- While the face is dimmed, the rear wall light can keep some light in the room. That fits A's evening-comfort role (§1).
- This is a hypothesis, not a measured result. A's go/no-go in §8 is unchanged.

**2. The rear window is itself a bright small source.**
- Luminance is L = Φ / (πA). For ≈ 50–72 lm through a Ø25 window (4.9 × 10⁻⁴ m²), that is **≈ 32,000–47,000 cd/m²**, brighter than the face.
- Meeting 2,000 cd/m² at 50 lm would need a ≈ Ø100 mm window, which doesn't fit the clear patch (§6).
- So the wall light must be **aimed and shielded** so people don't look straight into it. For example, recess the window in a short hood that faces the wall, and check sightlines on the bench (§8 step 6).
- As a status-only light (≈ 5 lm), the same window would be ≈ 3,200 cd/m².
- Glare depends on luminance and on how close the source is to the line of sight ([G2] in `SCATTERING_NOTES.md`). A window behind the lamp is usually off-axis for the user, but not for someone behind it.

**3. Light-tightness matters more if the front is changed.**
- Today ≈ 0.9% of the face's light reaches the back cavity. That rises to ≈ 2.6% if the front walls are made white while the 776 mm² board edge gap stays open.
- The sealed pod (§5) already keeps that glow out of the rear window.
- Closing the edge gap, the scattering fix in `SCATTERING_NOTES.md` §1, also cuts the back-cavity light.

**4. The camera fix also protects against the rear module.**
- The 132 mm² slot under the camera board joins the back cavity to the front cavity right beside the camera.
- The black sleeve proposed in `SCATTERING_NOTES.md` §2 runs from the board to the diffuser around the barrel. It blocks the camera's view of the front-cavity glow, whether that light comes from the face or leaks forward from the back.
- A sealed rear pod plus that sleeve covers both paths.

**Pod interior.** By Sun et al.'s cavity relation ([E2] in `SCATTERING_NOTES.md`, checked), output through a diffuser rises as the reflectance of the other cavity surfaces rises. So line the pod interior white (≈ 0.9 or better) rather than leaving it dark PLA.

## Sources

1. Fostervold, K. I. & Nersveen, J. (2008). Proportions of direct and indirect indoor lighting: the effect on health, well-being and cognitive performance of office workers. *Lighting Res. Technol.* 40, 175–200. doi:10.1177/1477153508090917 **[full text]** `context/papers/1477153508090917.pdf`
2. Hedge, A., Sims, W. R. & Becker, F. D. (1995). Effects of lensed-indirect and parabolic lighting on the satisfaction, visual health, and productivity of office workers. *Ergonomics* 38, 260–280. <https://ergo.human.cornell.edu/personal/ahlil.abs.html> **[abstract]**
3. Duff, J., Kelly, K. & Cuttle, C. Perceived adequacy of illumination, spatial brightness, horizontal illuminance and mean room surface exitance in a small office. *Lighting Res. Technol.* 49(2) (online 2015, print 2017). doi:10.1177/1477153515599189 **[abstract]**
4. Cuttle, C. (2013). A new direction for general lighting practice. *Lighting Res. Technol.* 45(1). <https://www.cibse.org/media/5fymxkhw/c-cuttle-a-new-direction-for-general-lighting-practice-lighting-research-technology-volume-45-issue-1-2013.pdf> **[abstract]**
5. Benedetto, S., Carbone, A., Drai-Zerbib, V., Pedrotti, M. & Baccino, T. (2014). Effects of luminance and illuminance on visual fatigue and arousal during digital reading. *Computers in Human Behavior* 41, 112–119. doi:10.1016/j.chb.2014.09.023 **[full text]** `context/papers/benedetto2014.pdf`
6. Zhou, Y., Shi, H., Chen, Q.-W., Ru, T. & Zhou, G. (2021). Investigation of the optimum display luminance of an LCD screen under different ambient illuminances in the evening. *Applied Sciences* 11, 4108. doi:10.3390/app11094108 **[full text]** `context/papers/applsci-11-04108.pdf`
7. Rempel, A. et al. (2009). Video viewing preferences for HDR displays under varying ambient illumination. APGV '09. <https://www.cl.cam.ac.uk/~rkm38/pdfs/rempel09vvp.pdf> **[abstract]**; title not yet confirmed
8. Lighting Research Center news item on bias lighting and eyestrain (Jan 2006). <https://www.lrc.rpi.edu/resources/news/enews/Jan06/general308.html> **[secondary]**; no peer-reviewed paper found
9. ANSI/IES RP-1 (office lighting): 3:1 task-to-surround ratio, as cited in US patent 7568818. **[secondary]**; check against the standard
10. Baraka, K., Paiva, A. & Veloso, M. Expressive lights for revealing mobile service robot state. In *Robot 2015: Second Iberian Robotics Conference*, Advances in Intelligent Systems and Computing, Springer (2016). **[full text]** `context/papers/15robot-BarPaiVel.pdf`. The venue is from the file name and the CMU listing; the PDF itself doesn't state it.
11. Song, S. & Yamada, S. (2018). Bioluminescence-inspired human-robot interaction: designing expressive lights that affect human's willingness to interact with a robot. HRI '18, 224–232. doi:10.1145/3171221.3171249 **[abstract]**
12. Hoffman, G. & Breazeal, C. (2010). Effects of anticipatory perceptual simulation on practiced human-robot tasks. *Autonomous Robots* 28(4). <https://robots.media.mit.edu/portfolio/aur> **[abstract]**
13. Hui, S. Y. R. & Qin, Y. X. (2009). A general photo-electro-thermal theory for light emitting diode (LED) systems. IEEE APEC. **[full text]** `context/papers/apec.2009.4802712.pdf`
14. Qin, Y. X. & Hui, S. Y. R. (2010). Comparative study on the structural designs of LED devices and systems based on the general photo-electro-thermal theory. *IEEE Trans. Power Electron.* 25(2), 507–513. **[full text]** `context/papers/tpel.2009.2026752.pdf`
15. Moreno, I., Avendaño-Alejo, M. & Tzonchev, R. I. (2006). Designing light-emitting diode arrays for uniform near-field irradiance. *Applied Optics* 45(10), 2265–2272. **[full text]** `context/papers/ApplOpt2006.pdf`
16. JLC3DP, "PLA temperature resistance" (vendor guide). <https://jlc3dp.com/blog/pla-temperature-resistance> **[secondary]**; replace with the filament datasheet
17. TI E2E forum, "TLC59711 SPI" (forum answer). <https://e2e.ti.com/support/power-management-group/power-management/f/power-management-forum/272583/tlc59711-spi> **[secondary]**; replace with the TI datasheet
18. Adafruit, "TLC5947 and TLC59711 PWM LED driver breakouts." <https://learn.adafruit.com/tlc5947-tlc59711-pwm-led-driver-breakout> **[secondary]**

**Still wanted:** Hedge et al. [2], Duff et al. [3], Song & Yamada [11], Hoffman & Breazeal [12], Rempel et al. [7], IES RP-1 [9], the PLA filament datasheet, the TLC59711 datasheet, and the JB2835 J-class datasheet (to replace the 150–206 lm/W range with the board's actual part).

**Can the rear module help the dark camera corner on the face?** No. It is a sealed pod on the back dome facing away from the diffuser, and these notes deliberately keep its light out of the front cavity (§5, §9). Secondary sources *inside* the front cavity can; they are modelled in the program (step 3 → Secondary light) and discussed in `SCATTERING_NOTES.md` §6.
