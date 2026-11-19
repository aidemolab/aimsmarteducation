# DC motor videos: source and rebuild

Everything needed to rebuild the two videos in `physics/dc-motor/media/`. Scripts are in `docs/videos/dc-motor/`.

| Video | File | Length | Narration |
|---|---|---|---|
| Hook | `media/hook.mp4` (+ `hook.vtt`, `hook-poster.webp`) | 23.07 s | `audio/hook.mp3`, 292 ElevenLabs credits |
| Explain | `media/explain.mp4` (+ `explain.vtt`, `explain-poster.webp`) | 2 min 57.5 s | `audio/explain.mp3`, 2,440 ElevenLabs credits |

Narration: AIM Narrator voice, model `eleven_v4`, one take each, generated 19 November 2026. The takes are kept in `audio/` so a rebuild spends no credits. Do not regenerate without a reason.

## Tools

Python with Whisper (`small`, local), Manim CE 0.21 with LaTeX, Node, HyperFrames 0.8.145, FFmpeg/FFprobe, Playwright with Chrome (for recording the 3D model).

## Steps

Run from `video-src/dc-motor/` unless it says otherwise. `build/` holds intermediate files and is not committed.

1. **Word timings** (local, no credits): `python align.py audio/explain.mp3 timings/explain.words.json` (and the same for `hook`).
2. **Fit the scenes to the narration:** `node timing.mjs explain` and `node timing.mjs hook`. This reads `narration/*.txt` and `video-config.json` (lead-in, gaps and tail) and writes `timings/<name>.json`: scene lengths in frames, sentence times and caption cues.
3. **3D clips from the module's own model:** serve the repo (`node video-src/serve.mjs 8420` from the repo root, or `python -m http.server 8420`), then `node record3d.mjs`. Each clip is stepped at exactly 30 fps with the model's own stepping hook and saved to `build/clips/`.
4. **Manim scenes:** `cd manim && manim -qh --fps 30 -r 1920,1080 --media_dir ../build/manim scenes.py S2Stream S6MotorEffect`.
5. **HyperFrames compositions** (the Hook, and the Explain title, tier and summary cards): `node build-hf.mjs`. It writes `hf/*.html` from the timings and renders them to `build/hf/`. GSAP is loaded from a CDN at render time only; nothing from a CDN is on the site. The script removes any Gemini key from the environment so no frames are sent to an AI service.
6. **Assemble and check:** `node assemble.mjs hook` and `node assemble.mjs explain`. This fits each clip to its frame count, rebuilds the narration with the gaps, encodes H.264 + AAC at 1920×1080 and 30 fps, writes the captions and poster, and checks every frame for blank or flickering frames, plus length and sync. Results: `timings/<name>.check.json`.
7. **Second caption pass:** extract the finished audio, run `align.py` on it, then `node refine-captions.mjs explain` (and `hook`). Any cue more than 0.35 s from the speech is corrected.

## Scene sources (Explain)

| Scene | Source |
|---|---|
| 1 title, 5 tier marker, 10 quick check and summary | HyperFrames (`hf/explain-*.html`) |
| 2 the stream, 6 the motor effect | Manim (`manim/scenes.py`) |
| 1 motor, 3 wire, 4 solenoid, 7 left-hand rule, 8 the coil, 9 current off | The Three.js model (`record3d.mjs`) |

## Local testing

Python's `http.server` cannot serve byte ranges, so videos cannot be seeked with it. Use `node video-src/serve.mjs` (port 8422 by default). GitHub Pages serves ranges, so the live site is fine.
