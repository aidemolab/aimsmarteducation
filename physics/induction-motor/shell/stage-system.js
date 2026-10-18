// Stage system: loads <topic>.stages.json, renders stage navigation, the
// current stage's text, viewport badges, and the full stage-by-stage text
// as ordinary HTML (readable without WebGL).

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'text') node.textContent = v;
    else if (k === 'class') node.className = v;
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) if (c) node.append(c);
  return node;
}

function stageContent(stage, headingTag, index) {
  const frag = document.createDocumentFragment();
  frag.append(el(headingTag, { text: `Stage ${index + 1}: ${stage.title}` }));
  for (const p of stage.body || []) frag.append(el('p', { text: p }));
  if (stage.legend?.length) {
    const ul = el('ul', { class: 'aim-legend' });
    for (const item of stage.legend) {
      const sw = el('span', { class: 'aim-swatch', 'aria-hidden': 'true' });
      sw.style.background = item.swatch;
      ul.append(el('li', {}, [sw, document.createTextNode(item.text)]));
    }
    frag.append(ul);
  }
  for (const n of stage.notes || []) frag.append(el('p', { class: 'aim-note', text: n }));
  return frag;
}

// Static version of a predict-then-reveal block for the full-text section.
function interactionText(ix) {
  const details = el('details', { class: 'aim-reveal-static' }, [el('summary', { text: ix.revealLabel })]);
  for (const p of ix.reveal || []) details.append(el('p', { text: p }));
  if (ix.revealNote) details.append(el('p', { class: 'aim-note', text: ix.revealNote }));
  return el('div', {}, [el('p', { class: 'aim-question', text: ix.question }), details]);
}

// Live predict-then-reveal block: question, slider bound to a scene option, reveal button.
function interactionBlock(ix, setOption) {
  const id = `aim-ix-${Math.random().toString(36).slice(2, 8)}`;
  const box = el('section', { class: 'aim-interaction', 'aria-labelledby': `${id}-h` });
  box.append(el('h3', { id: `${id}-h`, text: ix.heading || '' }));
  box.append(el('p', { class: 'aim-question', text: ix.question }));
  if (ix.prompt) box.append(el('p', { text: ix.prompt }));

  const s = ix.slider;
  if (s) {
    const input = el('input', {
      type: 'range', id: `${id}-s`, min: String(s.min), max: String(s.max), step: String(s.step), value: String(s.value),
    });
    const out = el('output', { for: `${id}-s`, class: 'aim-slider-value', text: Number(s.value).toFixed(2) });
    input.addEventListener('input', () => {
      out.textContent = Number(input.value).toFixed(2);
      setOption?.(s.option, Number(input.value));
    });
    box.append(el('label', { for: `${id}-s`, class: 'aim-slider-label', text: s.label }), el('div', { class: 'aim-slider-row' }, [input, out]));
  }

  const answer = el('div', { class: 'aim-reveal', id: `${id}-a` });
  answer.hidden = true;
  for (const p of ix.reveal || []) answer.append(el('p', { text: p }));
  if (ix.revealNote) answer.append(el('p', { class: 'aim-note', text: ix.revealNote }));
  const btn = el('button', { type: 'button', class: 'aim-step-btn aim-reveal-btn', 'aria-expanded': 'false', 'aria-controls': `${id}-a`, text: ix.revealLabel });
  btn.addEventListener('click', () => {
    answer.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    btn.disabled = true;
  });
  box.append(btn, answer);
  return box;
}

export async function createStageSystem(root, onChange) {
  const url = new URL(root.dataset.stages, document.baseURI);
  const data = await (await fetch(url)).json();
  const stages = data.stages;

  const nav = root.querySelector('.aim-stage-nav');
  const current = root.querySelector('.aim-stage');
  const all = root.querySelector('.aim-all-stages');
  const badges = root.querySelector('.aim-badges');

  // Full text, all stages.
  if (all) {
    all.replaceChildren(el('h2', { text: 'Stage-by-stage explanation' }));
    stages.forEach((s, i) => all.append(el('section', { class: 'aim-all-stage', id: `stage-${s.id}` }, [
      stageContent(s, 'h3', i),
      s.interaction ? interactionText(s.interaction) : null,
    ])));
  }

  // Navigation.
  const list = el('ol', { class: 'aim-stage-list' });
  const buttons = stages.map((s, i) => {
    const b = el('button', { type: 'button', class: 'aim-stage-btn', 'data-stage': String(i) }, [
      el('span', { class: 'aim-stage-num', 'aria-hidden': 'true', text: String(i + 1) }),
      el('span', { class: 'aim-stage-name', text: s.title }),
    ]);
    b.addEventListener('click', () => go(i));
    list.append(el('li', {}, [b]));
    return b;
  });
  const prev = el('button', { type: 'button', class: 'aim-step-btn', text: '← Previous' });
  const next = el('button', { type: 'button', class: 'aim-step-btn', text: 'Next →' });
  prev.addEventListener('click', () => go(index - 1));
  next.addEventListener('click', () => go(index + 1));
  nav?.replaceChildren(el('h2', { class: 'aim-visually-hidden', text: 'Stages' }), list, el('div', { class: 'aim-step-row' }, [prev, next]));

  let index = -1;
  let setOption = null;
  function go(i) {
    i = Math.max(0, Math.min(stages.length - 1, i));
    if (i === index) return;
    // Leaving a stage with a slider: put its option back to the default.
    const leaving = stages[index]?.interaction?.slider;
    if (leaving) setOption?.(leaving.option, leaving.value);
    index = i;
    const s = stages[i];
    buttons.forEach((b, j) => {
      if (j === i) b.setAttribute('aria-current', 'step');
      else b.removeAttribute('aria-current');
    });
    prev.disabled = i === 0;
    next.disabled = i === stages.length - 1;
    current?.replaceChildren(stageContent(s, 'h2', i));
    if (s.interaction) {
      current?.append(interactionBlock(s.interaction, (name, value) => setOption?.(name, value)));
      if (s.interaction.slider) setOption?.(s.interaction.slider.option, s.interaction.slider.value);
    }
    badges?.replaceChildren(...(s.badges || []).map((t) => el('li', { class: 'aim-badge', text: t })));
    onChange?.(i, s, data);
  }

  go(0);
  return {
    data,
    stages,
    get index() { return index; },
    go,
    setOnChange(fn) { onChange = fn; fn(index, stages[index], data); },
    setOnOption(fn) { setOption = fn; },
  };
}
