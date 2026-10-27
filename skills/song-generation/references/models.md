# 曲を作るOSSの調査（2026-10-27時点）

このスキルは、調べた中でいちばん新しい **MiniMax Music 3** を使う。ほかの候補は記録のために残す。リリース日・ライセンスは、GitHub・Hugging Faceのページで確認した（「未確認」は二次情報しか見つからなかったもの）。

## 歌入りの曲

| モデル | 公開 | 重みのライセンス | 日本語 | VRAM・長さ | メモ |
| --- | --- | --- | --- | --- | --- |
| **MiniMax Music 3** | 2026-08 | MiniMax-Music3 Community License | 未確認（このスキルで試した結果はSKILL.md） | 24GB未満（CPU退避で約22GB、層ごとの読み込みで8GB）・約5分 | 8B＋0.6BのLLMとフローマッチング。公式の高速版（SGLang-Omni）はCUDAのGPUが2枚必要、diffusers版は1枚 |
| ACE-Step 1.5（＋XL） | 2026-01、XLは2026-04 | MIT（生成物は商用可と明記） | ○（公式の例に日本語あり） | 4GB〜（XLは12〜20GB）・10分 | 速い。AMD（ROCm）、Mac、Intelにも対応 |
| HeartMuLa 3B | 2026-01〜02、カバー用モデルが2026-09 | Apache-2.0 | ○（コミュニティ情報） | 6〜16GB・4分 | 歌詞の書き起こしモデルもある |
| YuE2 3B | 2026-09 | CC BY-NC 4.0（非商用） | ×（英語・中国語） | 11〜14GB・約5分 | 楽譜（ABC記法）を編集できる |
| SongGeneration 2 / LeVo 2（Tencent） | 2026-03 | 不明（Hugging Faceの表示がunknown） | ○ | 10〜28GB・4分30秒 | |
| DiffRhythm 2 | 2025-10 | Apache-2.0 | 未確認 | 4分超 | 歌詞にタイムスタンプが要る |
| WanSong v1.0（Alibaba） | 論文は2026-07 | 重みの公開を確認できず | 多言語 | 25B | |

## 伴奏のみ

| モデル | 公開 | ライセンス | メモ |
| --- | --- | --- | --- |
| Magenta RealTime 2（Google） | 2026-05 | CC BY 4.0 | リアルタイムに生成し続ける |
| Stable Audio Open | 2024〜2025 | Stability AI Community License | ループ音・効果音向き |
| MusicGen（Meta） | 2023 | CC BY-NC（非商用） | 短い曲 |

## MiniMax Music 3のライセンスの要点

[LICENSE](https://huggingface.co/MiniMaxAI/MiniMax-Music3/blob/main/LICENSE)の原文を必ず確認すること。以下は要約で、法的な助言ではない。

- 重み・コードの利用・改変・再配布は可。著作権表示とライセンス文を残す。
- 商用の製品・サービスで使う場合は、その画面に「MiniMax-Music3」と目立つように表示する。
- 年間売上が2000万ドルを超える場合は、MiniMaxの書面による許可が別に必要。
- 生成機能を第三者に提供する場合は、権利侵害を防ぐ対策を用意する。
- 付属のAcceptable Use Policyに従う。第三者の知的財産権を侵害しない（実在の曲・歌手の模倣を頼まない）。

## 出典

- MiniMax Music 3: https://github.com/MiniMax-AI/MiniMax-Music3 / https://huggingface.co/MiniMaxAI/MiniMax-Music3
- ACE-Step 1.5: https://github.com/ace-step/ACE-Step-1.5 / https://arxiv.org/abs/2602.00744
- HeartMuLa: https://github.com/HeartMuLa/heartlib / https://arxiv.org/abs/2601.10547
- YuE2: https://huggingface.co/m-a-p/YuE2-3B
- SongGeneration 2: https://gaga.art/blog/songgeneration-2/
- DiffRhythm 2: https://arxiv.org/abs/2510.22950 / WanSong: https://arxiv.org/abs/2607.14749
- まとめ記事: https://boppy.me/blog/best-open-source-ai-music-models / https://www.spheron.network/blog/deploy-open-source-ai-music-generation-gpu-cloud-2026/
