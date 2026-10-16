# Brief: extract the Head geometry from the STEP files

Paste this whole file into the new chat as the first message. When that chat is done, tell this chat where the outputs are.

---

## Your task

You're extracting measured geometry from CAD so an LED-placement and thermal model of the LeLamp **Head** can become
complete. The model already exists and is not part of your job: don't change anything in
`C:\Users\andy_\Downloads\HCL_Work_Trial\code\`. Your job is to measure the CAD and write the outputs listed below.

**Inputs** (in `C:\Users\andy_\Downloads\HCL_Work_Trial\context\`):
- `Head 1 Assembly.step`: units are metres. It contains these parts: `Head Front`, `Head Back`, `Diffuser`,
  `LED Array`, `Camera`, `Mic Array`, `DM-J3507 Mounting Plate`, `Neck`.
- `Damiao Neck (1).step`: the neck / motor assembly.
- `WT - Lewis.dxf`: the 2-D drawing the model currently uses. Use it only for checking your alignment.
- `Head_Board.pdf`: the LED board schematic (12 strings × 5 JB2835 LEDs on a TLC59711).

**Output folder:** `C:\Users\andy_\Downloads\HCL_Work_Trial\context\step_extract\` (create it). Work in **mm**.

**Tools:** Python with `cadquery` / `OCP` (`pip install cadquery`), or FreeCAD's Python. Read the STEP with
`STEPCAFControl_Reader` (XCAF) rather than a plain importer, so you keep the part names, the assembly placements,
and any colours or material names stored in the file. Run Python on the STEP files as data (`python -I`, scripts
kept outside the context folder).

**Rules:**
- Measure; don't guess. If something can't be determined from the CAD, write `null` and say why in `REPORT.md`.
- If a value comes from you rather than the CAD, label it `"assumed"`.
- Report every value in the **model frame** defined below, and give min/max wherever a value varies.

---

## 1. Coordinate frame (do this first)

The model uses the diffuser face seen from outside, with the 12° drawing tilt removed:
- **Origin:** the centre of the head outline's round top arc (the "dome centre").
- **x:** to the right as you look at the lit face.
- **y:** up the face.
- **z:** the face normal, pointing **from the LED board toward the diffuser** (out of the lamp).

**Known anchor points** in this frame (mm). Find each feature in the STEP, solve the rigid transform from the STEP
frame to this frame (least squares), and report the leftover error of each anchor:

| Feature | x | y |
|---|---|---|
| Screw hole, top-left | −36.64 | 53.87 |
| Screw hole, top-right | 36.26 | 53.87 |
| Screw hole, bottom-left | −46.84 | −27.97 |
| Camera lens centre (centre of the IMX219 board's 4 M2 holes) | 42.4 | −13.3 |
| Outline: top of round arc | 0 | 69.55 |
| Outline: overall width / height | 139.1 | 105.0 |

If the error is more than about 0.5 mm, say which features disagree. The DXF may differ from the STEP, and that is
worth knowing.

---

## 2. Values the current model has to *assume*, which the STEP can settle (highest priority)

| # | Question | The model currently assumes |
|---|---|---|
| A1 | **Gap from the LED board's front face to the diffuser's inner face** (min / max / at centre). Is it uniform? | 10 mm (other docs say 21 or 25 mm) |
| A2 | **Diffuser:** thickness; flat or curved (largest deviation from a plane); outline | 1.0 mm, flat, DXF outline |
| A3 | **Visible diffuser aperture:** the opening in Head Front through which the diffuser is seen. How wide is the hidden rim under the lip (min / max)? | 2 mm hidden rim |
| A4 | **Camera:** lens or barrel diameter, barrel length, the hole in the diffuser or Front for the lens, and the clearance ring around the lens | lens Ø 8 mm, flush with the diffuser |
| A5 | **Head angle in use:** the angle between the diffuser face and the horizontal when the lamp is upright, if the assembly defines it | parallel to the desk |
| A6 | **LED board:** thickness and outline (is it the same as the diffuser outline?) | outline = DXF, area ≈ 11,900 mm² |

---

## 3. What each LED board looks like (the `LED Array` part)

- **LED bodies:** if they are modelled, list every LED: centre (x, y), rotation, and body size. This is the
  real production layout, and it becomes the "current Head" baseline in the model. Also give the count. Is it 60?
- **Other parts on the board:** every other component on either side (TLC59711, resistors, connectors, capacitors,
  test points), with type or guess, centre, footprint, height, and which side. Front-side parts can cast shadows or
  act as keepouts; back-side parts matter for the air gap behind the board.
- **Mounting:** holes, standoffs, bosses, screws. For each, what it touches (Head Back, Head Front, mounting
  plate), the contact area, and the material if stated.
- **Copper, mask and stack-up:** if the STEP has layer colours or names, report them. They usually aren't there; see
  §7.

---

## 4. Heat paths (for a temperature map of the board)

The model's heat calculation currently assumes heat leaves only through the diffuser (Ben's front path). For a real
temperature map it needs the other paths:

- **Behind the board:** the air gap from the board's back face to the inside of Head Back (min / max / mean, and a
  coarse height map on a 5 mm grid if it isn't uniform); the enclosed volume; anything touching the board's back.
- **Head Back and Head Front:** wall thickness (min / max / typical), inner and outer surface areas, and which
  surfaces face the room.
- **Contacts and conduction:** every place the LED board touches another part (area, part), and the path from
  Head Back through the `DM-J3507 Mounting Plate` to the `Neck` (contact areas, plate thickness, metal or plastic
  if the CAD says).
- **Other heat sources in the head:** camera board and mic array (outline, position, z, what they touch). Power is
  not in the CAD; see §7.
- **Front-cavity walls:** the inner wall between board and diffuser: height, draft angle, and inner area. Give its
  profile in 2–3 cross-sections.

---

## 5. Light escape (every way light can leave other than the visible diffuser)

List every opening and seam. For each, give part, type (hole / slot / vent / seam / gap / clearance), centre,
normal, size, area, and what it connects (front cavity → room, back cavity → room, front ↔ back cavity). Also say
whether there is a **straight line of sight from any LED** to it. Include at least:
- clearance around the camera lens or barrel through the diffuser or Front
- seams between Diffuser and Head Front, and between Head Front and Head Back
- mic holes, screw holes, cable or neck openings, vents
- any gap at the board edge that lets light reach the back cavity
- parts that are thin enough to glow through: shell thickness where the LEDs can see it

---

## 6. Meshes and sections (for a realistic 3D view)

- Export each part as **binary STL or GLB in the model frame, in mm**, simplified to about 50k triangles or fewer per
  part: `meshes/<part>.stl`.
- Cut **3 cross-sections**, saved as SVG or DXF:
  - through the lens centre along x
  - through x = 0 along y
  - through the board's mid-plane (z), parallel to the face

  These show the board, both cavities, diffuser, walls and lip.

---

## 7. Not in the CAD: ask the user, then record the answers or `null`

- Materials and colours: diffuser grade (and any transmission spec), shell plastic, shell colour and whether it's
  translucent, solder-mask colour, inner wall finish.
- PCB stack-up: FR4 or aluminium-core, copper weights per layer, thickness, thermal vias under the LEDs, thermal
  pads or gap filler.
- Power drawn by the camera, mic array and neck motor while the lamp is lit.
- Whether any vents are planned.

---

## 8. Deliverables (in `context/step_extract/`)

1. `head_geometry.json`: all numbers, structured as follows (mm, model frame):
```json
{
  "units": "mm",
  "frame": { "transform_step_to_model": [[4x4]], "anchors": [{ "name": "", "step_xyz": [], "model_xy": [], "residual_mm": 0 }] },
  "assumptions_answered": { "gap_mm": {"min":0,"max":0,"centre":0}, "diffuser": {"thickness":0,"flat":true,"max_dev_mm":0},
    "hidden_rim_mm": {"min":0,"max":0}, "camera": {"lens_d":0,"barrel_d":0,"barrel_len":0,"hole_d":0},
    "use_tilt_deg": null, "board": {"thickness":0,"area_mm2":0} },
  "outlines": { "diffuser": [[x,y]], "visible_aperture": [[x,y]], "led_board": [[x,y]] },
  "z_levels": { "board_back": 0, "board_front": 0, "diffuser_inner": 0, "diffuser_outer": 0, "head_back_inner_min": 0 },
  "leds": [{ "x": 0, "y": 0, "rot_deg": 0, "w": 2.8, "l": 3.5 }],
  "components": [{ "type": "", "x": 0, "y": 0, "w": 0, "l": 0, "h": 0, "side": "front|back" }],
  "mounts": [{ "type": "", "x": 0, "y": 0, "contact_mm2": 0, "to_part": "" }],
  "back_cavity": { "gap_mm": {"min":0,"max":0,"mean":0}, "height_map_5mm": null, "volume_mm3": 0 },
  "shells": { "head_front": {"t_min":0,"t_max":0,"inner_mm2":0,"outer_mm2":0}, "head_back": {} },
  "front_walls": { "height_mm": 0, "draft_deg": 0, "inner_area_mm2": 0 },
  "conduction_path_to_neck": [{ "from": "", "to": "", "contact_mm2": 0, "thickness_mm": 0 }],
  "other_heat_sources": [{ "part": "", "outline": [[x,y]], "z": 0, "touches": "" }],
  "openings": [{ "part": "", "type": "", "centre": [x,y,z], "normal": [0,0,0], "area_mm2": 0, "connects": "", "led_line_of_sight": false }],
  "parts": [{ "name": "", "colour_rgb": null, "material": null, "volume_mm3": 0, "area_mm2": 0, "bbox": [[],[]] }],
  "user_supplied": { "materials": {}, "stackup": {}, "powers_W": {}, "vents": null }
}
```
2. `meshes/*.stl` (§6) and `sections/*.svg` (§6).
3. `leds.csv` (`x,y,rot_deg`) if LED bodies exist. It can be loaded into the model directly.
4. `REPORT.md`: method, anchor errors, a table answering A1–A6, a list of what couldn't be found, and any surprises
   (for example, the gap isn't 10 mm, or the DXF and STEP disagree).

---

## What this chat (the model) will do with it

- **Geometry:** replace the assumed gap, rim, lens and outline with measured values; import the real LED layout as
  the "current Head" baseline; add front-side component shadows and keepouts.
- **Temperature map:** a 2-D board model. Each LED is a heat source and heat spreads through the board's copper and
  FR4 (conduction). It leaves by:
  - Ben's front path, per area
  - the measured back-cavity path to Head Back and the room
  - the mounts and mounting plate to the neck

  The result is a per-LED and per-spot temperature map in place of today's single board temperature, to be checked
  against the fixture's probes.
- **Light escape:** an accounting of every lumen: through the diffuser aperture, absorbed by the walls, lost under the
  lip, out of the camera clearance, out of seams and holes, and glowing through the shell.
- **Realistic render:** the real head shells and diffuser in the nightstand scene, in place of the extruded outline.
