// Interactive unit pages: the seven-stage learner journey.
// Runs entirely in the browser: no network requests and no forms. The guide
// questions and Exam Coach feedback are fixed examples until the real AI
// service exists. Nothing is stored by this script.
(() => {
  const html = document.documentElement;
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches || html.classList.contains('a11y-reduce-motion');
  const app = document.querySelector('.aim-app[data-scene]');

  const store = {
    remove(key) { try { localStorage.removeItem(key); } catch { /* storage blocked: fine */ } },
  };

  const say = (box, nodes, tone) => {
    box.replaceChildren(...nodes);
    box.className = `feedback${tone ? ` is-${tone}` : ''}`;
  };
  const fromTemplate = (root, name) => {
    const t = root.querySelector(`:scope > template[data-fb="${name}"]`);
    return t ? [...t.content.cloneNode(true).childNodes] : null;
  };

  // There is no route switch: everything is open to everyone and Higher-tier
  // parts are labelled HT. Clear the route that older versions stored.
  store.remove('aim-route');

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
    // The diagram beside the chain: each placed link lights its part (data-part="n").
    const model = root.querySelector('[data-chain-model]');
    const light = () => {
      if (!model) return;
      for (const p of model.querySelectorAll('[data-part]')) p.classList.toggle('is-lit', Number(p.dataset.part) < next);
      model.dataset.lit = String(next - 1);
      model.classList.toggle('is-complete', next > total);
    };
    const setBroken = (on) => {
      model?.classList.toggle('is-broken', on);
      list.querySelector('.chain-broken')?.remove();
    };
    light();
    pool.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-step]');
      if (!b) return;
      if (Number(b.dataset.step) !== next) {
        // A wrong order visibly breaks the chain (and stalls the diagram).
        setBroken(true);
        const broken = document.createElement('li');
        broken.className = 'chain-broken';
        broken.textContent = `✗ ${b.textContent}`;
        list.append(broken);
        say(status, [document.createTextNode(root.dataset.hint || 'The chain breaks: that link cannot happen yet. What has to happen before it?')], 'try');
        return;
      }
      setBroken(false);
      const index = [...pool.children].indexOf(b);
      const li = document.createElement('li');
      li.textContent = b.textContent;
      list.append(li);
      b.remove();
      next += 1;
      light();
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
      setBroken(false);
      light();
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
    const unit = root.dataset.selfmarkLabel; // for example "indicative points" on a levels question
    const missing = document.createElement('ul');
    missing.className = 'selfmark-missing';
    const update = () => {
      const n = Math.min(max, boxes.filter((b) => b.checked).length);
      const left = boxes.filter((b) => !b.checked).map((b) => b.closest('label').textContent.trim());
      out.textContent = unit
        ? `You covered ${n} of ${max} ${unit}.${left.length ? ' To add:' : ' Nothing to add.'}`
        : `You gave yourself ${n} of ${max} mark${max === 1 ? '' : 's'}.${left.length ? ' To add for full marks:' : ' Full marks.'}`;
      missing.replaceChildren(...left.map((t) => { const li = document.createElement('li'); li.textContent = t; return li; }));
      if (!missing.isConnected) out.after(missing);
    };
    boxes.forEach((b) => b.addEventListener('change', update));
  }

  // ---- Exit check: "Got it" / "Not yet" builds a revisit list (nothing is stored) ---
  for (const root of document.querySelectorAll('[data-exit]')) {
    const plan = root.querySelector('[data-exit-plan]');
    const items = [...root.querySelectorAll('[data-revisit-href]')];
    const render = () => {
      const answered = items.filter((li) => li.dataset.result);
      const missed = items.filter((li) => li.dataset.result === 'no');
      if (!answered.length) { plan.replaceChildren(); return; }
      const p = document.createElement('p');
      const strong = document.createElement('strong');
      if (!missed.length) {
        strong.textContent = answered.length === items.length ? '✓ All secure. Come back on day 3 to check it has stuck.' : `${answered.length} of ${items.length} answered: nothing to revisit so far.`;
        p.append(strong);
        plan.replaceChildren(p);
        return;
      }
      strong.textContent = 'Revisit these first:';
      p.append(strong);
      const ul = document.createElement('ul');
      const seen = new Set();
      for (const li of missed) {
        if (seen.has(li.dataset.revisitHref)) continue;
        seen.add(li.dataset.revisitHref);
        const a = document.createElement('a');
        a.href = li.dataset.revisitHref;
        a.textContent = li.dataset.revisitLabel;
        const item = document.createElement('li');
        item.append(a);
        ul.append(item);
      }
      plan.replaceChildren(p, ul);
    };
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-exit-mark]');
      if (!b) return;
      const li = b.closest('[data-revisit-href]');
      li.dataset.result = b.dataset.exitMark;
      for (const x of li.querySelectorAll('[data-exit-mark]')) x.setAttribute('aria-pressed', String(x === b));
      render();
    });
  }

  // ---- Adaptive F = B I l practice: the level steps up or down with each answer -----
  // Questions are generated here, so they are original and different every time.
  for (const root of document.querySelectorAll('[data-adaptive]')) {
    const qEl = root.querySelector('[data-adaptive-q]');
    const levelEl = root.querySelector('[data-adaptive-level]');
    const symEl = root.querySelector('[data-adaptive-symbol]');
    const unitEl = root.querySelector('[data-adaptive-unit]');
    const input = root.querySelector('.calc-input');
    const box = root.querySelector('[data-feedback]');
    const hintsEl = root.querySelector('[data-adaptive-hints]');
    const hintBtn = root.querySelector('[data-adaptive-hint]');
    const checkBtn = root.querySelector('[data-adaptive-check]');
    const nextBtn = root.querySelector('[data-adaptive-next]');
    const LEVELS = ['Core: find the force', 'Units: convert first', 'Rearrange the equation', 'Stretch: rearrange and convert'];
    const pick = (list) => list[Math.floor(Math.random() * list.length)];
    const B = ['0.10', '0.20', '0.25', '0.40', '0.50'];
    const I = ['1.0', '2.0', '3.0', '4.0', '5.0'];
    const LM = ['0.10', '0.20', '0.30', '0.50'];
    const LCM = ['5.0', '8.0', '10', '12', '20', '25', '40', '50'];
    const fmt = (x) => String(Number(x.toPrecision(3)));
    const text = (s) => document.createTextNode(s);
    let level = 0; let q = null; let tries = 0; let hintsShown = 0; let done = false; let right = 0;

    function make(lv) {
      const b = pick(B); const i = pick(I);
      const cm = lv === 1 || lv === 3;
      const lShown = cm ? pick(LCM) : pick(LM);
      const l = cm ? Number(lShown) / 100 : Number(lShown);
      const lText = `${lShown} ${cm ? 'cm' : 'm'}`;
      const lWork = cm ? fmt(l) : lShown; // keep the given figures in the working
      const art = /^8/.test(lShown) ? 'An' : 'A';
      const f = Number(b) * Number(i) * l;
      const convert = cm ? `Convert the length to metres: ${lShown} cm = ${fmt(l)} m.` : 'The values are already in tesla, amperes and metres, so there is nothing to convert.';
      if (lv < 2) {
        return { symbol: 'F', unit: 'N', answer: f, slip: cm ? [f * 100] : [],
          text: `A wire carries a current of ${i} A. A length of ${lText} of the wire is at right angles to a magnetic field of flux density ${b} T. Calculate the force on the wire.`,
          hints: ['Write the equation: F = B I l.', convert, `Substitute: F = ${b} × ${i} × ${lWork}.`],
          working: `F = B I l = ${b} × ${i} × ${lWork} = ${fmt(f)} N` };
      }
      // Rearranged: find the current or the flux density. At the stretch level the force may be in millinewtons.
      const mN = lv === 3 && Math.random() < 0.5;
      const fText = mN ? `${fmt(f * 1000)} mN` : `${fmt(f)} N`;
      const conv = mN ? `${convert} Convert the force to newtons: ${fmt(f * 1000)} mN = ${fmt(f)} N.` : convert;
      if (Math.random() < 0.5) {
        return { symbol: 'I', unit: 'A', answer: Number(i), slip: cm ? [Number(i) / 100] : [],
          text: `${art} ${lText} length of wire is at right angles to a magnetic field of flux density ${b} T. The force on the wire is ${fText}. Calculate the current in the wire.`,
          hints: ['Rearrange F = B I l to make I the subject: I = F ÷ (B l).', conv, `Substitute: I = ${fmt(f)} ÷ (${b} × ${lWork}).`],
          working: `I = F ÷ (B l) = ${fmt(f)} ÷ (${b} × ${lWork}) = ${fmt(Number(i))} A` };
      }
      return { symbol: 'B', unit: 'T', answer: Number(b), slip: cm ? [Number(b) / 100] : [],
        text: `${art} ${lText} length of wire carries a current of ${i} A at right angles to a magnetic field. The force on the wire is ${fText}. Calculate the magnetic flux density.`,
        hints: ['Rearrange F = B I l to make B the subject: B = F ÷ (I l).', conv, `Substitute: B = ${fmt(f)} ÷ (${i} × ${lWork}).`],
        working: `B = F ÷ (I l) = ${fmt(f)} ÷ (${i} × ${lWork}) = ${fmt(Number(b))} T` };
    }
    function show() {
      q = make(level); tries = 0; hintsShown = 0; done = false;
      qEl.textContent = q.text;
      symEl.textContent = `${q.symbol} =`;
      unitEl.textContent = q.unit;
      levelEl.textContent = `Level ${level + 1} of ${LEVELS.length}: ${LEVELS[level]} · ${right} right so far`;
      root.dataset.level = String(level + 1);
      root.dataset.answer = String(Number(q.answer.toPrecision(6)));
      input.value = ''; input.disabled = false; checkBtn.disabled = false;
      hintsEl.replaceChildren();
      hintBtn.hidden = false; hintBtn.disabled = false; hintBtn.textContent = 'Show hint 1';
      nextBtn.hidden = true;
      say(box, []);
    }
    function finish(message, tone, newLevel) {
      done = true; input.disabled = true; checkBtn.disabled = true; hintBtn.disabled = true;
      const p1 = document.createElement('p'); p1.textContent = message;
      const p2 = document.createElement('p'); p2.textContent = q.working;
      const p3 = document.createElement('p');
      p3.textContent = newLevel > level ? 'Next question: one level harder.' : newLevel < level ? 'Next question: one level easier, to rebuild the method.' : 'Next question: the same level.';
      say(box, [p1, p2, p3], tone);
      level = newLevel;
      nextBtn.hidden = false; nextBtn.focus();
    }
    const close = (a, b) => Math.abs(a - b) <= Math.abs(b) * 0.02 + 1e-9;
    const check = () => {
      if (done) return;
      const v = parseNumber(input.value);
      if (Number.isNaN(v)) { say(box, [text('Type a number first (you can leave the unit off).')], 'try'); return; }
      if (close(v, q.answer)) {
        right += 1;
        const clean = tries === 0 && hintsShown === 0;
        finish(clean ? '✓ Correct, first time and without hints.' : '✓ Correct.', 'good', clean ? Math.min(LEVELS.length - 1, level + 1) : level);
        return;
      }
      tries += 1;
      if (tries >= 2) { finish('Not this time. Here is the working:', 'try', Math.max(0, level - 1)); return; }
      const slip = q.slip.some((s) => close(v, s));
      say(box, [text(slip ? 'That is 100 times out. Did you leave the length in centimetres? Try once more.' : 'Not quite. Take a hint, then try once more.')], 'try');
    };
    checkBtn.addEventListener('click', check);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); check(); } });
    hintBtn.addEventListener('click', () => {
      if (hintsShown >= q.hints.length) return;
      const li = document.createElement('li');
      const label = document.createElement('span'); label.className = 'ladder-label'; label.textContent = `Hint ${hintsShown + 1}`;
      li.append(label, text(q.hints[hintsShown]));
      hintsEl.append(li);
      hintsShown += 1;
      if (hintsShown >= q.hints.length) { hintBtn.textContent = 'All hints shown'; hintBtn.disabled = true; } else hintBtn.textContent = `Show hint ${hintsShown + 1}`;
    });
    nextBtn.addEventListener('click', () => { show(); input.focus(); });
    show();
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
