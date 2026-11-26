# Explain video: "Why does the motor turn?"

Draft for Alaa's review. Module: How a DC motor works (AQA GCSE Physics 8463 v1.1, 4.7.2).

- **Learning objective:** explain that a current in a magnetic field feels a force, and that this force turns the coil of a motor.
- **Audience and spec points:** GCSE Physics. Scenes 1–4 are for Foundation and Higher (4.7.2.1). Scenes 6–10 are Higher tier only (4.7.2.2 and 4.7.2.3); scene 5 says so on screen and in the narration.
- **Core idea (one sentence):** a current in a magnetic field feels a force, and that force turns the motor.
- **The one analogy:** a stream. A field is like flowing water; a current adds a swirl, like water round a post; the coil is a paddle wheel in the stream.
- **Teaching arc:** puzzle (1) → everyday scenario (1–2) → the idea, one step at a time (3–8) → common misconception (9) → quick check and one-line summary (10).
- **Length target:** 2–5 minutes. About 450 words; 2.3 words per second on the set-up and about 2.0 on the "how it works" scenes (3, 4, 6, 8) ≈ 3 min 25 s.
- **Tools:** Manim (analogy and motor-effect diagrams), frame-by-frame recordings of the module's own Three.js model, HyperFrames (title, tier and summary cards), AIM Narrator (ElevenLabs), FFmpeg.
- **Sits on:** `physics/dc-motor/explain.html` (Explain, part 1). The Higher part of the video starts at the scene 5 marker.
- **Not in the video, on purpose:** the split-ring commutator (Going further), the right-hand grip rule (method) and any calculation (practice stays in Do it).

## Narration (one take; a blank line is a scene break)

> Flick the switch on a fan, and it spins straight away. No engine. No fuel. Just a current in some wire, and a couple of magnets. So what is actually pushing it round? Let's build the answer, one step at a time.
>
> Start with a picture. Imagine water in a stream, swirling round a post. Keep that stream in mind, because a magnetic field behaves a lot like it.
>
> Here is a straight wire, with compasses around it. Switch on a current, and the needles swing round to point in circles. A current makes a magnetic field around the wire, like the swirl round the post. The swirl is strongest close to the wire, and a bigger current makes it stronger. Reverse the current, and the swirl turns the other way. Pause here, and try it yourself.
>
> Now wind the wire into a coil. This is called a solenoid. The swirls from every turn join up inside, like small streams joining into one strong, steady flow. Outside, the field has the same shape as a bar magnet's. Slide in an iron core, and the field gets stronger still. That is an electromagnet: a magnet you can switch on and off. Pause, and try it.
>
> That is everything Foundation tier needs. The rest is Higher tier: how this makes a motor turn.
>
> Put a wire carrying a current between two magnets. The magnets' field is a steady stream, flowing from north to south. The current adds its own swirl. On one side of the wire, the swirl runs with the stream. On the other side, it runs against it. So the wire is pushed sideways, and the magnets are pushed the other way. This push is called the motor effect.
>
> Which way is the push? Use Fleming's left-hand rule. First finger for the field. Second finger for the current. Your thumb shows the force. Pause, and predict: what happens to the force if the current is reversed?
>
> Now look at the whole coil. The current flows one way along this side, and back the other way along that side. So one side is pushed up, and the other is pushed down. Like a paddle wheel in the stream, the coil turns. Pause, and predict what flipping the magnets would do.
>
> Watch out for one common mistake. The magnets do not pull the coil round. Copper is not attracted to magnets. Switch the current off, and the forces vanish. No current, no force.
>
> Quick check. Why do the two sides of the coil move in opposite directions? Because the current flows in opposite directions in them. So, in one line: a current in a magnetic field feels a force, and that force turns the motor.

## Scenes

| # | Tier · spec | Words | What is said | On screen | Source |
|---|---|---|---|---|---|
| 1 | All | 43 | The fan puzzle | Title card, then the 3D motor spinning | HyperFrames + 3D model |
| 2 | All | 27 | The stream analogy | Water flowing; a post; the swirl round it | Manim |
| 3 | All · 4.7.2.1 | 68 | A current makes a field round a wire | Compasses round the wire: current on, bigger, reversed | 3D model, step 1 |
| 4 | All · 4.7.2.1 | 66 | Solenoid and electromagnet | Solenoid field, then the iron core slides in | 3D model, step 2 |
| 5 | HT marker | 17 | Foundation ends here | "Higher tier from here" card | HyperFrames |
| 6 | HT · 4.7.2.2 | 67 | The motor effect | Stream between N and S; the wire's swirl; with and against; the push on the wire and on the magnets | Manim |
| 7 | HT · 4.7.2.2 | 37 | Fleming's left-hand rule | Field, current and force arrows on the coil | 3D model, step 5 |
| 8 | HT · 4.7.2.3 | 53 | Why the coil turns | Current and force on each side, then the coil turning | 3D model, steps 5 and 6 |
| 9 | HT · 4.7.2.2 | 31 | Misconception: the magnets pull the coil | Current off: arrows vanish, the coil stops; on again | 3D model, step 6 |
| 10 | HT · 4.7.2.3 | 43 | Quick check and summary | Question, answer, one-line summary | HyperFrames |

## Pause points (the page pauses the video and offers "Try it in 3D")

| After scene | Question shown on the page | Model step |
|---|---|---|
| 3 | What happens to the compasses when you make the current bigger, then reverse it? | Field around a wire |
| 4 | Where is the solenoid's field strongest? What does the iron core do? | Solenoid, iron core on |
| 7 | Predict: what happens to the force if the current is reversed? (HT) | A force on each side, current reversed |
| 8 | Predict: what would flipping the magnets do to the coil? (HT) | The coil turns, magnets flipped |

Timings are set from the recorded narration; see `video-src/dc-motor/timings/explain.json`.
