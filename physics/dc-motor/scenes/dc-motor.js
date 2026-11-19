// Scene module: How a DC motor works (AQA GCSE Physics 8463, 4.7.2).
// All geometry is procedural. Three set-ups share one stage:
//   wire      a straight current-carrying wire through a card, with field
//             rings and plotting compasses (4.7.2.1, everyone)
//   solenoid  a coil of wire with an optional iron core (4.7.2.1, everyone)
//   motor     a simple DC motor: magnets, coil, split-ring commutator,
//             brushes and supply (4.7.2.2 and 4.7.2.3, Higher tier)
//
// Coordinates: Y up. Motor axle = Z, +Z towards the commutator end (front).
// Physics (directions, forces, the coil's motion) comes from dc-motor.model.js.
import {
  TAU, motorTurnsPerSecond, forceSize, turnDirection, sideCurrent, sideForce,
  turningEffect, compassDirection, createCoilKinematics,
} from './dc-motor.model.js';

const C = {
  copper: 0xc87a4a,
  field: 0x8c90f0,
  current: 0xffb347,
  force: 0x4ade80,
  north: 0xd64541,
  south: 0x3d6fd6,
  steel: 0xb8c0ca,
  iron: 0x6a7079,
  card: 0xe9edf3,
};

// Motor dimensions (scene units, illustrative)
const COIL_R = 0.55;      // half-width of the coil (axle to each side)
const COIL_L = 0.75;      // half-length of the sides along the axle
const COMM_Z = 1.2;       // commutator centre
const COMM_R = 0.16;
const MAGNET_X = 1.35;

// Stage behaviour, by 0-based stage index (see dc-motor.stages.json).
const STAGES = [
  { setup: 'wire', view: { position: [2.9, 2.6, 3.6], target: [0, 0.15, 0] } },
  { setup: 'solenoid', view: { position: [1.0, 2.1, 5.6], target: [0, 0.05, 0] } },
  { setup: 'motor', field: true, view: { position: [2.6, 2.8, 4.6], target: [0, -0.2, 0.2] } },
  { setup: 'motor', field: true, current: true, view: { position: [2.2, 2.9, 4.4], target: [0, -0.3, 0.4] } },
  { setup: 'motor', field: true, current: true, force: true, fleming: true, view: { position: [2.0, 3.0, 3.7], target: [0, 0, 0.1] } },
  { setup: 'motor', field: true, current: true, force: true, spin: true, readout: true, view: { position: [2.6, 2.9, 4.6], target: [0, -0.2, 0.3] } },
  { setup: 'motor', field: true, current: true, force: true, spin: true, readout: true, commutatorStage: true, view: { position: [1.8, 2.6, 4.2], target: [0, -0.1, 0.6] } },
];

let ctx = null;
const parts = {};
const disposables = [];
const opts = {
  current: 2,          // wire and solenoid current (A, illustrative; sign = direction)
  ironCore: false,
  motorCurrent: 2,     // motor current (A, illustrative)
  turns: 3,
  reverseCurrent: false,
  flipMagnets: false,
  commutator: true,
  fieldLines: true,
};
let stageIndex = 0;
let lastT = 0;
const kin = createCoilKinematics();
let needleAngles = null; // smoothed compass needle angles (UI transition)

const track = (...items) => { disposables.push(...items); return items[0]; };
const fx = () => STAGES[stageIndex] || STAGES[0];
const currentDir = () => (opts.reverseCurrent ? -1 : 1);
const fieldDir = () => (opts.flipMagnets ? -1 : 1);
const motorOpts = () => ({
  current: opts.motorCurrent, turns: opts.turns, currentDir: currentDir(), fieldDir: fieldDir(), commutator: opts.commutator,
});

// ---- Helpers ----------------------------------------------------------------
function basic(THREE, colour, opacity = 1) {
  return track(new THREE.MeshBasicMaterial({ color: colour, transparent: opacity < 1, opacity, side: THREE.DoubleSide, depthWrite: opacity >= 1 }));
}

function std(THREE, colour, metalness = 0.4, roughness = 0.45, extra = {}) {
  return track(new THREE.MeshStandardMaterial({ color: colour, metalness, roughness, ...extra }));
}

// Arrow along local +Y from the origin; setArrow() points and sizes it.
function makeArrow(THREE, mat, shaftR = 0.028, headR = 0.075, headL = 0.18) {
  const g = new THREE.Group();
  const shaftGeo = track(new THREE.CylinderGeometry(shaftR, shaftR, 1, 12));
  shaftGeo.translate(0, 0.5, 0);
  const headGeo = track(new THREE.ConeGeometry(headR, headL, 16));
  headGeo.translate(0, headL / 2, 0);
  const shaft = new THREE.Mesh(shaftGeo, mat);
  const head = new THREE.Mesh(headGeo, mat);
  g.add(shaft, head);
  g.userData = { shaft, head, headL };
  return g;
}

const Y_AXIS = { x: 0, y: 1, z: 0 };
function setArrow(THREE, arrow, dir, length) {
  const { shaft, head, headL } = arrow.userData;
  const len = Math.max(length, headL + 0.02);
  shaft.scale.y = len - headL;
  head.position.y = len - headL;
  const d = new THREE.Vector3(dir.x, dir.y, dir.z).normalize();
  arrow.quaternion.setFromUnitVectors(new THREE.Vector3(Y_AXIS.x, Y_AXIS.y, Y_AXIS.z), d);
}

function tube(THREE, points, radius, mat, closed = false, segments = 64) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), closed, 'centripetal');
  const geo = track(new THREE.TubeGeometry(curve, segments, radius, 8, closed));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.curve = curve;
  return mesh;
}

function polylineTube(THREE, points, radius, mat) {
  const path = new THREE.CurvePath();
  for (let i = 0; i < points.length - 1; i++) {
    path.add(new THREE.LineCurve3(new THREE.Vector3(...points[i]), new THREE.Vector3(...points[i + 1])));
  }
  const geo = track(new THREE.TubeGeometry(path, 24 * (points.length - 1), radius, 8, false));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.curve = path;
  return mesh;
}

function anchor(THREE, parent, name, pos, normal) {
  const a = new THREE.Object3D();
  a.name = `label-${name}`;
  a.position.set(...pos);
  if (normal) a.userData.normal = normal;
  parent.add(a);
  return a;
}

// ---- Lights ------------------------------------------------------------------
function buildLights(THREE, quality) {
  const group = new THREE.Group();
  group.add(new THREE.HemisphereLight(0xdfe8ff, 0x1a2238, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(4, 6, 5);
  key.castShadow = quality > 0;
  key.shadow.mapSize.set(1024, 1024);
  const fill = new THREE.DirectionalLight(0xb9c8ff, 0.5);
  fill.position.set(-5, 2, -3);
  group.add(key, fill);
  return { group, key };
}

// ---- Wire set-up (4.7.2.1) ------------------------------------------------------
const RING_RADII = [0.3, 0.48, 0.74, 1.1, 1.6];
const COMPASS_SPOTS = [];
for (let k = 0; k < 8; k++) COMPASS_SPOTS.push({ r: 0.75, a: (k / 8) * TAU + TAU / 16 });
for (let k = 0; k < 8; k++) COMPASS_SPOTS.push({ r: 1.55, a: (k / 8) * TAU });

function buildWire(THREE, m) {
  const group = new THREE.Group();
  group.name = 'wire-setup';

  const card = new THREE.Mesh(track(new THREE.BoxGeometry(3.8, 0.03, 3.8)), m.card);
  card.receiveShadow = true;
  card.position.y = -0.015;
  const wire = new THREE.Mesh(track(new THREE.CylinderGeometry(0.05, 0.05, 3.0, 24)), m.copper);
  wire.position.y = 0.1;
  wire.castShadow = true;

  // Field rings, each with four arrowheads; spacing grows with distance.
  const rings = RING_RADII.map((r) => {
    const g = new THREE.Group();
    const torus = new THREE.Mesh(track(new THREE.TorusGeometry(r, 0.011, 8, 96)), m.fieldLine);
    torus.rotation.x = Math.PI / 2;
    g.add(torus);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * TAU + 0.4;
      const cone = new THREE.Mesh(track(new THREE.ConeGeometry(0.045, 0.12, 12)), m.fieldLine);
      // Tangent for anticlockwise from above (current up): (−sin a, 0, −cos a).
      cone.position.set(r * Math.cos(a), 0, -r * Math.sin(a));
      const tangent = new THREE.Vector3(-Math.sin(a), 0, -Math.cos(a));
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
      g.add(cone);
    }
    g.position.y = 0.02;
    group.add(g);
    return g;
  });

  // Plotting compasses: an inner and an outer ring of them.
  const needleN = new THREE.ConeGeometry(0.035, 0.13, 10);
  needleN.rotateZ(-Math.PI / 2);
  needleN.translate(0.065, 0, 0);
  const needleS = needleN.clone();
  needleS.rotateZ(Math.PI);
  track(needleN, needleS);
  const caseGeo = track(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 28));
  const compasses = COMPASS_SPOTS.map(({ r, a }) => {
    const g = new THREE.Group();
    g.position.set(r * Math.cos(a), 0.02, -r * Math.sin(a));
    const body = new THREE.Mesh(caseGeo, m.compassCase);
    const needle = new THREE.Group();
    needle.add(new THREE.Mesh(needleN, m.needleN), new THREE.Mesh(needleS, m.needleS));
    needle.position.y = 0.035;
    g.add(body, needle);
    group.add(g);
    return { g, needle, x: g.position.x, z: g.position.z };
  });

  // Current: small glowing beads moving along the wire.
  const beads = [];
  const beadGeo = track(new THREE.SphereGeometry(0.035, 12, 8));
  for (let i = 0; i < 9; i++) {
    const b = new THREE.Mesh(beadGeo, m.currentGlow);
    group.add(b);
    beads.push(b);
  }

  group.add(card, wire);
  const anchors = {
    wire: anchor(THREE, group, 'wire', [0.05, 1.35, 0]),
    compass: anchor(THREE, group, 'compass', [compasses[8].x + 0.08, 0.06, compasses[8].z]),
    card: anchor(THREE, group, 'card', [1.6, 0, 1.6]),
  };
  return { group, rings, compasses, beads, anchors };
}

// ---- Solenoid set-up (4.7.2.1) --------------------------------------------------
const SOL_HALF = 1.0;
const SOL_R = 0.5;
const SOL_TURNS = 10;

function solenoidLoop(h, k) {
  // A closed field line in the XY plane: straight through the coil at height h,
  // then out round the outside like a bar magnet's field.
  const H = 0.78 + 1.1 * h + 0.12 * k;
  return [
    [-1.3, h, 0], [-0.4, h, 0], [0.4, h, 0], [1.3, h, 0],
    [1.75 + 0.12 * k, h + 0.35, 0], [1.45 + 0.1 * k, H, 0], [0, H + 0.08, 0],
    [-1.45 - 0.1 * k, H, 0], [-1.75 - 0.12 * k, h + 0.35, 0],
  ];
}

function buildSolenoid(THREE, m) {
  const group = new THREE.Group();
  group.name = 'solenoid-setup';
  const helix = new THREE.Curve();
  helix.getPoint = (u, target = new THREE.Vector3()) => {
    const x = -SOL_HALF + 2 * SOL_HALF * u;
    const a = TAU * SOL_TURNS * u;
    return target.set(x, SOL_R * Math.sin(a), SOL_R * Math.cos(a));
  };
  const coil = new THREE.Mesh(track(new THREE.TubeGeometry(helix, 600, 0.035, 8, false)), m.copper);
  coil.castShadow = true;
  const leadL = polylineTube(THREE, [[-SOL_HALF, 0, SOL_R], [-SOL_HALF - 0.1, -0.6, SOL_R], [-SOL_HALF - 0.1, -1.05, 0.4]], 0.03, m.copper);
  const endP = helix.getPoint(1);
  const leadR = polylineTube(THREE, [[endP.x, endP.y, endP.z], [SOL_HALF + 0.1, -0.6, SOL_R], [SOL_HALF + 0.1, -1.05, 0.4]], 0.03, m.copper);
  const core = new THREE.Mesh(track(new THREE.CylinderGeometry(0.32, 0.32, 2.5, 32)), m.iron);
  core.rotation.z = Math.PI / 2;
  core.castShadow = true;

  // Field lines: four planes round the axis, two loops each; two extra loops
  // per plane appear with the iron core (a stronger field).
  const lines = [];
  for (let p = 0; p < 4; p++) {
    for (const [h, k, extra] of [[0.12, 0, false], [0.3, 1, false], [0.06, 2, true], [0.22, 3, true]]) {
      const loop = tube(THREE, solenoidLoop(h, k), 0.01, m.fieldLine, true, 160);
      const arrows = new THREE.Group();
      for (const u of [0.06, 0.3, 0.6]) {
        const cone = new THREE.Mesh(track(new THREE.ConeGeometry(0.045, 0.12, 12)), m.fieldLine);
        cone.position.copy(loop.userData.curve.getPointAt(u));
        cone.userData.tangent = loop.userData.curve.getTangentAt(u);
        arrows.add(cone);
      }
      const g = new THREE.Group();
      g.add(loop, arrows);
      g.rotation.x = (p / 4) * TAU + TAU / 8;
      g.userData = { arrows, extra };
      group.add(g);
      lines.push(g);
    }
  }
  const beads = [];
  const beadGeo = track(new THREE.SphereGeometry(0.035, 12, 8));
  for (let i = 0; i < 24; i++) {
    const b = new THREE.Mesh(beadGeo, m.currentGlow);
    group.add(b);
    beads.push(b);
  }
  group.add(coil, leadL, leadR, core);
  const poleA = anchor(THREE, group, 'pole-a', [1.55, 0.05, 0]);
  const poleB = anchor(THREE, group, 'pole-b', [-1.55, 0.05, 0]);
  poleA.userData.label = 'N';
  poleB.userData.label = 'S';
  poleA.userData.labelAlways = true;
  poleB.userData.labelAlways = true;
  poleA.userData.labelClass = 'aim-label-pole';
  poleB.userData.labelClass = 'aim-label-pole';
  const anchors = {
    solenoid: anchor(THREE, group, 'solenoid', [0.3, SOL_R + 0.05, 0.1]),
    // On the core itself, so the label hides with it. Core local +Y = world −X.
    ironCore: anchor(THREE, core, 'iron-core', [0.32, 1.25, 0]),
    poleA, poleB,
  };
  return { group, coil, core, lines, beads, helix, anchors };
}

// ---- Motor set-up (4.7.2.2, 4.7.2.3) --------------------------------------------
function buildMotor(THREE, m) {
  const group = new THREE.Group();
  group.name = 'motor-setup';

  // Magnets: left and right of the coil. Colours and letters swap when flipped.
  const magGeo = track(new THREE.BoxGeometry(0.45, 1.3, 1.7));
  const magL = new THREE.Mesh(magGeo, m.north);
  const magR = new THREE.Mesh(magGeo, m.south);
  magL.position.set(-MAGNET_X, 0, 0);
  magR.position.set(MAGNET_X, 0, 0);
  magL.castShadow = magR.castShadow = true;

  // Field lines straight across the gap, with arrowheads (N to S).
  const field = new THREE.Group();
  for (const y of [-0.5, -0.17, 0.17, 0.5]) {
    for (const z of [-0.6, 0, 0.6]) {
      const line = new THREE.Mesh(track(new THREE.CylinderGeometry(0.009, 0.009, 2 * MAGNET_X - 0.5, 6)), m.fieldLine);
      line.rotation.z = Math.PI / 2;
      line.position.set(0, y, z);
      const cone = new THREE.Mesh(track(new THREE.ConeGeometry(0.04, 0.11, 10)), m.fieldLine);
      cone.rotation.z = -Math.PI / 2; // points +X
      cone.position.set(z === 0 ? 0.75 : -0.75, y, z);
      field.add(line, cone);
    }
  }

  // Rotating assembly: coil (several turns), leads, commutator halves, axle.
  const rotor = new THREE.Group();
  rotor.name = 'coil-assembly';
  const coilTurns = [];
  for (let k = 0; k < 5; k++) {
    const o = (k - 2) * 0.028;
    const loop = polylineTube(THREE, [
      [COIL_R, o, COIL_L], [COIL_R, o, -COIL_L], [-COIL_R, o, -COIL_L], [-COIL_R, o, COIL_L],
    ], 0.028, m.copper);
    loop.castShadow = true;
    rotor.add(loop);
    coilTurns.push(loop);
  }
  const leadA = polylineTube(THREE, [[COIL_R, 0, COIL_L], [COIL_R * 0.4, 0, COIL_L + 0.12], [COMM_R * 0.8, 0, COMM_Z - 0.12]], 0.026, m.copper);
  const leadB = polylineTube(THREE, [[-COIL_R, 0, COIL_L], [-COIL_R * 0.4, 0, COIL_L + 0.12], [-COMM_R * 0.8, 0, COMM_Z - 0.12]], 0.026, m.copper);
  // Split ring: two half-cylinders centred on local ±X, gaps on local ±Y
  // (the coil plane's normal), so the current reverses when the coil is vertical.
  const gap = 0.24;
  const halfGeo = track(new THREE.CylinderGeometry(COMM_R, COMM_R, 0.3, 32, 1, true, gap / 2, Math.PI - gap));
  halfGeo.rotateX(Math.PI / 2);
  // After rotateX the arc (centred on +X) runs along the axle, gaps at ±Y.
  const halfA = new THREE.Mesh(halfGeo, m.brass);
  halfA.position.z = COMM_Z;
  const halfB = halfA.clone();
  halfB.rotation.z = Math.PI;
  const axle = new THREE.Mesh(track(new THREE.CylinderGeometry(0.05, 0.05, 3.0, 16)), m.steel);
  axle.rotation.x = Math.PI / 2;
  axle.position.z = 0.25;
  const insulator = new THREE.Mesh(track(new THREE.CylinderGeometry(COMM_R * 0.92, COMM_R * 0.92, 0.3, 24)), m.insulator);
  insulator.rotation.x = Math.PI / 2;
  insulator.position.z = COMM_Z;
  rotor.add(leadA, leadB, insulator, halfA, halfB, axle);

  // Current arrows on the coil sides (child of the rotor) and force arrows (world).
  const curArrows = [1, -1].map((side) => {
    const a = makeArrow(THREE, m.currentArrow, 0.02, 0.06, 0.14);
    a.position.set(side * COIL_R, 0.13, 0);
    rotor.add(a);
    return a;
  });
  const forceArrows = [1, -1].map(() => {
    const a = makeArrow(THREE, m.forceArrow, 0.035, 0.09, 0.2);
    group.add(a);
    return a;
  });

  // Fleming's left-hand rule triad, drawn at side A (stage "A force on each side").
  const fleming = new THREE.Group();
  const fField = makeArrow(THREE, m.fieldArrow, 0.02, 0.06, 0.14);
  const fCurrent = makeArrow(THREE, m.currentArrow, 0.02, 0.06, 0.14);
  const fForce = makeArrow(THREE, m.forceArrow, 0.02, 0.06, 0.14);
  fleming.add(fField, fCurrent, fForce);
  group.add(fleming);

  // Brushes (fixed, either side of the commutator) and the supply.
  const brushGeo = track(new THREE.BoxGeometry(0.2, 0.12, 0.16));
  const brushL = new THREE.Mesh(brushGeo, m.carbon);
  const brushR = new THREE.Mesh(brushGeo, m.carbon);
  brushL.position.set(-(COMM_R + 0.1), 0, COMM_Z);
  brushR.position.set(COMM_R + 0.1, 0, COMM_Z);
  const battery = new THREE.Group();
  const cell = new THREE.Mesh(track(new THREE.CylinderGeometry(0.17, 0.17, 0.9, 24)), m.cell);
  cell.rotation.z = Math.PI / 2;
  const cap = new THREE.Mesh(track(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 16)), m.steel);
  cap.rotation.z = Math.PI / 2;
  cap.position.x = -0.49; // + terminal on the left: feeds the left brush
  battery.add(cell, cap);
  battery.position.set(0, -1.0, COMM_Z);
  const wirePathL = [[-(COMM_R + 0.2), 0, COMM_Z], [-0.75, 0, COMM_Z], [-0.75, -1.0, COMM_Z], [-0.53, -1.0, COMM_Z]];
  const wirePathR = [[0.45, -1.0, COMM_Z], [0.75, -1.0, COMM_Z], [0.75, 0, COMM_Z], [COMM_R + 0.2, 0, COMM_Z]];
  const wireL = polylineTube(THREE, wirePathL, 0.022, m.leadWire);
  const wireR = polylineTube(THREE, wirePathR, 0.022, m.leadWire);
  // Current beads in the supply wires (from + terminal round to − terminal).
  const beads = [];
  const beadGeo = track(new THREE.SphereGeometry(0.032, 12, 8));
  for (let i = 0; i < 14; i++) {
    const b = new THREE.Mesh(beadGeo, m.currentGlow);
    group.add(b);
    beads.push(b);
  }

  group.add(magL, magR, field, rotor, brushL, brushR, battery, wireL, wireR);

  const magLLabel = anchor(THREE, magL, 'magnet-left', [0, 0.95, 0.4]);
  const magRLabel = anchor(THREE, magR, 'magnet-right', [0, 0.95, 0.4]);
  magLLabel.userData.label = 'N';
  magRLabel.userData.label = 'S';
  magLLabel.userData.labelAlways = magRLabel.userData.labelAlways = true;
  magLLabel.userData.labelClass = magRLabel.userData.labelClass = 'aim-label-pole';
  const flemField = anchor(THREE, fleming, 'fleming-field', [0.62, 0, 0]);
  const flemCurrent = anchor(THREE, fleming, 'fleming-current', [0, 0, 0.62]);
  const flemForce = anchor(THREE, fleming, 'fleming-force', [0, 0.66, 0]);
  const anchors = {
    magnetLeft: magLLabel,
    magnetRight: magRLabel,
    coil: anchor(THREE, rotor, 'coil', [-COIL_R, 0.05, -COIL_L * 0.6]),
    commutator: anchor(THREE, rotor, 'commutator', [0, COMM_R, COMM_Z + 0.1]),
    brush: anchor(THREE, group, 'brush', [COMM_R + 0.2, 0.08, COMM_Z]),
    supply: anchor(THREE, battery, 'supply', [0.2, -0.18, 0.1]),
    flemingField: flemField,
    flemingCurrent: flemCurrent,
    flemingForce: flemForce,
  };
  return {
    group, magL, magR, field, rotor, coilTurns, curArrows, forceArrows, fleming,
    fField, fCurrent, fForce, beads, wirePaths: [wireL.userData.curve, wireR.userData.curve],
    brushes: [brushL, brushR], halves: [halfA, halfB], anchors,
  };
}

// ---- Readout (2D overlay) ---------------------------------------------------------
function buildReadout(overlay) {
  if (!overlay) return null;
  const box = document.createElement('div');
  box.className = 'aim-dc-readout';
  box.setAttribute('aria-hidden', 'true'); // live visual; the stage text carries the explanation
  const line1 = document.createElement('p');
  const line2 = document.createElement('p');
  line2.className = 'aim-dc-readout-note';
  box.append(line1, line2);
  overlay.append(box);
  return { box, line1, line2 };
}

// ---- Scene interface ----------------------------------------------------------------
function updateMotion() {
  const f = fx();
  if (f.setup !== 'motor') return;
  if (!f.spin) {
    kin.hold(0, lastT); // coil horizontal: the sides cut across the field
    return;
  }
  const dir = turnDirection(currentDir(), fieldDir());
  if (opts.commutator || !f.commutatorStage) {
    kin.set('spin', lastT, { omega: dir * TAU * motorTurnsPerSecond(opts.motorCurrent, opts.turns), dir });
  } else {
    kin.set('rock', lastT, { dir: currentDir() * fieldDir() });
  }
}

let materials = null;
let readout = null;
let uiTexts = {};

export default {
  id: 'dc-motor',

  init(context) {
    ctx = context;
    const { THREE, root, quality, scene, overlay } = context;
    scene.environmentIntensity = 0.5;
    materials = {
      copper: std(THREE, C.copper, 0.9, 0.3),
      steel: std(THREE, C.steel, 1.0, 0.25),
      iron: std(THREE, C.iron, 0.6, 0.5),
      brass: std(THREE, 0xd4a64a, 0.95, 0.28),
      carbon: std(THREE, 0x2b2d33, 0.2, 0.8),
      insulator: std(THREE, 0x3a3f4a, 0.1, 0.7),
      cell: std(THREE, 0x2f3542, 0.3, 0.5),
      leadWire: std(THREE, 0xd94848, 0.3, 0.5),
      north: std(THREE, C.north, 0.25, 0.5),
      south: std(THREE, C.south, 0.25, 0.5),
      card: std(THREE, C.card, 0, 0.9, { transparent: true, opacity: 0.92 }),
      compassCase: std(THREE, 0xf4f6fa, 0.1, 0.4),
      needleN: std(THREE, C.north, 0.2, 0.4),
      needleS: std(THREE, 0xf4f6fa, 0.2, 0.4),
      fieldLine: basic(THREE, C.field, 0.75),
      fieldArrow: basic(THREE, C.field),
      currentArrow: basic(THREE, C.current),
      currentGlow: basic(THREE, 0xffd28a),
      forceArrow: basic(THREE, C.force),
    };
    const lights = buildLights(THREE, quality);
    const wire = buildWire(THREE, materials);
    const solenoid = buildSolenoid(THREE, materials);
    const motor = buildMotor(THREE, materials);
    root.add(lights.group, wire.group, solenoid.group, motor.group);
    Object.assign(parts, { lights, wire, solenoid, motor });
    readout = buildReadout(overlay);

    const first = STAGES[0].view;
    return {
      defaultView: first,
      labelAnchors: { ...wire.anchors, ...solenoid.anchors, ...motor.anchors },
      cameraTour: [
        { position: [0.2, 0.4, 5.2], target: [0, 0, 0.2], move: 2.5, hold: 2.0 },
        { position: [1.2, 1.1, 2.9], target: [0, 0, 1.1], move: 2.5, hold: 2.5 },
        { position: [-3.4, 2.2, 3.2], target: [0, 0, 0], move: 3.0, hold: 2.0 },
        { position: [2.6, 1.8, 4.6], target: [0, -0.1, 0.3], move: 3.0, hold: 0.5 },
      ],
    };
  },

  update(t, state) {
    lastT = t;
    const { THREE } = ctx;
    const f = fx();
    const { wire, solenoid, motor } = parts;
    const linesOn = opts.fieldLines;
    wire.group.visible = f.setup === 'wire';
    solenoid.group.visible = f.setup === 'solenoid';
    motor.group.visible = f.setup === 'motor';

    if (f.setup === 'wire') {
      const I = opts.current;
      const s = Math.abs(I);
      // More current: more rings show, and they are brighter. Rings further
      // out are fainter: the field is weaker further from the wire.
      wire.rings.forEach((g, k) => {
        g.visible = linesOn && s > 0.05 && k < Math.ceil(s * 1.67);
        g.scale.z = I >= 0 ? 1 : -1; // reverses the circulation
      });
      materials.fieldLine.opacity = Math.min(0.9, 0.35 + 0.18 * s);
      // Compass needles turn smoothly (UI transition) towards the field direction.
      const target = wire.compasses.map((c) => {
        const d = compassDirection(I, c.x, c.z);
        return Math.atan2(-d.z, d.x);
      });
      if (!needleAngles) needleAngles = target.slice();
      const k = Math.min(1, (state?.uiDt || 0) * 4);
      wire.compasses.forEach((c, i) => {
        let diff = target[i] - needleAngles[i];
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        needleAngles[i] += state?.uiDt ? diff * k : diff;
        c.needle.rotation.y = needleAngles[i];
      });
      // Beads move up the wire for positive current.
      const span = 2.8;
      wire.beads.forEach((b, i) => {
        b.visible = s > 0.05;
        const u = (((i / wire.beads.length) + Math.sign(I) * t * 0.12 * s) % 1 + 1) % 1;
        b.position.set(0, -1.3 + u * span, 0);
      });
    }

    if (f.setup === 'solenoid') {
      const I = opts.current;
      const s = Math.abs(I);
      solenoid.core.visible = opts.ironCore;
      materials.fieldLine.opacity = Math.min(0.95, (opts.ironCore ? 0.55 : 0.3) + 0.12 * s);
      const sign = I >= 0 ? 1 : -1;
      solenoid.lines.forEach((g) => {
        g.visible = linesOn && s > 0.05 && (!g.userData.extra || opts.ironCore || s > 2.4);
        for (const cone of g.userData.arrows.children) {
          const tng = cone.userData.tangent.clone().multiplyScalar(sign);
          cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tng);
        }
      });
      // Poles: field leaves the N end. Positive current: N at +X.
      solenoid.anchors.poleA.userData.label = s > 0.05 ? (sign > 0 ? 'N' : 'S') : '';
      solenoid.anchors.poleB.userData.label = s > 0.05 ? (sign > 0 ? 'S' : 'N') : '';
      const p = new THREE.Vector3();
      solenoid.beads.forEach((b, i) => {
        b.visible = s > 0.05;
        const u = (((i / solenoid.beads.length) + sign * t * 0.02 * s) % 1 + 1) % 1;
        solenoid.helix.getPoint(u, p);
        b.position.copy(p);
      });
    }

    if (f.setup === 'motor') {
      const o = motorOpts();
      const theta = kin.angle(t);
      motor.rotor.rotation.z = theta;
      // One turn in the static stages; the turns slider shows from "The coil turns".
      motor.coilTurns.forEach((c, k) => { c.visible = k < (f.spin ? opts.turns : 1); });
      // Magnets: flipping swaps which side is N.
      const fd = fieldDir();
      motor.magL.material = fd > 0 ? materials.north : materials.south;
      motor.magR.material = fd > 0 ? materials.south : materials.north;
      motor.anchors.magnetLeft.userData.label = fd > 0 ? 'N' : 'S';
      motor.anchors.magnetRight.userData.label = fd > 0 ? 'S' : 'N';
      motor.field.visible = !!f.field && linesOn;
      // Fewer labels while Fleming's rule is shown, so its three labels can be read.
      for (const k of ['commutator', 'brush', 'supply']) motor.anchors[k].visible = !f.fleming;
      motor.field.scale.x = fd;
      materials.fieldLine.opacity = 0.7;

      // Current in the coil sides (after the commutator, if fitted).
      const sc = sideCurrent(theta, o.currentDir, o.commutator || !f.commutatorStage);
      const commOn = o.commutator || !f.commutatorStage;
      motor.curArrows.forEach((a, k) => {
        a.visible = !!f.current;
        const dirZ = (k === 0 ? 1 : -1) * sc;
        setArrow(THREE, a, { x: 0, y: 0, z: dirZ }, 0.5);
        a.position.z = -0.25 * dirZ;
      });
      // Force arrows on each side, in world space: vertical, ∝ current × turns.
      const force = sideForce(theta, { ...o, commutator: commOn });
      const size = forceSize(o.current, o.turns);
      const len = 0.3 + 0.06 * size; // arrows not to scale
      motor.forceArrows.forEach((a, k) => {
        const sideSign = k === 0 ? 1 : -1;
        a.visible = !!f.force && size > 0;
        a.position.set(sideSign * COIL_R * Math.cos(theta), sideSign * COIL_R * Math.sin(theta), 0);
        setArrow(THREE, a, { x: 0, y: sideSign * Math.sign(force || 1), z: 0 }, len);
      });

      // Fleming's left-hand rule at side A: First finger field, seCond finger
      // current, thuMb force (motion).
      motor.fleming.visible = !!f.fleming;
      if (f.fleming) {
        motor.fleming.position.set(COIL_R * Math.cos(theta), COIL_R * Math.sin(theta), COIL_L * 0.55);
        setArrow(THREE, motor.fField, { x: fd, y: 0, z: 0 }, 0.55);
        setArrow(THREE, motor.fCurrent, { x: 0, y: 0, z: sc }, 0.55);
        setArrow(THREE, motor.fForce, { x: 0, y: Math.sign(force || 1), z: 0 }, 0.6);
        motor.anchors.flemingField.position.set(0.66 * fd, 0, 0);
        motor.anchors.flemingCurrent.position.set(0, 0, 0.66 * sc);
        motor.anchors.flemingForce.position.set(0, 0.7 * Math.sign(force || 1), 0);
      }

      // Current beads in the supply wires: + terminal → left brush … right brush → − terminal.
      const p = new THREE.Vector3();
      const n = motor.beads.length;
      motor.beads.forEach((b, i) => {
        b.visible = !!f.current;
        const half = i < n / 2 ? 0 : 1;
        const u0 = (i % (n / 2)) / (n / 2);
        const flow = o.currentDir * t * 0.18 * Math.min(3, o.current);
        // Both wire paths are drawn against the current's direction
        // (left: brush → + terminal; right: − terminal → brush), so run them backwards.
        const u = 1 - (((u0 + flow) % 1 + 1) % 1);
        motor.wirePaths[half].getPointAt(u, p);
        b.position.copy(p);
      });

      if (readout) {
        readout.box.hidden = !f.readout;
        if (f.readout) {
          const turning = turningEffect(theta, { ...o, commutator: commOn });
          const dirWord = turning > 0.02 ? uiTexts.anticlockwise : turning < -0.02 ? uiTexts.clockwise : uiTexts.noTurning;
          readout.line1.textContent = `${uiTexts.forceLabel || 'Force on each side'}: ${size.toFixed(1)} (${uiTexts.forceRule || 'current × turns'})`;
          readout.line2.textContent = f.commutatorStage
            ? (commOn ? uiTexts.commOn : uiTexts.commOff) || ''
            : `${uiTexts.turning || 'Turning'}: ${dirWord || ''} · ${uiTexts.notToScale || 'arrows not to scale'}`;
        }
      }
    } else if (readout) {
      readout.box.hidden = true;
    }
  },

  setStage(n, stage, data) {
    const prev = fx();
    stageIndex = n;
    uiTexts = data?.ui || {};
    const f = fx();
    if (f.setup !== 'wire') needleAngles = null;
    updateMotion();
    if (ctx?.view && f.view) {
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
        || document.documentElement.classList.contains('a11y-reduce-motion');
      const snap = reduce || prev.setup !== f.setup || n === 0;
      ctx.view.setDefault(f.view, snap);
      if (!snap) ctx.view.flyTo(f.view, 1.2);
    }
  },

  setOption(name, value) {
    if (name in opts) opts[name] = value;
    if (['motorCurrent', 'turns', 'reverseCurrent', 'flipMagnets', 'commutator'].includes(name)) updateMotion();
    if (name === 'quality' && parts.lights) parts.lights.key.castShadow = value > 0;
  },

  // Values for automated tests (angles in radians).
  debugState(t) {
    const theta = kin.angle(t);
    const o = motorOpts();
    const commOn = o.commutator || !fx().commutatorStage;
    return {
      t,
      stage: stageIndex,
      setup: fx().setup,
      options: { ...opts },
      coilAngle: parts.motor.rotor.rotation.z,
      coilMode: kin.mode,
      coilVelocity: kin.velocity(t),
      sideCurrent: sideCurrent(theta, o.currentDir, commOn),
      sideForce: sideForce(theta, { ...o, commutator: commOn }),
      turningEffect: turningEffect(theta, { ...o, commutator: commOn }),
      wireRingsVisible: parts.wire.rings.filter((g) => g.visible).length,
      needleAngles: needleAngles ? needleAngles.slice() : null,
      solenoidLinesVisible: parts.solenoid.lines.filter((g) => g.visible).length,
      ironCore: parts.solenoid.core.visible,
    };
  },

  dispose() {
    for (const d of disposables) d.dispose?.();
    disposables.length = 0;
    ctx?.overlay?.replaceChildren();
    ctx?.root.clear();
    ctx = null;
  },
};
