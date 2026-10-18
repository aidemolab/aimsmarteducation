// Scene module: Inside an Induction Motor.
// All geometry is procedural. Simplified two-pole, three-phase machine:
// 24 stator slots (60° phase belts), 20-bar squirrel-cage rotor.
//
// Coordinates: motor axis = Z, front (drive end) = +Z. Angles are measured
// anticlockwise when viewed from the front, from +X.
//
// Physics quantities come from induction-motor.model.js; the 2D chart, dial
// and readouts from induction-motor.overlay.js.
import {
  phaseCurrents, fieldVector, supplyPhase, barCurrent, torque,
  createRotorKinematics, DEFAULT_SLIP,
} from './induction-motor.model.js';
import { createOverlay } from './induction-motor.overlay.js';

const DEG = Math.PI / 180;

// ---- Dimensions (scene units, illustrative proportions) -------------------
const STACK_L = 2.0;            // stator and rotor core length
const LAM_PITCH = 0.04;         // one lamination + gap
const LAM_THICK = 0.032;
const STATOR_R_OUT = 1.22;
const STATOR_R_BORE = 0.64;
const SLOTS = 24;
const SLOT_W = 0.08;
const SLOT_BOTTOM = 0.86;
const COND_R = 0.765;           // radius of slot conductor centre
const ROTOR_R = 0.60;
const BARS = 20;
const BAR_R = 0.044;
const BAR_C = 0.575;            // bar centre radius (bars stand slightly proud)
const SHAFT_R = 0.13;
const HOUSING_R_IN = 1.24;
const HOUSING_R_OUT = 1.32;
const HOUSING_HALF_L = 1.45;

// Winding axes: phase A at 0°, B at 120°, C at 240°.
export const PHASES = [
  // labelAt: position along the front end-turn for the label anchor (outside the cutaway).
  { key: 'A', axis: 0, colour: 0xe0453a, layerR: 0.70, labelAt: 0.5 },
  { key: 'B', axis: 120, colour: 0xf2c230, layerR: 0.84, labelAt: 0.5 },
  { key: 'C', axis: 240, colour: 0x3d8beb, layerR: 0.98, labelAt: 0.85 },
];

// Cutaway: a wedge between these angles is removed. Housing: full length.
// Stator and windings: only the front part (z > CUT_Z), giving a stepped section.
const CUT_FROM = -10 * DEG;
const CUT_TO = 100 * DEG;
const CUT_Z = -0.15;

let ctx = null;
const parts = {};
const disposables = [];

const polar = (THREE, r, a) => new THREE.Vector2(r * Math.cos(a), r * Math.sin(a));

function track(...items) {
  disposables.push(...items);
  return items[0];
}

// ---- Materials ------------------------------------------------------------
function makeMaterials(THREE) {
  const wedge = [
    new THREE.Plane(new THREE.Vector3(Math.sin(CUT_FROM), -Math.cos(CUT_FROM), 0), 0),
    new THREE.Plane(new THREE.Vector3(-Math.sin(CUT_TO), Math.cos(CUT_TO), 0), 0),
  ];
  const housingPlanes = wedge;
  const statorPlanes = [...wedge, new THREE.Plane(new THREE.Vector3(0, 0, -1), CUT_Z)];

  const clipped = (mat, planes) => {
    mat.userData.cutPlanes = planes;
    mat.clippingPlanes = planes;
    mat.clipIntersection = true;
    mat.side = THREE.DoubleSide;
    return mat;
  };

  const m = {
    housing: clipped(new THREE.MeshStandardMaterial({ color: 0xa9adb3, metalness: 0.6, roughness: 0.42 }), housingPlanes),
    housingDark: clipped(new THREE.MeshStandardMaterial({ color: 0x3e444d, metalness: 0.6, roughness: 0.55 }), housingPlanes),
    statorLam: clipped(new THREE.MeshStandardMaterial({ color: 0x6a7079, metalness: 0.55, roughness: 0.45 }), statorPlanes),
    slotCopper: clipped(new THREE.MeshStandardMaterial({ color: 0xc87a4a, metalness: 0.95, roughness: 0.3 }), statorPlanes),
    coilCopper: clipped(new THREE.MeshStandardMaterial({ color: 0xc87a4a, metalness: 0.95, roughness: 0.28 }), statorPlanes),
    rotorLam: new THREE.MeshStandardMaterial({ color: 0x7a838f, metalness: 0.55, roughness: 0.45 }),
    bar: new THREE.MeshStandardMaterial({ color: 0xd9dde3, metalness: 0.9, roughness: 0.3 }),
    endRing: new THREE.MeshStandardMaterial({ color: 0xcfd4db, metalness: 0.9, roughness: 0.32 }),
    shaft: new THREE.MeshStandardMaterial({ color: 0xc3cad3, metalness: 1.0, roughness: 0.22 }),
    bearingRace: new THREE.MeshStandardMaterial({ color: 0xb8c0ca, metalness: 1.0, roughness: 0.18 }),
    bearingBall: new THREE.MeshStandardMaterial({ color: 0xe6eaef, metalness: 1.0, roughness: 0.12 }),
    phaseSleeve: PHASES.map((p) => clipped(new THREE.MeshPhysicalMaterial({
      color: p.colour, metalness: 0.1, roughness: 0.38, clearcoat: 0.8, clearcoatRoughness: 0.25,
    }), statorPlanes)),
  };
  track(...Object.values(m).flat());
  return m;
}

// ---- Stator ---------------------------------------------------------------
function statorLaminationShape(THREE) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, STATOR_R_OUT, 0, Math.PI * 2, false);

  // Inner contour: bore with open rectangular slots.
  const pts = [];
  const halfW = SLOT_W / 2;
  const boreHalf = Math.asin(halfW / STATOR_R_BORE);
  const rBoreEdge = Math.sqrt(STATOR_R_BORE ** 2 - halfW ** 2);
  for (let i = 0; i < SLOTS; i++) {
    const a = (i + 0.5) * (360 / SLOTS) * DEG;
    const next = (i + 1.5) * (360 / SLOTS) * DEG;
    const u = new THREE.Vector2(Math.cos(a), Math.sin(a));
    const v = new THREE.Vector2(-Math.sin(a), Math.cos(a));
    const side = (r, s) => u.clone().multiplyScalar(r).add(v.clone().multiplyScalar(s * halfW));
    pts.push(side(rBoreEdge, -1), side(SLOT_BOTTOM, -1), side(SLOT_BOTTOM, 1), side(rBoreEdge, 1));
    // Tooth tip arc to the next slot
    const a0 = a + boreHalf;
    const a1 = next - boreHalf;
    for (let k = 1; k < 4; k++) pts.push(polar(THREE, STATOR_R_BORE, a0 + (a1 - a0) * (k / 4)));
  }
  shape.holes.push(new THREE.Path(pts));
  return shape;
}

function buildStator(THREE, m) {
  const group = new THREE.Group();
  group.name = 'stator';

  const lamGeo = track(new THREE.ExtrudeGeometry(statorLaminationShape(THREE), {
    depth: LAM_THICK, bevelEnabled: false, curveSegments: 40,
  }));
  const count = Math.round(STACK_L / LAM_PITCH);
  const lams = new THREE.InstancedMesh(lamGeo, m.statorLam, count);
  const mat4 = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    mat4.makeTranslation(0, 0, -STACK_L / 2 + i * LAM_PITCH + (LAM_PITCH - LAM_THICK) / 2);
    lams.setMatrixAt(i, mat4);
  }
  lams.castShadow = lams.receiveShadow = true;
  lams.name = 'stator-laminations';
  group.add(lams);
  return { group, lams, lamCount: count };
}

// Slot index → phase and direction for a two-pole, 60° phase-belt winding.
// Belt centres: phase k "+" side at axis+90°, "−" side at axis+270°.
function slotAngle(i) { return (i + 0.5) * (360 / SLOTS) * DEG; }

// The four slots whose centres lie within ±30° of the belt centre, in ascending angle.
function beltSlots(centreDeg) {
  const out = [];
  for (let i = 0; i < SLOTS; i++) {
    const d = ((slotAngle(i) / DEG - centreDeg) % 360 + 540) % 360 - 180;
    if (Math.abs(d) < 30) out.push({ i, d });
  }
  return out.sort((a, b) => a.d - b.d).map((o) => o.i);
}

function buildWindings(THREE, m) {
  const group = new THREE.Group();
  group.name = 'windings';

  // Slot conductors (one instanced mesh, all copper).
  const condGeo = track(new THREE.BoxGeometry(0.066, 0.15, STACK_L + 0.08));
  const conductors = new THREE.InstancedMesh(condGeo, m.slotCopper, SLOTS);
  const mat4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const zAxis = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i < SLOTS; i++) {
    const a = slotAngle(i);
    q.setFromAxisAngle(zAxis, a - Math.PI / 2);
    mat4.compose(new THREE.Vector3(COND_R * Math.cos(a), COND_R * Math.sin(a), 0), q, new THREE.Vector3(1, 1, 1));
    conductors.setMatrixAt(i, mat4);
  }
  conductors.castShadow = conductors.receiveShadow = true;
  conductors.name = 'slot-conductors';
  group.add(conductors);

  // End turns: concentric coils per phase, at both ends.
  const phaseGroups = [];
  const anchors = {};
  PHASES.forEach((phase, k) => {
    const pg = new THREE.Group();
    pg.name = `winding-${phase.key}`;
    const plus = beltSlots(phase.axis + 90);   // ascending angle
    const minus = beltSlots(phase.axis + 270);
    for (let j = 0; j < 4; j++) {
      // j = 0 is the shortest (innermost, lowest) coil.
      const a1 = slotAngle(plus[3 - j]);
      let a2 = slotAngle(minus[j]);
      while (a2 <= a1) a2 += Math.PI * 2;
      const h = 0.15 + j * 0.035;
      for (const end of [1, -1]) {
        const curve = endTurnCurve(THREE, a1, a2, phase.layerR, h, end);
        const copper = new THREE.Mesh(track(new THREE.TubeGeometry(curve, 72, 0.03, 8, false)), m.coilCopper);
        const sleeve = new THREE.Mesh(track(new THREE.TubeGeometry(subCurve(THREE, curve, 0.2, 0.8), 56, 0.036, 8, false)), m.phaseSleeve[k]);
        copper.castShadow = sleeve.castShadow = true;
        copper.receiveShadow = sleeve.receiveShadow = true;
        pg.add(copper, sleeve);
        if (end === 1 && j === 3) {
          const anchor = new THREE.Object3D();
          anchor.position.copy(curve.getPoint(phase.labelAt));
          anchor.name = `anchor-winding-${phase.key}`;
          anchor.userData.normal = [0, 0, 1];
          pg.add(anchor);
          anchors[`winding${phase.key}`] = anchor;
        }
      }
    }
    group.add(pg);
    phaseGroups.push(pg);
  });

  return { group, conductors, phaseGroups, anchors };
}

// End-turn path: leaves slot at a1, moves to its layer radius, rises to
// height h above the stack end, runs round to a2 and returns into the slot.
function endTurnCurve(THREE, a1, a2, layerR, h, end) {
  const zBase = STACK_L / 2;
  const P = (r, a, dz) => new THREE.Vector3(r * Math.cos(a), r * Math.sin(a), end * (zBase + dz));
  const pts = [P(COND_R, a1, -0.02), P(COND_R, a1, 0.05), P(layerR, a1, 0.1), P(layerR, a1 + 6 * DEG, h - 0.02)];
  const n = 10;
  for (let i = 0; i <= n; i++) {
    const a = a1 + 12 * DEG + (a2 - a1 - 24 * DEG) * (i / n);
    pts.push(P(layerR, a, h));
  }
  pts.push(P(layerR, a2 - 6 * DEG, h - 0.02), P(layerR, a2, 0.1), P(COND_R, a2, 0.05), P(COND_R, a2, -0.02));
  return new THREE.CatmullRomCurve3(pts, false, 'centripetal');
}

function subCurve(THREE, curve, from, to) {
  const pts = [];
  for (let i = 0; i <= 24; i++) pts.push(curve.getPointAt(from + (to - from) * (i / 24)));
  return new THREE.CatmullRomCurve3(pts, false, 'centripetal');
}

// ---- Rotor ----------------------------------------------------------------
function rotorLaminationShape(THREE) {
  // Outer contour with semicircular open slots for the bars.
  const notchR = BAR_R + 0.003;
  const cosPhi = (ROTOR_R ** 2 + BAR_C ** 2 - notchR ** 2) / (2 * ROTOR_R * BAR_C);
  const phi = Math.acos(cosPhi);
  const pts = [];
  for (let i = 0; i < BARS; i++) {
    const b = (i / BARS) * Math.PI * 2;
    const bNext = ((i + 1) / BARS) * Math.PI * 2;
    const C = polar(THREE, BAR_C, b);
    const pIn = polar(THREE, ROTOR_R, b - phi);
    const pOut = polar(THREE, ROTOR_R, b + phi);
    let s = Math.atan2(pIn.y - C.y, pIn.x - C.x);
    let e = Math.atan2(pOut.y - C.y, pOut.x - C.x);
    // Go round the inner side of the notch (clockwise about C).
    while (e > s) e -= Math.PI * 2;
    for (let k = 0; k <= 8; k++) {
      const t = s + (e - s) * (k / 8);
      pts.push(new THREE.Vector2(C.x + notchR * Math.cos(t), C.y + notchR * Math.sin(t)));
    }
    const a0 = b + phi;
    const a1 = bNext - phi;
    for (let k = 1; k < 5; k++) pts.push(polar(THREE, ROTOR_R, a0 + (a1 - a0) * (k / 5)));
  }
  const shape = new THREE.Shape(pts);
  const hole = new THREE.Path();
  hole.absarc(0, 0, SHAFT_R + 0.002, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  return shape;
}

function buildRotor(THREE, m) {
  const group = new THREE.Group();
  group.name = 'rotor';
  const mat4 = new THREE.Matrix4();

  const lamGeo = track(new THREE.ExtrudeGeometry(rotorLaminationShape(THREE), {
    depth: LAM_THICK, bevelEnabled: false, curveSegments: 24,
  }));
  const count = Math.round(STACK_L / LAM_PITCH);
  const lams = new THREE.InstancedMesh(lamGeo, m.rotorLam, count);
  for (let i = 0; i < count; i++) {
    mat4.makeTranslation(0, 0, -STACK_L / 2 + i * LAM_PITCH + (LAM_PITCH - LAM_THICK) / 2);
    lams.setMatrixAt(i, mat4);
  }
  lams.castShadow = lams.receiveShadow = true;
  lams.name = 'rotor-laminations';

  const barLen = STACK_L + 0.12;
  const barGeo = track(new THREE.CylinderGeometry(BAR_R, BAR_R, barLen, 14, 1));
  barGeo.rotateX(Math.PI / 2);
  const bars = new THREE.InstancedMesh(barGeo, m.bar, BARS);
  for (let i = 0; i < BARS; i++) {
    const b = (i / BARS) * Math.PI * 2;
    mat4.makeTranslation(BAR_C * Math.cos(b), BAR_C * Math.sin(b), 0);
    bars.setMatrixAt(i, mat4);
  }
  // Instance colours start white (no tint); stages 4–5 tint bars to show induced current.
  const white = new THREE.Color(1, 1, 1);
  for (let i = 0; i < BARS; i++) bars.setColorAt(i, white);
  bars.castShadow = bars.receiveShadow = true;
  bars.name = 'rotor-bars';

  // End rings (short-circuit the bars at each end).
  const ringProfile = [
    [0.47, 0], [0.625, 0], [0.632, 0.01], [0.632, 0.07], [0.625, 0.08], [0.47, 0.08], [0.47, 0],
  ].map(([r, z]) => new THREE.Vector2(r, z));
  const ringGeo = track(new THREE.LatheGeometry(ringProfile, 72));
  ringGeo.rotateX(Math.PI / 2); // lathe height (+Y) → +Z
  const rings = [];
  for (const end of [1, -1]) {
    const ring = new THREE.Mesh(ringGeo, m.endRing);
    ring.scale.z = end; // mirror for the back ring so both sit outside the stack
    ring.position.z = end * (STACK_L / 2 + 0.02);
    ring.castShadow = ring.receiveShadow = true;
    ring.name = end > 0 ? 'end-ring-front' : 'end-ring-back';
    rings.push(ring);
  }

  group.add(lams, bars, ...rings);
  return { group, lams, bars, rings };
}

// ---- Shaft and bearings ---------------------------------------------------
function buildShaft(THREE, m) {
  const zBack = -1.9;
  const zFront = 2.55;
  const profile = [
    [0, zBack], [SHAFT_R - 0.015, zBack], [SHAFT_R, zBack + 0.015],
    [SHAFT_R, zFront - 0.015], [SHAFT_R - 0.015, zFront], [0, zFront],
  ].map(([r, z]) => new THREE.Vector2(r, z));
  const geo = track(new THREE.LatheGeometry(profile, 40));
  geo.rotateX(Math.PI / 2); // lathe height (+Y) → +Z
  const shaft = new THREE.Mesh(geo, m.shaft);
  shaft.castShadow = shaft.receiveShadow = true;
  shaft.name = 'shaft';

  // Key on the output end.
  const key = new THREE.Mesh(track(new THREE.BoxGeometry(0.06, 0.04, 0.5)), m.shaft);
  key.position.set(0, SHAFT_R + 0.01, 2.15);
  key.castShadow = true;
  return { shaft, key };
}

function buildBearing(THREE, m, z) {
  const group = new THREE.Group();
  group.name = z > 0 ? 'bearing-front' : 'bearing-back';
  const w = 0.12;
  const race = (rIn, rOut) => {
    const prof = [[rIn, -w / 2], [rOut, -w / 2], [rOut, w / 2], [rIn, w / 2], [rIn, -w / 2]]
      .map(([r, y]) => new THREE.Vector2(r, y));
    const g = track(new THREE.LatheGeometry(prof, 48));
    g.rotateX(Math.PI / 2);
    const mesh = new THREE.Mesh(g, m.bearingRace);
    mesh.castShadow = mesh.receiveShadow = true;
    return mesh;
  };
  const inner = race(SHAFT_R, 0.165);
  const outer = race(0.225, 0.27);
  const ballGeo = track(new THREE.SphereGeometry(0.03, 14, 10));
  const nBalls = 10;
  const balls = new THREE.InstancedMesh(ballGeo, m.bearingBall, nBalls);
  const mat4 = new THREE.Matrix4();
  for (let i = 0; i < nBalls; i++) {
    const a = (i / nBalls) * Math.PI * 2;
    mat4.makeTranslation(0.195 * Math.cos(a), 0.195 * Math.sin(a), 0);
    balls.setMatrixAt(i, mat4);
  }
  balls.castShadow = true;
  group.add(inner, outer, balls);
  group.position.z = z;
  return { group, inner, balls };
}

// ---- Housing and end shields ----------------------------------------------
function buildHousing(THREE, m) {
  const group = new THREE.Group();
  group.name = 'housing';
  const L = HOUSING_HALF_L;

  const shellProfile = [
    [HOUSING_R_IN, -L], [HOUSING_R_OUT - 0.01, -L], [HOUSING_R_OUT, -L + 0.01],
    [HOUSING_R_OUT, L - 0.01], [HOUSING_R_OUT - 0.01, L], [HOUSING_R_IN, L], [HOUSING_R_IN, -L],
  ].map(([r, z]) => new THREE.Vector2(r, z));
  const shellGeo = track(new THREE.LatheGeometry(shellProfile, 96));
  shellGeo.rotateX(Math.PI / 2);
  const shell = new THREE.Mesh(shellGeo, m.housing);
  shell.castShadow = shell.receiveShadow = true;
  shell.name = 'housing-shell';

  // Cooling fins (instanced), leaving the underside clear for the feet.
  const finGeo = track(new THREE.BoxGeometry(0.03, 0.11, 2 * L - 0.12));
  const finAngles = [];
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const d = Math.abs(((a / DEG - 270) % 360 + 540) % 360 - 180);
    if (d > 35) finAngles.push(a);
  }
  const fins = new THREE.InstancedMesh(finGeo, m.housing, finAngles.length);
  const mat4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const zAxis = new THREE.Vector3(0, 0, 1);
  finAngles.forEach((a, i) => {
    q.setFromAxisAngle(zAxis, a - Math.PI / 2);
    const r = HOUSING_R_OUT + 0.05;
    mat4.compose(new THREE.Vector3(r * Math.cos(a), r * Math.sin(a), 0), q, new THREE.Vector3(1, 1, 1));
    fins.setMatrixAt(i, mat4);
  });
  fins.castShadow = fins.receiveShadow = true;
  fins.name = 'cooling-fins';

  // Mounting feet.
  // Pedestal top (y = -1.26) stays inside the shell wall, clear of the stator.
  const footGeo = track(new THREE.BoxGeometry(2.3, 0.16, 0.42));
  const feet = [-0.95, 0.95].map((z) => {
    const f = new THREE.Mesh(footGeo, m.housingDark);
    f.position.set(0, -1.55, z);
    f.castShadow = f.receiveShadow = true;
    return f;
  });
  const pedestalGeo = track(new THREE.BoxGeometry(0.8, 0.21, 0.42));
  const pedestals = [-0.95, 0.95].map((z) => {
    const p = new THREE.Mesh(pedestalGeo, m.housing);
    p.position.set(0, -1.365, z);
    p.castShadow = p.receiveShadow = true;
    return p;
  });

  // Terminal box (where the three-phase supply connects).
  const tb = new THREE.Group();
  tb.name = 'terminal-box';
  const box = new THREE.Mesh(track(new THREE.BoxGeometry(0.62, 0.3, 0.7)), m.housing);
  const lid = new THREE.Mesh(track(new THREE.BoxGeometry(0.66, 0.04, 0.74)), m.housingDark);
  lid.position.y = 0.17;
  const gland = new THREE.Mesh(track(new THREE.CylinderGeometry(0.07, 0.07, 0.14, 20)), m.housingDark);
  gland.rotation.z = Math.PI / 2;
  gland.position.set(0.38, 0, 0);
  box.castShadow = lid.castShadow = gland.castShadow = true;
  tb.add(box, lid, gland);
  const tbA = 140 * DEG;
  tb.position.set((HOUSING_R_OUT + 0.12) * Math.cos(tbA), (HOUSING_R_OUT + 0.12) * Math.sin(tbA), 0.3);
  tb.rotation.z = tbA - Math.PI / 2;

  group.add(shell, fins, ...feet, ...pedestals, tb);
  return { group, shell, fins, terminalBox: tb };
}

function buildEndShield(THREE, m, end) {
  const group = new THREE.Group();
  group.name = end > 0 ? 'end-shield-front' : 'end-shield-back';
  // Dished cover from the housing rim to the bearing hub.
  // Profile is (radius, outward distance from the housing end), closed loop.
  const profile = [
    [0.27, 0.02], [0.27, 0.2], [0.36, 0.2], [0.42, 0.16], [1.05, 0.1], [HOUSING_R_OUT, 0.08],
    [HOUSING_R_OUT, 0.0], [1.05, 0.02], [0.4, 0.08], [0.36, 0.02], [0.27, 0.02],
  ].map(([r, d]) => new THREE.Vector2(r, d));
  const geo = track(new THREE.LatheGeometry(profile, 96));
  geo.rotateX(Math.PI / 2); // lathe height (+Y) → +Z
  const shield = new THREE.Mesh(geo, m.housing);
  shield.scale.z = end;     // mirror for the back so the dish faces outwards
  shield.position.z = end * HOUSING_HALF_L;
  shield.castShadow = shield.receiveShadow = true;
  group.add(shield);
  return { group, shield };
}

// ---- Lighting -------------------------------------------------------------
function buildLights(THREE, quality) {
  const group = new THREE.Group();
  group.name = 'lights';
  const key = new THREE.DirectionalLight(0xfff2e2, 2.4);
  key.position.set(4, 6, 6);
  key.castShadow = quality > 0;
  key.shadow.mapSize.set(quality > 1 ? 2048 : 1024, quality > 1 ? 2048 : 1024);
  key.shadow.camera.left = -3.2; key.shadow.camera.right = 3.2;
  key.shadow.camera.top = 3.2; key.shadow.camera.bottom = -3.2;
  key.shadow.camera.near = 1; key.shadow.camera.far = 20;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  const rim = new THREE.DirectionalLight(0xa9c6ff, 1.1);
  rim.position.set(-5, 3, -5);
  const fill = new THREE.DirectionalLight(0xe6ecf5, 0.45);
  fill.position.set(-4, -2, 5);
  const hemi = new THREE.HemisphereLight(0xdfe6f0, 0x0a1020, 0.25);
  group.add(key, key.target, rim, fill, hemi);
  return { group, key };
}

// Label anchor. normal: outward direction of the surface (local), used to hide
// the label when that surface faces away from the camera.
function anchorAt(THREE, parent, name, x, y, z, normal) {
  const o = new THREE.Object3D();
  o.name = `anchor-${name}`;
  o.position.set(x, y, z);
  if (normal) o.userData.normal = normal;
  parent.add(o);
  return o;
}

// ---- Stage effects ---------------------------------------------------------
const FIELD_COLOUR = 0x7fe3ff;
const ROTOR_MARK_COLOUR = 0xb6ff5c;
const TORQUE_COLOUR = 0xffe08a;
const CURRENT_TOWARDS = [1.0, 0.63, 0.25];  // #ffa040, current towards the shaft end
const CURRENT_AWAY = [0.66, 0.55, 1.0];     // #a98bff, current away from the shaft end
const CURRENT_TOWARDS_TINT = [1.0, 0.42, 0.06]; // saturated tints applied to the bar metal
const CURRENT_AWAY_TINT = [0.5, 0.32, 1.0];
const HIGHLIGHT_COLOUR = 0xffb45e;

// What each stage shows (0-based stage index).
const STAGE_FX = [
  { supply: false, highlight: true },
  { supply: true, chart: true },
  { supply: true, chart: true, dial: true, field: true },
  { supply: true, chart: true, dial: true, field: true, fieldLinesDim: true, currents: true },
  { supply: true, chart: true, dial: true, field: true, fieldLinesDim: true, currents: true, slip: true },
];

function basicMat(THREE, colour, opacity = 1, additive = false) {
  return track(new THREE.MeshBasicMaterial({
    color: colour, transparent: opacity < 1 || additive, opacity, depthWrite: !additive,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: false,
  }));
}

// Rod along local +X from x0 to x1.
function rodX(THREE, x0, x1, radius, mat) {
  const g = track(new THREE.CylinderGeometry(radius, radius, x1 - x0, 12));
  g.rotateZ(-Math.PI / 2);
  const mesh = new THREE.Mesh(g, mat);
  mesh.position.x = (x0 + x1) / 2;
  return mesh;
}

// Cone pointing along +X, base at x.
function coneX(THREE, x, radius, length, mat) {
  const g = track(new THREE.ConeGeometry(radius, length, 16));
  g.rotateZ(-Math.PI / 2);
  const mesh = new THREE.Mesh(g, mat);
  mesh.position.x = x + length / 2;
  return mesh;
}

function arcCurve(THREE, r, a0, a1, z) {
  const pts = [];
  for (let i = 0; i <= 48; i++) {
    const a = a0 + (a1 - a0) * (i / 48);
    pts.push(new THREE.Vector3(r * Math.cos(a), r * Math.sin(a), z));
  }
  return new THREE.CatmullRomCurve3(pts);
}

// Points a cone (built along +Y) anticlockwise along a circle at angle a.
function placeArcHead(THREE, head, r, a, z) {
  head.position.set(r * Math.cos(a), r * Math.sin(a), z);
  head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-Math.sin(a), Math.cos(a), 0));
}

function buildEffects(THREE, rotor, rotating) {
  // Field: rotates as a whole with the field angle. Arrow and lines sit just in
  // front of the rotor end ring; pole glows sit in the air gap along the core.
  const field = new THREE.Group();
  field.name = 'field-effects';
  const zF = STACK_L / 2 + 0.2;
  const arrowMat = basicMat(THREE, FIELD_COLOUR, 0.95);
  const arrow = new THREE.Group();
  arrow.add(
    rodX(THREE, -0.58, -SHAFT_R - 0.04, 0.03, arrowMat), // split around the shaft
    rodX(THREE, SHAFT_R + 0.04, 0.46, 0.03, arrowMat),
    coneX(THREE, 0.46, 0.075, 0.17, arrowMat),
  );
  arrow.position.z = zF;
  arrow.name = 'field-arrow';

  const lineMat = basicMat(THREE, FIELD_COLOUR, 0.55, true);
  const lines = new THREE.Group();
  lines.name = 'field-lines';
  for (const off of [-0.45, -0.28, 0.28, 0.45]) {
    const half = Math.sqrt(0.6 ** 2 - off ** 2);
    const l = new THREE.Group();
    l.add(rodX(THREE, -half, half - 0.06, 0.011, lineMat), coneX(THREE, half - 0.06, 0.028, 0.07, lineMat));
    l.position.set(0, off, zF);
    lines.add(l);
  }

  const glowMat = track(new THREE.MeshBasicMaterial({
    color: FIELD_COLOUR, transparent: true, opacity: 0.32, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
  }));
  const poles = [0, Math.PI].map((centre) => {
    // CylinderGeometry angle θ maps to world angle θ − 90° after rotateX(+90°).
    const g = track(new THREE.CylinderGeometry(0.632, 0.632, STACK_L, 24, 1, true, centre + Math.PI / 2 - 28 * DEG, 56 * DEG));
    g.rotateX(Math.PI / 2);
    return new THREE.Mesh(g, glowMat);
  });

  // Direction-of-rotation arc, just ahead of the field arrow.
  const dirR = 1.1;
  const dirZ = HOUSING_HALF_L - 0.04;
  const dirMat = basicMat(THREE, FIELD_COLOUR, 0.85);
  const dirArc = new THREE.Mesh(track(new THREE.TubeGeometry(arcCurve(THREE, dirR, 12 * DEG, 70 * DEG, dirZ), 48, 0.022, 8)), dirMat);
  const dirHead = new THREE.Mesh(track(new THREE.ConeGeometry(0.06, 0.15, 16)), dirMat);
  placeArcHead(THREE, dirHead, dirR, 74 * DEG, dirZ);

  field.add(arrow, lines, ...poles, dirArc, dirHead);
  field.visible = false;

  // Bar currents: additive sleeves over the bars, coloured per instance.
  const barGlowGeo = track(new THREE.CylinderGeometry(BAR_R + 0.008, BAR_R + 0.008, STACK_L + 0.13, 14, 1));
  barGlowGeo.rotateX(Math.PI / 2);
  const barGlowMat = track(new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  }));
  const barGlow = new THREE.InstancedMesh(barGlowGeo, barGlowMat, BARS);
  const mat4 = new THREE.Matrix4();
  const black = new THREE.Color(0, 0, 0);
  for (let i = 0; i < BARS; i++) {
    const b = (i / BARS) * Math.PI * 2;
    mat4.makeTranslation(BAR_C * Math.cos(b), BAR_C * Math.sin(b), 0);
    barGlow.setMatrixAt(i, mat4);
    barGlow.setColorAt(i, black);
  }
  barGlow.name = 'bar-currents';
  barGlow.visible = false;
  rotor.group.add(barGlow);

  // Rotor-angle marker on the front of the rotor (turns with it).
  const markMat = basicMat(THREE, ROTOR_MARK_COLOUR);
  const rotorMark = new THREE.Group();
  rotorMark.name = 'rotor-marker';
  const markBar = new THREE.Mesh(track(new THREE.BoxGeometry(0.4, 0.05, 0.014)), markMat);
  markBar.position.x = 0.36;
  const markTip = new THREE.Mesh(track(new THREE.ConeGeometry(0.05, 0.1, 3)), markMat);
  markTip.rotation.z = -Math.PI / 2;
  markTip.position.x = 0.61;
  rotorMark.add(markBar, markTip);
  rotorMark.position.z = STACK_L / 2 + 0.115;
  rotorMark.visible = false;
  rotating.add(rotorMark);

  // Torque indicator: arc round the shaft whose length shows torque (fixed frame).
  const tqR = 0.36;
  const tqZ = STACK_L / 2 + 0.32;
  const tqStart = 200 * DEG;
  const tqSpan = 150 * DEG;
  const tqSegs = 60;
  const tqRadial = 8;
  const tqMat = basicMat(THREE, TORQUE_COLOUR, 0.95);
  const tqArc = new THREE.Mesh(track(new THREE.TubeGeometry(arcCurve(THREE, tqR, tqStart, tqStart + tqSpan, tqZ), tqSegs, 0.026, tqRadial)), tqMat);
  const tqHead = new THREE.Mesh(track(new THREE.ConeGeometry(0.065, 0.15, 16)), tqMat);
  const torqueGroup = new THREE.Group();
  torqueGroup.name = 'torque-indicator';
  torqueGroup.add(tqArc, tqHead);
  torqueGroup.visible = false;

  return {
    field, lineMat, barGlow, rotorMark, torqueGroup,
    setTorque(fraction) {
      const shown = Math.round(tqSegs * fraction);
      tqArc.geometry.setDrawRange(0, shown * tqRadial * 6);
      tqArc.visible = shown > 0;
      tqHead.visible = shown > 0;
      placeArcHead(THREE, tqHead, tqR, tqStart + tqSpan * (shown / tqSegs) + 3 * DEG, tqZ);
    },
  };
}

// ---- Scene state -------------------------------------------------------------
const kin = createRotorKinematics();
let stageIndex = 0;
let stageData = null;
let lastT = 0;
let rotorSpeed = 1 - DEFAULT_SLIP; // rotor speed / field speed
let overlay = null;
let captionShown = null;
let tmpColour = null; // THREE.Color, created in init
let barsTinted = false;

// Exploded view: axial offsets at full explosion, eased over EXPLODE_SECONDS of real time.
const EXPLODE_SECONDS = 1.2;
let explode = 0;
let explodeTarget = 0;
let explodeParts = [];

function fx() { return STAGE_FX[stageIndex] || STAGE_FX[0]; }

function highlightGroups(m) {
  return {
    stator: [m.statorLam],
    windings: [m.slotCopper, m.coilCopper, ...m.phaseSleeve],
    rotor: [m.rotorLam, m.bar, m.endRing],
    shaft: [m.shaft, m.bearingRace, m.bearingBall],
  };
}

function computeFrame(t) {
  const f = fx();
  const currents = f.supply ? phaseCurrents(t) : [0, 0, 0];
  const field = fieldVector(currents);
  const thetaR = kin.angle(t);
  const ratio = kin.ratio;
  const slip = f.supply ? 1 - ratio : 0;
  return { f, currents, field, thetaR, ratio, slip, phase: supplyPhase(t) };
}

// ---- Scene interface -------------------------------------------------------
export default {
  id: 'induction-motor',

  init(context) {
    ctx = context;
    const { THREE, root, quality, scene } = context;
    scene.environmentIntensity = 0.55;
    const m = makeMaterials(THREE);
    parts.materials = m;

    const lights = buildLights(THREE, quality);
    const housing = buildHousing(THREE, m);
    const shieldF = buildEndShield(THREE, m, 1);
    const shieldB = buildEndShield(THREE, m, -1);
    const stator = buildStator(THREE, m);
    const windings = buildWindings(THREE, m);
    const rotor = buildRotor(THREE, m);
    const { shaft, key } = buildShaft(THREE, m);
    const bearingF = buildBearing(THREE, m, HOUSING_HALF_L + 0.08);
    const bearingB = buildBearing(THREE, m, -(HOUSING_HALF_L + 0.08));

    // The rotating assembly turns as one: core, bars, end rings, shaft and key.
    // Bearings are shown fixed (simplification).
    const rotating = new THREE.Group();
    rotating.name = 'rotating-assembly';
    rotating.add(rotor.group, shaft, key);

    const effects = buildEffects(THREE, rotor, rotating);

    const motor = new THREE.Group();
    motor.name = 'motor';
    motor.add(housing.group, shieldF.group, shieldB.group, stator.group, windings.group,
      rotating, bearingF.group, bearingB.group, effects.field, effects.torqueGroup);
    root.add(lights.group, motor);

    Object.assign(parts, { lights, housing, shieldF, shieldB, stator, windings, rotor, rotating, motor, bearingF, bearingB, effects });
    parts.highlight = highlightGroups(m);
    explodeParts = [
      [housing.group, -2.4], [shieldB.group, -3.1], [bearingB.group, -2.9],
      [rotating, 2.1], [effects.torqueGroup, 2.1], [bearingF.group, 2.5], [shieldF.group, 2.9],
    ].map(([obj, dz]) => ({ obj, dz, z0: obj.position.z }));
    tmpColour = new THREE.Color();
    // In cutaway mode the front end shield is removed so the end windings show.
    shieldF.group.visible = false;

    overlay = context.overlay ? createOverlay(context.overlay, PHASES) : null;

    const a = 55 * DEG;
    const labelAnchors = {
      stator: anchorAt(THREE, stator.group, 'stator', STATOR_R_OUT * Math.cos(40 * DEG), STATOR_R_OUT * Math.sin(40 * DEG), -0.6, [Math.cos(40 * DEG), Math.sin(40 * DEG), 0]),
      rotor: anchorAt(THREE, rotor.group, 'rotor', 0.62 * Math.cos(a), 0.62 * Math.sin(a), 0.5, [Math.cos(a), Math.sin(a), 0]),
      rotorBars: anchorAt(THREE, rotor.group, 'rotor-bars', 0.62 * Math.cos(a + 0.4), 0.62 * Math.sin(a + 0.4), -0.05, [Math.cos(a + 0.4), Math.sin(a + 0.4), 0]),
      endRing: anchorAt(THREE, rotor.group, 'end-ring', 0.55 * Math.cos(a), 0.55 * Math.sin(a), STACK_L / 2 + 0.1, [0, 0, 1]),
      shaft: anchorAt(THREE, rotating, 'shaft', 0, SHAFT_R, 2.4),
      bearing: anchorAt(THREE, bearingF.group, 'bearing', 0.27, 0.0, 0.06, [0, 0, 1]),
      housing: anchorAt(THREE, housing.group, 'housing', 1.42 * Math.cos(-30 * DEG), 1.42 * Math.sin(-30 * DEG), -0.3, [Math.cos(-30 * DEG), Math.sin(-30 * DEG), 0]),
      ...windings.anchors,
    };
    parts.labelAnchors = labelAnchors;

    return {
      defaultView: { position: [4.6, 2.7, 5.6], target: [0, -0.05, 0.25] },
      labelAnchors,
      // Guided tour, from wherever the camera is: shaft end → windings → rotor cage →
      // laminations → rear → overview.
      cameraTour: [
        { position: [0.5, 0.6, 6.8], target: [0, 0, 0], move: 2.5, hold: 2.5 },
        { position: [2.0, 1.9, 3.6], target: [0, 0.15, 1.0], move: 2.5, hold: 2.5 },
        { position: [1.55, 1.25, 2.15], target: [0.2, 0.25, 0.45], move: 2.5, hold: 2.5 },
        { position: [2.05, 2.15, 0.9], target: [0.75, 0.55, -0.15], move: 2.5, hold: 2.5 },
        { position: [-5.2, 2.6, -4.8], target: [0, 0, 0], move: 3.0, hold: 2.0 },
        { position: [4.6, 2.7, 5.6], target: [0, -0.05, 0.25], move: 3.0, hold: 0.5 },
      ],
    };
  },

  update(t, state) {
    lastT = t;
    const { f, currents, field, thetaR, ratio, slip, phase } = computeFrame(t);
    const { materials: m, effects: e, rotating } = parts;
    const effectsOn = state?.options?.fieldEffects !== false;

    rotating.rotation.z = thetaR;

    // Exploded view (UI transition, driven by real frame time).
    if (explode !== explodeTarget) {
      const step = (state?.uiDt || 0) / EXPLODE_SECONDS;
      explode = explodeTarget > explode ? Math.min(explodeTarget, explode + step) : Math.max(explodeTarget, explode - step);
    }
    const ex = explode * explode * (3 - 2 * explode); // smoothstep
    for (const p of explodeParts) p.obj.position.z = p.z0 + p.dz * ex;

    // Field: direction comes only from the vector sum of the winding currents.
    e.field.visible = !!f.field && effectsOn;
    e.field.rotation.z = field.angle;
    e.lineMat.opacity = f.fieldLinesDim ? 0.25 : 0.55;

    // Emissive: stage-1 component highlight, otherwise winding glow ∝ |current|.
    const all = [m.statorLam, m.slotCopper, m.coilCopper, ...m.phaseSleeve, m.rotorLam, m.bar, m.endRing, m.shaft, m.bearingRace, m.bearingBall];
    for (const mat of all) mat.emissiveIntensity = 0;
    if (f.highlight && stageData?.highlights?.length) {
      const list = stageData.highlights;
      const idx = Math.floor(Math.max(t, 0) / 2.5) % list.length;
      const pulse = 0.18 + 0.22 * (0.5 - 0.5 * Math.cos((2 * Math.PI * t) / 1.25));
      for (const mat of parts.highlight[list[idx].part] || []) {
        mat.emissive.setHex(HIGHLIGHT_COLOUR);
        mat.emissiveIntensity = pulse;
      }
      if (captionShown !== list[idx].caption) {
        captionShown = list[idx].caption;
        overlay?.setCaption(captionShown);
      }
    } else if (f.supply) {
      const gain = f.currents ? 0.3 : 0.7;
      m.phaseSleeve.forEach((mat, k) => {
        mat.emissive.setHex(PHASES[k].colour);
        mat.emissiveIntensity = gain * Math.abs(currents[k]);
      });
    }

    // Induced bar currents (illustrative): I = g(s)·cos(θ_bar − θ_f).
    // Shown by tinting each bar towards its current colour, plus a soft glow.
    const bars = parts.rotor.bars;
    e.barGlow.visible = !!f.currents && effectsOn;
    if (e.barGlow.visible) {
      for (let i = 0; i < BARS; i++) {
        const I = barCurrent((i / BARS) * Math.PI * 2 + thetaR, field.angle, slip);
        const c = I >= 0 ? CURRENT_TOWARDS_TINT : CURRENT_AWAY_TINT;
        const w = Math.min(1, Math.abs(I) * 1.25);
        tmpColour.setRGB(1 + (c[0] - 1) * w, 1 + (c[1] - 1) * w, 1 + (c[2] - 1) * w);
        bars.setColorAt(i, tmpColour);
        const g = I >= 0 ? CURRENT_TOWARDS : CURRENT_AWAY;
        const s = Math.abs(I) ** 1.5 * 0.7;
        tmpColour.setRGB(g[0] * s, g[1] * s, g[2] * s);
        e.barGlow.setColorAt(i, tmpColour);
      }
      bars.instanceColor.needsUpdate = true;
      e.barGlow.instanceColor.needsUpdate = true;
      barsTinted = true;
    } else if (barsTinted) {
      tmpColour.setRGB(1, 1, 1);
      for (let i = 0; i < BARS; i++) bars.setColorAt(i, tmpColour);
      bars.instanceColor.needsUpdate = true;
      barsTinted = false;
    }

    // Slip stage: rotor marker and torque indicator.
    e.rotorMark.visible = !!f.slip;
    e.torqueGroup.visible = !!f.slip && effectsOn;
    if (f.slip) e.setTorque(torque(slip));

    overlay?.update({ phase, currents, field, rotorRatio: ratio, slip });
  },

  setStage(n, stage, data) {
    stageIndex = n;
    stageData = stage || null;
    const f = fx();
    kin.setRatio(f.supply ? rotorSpeed : 0, lastT);
    captionShown = null;
    if (overlay) {
      overlay.setText(data?.ui);
      overlay.setVisible({ chart: !!f.chart, dial: !!f.dial, readout: !!f.slip });
      overlay.setCaption('');
    }
  },

  setOption(name, value) {
    if (name === 'cutaway') {
      for (const mat of Object.values(parts.materials).flat()) {
        if (mat.userData.cutPlanes) mat.clippingPlanes = value ? mat.userData.cutPlanes : [];
      }
      parts.shieldF.group.visible = !value;
    }
    if (name === 'exploded') explodeTarget = value ? 1 : 0;
    if (name === 'rotorSpeed') {
      // Rotor speed as a fraction of field speed, limited to 0..1 (motoring only).
      rotorSpeed = Math.max(0, Math.min(1, value));
      if (fx().supply) kin.setRatio(rotorSpeed, lastT);
    }
    if (name === 'quality' && parts.lights) {
      parts.lights.key.castShadow = value > 0;
    }
  },

  // Values for automated tests (angles in radians), read from the rendered objects.
  debugState(t) {
    const { currents, field, ratio, slip, phase, thetaR } = computeFrame(t);
    let maxBarCurrent = 0;
    for (let i = 0; i < BARS; i++) {
      maxBarCurrent = Math.max(maxBarCurrent, Math.abs(barCurrent((i / BARS) * Math.PI * 2 + thetaR, field.angle, slip)));
    }
    return {
      torque: torque(slip),
      maxBarCurrent,
      torqueVisible: parts.effects.torqueGroup.visible && parts.effects.torqueGroup.children[0].visible,
      t,
      stage: stageIndex,
      currents,
      fieldAngle: field.angle,
      fieldMagnitude: field.magnitude,
      supplyPhase: phase,
      fieldObjectAngle: parts.effects.field.rotation.z,
      fieldVisible: parts.effects.field.visible,
      rotorAngle: parts.rotating.rotation.z,
      rotorRatio: ratio,
      slip,
      chartPhase: overlay ? Number(overlay.chart.dataset.phase) : null,
      explode,
      rotorZ: parts.rotating.position.z,
      housingZ: parts.housing.group.position.z,
      cutaway: !!parts.materials.statorLam.clippingPlanes.length,
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
