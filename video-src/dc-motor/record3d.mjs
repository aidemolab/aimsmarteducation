// Records clips frame by frame from the module's own Three.js model (physics/dc-motor/explore.html),
// so the video and the live model look the same. Each clip is stepped at exactly 30 fps with the
// shell's deterministic stepping hook, so the result does not depend on how fast this computer is.
//
// Needs: the site served at http://localhost:8420 (python -m http.server 8420 in the repo root),
// Playwright (PLAYWRIGHT env var, or the copy in ../../../aim-3d-explainers/node_modules) and Chrome.
// Usage: node record3d.mjs [clipName ...]      Output: build/3d/<clip>/f00001.jpg … and build/clips/<clip>.mp4
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pwPath = process.env.PLAYWRIGHT || path.resolve(here, '../../../aim-3d-explainers/node_modules/playwright/index.mjs');
const pw = await import(pathToFileURL(pwPath).href);
const { chromium } = pw.default || pw;
const FPS = 30;
const T = JSON.parse(fs.readFileSync(path.join(here, 'timings/explain.json'), 'utf8'));
const scene = (n) => T.scenes[n - 1];
const sec = (s) => Math.round(s * FPS);

// Clips: stage = model step (0-based); events = [seconds from the clip start, { option: value } or { stage: n }]
const TITLE = 4.0; // scene 1 opens with a title card; the model takes over after this
const CLIPS = {
  s1_motor: { frames: scene(1).frames - sec(TITLE), stage: 6, labels: false, events: [] },
  s3_wire: { frames: scene(3).frames, stage: 0, set: { current: 0 }, events: [[2.8, { current: 2 }], [14.2, { current: 3 }], [17.1, { current: -2.5 }]] },
  s4_solenoid: { frames: scene(4).frames, stage: 1, set: { current: 2, ironCore: false }, events: [[15.6, { ironCore: true }], [21.9, { current: 0 }], [23.0, { current: 2 }]] },
  s7_fleming: { frames: scene(7).frames, stage: 4, events: [] },
  s8_coil: { frames: scene(8).frames, stage: 3, hideLabels: 'commutator|Brush|Supply', events: [[7.2, { stage: 4 }], [11.2, { stage: 5 }]] },
  s9_no_current: { frames: scene(9).frames, stage: 5, hideLabels: 'commutator|Brush|Supply', events: [[7.75, { currentOn: false }], [11.7, { currentOn: true }]] },
};

const STYLE = `
  .site-header, .aim-header, .journey, .stage-head, .aim-panel, .try-return, .stage-pager, footer, .try-list, .model-words, .skip-link { display: none !important; }
  html, body { background: #0d1320 !important; overflow: hidden !important; }
  .aim-viewport { position: fixed !important; inset: 0 !important; width: 1920px !important; height: 1080px !important; max-height: none !important; border-radius: 0 !important; border: 0 !important; z-index: 9999; margin: 0 !important; }
  .aim-notice, .aim-badges, .aim-poster, .aim-loading, .aim-dc-readout { display: none !important; }
  .aim-label span { font-size: 30px !important; padding: 6px 16px !important; border-radius: 12px !important; }
  body.rec-no-labels .aim-labels { display: none !important; }
  .aim-label.rec-hide { display: none !important; }
`;

const want = process.argv.slice(2);
const names = want.length ? want : Object.keys(CLIPS);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-gpu'] });
for (const name of names) {
  const clip = CLIPS[name];
  if (!clip) throw new Error(`Unknown clip ${name}`);
  const dir = path.join(here, 'build/3d', name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(here, 'build/clips'), { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, bypassCSP: true });
  await ctx.addInitScript((css) => {
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style'); s.textContent = css; document.head.append(s);
      document.documentElement.classList.add('a11y-reduce-motion'); // stage changes cut instead of flying
    });
  }, STYLE);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://localhost:8420/physics/dc-motor/explore.html?stage=${clip.stage}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__aimDebug?.ready && document.querySelector('.aim-app').aimApi?.controlsUi, null, { timeout: 30000 });
  const apply = (change) => page.evaluate((c) => {
    const app = document.querySelector('.aim-app');
    for (const [k, v] of Object.entries(c)) {
      if (k === 'stage') app.aimStages.go(v); else app.aimApi.controlsUi.setValue(k, v);
    }
  }, change);
  await page.evaluate((labels) => {
    document.body.classList.toggle('rec-no-labels', labels === false);
    const d = window.__aimDebug; d.api.setFrozen(true); d.api.sim.playing = false; d.api.resetCamera();
  }, clip.labels);
  await apply({ stage: clip.stage, ...(clip.set || {}) });
  await page.evaluate(() => { const d = window.__aimDebug; d.api.resetCamera(); d.setTime(0); d.settleUi(2); });
  const events = clip.events.map(([t, c]) => [sec(t), c]);
  const t0 = Date.now();
  for (let f = 0; f < clip.frames; f++) {
    for (const [at, change] of events) if (at === f) { await apply(change); if ('stage' in change) await page.evaluate(() => window.__aimDebug.api.resetCamera()); }
    await page.evaluate(() => window.__aimDebug.stepFixed(1, 1 / 30));
    if (clip.hideLabels) await page.evaluate((re) => { for (const n of document.querySelectorAll('.aim-label')) n.classList.toggle('rec-hide', new RegExp(re).test(n.textContent)); }, clip.hideLabels);
    await page.screenshot({ path: path.join(dir, `f${String(f + 1).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 93, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
  }
  await ctx.close();
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(dir, 'f%05d.jpg'), '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p', '-r', String(FPS), path.join(here, 'build/clips', `${name}.mp4`)]);
  console.log(`${name}: ${clip.frames} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s${errors.length ? ` · errors: ${errors.join(' | ')}` : ''}`);
}
await browser.close();
