/** 修复已核实的操作数错误；默认仅生成计划，--write 才修改本地字库。 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import {
  type 基本字形数据,
  字形库,
  校验字库整数,
  格式化字形ID,
} from "../src/index.js";

const { values } = parseArgs({
  options: {
    "data-dir": { type: "string", default: "data" },
    out: { type: "string", default: "output/glyph-arity-repair" },
    write: { type: "boolean", default: false },
  },
});
const 文件 = path.join(values["data-dir"]!, "glyphs.json");
const 原文 = readFileSync(文件, "utf8");
const 原始: 基本字形数据[] = JSON.parse(原文);
const 修复前 = new 字形库(原始);
const 变更: { before: 基本字形数据; after: 基本字形数据 }[] = [];
const 修复后数据 = 原始.map((字形): 基本字形数据 => {
  if (字形.type !== "compound") return 字形;
  const 数量 = 字形.references.length;
  const 预期 = 字形.operator === "⿲" || 字形.operator === "⿳" ? 3 : 2;
  if (数量 === 预期) return 字形;
  let after: 基本字形数据;
  // 噩的框架和四口跨行交错，不保留五操作数叠加。
  if (字形.id === 0x1ec08 && 字形.operator === "⿻" && 数量 === 5) {
    after = {
      id: 字形.id,
      ...(字形.name === undefined ? {} : { name: 字形.name }),
      type: "component",
      operator: undefined,
      references: undefined,
      strokes: 修复前.获取字形(字形.id)!.图形盒子.获取笔画列表(),
    };
  } else if (["⿱", "⿳"].includes(字形.operator) && [2, 3].includes(数量)) {
    after = { ...字形, operator: 数量 === 3 ? "⿳" : "⿱" };
  } else if (["⿰", "⿲"].includes(字形.operator) && [2, 3].includes(数量)) {
    after = { ...字形, operator: 数量 === 3 ? "⿲" : "⿰" };
  } else {
    throw new Error(`未审核的结构错误：${格式化字形ID(字形.id)}`);
  }
  const 错误 = 校验字库整数(after);
  if (错误) throw new Error(错误);
  变更.push({ before: 字形, after });
  return after;
});

// 连同所有间接宿主验证；不以局部字形一致替代引用树核验。
const 受影响 = new Set(变更.map(({ before }) => before.id));
let 上轮数量 = -1;
while (上轮数量 !== 受影响.size) {
  上轮数量 = 受影响.size;
  for (const 字形 of 原始) {
    if (字形.references?.some(({ id }) => 受影响.has(id))) 受影响.add(字形.id);
  }
}
const 修复后 = new 字形库(修复后数据);
for (const id of 受影响) {
  const 前 = 修复前.获取字形(id)!.图形盒子.获取笔画列表();
  const 后 = 修复后.获取字形(id)!.图形盒子.获取笔画列表();
  if (JSON.stringify(前) !== JSON.stringify(后))
    throw new Error(`修复改变了几何或笔顺：${格式化字形ID(id)}`);
}
mkdirSync(values.out!, { recursive: true });
writeFileSync(path.join(values.out!, "before.json"), 原文);
writeFileSync(
  path.join(values.out!, "plan.json"),
  JSON.stringify(变更, null, 2),
);
writeFileSync(
  path.join(values.out!, "affected.json"),
  JSON.stringify([...受影响]),
);
if (values.write) writeFileSync(文件, JSON.stringify(修复后数据));
console.log(
  `修复 ${变更.length} 个字形，验证 ${受影响.size} 个字形及宿主的笔画完全一致${values.write ? "，已写入本地字库" : "，未写入字库"}。`,
);
