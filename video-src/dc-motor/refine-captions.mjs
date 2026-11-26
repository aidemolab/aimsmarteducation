// Second timing pass: compares each caption with the words heard in the FINISHED video
// (build/audio/<name>-final.words.json, from align.py) and corrects any cue that starts more than
// 0.35 s away from the speech. Rewrites physics/dc-motor/media/<name>.vtt and reports the result.
// Usage: node refine-captions.mjs explain
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const name = process.argv[2];
const T = JSON.parse(fs.readFileSync(path.join(here, `timings/${name}.json`), 'utf8'));
const W = JSON.parse(fs.readFileSync(path.join(here, `build/audio/${name}-final.words.json`), 'utf8')).words;
const norm = (w) => w.toLowerCase().replace(/[^a-z0-9]/g, '');
let j = 0; let fixed = 0; let worst = 0; const notes = [];
T.cues.forEach((c, i) => {
  const ws = c.text.split(' ').map(norm).filter(Boolean).slice(0, 3);
  let f = -1;
  for (let k = j; k < W.length - 2; k++) if (ws.every((w, n) => norm(W[k + n].w) === w)) { f = k; break; }
  if (f < 0) return;
  j = f + 1;
  const d = W[f].s - c.start;
  if (i > 0 && Math.abs(d) > 0.35 && Math.abs(d) < 1.2) {
    notes.push(`${c.start.toFixed(2)} → ${W[f].s.toFixed(2)}  ${c.text.slice(0, 40)}`);
    c.start = +W[f].s.toFixed(3); fixed++;
  } else if (i > 0) worst = Math.max(worst, Math.abs(d));
});
// Keep cues in order, at least 1 s long, and never overlapping
T.cues.forEach((c, i) => {
  const next = T.cues[i + 1];
  if (next && c.end > next.start - 0.04) c.end = +(next.start - 0.04).toFixed(3);
  if (c.end - c.start < 1.0) c.end = +(next ? Math.min(c.start + 1.0, next.start - 0.04) : c.start + 1.0).toFixed(3);
});
const ts = (t) => { const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = (t % 60).toFixed(3).padStart(6, '0'); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${s}`; };
const out = path.resolve(here, `../../physics/dc-motor/media/${name}.vtt`);
fs.writeFileSync(out, 'WEBVTT\n\n' + T.cues.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.lines.join('\n')}`).join('\n\n') + '\n');
fs.writeFileSync(path.join(here, `timings/${name}.captions.json`), JSON.stringify({ cues: T.cues.map(({ start, end, lines }) => ({ start, end, lines })), corrected: notes, worstRemainingOffset: +worst.toFixed(2) }, null, 1));
console.log(`${name}: ${fixed} cue(s) corrected; worst remaining offset ${worst.toFixed(2)} s; shortest cue ${Math.min(...T.cues.map((c) => c.end - c.start)).toFixed(2)} s`);
notes.forEach((n) => console.log('  ', n));
