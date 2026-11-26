// AIM Smart Education, GCSE Maths 3.1.1: the Zoomable Number Scale (standard form).
// One goal: write a positive target number in standard form without changing its value.
// The learner predicts first, makes ONE change, then reads the feedback. Flat scene: the idea is a line.
import * as THREE from "../../assets/vendor/three/0.170.0/three.module.min.js";

// Each round: coefficient = m x 10^s, power of ten = 10^n. Scale shows 10^min to 10^max.
// All arithmetic is exact: m never changes, only the integer exponents s and n do.
const ROUNDS = [
  { m: 35, s: 0, n: 4, min: 3, max: 7 },   // 35 x 10^4 = 350 000 -> 3.5 x 10^5
  { m: 6, s: -1, n: 3, min: 1, max: 5 },   // 0.6 x 10^3 = 600 -> 6 x 10^2
  { m: 240, s: 0, n: 2, min: 2, max: 6 }   // 240 x 10^2 = 24 000 -> 2.4 x 10^4 (two passes)
];

const W = 340, H = 240, X0 = 30, X1 = 310, AXIS_Y = 120;
const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
const sup = (k) => String(k).split("").map((c) => SUP[c]).join("");
const pow = (k) => "10" + sup(k);

function group(ip) {
  if (ip.length <= 4) return ip;
  return ip.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
// Exact decimal for m x 10^e.
function dec(m, e) {
  let ds = String(m);
  if (e >= 0) return group(ds + "0".repeat(e));
  const k = ds.length + e;
  let ip, fp;
  if (k > 0) { ip = ds.slice(0, k); fp = ds.slice(k); } else { ip = "0"; fp = "0".repeat(-k) + ds; }
  fp = fp.replace(/0+$/, "");
  return fp ? group(ip) + "." + fp : group(ip);
}
const digits = (m) => String(m).length;

const $ = (sel) => document.querySelector(sel);
const els = {};
let st = null;           // round state
let roundIndex = 0;
let renderer = null, scene = null, camera = null;
let anim = null;

function newState(r) {
  return {
    m: r.m, s: r.s, n: r.n, te: r.s + r.n, min: r.min, max: r.max,
    phase: "coef",        // coef -> index -> (coef again if not yet standard) -> done
    pick: null,           // learner's prediction
    oldE: null,           // where the pin was before the last change (exponent of value)
    missE: null,          // a tried power of ten that missed the target
    lastCoefDir: null     // "div" or "mul"
  };
}

const valueE = () => st.s + st.n;                     // value = m x 10^(s+n)
const coefInRange = () => digits(st.m) - 1 + st.s === 0;  // 1 <= m x 10^s < 10
const coefDir = () => (digits(st.m) - 1 + st.s > 0 ? "div" : "mul");
const coefText = () => dec(st.m, st.s);
const logPos = (e) => Math.log10(st.m) + e;
const xOf = (e) => {
  const t = (logPos(e) - st.min) / (st.max - st.min);
  return X0 + Math.min(1, Math.max(0, t)) * (X1 - X0);
};
const reduceMotion = () =>
  document.documentElement.classList.contains("a11y-reduce-motion") ||
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Options for each phase ---------- */
function options() {
  if (st.phase === "coef") {
    const e = valueE();
    return [
      { key: -1, e: e - 1, label: "Moves one step left: " + dec(st.m, e - 1) },
      { key: 0, e: e, label: "Stays on the target: " + dec(st.m, e) },
      { key: 1, e: e + 1, label: "Moves one step right: " + dec(st.m, e + 1) }
    ];
  }
  if (st.phase === "index") {
    const ks = st.lastCoefDir === "div" ? [st.n - 1, st.n + 1, st.n + 2] : [st.n - 2, st.n - 1, st.n + 1];
    return ks.map((k) => ({ key: k, e: st.s + k, label: "Use " + pow(k) }));
  }
  return [];
}

function promptText() {
  if (st.phase === "coef") {
    const verb = coefDir() === "div" ? "divide the coefficient " + coefText() + " by 10" : "multiply the coefficient " + coefText() + " by 10";
    return "Predict first: if you " + verb + " and keep " + pow(st.n) + ", where will your pin land? Choose below or drag the dashed pin on the scale.";
  }
  if (st.phase === "index") {
    return "Now predict: which power of ten will bring your pin back to the target? One change only.";
  }
  return "Done. Press \u201cTry another target\u201d for a new number.";
}

function actionText() {
  if (st.phase === "coef") return coefDir() === "div" ? "Divide the coefficient by 10" : "Multiply the coefficient by 10";
  if (st.phase === "index") return "Try my power of ten";
  return "Goal reached";
}

/* ---------- DOM ---------- */
function buildChoices() {
  const box = els.prediction;
  box.textContent = "";
  for (const o of options()) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "q-choice";
    b.dataset.choice = String(o.key);
    b.setAttribute("aria-pressed", "false");
    b.textContent = o.label;
    b.addEventListener("click", () => choose(o.key));
    box.appendChild(b);
  }
}

function choose(key) {
  if (st.phase === "done") return;
  st.pick = key;
  els.prediction.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.choice === String(key))));
  els.action.disabled = false;
  draw();
}

function updateCards() {
  els.coef.textContent = coefText();
  els.power.textContent = pow(st.n);
  els.value.textContent = "= " + dec(st.m, valueE());
  const bad = !coefInRange();
  els.coef.style.background = bad ? "var(--accent-soft)" : "";
  els.coef.style.boxShadow = bad ? "inset 0 0 0 2px #C98A00" : "";
  els.coef.style.padding = "0 6px";
  els.coef.style.borderRadius = "6px";
  els.coef.title = bad ? "Not between 1 and 10" : "";
}

function updateScene() {
  const parts = ["Scale from " + pow(st.min) + " to " + pow(st.max) + "; each step to the right is ten times bigger.", "Target pin at " + dec(st.m, st.te) + "."];
  if (valueE() === st.te) parts.push("Your pin is on the target.");
  else parts.push("Your pin is at " + dec(st.m, valueE()) + ", " + factorWords(valueE(), st.te) + " the target.");
  if (st.oldE !== null) parts.push("Before the last change it was at " + dec(st.m, st.oldE) + ".");
  if (st.missE !== null) parts.push("Your last try landed at " + dec(st.m, st.missE) + ".");
  const prefix = renderer ? "" : "The picture could not be drawn on this device, but this text shows the same evidence. ";
  els.scene.textContent = prefix + parts.join(" ");
}

function factorWords(e, target) {
  const d = target - e;
  const f = group("1" + "0".repeat(Math.abs(d)));
  return d > 0 ? f + " times smaller than" : f + " times bigger than";
}

function refresh() {
  updateCards();
  updateScene();
  els.prompt.textContent = promptText();
  buildChoices();
  els.action.textContent = actionText();
  els.action.disabled = true;
  els.reset.textContent = st.phase === "done" ? "Try another target" : "Start again";
  draw();
}

function setFeedback(kind, text) {
  els.feedback.className = "q-feedback " + (kind === "right" ? "is-right" : "is-wrong");
  els.feedback.textContent = text;
}

/* ---------- The action: one change ---------- */
function act() {
  if (st.pick === null || st.phase === "done") return;
  if (st.phase === "coef") doCoef();
  else if (st.phase === "index") doIndex();
}

function doCoef() {
  const dir = coefDir();
  const before = valueE();
  const oldCoef = coefText();
  st.s += dir === "div" ? -1 : 1;
  st.lastCoefDir = dir;
  st.oldE = before;
  st.missE = null;
  const actual = dir === "div" ? -1 : 1;
  const held = st.pick === actual;
  const where = dec(st.m, valueE());
  const why = dir === "div"
    ? "Why: the value is the coefficient times the power of ten. You divided " + oldCoef + " by 10 and kept " + pow(st.n) + ", so the whole value became ten times smaller and the pin moved one step left."
    : "Why: the value is the coefficient times the power of ten. You multiplied " + oldCoef + " by 10 and kept " + pow(st.n) + ", so the whole value became ten times bigger and the pin moved one step right.";
  let head;
  if (held) head = "Your prediction held: your pin landed at " + where + ".";
  else if (st.pick === 0) head = "Your prediction did not hold: the pin did not stay on the target. It moved to " + where + ".";
  else head = "Your prediction did not hold: the pin moved the other way, to " + where + ".";
  setFeedback(held ? "right" : "wrong", head + " " + why + " " + coefText() + " × " + pow(st.n) + " is not the target\u2019s value, so one more change is needed.");
  st.phase = "index";
  st.pick = null;
  startAnim(before, valueE());
  refresh();
}

function doIndex() {
  const k = st.pick;
  const before = valueE();
  const tried = st.s + k;
  const undo = st.lastCoefDir === "div"
    ? "Dividing the coefficient by 10 made the value ten times smaller, so the power of ten must make it ten times bigger again: it must go up by one."
    : "Multiplying the coefficient by 10 made the value ten times bigger, so the power of ten must make it ten times smaller again: it must go down by one.";
  if (tried === st.te) {
    st.n = k;
    st.oldE = before;
    st.missE = null;
    st.pick = null;
    startAnim(before, valueE());
    if (coefInRange()) {
      st.phase = "done";
      setFeedback("right", "Your prediction held: the pin is back on the target and " + coefText() + " is between 1 and 10, so " + coefText() + " × " + pow(st.n) + " is in standard form. Why: " + undo.charAt(0).toLowerCase() + undo.slice(1) + " Think about it: why did the second change undo the first?");
    } else {
      st.phase = "coef";
      setFeedback("wrong", "Your prediction held: the pin is back on the target. Same value; not yet in standard form: " + coefText() + " is not between 1 and 10 (see the highlighted card). Why the pin came back: " + undo.charAt(0).toLowerCase() + undo.slice(1) + " Make the next pair of changes.");
    }
  } else {
    st.missE = tried;
    st.pick = null;
    setFeedback("wrong", "Your prediction did not hold: with " + pow(k) + " the pin would land at " + dec(st.m, tried) + ", which is " + factorWords(tried, st.te) + " the target. Why: " + undo.charAt(0).toLowerCase() + undo.slice(1) + " Your cards are back to " + coefText() + " × " + pow(st.n) + "; predict again.");
  }
  refresh();
}

function reset(next) {
  if (next) roundIndex = (roundIndex + 1) % ROUNDS.length;
  st = newState(ROUNDS[roundIndex]);
  anim = null;
  els.feedback.textContent = "";
  els.feedback.className = "q-feedback";
  refresh();
}

/* ---------- Three.js flat scene ---------- */
function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function label(text, x, y, color, size = 13, weight = 600, align = "center", bg = null) {
  const scale = 2;
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d");
  const font = weight + " " + size * scale + "px \"Source Sans 3\", system-ui, sans-serif";
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 4 * scale;
  const h = Math.ceil(size * 1.4 * scale);
  c.width = w; c.height = h;
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); }
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.fillText(text, 2 * scale, h / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w / scale, h / scale), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  let px = x;
  if (align === "center") px = Math.min(W - w / scale / 2 - 1, Math.max(w / scale / 2 + 1, x));
  mesh.position.set(px, y, 1);
  scene.add(mesh);
}

function rect(x, y, w, h, color, opacity = 1) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity }));
  m.position.set(x, y, 0);
  scene.add(m);
}

function pin(x, up, len, color, opacity = 1, dashed = false) {
  const y0 = AXIS_Y, y1 = up ? AXIS_Y + len : AXIS_Y - len;
  if (dashed) {
    for (let y = Math.min(y0, y1); y < Math.max(y0, y1); y += 8) rect(x, y + 2, 2, 4, color, opacity);
  } else {
    rect(x, (y0 + y1) / 2, 3, len, color, opacity);
  }
  const head = new THREE.Mesh(new THREE.CircleGeometry(6, 24), new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity }));
  head.position.set(x, y1, 0.5);
  scene.add(head);
}

function clearScene() {
  for (const o of [...scene.children]) {
    scene.remove(o);
    o.geometry && o.geometry.dispose();
    if (o.material) { o.material.map && o.material.map.dispose(); o.material.dispose(); }
  }
}

function ghostE() {
  if (st.phase !== "coef") return null;
  if (st.pick === null) return valueE();
  const o = options().find((p) => p.key === st.pick);
  return o ? o.e : null;
}

function draw() {
  if (!renderer) return;
  clearScene();
  const ink = cssVar("--ink", "#14161F"), muted = cssVar("--ink-muted", "#545866");
  const brand = cssVar("--brand", "#3B3FB6"), line = cssVar("--line", "#E3E4EA");
  const mine = "#C2410C", grey = "#6B7080";
  const bg = cssVar("--surface", "#FFFFFF");
  renderer.setClearColor(bg);
  const tag = (text, x, y, color, size = 13, weight = 700) => label(text, x, y, color, size, weight, "center", bg);

  // Axis and power-of-ten ticks.
  rect((X0 + X1) / 2, AXIS_Y, X1 - X0, 2, ink);
  for (let k = st.min; k <= st.max; k++) {
    const x = X0 + ((k - st.min) / (st.max - st.min)) * (X1 - X0);
    rect(x, AXIS_Y, 2, 12, ink);
    label(pow(k), x, AXIS_Y - 18, muted, 13, 600);
  }

  const xt = xOf(st.te);
  pin(xt, true, 46, brand);
  tag("target " + dec(st.m, st.te), xt, AXIS_Y + 60, brand, 13, 700);

  if (st.oldE !== null && st.oldE !== valueE()) {
    pin(xOf(st.oldE), false, 66, grey, 0.8);
    tag("before " + dec(st.m, st.oldE), xOf(st.oldE), AXIS_Y - 80, grey, 12, 600);
  }
  if (st.missE !== null) {
    pin(xOf(st.missE), false, 66, grey, 0.8, true);
    tag("tried " + dec(st.m, st.missE), xOf(st.missE), AXIS_Y - 80, grey, 12, 600);
  }

  // Your pin (animated between steps, then still).
  let e = valueE(), xc = xOf(e);
  if (anim) {
    const t = Math.min(1, (performance.now() - anim.t0) / 700);
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    xc = xOf(anim.from) + (xOf(anim.to) - xOf(anim.from)) * ease;
    if (t >= 1) anim = null;
  }
  pin(xc, false, 40, mine);
  tag("your pin " + dec(st.m, e), xc, AXIS_Y - 52, mine, 13, 700);

  // Scale factor between your pin and the target when they differ.
  const fromE = st.missE !== null ? st.missE : e;
  if (fromE !== st.te && !anim) {
    const xa = xOf(fromE), xb = xt, y = 28;
    rect((xa + xb) / 2, y, Math.abs(xb - xa), 2, ink);
    rect(xa, y, 2, 10, ink); rect(xb, y, 2, 10, ink);
    const d = st.te - fromE;
    label((d > 0 ? "× " : "÷ ") + group("1" + "0".repeat(Math.abs(d))) + " to reach the target", (xa + xb) / 2, y - 14, ink, 12, 600);
  }

  // Ghost pin for the first prediction (draggable).
  const g = ghostE();
  if (g !== null) {
    pin(xOf(g), true, 86, mine, 0.55, true);
    tag(st.pick === null ? "drag me: your guess" : "your guess", xOf(g), AXIS_Y + 100, mine, 12, 600);
  }

  renderer.render(scene, camera);
  if (anim) requestAnimationFrame(draw);
}

function startAnim(from, to) {
  if (reduceMotion() || from === to) { anim = null; return; }
  anim = { from, to, t0: performance.now() };
}

/* ---------- Dragging the ghost pin ---------- */
function setupDrag(canvas) {
  let dragging = false;
  const pickAt = (ev) => {
    if (st.phase !== "coef") return;
    const r = canvas.getBoundingClientRect();
    const x = ((ev.clientX - r.left) * W) / r.width;
    let best = null, bd = Infinity;
    for (const o of options()) {
      const d = Math.abs(xOf(o.e) - x);
      if (d < bd) { bd = d; best = o; }
    }
    if (best) choose(best.key);
  };
  canvas.addEventListener("pointerdown", (ev) => {
    if (st.phase !== "coef") return;
    dragging = true;
    canvas.setPointerCapture(ev.pointerId);
    pickAt(ev);
  });
  canvas.addEventListener("pointermove", (ev) => { if (dragging) pickAt(ev); });
  const stop = () => { dragging = false; };
  canvas.addEventListener("pointerup", stop);
  canvas.addEventListener("pointercancel", stop);
}

/* ---------- Start ---------- */
function init() {
  els.goal = $("[data-sim=goal]");
  els.prediction = $("[data-sim=prediction]");
  els.action = $("[data-sim=action]");
  els.reset = $("[data-sim=reset]");
  els.feedback = $("[data-sim=feedback]");
  els.prompt = $("[data-sim=prompt]");
  els.scene = $("[data-sim=scene]");
  els.coef = $("[data-card=coef]");
  els.power = $("[data-card=power]");
  els.value = $("[data-card=value]");
  const canvas = $("[data-sim=canvas]");
  if (!els.prediction || !els.action || !els.feedback || !canvas) return;

  // Fit any screen: the drawing buffer stays 340 x 240, the box scales down.
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.maxWidth = W + "px";
  canvas.style.height = "auto";
  canvas.style.margin = "8px 0";
  canvas.style.border = "1px solid var(--line)";
  canvas.style.borderRadius = "12px";
  canvas.style.touchAction = "none";
  els.prediction.style.gridTemplateColumns = "repeat(auto-fit, minmax(min(100%, 150px), 1fr))";
  els.prediction.style.marginBottom = "12px";

  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(0, W, H, 0, -10, 10);
  } catch (err) {
    renderer = null;
    els.scene.dataset.fallback = "true";
  }

  els.action.addEventListener("click", act);
  els.reset.addEventListener("click", () => reset(st.phase === "done"));
  setupDrag(canvas);
  reset(false);

  // Redraw when the learner switches high contrast.
  new MutationObserver(() => draw()).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
