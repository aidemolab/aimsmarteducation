"""Manim scenes for the DC motor Explain video: the stream analogy (scene 2) and the motor effect (scene 6).

Cue times come from timings/explain.json, so the pictures follow the recorded narration.
Render:  manim -qh --fps 30 -r 1920,1080 --media_dir ../build/manim scenes.py S2Stream S6MotorEffect
"""
import json
from pathlib import Path

import numpy as np
from manim import *

T = json.loads((Path(__file__).parent.parent / "timings" / "explain.json").read_text(encoding="utf-8"))
BG = "#0d1320"
FIELD = "#8C90F0"
TEXT = "#F4F5FA"
MUTED = "#B9BCCB"
COPPER = "#D9975A"
NORTH = "#D64541"
SOUTH = "#3D6FD6"
FORCE = "#3DDC97"
AMBER = "#E9B949"
FONT = "Segoe UI"


def scene_info(n):
    s = T["scenes"][n - 1]
    return s["duration"], [round(x["start"] - s["start"], 3) for x in s["sentences"]]


def label(text, size=34, color=TEXT, weight=BOLD):
    return Text(text, font=FONT, font_size=size, color=color, weight=weight)


class Timed(Scene):
    """A scene with a clock: self.at(t) waits until t seconds from the start."""

    def setup(self):
        self.camera.background_color = BG

    def now(self):
        return self.renderer.time

    def at(self, t):
        if t - self.now() > 1 / 60:
            self.wait(t - self.now())

    def stream_dots(self, y, x0=-7.6, x1=7.6, n=7, speed=1.5, color=FIELD, radius=0.07, phase=0.0):
        """Dots drifting left to right along y: the 'water' in the stream."""
        dots = VGroup()
        span = x1 - x0
        for i in range(n):
            d = Dot(radius=radius, color=color)
            d.offset = i * span / n + phase
            d.add_updater(lambda m, y=y: m.move_to([x0 + (m.offset + speed * self.now()) % span, y, 0]))
            dots.add(d)
        return dots

    def swirl_dots(self, centre, r, n=5, speed=1.4, color=AMBER, radius=0.07, direction=1):
        """Dots circling a centre: the 'swirl'. direction=1 is anticlockwise."""
        dots = VGroup()
        for i in range(n):
            d = Dot(radius=radius, color=color)
            d.offset = i * TAU / n
            d.add_updater(lambda m: m.move_to(np.array(centre) + r * np.array([
                np.cos(m.offset + direction * speed * self.now() / r), np.sin(m.offset + direction * speed * self.now() / r), 0])))
            dots.add(d)
        return dots


class S2Stream(Timed):
    def construct(self):
        total, cue = scene_info(2)
        title = label("A picture to keep in mind", 40, MUTED).to_edge(UP, buff=0.7)
        ys = [-2.6, -1.3, 0, 1.3, 2.6]
        lines = VGroup(*[Line([-7.6, y, 0], [7.6, y, 0], color=FIELD, stroke_width=3, stroke_opacity=0.35) for y in ys])
        water = VGroup(*[self.stream_dots(y, phase=0.9 * i) for i, y in enumerate(ys)])
        stream_lbl = label("a stream", 36, FIELD).move_to([-5.2, 3.3, 0])
        post = Circle(radius=0.5, color="#8A8F9C", fill_color="#5A5F6C", fill_opacity=1, stroke_width=4)
        rings = VGroup(*[Circle(radius=r, color=AMBER, stroke_width=3, stroke_opacity=0.45) for r in (1.0, 1.6)])
        swirl = VGroup(self.swirl_dots([0, 0, 0], 1.0), self.swirl_dots([0, 0, 0], 1.6, n=7))
        swirl_lbl = label("the swirl round a post", 36, AMBER).move_to([3.9, 2.25, 0])
        like = label("A magnetic field behaves a lot like this", 44).to_edge(DOWN, buff=0.6)
        plate = BackgroundRectangle(like, color=BG, fill_opacity=0.85, buff=0.25)

        self.at(cue[0])
        self.play(FadeIn(title, shift=DOWN * 0.2), run_time=0.6)
        self.at(cue[1])
        self.play(FadeIn(lines), FadeIn(water), FadeIn(stream_lbl), run_time=0.9)
        self.at(cue[1] + 1.75)  # "swirling round a post"
        self.play(GrowFromCenter(post), FadeIn(rings), FadeIn(swirl), FadeIn(swirl_lbl), run_time=0.8)
        self.at(cue[2] + 1.6)  # "... because a magnetic field behaves a lot like it"
        self.play(FadeOut(title), FadeIn(plate), FadeIn(like, shift=UP * 0.2), run_time=0.7)
        self.at(total)


class S6MotorEffect(Timed):
    def construct(self):
        total, cue = scene_info(6)
        # Magnets, and a wire seen end-on (the current comes towards you)
        mag_n = RoundedRectangle(width=1.5, height=4.6, corner_radius=0.12, color=NORTH, fill_color=NORTH, fill_opacity=1).move_to([-5.6, 0, 0])
        mag_s = RoundedRectangle(width=1.5, height=4.6, corner_radius=0.12, color=SOUTH, fill_color=SOUTH, fill_opacity=1).move_to([5.6, 0, 0])
        n_lbl = label("N", 60).move_to(mag_n)
        s_lbl = label("S", 60).move_to(mag_s)
        wire = Circle(radius=0.42, color=COPPER, fill_color="#2A1C12", fill_opacity=1, stroke_width=8)
        wire_dot = Dot(radius=0.11, color=COPPER)
        wire_lbl = label("wire: current towards you", 30, COPPER).move_to([0, -3.45, 0])
        # The magnets' field: a stream from N to S
        ys = [-1.8, -0.9, 0.9, 1.8]
        lines = VGroup(*[Line([-4.7, y, 0], [4.7, y, 0], color=FIELD, stroke_width=3, stroke_opacity=0.4) for y in ys])
        heads = VGroup(*[Triangle(color=FIELD, fill_color=FIELD, fill_opacity=0.8).scale(0.13).rotate(-PI / 2).move_to([4.45, y, 0]) for y in ys])
        water = VGroup(*[self.stream_dots(y, x0=-4.7, x1=4.7, n=5, speed=1.3, phase=0.6 * i) for i, y in enumerate(ys)])
        stream_lbl = label("the magnets' field: a stream from N to S", 30, FIELD).move_to([0, 3.45, 0])
        # The current's own field: a swirl (anticlockwise for a current towards you)
        rings = VGroup(*[Circle(radius=r, color=AMBER, stroke_width=3, stroke_opacity=0.5) for r in (0.95,)])
        swirl = self.swirl_dots([0, 0, 0], 0.95, n=6, speed=1.3)
        swirl_lbl = label("the current's swirl", 30, AMBER).move_to([2.9, 0, 0])
        # With the stream below the wire, against it above
        with_box = RoundedRectangle(width=3.6, height=0.9, corner_radius=0.15, color=FORCE, stroke_width=4).move_to([0, -0.95, 0])
        with_lbl = label("with the stream: stronger", 30, FORCE).move_to([-0.2, -2.55, 0])
        against_box = RoundedRectangle(width=3.6, height=0.9, corner_radius=0.15, color=NORTH, stroke_width=4).move_to([0, 0.95, 0])
        against_lbl = label("against the stream: weaker", 30, "#FF8A80").move_to([-0.2, 2.55, 0])
        # The push on the wire, and the equal push back on the magnets
        push = Arrow([0, 0.2, 0], [0, 2.25, 0], color=FORCE, stroke_width=12, buff=0, max_tip_length_to_length_ratio=0.22)
        push_lbl = label("force on the wire", 32, FORCE).move_to([-2.6, 1.55, 0])
        back = VGroup(
            Arrow([-5.6, -2.4, 0], [-5.6, -3.6, 0], color=FORCE, stroke_width=10, buff=0, max_tip_length_to_length_ratio=0.35),
            Arrow([5.6, -2.4, 0], [5.6, -3.6, 0], color=FORCE, stroke_width=10, buff=0, max_tip_length_to_length_ratio=0.35),
        )
        back_lbl = label("force on the magnets", 30, FORCE).move_to([3.1, -3.45, 0])
        name = label("The motor effect", 64).move_to([0, 3.35, 0])

        self.at(cue[0])
        self.play(FadeIn(mag_n, shift=RIGHT * 0.3), FadeIn(mag_s, shift=LEFT * 0.3), FadeIn(n_lbl), FadeIn(s_lbl), run_time=0.7)
        self.play(GrowFromCenter(wire), FadeIn(wire_dot), FadeIn(wire_lbl), run_time=0.7)
        self.at(cue[1])
        self.play(FadeIn(lines), FadeIn(heads), FadeIn(water), FadeIn(stream_lbl), run_time=0.9)
        self.at(cue[2])
        self.play(FadeIn(rings), FadeIn(swirl), FadeIn(swirl_lbl), run_time=0.7)
        self.at(cue[3])
        self.play(FadeOut(swirl_lbl), FadeOut(wire_lbl), Create(with_box), FadeIn(with_lbl), run_time=0.8)
        self.at(cue[4])
        self.play(Create(against_box), FadeIn(against_lbl), run_time=0.8)
        self.at(cue[5])
        self.play(FadeOut(with_box), FadeOut(against_box), FadeOut(against_lbl), FadeOut(with_lbl), FadeOut(stream_lbl), run_time=0.4)
        self.play(GrowArrow(push), FadeIn(push_lbl), run_time=0.7)
        self.at(cue[5] + 2.0)  # "... and the magnets are pushed the other way"
        self.play(*[GrowArrow(a) for a in back], FadeIn(back_lbl), run_time=0.7)
        self.at(cue[6] + 0.6)
        self.play(FadeIn(name, shift=DOWN * 0.2), run_time=0.7)
        self.at(total)
