"""Word timings for a narration take, using the local Whisper model (no network, no credits).

Usage: python align.py audio/explain.mp3 timings/explain.words.json
"""
import json
import sys

import whisper

audio, out = sys.argv[1], sys.argv[2]
model = whisper.load_model("small")
result = model.transcribe(audio, language="en", word_timestamps=True, condition_on_previous_text=False, temperature=0)
words = []
for seg in result["segments"]:
    for w in seg.get("words", []):
        words.append({"w": w["word"].strip(), "s": round(float(w["start"]), 3), "e": round(float(w["end"]), 3)})
with open(out, "w", encoding="utf-8") as f:
    json.dump({"text": result["text"].strip(), "words": words}, f, ensure_ascii=False, indent=1)
print(len(words), "words;", result["text"].strip()[:200])
