// Text for "Lines in 3D": turns {{tokens}} in stage strings into computed maths
// (column vectors, coordinates, working). Every number comes from the model, so
// stages.json holds only words. Used by the shell's stage system (textModule)
// and by the scene's overlay. Needs the DOM but not WebGL.
//
// Tokens
//   {{v:r}}                     bold vector letter (r, a, b)
//   {{col:L1.a}}                column vector a (or b) of a line
//   {{pt:L1.a}}                 the same values as coordinates, e.g. (1, 0, 2)
//   {{eq:L1}}                   L₁: r = a + λb with column vectors
//   {{multiple:L3,L1}}          b₃ = k × b₁ as column vectors
//   {{k:L3,L1}}                 the multiple k
//   {{notOn:L3,L1}}             working showing L3's point is not on L1
//   {{method:L1,L2:x,y,z}}      equate, solve two rows (in this order), check the third
//   {{meet:L1,L2}}              meeting point; {{p1:L1,L2}} / {{p2:L1,L2}} its parameters
//   {{closest:L1,L4}}           closest points P and Q with their parameters
//   {{pq:L1,L4}}                direction of PQ (smallest whole numbers)
//   {{dist:L1,L4}}              shortest distance, exact and to 2 decimal places
import { LINES, Frac, relate, closestPoints, locatePoint, multipleOf, simplestDirection } from './maths-lines-3d.model.js';

const AXES = ['x', 'y', 'z'];
const fr = (x) => Frac.of(x).toString();

function el(tag, cls, children = []) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  for (const c of [].concat(children)) n.append(c);
  return n;
}

export function vecLetter(letter) { return el('b', 'mv-vec', letter); }

// Column vector built with CSS (no maths library). Read out as coordinates.
export function colVec(values, cls = '') {
  const col = el('span', `mv-col ${cls}`.trim(), values.map((v) => el('span', 'mv-entry', typeof v === 'string' ? v : fr(v))));
  col.setAttribute('role', 'img');
  col.setAttribute('aria-label', `column vector ${values.map((v) => (typeof v === 'string' ? v : fr(v)).replace('−', 'minus ')).join(', ')}`);
  return col;
}

export const coords = (values) => `(${values.map(fr).join(', ')})`;

// a + c·p as text, e.g. "1 + λ", "2 − λ", "λ", "−2 + μ", "3".
export function linear(a, c, p) {
  a = Frac.of(a); c = Frac.of(c);
  const parts = [];
  if (!a.isZero()) parts.push(a.toString());
  if (!c.isZero()) {
    const mag = Frac.of(Math.abs(c.n)).div(c.d);
    const term = mag.eq(1) ? p : `${mag}${p}`;
    if (!parts.length) parts.push(c.n < 0 ? `−${term}` : term);
    else parts.push(c.n < 0 ? `− ${term}` : `+ ${term}`);
  }
  return parts.length ? parts.join(' ') : '0';
}

const line = (key) => { const l = LINES[key]; if (!l) throw new Error(`Unknown line ${key}`); return l; };

// "L₁: r = (col a) + λ (col b)"
export function equation(key) {
  const l = line(key);
  return el('span', 'mv-eq', [`${l.name}: `, vecLetter('r'), ' = ', colVec(l.a), ` + ${l.param} `, colVec(l.b)]);
}

// Working for two lines, as a list of steps (each step a span shown as a block).
export function methodSteps(k1, k2, order = [0, 1, 2]) {
  const l1 = line(k1); const l2 = line(k2);
  const row = (i) => ({ A: Frac.of(l1.a[i]), B: Frac.of(l1.b[i]), C: Frac.of(l2.a[i]), D: Frac.of(l2.b[i]) });
  const eqText = (i) => `${linear(l1.a[i], l1.b[i], l1.param)} = ${linear(l2.a[i], l2.b[i], l2.param)}`;
  const known = {};
  const steps = [];

  steps.push({ kind: 'equate', parts: ['Equate the components:', ...order.map((i) => el('span', 'mv-row', `${AXES[i]}:  ${eqText(i)}`))] });

  // Solve the first two rows in the given order.
  for (const i of order.slice(0, 2)) {
    const { A, B, C, D } = row(i);
    // A + Bλ = C + Dμ, with any known values substituted.
    let text;
    if (!B.isZero() && (D.isZero() || known.mu)) {
      const mu = known.mu ?? new Frac(0);
      const lam = C.add(D.mul(mu)).sub(A).div(B);
      const direct = A.isZero() && B.eq(1) && D.isZero(); // row already reads "λ = value"
      text = known.mu ? `${AXES[i]}: ${eqText(i)}. With ${l2.param} = ${known.mu} this gives ${l1.param} = ${lam}.` : direct ? `${AXES[i]}: ${eqText(i)}.` : `${AXES[i]}: ${eqText(i)}, so ${l1.param} = ${lam}.`;
      known.lambda = lam;
    } else if (!D.isZero()) {
      const lam = known.lambda ?? new Frac(0);
      const mu = A.add(B.mul(lam)).sub(C).div(D);
      text = known.lambda && !B.isZero() ? `${AXES[i]}: ${eqText(i)}. With ${l1.param} = ${known.lambda} this gives ${l2.param} = ${mu}.` : `${AXES[i]}: ${eqText(i)}, so ${l2.param} = ${mu}.`;
      known.mu = mu;
    } else {
      throw new Error(`Row ${AXES[i]} has no unknown to solve for`);
    }
    steps.push({ kind: 'solve', parts: [text] });
  }
  if (!known.lambda || !known.mu) throw new Error('Row order did not determine both parameters');

  // Check the third row.
  const m = order[2];
  const { A, B, C, D } = row(m);
  const lhs = A.add(B.mul(known.lambda));
  const rhs = C.add(D.mul(known.mu));
  if (lhs.eq(rhs)) {
    steps.push({ kind: 'check-ok', parts: [`Check ${AXES[m]}: ${linear(l1.a[m], l1.b[m], l1.param)} = ${lhs} and ${linear(l2.a[m], l2.b[m], l2.param)} = ${rhs}. They match ✓`] });
  } else {
    steps.push({ kind: 'check-fail', parts: [`Check ${AXES[m]}: ${linear(l1.a[m], l1.b[m], l1.param)} = ${lhs}, but ${linear(l2.a[m], l2.b[m], l2.param)} = ${rhs}. ${lhs} ≠ ${rhs}, so there is no solution ✗`] });
  }
  // Cross-check against the model's own solver.
  const r = relate(l1, l2);
  if ((r.type === 'intersect') !== lhs.eq(rhs)) throw new Error('Working disagrees with the model');
  return steps;
}

function stepsNode(steps) {
  return el('span', 'mv-steps', steps.map((s) => el('span', `mv-step mv-step-${s.kind}`, s.parts)));
}

// "The point (0, 2, 1) is not on L₁: x gives λ = −1, but then y = −1, not 2."
function notOn(kp, kl) {
  const P = line(kp).a; const l = line(kl);
  const loc = locatePoint(l, P);
  if (loc.p) return `${coords(P)} is on ${l.name} (${l.param} = ${loc.p}).`;
  const i = loc.fromCoord;
  const j = [0, 1, 2].find((k) => !Frac.of(l.a[k]).add(Frac.of(l.b[k]).mul(loc.tried)).eq(P[k]));
  const got = Frac.of(l.a[j]).add(Frac.of(l.b[j]).mul(loc.tried));
  return `The point ${coords(P)} is not on ${l.name}: ${AXES[i]} gives ${l.param} = ${loc.tried}, but then ${AXES[j]} = ${got}, not ${fr(P[j])}.`;
}

const pair = (arg) => arg.split(',').map((s) => s.trim());

const TOKENS = {
  v: (arg) => vecLetter(arg),
  col: (arg) => { const [k, f] = arg.split('.'); return colVec(line(k)[f]); },
  pt: (arg) => { const [k, f] = arg.split('.'); return coords(line(k)[f]); },
  eq: (arg) => equation(arg),
  k: (arg) => { const [a, b] = pair(arg); return fr(multipleOf(line(a).b, line(b).b)); },
  multiple: (arg) => {
    const [a, b] = pair(arg);
    const k = multipleOf(line(a).b, line(b).b);
    return el('span', 'mv-eq', [colVec(line(a).b), ` = ${k} × `, colVec(line(b).b)]);
  },
  notOn: (arg) => { const [a, b] = pair(arg); return notOn(a, b); },
  method: (arg) => {
    const [lines, ord] = arg.split(':');
    const [a, b] = pair(lines);
    const order = ord ? ord.split(',').map((c) => AXES.indexOf(c.trim())) : undefined;
    return stepsNode(methodSteps(a, b, order));
  },
  meet: (arg) => { const [a, b] = pair(arg); return coords(relate(line(a), line(b)).point); },
  p1: (arg) => { const [a, b] = pair(arg); return fr(relate(line(a), line(b)).lambda); },
  p2: (arg) => { const [a, b] = pair(arg); return fr(relate(line(a), line(b)).mu); },
  closest: (arg) => {
    const [a, b] = pair(arg);
    const c = closestPoints(line(a), line(b));
    return `P = ${coords(c.P)} on ${line(a).name} (${line(a).param} = ${c.lambda}) and Q = ${coords(c.Q)} on ${line(b).name} (${line(b).param} = ${c.mu})`;
  },
  pq: (arg) => { const [a, b] = pair(arg); return colVec(pqDirection(a, b)); },
  dist: (arg) => { const [a, b] = pair(arg); const c = closestPoints(line(a), line(b)); return `${c.distanceText} ≈ ${c.distance.toFixed(2)}`; },
};

// Direction of PQ in smallest whole numbers, first non-zero entry positive.
export function pqDirection(a, b) {
  const d = simplestDirection(closestPoints(line(a), line(b)).PQ);
  const s = Math.sign(d.find((x) => x !== 0));
  return d.map((x) => x * s || 0);
}

// Stage-system hook: text with {{tokens}} → DocumentFragment.
export function render(text) {
  const frag = document.createDocumentFragment();
  let last = 0;
  for (const m of text.matchAll(/\{\{(\w+):([^}]*)\}\}/g)) {
    frag.append(text.slice(last, m.index));
    const fn = TOKENS[m[1]];
    if (!fn) throw new Error(`Unknown token {{${m[1]}:…}}`);
    frag.append(fn(m[2]));
    last = m.index + m[0].length;
  }
  frag.append(text.slice(last));
  return frag;
}
