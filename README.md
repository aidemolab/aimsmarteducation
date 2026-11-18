# AIM Smart Education website

Source for [www.aimsmarteducation.co.uk](https://www.aimsmarteducation.co.uk): interactive 3D explainers and exam practice for KS3, GCSE and A-level science and maths, built by a teacher.

The site is plain static HTML, CSS and JavaScript, published with GitHub Pages. There is no build step, no database and no tracking.

## Folder layout

```
index.html, 404.html, CNAME     Home page, not-found page, custom domain
assets/
  css/                          Site styles; premium-theme.css is the explainer theme
  js/                           Home page and navigation scripts
  fonts/                        Self-hosted Manrope and Source Sans 3 (SIL OFL)
  explainer-shell/              Shared 3D explainer engine used by every explainer
  vendor/three/0.170.0/         Self-hosted Three.js (MIT)
physics/, maths/                Subject pages, one folder per explainer or unit
  <explainer>/index.html        The page: text, controls and data-scene / data-stages
  <explainer>/scenes/           Topic content only: 3D model, stages JSON, text
```

## Adding a new explainer

1. Create `subject/topic-name/` with an `index.html` copied from an existing explainer.
2. Put only the topic's own files in `subject/topic-name/scenes/`.
3. Point the page's `data-scene` and `data-stages` attributes at those files. The shared shell finds them relative to the page.
4. Link the shared files with `../../assets/...` paths (see an existing explainer).
5. If the page has an inline `<script type="importmap">`, its SHA-256 hash must be in that page's Content-Security-Policy (see below).

Fix bugs in the 3D engine once, in `assets/explainer-shell/`; every explainer picks up the change.

## Security

GitHub Pages cannot set HTTP headers, so each page carries a Content-Security-Policy `<meta>` tag. It allows scripts, styles, fonts and connections only from this site.

- If you edit an importmap, recompute its hash (base64 SHA-256 of the exact text between the tags) and update `script-src` on that page, or the 3D view will not load.
- When logins or a database (for example Supabase) are added, add that service's address to `connect-src`.
- Never commit secrets. `.env` files are ignored by Git.

## Testing locally

```
python3 -m http.server 8000
```

Then open http://localhost:8000. The explainers must be served over HTTP; opening the files directly will not load the 3D view.

## Licences

Fonts: SIL Open Font License (see `assets/fonts/*/OFL.txt`). Three.js: MIT (see `assets/vendor/three/0.170.0/LICENSE`). Site content © AIM Smart Education. Resources are aligned to exam board specifications but are not endorsed by any exam board.
