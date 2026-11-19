// Interactive unit pages: the seven-stage learner journey.
// Runs entirely in the browser: no network requests and no forms. The guide
// questions and Exam Coach feedback are fixed examples until the real AI
// service exists. The only thing stored is the chosen route (Foundation or
// Higher), in this browser's local storage, so every stage page remembers it.
(() => {
  const html = document.documentElement;
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches || html.classList.contains('a11y-reduce-motion');
  const app = document.querySelector('.aim-app[data-scene]');

  const store = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch { /* storage blocked: fine */ } },
  };

  const say = (box, nodes, tone) => {
    box.replaceChildren(...nodes);
    box.className = `feedback${tone ? ` is-${tone}` : ''}`;
  };
  const fromTemplate = (root, name) => {
    const t = root.querySelector(`:scope > template[data-fb="${name}"]`);
    return t ? [...t.content.cloneNode(true).childNodes] : null;
  };

  // ---- Route: Foundation or Higher ------------------------------------------
  const routeButtons = [...document.querySelectorAll('[data-route]')];
  const routeNote = document.querySelector('[data-route-note]');
  function setRoute(route, save) {
    document.body.classList.toggle('route-foundation', route === 'foundation');
    document.body.classList.toggle('route-higher', route !== 'foundation');
    routeButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.route === route)));
    for (const d of document.querySelectorAll('details.ht-block')) d.open = route !== 'foundation';
    if (routeNote) {
      routeNote.textContent = route === 'foundation'
        ? 'Foundation route: everything on the field around a wire and a solenoid is open. Higher-tier (HT) sections are closed; open any of them to see the motor in action.'
        : 'Higher route: everything is open. Higher-tier (HT) sections are marked.';
    }
    if (save) store.set('aim-route', route);
  }
  routeButtons.forEach((b) => b.addEventListener('click', () => setRoute(b.dataset.route, true)));
  setRoute(store.get('aim-route') === 'foundation' ? 'foundation' : 'higher', false);

  // ---- "Try it in 3D": move the living model to a stage ----------------------
  function tryIn3D(stage, settings) {
    const go = () => {
      app?.aimStages?.go(stage);
      const ui = app?.aimApi?.controlsUi;
      if (ui && settings) for (const [k, v] of Object.entries(settings)) ui.setValue(k, v);
    };
    if (app?.aimStages) go();
    else app?.addEventListener('aim-stages', go, { once: true });
    // Settings need the 3D controls; apply them again once the view is running.
    if (settings && !app?.aimApi) app?.addEventListener('aim-ready', go, { once: true });
    app?.querySelector('.aim-viewport')?.scrollIntoView({ block: 'center', behavior: reduceMotion() ? 'auto' : 'smooth' });
  }
  // Units are split into one page per stage; only the Explore page holds the
  // 3D model. On other pages, "Try it in 3D" opens Explore at the right step
  // and offers a way straight back.
  const thisPage = location.pathname.split('/').pop() || 'index.html';
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-try-stage]');
    if (!b) return;
    let settings = null;
    try { settings = b.dataset.set ? JSON.parse(b.dataset.set) : null; } catch { settings = null; }
    if (!app) {
      const u = new URL('explore.html', location.href);
      u.searchParams.set('stage', b.dataset.tryStage);
      if (settings) u.searchParams.set('set', JSON.stringify(settings));
      u.searchParams.set('from', thisPage);
      location.href = u.href;
      return;
    }
    tryIn3D(Number(b.dataset.tryStage), settings);
  });

  // Arrived from another stage's "Try it in 3D": set the model and show a way back.
  if (app) {
    const params = new URLSearchParams(location.search);
    const from = params.get('from');
    if (params.has('stage')) {
      let settings = null;
      try { settings = params.get('set') ? JSON.parse(params.get('set')) : null; } catch { settings = null; }
      tryIn3D(Number(params.get('stage')) || 0, settings);
    }
    if (from && /^[a-z0-9-]+\.html$/.test(from)) {
      // Stage pages may be split into parts (explain-motor.html is part of explain.html).
      const link = [...document.querySelectorAll('.journey-link')]
        .find((a) => from.replace(/\.html$/, '').startsWith(a.getAttribute('href').replace(/\.html$/, '')));
      const name = link ? link.textContent.replace(/^\s*\d+\s*/, '').trim() : 'the previous stage';
      const bar = document.createElement('div');
      bar.className = 'try-return';
      bar.setAttribute('role', 'status');
      const p = document.createElement('p');
      p.textContent = `You came here from ${name} to try it in 3D.`;
      const back = document.createElement('a');
      back.className = 'u-btn u-btn-primary';
      back.href = from;
      back.textContent = `← Back to ${name}`;
      back.addEventListener('click', (ev) => {
        const ref = document.referrer && new URL(document.referrer);
        if (ref && ref.origin === location.origin && ref.pathname.endsWith('/' + from)) { ev.preventDefault(); history.back(); }
      });
      bar.append(p, back);
      document.querySelector('#stage-explore .stage-head')?.after(bar);
    }
  }

  // "Try again" buttons reload the page (no inline handlers: security policy).
  document.addEventListener('click', (e) => { if (e.target.closest('[data-reload]')) location.reload(); });

  // If the 3D view cannot run, open its steps as text.
  const words = document.querySelector('[data-model-words]');
  if (app && words) {
    const openIfFailed = () => { if (app.classList.contains('aim-failed')) words.open = true; };
    new MutationObserver(openIfFailed).observe(app, { attributes: true, attributeFilter: ['class'] });
    openIfFailed();
  }

  // ---- Choice questions (check, or predict-then-lock) ------------------------
  for (const q of document.querySelectorAll('[data-q]')) {
    const buttons = [...q.querySelectorAll('.choice[data-value]')];
    const box = q.querySelector('[data-feedback]');
    const correct = (q.dataset.correct || '').split(',');
    const predict = q.dataset.q === 'predict';
    q.addEventListener('click', (e) => {
      const b = e.target.closest('.choice[data-value]');
      if (!b || b.disabled) return;
      buttons.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      const v = b.dataset.value;
      if (predict) {
        buttons.forEach((x) => { x.disabled = true; });
        say(box, fromTemplate(q, 'locked') || [document.createTextNode('Prediction locked in.')]);
        return;
      }
      if (correct.includes(v)) {
        say(box, fromTemplate(q, 'right') || [document.createTextNode('✓ Correct.')], 'good');
      } else {
        say(box, fromTemplate(q, `wrong-${v}`) || fromTemplate(q, 'wrong') || [document.createTextNode('Not quite. Try again.')], 'try');
      }
    });
  }

  // ---- Build the chain: tap the links in order -------------------------------
  for (const root of document.querySelectorAll('[data-chain]')) {
    const list = root.querySelector('[data-chain-list]');
    const pool = root.querySelector('[data-chain-pool]');
    const status = root.querySelector('[data-chain-status]');
    const reset = root.querySelector('[data-chain-reset]');
    const original = [...pool.children];
    const total = original.length;
    let next = 1;
    pool.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-step]');
      if (!b) return;
      if (Number(b.dataset.step) !== next) {
        say(status, [document.createTextNode(root.dataset.hint || 'Not yet. What has to happen before that?')], 'try');
        return;
      }
      const index = [...pool.children].indexOf(b);
      const li = document.createElement('li');
      li.textContent = b.textContent;
      list.append(li);
      b.remove();
      next += 1;
      if (!pool.children.length) {
        say(status, [document.createTextNode(`✓ Chain complete: ${total} links, cause to effect. Each link is a marking point, so this is the shape of a full-mark answer.`)], 'good');
        reset.focus();
      } else {
        say(status, [document.createTextNode(`Link ${next - 1} of ${total} in place.`)]);
        pool.children[Math.min(index, pool.children.length - 1)].focus();
      }
    });
    reset.addEventListener('click', () => {
      list.replaceChildren();
      pool.replaceChildren(...original);
      next = 1;
      say(status, []);
      original[0].focus();
    });
  }

  // ---- Hint ladders: hints one at a time, then the model points ---------------
  for (const root of document.querySelectorAll('[data-ladder]')) {
    const steps = [...root.querySelectorAll('.ladder-steps > li')];
    const btn = root.querySelector('[data-ladder-next]');
    let shown = 0;
    steps.forEach((s) => { s.hidden = true; });
    const label = () => {
      if (shown >= steps.length) { btn.textContent = 'All hints shown'; btn.disabled = true; return; }
      btn.textContent = steps[shown].dataset.label || 'Show the next hint';
    };
    btn.hidden = false;
    btn.addEventListener('click', () => {
      if (shown < steps.length) {
        steps[shown].hidden = false;
        shown += 1;
      }
      label();
    });
    label();
  }

  // ---- Calculations -------------------------------------------------------------
  const parseNumber = (s) => {
    const m = String(s).replace(/[−–]/g, '-').replace(/,/g, '').match(/-?\d*\.?\d+(e-?\d+)?/i);
    return m ? Number(m[0]) : NaN;
  };
  for (const root of document.querySelectorAll('[data-calc]')) {
    const input = root.querySelector('.calc-input');
    const btn = root.querySelector('[data-calc-check]');
    const box = root.querySelector('[data-feedback]');
    const answer = Number(root.dataset.answer);
    const common = (root.dataset.common || '').split(',').filter(Boolean).map(Number);
    const check = () => {
      const v = parseNumber(input.value);
      if (Number.isNaN(v)) {
        say(box, [document.createTextNode('Type a number first (you can leave the unit off).')], 'try');
        return;
      }
      const close = (a, b) => Math.abs(a - b) <= Math.abs(b) * 0.02 + 1e-9;
      if (close(v, answer)) {
        say(box, fromTemplate(root, 'right') || [document.createTextNode('✓ Correct.')], 'good');
      } else if (common.some((c) => close(v, c))) {
        say(box, fromTemplate(root, 'common') || [document.createTextNode('Check your units.')], 'try');
      } else {
        say(box, fromTemplate(root, 'wrong') || [document.createTextNode('Not quite. Check each step.')], 'try');
      }
    };
    btn.addEventListener('click', check);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') check(); });
  }

  // ---- Fleming's left-hand rule trainer -------------------------------------------
  const DIRS = {
    right: [1, 0, 0], left: [-1, 0, 0], up: [0, 1, 0], down: [0, -1, 0], out: [0, 0, 1], in: [0, 0, -1],
  };
  const WORDS = {
    right: 'to the right (→)', left: 'to the left (←)', up: 'up the page (↑)', down: 'down the page (↓)',
    out: 'out of the page (⊙)', in: 'into the page (⊗)',
  };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dirName = (v) => Object.keys(DIRS).find((k) => DIRS[k].every((x, i) => x === v[i]));
  for (const root of document.querySelectorAll('[data-trainer]')) {
    let rounds = [];
    try { rounds = JSON.parse(root.dataset.trainer); } catch { rounds = []; }
    const fieldEl = root.querySelector('[data-trainer-field]');
    const currentEl = root.querySelector('[data-trainer-current]');
    const scoreEl = root.querySelector('[data-trainer-score]');
    const box = root.querySelector('[data-feedback]');
    const nextBtn = root.querySelector('[data-trainer-next]');
    const buttons = [...root.querySelectorAll('.choice[data-dir]')];
    let i = 0;
    let score = 0;
    let answered = false;
    const show = () => {
      const r = rounds[i];
      fieldEl.textContent = WORDS[r.field];
      currentEl.textContent = WORDS[r.current];
      scoreEl.textContent = `Round ${i + 1} of ${rounds.length} · ${score} correct so far`;
      buttons.forEach((b) => { b.setAttribute('aria-pressed', 'false'); b.disabled = false; });
      say(box, []);
      nextBtn.hidden = true;
      answered = false;
    };
    root.addEventListener('click', (e) => {
      const b = e.target.closest('.choice[data-dir]');
      if (!b || answered) return;
      const r = rounds[i];
      // Force direction: F ∝ I × B (current × field).
      const force = dirName(cross(DIRS[r.current], DIRS[r.field]));
      buttons.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      if (b.dataset.dir === force) {
        score += 1;
        say(box, [document.createTextNode(`✓ Yes: the force acts ${WORDS[force]}. First finger along the field, second finger along the current, thumb gives the motion.`)], 'good');
      } else {
        say(box, [document.createTextNode(`Not this time: the force acts ${WORDS[force]}. Point your left hand's first finger ${WORDS[r.field]} and second finger ${WORDS[r.current]}, then read your thumb.`)], 'try');
      }
      answered = true;
      buttons.forEach((x) => { x.disabled = true; });
      scoreEl.textContent = `Round ${i + 1} of ${rounds.length} · ${score} correct so far`;
      if (i < rounds.length - 1) { nextBtn.hidden = false; nextBtn.textContent = 'Next round'; }
      else { nextBtn.hidden = false; nextBtn.textContent = `Done: ${score} of ${rounds.length}. Start again`; }
      nextBtn.focus();
    });
    nextBtn.addEventListener('click', () => {
      if (i < rounds.length - 1) i += 1;
      else { i = 0; score = 0; }
      show();
      buttons[0].focus();
    });
    if (rounds.length) show();
  }

  // ---- Self-marking against the mark scheme ----------------------------------------
  for (const root of document.querySelectorAll('[data-selfmark]')) {
    const boxes = [...root.querySelectorAll('input[type="checkbox"]')];
    const out = root.querySelector('[data-selfmark-score]');
    const max = Number(root.dataset.selfmark) || boxes.length;
    const update = () => {
      const n = Math.min(max, boxes.filter((b) => b.checked).length);
      out.textContent = `You gave yourself ${n} of ${max} mark${max === 1 ? '' : 's'}.`;
    };
    boxes.forEach((b) => b.addEventListener('change', update));
  }

  // ---- Example Exam Coach feedback (static, no AI call) ----------------------------
  for (const root of document.querySelectorAll('[data-coach]')) {
    const btn = root.querySelector('[data-coach-check]');
    const result = root.querySelector('[data-coach-result]');
    btn.addEventListener('click', () => {
      result.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
    });
  }

})();
