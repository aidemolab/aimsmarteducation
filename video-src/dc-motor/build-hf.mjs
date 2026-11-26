// Writes the HyperFrames compositions (the Hook video and the Explain video's cards) with cue times
// taken from the recorded narration (timings/*.json), then renders them.
// Usage: node build-hf.mjs [write|render]    (default: both)
// HyperFrames CLI: set HYPERFRAMES to its path, or it is looked up at D:\Data Science\HyperFrames.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const HF = process.env.HYPERFRAMES || 'D:/Data Science/HyperFrames/cli/node_modules/.bin/hyperframes.cmd';
const hfDir = path.join(here, 'hf');
const mode = process.argv[2] || 'all';
const hook = JSON.parse(fs.readFileSync(path.join(here, 'timings/hook.json'), 'utf8'));
const explain = JSON.parse(fs.readFileSync(path.join(here, 'timings/explain.json'), 'utf8'));
const st = (T, scene, sentence) => +T.scenes[scene - 1].sentences[sentence - 1].start.toFixed(2);
const TITLE = 4.0;

// Fonts: copied from the site's shared assets at build time (not committed twice)
fs.mkdirSync(path.join(hfDir, 'assets/fonts'), { recursive: true });
for (const f of ['manrope/manrope-latin-800-normal.woff2', 'manrope/manrope-latin-700-normal.woff2', 'source-sans-3/source-sans-3-latin-400-normal.woff2', 'source-sans-3/source-sans-3-latin-600-normal.woff2'])
  fs.copyFileSync(path.join(here, '../../assets/fonts', f), path.join(hfDir, 'assets/fonts', path.basename(f)));

const CSS = `
  @font-face { font-family: "Manrope"; font-weight: 800; src: url("assets/fonts/manrope-latin-800-normal.woff2") format("woff2"); }
  @font-face { font-family: "Manrope"; font-weight: 700; src: url("assets/fonts/manrope-latin-700-normal.woff2") format("woff2"); }
  @font-face { font-family: "Source Sans 3"; font-weight: 400; src: url("assets/fonts/source-sans-3-latin-400-normal.woff2") format("woff2"); }
  @font-face { font-family: "Source Sans 3"; font-weight: 600; src: url("assets/fonts/source-sans-3-latin-600-normal.woff2") format("woff2"); }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1920px; height: 1080px; overflow: hidden; background: #0d1320; }
  #root { position: relative; width: 1920px; height: 1080px; background: radial-gradient(1200px 700px at 50% 40%, #16213a 0%, #0d1320 70%); color: #F4F5FA; font-family: "Source Sans 3", sans-serif; }
  .clip { position: absolute; inset: 0; }
  .abs { position: absolute; }
  .h { font-family: "Manrope", sans-serif; font-weight: 800; letter-spacing: -0.02em; line-height: 1.12; }
  .kicker { font-family: "Manrope", sans-serif; font-weight: 700; font-size: 34px; letter-spacing: 0.08em; text-transform: uppercase; color: #B9BCCB; }
  .muted { color: #B9BCCB; }
  .amber { color: #E9B949; }
  .brand { position: absolute; left: 96px; bottom: 64px; display: flex; align-items: center; gap: 18px; font-family: "Manrope", sans-serif; font-weight: 800; font-size: 30px; color: #F4F5FA; }
  .brand span.mark { display: grid; place-items: center; width: 52px; height: 52px; border-radius: 12px; background: #3B3FB6; }
  .ainote { position: absolute; right: 96px; bottom: 72px; font-size: 24px; color: #8f94a8; }
  .badge { display: inline-block; padding: 4px 22px; border-radius: 12px; background: #F4F5FA; color: #14161F; font-family: "Manrope", sans-serif; font-weight: 800; }
`;
const FAN = (cx, cy, s = 1) => `
  <svg class="abs" id="fan" style="left:0;top:0" width="1920" height="1080" viewBox="0 0 1920 1080">
    <g transform="translate(${cx} ${cy}) scale(${s})">
      <rect x="-22" y="150" width="44" height="250" rx="10" fill="#2a3350"/>
      <rect x="-150" y="390" width="300" height="40" rx="20" fill="#2a3350"/>
      <circle r="290" fill="none" stroke="#3a4566" stroke-width="10"/>
      <g id="blades">
        <path d="M0 -40 C 90 -120 110 -230 20 -268 C -60 -250 -70 -130 0 -40Z" fill="#8C90F0"/>
        <path d="M0 -40 C 90 -120 110 -230 20 -268 C -60 -250 -70 -130 0 -40Z" fill="#8C90F0" transform="rotate(120)"/>
        <path d="M0 -40 C 90 -120 110 -230 20 -268 C -60 -250 -70 -130 0 -40Z" fill="#8C90F0" transform="rotate(240)"/>
      </g>
      <circle r="52" fill="#F4F5FA"/><circle r="22" fill="#3B3FB6"/>
    </g>
  </svg>`;
const page = (id, duration, body, script) => `<!doctype html>
<html lang="en-GB" data-resolution="landscape">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>${CSS}</style>
  </head>
  <body>
    <div id="root" data-composition-id="${id}" data-start="0" data-duration="${duration}" data-width="1920" data-height="1080" data-fps="30">
      <div class="clip" id="stage" data-start="0" data-duration="${duration}" data-track-index="0">
${body}
      </div>
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      const show = (sel, t, from = { y: 30 }, d = 0.5) => tl.fromTo(sel, { autoAlpha: 0, ...from }, { autoAlpha: 1, x: 0, y: 0, scale: 1, duration: d, ease: "power2.out" }, t);
      const hide = (sel, t, d = 0.35) => tl.to(sel, { autoAlpha: 0, duration: d, ease: "power1.in" }, t);
      gsap.set(".start-hidden", { autoAlpha: 0 });
${script}
      tl.set({}, {}, ${duration});
      window.__timelines["${id}"] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
`;
const spin = (t0, end, cx, cy, s = 1) => `
      tl.to("#blades", { rotation: 300, svgOrigin: "0 0", duration: 2.0, ease: "power2.in" }, ${t0});
      tl.to("#blades", { rotation: 300 + 600 * ${(end - t0 - 2).toFixed(2)}, svgOrigin: "0 0", duration: ${(end - t0 - 2).toFixed(2)}, ease: "none" }, ${t0 + 2});`;

// ---------------------------------------------------------------- Hook
{
  const D = hook.duration;
  const s2 = hook.scenes[1].start, s3 = hook.scenes[2].start;
  const body = `${FAN(560, 470)}
        <div class="abs" id="switch" style="left:1150px;top:380px;width:460px;text-align:center">
          <div id="track" style="margin:0 auto;width:300px;height:150px;border-radius:75px;background:#2a3350;position:relative;border:6px solid #3a4566">
            <div id="knob" style="position:absolute;left:14px;top:12px;width:114px;height:114px;border-radius:57px;background:#F4F5FA"></div>
          </div>
          <div class="h" id="swlabel" style="font-size:64px;margin-top:36px;color:#B9BCCB">OFF</div>
        </div>
        <div class="abs start-hidden" id="no1" style="left:1040px;top:330px;width:760px"><span class="h" style="font-size:120px;position:relative">engine<span id="strike1" style="position:absolute;left:-10px;top:56%;height:12px;width:0;background:#E9B949;border-radius:6px"></span></span></div>
        <div class="abs start-hidden" id="no2" style="left:1040px;top:520px;width:760px"><span class="h" style="font-size:120px;position:relative">fuel<span id="strike2" style="position:absolute;left:-10px;top:56%;height:12px;width:0;background:#E9B949;border-radius:6px"></span></span></div>
        <div class="abs start-hidden" id="p1" style="left:1040px;top:250px;display:flex;align-items:center;gap:36px">
          <svg width="150" height="110" viewBox="0 0 150 110"><path d="M10 55 a14 34 0 1 1 28 0 a14 34 0 1 1 28 0 a14 34 0 1 1 28 0 a14 34 0 1 1 28 0 a14 34 0 1 1 28 0" fill="none" stroke="#D9975A" stroke-width="9" stroke-linecap="round"/></svg>
          <span class="h" style="font-size:72px">a coil of wire</span></div>
        <div class="abs start-hidden" id="p2" style="left:1040px;top:440px;display:flex;align-items:center;gap:36px">
          <svg width="150" height="110" viewBox="0 0 150 110"><rect x="4" y="15" width="56" height="80" rx="8" fill="#D64541"/><rect x="90" y="15" width="56" height="80" rx="8" fill="#3D6FD6"/><text x="32" y="70" text-anchor="middle" font-family="Manrope" font-weight="800" font-size="40" fill="#fff">N</text><text x="118" y="70" text-anchor="middle" font-family="Manrope" font-weight="800" font-size="40" fill="#fff">S</text></svg>
          <span class="h" style="font-size:72px">a couple of magnets</span></div>
        <div class="abs start-hidden" id="p3" style="left:1040px;top:630px;display:flex;align-items:center;gap:36px">
          <svg width="150" height="110" viewBox="0 0 150 110"><path d="M10 55 H140" stroke="#D9975A" stroke-width="9" stroke-linecap="round"/><path d="M52 30 l34 25 -34 25z" fill="#E9B949"/><path d="M96 30 l34 25 -34 25z" fill="#E9B949"/></svg>
          <span class="h" style="font-size:72px">an electric current</span></div>
        <div class="abs start-hidden h" id="question" style="left:1010px;top:300px;width:820px;font-size:112px">What pushes the blades round<span class="amber">?</span></div>
        <div class="abs start-hidden" id="end" style="left:0;top:0;width:1920px;height:1080px">
          <div class="abs start-hidden kicker" id="e0" style="left:0;width:1920px;top:250px;text-align:center">Before we explain anything</div>
          <div class="abs start-hidden h" id="e1" style="left:0;width:1920px;top:330px;text-align:center;font-size:150px">Make a prediction</div>
          <div class="abs start-hidden h amber" id="e2" style="left:0;width:1920px;top:560px;text-align:center;font-size:84px">Lock it in.</div>
          <div class="abs start-hidden h" id="e3" style="left:0;width:1920px;top:700px;text-align:center;font-size:84px">Then test it in the 3D model.</div>
        </div>
        <div class="brand"><span class="mark">A</span>AIM Smart Education</div>
        <div class="ainote">AI narration</div>`;
  const script = `
      tl.to("#knob", { x: 152, duration: 0.25, ease: "power2.out" }, 1.25);
      tl.to("#track", { backgroundColor: "#3B3FB6", borderColor: "#8C90F0", duration: 0.25 }, 1.25);
      tl.set("#swlabel", { textContent: "ON", color: "#F4F5FA" }, 1.3);
${spin(1.4, D, 560, 470)}
      hide("#switch", ${(st(hook, 1, 2) - 0.45).toFixed(2)});
      show("#no1", ${st(hook, 1, 2)}, { x: 40 }, 0.35);
      tl.to("#strike1", { width: "106%", duration: 0.3, ease: "power2.out" }, ${(st(hook, 1, 2) + 0.55).toFixed(2)});
      show("#no2", ${st(hook, 1, 3)}, { x: 40 }, 0.3);
      tl.to("#strike2", { width: "112%", duration: 0.3, ease: "power2.out" }, ${(st(hook, 1, 3) + 0.3).toFixed(2)});
      hide("#no1", ${(st(hook, 1, 4) - 0.35).toFixed(2)}, 0.3); hide("#no2", ${(st(hook, 1, 4) - 0.35).toFixed(2)}, 0.3);
      show("#p1", ${(st(hook, 1, 4) + 0.2).toFixed(2)}, { x: 40 }, 0.4);
      show("#p2", ${(st(hook, 1, 4) + 1.45).toFixed(2)}, { x: 40 }, 0.4);
      show("#p3", ${(st(hook, 1, 4) + 2.5).toFixed(2)}, { x: 40 }, 0.4);
      hide("#p1", ${(s2 - 0.3).toFixed(2)}, 0.3); hide("#p2", ${(s2 - 0.3).toFixed(2)}, 0.3); hide("#p3", ${(s2 - 0.3).toFixed(2)}, 0.3);
      show("#question", ${(s2 + 0.25).toFixed(2)}, { y: 40 }, 0.5);
      hide("#question", ${(s3 - 0.35).toFixed(2)}, 0.3);
      tl.to("#fan", { autoAlpha: 0.12, duration: 0.5 }, ${(s3 - 0.3).toFixed(2)});
      tl.set("#end", { autoAlpha: 1 }, ${s3.toFixed(2)});
      show("#e0", ${(s3 + 0.05).toFixed(2)}, { y: 20 }, 0.4);
      show("#e1", ${(s3 + 0.9).toFixed(2)}, { scale: 0.92 }, 0.5);
      show("#e2", ${st(hook, 3, 2)}, { y: 20 }, 0.35);
      show("#e3", ${st(hook, 3, 3)}, { y: 20 }, 0.4);`;
  fs.writeFileSync(path.join(hfDir, 'hook.html'), page('hook', D, body, script));
}

// ---------------------------------------------------------------- Explain: title card (scene 1, first 4 s)
{
  const body = `${FAN(1400, 480, 0.9)}
        <div class="abs kicker" id="k" style="left:140px;top:300px">GCSE Physics · How a DC motor works</div>
        <div class="abs h" id="t" style="left:140px;top:370px;width:1000px;font-size:132px">Why does the motor turn<span class="amber">?</span></div>
        <div class="brand"><span class="mark">A</span>AIM Smart Education</div>
        <div class="ainote">AI narration</div>`;
  const script = `
      show("#k", 0.15, { y: 20 }, 0.4);
      show("#t", 0.35, { y: 30 }, 0.5);
${spin(0.9, TITLE + 2, 1400, 480)}`;
  fs.writeFileSync(path.join(hfDir, 'explain-title.html'), page('explain-title', TITLE, body, script));
}

// ---------------------------------------------------------------- Explain: tier card (scene 5)
{
  const D = explain.scenes[4].duration, s0 = explain.scenes[4].start;
  const a = +(st(explain, 5, 1) - s0).toFixed(2), b = +(st(explain, 5, 2) - s0).toFixed(2);
  const body = `
        <div class="abs start-hidden" id="f" style="left:0;width:1920px;top:250px;text-align:center">
          <div class="kicker">Foundation tier</div>
          <div class="h" style="font-size:96px;margin-top:20px">That's everything you need <span style="color:#3DDC97">✓</span></div>
        </div>
        <div class="abs start-hidden" id="hgh" style="left:0;width:1920px;top:560px;text-align:center">
          <div class="h" style="font-size:110px"><span class="badge">HT</span> &nbsp;Higher tier from here</div>
          <div class="muted" style="font-size:54px;margin-top:30px">How this makes a motor turn</div>
        </div>
        <div class="brand"><span class="mark">A</span>AIM Smart Education</div>`;
  const script = `
      show("#f", ${a}, { y: 30 }, 0.5);
      tl.to("#f", { autoAlpha: 0.45, duration: 0.4 }, ${(b - 0.2).toFixed(2)});
      show("#hgh", ${b}, { y: 30 }, 0.5);`;
  fs.writeFileSync(path.join(hfDir, 'explain-tier.html'), page('explain-tier', D, body, script));
}

// ---------------------------------------------------------------- Explain: quick check and summary (scene 10)
{
  const sc = explain.scenes[9]; const D = sc.duration, s0 = sc.start;
  const t = (i) => +(sc.sentences[i].start - s0).toFixed(2);
  const body = `
        <div class="abs start-hidden kicker amber" id="k" style="left:160px;top:120px">Quick check</div>
        <div class="abs start-hidden h" id="q" style="left:160px;top:190px;width:1600px;font-size:84px">Why do the two sides of the coil move in opposite directions?</div>
        <div class="abs start-hidden" id="a" style="left:160px;top:440px;width:1600px;font-size:60px;color:#3DDC97;font-weight:600">Because the current flows in opposite directions in them.</div>
        <div class="abs start-hidden" id="line" style="left:160px;top:590px;width:1600px;height:4px;background:#3a4566"></div>
        <div class="abs start-hidden kicker" id="k2" style="left:160px;top:640px">In one line</div>
        <div class="abs start-hidden h" id="s1" style="left:160px;top:705px;width:1600px;font-size:76px">A current in a magnetic field feels a force,</div>
        <div class="abs start-hidden h amber" id="s2" style="left:160px;top:805px;width:1600px;font-size:76px">and that force turns the motor.</div>
        <div class="ainote" style="bottom:40px">AI narration · AIM Smart Education</div>`;
  const script = `
      show("#k", ${t(0)}, { y: 20 }, 0.35);
      show("#q", ${t(1)}, { y: 30 }, 0.5);
      show("#a", ${t(2)}, { y: 30 }, 0.5);
      show("#line", ${(t(3) - 0.2).toFixed(2)}, { y: 0 }, 0.3);
      show("#k2", ${t(3)}, { y: 20 }, 0.35);
      show("#s1", ${(t(3) + 1.3).toFixed(2)}, { y: 30 }, 0.5);
      show("#s2", ${(t(3) + 4.0).toFixed(2)}, { y: 30 }, 0.5);`;
  fs.writeFileSync(path.join(hfDir, 'explain-summary.html'), page('explain-summary', D, body, script));
}
fs.rmSync(path.join(hfDir, 'index.html'), { force: true });
console.log('compositions written');

if (mode !== 'write') {
  fs.mkdirSync(path.join(here, 'build/hf'), { recursive: true });
  for (const name of ['hook', 'explain-title', 'explain-tier', 'explain-summary']) {
    // No telemetry, and no frames sent to any AI service (HyperFrames describes frames with Gemini when a key is set)
    const env = { ...process.env, HYPERFRAMES_NO_TELEMETRY: '1', HYPERFRAMES_SKIP_SKILLS: '1' };
    delete env.GEMINI_API_KEY; delete env.GOOGLE_API_KEY;
    execSync(`"${HF}" render "${hfDir}" -c ${name}.html -o "${path.join(here, 'build/hf', `${name}.mp4`)}" -f 30 -q high`, { stdio: 'inherit', env });
    console.log('rendered', name);
  }
}
