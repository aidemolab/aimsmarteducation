// Home page learning loop: the four "try it" steps.
// Runs entirely in the browser: no network requests, no storage, no forms.
// The AI examples on the page are static until the real AI service exists.

// Step 3: build the chain, cause to effect
function initChain(root) {
  const list = root.querySelector("[data-chain-list]");
  const pool = root.querySelector("[data-chain-pool]");
  const status = root.querySelector("[data-chain-status]");
  const reset = root.querySelector("[data-chain-reset]");
  const original = [...pool.children];
  let next = 1;

  const say = (text, tone) => {
    status.textContent = text;
    status.className = "feedback" + (tone ? ` is-${tone}` : "");
  };

  pool.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-step]");
    if (!button) return;
    if (Number(button.dataset.step) !== next) {
      say("Not yet. What has to happen before that?", "try");
      return;
    }
    const remaining = [...pool.children];
    const index = remaining.indexOf(button);
    const item = document.createElement("li");
    item.textContent = button.textContent;
    list.append(item);
    button.remove();
    next += 1;

    if (!pool.children.length) {
      say("✓ Chain complete. Each link is a marking point: this is the structure of a full-mark answer.", "good");
      reset.focus();
    } else {
      say(`Link ${next - 1} of 4 in place.`);
      // Keep keyboard focus in the pool
      const target = pool.children[Math.min(index, pool.children.length - 1)];
      target.focus();
    }
  });

  reset.addEventListener("click", () => {
    list.replaceChildren();
    pool.replaceChildren(...original);
    next = 1;
    say("");
    original[0].focus();
  });
}

// Step 4: spot the trap (true or false)
function initTrap(root) {
  const buttons = [...root.querySelectorAll("button[data-answer]")];
  const status = root.querySelector("[data-trap-status]");

  root.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-answer]");
    if (!button) return;
    buttons.forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
    if (button.dataset.answer === "true") {
      status.className = "feedback is-try";
      status.textContent = "That's the trap. A common idea, but there's no magnet in the rotor. AI coach: “If there's no magnet, what could make the bars magnetic for a moment?”";
    } else {
      status.className = "feedback is-good";
      status.textContent = "✓ You spotted the trap. The rotor has no magnet. The field induces currents in its bars, and those currents feel the force.";
    }
  });
}

// Step 5: set the rotor speed where the turning force is zero
function initSpeed(root) {
  const buttons = [...root.querySelectorAll("button[data-force]")];
  const bar = root.querySelector("[data-speed-bar]");
  const status = root.querySelector("[data-speed-status]");

  root.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-force]");
    if (!button) return;
    buttons.forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
    const force = Number(button.dataset.force);
    bar.style.width = `${force}%`;
    if (force === 0) {
      status.className = "feedback is-good";
      status.textContent = "✓ Done it. Now say it: why is there no turning force when the rotor matches the field's speed?";
    } else {
      status.className = "feedback";
      status.textContent = `Rotor at ${button.textContent}: turning force ${force}% (illustrative). Not zero yet.`;
    }
  });
}

// Step 6: example Exam Coach feedback (static, no AI call)
function initCoach(root) {
  const button = root.querySelector("[data-coach-check]");
  const result = root.querySelector("[data-coach-result]");
  button.addEventListener("click", () => {
    result.hidden = false;
    button.setAttribute("aria-expanded", "true");
  });
}

document.querySelectorAll("[data-chain]").forEach(initChain);
document.querySelectorAll("[data-trap]").forEach(initTrap);
document.querySelectorAll("[data-speed]").forEach(initSpeed);
document.querySelectorAll("[data-coach]").forEach(initCoach);
