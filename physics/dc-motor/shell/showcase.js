// Showcase mode: the page URL contains ?showcase=1. Only the 3D view is shown,
// filling the window, for embedding in an iframe on a host page (e.g. a hero).
//
// - Everything around the 3D view is hidden; the scene's overlays and the
//   notice are hidden too. The stage's badges ("Illustrative" etc.) stay.
// - The scene is put in the state set by "showcase" in stages.json:
//     { "stage": 5, "labels": false, "options": { "fieldEffects": true }, "time": 0 }
//   stage is 1-based, as shown to viewers; time is the starting simulation time.
// - The camera auto-orbits (one turn per ORBIT_SECONDS of real time). On
//   desktop, drag to orbit; auto-orbit resumes RESUME_SECONDS after release.
//   On touch devices there is no drag: a tap opens the full explainer in the
//   top window (this page without ?showcase).
// - After the first showcase frame has rendered, the page sends
//   window.parent.postMessage({ type: 'aim-showcase-ready' }, '*').
// - prefers-reduced-motion: one still frame; no orbit, animation or drag.
// - Pixel ratio is capped at SHOWCASE_MAX_PIXEL_RATIO; the quality reducer
//   still runs. Scene physics is unchanged.

export const SHOWCASE_MAX_PIXEL_RATIO = 1.5;
const ORBIT_SECONDS = 40;
const RESUME_SECONDS = 3;

export function isShowcase() {
  return new URLSearchParams(location.search).get('showcase') === '1';
}

// The full explainer: this page without the showcase parameter.
function fullExplainerUrl() {
  const u = new URL(location.href);
  u.searchParams.delete('showcase');
  return u.href;
}

// Hides everything on the page except the path down to the 3D view. Runs before
// WebGL starts, so an error message also shows full-window.
export function prepareShowcasePage(root, viewport) {
  document.documentElement.classList.add('aim-showcase');
  for (let node = viewport; node && node !== document.body; node = node.parentElement) {
    for (const sib of node.parentElement?.children || []) {
      if (sib !== node && !['SCRIPT', 'STYLE', 'LINK'].includes(sib.tagName)) sib.classList.add('aim-showcase-off');
    }
  }
  // Keyboard and screen-reader route to the full explainer (visible on focus).
  const link = document.createElement('a');
  link.className = 'aim-showcase-link';
  link.href = fullExplainerUrl();
  link.target = '_top';
  link.textContent = 'Open the full interactive explainer';
  viewport.append(link);
}

export function startShowcase(root, api, stages) {
  const { THREE, camera, controls, sim, renderer } = api;
  const cfg = { stage: 1, labels: false, options: {}, time: 0, ...(stages?.data?.showcase || {}) };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = matchMedia('(hover: none) and (pointer: coarse)').matches;
  const viewport = root.querySelector('.aim-viewport');
  const canvas = renderer.domElement;

  // Scene state: stage, options, labels, time. Same calls as the normal controls.
  api.tour?.stop();
  stages?.go(Math.max(0, (cfg.stage | 0) - 1));
  for (const [name, value] of Object.entries(cfg.options)) api.setOption(name, value);
  api.labels?.setVisible(!!cfg.labels);
  sim.t = Number(cfg.time) || 0;
  sim.speed = 1;
  sim.playing = !reduced;
  api.cameraMove?.stop();
  api.resetCamera();

  // Input: desktop drags to orbit; touch taps through to the full explainer.
  if (touch || reduced) controls.enabled = false;
  if (touch) {
    document.documentElement.classList.add('aim-showcase-touch');
    // OrbitControls sets touch-action: none inline; let the host page scroll.
    canvas.style.touchAction = 'auto';
    viewport.addEventListener('click', () => {
      const href = fullExplainerUrl();
      try { window.top.location.href = href; } catch { window.open(href, '_top'); }
    });
  }

  // Auto-orbit round the target's vertical axis, paused while the user drags.
  const rate = (2 * Math.PI) / ORBIT_SECONDS;
  const axis = new THREE.Vector3(0, 1, 0);
  const offset = new THREE.Vector3();
  let dragging = false;
  let resumeIn = 0;
  controls.addEventListener('start', () => { dragging = true; });
  controls.addEventListener('end', () => { dragging = false; resumeIn = RESUME_SECONDS; });
  const orbiting = () => !reduced && !dragging && resumeIn <= 0;
  if (!reduced) {
    api.addHook('pre', (dt) => {
      if (dragging) return;
      if (resumeIn > 0) { resumeIn -= dt; return; }
      offset.subVectors(camera.position, controls.target).applyAxisAngle(axis, rate * dt);
      camera.position.copy(controls.target).add(offset);
    });
  }

  // Reduced motion: render one frame and stop the loop. Re-render on resize,
  // because resizing the canvas clears it.
  api.renderFrame();
  if (reduced) {
    api.setFrozen(true);
    new ResizeObserver(() => api.renderFrame()).observe(viewport);
  }

  const status = { config: cfg, touch, reduced, readyPosted: false, get orbiting() { return orbiting(); } };
  if (window.__aimDebug) window.__aimDebug.showcase = status;

  // The rAF callback runs after the frame above has been presented.
  requestAnimationFrame(() => {
    status.readyPosted = true;
    root.classList.add('aim-showcase-ready');
    window.parent.postMessage({ type: 'aim-showcase-ready' }, '*');
  });
  return status;
}
