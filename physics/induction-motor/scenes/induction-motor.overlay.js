// 2D overlay for the induction motor scene: supply-current chart, field
// vector dial, speed/slip readouts and captions. Drawn as SVG/HTML so text
// stays crisp. Updated every frame from the same model values as the 3D view.
import { PHASE_AXES } from './induction-motor.model.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function svg(tag, attrs = {}, parent) {
  const n = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  parent?.append(n);
  return n;
}

function div(cls, parent, text) {
  const n = document.createElement('div');
  n.className = cls;
  if (text != null) n.textContent = text;
  parent?.append(n);
  return n;
}

// Chart geometry (SVG user units)
const X0 = 30;
const X1 = 290;
const Y0 = 80;
const AMP = 40;
const xFor = (phase) => X0 + ((X1 - X0) * phase) / (2 * Math.PI);

export function createOverlay(container, phases) {
  const hex = phases.map((p) => `#${p.colour.toString(16).padStart(6, '0')}`);
  container.setAttribute('aria-hidden', 'true'); // live visuals; the stage text carries the explanation

  const dock = div('aim-ov-dock', container);

  // ---- Phase chart ----
  const chartBox = div('aim-ov-panel aim-ov-chart', dock);
  const chart = svg('svg', { viewBox: '0 0 300 140', class: 'aim-ov-svg' }, chartBox);
  const chartTitle = svg('text', { x: 8, y: 16, class: 'aim-ov-title' }, chart);
  phases.forEach((p, k) => {
    const t = svg('text', { x: 222 + k * 24, y: 16, class: 'aim-ov-key', fill: hex[k] }, chart);
    t.textContent = p.key;
  });
  svg('line', { x1: X0, y1: Y0, x2: X1, y2: Y0, class: 'aim-ov-axis' }, chart);
  for (const deg of [0, 120, 240, 360]) {
    const x = xFor((deg * Math.PI) / 180);
    svg('line', { x1: x, y1: Y0 - AMP - 4, x2: x, y2: Y0 + AMP + 4, class: 'aim-ov-grid' }, chart);
    const lab = svg('text', { x, y: 136, class: 'aim-ov-tick', 'text-anchor': 'middle' }, chart);
    lab.textContent = `${deg}°`;
  }
  PHASE_AXES.forEach((a, k) => {
    let d = '';
    for (let i = 0; i <= 96; i++) {
      const ph = (i / 96) * 2 * Math.PI;
      d += `${i ? 'L' : 'M'}${xFor(ph).toFixed(1)},${(Y0 - AMP * Math.cos(ph - a)).toFixed(1)}`;
    }
    svg('path', { d, class: 'aim-ov-wave', stroke: hex[k] }, chart);
  });
  const cursor = svg('line', { y1: Y0 - AMP - 8, y2: Y0 + AMP + 8, class: 'aim-ov-cursor' }, chart);
  const dots = PHASE_AXES.map((_, k) => svg('circle', { r: 4.5, fill: hex[k], class: 'aim-ov-dot' }, chart));

  // ---- Field dial (vector sum) ----
  const dialBox = div('aim-ov-panel aim-ov-dial', dock);
  const dial = svg('svg', { viewBox: '-64 -64 128 150', class: 'aim-ov-svg' }, dialBox);
  svg('circle', { r: 50, class: 'aim-ov-ring' }, dial);
  const SCALE = 46 / 1.5;
  PHASE_AXES.forEach((a, k) => {
    svg('line', { x1: 0, y1: 0, x2: 50 * Math.cos(a), y2: -50 * Math.sin(a), stroke: hex[k], class: 'aim-ov-axisline' }, dial);
    const lab = svg('text', { x: 58 * Math.cos(a), y: -58 * Math.sin(a) + 4, fill: hex[k], class: 'aim-ov-key', 'text-anchor': 'middle' }, dial);
    lab.textContent = phases[k].key;
  });
  const comps = PHASE_AXES.map((_, k) => svg('line', { x1: 0, y1: 0, stroke: hex[k], class: 'aim-ov-comp' }, dial));
  const resultant = svg('line', { x1: 0, y1: 0, class: 'aim-ov-result', 'marker-end': 'url(#aim-ov-head)' }, dial);
  const defs = svg('defs', {}, dial);
  const marker = svg('marker', { id: 'aim-ov-head', viewBox: '0 0 10 10', refX: 6, refY: 5, markerWidth: 4, markerHeight: 4, orient: 'auto' }, defs);
  svg('path', { d: 'M0,0 L10,5 L0,10 z', class: 'aim-ov-headpath' }, marker);
  const dialTitle = svg('text', { x: 0, y: 80, class: 'aim-ov-title', 'text-anchor': 'middle' }, dial);

  // ---- Readouts and caption ----
  const readout = div('aim-ov-panel aim-ov-readout', container);
  const rows = ['field', 'rotor', 'slip'].map((key) => {
    const row = div(`aim-ov-row aim-ov-row-${key}`, readout);
    return { label: div('aim-ov-label', row), value: div('aim-ov-value', row) };
  });
  const readoutNote = div('aim-ov-small', readout);
  const caption = div('aim-ov-caption', container);

  const show = (node, on) => { node.hidden = !on; };

  return {
    chart,
    setText(ui = {}) {
      chartTitle.textContent = ui.chartTitle || '';
      dialTitle.textContent = ui.dialTitle || '';
      rows[0].label.textContent = ui.fieldSpeed || '';
      rows[1].label.textContent = ui.rotorSpeed || '';
      rows[2].label.textContent = ui.slip || '';
      readoutNote.textContent = ui.relativeNote || '';
    },
    setVisible({ chart: c = false, dial: d = false, readout: r = false } = {}) {
      show(chartBox, c);
      show(dialBox, d);
      show(readout, r);
      show(dock, c || d);
    },
    setCaption(text) {
      caption.textContent = text || '';
      show(caption, !!text);
    },
    update({ phase, currents, field, rotorRatio, slip }) {
      const x = xFor(phase).toFixed(2);
      cursor.setAttribute('x1', x);
      cursor.setAttribute('x2', x);
      chart.dataset.phase = phase.toFixed(5);
      // Component vectors drawn tip-to-tail, so the white resultant is visibly their sum.
      let cx = 0;
      let cy = 0;
      currents.forEach((i, k) => {
        dots[k].setAttribute('cx', x);
        dots[k].setAttribute('cy', (Y0 - AMP * i).toFixed(2));
        const a = PHASE_AXES[k];
        const nx = cx + SCALE * i * Math.cos(a);
        const ny = cy - SCALE * i * Math.sin(a);
        comps[k].setAttribute('x1', cx.toFixed(2));
        comps[k].setAttribute('y1', cy.toFixed(2));
        comps[k].setAttribute('x2', nx.toFixed(2));
        comps[k].setAttribute('y2', ny.toFixed(2));
        cx = nx;
        cy = ny;
      });
      resultant.setAttribute('x2', (SCALE * field.x).toFixed(2));
      resultant.setAttribute('y2', (-SCALE * field.y).toFixed(2));
      rows[0].value.textContent = '1.00';
      rows[1].value.textContent = rotorRatio.toFixed(2);
      rows[2].value.textContent = `${Math.round(slip * 100)}%`;
    },
  };
}
