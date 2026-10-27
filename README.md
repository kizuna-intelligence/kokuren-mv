# kokuren-mv

Claude Codeから、Remotionで**解説動画**と**MV**を制作するためのスキル集です。MVに使う曲も、オープンな曲生成モデルで作れます。

| スキル | できること |
| --- | --- |
| `biim-motion` | Biim形式の解説動画と、完成した曲に合わせたモーショングラフィックスのMVを作る |
| `song-generation` | [MiniMax Music 3](https://github.com/MiniMax-AI/MiniMax-Music3)で、歌詞と曲の説明から歌入りの曲を作る |

> **クレジット**
> このリポジトリは、**kokurenさん**（[kokuren333](https://github.com/kokuren333)）が作成したソフトウェア **[BiimMotionWebUI](https://github.com/kokuren333/BiimMotionWebUI)** をベースに、Claude Codeのスキルとして作り直したものです。
> 動画制作ジョブの設計、Remotionのランタイム、Biimレイアウト、3Dキャラクター、Aivis音声合成、BGM・SEの生成、制作工程の指示（AGENTS.md）は、すべてkokurenさんの成果です。素晴らしいソフトウェアを公開してくださったkokurenさんに感謝します。
>
> 曲の生成（`song-generation`）は、kokurenさんのソフトウェアにはない、このリポジトリで追加した機能です。

## 元のソフトウェアとの違い

BiimMotionWebUIは、ブラウザのフォームで企画や設定を入力し、制作ジョブをZIPにまとめてエージェントに渡すWebアプリです。このリポジトリでは、Claude Codeから使う前提でWebUIとZIPの工程を省きました。

| | BiimMotionWebUI | kokuren-mv |
| --- | --- | --- |
| 設定の入力 | ブラウザのフォーム | 会話で依頼し、Claudeが設定JSONを書く |
| ジョブの作成 | ZIPをダウンロードして展開 | スクリプトがフォルダに直接書き出す |
| エージェントへの指示 | 「指示をコピー」して貼る | スキルが自動で読み込まれる |
| 制作の中身 | — | 元のジョブと同じ（ランタイム・AGENTS.md・設定の計算はそのまま） |

ジョブを作る処理は元の`src/job.ts`をそのまま使っています（ZIP出力の部分だけをフォルダ出力に置き換え）。同じ設定から作ったジョブは、WebUIのZIPを展開したものと同じ内容になります（下記「変更点」の追加・修正ファイルを除く）。

## インストール

Claude Codeで、このリポジトリをプラグインのマーケットプレイスとして追加してインストールします。

```text
/plugin marketplace add kizuna-intelligence/kokuren-mv
/plugin install kokuren-mv@kokuren-mv
```

プラグインを使わない場合は、`skills/`の下の各スキルを`~/.claude/skills/`（または各プロジェクトの`.claude/skills/`）にコピーしても使えます。

### 必要なもの

- Node.js 22.6以上とnpm（ジョブの初回セットアップにはネットワーク接続が必要）
- MVの音源の尺を測る`ffprobe`（FFmpeg）
- Aivis音声を使う場合は、[AivisSpeech](https://aivis-project.com/)のエンジン（既定 `http://127.0.0.1:10101`）と、使う音声モデル
- 曲を作る場合は、VRAM 24GB前後のGPU（8GBでも遅く動く）、約27GBのディスク、Python 3.12。手順は[skills/song-generation/SKILL.md](skills/song-generation/SKILL.md)

## 使い方

Claude Codeに依頼するだけです。

```text
虹ができる仕組みを中学生向けに3分で解説する動画を作って。2人の掛け合いで。
```

```text
~/music/song.wav でMVを作って。夜の街を歩くような切ない雰囲気で、歌詞はこれ: ...
```

```text
夜の街を歩くシティポップを作って、それでMVにして。歌詞はこれ: ...
```

Claudeは次の順に進めます。

1. 依頼から設定を決め、足りない必須項目（タイトル・目的・対象視聴者、MVなら音源）だけを質問します。
2. `skills/biim-motion/scripts/new-job.ts`で制作ジョブのフォルダを作ります。
3. ジョブの`AGENTS.md`に従い、台本・ストーリーボード・Remotionシーン・音声・BGM/SEを制作し、previewを確認・修正してから`output/final.mp4`を出力します。

設定項目は[skills/biim-motion/references/config.md](skills/biim-motion/references/config.md)にまとめています。

曲から作る場合は、先に`song-generation`で2〜3案の曲を作り、聴いて選んだ曲をMVに使います。曲を作るOSSの比較（2026年10月時点）は[skills/song-generation/references/models.md](skills/song-generation/references/models.md)にあります。

## 構成

```text
.claude-plugin/          # Claude Codeのプラグイン・マーケットプレイス定義
skills/biim-motion/
├─ SKILL.md              # スキル本体（設定 → ジョブ作成 → 制作の手順）
├─ references/config.md  # 設定JSONの項目と既定値
├─ scripts/
│  ├─ job.ts             # 元のsrc/job.ts（ZIP出力を除いたもの）
│  ├─ biim-standard.json # 元のBiim標準レイアウト
│  └─ new-job.ts         # 設定JSON → 制作ジョブのフォルダ
└─ assets/job-template/  # 元のjob-template（Remotionランタイム・motion-kit・フォント）
skills/song-generation/
├─ SKILL.md              # 環境の用意 → 歌詞と曲の説明 → 生成 → MVへ渡す
├─ references/models.md  # 曲を作るOSSの調査とライセンス
└─ scripts/
   ├─ generate.py        # MiniMax Music 3（diffusers）で曲を生成
   └─ check_lyrics.py    # Whisperで歌詞が歌われているか確認
tests/                   # ジョブ作成のテスト（npm test）
```

## 変更点

元のBiimMotionWebUI（コミット`e558330`）からの変更は次のとおりです。

- WebUI（`src/App.tsx`など）とZIP出力を削除。
- `skills/biim-motion/scripts/job.ts`: 元の`src/job.ts`からZIP出力（`generateJob`）とJSZipの読み込みを削除。
- `skills/biim-motion/scripts/new-job.ts`: 新規。`generateJob`と同じ内容をフォルダへ書き出すCLI。
- `assets/job-template/CLAUDE.md`: 新規。Claude Codeがジョブを開いたときに`AGENTS.md`を読み込むため。
- `assets/job-template/README.md`・`AGENTS.md`: WebUI・ZIPを前提にした文言を、スキルから使う前提に修正。
- フォント（Noto Sans JP、M PLUS Rounded 1c）を、WebUIの`public/`から`assets/job-template/assets/fonts/`へ移動。

## ライセンス

元のソフトウェアと同じく[Apache License 2.0](LICENSE)です。元の著作権表示は`Copyright 2026 kokuren333`です（[NOTICE](NOTICE)）。

同梱フォントはSIL Open Font License 1.1です（`skills/biim-motion/assets/job-template/assets/fonts/`）。Remotion、Aivisの音声モデル、ユーザーが添付する素材には、それぞれの利用条件が適用されます。詳しくはジョブの`README.md`の「条件と参考元」を参照してください。

`song-generation`はMiniMax Music 3のモデルを同梱せず、利用者が公式から取得します。モデルと生成した曲には[MiniMax-Music3 Community License](https://huggingface.co/MiniMaxAI/MiniMax-Music3/blob/main/LICENSE)が適用されます（商用の製品・サービスでは「MiniMax-Music3」の表示が必要など）。
