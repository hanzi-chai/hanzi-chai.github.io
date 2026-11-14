/** 执行 2026-11-14 纵向结构审查决定；默认只预演，--write 才写本地字库。 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { 拓扑, 笔画图形 } from "../src/bezier.js";
import type { 基本字形数据, 矢量笔画数据 } from "../src/data.js";
import { 校验字库整数 } from "../src/data.js";
import { 字形库 } from "../src/repertoire.js";

const { values } = parseArgs({
  options: {
    "data-dir": { type: "string", default: "data" },
    out: {
      type: "string",
      default: "output/vertical-structure-decisions-preview",
    },
    write: { type: "boolean", default: false },
  },
});
const out = values.out!;
mkdirSync(out, { recursive: true });
const file = join(values["data-dir"]!, "glyphs.json");
const text = readFileSync(file, "utf8");
const glyphs: 基本字形数据[] = JSON.parse(text);
writeFileSync(join(out, "glyphs-before.json"), text);
const map = new Map(glyphs.map((g) => [g.id, g]));
const library = new 字形库(glyphs);
const strokes = (id: number) => library.获取字形(id)!.图形盒子.获取笔画列表();
const vertical = (g: 基本字形数据) =>
  g.type === "compound" && ["⿱", "⿳"].includes(g.operator);
const leaves = (id: number): number[] => {
  const g = map.get(id)!;
  return vertical(g) ? g.references!.flatMap((r) => leaves(r.id)) : [id];
};
const decisions = [
  { id: 0x32431, refs: [0x2bb, 0x175, 0x262], reason: "帚统一三层" },
  { id: 0x48656, refs: [0x36a, 0x478, 0x198], reason: "曼两顶部写法统一三层" },
  { id: 0x48657, refs: [0x371, 0x478, 0x198], reason: "曼两顶部写法统一三层" },
  { id: 0x20654, refs: [0x20e, 0x258, 0x3bd], reason: "袁统一三层" },
  {
    id: 0x01867,
    refs: [0, 0x258, 0xd31e],
    reason: "鬲 JKN 形统一一、口、下部，与豆及鬲 GHT 形一致",
  },
  {
    id: 0x28602,
    refs: [0x2b5, 0x301, 0x258],
    reason: "害统一三层，保留各来源中部差异",
  },
  {
    id: 0xd72c6,
    refs: [0x16e, 0xa20d, 0x3bd],
    reason: "袞与蔉内分部采用熵更低的共同表示",
  },
  {
    id: 0x92406,
    refs: [0x92205, 0x1a5],
    reason: "僊字边与䙴采用熵更低的共同表示",
  },
  {
    id: 0x5770e,
    refs: [0x57101, 0x24209],
    reason: "舜类分部采用熵更低的共同表示",
  },
  {
    id: 0x8cd83,
    refs: [0x215, 0xac50a],
    reason: "雚类分部采用熵更低的共同表示",
  },
];
function points(data: 矢量笔画数据[]): number[][] {
  const result: number[][] = [];
  for (const stroke of data) {
    let [x, y] = stroke.start;
    result.push([x, y]);
    for (const c of stroke.curveList) {
      const p = c.parameterList;
      if (c.command === "h") x += p[0]!;
      else if (c.command === "v") y += p[0];
      else if (c.command === "l") {
        x += p[0]!;
        y += p[1]!;
      } else if (c.command === "c" || c.command === "z") {
        result.push([x + p[0]!, y + p[1]!], [x + p[2]!, y + p[3]!]);
        x += p[4]!;
        y += p[5]!;
      }
      result.push([x, y]);
    }
  }
  return result;
}
function fit(source: number[], target: number[]) {
  if (source.length !== target.length) throw new Error("控制点数量变化");
  let best = {
    begin: 0,
    end: 100,
    max_error: Infinity,
    squared_error: Infinity,
  };
  for (let length = 1; length <= 500; length++) {
    const offsets = target
      .map((q, k) => q - Math.round((source[k]! * length) / 100))
      .sort((a, b) => a - b);
    const middle = offsets[Math.floor(offsets.length / 2)]!;
    for (let begin = middle - 2; begin <= middle + 2; begin++) {
      const errors = source.map((p, k) =>
        Math.abs(Math.round((p * length) / 100) + begin - target[k]!),
      );
      const max_error = Math.max(...errors),
        squared_error = errors.reduce((a, e) => a + e * e, 0);
      if (
        max_error < best.max_error ||
        (max_error === best.max_error && squared_error < best.squared_error) ||
        (max_error === best.max_error &&
          squared_error === best.squared_error &&
          Math.abs(length - 100) < Math.abs(best.end - best.begin - 100))
      )
        best = { begin, end: begin + length, max_error, squared_error };
    }
  }
  return best;
}
// 在同样不超过 1 单位误差的整数布局中，选择保全所有间接宿主接点的一组。
const preservedLayouts = new Map([
  [0x92406, { index: 0, ybegin: -1, yend: 74 }],
  [0xd72c6, { index: 1, ybegin: 9, yend: 65 }],
  [0x28602, { index: 1, ybegin: 23, yend: 75 }],
  [0x20654, { index: 2, xbegin: -1, xend: 100, ybegin: 64, yend: 102 }],
]);
const changes = decisions
  .filter((d) => {
    const g = map.get(d.id)!;
    return (
      g.operator !== (d.refs.length === 3 ? "⿳" : "⿱") ||
      JSON.stringify(g.references?.map((r) => r.id)) !== JSON.stringify(d.refs)
    );
  })
  .map((decision) => {
    const before = map.get(decision.id)!;
    if (before.type !== "compound") throw new Error("目标已不是复合体");
    if (
      JSON.stringify(leaves(before.id)) !==
      JSON.stringify(decision.refs.flatMap(leaves))
    )
      throw new Error("末级序列改变");
    if (before.strokes?.length) throw new Error("需单独迁移交错笔顺");
    const target = strokes(before.id);
    let offset = 0;
    const fits: unknown[] = [];
    const references = decision.refs.map((id) => {
      const source = strokes(id);
      const expected = target.slice(offset, offset + source.length);
      offset += source.length;
      if (
        JSON.stringify(
          source.map((s) => [s.feature, s.curveList.map((c) => c.command)]),
        ) !==
        JSON.stringify(
          expected.map((s) => [s.feature, s.curveList.map((c) => c.command)]),
        )
      )
        throw new Error("笔形或命令序列不匹配");
      const a = points(source),
        b = points(expected);
      const x = fit(
          a.map((p) => p[0]!),
          b.map((p) => p[0]!),
        ),
        y = fit(
          a.map((p) => p[1]!),
          b.map((p) => p[1]!),
        );
      const reference = {
        id,
        xbegin: x.begin,
        xend: x.end,
        ybegin: y.begin,
        yend: y.end,
      };
      const adjustment = preservedLayouts.get(decision.id);
      if (adjustment?.index === fits.length) {
        const { index: _, ...layout } = adjustment;
        Object.assign(reference, layout);
      }
      for (const [axis, begin, end, fitResult] of [
        [0, reference.xbegin, reference.xend, x],
        [1, reference.ybegin, reference.yend, y],
      ] as const) {
        const errors = a.map((p, k) =>
          Math.abs(
            Math.round((p[axis]! * (end - begin)) / 100) + begin - b[k]![axis]!,
          ),
        );
        Object.assign(fitResult, {
          begin,
          end,
          max_error: Math.max(...errors),
          squared_error: errors.reduce((s, e) => s + e * e, 0),
        });
      }
      fits.push({ id, x, y });
      return reference;
    });
    if (offset !== target.length) throw new Error("笔数变化");
    const after: 基本字形数据 = {
      ...before,
      operator: references.length === 3 ? "⿳" : "⿱",
      references,
    };
    const error = 校验字库整数(after);
    if (error) throw new Error(error);
    return { before, after, reason: decision.reason, fits };
  });
const overrides = new Map(changes.map((c) => [c.after.id, c.after]));
const updated = glyphs.map((g) => overrides.get(g.id) ?? g);
const afterLibrary = new 字形库(updated);
const affected = new Set(overrides.keys());
let previous = -1;
while (previous !== affected.size) {
  previous = affected.size;
  for (const g of glyphs)
    if (g.references?.some((r) => affected.has(r.id))) affected.add(g.id);
}
const geometryChanges: {
  id: number;
  max_coordinate_error: number;
  changed_strokes: number;
}[] = [];
for (const id of affected) {
  const before = strokes(id),
    after = afterLibrary.获取字形(id)!.图形盒子.获取笔画列表();
  if (
    before.length !== after.length ||
    before.some((s, k) => s.feature !== after[k]!.feature)
  )
    throw new Error("笔数或笔形变化");
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    const a = points(before),
      b = points(after);
    geometryChanges.push({
      id,
      max_coordinate_error: Math.max(
        ...a.flatMap((p, k) => p.map((v, j) => Math.abs(v - b[k]![j]!))),
      ),
      changed_strokes: before.filter(
        (s, k) => JSON.stringify(s) !== JSON.stringify(after[k]),
      ).length,
    });
  }
}
const topologyChanges: number[] = [];
for (const { id } of geometryChanges) {
  const before = new 拓扑(strokes(id).map((s) => new 笔画图形(s))).新关系矩阵;
  const after = new 拓扑(
    afterLibrary
      .获取字形(id)!
      .图形盒子.获取笔画列表()
      .map((s) => new 笔画图形(s)),
  ).新关系矩阵;
  if (JSON.stringify(before) !== JSON.stringify(after))
    topologyChanges.push(id);
}
writeFileSync(
  join(out, "topology-changes.json"),
  JSON.stringify(topologyChanges),
);
writeFileSync(join(out, "plan.json"), JSON.stringify(changes, null, 2));
writeFileSync(join(out, "glyphs-candidate.json"), JSON.stringify(updated));
writeFileSync(
  join(out, "geometry-changes.json"),
  JSON.stringify(geometryChanges, null, 2),
);
writeFileSync(join(out, "affected.json"), JSON.stringify([...affected]));
writeFileSync(
  join(out, "input-hash.txt"),
  createHash("sha256").update(text).digest("hex"),
);
if (values.write) {
  if (geometryChanges.some((c) => c.max_coordinate_error > 1))
    throw new Error("坐标误差超过 1，未写入");
  if (topologyChanges.length)
    throw new Error("接离或相交关系变化，未写入；详见 topology-changes.json");
  if (readFileSync(file, "utf8") !== text)
    throw new Error("预演期间字库有其他更新");
  writeFileSync(file, JSON.stringify(updated));
}
console.log(
  JSON.stringify(
    {
      changes: changes.map((c) => ({
        id: c.before.id,
        reason: c.reason,
        fits: c.fits,
      })),
      affected: affected.size,
      geometry_changes: geometryChanges.length,
      topology_changes: topologyChanges.length,
      written: values.write,
    },
    null,
    2,
  ),
);
