"""Analyze a finished song for an MV: beats, bars, loudness, lyric line timing and sections.

    python analyze_music.py song.wav --lyrics lyrics.txt --out scenes/mv-data.json [--language ja]

lyrics.txt may contain section tags such as [verse] / [chorus] on their own lines
(the format used by the song-generation skill). Each lyric line is timed by aligning
the lyrics, character by character, with a Whisper transcription of the song.

Output JSON (seconds):
    duration, bpm, beats[], downbeats[], energy[{t, rms}] (0.5 s steps, 0-1),
    lines[{start, end, text, section}], sections[{name, start, end}]

Needs librosa and faster-whisper. Runs on CPU.
"""

import argparse
import difflib
import json
import re
import unicodedata
from pathlib import Path

import librosa
import numpy as np

TAG = re.compile(r"^\s*\[([^\]]+)\]\s*$")


def parse_lyrics(text):
    lines, section = [], "verse"
    for raw in text.splitlines():
        match = TAG.match(raw)
        if match:
            section = match.group(1).strip().lower()
        elif raw.strip():
            lines.append({"text": raw.strip(), "section": section})
    return lines


def normalize(text):
    text = unicodedata.normalize("NFKC", text)
    return "".join(c for c in text if c.isalnum())


def rhythm(y, sr):
    onset = librosa.onset.onset_strength(y=y, sr=sr)
    tempo, frames = librosa.beat.beat_track(onset_envelope=onset, sr=sr)
    beats = librosa.frames_to_time(frames, sr=sr)
    # Bars of four: pick the phase whose beats carry the most onset energy.
    strengths = onset[frames] if len(frames) else np.array([])
    phase = max(range(4), key=lambda p: strengths[p::4].mean() if len(strengths[p::4]) else 0)
    return float(np.atleast_1d(tempo)[0]), beats, beats[phase::4]


def loudness(y, sr, step=0.5):
    hop = int(sr * step)
    rms = librosa.feature.rms(y=y, frame_length=hop * 2, hop_length=hop)[0]
    rms = rms / (rms.max() or 1)
    return [{"t": round(i * step, 2), "rms": round(float(v), 3)} for i, v in enumerate(rms)]


def transcribe(path, language, model_name):
    from faster_whisper import WhisperModel

    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    audio, _ = librosa.load(path, sr=16000, mono=True)
    segments, _ = model.transcribe(audio, language=language, word_timestamps=True)
    chars = []
    for segment in segments:
        for word in segment.words or []:
            text = normalize(word.word)
            for i, c in enumerate(text):
                t = word.start + (word.end - word.start) * (i + 0.5) / len(text)
                chars.append((c, t))
    return chars


def align(lines, chars, duration):
    expected, owner = [], []
    for index, line in enumerate(lines):
        for c in normalize(line["text"]):
            expected.append(c)
            owner.append(index)
    recognized = "".join(c for c, _ in chars)
    matcher = difflib.SequenceMatcher(None, "".join(expected), recognized, autojunk=False)
    times = [[] for _ in lines]
    for block in matcher.get_matching_blocks():
        for k in range(block.size):
            times[owner[block.a + k]].append(chars[block.b + k][1])
    timed = []
    for line, ts in zip(lines, times):
        start, end = (min(ts), max(ts)) if len(ts) >= 2 else (None, None)
        timed.append({**line, "start": start, "end": end})
    # Lines Whisper missed: spread them evenly between their timed neighbours.
    for i, line in enumerate(timed):
        if line["start"] is not None:
            continue
        before = next((timed[j]["end"] for j in range(i - 1, -1, -1) if timed[j]["end"] is not None), 0.0)
        j = next((j for j in range(i + 1, len(timed)) if timed[j]["start"] is not None), None)
        after = timed[j]["start"] if j is not None else duration
        gap_count = (j if j is not None else len(timed)) - i + 1
        slot = (after - before) / gap_count
        line["start"], line["end"] = before + slot * 0.1, before + slot * 0.9
        line["estimated"] = True
    for i, line in enumerate(timed):
        # Keep each line on screen until shortly before the next one starts.
        next_start = timed[i + 1]["start"] if i + 1 < len(timed) else duration
        line["end"] = max(line["end"] + 0.6, line["start"] + 1.0)
        line["end"] = min(line["end"], next_start - 0.05, duration)
        line["start"], line["end"] = round(line["start"], 2), round(line["end"], 2)
    return timed


def sections_from(lines, duration, min_gap=4.0):
    sections, cursor = [], 0.0
    for line in lines:
        if line["start"] - cursor >= min_gap:
            name = "intro" if not sections else "instrumental"
            sections.append({"name": name, "start": round(cursor, 2), "end": line["start"]})
        if sections and sections[-1]["name"] == line["section"] and line["start"] - cursor < min_gap:
            sections[-1]["end"] = line["end"]
        else:
            start = line["start"] if line["start"] - cursor >= min_gap else cursor
            sections.append({"name": line["section"], "start": round(start, 2), "end": line["end"]})
        cursor = line["end"]
    if duration - cursor > 0.5:
        sections.append({"name": "outro", "start": round(cursor, 2), "end": round(duration, 2)})
    return sections


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("audio", type=Path)
    parser.add_argument("--lyrics", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--language", default="ja")
    parser.add_argument("--whisper-model", default="medium")
    args = parser.parse_args()

    y, sr = librosa.load(args.audio, sr=22050, mono=True)
    duration = round(len(y) / sr, 3)
    bpm, beats, downbeats = rhythm(y, sr)
    data = {
        "duration": duration,
        "bpm": round(bpm, 1),
        "beats": [round(float(t), 3) for t in beats],
        "downbeats": [round(float(t), 3) for t in downbeats],
        "energy": loudness(y, sr),
        "lines": [],
        "sections": [{"name": "full", "start": 0, "end": duration}],
    }
    if args.lyrics:
        lines = parse_lyrics(args.lyrics.read_text(encoding="utf-8"))
        chars = transcribe(args.audio, args.language, args.whisper_model)
        data["lines"] = align(lines, chars, duration)
        data["sections"] = sections_from(data["lines"], duration)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    estimated = sum(1 for line in data["lines"] if line.get("estimated"))
    print(f"{duration}s, {data['bpm']} BPM, {len(beats)} beats, {len(data['lines'])} lines ({estimated} estimated)")
    for s in data["sections"]:
        print(f"  {s['start']:7.2f}-{s['end']:7.2f} {s['name']}")


if __name__ == "__main__":
    main()
