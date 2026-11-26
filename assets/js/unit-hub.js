/* Unit hub mock-up: instant feedback for the sample explainer questions.
   Stores nothing and makes no network requests. */
(function () {
  "use strict";

  function show(box, right) {
    box.className = "q-feedback " + (right ? "is-right" : "is-wrong");
    box.textContent = right ? box.dataset.right : box.dataset.wrong;
  }

  // Accepts "0.45", ".45", "−0.45" (Unicode minus) and a comma decimal.
  function parseNumber(text) {
    var t = String(text).trim().replace(/−/g, "-").replace(",", ".");
    if (!/^-?(\d+\.?\d*|\.\d+)$/.test(t)) return NaN;
    return parseFloat(t);
  }

  document.querySelectorAll('[data-q="choice"]').forEach(function (card) {
    var box = card.querySelector(".q-feedback");
    var buttons = card.querySelectorAll(".q-choice");
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        buttons.forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
        show(box, btn.dataset.correct === "true");
      });
    });
  });

  document.querySelectorAll('[data-q="line"]').forEach(function (card) {
    var input = card.querySelector(".nl-input");
    var out = card.querySelector("[data-nl-out]");
    var box = card.querySelector(".q-feedback");
    function fmt(v) { return (v < 0 ? "−" : "") + Math.abs(v).toFixed(2).replace(/\.?0+$/, ""); }
    input.addEventListener("input", function () {
      out.textContent = fmt(parseFloat(input.value));
      input.setAttribute("aria-valuetext", fmt(parseFloat(input.value)));
    });
    card.querySelector(".q-check").addEventListener("click", function () {
      show(box, Math.abs(parseFloat(input.value) - parseFloat(box.dataset.target)) < 1e-9);
    });
  });

  document.querySelectorAll('[data-q="open"]').forEach(function (card) {
    var input = card.querySelector(".q-input");
    var box = card.querySelector(".q-feedback");
    function check() {
      var v = parseNumber(input.value);
      var min = parseFloat(box.dataset.min), max = parseFloat(box.dataset.max);
      if (isNaN(v)) {
        box.className = "q-feedback is-wrong";
        box.textContent = "Type a decimal number, for example 0.3.";
        return;
      }
      show(box, v > min && v < max);
    }
    card.querySelector(".q-check").addEventListener("click", check);
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") check(); });
  });
})();
