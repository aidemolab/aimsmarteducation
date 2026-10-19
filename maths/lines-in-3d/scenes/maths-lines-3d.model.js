// Exact maths for "Lines in 3D". The four lines below are the only values typed
// in (spec section 4). Every other number shown on screen is computed here, with
// exact fractions where the result is rational. No Three.js, no DOM: this module
// is pure and can be tested on its own.

// ---- Fractions (small integers only; always reduced, denominator > 0) ----

const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };

export class Frac {
  constructor(n, d = 1) {
    if (!Number.isInteger(n) || !Number.isInteger(d) || d === 0) throw new Error(`Bad fraction ${n}/${d}`);
    const g = gcd(n, d) * Math.sign(d);
    this.n = n / g || 0; // avoid -0
    this.d = d / g;
  }
  static of(x) { return x instanceof Frac ? x : new Frac(x); }
  add(o) { o = Frac.of(o); return new Frac(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o) { o = Frac.of(o); return new Frac(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o) { o = Frac.of(o); return new Frac(this.n * o.n, this.d * o.d); }
  div(o) { o = Frac.of(o); return new Frac(this.n * o.d, this.d * o.n); }
  neg() { return new Frac(-this.n, this.d); }
  eq(o) { o = Frac.of(o); return this.n === o.n && this.d === o.d; }
  isZero() { return this.n === 0; }
  valueOf() { return this.n / this.d; }
  // Plain text with a true minus sign, e.g. "−7/3".
  toString() { return `${this.n < 0 ? '−' : ''}${Math.abs(this.n)}${this.d === 1 ? '' : `/${this.d}`}`; }
}

const F = (v) => v.map((x) => Frac.of(x));
const vadd = (u, v) => u.map((x, i) => x.add(v[i]));
const vsub = (u, v) => u.map((x, i) => x.sub(v[i]));
const vscale = (u, k) => u.map((x) => x.mul(k));
const dot = (u, v) => u.reduce((s, x, i) => s.add(x.mul(v[i])), new Frac(0));
const cross = (u, v) => [
  u[1].mul(v[2]).sub(u[2].mul(v[1])),
  u[2].mul(v[0]).sub(u[0].mul(v[2])),
  u[0].mul(v[1]).sub(u[1].mul(v[0])),
];
const isZeroVec = (u) => u.every((x) => x.isZero());

// ---- The lines (spec section 4: use exactly these) ----

export const LINES = {
  L1: { name: 'L₁', a: [1, 0, 2], b: [1, 1, -1], param: 'λ' },
  L2: { name: 'L₂', a: [3, 0, -2], b: [0, 1, 1], param: 'μ' },
  L3: { name: 'L₃', a: [0, 2, 1], b: [2, 2, -2], param: 't' },
  L4: { name: 'L₄', a: [0, 3, 0], b: [1, 0, 1], param: 's' },
};

// Point on a line for parameter p (floats, for drawing): r = a + p b.
export function pointAt(line, p) {
  return [line.a[0] + p * line.b[0], line.a[1] + p * line.b[1], line.a[2] + p * line.b[2]];
}

// Exact point for a rational parameter.
export function pointAtExact(line, p) {
  return vadd(F(line.a), vscale(F(line.b), Frac.of(p)));
}

// If u = k v for some k, returns k (exact); otherwise null.
export function multipleOf(u, v) {
  u = F(u); v = F(v);
  if (!isZeroVec(cross(u, v))) return null;
  const i = v.findIndex((x) => !x.isZero());
  return u[i].div(v[i]);
}

// Parameter p with a + p b = point, or null if the point is not on the line.
// Also returns the per-coordinate working used for the explanation.
export function locatePoint(line, point) {
  const a = F(line.a); const b = F(line.b); const P = F(point);
  const i = b.findIndex((x) => !x.isZero());
  const p = P[i].sub(a[i]).div(b[i]);
  const onLine = vadd(a, vscale(b, p)).every((x, k) => x.eq(P[k]));
  return { p: onLine ? p : null, tried: p, fromCoord: i };
}

// Relationship between two lines: 'same', 'parallel', 'intersect' or 'skew'.
// Solves a1 + λ b1 = a2 + μ b2 exactly: two equations solved, the third checked.
export function relate(l1, l2) {
  const a1 = F(l1.a); const b1 = F(l1.b); const a2 = F(l2.a); const b2 = F(l2.b);
  const k = multipleOf(l2.b, l1.b);
  if (k) {
    const loc = locatePoint(l1, l2.a);
    return { type: loc.p ? 'same' : 'parallel', k, check: loc };
  }
  // Rows: λ b1[i] − μ b2[i] = a2[i] − a1[i]. Pick the first pair of rows with a
  // non-zero determinant, solve by Cramer's rule, then check the remaining row.
  const rhs = vsub(a2, a1);
  for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) {
    const det = b1[i].mul(b2[j].neg()).sub(b2[i].neg().mul(b1[j]));
    if (det.isZero()) continue;
    const lam = rhs[i].mul(b2[j].neg()).sub(b2[i].neg().mul(rhs[j])).div(det);
    const mu = b1[i].mul(rhs[j]).sub(rhs[i].mul(b1[j])).div(det);
    const m = 3 - i - j;
    const lhs = a1[m].add(lam.mul(b1[m]));
    const rhs2 = a2[m].add(mu.mul(b2[m]));
    const solvedRows = [i, j];
    if (lhs.eq(rhs2)) {
      return { type: 'intersect', lambda: lam, mu, point: vadd(a1, vscale(b1, lam)), solvedRows, checkRow: m };
    }
    return { type: 'skew', lambda: lam, mu, solvedRows, checkRow: m, checkValues: [lhs, rhs2] };
  }
  throw new Error('Unreachable: non-parallel directions always give a non-zero 2×2 determinant');
}

// Closest points and shortest distance between two non-parallel lines (exact).
// Distance is returned as squared distance (a fraction) plus a surd string.
export function closestPoints(l1, l2) {
  const a1 = F(l1.a); const b1 = F(l1.b); const a2 = F(l2.a); const b2 = F(l2.b);
  const w0 = vsub(a1, a2);
  const A = dot(b1, b1); const B = dot(b1, b2); const C = dot(b2, b2);
  const D = dot(b1, w0); const E = dot(b2, w0);
  const den = A.mul(C).sub(B.mul(B));
  if (den.isZero()) throw new Error('Lines are parallel');
  const lam = B.mul(E).sub(C.mul(D)).div(den);
  const mu = A.mul(E).sub(B.mul(D)).div(den);
  const P = vadd(a1, vscale(b1, lam));
  const Q = vadd(a2, vscale(b2, mu));
  const PQ = vsub(Q, P);
  const dist2 = dot(PQ, PQ);
  return { lambda: lam, mu, P, Q, PQ, dist2, distance: Math.sqrt(dist2.valueOf()), distanceText: surd(dist2) };
}

// √(n/d) as text, e.g. 25/6 → "5/√6". Falls back to "√(n/d)".
export function surd(f) {
  const sq = (x) => { const r = Math.round(Math.sqrt(x)); return r * r === x ? r : null; };
  const rn = sq(f.n); const rd = sq(f.d);
  if (rn !== null && rd !== null) return rd === 1 ? `${rn}` : `${rn}/${rd}`;
  if (rn !== null) return `${rn}/√${f.d}`;
  if (rd !== null) return `√${f.n}/${rd}`;
  return `√(${f.n}/${f.d})`;
}

// Smallest whole-number direction parallel to v, e.g. (−5/6, 5/3, 5/6) → (−1, 2, 1).
export function simplestDirection(v) {
  const den = v.reduce((l, x) => (l * x.d) / gcd(l, x.d), 1);
  const ints = v.map((x) => (x.n * den) / x.d);
  const g = ints.reduce((acc, x) => gcd(acc, x), 0);
  return ints.map((x) => x / g);
}

export const fmtVec = (v) => `(${v.map((x) => Frac.of(x).toString()).join(', ')})`;
