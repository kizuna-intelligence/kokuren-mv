---
name: song-generation
description: MiniMax Music 3（2026-08公開のオープンな曲生成モデル）で、歌詞と曲の説明から歌入りの曲（最大約5分、日本語の歌詞も可）をローカルGPUで作る。「曲を作って」「MV用のオリジナル曲」「この歌詞で歌にして」「BGMを作曲して」などの依頼で使う。できた曲はbiim-motionスキルのMVモードにそのまま渡せる。
---

# 曲を作る（MiniMax Music 3）

調べた中でいちばん新しいオープンな曲生成モデル、**MiniMax Music 3**を使う。ほかの候補とライセンスの比較は [references/models.md](references/models.md)。

このスキルのディレクトリを`$SKILL`と書く（読み込み時に表示される Base directory）。

## 前提

- GPU 1枚で動く（diffusers版）。必要なVRAMは、そのままなら24GB前後、`--offload cpu`で約22GB、`--offload stream`なら8GB（遅い）。
- 動作確認済み: AMDのGPU（ROCm 6.4のPyTorch 2.9.1）。曲の長さの数倍の時間がかかる。NVIDIAのGPUではまだ試していない（公式の想定はCUDA）。
- 重みは約27GB。ディスクの空きを先に確認する。
- 公式の高速な方法（SGLang-Omni）はCUDAのGPUが2枚必要なので、このスキルでは使わない。

## 1. 環境を用意する（初回だけ）

すでに環境があれば使う（クローン済みの`MiniMax-Music3`の下の`.venv*`など）。無ければ作る。

```sh
git clone https://github.com/MiniMax-AI/MiniMax-Music3.git && cd MiniMax-Music3
uv venv -p 3.12 .venv && source .venv/bin/activate
# NVIDIA: uv pip install torch torchaudio
# AMD:    uv pip install torch torchaudio --index-url https://download.pytorch.org/whl/rocm6.4
uv pip install "diffusers==0.41.0" transformers accelerate soundfile huggingface_hub
# SGLang版だけが使うファイルは落とさない。--excludeはパターンごとに付ける
hf download MiniMaxAI/MiniMax-Music3 --exclude "qwen_7B/qwen_7B/model-*" \
  --exclude flowmatching_vae.pth --exclude dav.pth --exclude "figures/*"
```

- モデルカードには未マージ時代のdiffusersのコミットを入れる手順が載っているが、それでは`transformer`が読み込めない。マージ済みのリリース（0.40.0以降、確認済みは0.41.0）を使う。
- Hugging Faceのキャッシュ（`HF_HOME`）のディスクが一杯なら、空きのある場所に`HF_HOME`を向ける。
- `HF_HUB_OFFLINE=1`にすると`transformer`の読み込みが失敗する。付けない。

## 2. 歌詞と曲の説明を書く

`song.json`を作る。

```json
{
  "name": "yoru-no-machi",
  "prompt": "Global Metadata: Japanese city pop, mid-tempo around 100 BPM, nostalgic night-drive mood that lifts into a bright chorus; polished 80s-inspired production. Vocal Details: warm female lead vocal singing in Japanese, airy in the verse, fuller with light harmonies in the chorus. Arrangement: intro with electric piano and slap bass; verse adds tight drums and muted guitar; chorus opens up with synth brass and lush pads; short outro on electric piano.",
  "lyrics": "[intro]\n\n[verse]\n夜の街を ひとり歩く\nネオンの色が 揺れている\n\n[chorus]\nこのまま 朝まで\n君の声 探してる\n\n[outro]",
  "duration": 180
}
```

- **曲の説明（`prompt`）は英語で**、Global Metadata（ジャンル・テンポ・感情の流れ・音作り）、Vocal Details（声の性別・声質・歌い方・ハモり）、Arrangement（セクションごとの楽器の出入り）の3部に分けて書く。
- **声の性別と声質を必ず書く。** 書かないと歌が消えて伴奏だけになることがある。日本語で歌わせるなら`singing in Japanese`も書く。
- 詳しく書きたいときは、MiniMax公式のスキル`music-caption-rewriter`が使える（`npx skills add MiniMax-AI/MiniMax-Music3 --skill music-caption-rewriter`、またはクローンした`skills/music-caption-rewriter`を`~/.claude/skills/`へコピー）。
- **歌詞（`lyrics`）は日本語の漢字・かなのまま書いてよい**（確認済み）。`[intro]` `[verse]` `[pre-chorus]` `[chorus]` `[bridge]` `[instrumental]` `[solo]` `[outro]`のタグは**必ず単独の行**に置く。タグと同じ行の歌詞は無視される（スクリプトが検出して止める）。
- 1行は短めにし、同じ位置の行は文字数をそろえる。セクションの間は空行で区切る（曲生成モデル全般のコツ。MiniMax Music 3で効果を比べてはいない）。
- `duration`は上限の秒数（10〜300）。モデルがそれより早く終えることもある。`[intro]`を付けると前奏が長くなりやすい（60秒の試作で約25秒）。
- 実在の曲・歌手の名前を出して似せさせない（ライセンスの禁止事項。下記）。

## 3. 生成する

```sh
python $SKILL/scripts/generate.py song.json --out-dir songs/ --seeds 1 2 3
```

- 同じ設定でもseedで別の曲になる。2〜3案作ってユーザーに聴いて選んでもらう。Claudeは音を聴けないので、良し悪しを自分で判断して決めない。
- 複数の曲を作るときは`song.json`を並べて1回で実行する（モデルの読み込みは1回だけ）: `python $SKILL/scripts/generate.py a.json b.json c.json --out-dir songs/ --seeds 1`
- 時間がかかる（曲の長さの数倍＋読み込み）ので、バックグラウンドで実行して完了を待つ。
- 出力: `<name>-seed<N>.wav`（44.1kHzステレオ）、同名の`.json`（seed・尺・プロンプト・歌詞・所要時間）、`<name>-lyrics.txt`（タグを除いた表示用の歌詞）。
- 歌詞がちゃんと歌われているかは、文字起こしで確かめられる（要`faster-whisper`）。前奏の部分では、Whisperが歌詞を繰り返す誤認識をしやすい。

```sh
python $SKILL/scripts/check_lyrics.py songs/*.wav --language ja
```

## 4. MVにする

選んだ曲は、biim-motionスキルのMVモードにそのまま渡す。

- `assets.music`: 選んだWAV
- `musicLyrics`: `<name>-lyrics.txt`の中身（タグなし）
- `musicMood`: `prompt`の雰囲気を日本語で短くまとめたもの
- MVの`reports/delivery.md`の採用素材に「MiniMax Music 3で生成（seed、`prompt`、`lyrics`）」を記録する。

## ライセンス（MiniMax-Music3 Community License）

原文は https://huggingface.co/MiniMaxAI/MiniMax-Music3/blob/main/LICENSE 。要点だけ書く（法的な助言ではない）。

- 商用の製品・サービスで使うなら、その画面に「MiniMax-Music3」と目立つように表示する。年間売上が2000万ドルを超える場合は、MiniMaxの書面による許可が別に必要。
- 付属のAcceptable Use Policyに従い、第三者の知的財産権を侵害しない。
- 商用で使う予定があるときは、生成の前にユーザーにこの条件を伝える。
