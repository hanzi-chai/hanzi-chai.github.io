/** 只读检查五位字形 ID 的容量，不改写数据或调用远程写接口。 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import type { 字形数据, 字符数据 } from "../src/data.js";
import {
  字形溢出表,
  是合法字形ID,
  格式化字形ID,
  溢出字形起点,
  生成字形起点,
} from "../src/glyph-id.js";
import { 字形归部检索 } from "../src/glyph-radical.js";
import { 创建部首反查表, 康熙部首表 } from "../src/kangxi-radicals.js";

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    "data-dir": { type: "string", default: "data" },
    out: { type: "string", default: "output/glyph-id-migration" },
  },
  strict: true,
});
const [字形文本, 字符文本] = await Promise.all([
  readFile(path.join(values["data-dir"]!, "glyphs.json"), "utf8"),
  readFile(path.join(values["data-dir"]!, "characters.json"), "utf8"),
]);
const 字形列表: 字形数据[] = JSON.parse(字形文本);
const 字符列表: 字符数据[] = JSON.parse(字符文本);
const 检索 = new 字形归部检索(字形列表);
const 字符反查 = new Map<number, string[]>();
for (const 字符 of 字符列表) {
  for (const { id } of 字符.glyphs) {
    const 名称 = 字符反查.get(id) ?? [];
    名称.push(String.fromCodePoint(字符.unicode));
    字符反查.set(id, 名称);
  }
}
const 字形ID集合 = new Set(字形列表.map((字形) => 字形.id));
const 不存在的部首ID = 康熙部首表.flatMap((部首) =>
  部首.glyph_ids.filter((id) => !字形ID集合.has(id)),
);
const 结果 = 字形列表.map((字形) => ({
  id: 字形.id,
  characters: 字符反查.get(字形.id) ?? [],
  stroke_sequence: 检索.获取笔顺(字形.id),
  ...(字形.type === "compound"
    ? 检索.归部(字形.id)
    : {
        radical_numbers: [0],
        radical_glyph_id: 字形.id,
        remaining_strokes: 检索.获取笔顺(字形.id).length,
        stroke_bucket: Math.min(16, 检索.获取笔顺(字形.id).length) - 1,
        fallback: false,
      }),
}));
const 歧义 = 结果.filter((字形) => 字形.radical_numbers.length !== 1);
const 无效余笔 = 结果.filter((字形) => 字形.stroke_bucket === undefined);
const 分组 = new Map<string, typeof 结果>();
for (const 字形 of 结果) {
  if (字形.radical_numbers.length !== 1 || 字形.stroke_bucket === undefined)
    continue;
  const 键 = `${字形.radical_numbers[0]}:${字形.stroke_bucket}`;
  const 组 = 分组.get(键) ?? [];
  组.push(字形);
  分组.set(键, 组);
}
const 溢出 = [...分组.values()]
  .filter((组) => 组.length > 256)
  .sort((a, b) => b.length - a.length)
  .map((组) => ({
    radical_number: 组[0]!.radical_numbers[0]!,
    radical_name:
      康熙部首表.find((部首) => 部首.number === 组[0]!.radical_numbers[0])
        ?.name ?? "部件",
    remaining_strokes: 组[0]!.stroke_bucket! + 1,
    count: 组.length,
    excess: 组.length - 256,
    // 五类笔画的字典序；同笔顺时以旧 ID 确定稳定顺序。
    glyphs: 组.sort(
      (a, b) =>
        (a.stroke_sequence < b.stroke_sequence
          ? -1
          : a.stroke_sequence > b.stroke_sequence
            ? 1
            : 0) || a.id - b.id,
    ),
  }));
const 编号错误 = 结果.filter((字形) => {
  if (!是合法字形ID(字形.id)) return true;
  if (字形.id >= 生成字形起点) return false;
  if (字形.id < 溢出字形起点)
    return (
      字形.id >>> 12 !== 字形.radical_numbers[0] ||
      ((字形.id >>> 8) & 15) !== 字形.stroke_bucket
    );
  const 信息 = 字形溢出表[格式化字形ID(字形.id)];
  return (
    !信息 ||
    信息.radical_number !== 字形.radical_numbers[0] ||
    信息.remaining_strokes !== 字形.remaining_strokes ||
    信息.stroke_sequence !== 字形.stroke_sequence
  );
});
const 摘要 = {
  glyphs: 字形列表.length,
  components: 字形列表.filter((字形) => 字形.type === "component").length,
  compounds: 字形列表.filter((字形) => 字形.type === "compound").length,
  radical_glyphs: 创建部首反查表().size,
  missing_radical_ids: 不存在的部首ID,
  ambiguous_compounds: 歧义.length,
  invalid_remaining_strokes: 无效余笔.length,
  overflow_groups: 溢出.length,
  excess_glyphs: 溢出.reduce((n, 组) => n + 组.excess, 0),
  allocated_overflows: 字形列表.filter(
    (字形) => 字形.id >= 溢出字形起点 && 字形.id < 生成字形起点,
  ).length,
  invalid_ids: 编号错误.length,
};
const 报告 = {
  input_sha256: {
    glyphs: createHash("sha256").update(字形文本).digest("hex"),
    characters: createHash("sha256").update(字符文本).digest("hex"),
    radicals: createHash("sha256")
      .update(JSON.stringify(康熙部首表))
      .digest("hex"),
  },
  summary: 摘要,
  ambiguous_radical_ids: [...创建部首反查表()]
    .filter(([, 编号]) => 编号.length > 1)
    .map(([id, radical_numbers]) => ({ id, radical_numbers })),
  ambiguous_compounds: 歧义,
  invalid_remaining_strokes: 无效余笔,
  overflow_groups: 溢出,
  invalid_ids: 编号错误,
};
await mkdir(values.out!, { recursive: true });
await writeFile(
  path.join(values.out!, "audit.json"),
  `${JSON.stringify(报告, null, 2)}\n`,
);
console.log(JSON.stringify(摘要, null, 2));
console.log(`报告：${path.join(values.out!, "audit.json")}`);
if (
  不存在的部首ID.length ||
  字形ID集合.size !== 字形列表.length ||
  歧义.length ||
  无效余笔.length ||
  编号错误.length
)
  process.exitCode = 1;
