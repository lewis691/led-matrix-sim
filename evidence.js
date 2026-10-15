/* Where every model number comes from. Built from an independent audit (14 Oct 2026) that opened each source and
   checked each value; every mismatch it found was fixed in the code. Shown in step 5, "Evidence".
   kind: datasheet | cad | ben | paper | schematic | brief | user | derived | assumed | knowledge
   (knowledge = standard engineering value or datasheet not in the project files; labelled, not hidden) */
window.HEAD_EVIDENCE = [
  // ---- LED (Cree JB2835B 3V F-class Pro9 datasheet, CDJ-DS135)
  ['LED flux per colour temperature (90 CRI, 65 mA; 25 °C and 85 °C)', '3000 K 36.2 / 33.7 lm … 6500 K 37.5 / 35.0', 'datasheet', 'Pro9 p.5, all 14 values checked'],
  ['Flux tolerance', '±7 %', 'datasheet', 'Pro9 p.5'],
  ['Forward voltage at 65 mA', '2.70 V typ', 'datasheet', 'Pro9 p.4'],
  ['Thermal resistance junction → solder point', '5 K/W', 'datasheet', 'Pro9 p.4'],
  ['Max current, max junction, operating range', '480 mA, 125 °C, −40…105 °C', 'datasheet', 'Pro9 p.4'],
  ['Beam: 120° FWHM → Lambertian m = 1', 'm = 1', 'derived', 'Pro9 p.4 + Moreno 2006 Eq. 2'],
  ['Package size and height', '3.58 × 2.97 mm, 0.62 mm tall', 'datasheet', 'Pro9 p.23 (mechanical drawing)'],
  ['Recommended pad area (heat path into the board)', '6.47 mm²', 'datasheet', 'Pro9 p.23: 2.26×2.08 + 0.85×2.08'],
  ['Flux drop with temperature', '0.115 %/°C (3000 K)', 'derived', '(1 − 33.7/36.2)/60 from Pro9 p.5; linear form = Hui & Qin Eq. 2'],
  ['Flux proportional to current', 'linear', 'derived', 'Pro9 p.6 curve read by eye: ~40 % at 25 mA vs 38.5 % linear (model slightly low)'],
  ['Board LED part', 'JB2835BWT-J-U65EA… (J class, 90 CRI, 6500 K)', 'schematic', 'Head_Board.pdf; the model uses F-class Pro9 data, as the brief allows'],
  // ---- board and driver
  ['60 LEDs, 12 strings of 5, TLC59711', '60 / 5 / 12', 'schematic', 'Head_Board.pdf; brief p.2'],
  ['Driver current limit', '60.5 mA', 'knowledge', 'R82 = 820 Ω from Head_Board.pdf × TLC59711 formula 41 × 1.21 V / R (datasheet not in the project files; its channel rating is 60 mA)'],
  ['LED supply VDD_LED', '13.37 V', 'knowledge', '100k/4.7k divider from Head_Board.pdf × LMR51420 0.6 V reference (datasheet not in the project files)'],
  ['Regulation headroom limit', '0.4 V', 'assumed', 'my engineering choice'],
  // ---- geometry (Head STEP, measured in context/step_extract)
  ['Board → diffuser gap', '17.9 mm (uniform)', 'cad', 'Head STEP, REPORT §2 A1'],
  ['Optical height (gap − LED height)', '17.28 mm', 'derived', '17.9 − 0.62'],
  ['Lit aperture inside the board edge', '3.6 mm', 'derived', 'STEP: (139.105 − 131.905)/2'],
  ['Diffuser', '1.0 mm, flat', 'cad', 'Head STEP'],
  ['Camera barrel / diffuser hole', 'Ø14 / Ø16 (1 mm open ring)', 'cad', 'Head STEP'],
  ['Camera board footprint', '25 × 24 mm at x 30–55, y −21.9…2.1', 'cad', 'Head STEP'],
  ['LED keepout (default)', 'corner x ≥ 19.0, y ≤ 19.22 mm; LED centre ≥ 2.3 mm from it', 'user', 'WT - Lewis.dxf (first model); user: the new prototype uses it'],
  ['Evenness scored over the whole lit face', 'including the diffuser over the keepout corner', 'user', 'user, 15 Oct: even distribution regardless'],
  ['Screw holes and front bosses', '3 holes; Ø8.6 bosses at TL/TR', 'cad', 'Head STEP (agrees with the DXF to 0.04 mm)'],
  ['Head outline', 'R 69.55, corners R 33.64, bottom R 482.38', 'cad', 'DXF; STEP agrees to 0.05 mm (right corner is R 33.84 in the DXF; the model mirrors the left one)'],
  ['Back-cavity depth map', '5 mm grid, mean 59 mm', 'cad', 'Head STEP ray cast (all 462 cells checked)'],
  ['Shell areas, wall thickness, boss contacts', 'e.g. 36,467 mm² room-facing, 3.0 mm, 52–62 mm²', 'cad', 'Head STEP'],
  ['Desk distance and circle', '400 mm, Ø400 mm', 'ben', "Ben's Notion 'LED research doc + sim' (\"500lx, 40cm\"); circle Ø400 in 'Find LED baseline ranges'"],
  // ---- targets
  ['Desk minimum', '500 lx', 'ben', "Ben's Notion 'LED research doc + sim', citing EN 12464-1; 'target_lx 500' in baseline ranges"],
  ['Light out, evenness, board temperature, LED power goals', '300 lm, 65 %, 40 °C, 4 W', 'brief', 'Brief p.2 (all marked provisional)'],
  ['Diffuser transmission', '0.70', 'ben', "Notion 'Head:' page: \"must pass at least 70%\"; you: \"70 percent diffusion\""],
  // ---- light model
  ['LED light on a plane', 'E = h²/(π r⁴) per lm (m = 1)', 'paper', "Moreno 2006 Eq. 1 (cos^m) × incidence cosine; same as Ben's derivation. (Moreno's Eq. 3 writes z^m/R^(m+2): their m = 2 = this m = 1)"],
  ['Walls absorb', 'no reflection', 'paper', "Moreno, Yang and Ben model none; your shell is opaque dark PLA"],
  ['Desk light method', 'each diffuser patch a Lambertian source', 'ben', "Ben's Notion derivation"],
  ['Evenness metric and score', 'min/avg + CV', 'paper', 'Yang 2009 / Su 2012 (CV); brief (65 %)'],
  // ---- heat
  ["Ben's network constants", 'k_air 0.026, ν 1.51e-5, α 18.46e-6, ε 0.85/0.90, PC 1 mm k 0.2', 'ben', 'LED_array_heat_calcs p.5 (reproduces his 247 / 139.3 °C, check 5)'],
  ['Air-movement cases', 'worst Nu 1, h 2; best Nu 3, h 25', 'ben', 'LED_array_heat_calcs p.6–7'],
  ['Room temperature', '25 °C', 'ben', 'LED_array_heat_calcs p.5'],
  ['Heat share of LED power; chip temperature form', 'k_h 0.85; T_j = T_b + R k_h P', 'paper', 'Hui & Qin 2009 Eqs. 3, 5a (measured k_h on 2009 LEDs)'],
  ['Electronics heat (worst case)', '4.6 W (camera 0.5 W of it)', 'user', 'your power table, from the 24 V input'],
  ['Shell PLA, opaque; sealed; no vents; metal-core board', '—', 'user', 'your answers'],
  ['Metal-core stack-up', '1.6 mm Al k 138, 1 oz Cu, 0.1 mm dielectric k 2, back ε 0.1', 'assumed', 'typical values until the PCB stack-up exists'],
  ['PLA properties', 'k 0.13, ε 0.9, softens ≈ 55–60 °C', 'assumed', 'typical values; check the filament datasheet'],
  ['Electronics placement', 'spread evenly', 'assumed', 'positions unknown'],
  ['FR4 comparison', 'in-plane k 0.8, 1.6 mm', 'assumed', 'typical laminate value (comparison only)'],
  ['Back-cavity and shell model', 'k_air Nu/L + radiation; wall t/kA; outside h + radiation', 'derived', "same forms as Ben's front network, applied to STEP geometry"],
  ['Motor heat', '0 W', 'user', 'not in your table'],
  ['Boss → shell spreading', 'ln(R/4.3 mm)/(2π k t), R = equal share of the shell inside area', 'derived', 'radial conduction in a thin wall (textbook); the equal-share radius is assumed'],
  ['Heat capacities (warm-up)', 'Al 2700 kg/m³ × 900, PC 1200 × 1200, PLA 1240 × 1800 J/kg·K', 'assumed', 'typical material values; volumes from the STEP'],
  ['What-if materials', 'black back ε 0.9, Al standoffs/shell k 138, PC k 0.2, anodised ε 0.85', 'assumed', "typical values; PC k is Ben's value"],
  ['Sensitivity ranges', 'e.g. back ε 0.05–0.9, PLA k 0.10–0.20, Al 1–2 mm, room 20–30 °C', 'assumed', "typical spreads; air cases from Ben, power range from your table"],
  // ---- display only (3D)
  ['Desk reflectance (Real look only)', '0.5', 'assumed', 'display only'],
  ['LED colour on screen', 'blackbody fit', 'knowledge', 'Tanner Helland approximation (display only)'],
  ['Optimizer settings, colour thresholds, clearances', 'e.g. penalty 50, 1.3 / 1.0 / 3.5 / 4.5 mm', 'assumed', 'my engineering choices (speed and safety margins, not physics)'],
  ['Papers not in the project files', 'Su 2012, Du/Faber/Gunzburger 1999, Bridson 2007', 'knowledge', 'cited for algorithms only (optimizer, Even out, Randomize); context/papers holds Moreno, Yang, Hui & Qin'],
];
