/**
 * Nura light-node case: parametric OpenJSCAD (V2 API) model
 *
 * Preview: open https://openjscad.xyz and drag this file in (or `npx @jscad/cli nura-case.jscad -o out.stl`).
 * Units: millimetres. Print in ASA (preferred) or PETG, not PLA (UV + heat). See CASE-SPEC.md.
 *
 * Printable parts (choose with the "part" parameter, export each as STL):
 *   collar   3-prong pole clamp collar with radial M8 bosses
 *   jaw      one of 3 curved clamp jaws (print 3)
 *   bay      sealed electronics bay with gasket groove and cable-gland holes
 *   lid      bay lid with photodiode-free plain top
 *   bracket  panel corner bracket (print 4); holds the aluminium panel frame
 *   arm      tilted panel arm that joins the collar to the brackets
 *   ledMount lamp mount: 2 x M6 bracket holes for the 10 W 12 V IP65 lamp, M12 IP68 plug hole, photodiode hood
 *   assembly everything placed together for review (not for printing)
 */
'use strict'

const jscad = require('@jscad/modeling')
const { cuboid, cylinder, cylinderElliptic, roundedCuboid } = jscad.primitives
const { subtract, union } = jscad.booleans
const { translate, rotateX, rotateY, rotateZ } = jscad.transforms
const { colorize } = jscad.colors

const getParameterDefinitions = () => [
  { name: 'part', type: 'choice', caption: 'Part', values: ['assembly', 'collar', 'jaw', 'bay', 'lid', 'bracket', 'arm', 'ledMount'], initial: 'assembly' },
  { name: 'poleD', type: 'slider', caption: 'Pole diameter (mm)', min: 60, max: 120, step: 1, initial: 76 },
  { name: 'tilt', type: 'slider', caption: 'Panel tilt (deg)', min: 0, max: 35, step: 1, initial: 15 },
  { name: 'panelL', type: 'number', caption: 'Panel length (mm)', initial: 540 },
  { name: 'panelW', type: 'number', caption: 'Panel width (mm)', initial: 350 },
  { name: 'panelT', type: 'number', caption: 'Panel frame thickness (mm)', initial: 25 },
  { name: 'wall', type: 'number', caption: 'Wall thickness (mm)', initial: 3.2 },
  { name: 'boltD', type: 'number', caption: 'Clamp bolt hole (mm, M8 = 8.4)', initial: 8.4 }
]

const SEG = 64

/* ---------- 3-prong clamp collar ---------- */
const collar = (p) => {
  const h = 50
  const clearance = 14 // room for jaws (8 mm) + adjustment travel (6 mm)
  const rIn = p.poleD / 2 + clearance
  const rOut = rIn + 8
  let ring = subtract(
    cylinder({ radius: rOut, height: h, segments: SEG }),
    cylinder({ radius: rIn, height: h + 2, segments: SEG })
  )
  // three radial bosses at 120 deg, each with an M8 hole (bolt pushes a jaw onto the pole)
  for (let i = 0; i < 3; i++) {
    const a = (i * 2 * Math.PI) / 3
    const boss = rotateZ(a, translate([rOut + 6, 0, 0], cuboid({ size: [16, 24, h] })))
    const hole = rotateZ(a, translate([rOut, 0, 0], rotateY(Math.PI / 2, cylinder({ radius: p.boltD / 2, height: 60, segments: 24 }))))
    // captive-nut pocket (M8 nut 13 mm A/F, 6.5 mm thick)
    const nut = rotateZ(a, translate([rOut + 2, 0, 0], rotateY(Math.PI / 2, cylinder({ radius: 7.6, height: 6.8, segments: 6 }))))
    ring = subtract(union(ring, boss), hole, nut)
  }
  // mounting pads for arm (top) and bay (side, at 60 deg between two bosses)
  const armPad = translate([0, 0, h / 2 + 4], cuboid({ size: [40, 40, 8] }))
  const bayPad = rotateZ(Math.PI / 3, translate([rOut + 4, 0, 0], cuboid({ size: [10, 60, h] })))
  const padHoles = [
    translate([12, 12, h / 2 + 4], cylinder({ radius: 2.8, height: 20, segments: 20 })),
    translate([-12, 12, h / 2 + 4], cylinder({ radius: 2.8, height: 20, segments: 20 })),
    translate([12, -12, h / 2 + 4], cylinder({ radius: 2.8, height: 20, segments: 20 })),
    translate([-12, -12, h / 2 + 4], cylinder({ radius: 2.8, height: 20, segments: 20 }))
  ]
  return subtract(union(ring, bayPad), ...padHoles)
}

/* ---------- clamp jaw (print 3) ---------- */
const jaw = (p) => {
  const h = 46
  const r = p.poleD / 2
  const shell = subtract(
    cylinder({ radius: r + 8, height: h, segments: SEG }),
    cylinder({ radius: r, height: h + 2, segments: SEG }),
    // keep a 70 deg arc on +X
    rotateZ((35 * Math.PI) / 180, translate([0, r + 20, 0], cuboid({ size: [4 * r, 2 * r + 40, h + 4] }))),
    rotateZ((-35 * Math.PI) / 180, translate([0, -(r + 20), 0], cuboid({ size: [4 * r, 2 * r + 40, h + 4] }))),
    translate([-(r + 10), 0, 0], cuboid({ size: [2 * r + 20, 4 * r, h + 4] }))
  )
  // dimple the bolt tip seats in; grip ribs on the inner face
  const dimple = translate([r + 8, 0, 0], rotateY(Math.PI / 2, cylinderElliptic({ startRadius: [5, 5], endRadius: [1, 1], height: 5, segments: 24 })))
  let out = subtract(shell, translate([-2.5, 0, 0], dimple))
  for (let z = -18; z <= 18; z += 6) {
    out = subtract(out, translate([r, 0, z], cuboid({ size: [1.2, 60, 1.2] })))
  }
  return out
}

/* ---------- electronics bay ---------- */
const BAY = { w: 160, d: 105, h: 125 } // fits a 12 V 12 Ah LiFePO4 (about 151 x 98 x 95 mm) + node board above it
const bay = (p) => {
  const t = p.wall
  let box = subtract(
    roundedCuboid({ size: [BAY.w + 2 * t, BAY.d + 2 * t, BAY.h + t], roundRadius: 3, segments: 16 }),
    translate([0, 0, t], cuboid({ size: [BAY.w, BAY.d, BAY.h + t] }))
  )
  // gasket groove on the rim (2.5 x 2 mm for 2.5 mm EPDM cord)
  const rimZ = (BAY.h + t) / 2 - 1
  box = subtract(
    box,
    translate([0, 0, rimZ], subtract(cuboid({ size: [BAY.w + t, BAY.d + t, 2] }), cuboid({ size: [BAY.w + t - 5, BAY.d + t - 5, 3] })))
  )
  // three M16 cable-gland holes on the bottom: panel, lamp, antenna
  ;[-45, 0, 45].forEach((x) => {
    box = subtract(box, translate([x, 0, -(BAY.h + t) / 2], cylinder({ radius: 8.2, height: 3 * t, segments: 32 })))
  })
  // back flange to bolt onto the collar bay pad
  const flange = translate([0, -(BAY.d / 2 + t + 3), 0], subtract(cuboid({ size: [70, 6, 60] }), ...[-20, 20].map((z) => translate([0, 0, z], rotateX(Math.PI / 2, cylinder({ radius: 3, height: 10, segments: 20 }))))))
  // internal rails for the node board
  const rails = [-1, 1].map((s) => translate([s * (BAY.w / 2 - 2), 0, BAY.h / 2 - 20], cuboid({ size: [4, BAY.d - 6, 3] })))
  return union(box, flange, ...rails)
}

const lid = (p) => {
  const t = p.wall
  const plate = roundedCuboid({ size: [BAY.w + 2 * t, BAY.d + 2 * t, t], roundRadius: 1.5, segments: 12 })
  const lip = translate([0, 0, -t], subtract(cuboid({ size: [BAY.w - 0.6, BAY.d - 0.6, t] }), cuboid({ size: [BAY.w - 0.6 - 2 * t, BAY.d - 0.6 - 2 * t, t + 1] })))
  // 4 x security-screw holes + reed-switch magnet pocket
  const holes = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1]
  ].map(([sx, sy]) => translate([sx * (BAY.w / 2 - 6), sy * (BAY.d / 2 - 6), 0], cylinder({ radius: 2.1, height: 10, segments: 16 })))
  const magnet = translate([BAY.w / 2 - 20, 0, -t / 2], cylinder({ radius: 5.1, height: 3.2, segments: 24 }))
  return subtract(union(plate, lip), ...holes, magnet)
}

/* ---------- panel corner bracket (print 4) ---------- */
const bracket = (p) => {
  const t = 4
  const L = 50
  const lip = p.panelT + 2 // wraps over the panel frame edge
  const base = cuboid({ size: [L, L, t] })
  const wallX = translate([-(L / 2 - t / 2), 0, lip / 2 + t / 2], cuboid({ size: [t, L, lip] }))
  const wallY = translate([0, -(L / 2 - t / 2), lip / 2 + t / 2], cuboid({ size: [L, t, lip] }))
  const top = translate([-(L / 2 - 7), -(L / 2 - 7), lip + t / 2 + t / 2], cuboid({ size: [14, 14, t] }))
  const hole = translate([8, 8, 0], cylinder({ radius: 3.3, height: 10, segments: 20 })) // M6 to arm
  return subtract(union(base, wallX, wallY, top), hole)
}

/* ---------- tilted panel arm ---------- */
const arm = (p) => {
  const t = 8
  const span = Math.min(p.panelW - 60, 240) // printable length (<= 250 mm bed)
  const beam = cuboid({ size: [span, 30, t] })
  const cross = cuboid({ size: [30, span, t] })
  const hub = translate([0, 0, -t], cuboid({ size: [44, 44, t] }))
  const endHoles = [
    [span / 2 - 10, 0],
    [-(span / 2 - 10), 0],
    [0, span / 2 - 10],
    [0, -(span / 2 - 10)]
  ].map(([x, y]) => translate([x, y, 0], cylinder({ radius: 3.3, height: 20, segments: 20 })))
  const hubHoles = [
    [12, 12],
    [-12, 12],
    [12, -12],
    [-12, -12]
  ].map(([x, y]) => translate([x, y, -t], cylinder({ radius: 2.8, height: 20, segments: 20 })))
  const body = rotateY((p.tilt * Math.PI) / 180, union(beam, cross))
  return subtract(union(body, hub), ...endHoles.map((h) => rotateY((p.tilt * Math.PI) / 180, h)), ...hubHoles)
}

/* ---------- lamp mount + photodiode hood ---------- */
const ledMount = (p) => {
  const reach = 180 // arm length from the pole face
  const armBar = translate([reach / 2, 0, 0], cuboid({ size: [reach, 26, 10] }))
  // flat pad the 10 W 12 V IP65 lamp's own bracket bolts to (2 x M6, 50 mm apart)
  const pad = translate([reach, 0, -2], cuboid({ size: [90, 64, 14] }))
  const lampBolts = [-25, 25].map((y) => translate([reach + 15, y, -2], cylinder({ radius: 3.3, height: 30, segments: 20 })))
  // M12 IP68 panel-mount socket: the lamp plugs in here, so a swap needs no wiring
  const cableHole = translate([reach - 25, 0, -2], cylinder({ radius: 6.25, height: 30, segments: 32 }))
  // photodiode hood: short tube angled at the lamp's own light pool
  const hood = translate([reach - 55, 0, -14], rotateY((20 * Math.PI) / 180, subtract(
    cylinder({ radius: 7, height: 26, segments: 32 }),
    cylinder({ radius: 4.2, height: 28, segments: 32 })
  )))
  const clampPlate = translate([0, 0, 0], cuboid({ size: [10, 60, 40] }))
  const plateHoles = [-18, 18].map((y) => translate([0, y, 0], rotateY(Math.PI / 2, cylinder({ radius: 3, height: 20, segments: 20 }))))
  return subtract(union(armBar, pad, hood, clampPlate), ...lampBolts, cableHole, ...plateHoles)
}

/* ---------- assembly preview ---------- */
const assembly = (p) => {
  const rOut = p.poleD / 2 + 22
  const pole = colorize([0.25, 0.25, 0.3], translate([0, 0, -300], cylinder({ radius: p.poleD / 2, height: 900, segments: SEG })))
  const c = colorize([0.55, 0.36, 0.96], collar(p))
  const jaws = [0, 1, 2].map((i) => colorize([0.65, 0.55, 0.98], rotateZ((i * 2 * Math.PI) / 3, jaw(p))))
  const a = colorize([0.55, 0.36, 0.96], translate([0, 0, 25 + 8 + 4], arm(p)))
  const panel = colorize(
    [0.1, 0.08, 0.2],
    translate([0, 0, 25 + 8 + 4 + 4 + p.panelT / 2], rotateY((p.tilt * Math.PI) / 180, cuboid({ size: [p.panelL, p.panelW, p.panelT] })))
  )
  const b = colorize([0.8, 0.8, 0.85], rotateZ(Math.PI / 3, translate([rOut + 12 + BAY.d / 2 + 6, 0, -BAY.h / 2], rotateZ(Math.PI / 2, bay(p)))))
  const led = colorize([0.9, 0.9, 0.95], rotateZ(Math.PI, translate([rOut, 0, -80], ledMount(p))))
  return [pole, c, ...jaws, a, panel, b, led]
}

const main = (params) => {
  const p = Object.assign({}, ...getParameterDefinitions().map((d) => ({ [d.name]: d.initial })), params)
  switch (p.part) {
    case 'collar':
      return collar(p)
    case 'jaw':
      return jaw(p)
    case 'bay':
      return bay(p)
    case 'lid':
      return lid(p)
    case 'bracket':
      return bracket(p)
    case 'arm':
      return arm(p)
    case 'ledMount':
      return ledMount(p)
    default:
      return assembly(p)
  }
}

module.exports = { main, getParameterDefinitions }
