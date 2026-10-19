// Reusable explainer shell: renderer, camera, controls, simulation clock and
// lifecycle. Topic content lives in a scene module (see SCENE-INTERFACE.md).
import { hasWebGL, showFallback } from './fallback.js';
import { initialQualityLevel, pixelRatioFor, createQualityMonitor } from './quality.js';
import { createStudioEnvironment } from './environment.js';
import { createStageSystem } from './stage-system.js';
import { createControls } from './controls.js';
import { createLabels } from './labels.js';
import { createCameraTour, createCameraMove } from './camera-tour.js';
import { isShowcase, prepareShowcasePage, startShowcase, SHOWCASE_MAX_PIXEL_RATIO } from './showcase.js';

const MAX_FRAME_DT = 0.1; // seconds; clamps long gaps (tab switch, breakpoint)

function whenInView(el) {
  return new Promise((resolve) => {
    if (!('IntersectionObserver' in window)) return resolve();
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        resolve();
      }
    }, { rootMargin: '200px' });
    io.observe(el);
  });
}

export async function bootShell(root) {
  const viewport = root.querySelector('.aim-viewport');
  const loading = root.querySelector('.aim-loading');
  // Showcase mode (?showcase=1): only the 3D view, full window, for embedding.
  const showcase = isShowcase();
  if (showcase) prepareShowcasePage(root, viewport);

  // Stage text loads first and works even if the 3D view does not.
  const stagesPromise = createStageSystem(root).catch((err) => {
    console.error('[aim-shell] stages:', err);
    return null;
  });

  if (!hasWebGL()) {
    showFallback(root, 'webgl');
    return null;
  }

  await whenInView(viewport);

  let THREE, OrbitControls, sceneModule;
  try {
    const sceneUrl = new URL(root.dataset.scene, document.baseURI).href;
    [THREE, { OrbitControls }, { default: sceneModule }] = await Promise.all([
      import('three'),
      import('three/addons/controls/OrbitControls.js'),
      import(sceneUrl),
    ]);
  } catch (err) {
    showFallback(root, 'deps', err);
    return null;
  }

  let api;
  try {
    api = startShell({ root, viewport, loading, THREE, OrbitControls, sceneModule, showcase });
  } catch (err) {
    showFallback(root, 'runtime', err);
    return null;
  }
  const stages = await stagesPromise;
  if (stages) {
    api.stages = stages;
    stages.setOnOption((name, value) => api.setOption(name, value));
    stages.setOnChange((i, stage, data) => {
      api.setStage(i, stage, data);
      api.controlsUi?.setStage(i);
    });
    try {
      api.labels = createLabels(viewport, api, stages.data.labels || {});
      api.tour = createCameraTour(api, api.sceneInfo.cameraTour || []);
      api.controlsUi = createControls(root, api, stages.data.controls || {});
      api.controlsUi?.setStage(stages.index);
    } catch (err) {
      console.error('[aim-shell] controls:', err);
    }
  }
  if (showcase) {
    try {
      startShowcase(root, api, stages);
    } catch (err) {
      console.error('[aim-shell] showcase:', err);
    }
  }
  return api;
}

function startShell({ root, viewport, loading, THREE, OrbitControls, sceneModule, showcase = false }) {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let qualityLevel = initialQualityLevel();
  const maxPixelRatio = showcase ? SHOWCASE_MAX_PIXEL_RATIO : Infinity;

  // Renderer
  const canvas = document.createElement('canvas');
  canvas.className = 'aim-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  viewport.prepend(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(pixelRatioFor(qualityLevel, maxPixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.localClippingEnabled = true;
  renderer.shadowMap.enabled = qualityLevel > 0;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    showFallback(root, 'runtime', new Error('WebGL context lost'));
  });

  // Scene and camera
  const scene = new THREE.Scene();
  scene.environment = createStudioEnvironment(THREE, renderer);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 100);
  camera.position.set(6, 3.5, 7);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 2.5;
  controls.maxDistance = 16;

  const topicRoot = new THREE.Group();
  topicRoot.name = 'topic-root';
  scene.add(topicRoot);

  const overlay = viewport.querySelector('.aim-overlay');
  // Optional page area outside the 3D view for scene readouts (e.g. equations).
  const panel = root.querySelector('.aim-scene-panel');
  // Camera and UI helpers for the scene. They are bound once the shell API
  // exists, so a scene may keep them from init() but should call them later.
  const view = {
    // Sets the view that Reset camera returns to; snap = true also moves there now.
    setDefault(v, snap = false) { defaultView = v; if (snap) { api?.cameraMove?.stop(); resetCamera(); } },
    // Smooth camera move (seconds of real time); stops on user input.
    flyTo(v, seconds, onDone) { api?.cameraMove?.flyTo(v, seconds, onDone); },
    get moving() { return !!api?.cameraMove?.active; },
  };
  const ui = {
    // Shows a value on a scene-declared slider without moving the slider's option.
    showSliderValue(option, value) { api?.controlsUi?.showSliderValue(option, value); },
  };
  const sceneInfo = sceneModule.init({ THREE, scene, root: topicRoot, camera, renderer, controls, overlay, panel, quality: qualityLevel, view, ui }) || {};
  let defaultView = sceneInfo.defaultView || { position: [6, 3.5, 7], target: [0, 0, 0] };
  // Views are authored for a landscape viewport, where the vertical field of view
  // limits the framing. On narrower viewports the horizontal field of view is
  // smaller, so move the camera back just enough to keep the same framing sphere.
  const fitFactor = () => {
    const halfV = THREE.MathUtils.degToRad(camera.fov / 2);
    const halfH = Math.atan(Math.tan(halfV) * camera.aspect);
    return Math.sin(halfV) / Math.sin(Math.min(halfV, halfH));
  };
  // Camera position for a view, scaled away from its target by the fit factor.
  const fittedView = (view) => {
    const target = new THREE.Vector3(...view.target);
    const position = new THREE.Vector3(...view.position).sub(target).multiplyScalar(fitFactor()).add(target);
    return { position, target };
  };
  const resetCamera = () => {
    // Flush any damping momentum left from user input, then place the camera.
    const damping = controls.enableDamping;
    controls.enableDamping = false;
    controls.update();
    const { position, target } = fittedView(defaultView);
    camera.position.copy(position);
    controls.target.copy(target);
    controls.update();
    controls.enableDamping = damping;
  };

  let api = null;

  // Simulation clock: the only source of animation time.
  // playing: whether the clock is running (a scene may show a manual value while paused).
  const state = { stage: 0, options: {}, uiDt: 0, playing: false };
  // Hooks: 'pre' runs before controls update (camera tour), 'post' after rendering (labels).
  const hooks = { pre: [], post: [] };
  const sim = { t: 0, playing: !reducedMotion, speed: 1 };

  // Resize
  const resize = () => {
    const w = viewport.clientWidth;
    const h = viewport.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Portrait: overlays take more room at the bottom than the top, so shift the
    // picture up slightly to centre the model in the free space (not in showcase
    // mode, which has no overlays).
    if (camera.aspect < 1 && !showcase) camera.setViewOffset(w, h, 0, h * 0.035, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(viewport);
  resize();
  resetCamera();

  // Quality monitor
  const monitor = createQualityMonitor(qualityLevel, (level) => {
    qualityLevel = level;
    renderer.setPixelRatio(pixelRatioFor(level, maxPixelRatio));
    renderer.shadowMap.enabled = level > 0;
    sceneModule.setOption?.('quality', level);
    resize();
  });

  // uiDt: real seconds since the last frame, for UI transitions (e.g. exploded view).
  // The simulation itself depends only on sim.t.
  const renderFrame = (uiDt = 0) => {
    state.uiDt = uiDt;
    state.playing = sim.playing;
    sceneModule.update(sim.t, state);
    renderer.render(scene, camera);
    for (const h of hooks.post) h(uiDt);
  };

  // Loop: runs only while the viewport is on screen and the page is visible.
  let onScreen = true;
  let last = performance.now();
  let rafId = 0;
  let failed = false;
  let frozen = false; // true: no frame loop (showcase still frame)
  const frame = (now) => {
    rafId = 0;
    if (failed) return;
    // rAF timestamps can precede the last performance.now() reading, so clamp at 0.
    const dt = Math.min(Math.max((now - last) / 1000, 0), MAX_FRAME_DT);
    last = now;
    try {
      if (sim.playing) sim.t += dt * sim.speed;
      for (const h of hooks.pre) h(dt);
      controls.update();
      renderFrame(dt);
      monitor.sample(dt);
    } catch (err) {
      failed = true;
      showFallback(root, 'runtime', err);
      return;
    }
    schedule();
  };
  const schedule = () => {
    if (!rafId && !frozen && onScreen && !document.hidden) rafId = requestAnimationFrame(frame);
  };
  new IntersectionObserver((entries) => {
    onScreen = entries.some((e) => e.isIntersecting);
    last = performance.now();
    schedule();
  }).observe(viewport);
  document.addEventListener('visibilitychange', () => { last = performance.now(); schedule(); });

  renderFrame();
  loading?.setAttribute('hidden', '');
  root.classList.add('aim-ready');
  schedule();

  api = {
    THREE, scene, camera, renderer, controls, sim, state, sceneModule, sceneInfo,
    resetCamera,
    fittedView,
    renderFrame,
    // Stops (true) or restarts (false) the frame loop. Showcase still frame only.
    setFrozen(on) { frozen = !!on; if (!on) { last = performance.now(); schedule(); } },
    addHook(kind, fn) { hooks[kind].push(fn); },
    setStage(n, stage, data) { state.stage = n; sceneModule.setStage?.(n, stage, data); },
    setOption(name, value) { state.options[name] = value; sceneModule.setOption?.(name, value); },
  };
  api.cameraMove = createCameraMove(api);

  // Test and capture hook. Read-only inspection plus deterministic stepping.
  window.__aimDebug = {
    ready: true,
    api,
    get qualityLevel() { return qualityLevel; },
    info() {
      const gl = renderer.getContext();
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      renderFrame();
      return {
        triangles: renderer.info.render.triangles,
        drawCalls: renderer.info.render.calls,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        pixelRatio: renderer.getPixelRatio(),
        size: [canvas.width, canvas.height],
        glRenderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      };
    },
    // Renders a frame and samples a grid of pixels from the drawing buffer.
    samplePixels(grid = 12) {
      renderFrame();
      const gl = renderer.getContext();
      const out = [];
      const px = new Uint8Array(4);
      for (let i = 1; i < grid; i++) {
        for (let j = 1; j < grid; j++) {
          gl.readPixels(Math.floor(canvas.width * i / grid), Math.floor(canvas.height * j / grid), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          out.push([px[0], px[1], px[2], px[3]]);
        }
      }
      return out;
    },
    // Scene-reported quantities for tests (angles in radians).
    sceneState() { renderFrame(); return sceneModule.debugState?.(sim.t, state) ?? null; },
    setTime(t) { sim.t = t; renderFrame(); },
    stepFixed(frames, dt = 1 / 30) { for (let i = 0; i < frames; i++) sim.t += dt; renderFrame(frames * dt); return sim.t; },
    // Runs UI transitions forward without advancing simulation time.
    settleUi(seconds = 2, dt = 1 / 30) { for (let s = 0; s < seconds; s += dt) renderFrame(dt); },
  };

  return api;
}
