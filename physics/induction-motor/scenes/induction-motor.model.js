// Simplified, illustrative model of a two-pole, three-phase induction motor.
// Pure functions of simulation time. Units are illustrative, not real values.
//
// Sign conventions (motor axis Z, +Z = shaft end, angles anticlockwise from +X
// seen from the shaft end):
// - Phase k current i_k(t) = cos(ωt − k·120°), k = 0, 1, 2 for A, B, C.
// - Winding k's field acts along its axis û_k at 0°, 120°, 240°.
// - Combined field B = Σ i_k û_k; field angle θ_f = atan2(B_y, B_x).
//   For balanced currents |B| = 1.5 and θ_f = ωt: anticlockwise rotation (A→B→C).
// - Bar current I = g(s) · cos(θ_bar − θ_f). I > 0 flows along +Z (towards the
//   shaft end). With the field moving faster than the rotor, this sign gives a
//   force I ẑ × B in the direction of field rotation (motoring torque).

export const FIELD_TURNS_PER_SECOND = 0.25; // slow motion: one field turn per 4 s
export const OMEGA = 2 * Math.PI * FIELD_TURNS_PER_SECOND;
export const DEFAULT_SLIP = 0.15;           // exaggerated for visibility
export const SLIP_DISPLAY_REF = 0.15;       // slip at which highlights reach full strength
export const PHASE_AXES = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];

export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** Supply phase angle (radians, 0..2π) – the same quantity the phase chart cursor shows. */
export function supplyPhase(t) {
  const p = (OMEGA * t) % (2 * Math.PI);
  return p < 0 ? p + 2 * Math.PI : p;
}

/** Instantaneous phase currents [iA, iB, iC], normalised to peak 1. */
export function phaseCurrents(t) {
  const p = OMEGA * t;
  return PHASE_AXES.map((a) => Math.cos(p - a));
}

/** Vector sum of the three winding contributions. */
export function fieldVector(currents) {
  let x = 0;
  let y = 0;
  currents.forEach((i, k) => {
    x += i * Math.cos(PHASE_AXES[k]);
    y += i * Math.sin(PHASE_AXES[k]);
  });
  return { x, y, angle: Math.atan2(y, x), magnitude: Math.hypot(x, y) };
}

/** Display strength of induced effects: proportional to slip near synchronous speed, capped at 1. */
export function inducedStrength(slip) {
  return Math.max(0, Math.min(slip / SLIP_DISPLAY_REF, 1));
}

/** Illustrative bar current, positive towards the shaft end. */
export function barCurrent(thetaBar, thetaField, slip) {
  return inducedStrength(slip) * Math.cos(thetaBar - thetaField);
}

/** Illustrative torque (0..1), in the direction of field rotation. Zero at synchronous speed. */
export function torque(slip) {
  return inducedStrength(slip);
}

/**
 * Rotor kinematics with a piecewise-constant speed ratio (rotor speed / field speed).
 * Keeps the rotor angle continuous when the ratio changes, so it stays a pure
 * function of t plus the recorded change points.
 */
export function createRotorKinematics() {
  let t0 = 0;
  let theta0 = 0;
  let ratio = 0;
  const angleAt = (t) => theta0 + ratio * OMEGA * (t - t0);
  return {
    get ratio() { return ratio; },
    angle(t) {
      if (t < t0) { t0 = 0; theta0 = 0; } // clock restarted
      return angleAt(t);
    },
    setRatio(newRatio, t) {
      if (newRatio === ratio) return;
      theta0 = t < t0 ? 0 : angleAt(t);
      t0 = t;
      ratio = newRatio;
    },
    reset() { t0 = 0; theta0 = 0; },
  };
}
