"""Transcribe generated songs to check that the lyrics are actually sung.

    python check_lyrics.py songs/*.wav [--language ja] [--model medium]

Needs faster-whisper (pip install faster-whisper). Runs on CPU.
Whisper often repeats a lyric line over a long instrumental intro; judge the sung part.
"""

import argparse

from faster_whisper import WhisperModel


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("files", nargs="+")
    parser.add_argument("--language", default="ja")
    parser.add_argument("--model", default="medium")
    args = parser.parse_args()

    model = WhisperModel(args.model, device="cpu", compute_type="int8")
    for file in args.files:
        segments, _ = model.transcribe(file, language=args.language)
        print(f"== {file}")
        for s in segments:
            print(f"  {s.start:6.1f}-{s.end:6.1f} {s.text.strip()}")


if __name__ == "__main__":
    main()
