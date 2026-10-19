// Lines in 3D – meet, parallel or skew? Scene module (see shell/SCENE-INTERFACE.md).
//
// Coordinates: everything is built in maths coordinates (x, y, z) with z up,
// inside a group rotated by −90° about x. That rotation maps maths (x, y, z) to
// Three.js (x, z, −y): a proper rotation, so the axes stay right-handed.
//
// All motion is a pure function of simulation time t and the options: while
// playing, the parameters sweep back and forth with t; while paused, they come
// from the sliders. Values on screen are computed from the model.
import { LINES, pointAt, relate, closestPoints, multipleOf, fmtVec } from './maths-lines-3d.model.js';
import { colVec, vecLetter, methodSteps } from './maths-lines-3d.text.js';

const COLOURS = {
  L1: 0xffb38a, // L* 79 – lightest line; every line shown with it is 15–21 L* darker
  L2: 0x3d8ef0, // L* 59
  L3: 0x3faf74, // L* 64
  L4: 0xb47cff, // L* 63
  axis: 0x8a8fa3,
  positionVector: 0xf4f5f8,
  grid: 0x30344a,
  movingPoint: 0xffffff,
  gap: 0xb9bccb, // stage-text grey for the "Going further" segment
};
const AXIS_MIN = -1;
const AXIS_MAX = 5;
const LINE_HALF_LENGTH = 30; // lines run well beyond the visible region
const CENTRE = [2, 2, 2]; // middle of the axis box, used to centre long lines

// Play sweeps the parameter between the slider limits (spec: λ from −3 to 4).
const SWEEP = { min: -3, max: 4, period: 14 }; // period in seconds of simulation time
const sweep = (t) => {
  const mid = (SWEEP.min + SWEEP.max) / 2;
  const amp = (SWEEP.max - SWEEP.min) / 2;
  return mid - amp * Math.cos((2 * Math.PI * t) / SWEEP.period);
};
// Stage 4: method steps shown one at a time while playing (seconds per step).
const METHOD_STEP_SECONDS = 3;

// Maths coordinates → Three.js world coordinates (for camera views).
const toWorld = ([x, y, z]) => [x, z, -y];
const norm = (v) => { const l = Math.hypot(...v); return v.map((c) => c / l); };
const add = (a, b, k = 1) => a.map((c, i) => c + k * b[i]);
const view = (p, t) => ({ position: toWorld(p), target: toWorld(t) });

// Stage 5 views, from the exact closest points P and Q.
const CLOSEST = closestPoints(LINES.L1, LINES.L4);
const MEET = relate(LINES.L1, LINES.L2).point.map(Number);
const P = CLOSEST.P.map(Number);
const Q = CLOSEST.Q.map(Number);
const M = P.map((c, i) => (c + Q[i]) / 2);
const U = norm(Q.map((c, i) => c - P[i])); // along PQ: parallel to (−1, 2, 1)
// Start view: the camera sits on the line through P and Q, looking along
// (1, −2, −1), so P and Q project to the same screen point and the lines appear to cross.
const LOOK = [1, -2, -1];
const START_DISTANCE = 25; // keeps the moving point (λ from −3 to 4) in view, including on narrow phones
const crossingView = () => view(add(M, norm(LOOK), -START_DISTANCE), M);
// Reveal view: looking at right angles to PQ, so the gap shows at full length.
// Directions perpendicular to PQ: (2, 1, 0) and (1, −2, 5); mix them to look from slightly above.
const SIDE = norm(add(norm([2, 1, 0]).map((c) => c * 0.85), norm([1, -2, 5]), 0.5));
// Centre raised a little (still looking at right angles to PQ) so the moving point
// stays in view for λ from −3 to 4.
const SIDE_TARGET = add(M, [0, 0, 0.8]);
const sideView = () => view(add(SIDE_TARGET, SIDE, 16.5), SIDE_TARGET);

const STAGE_VIEWS = [
  view([13.5, 8, 8.5], [1.4, 1.6, 1.6]), // 1: point A and its position vector
  view([17.5, 10.5, 8.5], [2, 2, 1.9]), // 2: L1
  view([16, 9.5, 9.5], [1.6, 1.8, 1.4]), // 3: L1 and L3
  view([21.4, 11.7, 10.6], [2.2, 0.8, 0.2]), // 4: L1 and L2 (fits λ, μ from −3 to 4)
  null, // 5: crossing view, computed
];

// What each stage shows (spec: each stage shows only the lines it needs).
const STAGE_PARTS = [
  { lines: [], dirs: [], pos: ['L1'], points: ['A'], moving: [] },
  { lines: ['L1'], dirs: ['L1'], pos: ['L1'], points: ['A'], moving: ['P1'] },
  { lines: ['L1', 'L3'], dirs: ['L1', 'L3'], pos: [], points: ['A', 'C'], moving: ['P1'] },
  { lines: ['L1', 'L2'], dirs: ['L1', 'L2'], pos: [], points: ['meet'], moving: ['P1', 'P2'] },
  { lines: ['L1', 'L4'], dirs: ['L1', 'L4'], pos: [], points: [], moving: ['P1'] },
];

let ctx = null;
let THREE = null;
let world = null;
const parts = { grid: null, lines: {}, positionVectors: {}, directionVectors: {}, points: {}, moving: {}, gap: null };
const options = { grid: true, directionVectors: true, lambda: 0, mu: 0, revealed: false };
let stage = 0;
let firstStage = true;
let overlay = null; // { root, live: { key: { entries, value } }, steps }
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function material(colour) {
  // Unlit and not tone-mapped, so every line shows exactly its chosen colour
  // and the lightness differences between lines hold from any viewpoint.
  return new THREE.MeshBasicMaterial({ color: colour, toneMapped: false });
}

// Cylinder from p to q (maths coordinates).
function rod(p, q, radius, mat, radialSegments = 12) {
  const a = new THREE.Vector3(...p);
  const b = new THREE.Vector3(...q);
  const len = a.distanceTo(b);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, radialSegments, 1, false), mat);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return mesh;
}

// Arrow from p to q: shaft plus cone head whose tip is exactly at q.
function arrow(p, q, { radius, headLength, headRadius, mat }) {
  const a = new THREE.Vector3(...p);
  const b = new THREE.Vector3(...q);
  const dir = b.clone().sub(a);
  const len = dir.length();
  dir.normalize();
  const g = new THREE.Group();
  const shaftEnd = a.clone().addScaledVector(dir, Math.max(len - headLength, 0));
  g.add(rod(a.toArray(), shaftEnd.toArray(), radius, mat));
  const head = new THREE.Mesh(new THREE.ConeGeometry(headRadius, headLength, 20), mat);
  head.position.copy(shaftEnd).addScaledVector(dir, headLength / 2);
  head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  g.add(head);
  return g;
}

function anchor(parent, position, label, labelClass, always = false) {
  const o = new THREE.Object3D();
  o.position.set(...position);
  o.userData.label = label;
  if (labelClass) o.userData.labelClass = labelClass;
  if (always) o.userData.labelAlways = true;
  parent.add(o);
  return o;
}

function dot(position, colour, radius = 0.075) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 14), material(colour));
  m.position.set(...position);
  return m;
}

function buildAxes(anchors) {
  const mat = material(COLOURS.axis);
  const unit = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const names = ['x', 'y', 'z'];
  const end = AXIS_MAX + 0.8;
  const group = new THREE.Group();
  group.name = 'axes';
  world.add(group);
  unit.forEach((u, i) => {
    group.add(arrow(u.map((c) => c * AXIS_MIN), u.map((c) => c * end), { radius: 0.018, headLength: 0.28, headRadius: 0.075, mat }));
    anchors[`axis-${names[i]}`] = anchor(group, u.map((c) => c * (end + 0.3)), names[i], 'aim-label-axis', true);
    // Unit ticks every 1 from −1 to 5 (not at O), perpendicular to the axis.
    const across = i === 2 ? [1, 0, 0] : [0, 0, 1];
    for (let k = AXIS_MIN; k <= AXIS_MAX; k++) {
      if (k === 0) continue;
      const c = u.map((v) => v * k);
      group.add(rod(c.map((v, j) => v - across[j] * 0.09), c.map((v, j) => v + across[j] * 0.09), 0.012, mat, 6));
      const off = i === 2 ? [-0.32, 0, 0] : [0, 0, -0.3];
      anchors[`tick-${names[i]}${k}`] = anchor(group, c.map((v, j) => v + off[j]), k < 0 ? `−${-k}` : String(k), 'aim-label-tick', true);
    }
  });
  anchors.origin = anchor(group, [-0.25, -0.25, -0.25], 'O', 'aim-label-axis', true);
}

function buildGrid() {
  const pts = [];
  for (let k = AXIS_MIN; k <= AXIS_MAX; k++) {
    pts.push(k, AXIS_MIN, 0, k, AXIS_MAX, 0); // lines of constant x
    pts.push(AXIS_MIN, k, 0, AXIS_MAX, k, 0); // lines of constant y
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const grid = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: COLOURS.grid, toneMapped: false }));
  grid.name = 'grid';
  world.add(grid);
  return grid;
}

// Where along each line its name label sits (parameter value), chosen to keep
// labels clear of each other in the stages that show them together.
const LABEL_AT = { L1: 2.9, L2: 3.6, L3: 1.7, L4: 4.2 };

function buildLine(key, anchors) {
  const line = LINES[key];
  const mat = material(COLOURS[key]);
  const bLen = Math.hypot(...line.b);
  // Parameter of the point nearest the centre of the axis box, so the visible
  // middle of every line is in view and the ends are far outside it.
  const w = CENTRE.map((c, i) => c - line.a[i]);
  const p0 = (w[0] * line.b[0] + w[1] * line.b[1] + w[2] * line.b[2]) / (bLen * bLen);
  const dp = LINE_HALF_LENGTH / bLen;
  const g = new THREE.Group();
  g.name = `line-${key}`;
  g.add(rod(pointAt(line, p0 - dp), pointAt(line, p0 + dp), 0.03, mat));
  world.add(g);
  parts.lines[key] = g;
  anchors[`line-${key}`] = anchor(g, pointAt(line, LABEL_AT[key]), line.name, `aim-label-line aim-label-${key}`);

  // Position vector: arrow from O to a.
  const pv = arrow([0, 0, 0], line.a, { radius: 0.022, headLength: 0.22, headRadius: 0.07, mat: material(COLOURS.positionVector) });
  pv.name = `position-${key}`;
  world.add(pv);
  parts.positionVectors[key] = pv;

  // Direction vector: shorter, thicker arrow on the line, from a to a + b.
  const dv = arrow(line.a, pointAt(line, 1), { radius: 0.055, headLength: 0.3, headRadius: 0.12, mat });
  dv.name = `direction-${key}`;
  world.add(dv);
  parts.directionVectors[key] = dv;
}

// Dashed segment from p to q made of short rods (visible at any line width).
function dashed(p, q, mat, dash = 0.12, gap = 0.08) {
  const g = new THREE.Group();
  const len = Math.hypot(...q.map((c, i) => c - p[i]));
  const u = q.map((c, i) => (c - p[i]) / len);
  for (let s = 0; s < len; s += dash + gap) {
    const e = Math.min(s + dash, len);
    g.add(rod(add(p, u, s), add(p, u, e), 0.022, mat, 8));
  }
  return g;
}

// Moving values are shown to 2 d.p. with the same rounding as the slider
// readouts (toFixed, true minus sign, no "−0.00"). "exact" when the value is a
// whole number of hundredths (every slider step is), otherwise shown with ≈.
function fmtNum(x) {
  const s = Number(x).toFixed(2);
  const text = s === '-0.00' ? '0.00' : s.replace('-', '−');
  return { text, exact: Math.abs(x * 100 - Math.round(x * 100)) < 1e-7 };
}
function fmtPoint(v) {
  const f = v.map(fmtNum);
  const exact = f.every((x) => x.exact);
  return { text: `${exact ? '' : '≈ '}(${f.map((x) => x.text).join(', ')})`, entries: f.map((x) => x.text), exact };
}

// ---- Equation readout (HTML panel below the 3D view) ----

function el(tag, cls, children = []) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  for (const c of [].concat(children)) n.append(c);
  return n;
}

// "r = (x y z) = (a) + λ(b)" with a live left-hand column.
function liveEquation(key) {
  const l = LINES[key];
  const live = colVec(['', '', ''], 'mv-live');
  const value = el('span', 'ml-param-value');
  const sign = el('span', 'ml-sign', '=');
  const psign = el('span', 'ml-sign', '=');
  const row = el('div', `ml-row ml-row-${key}`, [
    el('span', `ml-line ml-line-${key}`, l.name), ' ', vecLetter('r'), ' ', sign, ' ', live, ' = ', colVec(l.a), ` + ${l.param} `, colVec(l.b),
  ]);
  // "λ = 1.50" for exact values, "λ ≈ 2.31" while the point moves continuously.
  const param = el('div', 'ml-param', [`${l.param} `, psign, ' ', value]);
  return { row, param, entries: [...live.children], value, sign, psign };
}

function buildOverlay(n) {
  const host = ctx.panel || ctx.overlay;
  if (!host) return;
  overlay?.root.remove();
  const root = el('div', 'ml-readout');
  root.setAttribute('aria-hidden', 'true'); // the same maths is in the stage text
  const live = {};
  let steps = null;
  if (n === 0) {
    root.append(el('div', 'ml-row', [vecLetter('a'), ' = ', colVec(LINES.L1.a)]));
  } else {
    const keys = n === 3 ? ['L1', 'L2'] : ['L1'];
    for (const k of keys) {
      const e = liveEquation(k);
      root.append(el('div', 'ml-block', [e.row, e.param])); // equation and its parameter together
      live[k] = e;
    }
    if (n === 2) {
      const k = multipleOf(LINES.L3.b, LINES.L1.b);
      root.append(el('div', 'ml-row ml-small', [el('span', 'ml-line ml-line-L3', LINES.L3.name), ' direction ', colVec(LINES.L3.b), ` = ${k} × `, colVec(LINES.L1.b)]));
    }
    if (n === 3) {
      steps = methodSteps('L1', 'L2', [0, 1, 2]).map((s) => el('div', `ml-step mv-step-${s.kind}`, s.parts));
      root.append(el('div', 'ml-method', steps));
    }
  }
  host.replaceChildren(root);
  overlay = { root, live, steps, last: {} };
}

function setText(node, text) { if (node.textContent !== text) node.textContent = text; }

// ---- Stage handling ----

function applyVisibility() {
  const sp = STAGE_PARTS[stage];
  for (const [k, g] of Object.entries(parts.lines)) g.visible = sp.lines.includes(k);
  for (const [k, g] of Object.entries(parts.directionVectors)) g.visible = options.directionVectors && sp.dirs.includes(k);
  for (const [k, g] of Object.entries(parts.positionVectors)) g.visible = sp.pos.includes(k);
  for (const [k, g] of Object.entries(parts.points)) g.visible = sp.points.includes(k);
  for (const [k, g] of Object.entries(parts.moving)) g.visible = sp.moving.includes(k);
  parts.grid.visible = options.grid;
  // Labels for direction vectors live inside the arrows' groups, so they follow.
}

function stageView(n) {
  return n === 4 ? crossingView() : STAGE_VIEWS[n];
}

export default {
  id: 'maths-lines-3d',

  init(context) {
    ctx = context;
    THREE = context.THREE;
    const { root, controls } = context;
    world = new THREE.Group();
    world.name = 'maths-world';
    world.rotation.x = -Math.PI / 2; // maths (x, y, z) → three (x, z, −y)
    root.add(world);

    controls.minDistance = 4;
    controls.maxDistance = 60; // narrow screens need the camera further back

    const anchors = {};
    parts.grid = buildGrid();
    buildAxes(anchors);
    for (const k of Object.keys(LINES)) buildLine(k, anchors);

    // Labels on vectors (computed from the data).
    anchors.vecA = anchor(parts.positionVectors.L1, LINES.L1.a.map((v) => v * 0.6), 'a', 'aim-label-vector aim-label-left');
    anchors.vecB = anchor(parts.directionVectors.L1, pointAt(LINES.L1, 0.8), 'b', 'aim-label-vector aim-label-L1');
    const k31 = multipleOf(LINES.L3.b, LINES.L1.b);
    anchors.vecB3 = anchor(parts.directionVectors.L3, pointAt(LINES.L3, 0.85), `${k31}b`, 'aim-label-vector aim-label-L3');

    // Fixed points: A on L₁, L₃'s point, and the meeting point of L₁ and L₂.
    const pA = dot(LINES.L1.a, COLOURS.positionVector);
    pA.userData.label = `A${fmtVec(LINES.L1.a)}`;
    pA.userData.labelClass = 'aim-label-point';
    anchors.pointA = pA;
    const pC = dot(LINES.L3.a, COLOURS.L3);
    pC.userData.label = fmtVec(LINES.L3.a);
    pC.userData.labelClass = 'aim-label-point';
    anchors.pointC = pC;
    const meet = relate(LINES.L1, LINES.L2);
    const pMeet = new THREE.Group();
    const meetPos = meet.point.map(Number);
    // The highlight ring is drawn by the label's marker (CSS), so it is always a
    // circle facing the viewer. (A 3D ring seen edge-on looked like stray marks.)
    pMeet.add(dot(meetPos, 0xffffff, 0.11));
    anchors.pointMeet = anchor(pMeet, meetPos, `${fmtVec(meet.point)}: λ = ${meet.lambda}, μ = ${meet.mu}`, 'aim-label-point aim-label-meet aim-label-left');
    for (const [k, o] of [['A', pA], ['C', pC], ['meet', pMeet]]) { world.add(o); parts.points[k] = o; }

    // Moving points: P1 on L₁ (λ), P2 on L₂ (μ). Labels show their coordinates.
    for (const [k, key] of [['P1', 'L1'], ['P2', 'L2']]) {
      const m = dot(LINES[key].a, COLOURS.movingPoint, 0.1);
      m.userData.label = '';
      m.userData.labelClass = `aim-label-point aim-label-moving aim-label-${key}`;
      m.userData.labelAutoFlip = true; // stays inside the view across the slider range
      world.add(m);
      parts.moving[k] = m;
      anchors[`moving-${k}`] = m;
    }

    // Stage 5 "Going further": dashed PQ with P, Q and the distance. Shown after the reveal.
    const gap = new THREE.Group();
    gap.add(dashed(P, Q, material(COLOURS.gap)));
    gap.add(dot(P, COLOURS.L1, 0.08), dot(Q, COLOURS.L4, 0.08));
    anchors.gapP = anchor(gap, P, 'P', 'aim-label-vector aim-label-L1 aim-label-below');
    anchors.gapQ = anchor(gap, Q, 'Q', 'aim-label-vector aim-label-L4');
    anchors.gapDist = anchor(gap, M, `PQ = ${CLOSEST.distanceText} ≈ ${CLOSEST.distance.toFixed(2)}`, 'aim-label-gap aim-label-below');
    gap.visible = false;
    world.add(gap);
    parts.gap = gap;

    world.updateMatrixWorld(true);
    applyVisibility();
    return { defaultView: STAGE_VIEWS[1], labelAnchors: anchors };
  },

  update(t, state) {
    const playing = state.playing;
    const sp = STAGE_PARTS[stage];
    const lam = playing ? sweep(t) : options.lambda;
    const mu = playing ? sweep(t) : options.mu;
    const pos = { P1: pointAt(LINES.L1, lam), P2: pointAt(LINES.L2, mu) };
    // Labels give way where points coincide: the meeting point's own label (stage 4),
    // or P2 when it sits on P1. An empty label is not drawn.
    const meetShown = sp.points.includes('meet');
    const atMeet = (p) => meetShown && Math.hypot(...p.map((c, i) => c - MEET[i])) < 0.15;
    for (const k of ['P1', 'P2']) {
      parts.moving[k].position.set(...pos[k]);
      const hide = atMeet(pos[k]) || (k === 'P2' && Math.hypot(...pos.P2.map((c, i) => c - pos.P1[i])) < 0.15);
      parts.moving[k].userData.label = hide ? '' : fmtPoint(pos[k]).text;
    }
    if (playing) {
      if (sp.moving.includes('P1')) ctx.ui.showSliderValue('lambda', lam);
      if (sp.moving.includes('P2')) ctx.ui.showSliderValue('mu', mu);
    }

    // Overlay live values.
    if (overlay) {
      for (const [key, e] of Object.entries(overlay.live)) {
        const p = key === 'L2' ? mu : lam;
        const f = fmtPoint(pointAt(LINES[key], p));
        e.entries.forEach((n, i) => setText(n, f.entries[i]));
        setText(e.sign, f.exact ? '=' : '≈');
        const pv = fmtNum(p);
        setText(e.psign, pv.exact ? '=' : '≈');
        setText(e.value, pv.text);
      }
      if (overlay.steps) {
        // While playing, step through the method; when paused, show every step.
        // The cycle has one extra beat at the end with every step shown.
        const active = Math.floor(t / METHOD_STEP_SECONDS) % (overlay.steps.length + 1);
        overlay.steps.forEach((s, i) => s.classList.toggle('is-dim', playing && i > active));
      }
    }

    // Stage 5: show PQ once the reveal camera move has finished (or was interrupted).
    parts.gap.visible = stage === 4 && options.revealed && !ctx.view.moving;
  },

  setStage(n) {
    stage = n;
    options.revealed = false;
    applyVisibility();
    buildOverlay(n);
    const v = stageView(n);
    // First load, stage 5 (the start view must not pass through a revealing
    // angle) and reduced motion: jump. Otherwise move smoothly.
    const snap = firstStage || n === 4 || reduceMotion();
    ctx.view.setDefault(v, snap);
    if (!snap) ctx.view.flyTo(v, 1.2);
    firstStage = false;
  },

  setOption(name, value) {
    if (name === 'lambda' || name === 'mu') { options[name] = Number(value); return; }
    if (name === 'revealed') {
      options.revealed = !!value;
      if (stage === 4 && options.revealed) {
        const v = sideView();
        const snap = reduceMotion();
        ctx.view.setDefault(v, snap);
        if (!snap) ctx.view.flyTo(v, 2.5);
      }
      return;
    }
    if (name in options) {
      options[name] = !!value;
      applyVisibility();
    }
  },

  // Values for automated tests (maths coordinates unless stated).
  debugState() {
    const m = world.matrixWorld;
    const e = new THREE.Vector3();
    const basis = [0, 1, 2].map((i) => { e.set(...[0, 1, 2].map((j) => (j === i ? 1 : 0))).transformDirection(m); return e.toArray(); });
    // Screen position (pixels in the canvas) of a maths point.
    const canvas = ctx.renderer.domElement;
    const w = canvas.clientWidth; const h = canvas.clientHeight;
    const screen = (p) => { const v = new THREE.Vector3(...p).applyMatrix4(m).project(ctx.camera); return [((v.x + 1) / 2) * w, ((1 - v.y) / 2) * h, v.z]; };
    const vis = (o) => { for (let x = o; x; x = x.parent) if (!x.visible) return false; return true; };
    return {
      stage,
      worldBasis: basis,
      worldDeterminant: m.determinant(),
      gridVisible: parts.grid.visible,
      directionVectorsVisible: Object.values(parts.directionVectors).some((d) => d.visible),
      lines: Object.fromEntries(Object.keys(LINES).map((k) => [k, parts.lines[k].visible])),
      moving: Object.fromEntries(Object.entries(parts.moving).map(([k, o]) => [k, { visible: vis(o), position: o.position.toArray(), label: o.userData.label }])),
      options: { ...options },
      gapVisible: vis(parts.gap),
      cameraMoving: ctx.view.moving,
      // Exact results from the model, for the tests to compare with the spec.
      model: {
        L1L2: (() => { const r = relate(LINES.L1, LINES.L2); return { type: r.type, point: r.point?.map(String), lambda: `${r.lambda}`, mu: `${r.mu}` }; })(),
        L1L3: (() => { const r = relate(LINES.L1, LINES.L3); return { type: r.type, k: `${r.k}` }; })(),
        L1L4: (() => { const r = relate(LINES.L1, LINES.L4); return { type: r.type }; })(),
        closest: { P: CLOSEST.P.map(String), Q: CLOSEST.Q.map(String), lambda: `${CLOSEST.lambda}`, s: `${CLOSEST.mu}`, dist2: `${CLOSEST.dist2}`, distance: CLOSEST.distance, text: CLOSEST.distanceText },
      },
      screen: {
        P: screen(P), Q: screen(Q),
        L1: [screen(pointAt(LINES.L1, -2)), screen(pointAt(LINES.L1, 4))],
        L4: [screen(pointAt(LINES.L4, -2)), screen(pointAt(LINES.L4, 4))],
        size: [w, h],
      },
    };
  },

  dispose() {
    overlay?.root.remove();
    overlay = null;
    world?.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
    world?.removeFromParent();
    ctx = null;
  },
};

