import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { 基本字形数据 } from "../../packages/hanzi-chai/src/data";
import {
  包围内部范围表,
  是包围结构,
} from "../../packages/hanzi-chai/src/enclosure";
import { 字形渲染器 } from "./render";
import {
  canonical,
  loadArtifact,
  makePlan,
  migrationDir,
} from "./upload-enclosures";

const read = <T>(p: string): T => JSON.parse(readFileSync(p, "utf8"));
const artifact = loadArtifact();
const before = read<基本字形数据[]>(join(migrationDir, "before-glyphs.json"));
const journal = read<{ ids: Record<string, number>; status: string }>(
  join(migrationDir, "journal.json"),
);
const plan = makePlan(artifact, before, journal.ids);
if (canonical(包围内部范围表) !== canonical(plan.layoutTable.rules))
  throw Error("全局矩形表与迁移不一致");
let final = new Map(before.map((g) => [g.id, g]));
for (const g of [...plan.newGlyphs, ...plan.updates.map((u) => u.after)])
  final.set(g.id, g);
const databaseReadbackVerified = journal.status === "complete";
if (databaseReadbackVerified) {
  const actual = read<基本字形数据[]>(join(migrationDir, "after-glyphs.json"));
  if (
    actual.length !== final.size ||
    new Set(actual.map((g) => g.id)).size !== final.size
  )
    throw Error("回读的字形数量或 ID 唯一性不符");
  for (const g of actual)
    if (canonical(g) !== canonical(final.get(g.id)))
      throw Error(`回读字形 ${g.id} 不符合计划，或有计划外修改`);
  for (const key of Object.keys(plan.layoutTable.rules))
    if (Number(key) <= 0) throw Error("全局表仍有临时 ID");
  final = new Map(actual.map((g) => [g.id, g]));
  const originalCharacters = read<unknown[]>(
    join(migrationDir, "before-characters.json"),
  );
  const actualCharacters = read<unknown[]>(
    join(migrationDir, "after-characters.json"),
  );
  if (
    canonical(originalCharacters.map(canonical).sort()) !==
    canonical(actualCharacters.map(canonical).sort())
  )
    throw Error("字符数据发生变化");
}
const renderer = new 字形渲染器(final);
const examples: { profileId: number; glyphId: number }[] = [];
const mismatches: unknown[] = [];
for (const p of artifact.profiles)
  for (const e of p.examples) {
    const actual = renderer.渲染(final.get(e.glyphId)!);
    const expected = readFileSync(
      resolve(
        import.meta.dir,
        "../../output/glyph-review/enclosure-profiles-18",
        e.after,
      ),
      "utf8",
    );
    if (actual !== expected)
      mismatches.push({ profileId: p.id, glyphId: e.glyphId });
    examples.push({ profileId: p.id, glyphId: e.glyphId });
  }
for (const g of plan.newGlyphs) renderer.渲染(g);
const profileIds = new Set(artifact.profiles.map((p) => p.id));
const matched = before.filter(
  (g) =>
    g.type === "compound" &&
    是包围结构(g.operator) &&
    profileIds.has(g.references[0]!.id),
);
const baselineRenderer = new 字形渲染器(new Map(before.map((g) => [g.id, g])));
const existingRenderErrors: {
  glyphId: number;
  error: string;
  baselineError: string;
}[] = [];
const newRenderErrors: { glyphId: number; error: string }[] = [];
for (const g of matched) {
  try {
    renderer.渲染(final.get(g.id)!);
  } catch (error) {
    try {
      baselineRenderer.渲染(g);
      newRenderErrors.push({ glyphId: g.id, error: String(error) });
    } catch (baselineError) {
      existingRenderErrors.push({
        glyphId: g.id,
        error: String(error),
        baselineError: String(baselineError),
      });
    }
  }
}
const report = {
  decisionsSha256: artifact.decisionsSha256,
  status: mismatches.length || newRenderErrors.length ? "failed" : "passed",
  databaseReadbackVerified,
  ...plan.summary,
  examplesChecked: examples.length,
  enclosingGlyphsChecked: matched.length,
  enclosingGlyphsRendered:
    matched.length - existingRenderErrors.length - newRenderErrors.length,
  existingRenderErrors,
  newRenderErrors,
  examplesExactlyMatchReviewed: mismatches.length === 0,
  mismatches,
};
writeFileSync(
  join(migrationDir, "render-verification.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify(report, null, 2));
if (mismatches.length || newRenderErrors.length) process.exitCode = 1;
