# LED Placement Optimization — Reading List

Ordered by how directly each source feeds the Head work. Citation details were checked against publisher or
repository listings. Items marked *(abstract only)* were verified from the abstract or listing, not the full text.

## A. Core: spacing rules for uniform near-field irradiance (read first)

1. **Moreno, Avendaño-Alejo & Tzonchev, "Designing light-emitting diode arrays for uniform near-field irradiance,"**
   *Applied Optics* 45(10), 2265–2272 (2006).
   - Closed-form optimum LED-to-LED spacing (a Sparrow-style flatness criterion) for linear, square, triangular
     and circular arrays, with each LED modelled as a cos^m Lambertian emitter. This is the analytic baseline the
     optimizer should beat.
   - **Takeaway for us:** for m = 1 (the JB2835 is close to Lambertian), the paper's linear-array optimum is
     d = h. I checked the ripple numerically for an infinite square grid at the diffuser plane:
     d/h = 0.8 → 1%, 1.0 → 5%, 1.2 → 14%, 1.45 → about 30%.
     60 LEDs on the about 8,100 mm² placeable area give about 12 mm nearest-neighbour pitch. At the model's
     **10 mm gap** that is d/h ≈ 1.2 (about 14% ripple, so hotspots start to show). At the older **21 mm gap** it
     is d/h ≈ 0.6, which is flat.
     The gap matters more than the layout, so confirm it first.

2. **Moreno & Sun, "Modeling the radiation pattern of LEDs,"** *Optics Express* 16(3), 1808–1819 (2008).
   - A sum of Gaussian / cos^m terms fits real datasheet radiation patterns. This justifies the Lambertian
     (m = 1) kernel the sim uses, and shows how to swap in a measured pattern later.

3. **Yang, Bergmans, Schenk, Linnartz et al., "Uniform illumination rendering using an array of LEDs: a signal
   processing perspective,"** *IEEE Trans. Signal Processing* 57(3), 1044–1057 (2009). *(abstract only)*
   - Uses relative mean-squared error as the uniformity cost and shows a **hexagonal grid needs ~13% fewer LEDs
     than a rectangular one** for the same uniformity. That is why the new tool offers a hex seed and an RMSE
     objective term.

## B. Numerical placement optimization (the algorithms implemented)

4. **Su, Xue & Ji, "Designing LED array for uniform illumination distribution by simulated annealing
   algorithm,"** *Optics Express* 20(S6), A843–A855 (2012). *(citation via secondary listing)*
   - LED (x, y) coordinates are the variables, the illuminance-uniformity objective is optimized with SA, and
     the method handles arbitrary target shapes. **This is the main template for the "Optimize" button.**

5. **Lei, Wang & Zou, "Designing LED array for uniform illumination based on local search algorithm,"**
   *J. Eur. Opt. Soc. – Rapid Publ.* 9, 14014 (2014). Open access:
   <https://jeos.edpsciences.org/articles/jeos/pdf/2014/01/jeos20140914014.pdf>
   - Greedy local search on LED positions is cheaper than SA and gives a nearly equal result. Implemented as the
     "polish" stage after annealing.

6. **Abeysekera, Kalavally, Ooi & Kuang, "Impact of circadian tuning on the illuminance and color uniformity of
   a multichannel luminaire with spatially optimized LED placement,"** *Optics Express* 28(1) (2020),
   doi:10.1364/OE.381115. Full text: <https://researchcommons.waikato.ac.nz/handle/10289/15513>
   - Genetic-algorithm placement **under a minimum LED-separation and panel-size constraint**, about 40% better
     uniformity than analytic layouts. This is the closest analogue to our constrained board (keepouts, 2835
     clearance). Also relevant if RGB pixels get interleaved later.

7. **Shen & Ji, "Optimizing spherical light-emitting diode array for highly uniform illumination,"**
   *J. Photonics for Energy* 3, 034594 (2013) — GA on a curved array. Useful if the Head face stays tilted or
   curved. <https://nanolithography.spiedigitallibrary.org/journals/journal-of-photonics-for-energy/volume-3/issue-01/034594/Optimizing-spherical-light-emitting-diode-array-for-highly-uniform-illumination/10.1117/1.JPE.3.034594.full>

8. **Ming et al., improved particle-swarm LED array layout,** *Journal of Applied Optics* 43(3), 524 (2022).
   *(abstract only)* PSO version, reporting +10–16% uniformity over the starting arrays.
   <https://www.researching.cn/articles/OJ1d4d6a26c0a2b985>

## C. Randomize / seeding algorithms

9. **Bridson, "Fast Poisson disk sampling in arbitrary dimensions,"** ACM SIGGRAPH 2007 Sketches.
   <https://www.cs.ubc.ca/~rbridson/docs/bridson-siggraph07-poissondisk.pdf>
   - O(N) "blue-noise" random placement that guarantees a minimum spacing. **This drives the Randomize button**:
     every random layout is already clearance-legal and evenly spread, with no clumps.

10. **Du, Faber & Gunzburger, "Centroidal Voronoi tessellations: applications and algorithms,"**
    *SIAM Review* 41(4), 637–676 (1999). <https://people.sc.fsu.edu/~mgunzburger/files_papers/gunzburger-cvt-siamreview.pdf>
    - Lloyd relaxation: each LED moves to the centroid of the area it "owns". This gives an even, area-weighted
      spread over **any** outline, including the D-shape with the camera notch. It is the "Relax (CVT)" button
      and a very good seed for annealing.

## D. Thermal coupling of placement

11. **Hui & Qin, "A general photo-electro-thermal theory for light emitting diode (LED) systems,"**
    IEEE APEC 2009, pp. 554–562, doi:10.1109/APEC.2009.4802712; and the follow-up **Hui, Chen et al.,
    "Comparative study on the structural designs of LED devices and systems based on the general
    photo-electro-thermal theory,"** *IEEE Trans. Power Electron.* 25(2), 507–513 (2010).
    - Flux falls as junction temperature rises, and **distributed (spread-out) LED systems run cooler and brighter
      than concentrated ones at the same power**. This is the theoretical basis for adding a thermal-crowding
      penalty to the placement objective.

12. *Analogue, not LED-specific:* non-uniform cell spacing in HBT power arrays lowers peak junction temperature,
    *Chinese Physics B* 28(9) 098502 (2019), doi:10.1088/1674-1056/ab3436. It supports "spread the centre, pack
    the edges", but treat it as an analogy only.

## E. Reflective walls / mixing cavities

13. **Taguchi-optimized free-form backlight cavity,** *Chinese Optics Letters* 13(3), 032302 (2015).
    <https://www.researching.cn/ArticlePdf/m00005/2015/13/3/032302.pdf>
    - Short mixing distance causes hotspots. Sloped or curved reflective walls lengthen the effective path and
      raise uniformity. This is directly relevant to the foil-wall idea.
    - The patent literature on recycling cavities (e.g. US 8,608,363 / 9,091,408 "Recycling backlights with
      semi-specular components") explains the specular vs diffuse vs semi-specular trade-off. Specular walls
      (like shiny foil) act as **mirrors that create image LEDs outside the board**, which fills the dark edge
      band. Diffuse walls mix better but lose more light per bounce.

## F. Internal references (Notion / context)

- *LED array heat calcs* (Ben Tran-Pugh, Notion, Aug 2026): front-only path, 10 W → 140–247 °C, 4 W → 71–114 °C.
- *Head:* baseline page: 57 LEDs, camera must be flush with diffuser, **LEDs < 2 mm from the camera board edge to
  kill the camera shadow**, diffuser ≥ 70% transmission, plastic touching PCB ≥ 100 °C.
- *Camera Obstruction*: IMX219-160 (160° FOV) puts the camera within about 1.4 mm of the diffuser. That is the
  reason for the keepout.

### Suggested 2-hour reading path
1 → 4 → 10 → 11 (skim) → 13. Then 6 if you want the constrained-GA detail.
