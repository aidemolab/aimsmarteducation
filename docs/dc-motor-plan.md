# Module plan: How a DC motor works

GCSE Physics · AQA 8463, specification version 1.1 (30 September 2019), section 4.7.2 The motor effect.
Built to `MODULE_BUILD_BRIEF.md` version 1.1. Everything drafted here is a **draft for Alaa's review**.

## Spec points and tiers (checked against `_specs/AQA-8463-GCSE-Physics.pdf`)

| Spec point | What students must know (our words) | Tier |
|---|---|---|
| 4.7.2.1 Electromagnetism | A current makes a magnetic field round a wire; its strength depends on the current and the distance from the wire. A solenoid makes the field stronger; inside it is strong and uniform; outside it is shaped like a bar magnet's. An iron core makes it stronger still (an electromagnet). Describe how to demonstrate the magnetic effect; draw the field patterns with their direction; explain why a solenoid strengthens the effect. | Everyone |
| 4.7.2.1 (Physics only) | Interpret diagrams of electromagnetic devices to explain how they work. | Everyone, Physics only |
| 4.7.2.2 Fleming's left-hand rule | The motor effect: the magnet and the current-carrying conductor exert a force on each other. Fleming's left-hand rule. The factors that affect the size of the force. F = B I l for a conductor at right angles to the field (given on the equation sheet). | HT only |
| 4.7.2.3 Electric motors | A coil carrying a current in a field tends to rotate; explain how the force on a conductor causes the rotation. | HT only |
| 4.7.2.4 Loudspeakers | How a moving-coil loudspeaker and headphones turn a varying current into sound. | Physics only, HT only |

**Not named in the specification:** split-ring commutator and brushes ("Going further"); right-hand grip rule ("Method (not named in the specification)"); "more turns" for a stronger solenoid field ("Not named in the specification"); ways to make a motor faster ("Going further").

## The living model

One Three.js model (`physics/dc-motor/scenes/dc-motor.js`), seven steps: field round a wire; solenoid and electromagnet; then five motor steps (field, current, force and Fleming's rule, the coil turns, the commutator). Controls: current, iron core, turns, reverse current, flip magnets, commutator, and "Current on" (off: no current, so no force). Only `explore.html` loads it.

## Hook

Puzzle: a fan starts spinning the moment you switch it on, with no engine and no fuel. What pushes the blades round? Prediction: what a compass does next to a wire when the current is switched on (everyone); three motor predictions (HT). Predictions lock and are tested in the model, not told.

## The one analogy

A stream. A magnetic field is like flowing water; a current adds a swirl, like water round a post; in a solenoid the swirls join into one steady flow; in the motor the swirl runs with the stream on one side of the wire and against it on the other, so the wire is pushed; the coil is a paddle wheel in the stream. Used in every Explain part and in the Explain video.

## Misconceptions (Spot the trap)

Everyone: the field is strongest far from the wire; reversing the current removes the field; an iron core blocks the field; (Physics only) a bell's electromagnet stays on while the button is held.
HT: the magnets attract or repel the coil directly (replay switches the current off); the commutator produces the current; a bigger current reverses the motor; left-hand and right-hand rules give the same answer; a wire parallel to the field still feels a force; a unit error in F = B I l; without a commutator the coil keeps spinning; (Physics only) a loudspeaker's magnet vibrates.

## Parts per stage (one page per part)

| Stage | Parts (HT = Higher-only part) |
|---|---|
| 1 Hook | `hook` (video, warm-up, prediction) · `hook-predict` HT |
| 2 Explore | `explore` (the model, predict-then-test tasks) |
| 3 Explain | `explain` (video with pause points) · `explain-field` · `explain-demo` · `explain-motor` HT · `explain-turning` HT · `explain-loudspeaker` HT |
| 4 Build the chain | `chain` (electromagnet chain; motor chain HT) |
| 5 Spot the trap | `trap` · `trap-motor` HT |
| 6 Do it | `do-it` · `do-it-devices` (bell, Physics only) · `do-it-rule` HT · `do-it-say` HT · `do-it-say-2` HT · `do-it-calculate` HT · `do-it-trainer` HT · `do-it-ladder` HT · `do-it-ladder-2` HT |
| 7 Write it and revisit it | `write` · `write-higher` HT · `write-higher-2` HT · `write-physics-only` · `write-organiser` · `write-exit` · `write-revisit` |

The content for everyone is a complete route on its own: every stage has at least one part with no HT content.

## Videos

| Video | Length | Page | Pause points |
|---|---|---|---|
| Hook: "What pushes the blades round?" | 23 s | `hook.html` | End: "Make a prediction" (links to the prediction) |
| Explain: "Why does the motor turn?" | 2 min 57 s | `explain.html` | 0:49 field round a wire · 1:17 solenoid · 2:05 left-hand rule (HT) · 2:25 the coil turns (HT) |

Scripts: `docs/videos/dc-motor/`. Source and rebuild steps: `video-src/dc-motor/`.

## Activities

Predictions (lock, then test); predict-then-test tasks in the model; hint ladders with example tutor questions; two chains with a diagram that lights up and stalls; twelve traps with targeted feedback; field-pattern and direction questions; electric bell diagram; left-hand rule trainer (2D); "say it" sentences; equations and units panel; F = B I l trainer that adapts over four levels; practice ladder L1–L8.

## Exam questions (all original)

Q1–Q4 everyone (4.7.2.1): describe the field round a wire; strengthen a solenoid; describe the solenoid field (with example coach feedback); describe the compass demonstration. Q5–Q8 HT: reverse a motor; calculate a current with F = B I l; explain continuous rotation (Going further); 6-mark "explain why the coil rotates" with levels and a checklist that says what to add. Q9–Q10 Physics only: explain a relay from its diagram; explain a loudspeaker (HT).

## Retrieval

Exit check (six questions; "Got it / Not yet" lists what to revisit). Day 3, day 7 and day 21 sets, each with questions for everyone and for HT, answers hidden.

## Stand-ins (labelled on the page)

3D hand trainer → 2D direction trainer. AI tutor → fixed example questions with hint ladders. AI exam coach → scripted example feedback plus self-mark checklists that say what to add. Saved progress → the exit check's revisit list lasts for the visit only. Chain page → a 2D diagram stands in for the 3D model (only Explore loads it).
