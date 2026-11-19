// Assembles a finished video: fits every scene clip to its exact frame count, rebuilds the narration
// with the breathing gaps, muxes H.264 + AAC, writes the WebVTT captions, a poster and the page's
// pause-point data, then checks every frame (blank or flickering frames, length, sync).
// Usage: node assemble.mjs hook|explain
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const name = process.argv[2];
const FPS = 30;
const T = JSON.parse(fs.readFileSync(path.join(here, `timings/${name}.json`), 'utf8'));
const B = (p) => path.join(here, 'build', p);
const OUT = path.resolve(here, '../../physics/dc-motor/media');
fs.mkdirSync(B('scenes'), { recursive: true });
fs.mkdirSync(B('audio'), { recursive: true });
fs.mkdirSync(OUT, { recursive: true });
const ff = (args, opts = {}) => execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28, ...opts });
const TITLE_FRAMES = 4 * FPS;

// Which clips make each scene: [file, frames]
const PLAN = {
  hook: [[[B('hf/hook.mp4'), T.frames]]],
  explain: T.scenes.map((s) => ({
    1: [[B('hf/explain-title.mp4'), TITLE_FRAMES], [B('clips/s1_motor.mp4'), s.frames - TITLE_FRAMES]],
    2: [[B('manim/videos/scenes/1080p30/S2Stream.mp4'), s.frames]],
    3: [[B('clips/s3_wire.mp4'), s.frames]],
    4: [[B('clips/s4_solenoid.mp4'), s.frames]],
    5: [[B('hf/explain-tier.mp4'), s.frames]],
    6: [[B('manim/videos/scenes/1080p30/S6MotorEffect.mp4'), s.frames]],
    7: [[B('clips/s7_fleming.mp4'), s.frames]],
    8: [[B('clips/s8_coil.mp4'), s.frames]],
    9: [[B('clips/s9_no_current.mp4'), s.frames]],
    10: [[B('hf/explain-summary.mp4'), s.frames]],
  }[s.n])),
}[name];

// ---- Video: every clip to exactly its frame count (hold the last frame if a render is a frame short)
const parts = [];
const cuts = []; // frame numbers where a new clip starts (expected scene changes)
let frame = 0;
PLAN.flat().forEach(([file, frames], i) => {
  if (!fs.existsSync(file)) throw new Error(`Missing clip: ${file}`);
  const out = B(`scenes/${name}-${String(i + 1).padStart(2, '0')}.mp4`);
  ff(['-i', file, '-an', '-vf', `fps=${FPS},scale=1920:1080:flags=lanczos,setsar=1,tpad=stop_mode=clone:stop_duration=3,format=yuv420p`, '-frames:v', String(frames), '-c:v', 'libx264', '-preset', 'medium', '-crf', '12', out]);
  parts.push(out);
  if (i) cuts.push(frame);
  frame += frames;
});
if (frame !== T.frames) throw new Error(`Frame plan ${frame} != timings ${T.frames}`);
fs.writeFileSync(B(`${name}-video.txt`), parts.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n'));

// ---- Audio: each scene's piece of the take, with its lead-in and gap, exactly as long as its frames
const srcAudio = path.join(here, `audio/${name}.mp3`);
const aParts = T.scenes.map((s) => {
  const out = B(`audio/${name}-${String(s.n).padStart(2, '0')}.wav`);
  const dur = s.frames / FPS;
  ff(['-ss', String(s.audio[0]), '-to', String(s.audio[1]), '-i', srcAudio, '-af', `aresample=48000,adelay=${Math.round(s.lead * 1000)}:all=1,apad=whole_dur=${dur.toFixed(5)},atrim=0:${dur.toFixed(5)}`, '-ac', '1', '-c:a', 'pcm_s16le', out]);
  return out;
});
fs.writeFileSync(B(`${name}-audio.txt`), aParts.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n'));

// ---- Mux: H.264 + AAC, 1920×1080, 30 fps, fast start; short fade in and out
const total = T.frames / FPS;
const final = path.join(OUT, `${name}.mp4`);
ff(['-f', 'concat', '-safe', '0', '-i', B(`${name}-video.txt`), '-f', 'concat', '-safe', '0', '-i', B(`${name}-audio.txt`),
  '-vf', `fade=t=in:st=0:d=0.3,fade=t=out:st=${(total - 0.5).toFixed(3)}:d=0.5`,
  '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000',
  '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-preset', 'slow', '-crf', name === 'hook' ? '21' : '22', '-r', String(FPS), '-g', '60',
  '-c:a', 'aac', '-b:a', '128k', '-ac', '2', '-movflags', '+faststart', '-frames:v', String(T.frames), '-shortest', final]);

// ---- Captions (WebVTT), poster, pause points
const ts = (t) => { const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = (t % 60).toFixed(3).padStart(6, '0'); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${s}`; };
fs.writeFileSync(path.join(OUT, `${name}.vtt`), 'WEBVTT\n\n' + T.cues.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.lines.join('\n')}`).join('\n\n') + '\n');
ff(['-ss', name === 'hook' ? '12.6' : '1.6', '-i', final, '-frames:v', '1', '-vf', 'scale=1280:-2', '-c:v', 'libwebp', '-quality', '82', path.join(OUT, `${name}-poster.webp`)]);
const pauseAfter = name === 'explain' ? [3, 4, 7, 8] : [T.scenes.length];
const pauses = pauseAfter.map((n) => ({ scene: n, at: +(T.scenes[n - 1].speechEnd + 0.45).toFixed(2) }));
const chapters = T.scenes.map((s) => ({ scene: s.n, start: +s.start.toFixed(2) }));
fs.writeFileSync(path.join(here, `timings/${name}.page.json`), JSON.stringify({ duration: +total.toFixed(2), pauses, chapters }, null, 1));

// ---- Checks
const probe = (args) => execFileSync('ffprobe', ['-v', 'error', ...args], { encoding: 'utf8' }).trim();
const vFrames = Number(probe(['-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', final]));
const vInfo = probe(['-select_streams', 'v:0', '-show_entries', 'stream=codec_name,width,height,r_frame_rate,pix_fmt', '-of', 'csv=p=0', final]);
const aInfo = probe(['-select_streams', 'a:0', '-show_entries', 'stream=codec_name,sample_rate,channels,duration', '-of', 'csv=p=0', final]);
const aDur = Number(aInfo.split(',').pop());
// Mean brightness of every frame: blank frames, and one-frame jumps away from the cuts (flicker)
let stats = '';
try { execFileSync('ffmpeg', ['-hide_banner', '-i', final, '-vf', 'signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-', '-an', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').forEach((l) => { stats += l + '\n'; }); } catch (e) { stats = e.stdout || ''; }
const y = [...stats.matchAll(/YAVG=([\d.]+)/g)].map((m) => Number(m[1]));
const fadeIn = Math.ceil(0.3 * FPS), fadeOut = T.frames - Math.ceil(0.5 * FPS);
const blank = y.map((v, i) => [i, v]).filter(([i, v]) => v < 8 && i > fadeIn && i < fadeOut).map(([i]) => i);
const nearCut = (i) => cuts.some((c) => Math.abs(c - i) <= 1);
const flicker = [];
for (let i = 1; i < y.length - 1; i++) {
  const a = y[i] - y[i - 1], b = y[i + 1] - y[i];
  if (Math.abs(a) > 6 && Math.abs(b) > 6 && Math.sign(a) !== Math.sign(b) && !nearCut(i) && !nearCut(i + 1) && i > fadeIn && i < fadeOut) flicker.push(i);
}
const report = {
  file: path.relative(path.resolve(here, '../..'), final).replace(/\\/g, '/'), video: vInfo, audio: aInfo,
  frames: vFrames, expectedFrames: T.frames, seconds: +(vFrames / FPS).toFixed(2), audioSeconds: +aDur.toFixed(2),
  syncOffsetMs: Math.round((aDur - vFrames / FPS) * 1000), framesMeasured: y.length, blankFrames: blank, flickerFrames: flicker,
  cutsAt: cuts.map((c) => +(c / FPS).toFixed(2)), sizeMB: +(fs.statSync(final).size / 1048576).toFixed(2), cues: T.cues.length,
  longestCaptionLine: Math.max(...T.cues.flatMap((c) => c.lines.map((l) => l.length))), shortestCueSeconds: +Math.min(...T.cues.map((c) => c.end - c.start)).toFixed(2), pauses,
};
fs.writeFileSync(path.join(here, `timings/${name}.check.json`), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
