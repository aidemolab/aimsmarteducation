// Guided camera tour: eases the camera through the scene's keyframes
// ({ position, target, move, hold } in seconds of real time). Moves orbit
// around the target (spherical interpolation), so the camera never passes
// through the model. Any user camera input stops the tour cleanly.

const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - ((-2 * x + 2) ** 2) / 2);

export function createCameraTour(api, keyframes) {
  const { THREE, camera, controls } = api;
  const listeners = new Set();
  let active = false;
  let seg = 0;
  let phase = 'move';
  let time = 0;
  let from = null;
  let to = null;

  const sFrom = new THREE.Spherical();
  const sTo = new THREE.Spherical();
  const s = new THREE.Spherical();
  const offset = new THREE.Vector3();
  const target = new THREE.Vector3();

  const emit = () => listeners.forEach((fn) => fn(active));

  function beginMove() {
    from = { position: camera.position.clone(), target: controls.target.clone() };
    to = api.fittedView(keyframes[seg]);
    sFrom.setFromVector3(offset.subVectors(from.position, from.target));
    sTo.setFromVector3(offset.subVectors(to.position, to.target));
    // Shortest way round in azimuth.
    let d = sTo.theta - sFrom.theta;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    sTo.theta = sFrom.theta + d;
    phase = 'move';
    time = 0;
  }

  function stop() {
    if (!active) return;
    active = false;
    emit();
  }

  function start() {
    if (!keyframes.length) return;
    active = true;
    seg = 0;
    beginMove();
    emit();
  }

  // OrbitControls fires 'start' only for user input (pointer, wheel, touch).
  controls.addEventListener('start', stop);

  api.addHook('pre', (dt) => {
    if (!active) return;
    time += dt;
    const k = keyframes[seg];
    if (phase === 'move') {
      const u = Math.min(time / (k.move ?? 2.5), 1);
      const e = ease(u);
      target.lerpVectors(from.target, to.target, e);
      s.radius = sFrom.radius + (sTo.radius - sFrom.radius) * e;
      s.phi = sFrom.phi + (sTo.phi - sFrom.phi) * e;
      s.theta = sFrom.theta + (sTo.theta - sFrom.theta) * e;
      camera.position.setFromSpherical(s).add(target);
      controls.target.copy(target);
      if (u >= 1) { phase = 'hold'; time = 0; }
    } else if (time >= (k.hold ?? 2)) {
      seg += 1;
      if (seg >= keyframes.length) stop();
      else beginMove();
    }
  });

  return {
    start,
    stop,
    get active() { return active; },
    onChange(fn) { listeners.add(fn); },
  };
}
