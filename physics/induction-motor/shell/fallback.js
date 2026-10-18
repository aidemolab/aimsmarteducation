// WebGL detection and the HTML fallback shown when the 3D view cannot run.

export function hasWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && canvas.getContext('webgl2'));
  } catch {
    return false;
  }
}

const MESSAGES = {
  webgl: 'Your browser or device does not support WebGL 2, which the 3D model needs.',
  deps: 'A file the 3D model needs did not load. Please check your connection and reload the page.',
  runtime: 'Something went wrong while drawing the 3D model.',
};

export function showFallback(root, kind, error) {
  const box = root.querySelector('.aim-error');
  const detail = root.querySelector('.aim-error-detail');
  root.querySelector('.aim-loading')?.setAttribute('hidden', '');
  root.querySelector('canvas.aim-canvas')?.setAttribute('hidden', '');
  root.classList.add('aim-failed');
  if (detail) detail.textContent = MESSAGES[kind] || MESSAGES.runtime;
  if (box) box.hidden = false;
  if (error) console.error(`[aim-shell] ${kind}:`, error);
}
