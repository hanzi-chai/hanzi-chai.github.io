import "dotenv/config";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { createClient } from "../../packages/api/src/client";
import type {
  基本字形数据,
  字符数据,
} from "../../packages/hanzi-chai/src/data";
import {
  type 包围布局规则,
  是包围结构,
} from "../../packages/hanzi-chai/src/enclosure";
import { 审计外框拓扑 } from "./enclosure-topology";

const root = resolve(import.meta.dir, "../..");
export const migrationDir = join(
  root,
  "output/glyph-review/enclosure-migration-18",
);
const profileDir = join(root, "output/glyph-review/enclosure-profiles-18");
const tablePath = join(root, "packages/hanzi-chai/src/enclosure-layouts.json");
const read = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8"));
function save(path: string, data: unknown) {
  writeFileSync(`${path}.tmp`, `${JSON.stringify(data, null, 2)}\n`);
  renameSync(`${path}.tmp`, path);
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
type TopologyProfile = Parameters<typeof 审计外框拓扑>[0][number];
type Variant = {
  modifiedGlyph: 基本字形数据;
  rectangle: 包围布局规则["rectangle"];
};
export type MigrationProfile = Omit<
  TopologyProfile,
  "contextVariants" | "innerVariants"
> & {
  rectangle: 包围布局规则["rectangle"];
  rectangles?: 包围布局规则["rectangles"];
  contextVariants?: Record<string, Variant>;
  innerVariants?: Record<string, Variant>;
  examples: { glyphId: number; after: string }[];
};
export interface Artifact {
  status: string;
  decisionsSha256: string;
  inputs: { glyphsSha256: string; charactersSha256: string };
  profiles: MigrationProfile[];
}
export function loadArtifact(): Artifact {
  const a = read<Artifact>(join(profileDir, "enclosure-profiles.json"));
  if (
    a.status !== "complete" ||
    a.profiles.length !== 171 ||
    a.profiles.filter((p) => p.category === 2).length !== 121
  )
    throw Error("交付数据不完整");
  const snapshot = join(migrationDir, "before-glyphs.json");
  const topology = 审计外框拓扑(
    a.profiles,
    existsSync(snapshot) ? read<基本字形数据[]>(snapshot) : undefined,
  );
  if (topology.status !== "passed") throw Error("拓扑审计未通过");
  return a;
}
export function definitions(a: Artifact) {
  const map = new Map<number, 基本字形数据>();
  for (const p of a.profiles)
    for (const g of [
      p.modifiedGlyph,
      ...p.auxiliaryGlyphs,
      ...Object.values(p.contextVariants ?? {}).map((v) => v.modifiedGlyph),
      ...Object.values(p.innerVariants ?? {}).map((v) => v.modifiedGlyph),
    ]) {
      if (!g) continue;
      if (g.id >= 0 || map.has(g.id))
        throw Error(`临时 ID 非负或重复：${g.id}`);
      const copy = structuredClone(g);
      delete copy.gf0014_id;
      delete copy.gf3001_id;
      map.set(copy.id, copy);
    }
  return map;
}
const mapped = (id: number, ids: Record<string, number>) =>
  ids[String(id)] ?? id;
export function remapGlyph(
  g: 基本字形数据,
  ids: Record<string, number>,
): 基本字形数据 {
  const copy = structuredClone(g);
  copy.id = mapped(copy.id, ids);
  if (copy.type === "compound")
    copy.references = copy.references.map((r) => ({
      ...r,
      id: mapped(r.id, ids),
    }));
  return copy;
}
export function makePlan(
  a: Artifact,
  before: 基本字形数据[],
  ids: Record<string, number> = {},
) {
  const profiles = new Map(a.profiles.map((p) => [p.id, p]));
  const updates: {
    before: 基本字形数据;
    after: 基本字形数据;
    profileId: number;
  }[] = [];
  const rules: Record<string, 包围布局规则> = {};
  const newGlyphs = [...definitions(a).values()].map((g) => remapGlyph(g, ids));
  for (const p of a.profiles) {
    const id = mapped(p.modifiedGlyph?.id ?? p.id, ids);
    rules[String(id)] = {
      sourceGlyphId: p.id,
      rectangle: p.rectangle,
      ...(p.rectangles ? { rectangles: p.rectangles } : {}),
    };
    for (const v of [
      ...Object.values(p.contextVariants ?? {}),
      ...Object.values(p.innerVariants ?? {}),
    ])
      rules[String(mapped(v.modifiedGlyph.id, ids))] = {
        sourceGlyphId: p.id,
        rectangle: v.rectangle,
      };
  }
  let matched = 0,
    outerReplacements = 0,
    innerReplacements = 0,
    clearedRectangles = 0;
  for (const original of before) {
    if (original.type !== "compound" || !是包围结构(original.operator))
      continue;
    const first = original.references[0],
      second = original.references[1];
    const p = first && profiles.get(first.id);
    if (!p || !second) continue;
    matched++;
    const variant =
      p.innerVariants?.[String(second.id)] ??
      p.contextVariants?.[original.operator];
    const outerId = mapped(
      variant?.modifiedGlyph.id ?? p.modifiedGlyph?.id ?? p.id,
      ids,
    );
    const innerId = mapped(
      p.innerGlyphOverrides?.[String(second.id)] ?? second.id,
      ids,
    );
    const after = structuredClone(original);
    after.references[0] = { ...first, id: outerId };
    const inner = { ...second, id: innerId };
    if (
      [inner.xbegin, inner.ybegin, inner.xend, inner.yend].some(
        (v) => v !== undefined,
      )
    )
      clearedRectangles++;
    delete inner.xbegin;
    delete inner.ybegin;
    delete inner.xend;
    delete inner.yend;
    after.references[1] = inner;
    if (outerId !== first.id) outerReplacements++;
    if (innerId !== second.id) innerReplacements++;
    if (canonical(original) !== canonical(after))
      updates.push({ before: original, after, profileId: p.id });
  }
  const layoutTable = {
    schemaVersion: 1,
    unicodeVersion: "18.0.0",
    decisionsSha256: a.decisionsSha256,
    rules,
  };
  return {
    summary: {
      newGlyphs: newGlyphs.length,
      rectangleRules: Object.keys(rules).length,
      matched,
      updatedGlyphs: updates.length,
      outerReplacements,
      innerReplacements,
      clearedRectangles,
    },
    newGlyphs,
    updates,
    layoutTable,
  };
}
function assertSources(a: Artifact, before: 基本字形数据[]) {
  const originals = read<基本字形数据[]>(
    join(root, "packages/hanzi-chai/src/data/glyphs.json"),
  );
  const local = new Map(originals.map((g) => [g.id, g])),
    live = new Map(before.map((g) => [g.id, g]));
  const defs = definitions(a),
    visited = new Set<number>();
  const walk = (id: number) => {
    if (visited.has(id)) return;
    visited.add(id);
    const glyph = id < 0 ? defs.get(id) : local.get(id);
    if (!glyph) throw Error(`缺失源字形 ${id}`);
    if (id > 0 && canonical(glyph) !== canonical(live.get(id)))
      throw Error(`远程源字形 ${id} 与标注快照不一致`);
    if (glyph.type === "compound") for (const r of glyph.references) walk(r.id);
  };
  for (const p of a.profiles) {
    walk(p.id);
    for (const id of Object.keys(p.innerGlyphOverrides ?? {})) walk(Number(id));
  }
  for (const id of defs.keys()) walk(id);
}
interface Journal {
  decisionsSha256: string;
  ids: Record<string, number>;
  status: "prepared" | "creating" | "updating" | "complete";
  pending?: { temporaryId: number; payload: 基本字形数据 };
  completedBatches: number;
}
async function apply(a: Artifact, before: 基本字形数据[]) {
  const verification = read<{ status: string; decisionsSha256: string }>(
    join(migrationDir, "render-verification.json"),
  );
  if (
    verification.status !== "passed" ||
    verification.decisionsSha256 !== a.decisionsSha256
  )
    throw Error("尚未验证此版本的迁移渲染");
  const client = createClient(() => process.env.JWT ?? null);
  const journalPath = join(migrationDir, "journal.json");
  const journal = read<Journal>(journalPath);
  if (journal.decisionsSha256 !== a.decisionsSha256)
    throw Error("判断版本与迁移记录不一致");
  const fetchAll = async () => {
    const live = await client.get<基本字形数据[]>("/glyphs");
    if (!Array.isArray(live)) throw Error(`读取失败：${live.msg}`);
    return live;
  };
  const defs = definitions(a);
  let current = await fetchAll();
  if (journal.status === "prepared" || journal.status === "creating")
    assertSources(a, current);
  let currentMap = new Map(current.map((g) => [g.id, g]));
  // 每次恢复执行都核对服务器返回的 ID，防止重复创建或引用错误记录。
  for (const [oldId, id] of Object.entries(journal.ids)) {
    const expected = remapGlyph(defs.get(Number(oldId))!, journal.ids);
    if (canonical(expected) !== canonical(currentMap.get(id)))
      throw Error(`新字形 ${id} 与创建记录不一致`);
  }
  if (journal.pending) {
    const { id: _, ...payload } = journal.pending.payload;
    const matches = current.filter((g) => {
      const { id: __, ...body } = g;
      return canonical(body) === canonical(payload);
    });
    if (matches.length !== 1)
      throw Error("上次创建结果不明确，已保留 pending 记录，不能盲目重复 POST");
    journal.ids[String(journal.pending.temporaryId)] = matches[0]!.id;
    delete journal.pending;
    save(journalPath, journal);
  }
  journal.status = "creating";
  save(journalPath, journal);
  const creating = new Set<number>();
  const create = async (id: number): Promise<number> => {
    if (id > 0) return id;
    if (journal.ids[String(id)]) return journal.ids[String(id)]!;
    if (creating.has(id)) throw Error(`新字形引用循环 ${id}`);
    creating.add(id);
    const g = defs.get(id)!;
    if (!g) throw Error(`未知临时 ID ${id}`);
    if (g.type === "compound")
      for (const ref of g.references) await create(ref.id);
    const payload = remapGlyph(g, journal.ids);
    payload.id = 0;
    journal.pending = { temporaryId: id, payload };
    save(journalPath, journal);
    const result = await client.post<number>("/glyphs", payload);
    if (
      typeof result !== "number" ||
      !Number.isInteger(result) ||
      result <= 0 ||
      currentMap.has(result)
    )
      throw Error(`创建失败或 ID 冲突：${JSON.stringify(result)}`);
    journal.ids[String(id)] = result;
    delete journal.pending;
    save(journalPath, journal);
    currentMap.set(result, { ...payload, id: result });
    creating.delete(id);
    console.log(
      `创建 ${Object.keys(journal.ids).length}/${defs.size}：${id} → ${result}`,
    );
    return result;
  };
  for (const id of defs.keys()) await create(id);
  const plan = makePlan(a, before, journal.ids);
  if (
    plan.newGlyphs.some(
      (g) =>
        g.id <= 0 ||
        (g.type === "compound" && g.references.some((r) => r.id <= 0)),
    )
  )
    throw Error("还有未映射 ID");
  save(join(migrationDir, "resolved-plan.json"), plan);
  save(tablePath, plan.layoutTable);
  current = await fetchAll();
  currentMap = new Map(current.map((g) => [g.id, g]));
  for (const g of plan.newGlyphs)
    if (canonical(g) !== canonical(currentMap.get(g.id)))
      throw Error(`创建后回读不一致 ${g.id}`);
  const pending = plan.updates.filter((u) => {
    const value = canonical(currentMap.get(u.before.id));
    if (value === canonical(u.after)) return false;
    if (value !== canonical(u.before))
      throw Error(`待更新字形 ${u.before.id} 已被其他修改改变`);
    return true;
  });
  journal.status = "updating";
  save(journalPath, journal);
  for (let offset = 0; offset < pending.length; offset += 50) {
    const batch = pending.slice(offset, offset + 50).map((u) => u.after);
    const result = await client.put<true>("/glyphs/batch", batch);
    if (result !== true) throw Error(`批量更新失败：${JSON.stringify(result)}`);
    journal.completedBatches++;
    save(journalPath, journal);
    console.log(
      `替换引用 ${Math.min(offset + 50, pending.length)}/${pending.length}`,
    );
  }
  const final = await fetchAll(),
    finalMap = new Map(final.map((g) => [g.id, g]));
  for (const g of [...plan.newGlyphs, ...plan.updates.map((u) => u.after)])
    if (canonical(g) !== canonical(finalMap.get(g.id)))
      throw Error(`最终回读不一致 ${g.id}`);
  const chars = await client.get<字符数据[]>("/characters");
  if (!Array.isArray(chars)) throw Error("无法回读字符表");
  const beforeChars = read<字符数据[]>(
    join(migrationDir, "before-characters.json"),
  );
  const ordered = (c: 字符数据[]) =>
    [...c].sort((a, b) => a.unicode - b.unicode);
  if (canonical(ordered(chars)) !== canonical(ordered(beforeChars)))
    throw Error("字符表与迁移前不一致，检查是否有并发编辑");
  save(join(migrationDir, "after-glyphs.json"), final);
  save(join(migrationDir, "after-characters.json"), chars);
  journal.status = "complete";
  save(journalPath, journal);
  save(join(migrationDir, "result.json"), {
    status: "complete",
    decisionsSha256: a.decisionsSha256,
    ...plan.summary,
    idMap: journal.ids,
    charactersUnchanged: true,
    glyphCountBefore: before.length,
    glyphCountAfter: final.length,
  });
  console.log(JSON.stringify({ status: "complete", ...plan.summary }, null, 2));
}
if (import.meta.main) {
  mkdirSync(migrationDir, { recursive: true });
  const a = loadArtifact();
  const before = read<基本字形数据[]>(join(migrationDir, "before-glyphs.json"));
  if (process.argv[2] === "prepare") {
    const journalPath = join(migrationDir, "journal.json");
    if (
      existsSync(journalPath) &&
      read<Journal>(journalPath).status !== "prepared"
    )
      throw Error(
        "迁移已经开始，不能重新 prepare 覆盖真实 ID；请使用 apply 恢复或运行迁移核验",
      );
    assertSources(a, before);
    const plan = makePlan(a, before);
    save(join(migrationDir, "plan.json"), plan);
    save(tablePath, plan.layoutTable);
    if (!existsSync(join(migrationDir, "journal.json")))
      save(join(migrationDir, "journal.json"), {
        decisionsSha256: a.decisionsSha256,
        ids: {},
        status: "prepared",
        completedBatches: 0,
      } satisfies Journal);
    save(join(migrationDir, "inputs.json"), {
      decisionsSha256: a.decisionsSha256,
      beforeGlyphsSha256: createHash("sha256")
        .update(readFileSync(join(migrationDir, "before-glyphs.json")))
        .digest("hex"),
    });
    console.log(JSON.stringify(plan.summary, null, 2));
  } else if (process.argv[2] === "apply") await apply(a, before);
  else
    throw Error(
      "用法：bun scripts/glyph-review/upload-enclosures.ts prepare|apply",
    );
}
