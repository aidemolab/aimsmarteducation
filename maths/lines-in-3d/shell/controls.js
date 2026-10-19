// Control panel. The scene declares which controls it needs, in which rows,
// in its stages.json ("controls.layout"); the shell renders only those.
// Wording also comes from stages.json, so the shell holds no topic text.
//
// Layout items:
//   "play" | "restart" | "speed" | "labels" | "tour" | "resetCamera"
//   "toggle:<option>"   a toggle from controls.toggles[]
//   "slider:<option>"   a slider from controls.sliders[] (shown only in its stages)
// Without a layout, the original motor layout is used.

const SPEEDS = [0.25, 0.5, 1, 1.5, 2];

const DEFAULT_LAYOUT = (cfg) => [
  ['play', 'restart', 'speed'],
  [...(cfg.toggles || []).map((t) => `toggle:${t.option}`), 'labels'],
  ['tour', 'resetCamera'],
];

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

function elRow(cls, children) {
  const r = el('div', { class: cls });
  r.append(...children);
  return r;
}

const uid = (p) => `${p}-${Math.random().toString(36).slice(2, 7)}`;

export function createControls(root, api, cfg) {
  const host = root.querySelector('.aim-controls');
  if (!host) return null;
  const { sim } = api;
  host.replaceChildren();
  host.append(el('h2', { class: 'aim-visually-hidden' }, 'Controls'));

  let syncPlay = () => {};
  let speedHint = null;
  const sliders = []; // { def, wrap, input, out, set(value) }

  const makers = {
    play() {
      const play = el('button', { type: 'button', class: 'aim-btn aim-btn-primary', 'data-control': 'play' });
      syncPlay = () => { play.textContent = sim.playing ? cfg.pauseLabel : cfg.playLabel; };
      play.addEventListener('click', () => {
        sim.playing = !sim.playing;
        // On pause, a slider that was showing a scene-driven value keeps it.
        if (!sim.playing) for (const s of sliders) if (s.pending != null) s.commit();
        syncPlay();
      });
      syncPlay();
      return play;
    },
    restart() {
      const restart = el('button', { type: 'button', class: 'aim-btn', 'data-control': 'restart' }, cfg.restartLabel);
      restart.addEventListener('click', () => { sim.t = 0; });
      return restart;
    },
    speed() {
      const speedId = uid('aim-speed');
      const speed = el('select', { id: speedId, 'data-control': 'speed', 'aria-describedby': `${speedId}-hint` });
      for (const s of SPEEDS) {
        const o = el('option', { value: String(s) }, `${s}×`);
        if (s === sim.speed) o.selected = true;
        speed.append(o);
      }
      speed.addEventListener('change', () => { sim.speed = Number(speed.value); });
      const speedWrap = el('div', { class: 'aim-speed' });
      speedWrap.append(el('label', { for: speedId }, cfg.speedLabel), speed);
      speedHint = el('p', { id: `${speedId}-hint`, class: 'aim-ctrl-hint' }, cfg.speedHint);
      return speedWrap;
    },
    labels() {
      if (!api.labels) return null;
      // Default: labels start on only for wide layouts. A scene can set
      // controls.labelsStartOn = true to start them on at every width.
      const labelsOn = cfg.labelsStartOn === true || root.clientWidth >= 700;
      api.labels.setVisible(labelsOn);
      const b = toggleButton(cfg.labelsLabel, labelsOn, (on) => api.labels.setVisible(on));
      b.dataset.control = 'labels';
      return b;
    },
    tour() {
      const tour = el('button', { type: 'button', class: 'aim-btn', 'data-control': 'tour' });
      const syncTour = () => {
        const on = !!api.tour?.active;
        tour.textContent = on ? cfg.stopTourLabel : cfg.tourLabel;
        tour.setAttribute('aria-pressed', String(on));
      };
      tour.addEventListener('click', () => (api.tour?.active ? api.tour.stop() : api.tour?.start()));
      api.tour?.onChange(syncTour);
      syncTour();
      return tour;
    },
    resetCamera() {
      const reset = el('button', { type: 'button', class: 'aim-btn', 'data-control': 'reset-camera' }, cfg.resetCameraLabel);
      reset.addEventListener('click', () => { api.tour?.stop(); api.cameraMove?.stop(); api.resetCamera(); });
      return reset;
    },
    toggle(option) {
      const t = (cfg.toggles || []).find((x) => x.option === option);
      if (!t) throw new Error(`controls.layout names toggle "${option}", but controls.toggles has no such entry`);
      api.setOption(t.option, t.value);
      const b = toggleButton(t.label, t.value, (on) => api.setOption(t.option, on));
      b.dataset.control = t.option;
      return b;
    },
    slider(option) {
      const def = (cfg.sliders || []).find((x) => x.option === option);
      if (!def) throw new Error(`controls.layout names slider "${option}", but controls.sliders has no such entry`);
      const id = uid('aim-sl');
      const digits = def.digits ?? 1;
      const input = el('input', {
        type: 'range', id, min: String(def.min), max: String(def.max), step: String(def.step), value: String(def.value),
        'data-control': def.option,
      });
      const out = el('output', { for: id, class: 'aim-slider-value' });
      const wrap = el('div', { class: 'aim-ctrl-slider' });
      wrap.append(el('label', { for: id, class: 'aim-slider-label' }, def.label), elRow('aim-slider-row', [input, out]));
      // Fixed decimals, true minus sign, no "−0.00".
      const show = (v) => {
        const s = Number(v).toFixed(digits);
        out.textContent = /^-0\.?0*$/.test(s) ? s.slice(1) : s.replace('-', '−');
      };
      const set = (v, notify = true) => {
        input.value = String(v);
        show(input.value);
        if (notify) api.setOption(def.option, Number(input.value));
      };
      const entry = { def, wrap, input, set, show, pending: null };
      entry.commit = () => { const v = entry.pending; entry.pending = null; api.setOption(def.option, v); };
      input.addEventListener('input', () => {
        entry.pending = null;
        // pausesPlayback: moving the slider takes manual control.
        if (def.pausesPlayback && sim.playing) { sim.playing = false; syncPlay(); }
        set(input.value);
      });
      set(def.value);
      sliders.push(entry);
      return wrap;
    },
  };

  function build(item) {
    const [kind, arg] = item.split(':');
    const make = makers[kind];
    if (!make) throw new Error(`Unknown control "${item}" in controls.layout`);
    return make(arg);
  }

  for (const rowItems of cfg.layout || DEFAULT_LAYOUT(cfg)) {
    const nodes = rowItems.map(build).filter(Boolean);
    if (!nodes.length) continue;
    const onlyToggles = rowItems.every((i) => i.startsWith('toggle:') || i === 'labels');
    const onlySliders = rowItems.every((i) => i.startsWith('slider:'));
    const cls = onlyToggles ? 'aim-ctrl-row aim-ctrl-toggles' : onlySliders ? 'aim-ctrl-sliders' : 'aim-ctrl-row';
    host.append(elRow(cls, nodes));
    if (speedHint && rowItems.includes('speed')) host.append(speedHint);
  }
  if (cfg.hint) host.append(el('p', { class: 'aim-ctrl-hint' }, cfg.hint));

  // Sliders appear only in the stages they list (0-based), and return to their
  // default value whenever the stage changes.
  function setStage(i) {
    for (const s of sliders) {
      const visible = !s.def.stages || s.def.stages.includes(i);
      s.wrap.hidden = !visible;
      s.pending = null;
      s.set(s.def.value);
    }
    for (const row of host.querySelectorAll('.aim-ctrl-sliders')) {
      row.hidden = [...row.children].every((c) => c.hidden);
    }
  }

  // Escape stops the tour.
  root.addEventListener('keydown', (e) => { if (e.key === 'Escape') api.tour?.stop(); });

  return {
    syncPlay,
    setStage,
    // Lets the scene's moving state (e.g. a parameter swept by Play) show on a slider.
    showSliderValue(option, value) {
      const s = sliders.find((x) => x.def.option === option);
      if (s && document.activeElement !== s.input) { s.input.value = String(value); s.show(value); s.pending = value; }
    },
  };
}
