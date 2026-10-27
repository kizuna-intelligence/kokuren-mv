import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  formFromConfig,
  loadAssets,
  writeJob,
} from "../skills/biim-motion/scripts/new-job.ts";
import { wavBuffer } from "../skills/biim-motion/assets/job-template/runtime/scripts/lib.mjs";

const script = path.resolve("skills/biim-motion/scripts/new-job.ts");
const tmp = () => fs.mkdtemp(path.join(os.tmpdir(), "kokuren-mv-"));
const required = { title: "虹はどうしてできる？", description: "光の分散", audience: "中高生" };
const readJson = async (file: string) => JSON.parse(await fs.readFile(file, "utf8"));

test("explanation job contains the template, project and brief", async () => {
  const out = path.join(await tmp(), "job");
  await writeJob(formFromConfig(required), await loadAssets(), out);
  for (const file of ["AGENTS.md", "CLAUDE.md", "runtime/package.json", "assets/fonts/NotoSansJP-Variable.ttf", "plan/.gitkeep"])
    await fs.access(path.join(out, file));
  const project = await readJson(path.join(out, "project.json"));
  assert.equal(project.mode, "explanation");
  assert.equal(project.title, required.title);
  assert.deepEqual(project.scenes, []);
  assert.match(await fs.readFile(path.join(out, "brief.md"), "utf8"), /場面に合わせたBGM・SE制作/);
});

test("duo config merges the second character over defaults and copies assets", async () => {
  const dir = await tmp();
  await fs.writeFile(path.join(dir, "a.glb"), "glTF1");
  await fs.writeFile(path.join(dir, "b.glb"), "glTF2");
  await fs.writeFile(path.join(dir, "memo.md"), "# memo");
  const config = {
    ...required,
    characterMode: "duo" as const,
    secondCharacter: { name: "なっと", subtitleColor: "#00ff00" },
    assets: { character: "a.glb", secondCharacter: "b.glb", sources: ["memo.md"] },
  };
  const out = path.join(dir, "job");
  await writeJob(formFromConfig(config), await loadAssets(config.assets, dir), out);
  const project = await readJson(path.join(out, "project.json"));
  assert.equal(project.characters[1].name, "なっと");
  assert.equal(project.characters[1].subtitle_color, "#00ff00");
  assert.equal(project.characters[1].role, "聞き手・質問役");
  assert.equal(await fs.readFile(path.join(out, "assets/character2.glb"), "utf8"), "glTF2");
  assert.equal(project.sources[0].path, "sources/memo.md");
});

test("MV CLI measures the music with ffprobe and stores lyrics", async (t) => {
  try {
    execFileSync("ffprobe", ["-version"]);
  } catch {
    return t.skip("ffprobe not installed");
  }
  const dir = await tmp();
  await fs.writeFile(
    path.join(dir, "song.wav"),
    wavBuffer(Float32Array.from({ length: 48000 * 2 }, (_, i) => 0.1 * Math.sin(i / 10))),
  );
  await fs.writeFile(
    path.join(dir, "config.json"),
    JSON.stringify({ ...required, videoMode: "mv", musicLyrics: "一行目\n二行目\n", assets: { music: "song.wav" } }),
  );
  const out = path.join(dir, "job");
  execFileSync(process.execPath, ["--experimental-strip-types", script, path.join(dir, "config.json"), out]);
  const project = await readJson(path.join(out, "project.json"));
  assert.equal(project.mode, "mv");
  assert.equal(project.layout.mode, "fullscreen");
  assert.equal(project.audio.music, "assets/music.wav");
  assert.ok(Math.abs(project.audio.music_duration_sec - 2) < 0.05);
  assert.equal(await fs.readFile(path.join(out, "plan/lyrics.txt"), "utf8"), "一行目\n二行目\n");
});

test("invalid config and non-empty output folders are rejected", async () => {
  const dir = await tmp();
  await assert.rejects(writeJob(formFromConfig({ title: "x" }), await loadAssets(), path.join(dir, "a")), /対象視聴者/);
  await fs.writeFile(path.join(dir, "keep.txt"), "");
  await assert.rejects(writeJob(formFromConfig(required), await loadAssets(), dir), /空ではありません/);
});
