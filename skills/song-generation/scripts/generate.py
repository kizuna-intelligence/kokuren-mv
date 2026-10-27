"""Generate songs with MiniMax Music 3 (diffusers modular pipeline).

    python generate.py song.json [more.json ...] --out-dir songs/ [--seeds 1 2 3] [--offload none|cpu|stream]

song.json:
    {
      "name": "night-city",            # output file prefix
      "prompt": "Global Metadata: ...", # music description (English recommended)
      "lyrics": "[verse]\\n...",        # section tags on their own lines
      "duration": 180                  # upper bound in seconds (<= 300)
    }

Writes <name>-seed<N>.wav (44.1 kHz stereo) and <name>-seed<N>.json for each song and seed.
The model is loaded once for all songs.
"""

import argparse
import json
import re
import time
from pathlib import Path

import soundfile as sf
import torch
from diffusers import ComponentsManager, ModularPipeline

MODEL = "MiniMaxAI/MiniMax-Music3"
TAG_LINE = re.compile(r"^\s*\[[^\]]+\]\s*$")


def load_pipeline(offload: str):
    if offload == "none":
        pipe = ModularPipeline.from_pretrained(MODEL)
        pipe.load_components(dtype=torch.bfloat16)
        pipe.to("cuda")
        return pipe
    manager = ComponentsManager()
    manager.enable_auto_cpu_offload(device="cuda")
    pipe = ModularPipeline.from_pretrained(MODEL, components_manager=manager)
    pipe.load_components(dtype=torch.bfloat16)
    if offload == "stream":
        from diffusers.hooks import apply_group_offloading

        apply_group_offloading(
            pipe.language_model,
            onload_device=torch.device("cuda"),
            offload_type="leaf_level",
            use_stream=True,
        )
    return pipe


def display_lyrics(lyrics: str) -> str:
    """Lyrics without section tags, for captions in the MV."""
    lines = [line for line in lyrics.splitlines() if not TAG_LINE.match(line)]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip() + "\n"


def load_song(path: Path):
    song = json.loads(path.read_text(encoding="utf-8"))
    name = song.get("name") or path.stem
    duration = float(song.get("duration", 180))
    if not 10 <= duration <= 300:
        raise SystemExit(f"{path}: duration must be between 10 and 300 seconds")
    for line in song["lyrics"].splitlines():
        if re.match(r"^\s*\[[^\]]+\]\s*\S", line):
            raise SystemExit(f"{path}: put section tags on their own line: {line!r}")
    return name, song, duration


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("songs", type=Path, nargs="+")
    parser.add_argument("--out-dir", type=Path, required=True)
    parser.add_argument("--seeds", type=int, nargs="+", default=[1, 2])
    parser.add_argument(
        "--offload",
        choices=["none", "cpu", "stream"],
        default="none",
        help="none: >=24GB VRAM, cpu: ~22GB, stream: ~8GB (slow)",
    )
    args = parser.parse_args()

    songs = [load_song(path) for path in args.songs]
    args.out_dir.mkdir(parents=True, exist_ok=True)
    for name, song, _ in songs:
        (args.out_dir / f"{name}-lyrics.txt").write_text(
            display_lyrics(song["lyrics"]), encoding="utf-8"
        )

    started = time.time()
    pipe = load_pipeline(args.offload)
    print(f"loaded in {time.time() - started:.0f}s", flush=True)

    for name, song, duration in songs:
        for seed in args.seeds:
            started = time.time()
            audio = pipe(
                prompt=song["prompt"],
                lyrics=song["lyrics"],
                audio_duration=duration,
                generator=torch.Generator("cuda").manual_seed(seed),
                output="audios",
            )[0]
            if torch.is_tensor(audio):
                audio = audio.float().cpu().numpy()
            data = audio.T
            wav = args.out_dir / f"{name}-seed{seed}.wav"
            sf.write(wav, data, pipe.sampling_rate)
            meta = {
                "model": MODEL,
                "seed": seed,
                "duration_sec": round(len(data) / pipe.sampling_rate, 3),
                "sampling_rate": pipe.sampling_rate,
                "elapsed_sec": round(time.time() - started, 1),
                "offload": args.offload,
                "device": torch.cuda.get_device_name(0),
                "prompt": song["prompt"],
                "lyrics": song["lyrics"],
                "max_duration_sec": duration,
            }
            wav.with_suffix(".json").write_text(
                json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
            )
            print(f"{wav} {meta['duration_sec']}s ({meta['elapsed_sec']}s)", flush=True)


if __name__ == "__main__":
    main()
