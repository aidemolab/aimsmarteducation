// Control panel: play/pause, restart, animation speed, scene toggles, labels,
// guided tour and camera reset. Text comes from the topic's stages.json
// ("controls"), so the shell itself holds no topic wording.

const SPEEDS = [0.25, 0.5, 1, 1.5, 2];

function el(tag, attrs = {}, text) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text != null) n.textContent = text;
  return n;
}

function toggleButton(label, initial, onChange) {
  const b = el('button', { type: 'button', class: 'aim-toggle', 'aria-pressed': String(!!initial) });
  b.append(el('span', { class: 'aim-toggle-track', 'aria-hidden': 'true' }), el('span', {}, label));
  b.addEventListener('click', () => {
    const on = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(on));
    onChange(on);
  });
  return b;
}

export function createControls(root, api, cfg) {
  const host = root.querySelector('.aim-controls');
  if (!host) return null;
  const { sim } = api;
  host.replaceChildren();
  host.append(el('h2', { class: 'aim-visually-hidden' }, 'Controls'));

  // Playback
  const play = el('button', { type: 'button', class: 'aim-btn aim-btn-primary', 'data-control': 'play' });
  const syncPlay = () => { play.textContent = sim.playing ? cfg.pauseLabel : cfg.playLabel; };
  play.addEventListener('click', () => { sim.playing = !sim.playing; syncPlay(); });
  syncPlay();
  const restart = el('button', { type: 'button', class: 'aim-btn', 'data-control': 'restart' }, cfg.restartLabel);
  restart.addEventListener('click', () => { sim.t = 0; });

  const speedId = `aim-speed-${Math.random().toString(36).slice(2, 7)}`;
  const speed = el('select', { id: speedId, 'data-control': 'speed', 'aria-describedby': `${speedId}-hint` });
  for (const s of SPEEDS) {
    const o = el('option', { value: String(s) }, `${s}×`);
    if (s === sim.speed) o.selected = true;
    speed.append(o);
  }
  speed.addEventListener('change', () => { sim.speed = Number(speed.value); });
  const speedWrap = el('div', { class: 'aim-speed' });
  speedWrap.append(el('label', { for: speedId }, cfg.speedLabel), speed);

  const row1 = el('div', { class: 'aim-ctrl-row' });
  row1.append(play, restart, speedWrap);
  const speedHint = el('p', { id: `${speedId}-hint`, class: 'aim-ctrl-hint' }, cfg.speedHint);

  // Scene toggles
  const row2 = el('div', { class: 'aim-ctrl-row aim-ctrl-toggles' });
  for (const t of cfg.toggles || []) {
    api.setOption(t.option, t.value);
    const b = toggleButton(t.label, t.value, (on) => api.setOption(t.option, on));
    b.dataset.control = t.option;
    row2.append(b);
  }
  if (api.labels) {
    const labelsOn = root.clientWidth >= 700;
    api.labels.setVisible(labelsOn);
    const b = toggleButton(cfg.labelsLabel, labelsOn, (on) => api.labels.setVisible(on));
    b.dataset.control = 'labels';
    row2.append(b);
  }

  // Camera
  const tour = el('button', { type: 'button', class: 'aim-btn', 'data-control': 'tour' });
  const syncTour = () => {
    const on = !!api.tour?.active;
    tour.textContent = on ? cfg.stopTourLabel : cfg.tourLabel;
    tour.setAttribute('aria-pressed', String(on));
  };
  tour.addEventListener('click', () => (api.tour?.active ? api.tour.stop() : api.tour?.start()));
  api.tour?.onChange(syncTour);
  syncTour();
  const reset = el('button', { type: 'button', class: 'aim-btn', 'data-control': 'reset-camera' }, cfg.resetCameraLabel);
  reset.addEventListener('click', () => { api.tour?.stop(); api.resetCamera(); });
  const row3 = el('div', { class: 'aim-ctrl-row' });
  row3.append(tour, reset);

  host.append(row1, speedHint, row2, row3, el('p', { class: 'aim-ctrl-hint' }, cfg.hint));

  // Escape stops the tour.
  root.addEventListener('keydown', (e) => { if (e.key === 'Escape') api.tour?.stop(); });

  return { syncPlay };
}
