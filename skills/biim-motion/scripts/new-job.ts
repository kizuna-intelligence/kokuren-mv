// Creates a Motion Job folder from a JSON config.
// Ported from the ZIP export (generateJob) of kokuren333/BiimMotionWebUI src/job.ts (Apache-2.0).
//
//   node --experimental-strip-types new-job.ts --defaults [explanation|mv]
//   node --experimental-strip-types new-job.ts <config.json> <out-dir>
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  agentPromptFor,
  createBiimFrame,
  createBrief,
  createProject,
  defaults,
  switchVideoMode,
  uniqueNames,
  usesFullScreen,
  validateForm,
  type Attachment,
  type JobAssets,
  type MotionForm,
} from "./job.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const templateDir = path.resolve(here, "../assets/job-template");

interface AssetPaths {
  sources?: string[];
  character?: string;
  secondCharacter?: string;
  bgm?: string;
  music?: string;
}
type Config = Partial<Omit<MotionForm, "secondCharacter">> & {
  secondCharacter?: Partial<MotionForm["secondCharacter"]>;
  assets?: AssetPaths;
};

const mimeTypes: Record<string, string> = {
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".csv": "text/csv",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".mp4": "video/mp4",
  ".glb": "model/gltf-binary",
};

export function baseForm(mode: MotionForm["videoMode"]): MotionForm {
  return mode === "mv" ? switchVideoMode(defaults, "mv") : defaults;
}

export function formFromConfig(config: Config): MotionForm {
  const { assets: _assets, secondCharacter, ...fields } = config;
  const base = baseForm(config.videoMode ?? "explanation");
  return {
    ...base,
    ...fields,
    secondCharacter: { ...base.secondCharacter, ...secondCharacter },
  };
}

async function attachment(file: string): Promise<Attachment> {
  const data = new Uint8Array(await fs.readFile(file));
  return {
    name: path.basename(file),
    data,
    size: data.byteLength,
    type: mimeTypes[path.extname(file).toLowerCase()] ?? "",
  };
}

export async function loadAssets(paths: AssetPaths = {}, baseDir = ".") {
  const load = (file?: string) =>
    file ? attachment(path.resolve(baseDir, file)) : undefined;
  const assets: JobAssets = {
    sources: await Promise.all(
      (paths.sources ?? []).map((file) => attachment(path.resolve(baseDir, file))),
    ),
    character: await load(paths.character),
    secondCharacter: await load(paths.secondCharacter),
    bgm: await load(paths.bgm),
    music: await load(paths.music),
  };
  return assets;
}

// The WebUI reads the duration in the browser; here ffprobe measures it.
export function probeDuration(file: string): number {
  const out = execFileSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file],
    { encoding: "utf8" },
  );
  return Number(out.trim());
}

export async function writeJob(
  form: MotionForm,
  assets: JobAssets,
  outDir: string,
) {
  const errors = validateForm(form, assets);
  if (errors.length) throw new Error(errors.join("\n"));
  const existing = await fs.readdir(outDir).catch(() => []);
  if (existing.length)
    throw new Error(`出力先が空ではありません: ${outDir}`);
  await fs.cp(templateDir, outDir, { recursive: true });
  const write = async (file: string, data: string | Uint8Array) => {
    await fs.mkdir(path.dirname(path.join(outDir, file)), { recursive: true });
    await fs.writeFile(path.join(outDir, file), data);
  };
  const project = createProject(form, assets);
  await write("project.json", JSON.stringify(project, null, 2) + "\n");
  await write(
    "assets/biim-frame.svg",
    createBiimFrame(project.layout.subtitle_frame),
  );
  await write(
    "brief.md",
    createBrief(form, assets) +
      (form.videoMode === "mv"
        ? ""
        : `${usesFullScreen(form) ? "\n## 全画面の演出\nBiim枠や固定ノート欄は使わない。縦画面は縦向けに構図・文字・キャラの位置を設計する。BiimScene / BiimOverlayも枠なしで画面全体を使用する。\n" : ""}\n## 場面テキストと字幕\nBiimを使う設定の場面ではproject.layoutの枠・ノートの標準座標、同梱SVG、同梱フォントを使用する。字幕位置はレイアウトごとの既定位置に固定する。キャラは基本位置を保ちつつ、必要な場面で位置・サイズを自由に変更できる。全画面・縦画面ではBiim枠を使わない。場面ごとにnote_top（右上）、note_bottom（右下）、script（読み上げ・字幕）をOpusが記入する。BiimSceneコンポーネントがノートを枠に配置し、npm run voiceはscriptから音声と字幕を生成できる。映像は自由なReact/Remotionシーンとして実装する。掛け合いはscenes[].dialogueにspeaker_id (character1 / character2) とtextを記入するか、plan/narration.jsonのsegmentsで指定する。音声と字幕は話者ごとの設定を使用し、字幕の名前は表記、音声は読み仮名を使う。音声だけ別の読みを指定する場合はspoken_textを記入する。\n\n## 場面に合わせたBGM・SE制作\n簡単なBGM / SEの作成: ${form.generateAudio ? "許可・希望する" : "行わない（添付音源のみ使用可）"}\n${form.audioNotes}\n添付BGMがある場合はそれを優先。生成を希望する場合はruntime/scripts/sound-design.mjsを使うか、必要に応じて独自実装する。音の出現はstoryboardの説明意図に合わせ、会話を邪魔しない音量でミックスする。音源の作り方・出典・利用条件を記録し、previewを音声付きで確認する。\n`),
  );
  const names = uniqueNames(assets.sources);
  const bytes = (a: Attachment) => a.data as Uint8Array;
  for (let i = 0; i < assets.sources.length; i++)
    await write(`sources/${names[i]}`, bytes(assets.sources[i]));
  if (form.videoMode !== "mv" && assets.character)
    await write("assets/character.glb", bytes(assets.character));
  if (
    form.videoMode !== "mv" &&
    form.characterMode === "duo" &&
    assets.secondCharacter
  )
    await write("assets/character2.glb", bytes(assets.secondCharacter));
  if (project.audio.bgm && assets.bgm)
    await write(project.audio.bgm, bytes(assets.bgm));
  if (project.audio.music && assets.music)
    await write(project.audio.music, bytes(assets.music));
  if (form.videoMode === "mv" && form.musicLyrics.trim())
    await write("plan/lyrics.txt", form.musicLyrics);
  for (const folder of ["sources", "assets", "reports", "output", "plan"])
    await write(`${folder}/.gitkeep`, "");
  return project;
}

async function main(args: string[]) {
  if (args[0] === "--defaults") {
    const mode = args[1] === "mv" ? "mv" : "explanation";
    const config: Config = { ...baseForm(mode), assets: { sources: [] } };
    console.log(JSON.stringify(config, null, 2));
    return;
  }
  const [configPath, outDir] = args;
  if (!configPath || !outDir) {
    console.error(
      "usage: new-job.ts --defaults [explanation|mv]\n       new-job.ts <config.json> <out-dir>",
    );
    process.exit(2);
  }
  const config: Config = JSON.parse(await fs.readFile(configPath, "utf8"));
  const form = formFromConfig(config);
  const assets = await loadAssets(config.assets, path.dirname(configPath));
  if (form.videoMode === "mv" && assets.music && !form.musicDurationSec)
    form.musicDurationSec = probeDuration(
      path.resolve(path.dirname(configPath), config.assets!.music!),
    );
  const project = await writeJob(form, assets, path.resolve(outDir));
  console.log(`作成しました: ${path.resolve(outDir)}`);
  console.log(
    `${project.mode} / ${project.video.width}x${project.video.height} ${project.video.fps}fps / ${project.layout.mode}` +
      (project.audio.music_duration_sec
        ? ` / 音源 ${project.audio.music_duration_sec}秒`
        : ""),
  );
  console.log(`\n次の指示:\n${agentPromptFor(form.videoMode)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
