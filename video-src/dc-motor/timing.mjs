// Fits the scenes to the recorded narration.
// Reads narration/<video>.txt (scenes separated by blank lines) and timings/<video>.words.json (from align.py),
// and writes timings/<video>.json: for every scene its cut points in the original audio, its length in frames
// (with the breathing gaps added), each sentence's time in the finished video, and the caption cues.
// Usage: node timing.mjs explain
import fs from 'node:fs';
const name = process.argv[2];
const FPS = 30;
const cfg = JSON.parse(fs.readFileSync(new URL('./video-config.json', import.meta.url), 'utf8'))[name];
const script = fs.readFileSync(new URL(`./narration/${name}.txt`, import.meta.url), 'utf8').replace(/\r\n/g, '\n').trim();
const { words } = JSON.parse(fs.readFileSync(new URL(`./timings/${name}.words.json`, import.meta.url), 'utf8'));
const audioDuration = cfg.audioDuration;
const norm = (w) => w.toLowerCase().replace(/[^a-z0-9]/g, '');

// Script → scenes → sentences → words
const scenes = script.split(/\n\s*\n/).map((block) => block.trim().split(/(?<=[.?!:])\s+(?=[A-Z])/).map((s) => s.trim()).filter(Boolean));
const flat = [];
scenes.forEach((sentences, si) => sentences.forEach((text, ti) => text.split(/\s+/).forEach((w) => { if (norm(w)) flat.push({ si, ti, w }); })));

// Align script words to the transcript words (both are almost identical; allow small slips)
let j = 0;
for (const item of flat) {
  let found = -1;
  for (let k = j; k < Math.min(words.length, j + 6); k++) {
    const a = norm(item.w), b = norm(words[k].w);
    if (a === b || (a.length > 3 && b.length > 3 && (a.startsWith(b.slice(0, 4)) || b.startsWith(a.slice(0, 4))))) { found = k; break; }
  }
  if (found >= 0) { item.s = words[found].s; item.e = words[found].e; j = found + 1; }
}
// Fill any unmatched word from its neighbours
flat.forEach((item, i) => {
  if (item.s !== undefined) return;
  const prev = flat.slice(0, i).reverse().find((x) => x.e !== undefined);
  const next = flat.slice(i + 1).find((x) => x.s !== undefined);
  item.s = prev ? prev.e : 0; item.e = next ? next.s : item.s + 0.3;
});
const unmatched = flat.filter((x, i) => i > 0 && x.s < flat[i - 1].s).length;

// Scene cut points: the middle of the silence between one scene's last word and the next scene's first
const firstOf = (si) => flat.find((x) => x.si === si);
const lastOf = (si) => [...flat].reverse().find((x) => x.si === si);
const cuts = [0];
for (let si = 1; si < scenes.length; si++) cuts.push(+(((lastOf(si - 1).e + firstOf(si).s) / 2)).toFixed(3));
cuts.push(audioDuration);

let videoT = 0;
const out = { name, fps: FPS, scenes: [], cues: [] };
scenes.forEach((sentences, si) => {
  const lead = si === 0 ? cfg.leadIn : 0;
  const gap = cfg.gaps?.[String(si + 1)] ?? (si === scenes.length - 1 ? cfg.tail : cfg.gap);
  const a0 = cuts[si], a1 = cuts[si + 1];
  const frames = Math.round((lead + (a1 - a0) + gap) * FPS);
  const start = videoT; // in the finished video
  const toVideo = (t) => +(start + lead + (t - a0)).toFixed(3);
  const sent = sentences.map((text, ti) => {
    const ws = flat.filter((x) => x.si === si && x.ti === ti);
    return { text, start: toVideo(ws[0].s), end: toVideo(ws[ws.length - 1].e), words: ws.map((x) => ({ w: x.w, s: toVideo(x.s), e: toVideo(x.e) })) };
  });
  out.scenes.push({ n: si + 1, audio: [a0, a1], lead, gap, frames, duration: +(frames / FPS).toFixed(4), start: +start.toFixed(4), speechEnd: toVideo(lastOf(si).e), sentences: sent.map(({ words: _w, ...s }) => s) });
  // Caption cues: at most 2 lines of about 42 characters; split long sentences at commas or word boundaries
  for (const s of sent) {
    const chunks = [];
    let cur = [];
    const len = (arr) => arr.map((x) => x.w).join(' ').length;
    for (const w of s.words) {
      if (cur.length && len([...cur, w]) > 78) { chunks.push(cur); cur = []; }
      cur.push(w);
      if (/[,:;]$/.test(w.w) && len(cur) > 44) { chunks.push(cur); cur = []; }
    }
    if (cur.length) chunks.push(cur);
    // Do not leave a one- or two-word orphan cue
    for (let i = chunks.length - 1; i > 0; i--) if (chunks[i].length < 3 && len([...chunks[i - 1], ...chunks[i]]) <= 84) { chunks[i - 1].push(...chunks[i]); chunks.splice(i, 1); }
    chunks.forEach((c) => out.cues.push({ start: c[0].s, end: c[c.length - 1].e, text: c.map((x) => x.w).join(' ') }));
  }
  videoT += frames / FPS;
});
// Merge very short cues (under 1 s of speech) into the next one when both fit on two lines
for (let i = 0; i < out.cues.length - 1; i++) {
  const c = out.cues[i], n = out.cues[i + 1];
  if (n.start - c.start < 1.0 && (c.text + ' ' + n.text).length <= 84 && n.start - c.end < 0.6) { c.end = n.end; c.text = c.text + ' ' + n.text; out.cues.splice(i + 1, 1); i--; }
}
// Cue timing: hold each cue until the next one starts (or 0.6 s after the speech), never less than 1 s
out.cues.forEach((c, i) => {
  const next = out.cues[i + 1];
  let end = Math.max(c.end + 0.35, c.start + 1.0);
  if (next) end = Math.min(Math.max(end, Math.min(next.start - 0.05, c.end + 0.9)), next.start - 0.04);
  c.end = +Math.max(end, c.start + 0.8).toFixed(3);
  // Two balanced lines
  if (c.text.length > 42) {
    const ws = c.text.split(' '); let best = 1, bestDiff = 1e9;
    for (let k = 1; k < ws.length; k++) { const d = Math.abs(ws.slice(0, k).join(' ').length - ws.slice(k).join(' ').length); if (d < bestDiff) { bestDiff = d; best = k; } }
    c.lines = [ws.slice(0, best).join(' '), ws.slice(best).join(' ')];
  } else c.lines = [c.text];
});
out.duration = +videoT.toFixed(4);
out.frames = out.scenes.reduce((a, s) => a + s.frames, 0);
fs.writeFileSync(new URL(`./timings/${name}.json`, import.meta.url), JSON.stringify(out, null, 1));
const fmt = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
console.log(`${name}: ${out.scenes.length} scenes, ${out.frames} frames, ${fmt(out.duration)}; cues ${out.cues.length}; out-of-order words ${unmatched}`);
for (const s of out.scenes) console.log(`  scene ${s.n}: starts ${fmt(s.start)} · ${s.duration.toFixed(2)} s · speech ends ${fmt(s.speechEnd)}`);
console.log('  longest cue line:', Math.max(...out.cues.flatMap((c) => c.lines.map((l) => l.length))), '· shortest cue (s):', Math.min(...out.cues.map((c) => c.end - c.start)).toFixed(2));
