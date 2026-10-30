import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { 部件 } from "../../packages/hanzi-chai/src/component";
import type {
  基本字形数据,
  基本部件数据,
} from "../../packages/hanzi-chai/src/data";
import { 部件字根 } from "../../packages/hanzi-chai/src/utils";

const root = resolve(import.meta.dir, "../..");
const out = resolve(root, "output/glyph-review/enclosure-profiles-18");
const read = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8"));
const glyphs = read<基本字形数据[]>(
  resolve(root, "packages/hanzi-chai/src/data/glyphs.json"),
);
type Variant = { modifiedGlyph: 基本字形数据 };
type Profile = {
  id: number;
  category: number | null;
  modifiedGlyph: 基本字形数据 | null;
  auxiliaryGlyphs: 基本字形数据[];
  contextVariants?: Record<string, Variant>;
  innerVariants?: Record<string, Variant>;
  innerGlyphOverrides?: Record<string, number>;
};

export function 比较部件拓扑(original: 基本部件数据, changed: 基本部件数据) {
  // 使用相同的语义 ID，避免口/囗等特殊字根检查被临时负 ID 干扰。
  const a = new 部件(original),
    b = new 部件({ ...changed, id: original.id });
  const strict = { no_cross: false };
  const full = 2 ** a.笔画数() - 1;
  const forward = b.生成新二进制切片列表(new 部件字根(a, a), strict);
  const reverse = a.生成新二进制切片列表(new 部件字根(b, b), strict);
  const differences: unknown[] = [];
  for (let i = 0; i < a.笔画数(); i++)
    for (let j = 0; j < i; j++) {
      const before = a.拓扑.新关系矩阵[i]?.[j],
        after = b.拓扑.新关系矩阵[i]?.[j];
      if (JSON.stringify(before) !== JSON.stringify(after))
        differences.push({
          strokes: [j, i],
          before: before ?? null,
          after: after ?? null,
        });
    }
  return {
    passed:
      a.笔画数() === b.笔画数() &&
      forward.includes(full) &&
      reverse.includes(full),
    full,
    forward,
    reverse,
    differences,
    subgraphsBefore: a.拓扑.划分,
    subgraphsAfter: b.拓扑.划分,
    subgraphRelationsBefore: a.拓扑.子图关系矩阵,
    subgraphRelationsAfter: b.拓扑.子图关系矩阵,
  };
}

export function 审计外框拓扑(profiles: Profile[], originals = glyphs) {
  const originalMap = new Map(originals.map((g) => [g.id, g]));
  const changedMap = new Map(originalMap);
  for (const p of profiles)
    for (const g of [
      p.modifiedGlyph,
      ...p.auxiliaryGlyphs,
      ...Object.values(p.contextVariants ?? {}).map((v) => v.modifiedGlyph),
      ...Object.values(p.innerVariants ?? {}).map((v) => v.modifiedGlyph),
    ])
      if (g) changedMap.set(g.id, g);
  const checks: {
    profileId: number;
    path: string;
    originalId: number;
    changedId: number;
    result: ReturnType<typeof 比较部件拓扑>;
  }[] = [];
  const structuralErrors: unknown[] = [];
  const cache = new Map<string, ReturnType<typeof 比较部件拓扑>>();
  const visit = (
    profileId: number,
    path: string,
    before: 基本字形数据,
    after: 基本字形数据,
    seen = new Set<number>(),
  ) => {
    if (seen.has(after.id)) throw Error(`循环 ${after.id}`);
    if (before.type === "component" && after.type === "component") {
      const key = JSON.stringify([before.id, after.strokes]);
      let result = cache.get(key);
      if (!result) {
        result = 比较部件拓扑(before, after);
        cache.set(key, result);
      }
      checks.push({
        profileId,
        path,
        originalId: before.id,
        changedId: after.id,
        result,
      });
    } else if (
      before.type === "compound" &&
      after.type === "compound" &&
      before.references.length === after.references.length
    ) {
      const next = new Set([...seen, after.id]);
      before.references.forEach((r, i) => {
        visit(
          profileId,
          `${path}/${i}`,
          originalMap.get(r.id)!,
          changedMap.get(after.references[i]!.id)!,
          next,
        );
      });
    } else
      structuralErrors.push({
        profileId,
        path,
        before: before.id,
        after: after.id,
        error: "部件层级不对应",
      });
  };
  for (const p of profiles.filter((p) => p.category === 2)) {
    visit(p.id, "default", originalMap.get(p.id)!, p.modifiedGlyph!);
    for (const [key, v] of Object.entries(p.contextVariants ?? {}))
      visit(p.id, `operator:${key}`, originalMap.get(p.id)!, v.modifiedGlyph);
    for (const [key, v] of Object.entries(p.innerVariants ?? {}))
      visit(p.id, `inner:${key}`, originalMap.get(p.id)!, v.modifiedGlyph);
    for (const [oldId, newId] of Object.entries(p.innerGlyphOverrides ?? {}))
      visit(
        p.id,
        `inner-override:${oldId}`,
        originalMap.get(Number(oldId))!,
        changedMap.get(newId)!,
      );
  }
  const covered = new Set(checks.map((c) => c.changedId));
  const uncoveredComponents = [...changedMap.values()]
    .filter((g) => g.id < 0 && g.type === "component" && !covered.has(g.id))
    .map((g) => g.id);
  return {
    method: {
      name: "部件.生成新二进制切片列表",
      comparison:
        "原部件与变形部件相互作为字根，必须均返回全笔画掩码；不启用笔画种类退化",
      compoundTraversal:
        "按引用序号逐层对应至基本部件，覆盖默认外框、结构变体、内件变体和内件替换",
      semanticIds:
        "比较时沿用原部件语义 ID，避免临时负 ID 干扰口/囗等特殊字根检查",
    },
    status:
      checks.every((c) => c.result.passed) &&
      !structuralErrors.length &&
      !uncoveredComponents.length
        ? "passed"
        : "failed",
    deformedProfiles: profiles.filter((p) => p.category === 2).length,
    componentOccurrences: checks.length,
    uniqueComponentChecks: cache.size,
    failedProfiles: [
      ...new Set(
        checks.filter((c) => !c.result.passed).map((c) => c.profileId),
      ),
    ],
    structuralErrors,
    uncoveredComponents,
    checks,
  };
}

if (import.meta.main) {
  const artifact = read<{ decisionsSha256: string; profiles: Profile[] }>(
    resolve(out, "enclosure-profiles.json"),
  );
  const report = {
    decisionsSha256: artifact.decisionsSha256,
    artifactSha256: createHash("sha256")
      .update(readFileSync(resolve(out, "enclosure-profiles.json")))
      .digest("hex"),
    ...审计外框拓扑(artifact.profiles),
  };
  writeFileSync(
    resolve(out, "topology-audit.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(JSON.stringify({ ...report, checks: undefined }, null, 2));
  for (const c of report.checks.filter((c) => !c.result.passed))
    console.log(
      JSON.stringify({
        ...c,
        result: {
          ...c.result,
          subgraphRelationsBefore: undefined,
          subgraphRelationsAfter: undefined,
        },
      }),
    );
  if (report.status !== "passed") process.exitCode = 1;
}
