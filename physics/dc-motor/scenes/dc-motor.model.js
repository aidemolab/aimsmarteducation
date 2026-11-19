// Simplified, illustrative model of the magnetic effect of a current and a
// simple DC motor (AQA GCSE Physics 8463, 4.7.2). Pure functions of time plus
// recorded change points. Units are illustrative, not real values.
//
// Motor sign conventions (axle = Z, +Z = towards the viewer/commutator end;
// angles anticlockwise from +X, seen from the front):
// - Field B between the magnets acts along +X × fieldDir (fieldDir = −1 when
//   the magnets are flipped).
// - The coil plane contains the axle and the direction (cos θ, sin θ, 0).
//   Side A sits at radius r along that direction, side B opposite.
// - sideCurrent = +1 means the current in side A flows along +Z.
//   Force on side A: I L × B = (+Z) × (+X) = +Y, times sideCurrent × fieldDir.
// - Torque ∝ cos θ × sideCurrent × fieldDir. With the split-ring commutator,
//   sideCurrent = currentDir × sign(cos θ), so the torque never changes sign:
//   the coil keeps turning one way. Without it, sideCurrent = currentDir and
//   the coil rocks about the vertical (cos θ = 0), then settles there.
//
// Wire convention: current up the wire (+Y) for positive current; the field
// circles the wire anticlockwise seen from above (right-hand grip), with
// strength ∝ current / distance.

export const TAU = Math.PI * 2;

/** Rotation speed (turns per second, illustrative): grows with current × turns. */
export function motorTurnsPerSecond(current, turns) {
  return Math.min(0.9, 0.05 * Math.abs(current) * turns);
}

/** Size of the force on each side of the coil, in display units: ∝ current × turns. */
export function forceSize(current, turns) {
  return Math.abs(current) * turns;
}

/** Direction of turning: +1 anticlockwise from the front, −1 clockwise. */
export function turnDirection(currentDir, fieldDir) {
  return currentDir * fieldDir >= 0 ? 1 : -1;
}

/** Current direction in side A (+1 along +Z), with or without the commutator. */
export function sideCurrent(theta, currentDir, commutator) {
  if (!commutator) return currentDir;
  return currentDir * (Math.cos(theta) >= 0 ? 1 : -1);
}

/** Vertical force on side A (+ = up), in display units; side B gets the opposite. */
export function sideForce(theta, { current, turns, currentDir, fieldDir, commutator }) {
  return sideCurrent(theta, currentDir, commutator) * fieldDir * forceSize(current, turns);
}

/** Relative turning effect, −1..1 (+ = anticlockwise from the front). */
export function turningEffect(theta, opts) {
  const f = sideForce(theta, opts);
  const max = forceSize(opts.current, opts.turns) || 1;
  return (f * Math.cos(theta)) / max;
}

/** Field around a long straight wire at distance r (illustrative, ∝ I / r). */
export function wireField(current, r) {
  return current / Math.max(r, 0.05);
}

/**
 * Field direction at (x, z) on the card around a vertical wire, combined with
 * a weak "Earth" field towards −Z (north), as a plotting compass would show.
 * Returns the direction in the XZ plane as { x, z }.
 */
export function compassDirection(current, x, z, earth = 0.25) {
  const r = Math.hypot(x, z) || 1e-6;
  const b = wireField(current, r) * 0.35;
  // ŷ × r̂ = (z, 0, −x) / r  (anticlockwise seen from above for current up)
  return { x: (b * z) / r, z: (-b * x) / r - earth };
}

/**
 * Coil kinematics: piecewise segments, so the angle stays continuous when the
 * motion changes (current, turns, direction, commutator). Each segment is a
 * pure function of t; the change points are recorded in simulation time.
 *
 * Modes:
 *   still  θ = θ0
 *   spin   θ = θ0 + ω (t − t0)
 *   rock   damped swing about the equilibrium θ* (no commutator)
 */
const ROCK_OMEGA = TAU * 0.55; // swing frequency (rad/s, illustrative)
const ROCK_DAMP = 0.85;        // damping rate (1/s)

export function createCoilKinematics() {
  let seg = { mode: 'still', t0: 0, theta0: 0, omega: 0, target: 0, A: 0, B: 0 };
  let initial = { mode: 'still', omega: 0, dir: 1 };

  const stateAt = (t) => {
    const s = seg;
    const dt = Math.max(0, t - s.t0);
    if (s.mode === 'spin') return { theta: s.theta0 + s.omega * dt, omega: s.omega };
    if (s.mode === 'rock') {
      const e = Math.exp(-ROCK_DAMP * dt);
      const c = Math.cos(ROCK_OMEGA * dt);
      const sn = Math.sin(ROCK_OMEGA * dt);
      const theta = s.target + e * (s.A * c + s.B * sn);
      const omega = e * ((-ROCK_DAMP) * (s.A * c + s.B * sn) + ROCK_OMEGA * (-s.A * sn + s.B * c));
      return { theta, omega };
    }
    return { theta: s.theta0, omega: 0 };
  };

  function start(mode, t, { omega = 0, dir = 1, theta } = {}) {
    const now = stateAt(t);
    const theta0 = theta ?? now.theta;
    const next = { mode, t0: t, theta0, omega: 0, target: 0, A: 0, B: 0 };
    if (mode === 'spin') next.omega = omega;
    if (mode === 'rock') {
      // Stable equilibrium: coil vertical, at +90° for dir = +1 and −90° for dir = −1.
      // Pick the one nearest to where the coil is heading.
      const eq = dir >= 0 ? Math.PI / 2 : -Math.PI / 2;
      const ahead = theta0 + 0.35 * (theta == null ? now.omega : 0);
      next.target = eq + TAU * Math.round((ahead - eq) / TAU);
      // Swings no more than about a third of a turn either side, so it reads as rocking.
      next.A = Math.max(-2.1, Math.min(2.1, theta0 - next.target));
      next.theta0 = next.target + next.A;
      const w0 = theta == null ? now.omega : 0;
      next.B = (w0 + ROCK_DAMP * next.A) / ROCK_OMEGA;
    }
    seg = next;
  }

  return {
    get mode() { return seg.mode; },
    angle(t) {
      if (t < seg.t0) { // clock restarted
        const m = initial;
        seg = { mode: 'still', t0: 0, theta0: 0, omega: 0, target: 0, A: 0, B: 0 };
        if (m.mode !== 'still') start(m.mode, 0, { omega: m.omega, dir: m.dir, theta: 0 });
      }
      return stateAt(t).theta;
    },
    velocity(t) { return stateAt(t).omega; },
    /** Changes the motion at simulation time t, keeping the angle continuous. */
    set(mode, t, opts = {}) {
      initial = { mode, omega: opts.omega ?? 0, dir: opts.dir ?? 1 };
      start(mode, t, opts);
    },
    /** Puts the coil still at a given angle (used by the static stages). */
    hold(theta, t) {
      initial = { mode: 'still', omega: 0, dir: 1 };
      seg = { mode: 'still', t0: t, theta0: theta, omega: 0, target: 0, A: 0, B: 0 };
    },
  };
}
