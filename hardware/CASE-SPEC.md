# Nura Case Spec

Parametric model: [`nura-case.jscad`](nura-case.jscad) (OpenJSCAD V2). Open it at <https://openjscad.xyz>, pick a part in the parameter panel, and export STL.

## Design decision: modular, not one piece

The 30 W panel is about **540 × 350 mm** (measure yours; it is a parameter). That is larger than common printer beds (220–256 mm), and a large flat print would warp in Sahel heat. The case is therefore a set of printable modules that hold the store-bought aluminium-framed panel, not a single shell around it.

| Part | Qty | Size (mm, default params) | Function |
|---|---|---|---|
| `collar` | 1 | 134 × 145 × 50 | Ring around the pole with **3 radial M8 bosses at 120°** (the 3-prong clamp). Captive-nut pockets. Pads for the arm (top) and bay (side) |
| `jaw` | 3 | 15 × 53 × 46 | Curved jaw with grip ribs. An M8 bolt through each boss pushes a jaw onto the pole, self-centring on 60–120 mm poles |
| `bay` | 1 | 166 × 117 × 128 | Electronics bay for the 12 V 12 Ah LiFePO₄ + controller + node board. Gasket groove, 3 × M16 cable glands, board rails |
| `lid` | 1 | 166 × 111 × 6 | Lid with 4 security-screw holes and a pocket for the tamper-reed magnet |
| `arm` | 1 | 234 × 240 × 70 | Cross-shaped tilted arm (parameter `tilt`, default 15°) joining the collar to the panel brackets |
| `bracket` | 4 | 50 × 50 × 35 | Corner brackets that wrap the panel's 25 mm frame. M6 to the arm |
| `ledMount` | 1 | 230 × 64 × 49 | 180 mm arm with a pad for the 10 W 12 V IP65 lamp (2 × M6 bolts), a hole for the **M12 IP68 waterproof plug**, and an angled **photodiode hood** |

Everything fits a 250 × 250 mm bed.

## Parameters

| Name | Default | Range | Note |
|---|---|---|---|
| `poleD` | 76 | 60–120 | Measure the pole at clamp height |
| `tilt` | 15 | 0–35 | ≈ site latitude + 5° (Khartoum 20°, N'Djamena 17°, Mogadishu 7°) |
| `panelL` / `panelW` / `panelT` | 540 / 350 / 25 | | Default 30 W panel. Measure yours; change for 50 W |
| `wall` | 3.2 | | 4 perimeters at 0.4 mm nozzle |
| `boltD` | 8.4 | | M8 clearance |

## Materials and print settings

| | Recommendation | Why |
|---|---|---|
| Material | **ASA** (first choice) or PETG | UV-stable. ASA keeps its shape to ~95 °C; PLA softens at ~55 °C and fails in Sahel sun |
| Colour | White / light grey | Keeps the battery bay cooler. LiFePO₄ should stay below 60 °C |
| Layer | 0.2 mm, 4 perimeters, 40% gyroid infill | Strength vs. print time |
| Collar and jaws | 60% infill, print flat | Take clamp load |
| Enclosure | Print ASA in an enclosed printer | Prevents warping |
| Post-process | UV-stable paint optional; silicone around glands | |

**Filament per light:** about 400 g ASA (≈ $9 at $22/kg). **Print time:** about 16 h on one printer. A 5-printer workshop (5 × 24 h ÷ 16 h) can make about 7 lights a day.

## Hardware BOM (per light)

| Item | Qty |
|---|---|
| M8 × 40 stainless bolt + M8 nut + wide washer | 3 |
| M6 × 20 stainless bolt + nyloc | 8 |
| M5 × 16 bolts (arm/bay to collar pads) | 8 |
| M4 × 12 **pin-Torx security** screws (lid) | 4 |
| M16 IP68 cable gland | 3 |
| 2.5 mm EPDM gasket cord | 0.5 m |
| M12 IP68 2-pin connector pair (panel socket + lamp plug) | 1 |
| M6 × 16 stainless bolt + nyloc (lamp bracket) | 2 |
| 5 × 3 mm neodymium magnet + reed switch (tamper) | 1 |
| Ball tilt switch | 1 |

## Assembly

1. Press the nuts into the collar's captive pockets and thread the M8 bolts in from outside.
2. Place the collar over the pole with the 3 jaws inside, and tighten the bolts evenly to about 12 N·m (one-third turn each, round-robin).
3. Bolt the arm to the collar top pad, then fix the 4 brackets to the panel frame and to the arm. Face the panel south (north of the equator).
4. Bolt the bay to the side pad. Fit the battery, controller and node board, then route the cables through the glands.
5. Fit the lamp mount under the bay side and screw the M12 socket into its hole. Bolt the 10 W lamp's bracket to the pad (2 × M6), then click in its plug and tighten the locking ring.
6. Seat the gasket, fit the lid with its security screws, and check the tamper reed reads "closed".

## Known limits and next revision

- **Clamp creep:** plastics creep under constant bolt load in heat. Re-torque at 1 month, or print jaws in PETG-CF / nylon-CF, or add a stainless hose-band backup.
- **Thermal:** a sealed bay in direct sun can exceed 60 °C. The next revision adds a sun-shade overhang (the panel already shades the bay partly at the default tilt).
- **Strength testing:** the 30 W panel has about 0.19 m² of area, so at its 2,400 Pa rating the arm and brackets must hold about 450 N (up from about 310 N for the 20 W panel). Load-test before field pilots.
