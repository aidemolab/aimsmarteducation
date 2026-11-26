# Module template

A blank module with the fixed seven-stage structure: an overview (`index.html`) and one page per stage. It has the site header and footer, journey bar, route switch, pager and security policy, plus placeholder boxes showing what goes where. It is not linked from the site, and every page has `noindex`.

| Page | Phase · stage | What goes in it |
|---|---|---|
| `index.html` | Overview | Title, exam board and spec points with tiers, what you'll learn (All / HT), route choice, journey, Start |
| `hook.html` | See it · 1 Hook | Hook puzzle + prediction |
| `explore.html` | See it · 2 Explore | Living model (the only page that loads it) |
| `explain.html` | See it · 3 Explain | Explainer video + Try-it points (part-chip example in a comment) |
| `chain.html` | Practise it · 4 Build the chain | Chain cards |
| `trap.html` | Practise it · 5 Spot the trap | Misconceptions 1–3 |
| `do-it.html` | Practise it · 6 Do it | Practice: Foundation / HT |
| `write.html` | Ace it · 7 Write it and revisit it | Exam questions + mark scheme; retrieval on day 3, 7 and 21 |

The seven stages are never renamed, reordered or dropped.

## 1. Plan first (before copying anything)

- [ ] **Spec points.** Open the board's specification in `_specs/` (for example `AQA-8463-GCSE-Physics.txt`). List every spec point the module covers, with its tier as the PDF gives it (everyone, HT only, Physics only), and the specification version. Revision sites are never the source.
- [ ] **Other boards.** Map each board to its own specification references. Never reuse a UK reference for an international qualification. Leave "to be confirmed" until checked.
- [ ] **Beyond the specification.** Mark anything not in the specification "Going further" (content) or "method" (a technique the specification does not name).
- [ ] **Real-life scenario** for the Hook, and the prediction it leads to.
- [ ] **Living model.** One model at the centre (Three.js for physics, JSXGraph for maths). Plan its steps, cause to effect.
- [ ] **Foundation route.** Every stage needs complete Foundation content; HT content goes in `details.ht-block`.
- [ ] **Misconceptions** (3) and the exam questions with mark schemes.
- [ ] **Mock-up** approved before building.

## 2. Copy the template

1. Copy this folder to `/<subject>/<slug>/` (for example `/maths/pythagoras-3d/`). The relative paths (`../../assets/…`) stay the same, because both folders sit two levels down.
2. Replace every `[placeholder]` and remove every `.placeholder` box as you fill it in.
3. On every page:
   - delete `<meta name="robots" content="noindex, nofollow">`;
   - add `<link rel="canonical" href="https://www.aimsmarteducation.co.uk/<subject>/<slug>/<page>.html">`;
   - set `aria-current="true"` on the Subjects button and on the subject's link in the header;
   - add the subject badge class (`aim-subject-physics` or `aim-subject-maths`) on the overview.
4. **Living model:** replace `scenes/placeholder.js` and `scenes/placeholder.stages.json` with the module's own scene, and update `data-scene` and `data-stages` on `explore.html`. Put any scene CSS in `scenes/` and link it from `explore.html`. "Try it in 3D" buttons on other pages use `data-try-stage` and `data-set`, and open `explore.html?stage=N`.
5. Link the module: add a card to the subject page and an entry to `TOPICS` in `assets/js/search.js`.

## 3. Rules while you build

- **Short pages.** Measure the whole page, header and footer included: at most 3 screens at 1366 × 768 and 4 at 390 × 844, on both routes. When a stage grows, split it into parts (`explain.html`, `explain-<slug>.html` …) with part chips (see the comment in `explain.html`), and update the pager links. Only the last page and the overview have the full footer and "Where next?".
- **Shared assets only.** Use `assets/explainer-shell`, `assets/vendor`, `assets/fonts` and `assets/css`. Never copy them into the module folder.
- **Content-Security-Policy.** No inline `style=` attributes, `onclick=` or other inline handlers, and no new inline scripts. If you change the importmap on `explore.html`, recompute its hash (base64 SHA-256 of the exact text between the tags) in that page's `script-src`.
- **Tags.** Every item gets a tier badge (`tier-badge`, `tier-badge tier-badge-all`) and a spec tag (`spec-tag`), checked against `_specs/`.
- **AI examples** are static and labelled "Example …" until the real service exists.
- Work on a branch with a pull request. Never merge.
