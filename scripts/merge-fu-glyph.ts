/** 将匐字心合并到畐；默认预演，--write 才应用到本地数据。 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { 拓扑, 笔画图形 } from "../src/bezier.js";
import { type 基本字形数据, type 字符数据, 校验字库整数 } from "../src/data.js";
import { 字形库 } from "../src/repertoire.js";

const { values } = parseArgs({
  options: {
    "data-dir": { type: "string", default: "data" },
    out: { type: "string", default: "output/fu-glyph-merge-preview" },
    write: { type: "boolean", default: false },
  },
});
const out = values.out!;
mkdirSync(out, { recursive: true });
const file = join(values["data-dir"]!, "glyphs.json");
const text = readFileSync(file, "utf8");
const glyphs: 基本字形数据[] = JSON.parse(text);
const characters: 字符数据[] = JSON.parse(
  readFileSync(join(values["data-dir"]!, "characters.json"), "utf8"),
);
const target = 0x66304;
const removedIds = new Set([0x66305, 0x01225]);
const map = new Map(glyphs.map((g) => [g.id, g]));
if (!map.has(target) || [...removedIds].some((id) => !map.has(id)))
  throw new Error("待合并字形已变化");
if (characters.some((c) => c.glyphs.some((g) => removedIds.has(g.id))))
  throw new Error("待删除字形仍有字符直接映射");
const changes: { before: 基本字形数据; after: 基本字形数据 }[] = [];
const candidate = glyphs
  .filter((g) => !removedIds.has(g.id))
  .map((g): 基本字形数据 => {
    if (g.type !== "compound" || !g.references.some((r) => r.id === 0x66305))
      return g;
    const after = {
      ...g,
      references: g.references.map((r) =>
        r.id === 0x66305
          ? { ...r, id: target, xbegin: 15, xend: 70, ybegin: 40, yend: 88 }
          : r,
      ),
    };
    changes.push({ before: g, after });
    return after;
  });
const ids = new Set(candidate.map((g) => g.id));
for (const g of candidate)
  for (const r of g.references ?? [])
    if (!ids.has(r.id)) throw new Error(`悬空引用 ${g.id} -> ${r.id}`);
const error = 校验字库整数(candidate);
if (error) throw new Error(error);
const before = new 字形库(glyphs),
  after = new 字形库(candidate);
const affected = new Set(removedIds);
let previous = -1;
while (previous !== affected.size) {
  previous = affected.size;
  for (const g of glyphs)
    if (g.references?.some((r) => affected.has(r.id))) affected.add(g.id);
}
function rootOffset(id: number): number | undefined {
  if (id === 0x14808) return 0;
  const g = map.get(id)!;
  if (g.type !== "compound") return;
  let offset = 0;
  for (const r of g.references) {
    const found = rootOffset(r.id);
    if (found !== undefined) {
      if (g.strokes?.length) throw new Error("需单独核对宿主交错笔顺");
      return offset + found;
    }
    offset += before.获取字形(r.id)!.图形盒子.获取笔画列表().length;
  }
}
const verification = [...affected]
  .filter((id) => !removedIds.has(id))
  .map((id) => {
    const b = before.获取字形(id)!.图形盒子.获取笔画列表(),
      a = after.获取字形(id)!.图形盒子.获取笔画列表();
    if (
      JSON.stringify(b.map((s) => s.feature)) !==
      JSON.stringify(a.map((s) => s.feature))
    )
      throw new Error(`笔数、笔形或笔顺改变 ${id}`);
    const bt = new 拓扑(b.map((s) => new 笔画图形(s))).新关系矩阵,
      at = new 拓扑(a.map((s) => new 笔画图形(s))).新关系矩阵;
    const pairs: {
      i: number;
      j: number;
      before: unknown;
      after: unknown;
      allowed: boolean;
    }[] = [];
    const offset = rootOffset(id);
    for (let i = 0; i < b.length; i++)
      for (let j = 0; j < i; j++)
        if (JSON.stringify(bt[i]![j]) !== JSON.stringify(at[i]![j]))
          pairs.push({
            i,
            j,
            before: bt[i]![j],
            after: at[i]![j],
            allowed:
              offset !== undefined &&
              j === offset &&
              [offset + 3, offset + 4].includes(i) &&
              bt[i]![j]?.type === "连" &&
              at[i]![j] === undefined,
          });
    return {
      id,
      geometry_identical: JSON.stringify(b) === JSON.stringify(a),
      topology_changes: pairs,
    };
  });
writeFileSync(join(out, "glyphs-before.json"), text);
writeFileSync(join(out, "glyphs-candidate.json"), JSON.stringify(candidate));
writeFileSync(
  join(out, "plan.json"),
  JSON.stringify(
    {
      target,
      changes,
      removed: [...removedIds].map((id) => map.get(id)),
      verification,
      affected: [...affected],
    },
    null,
    2,
  ),
);
if (values.write) {
  if (verification.some((v) => v.topology_changes.some((p) => !p.allowed)))
    throw new Error("出现预期两处接口分离以外的交连变化，未写入");
  if (readFileSync(file, "utf8") !== text)
    throw new Error("预演期间字库更新，未写入");
  writeFileSync(file, JSON.stringify(candidate));
}
console.log(
  JSON.stringify(
    {
      changes: changes.length,
      removed: [...removedIds],
      verification,
      written: values.write,
    },
    null,
    2,
  ),
);
