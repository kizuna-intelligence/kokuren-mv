# 設定JSONの項目

項目名はBiimMotionWebUIのフォーム（`scripts/job.ts`の`MotionForm`）と同じ。書かない項目はモードの既定値になる。正確な既定値は`new-job.ts --defaults [mv]`で確認する。

## 共通

| 項目 | 既定 | 意味 |
| --- | --- | --- |
| `videoMode` | `"explanation"` | `"explanation"`（解説動画）または`"mv"` |
| `title` | 必須 | 動画タイトル。出力フォルダ名ではない |
| `description` | 必須 | 何を説明する動画か（MVでは目的） |
| `audience` | 必須 | 対象視聴者 |
| `durationSec` | `300` | 希望尺（5〜7200秒の整数）。制作目標であり、音声・音源の実測尺を優先する |
| `urls` | `""` | 参考URL。改行区切り、HTTP/HTTPSのみ。ジョブ作成時には取得しない |
| `instructions` | 解説: `""` / MV: 既定文 | 動画全体への指示（最優先） |
| `design` | モードごとの既定文 | デザイン方向性 |
| `width` / `height` | `1920` / `1080` | 240〜7680の偶数。縦（height > width）にすると全画面モードになる。例: 1080×1920、3840×2160 |
| `fps` | `30` | 24 / 25 / 30 / 60 |

## MV

| 項目 | 既定 | 意味 |
| --- | --- | --- |
| `musicMood` | `""` | 曲の雰囲気・世界観 |
| `musicLyrics` | `""` | 歌詞（改行そのまま）。`plan/lyrics.txt`にも保存する |
| `musicDurationSec` | `null` | 音源の尺。`null`なら`ffprobe`で測る |

MVでは解説動画用の項目（キャラ・音声・BGM/SE・調査）は使わない。Biim枠なしの全画面、Web調査なしに固定される。

## 解説動画: 演出

| 項目 | 既定 | 値 |
| --- | --- | --- |
| `fullScreen` | `false` | `true`で全場面Biim枠なし |
| `biimUsage` | `"sometimes"` | `never` / `sometimes` / `mostly`（`never`は全画面） |
| `tempo` | `"fast"` | `slow` / `balanced` / `fast` |
| `energy` | `"balanced"` | `restrained` / `balanced` / `bold` |
| `motionAmount` | `"rich"` | `minimal` / `balanced` / `rich` |
| `characterUsage` | `"frequent"` | `none` / `occasional` / `frequent` |
| `diagramPolicy` | 既定文 | 数式・図解・チャートの方針 |
| `allowWebResearch` | `true` | 追加Web調査の可否（提供URLの直接参照は常に可） |
| `evidencePolicy` | `"primary"` | `primary`（一次資料優先）/ `supplied-only`（提供資料のみ）/ `balanced` |

## 解説動画: キャラクター

`characterMode`が`"solo"`なら1人目だけ、`"duo"`なら2人の掛け合い。

| 1人目 | 2人目（`secondCharacter`内） | 既定 |
| --- | --- | --- |
| `characterName` / `characterReading` | `name` / `reading` | 空（任意）。読み仮名は音声だけに使い、字幕は表記のまま |
| `characterPersonality` | `personality` | 落ち着いて丁寧 / 好奇心旺盛 |
| `characterSpeakingStyle` | `speakingStyle` | です・ます調 / 親しみやすい口調 |
| `characterRole` | `role` | 解説役 / 聞き手・質問役 |
| `characterPosition` | `position` | `left` / `right` |
| `characterNotes` | `notes` | 表情・動きへの指示 |
| `subtitleColor` | `subtitleColor` | `#0000ff` / `#ff0000`（6桁HEX、白ふちは共通） |
| `styleId` | `styleId` | `1069147200`（kokuren_3rd ノーマル）/ `1566366592`（natto-z ノーマル） |
| `voiceSpeed` | `voiceSpeed` | `1`（0.5〜2.0） |
| `voiceNotes` | `voiceNotes` | 読み方への指示 |

## 解説動画: 音声・音響

| 項目 | 既定 | 意味 |
| --- | --- | --- |
| `voiceEngine` | `"aivis"` | `"aivis"`または`"none"`（音声合成なし） |
| `engineUrl` | `http://127.0.0.1:10101` | AivisSpeech EngineのURL |
| `generateAudio` | `true` | 簡単なBGM・SEを手続き生成するか |
| `audioNotes` | 既定文 | BGM・SEの方針 |

## 添付ファイル（`assets`）

| 項目 | 形式 | 使うモード |
| --- | --- | --- |
| `sources` | 任意のファイルの配列 → `sources/` | 両方 |
| `character` / `secondCharacter` | `.glb` → `assets/character.glb` / `character2.glb` | 解説動画（2人目は`duo`のみ） |
| `bgm` | mp3 / wav / ogg / m4a / aac → `assets/bgm.*` | 解説動画 |
| `music` | mp3 / wav / ogg / m4a / aac → `assets/music.*` | MV（必須） |

添付の合計は500MBまで（WebUIと同じ制限）。
