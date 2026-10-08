/**
 * 诊断14：预置归并动作化（2026-10-08 重构）验证
 * 新语义（用户口径）：
 *  - 纯归并 A=B：A、B 同进同出——加 B 的同一轮内 A 随行（已有的 A 转为跟随 B），减 B 时 A 级联消失；
 *  - 码位归并 A 1=B 2：借码目标已成根才可归，暂时没成就等下一轮；新根入库时目标已根则直接带借码安排；
 *  - 不再是初始改写；开头筛死：参与者不在（字根∪候选池）的条目永远无法应用，备注一句话说明。
 * 用法: bun 诊断丷14.ts
 */
import { readFileSync } from "fs";
import { inflateSync } from "node:zlib";
import { load as yamlLoad } from "js-yaml";
import { 智能选根核心 } from "./src/lib/智能选根核心";

let 失败 = 0;
const 断言 = (名: string, ok: boolean, 细 = "") => {
  console.log(`${ok ? "✅" : "❌"} ${名}${细 ? " —— " + 细 : ""}`);
  if (!ok) 失败++;
};

const 配置0: any = yamlLoad(readFileSync("D:/chai魔改/方案/选根/基线-尺素4仅笔画.yaml", "utf8"));
const 原始词典: { 词: string; 拼音: string[]; 频率: number }[] = [];
for (const line of readFileSync("D:/chai魔改/方案/自定义词典.txt", "utf8").split("\n")) {
  const p = line.replace(/\r$/, "").split("\t");
  if (p.length < 3 || !p[0]) continue;
  原始词典.push({ 词: p[0], 拼音: p[1] ? p[1].split(" ") : [], 频率: Number(p[2]) });
}
const 内置字库数据 = JSON.parse(
  inflateSync(readFileSync("packages/hanzi-chai/src/data/repertoire.json.deflate")).toString("utf-8"),
);
const 基线m = { ...(配置0.form.mapping ?? {}) } as Record<string, any>;
const 直根 = Object.keys(基线m).filter((k) => typeof 基线m[k] === "string");
const 根A = 直根[0]!;  // "1" "mc"
const 根B = 直根[1]!;  // "2" "qv"
const 新1 = "㑇";      // 基线外有字形
const 新2 = "㑊";
console.log(`根A=${JSON.stringify(根A)} 根B=${JSON.stringify(根B)}；池外新字 ${新1}/${新2}（基线外 ✓）`);

const 跑 = (预置: any[], 额外: any = {}, 奖励?: (m: any) => number) => {
  const 核心 = new 智能选根核心(配置0, 原始词典, 内置字库数据) as any;
  if (奖励) {
    const 原评 = 核心.评变体.bind(核心);
    核心.评变体 = (m: any) => {
      const r = 原评(m);
      if (r.失败) return r;
      const 减 = 奖励(m);
      return 减 ? { ...r, 总分: r.总分 - 减 } : r;
    };
  }
  return 核心.搜索({ ...基线m }, {
    轮数: 额外.轮数 ?? 2, 允许加根: 额外.允许加根 ?? false, 允许减根: false,
    表列表: [], 字根表列表: 额外.字根表列表, 预置归并: 预置,
  }, 额外.cb ?? {}) as any;
};

// ① 筛死：目标不在字根池 → 备注一句话，mapping 原样（无初始改写）
const r1 = 跑([{ 根: 根A, 目标: "绝非字根X", 根位: 1, 目标位: 2 }]);
断言("① 目标不在池：备注说明原因", !!r1.备注 && r1.备注.includes("预置归并用不了") && r1.备注.includes("不在字根池"), r1.备注 ?? "（无备注）");
断言("① 目标不在池：根 A 安排原样", r1.mapping[根A] === 基线m[根A], JSON.stringify(r1.mapping[根A]));

// ② 筛死：自引用
const r2 = 跑([{ 根: 根A, 目标: 根A, 根位: 1, 目标位: 2 }]);
断言("② 自引用：备注说明原因", !!r2.备注 && r2.备注.includes("根和目标是同一个字"), r2.备注 ?? "（无备注）");

// ②b 筛死：整体归并的根不在字根池（目标在也没用）
{
  const r = 跑([{ 根: "绝非字根Y", 目标: 根B }]);
  断言("②b 整体根不在池：备注说明原因", !!r.备注 && r.备注.includes("不在字根池") && r.备注.includes("绝非字根Y"), r.备注 ?? "（无备注）");
  断言("②b 整体根不在池：不产生待执行动作（无未采用轮）", r.轮日志.length === 0, r.轮日志.map((x: any) => x.动作).join("、") || "（空）");
}

// ③ 纯归并（双方都已是字根）：归并作为动作竞争获胜后 A 跟随 B；减 B 时 A 级联消失
{
  const r = 跑([{ 根: 根A, 目标: 根B }], {}, (m) =>
    m[根A] && typeof m[根A] === "object" && !Array.isArray(m[根A]) && m[根A].element === 根B ? 1e6 : 0);
  断言("③ 纯归并：A 跟随 B", r.mapping[根A] && typeof r.mapping[根A] === "object" && r.mapping[根A].element === 根B, JSON.stringify(r.mapping[根A]));
  断言("③ 纯归并：轨迹记录", r.轮日志.some((x: any) => x.动作.includes("归")), r.轮日志.map((x: any) => x.动作).join("、") || "（空）");
  const 原型 = 智能选根核心.prototype as any;
  const 删B后 = 原型.变体mapping.call(null, r.mapping, [], [根B], "aa");
  断言("③ 同减：删 B 时 A 级联消失", !(根B in 删B后) && !(根A in 删B后));
}

// ④ 码位（双方都已是字根）：第1码借 B 第2码、其余位保留原字符
{
  const r = 跑([{ 根: 根A, 目标: 根B, 根位: 1, 目标位: 2 }], {}, (m) =>
    Array.isArray(m[根A]) && JSON.stringify(m[根A][0]) === JSON.stringify({ element: 根B, index: 1 }) ? 1e6 : 0);
  const 安排 = r.mapping[根A];
  断言("④ 码位：借码正确、其余位逐位保留", Array.isArray(安排) && JSON.stringify(安排[0]) === JSON.stringify({ element: 根B, index: 1 }) && 安排[1] === [...(基线m[根A] as string)][1]!, JSON.stringify(安排));
}

// ⑤ 随行同轮（新根对）：A、B 都是池外新字，加 B 的同一轮内 A 以别名随行
{
  const r = 跑([{ 根: 新1, 目标: 新2 }], {
    允许加根: true,
    字根表列表: [{ 类型: "手动指定", 字根: [新1, 新2] }],
  }, (m) => {
    let 减 = 0;
    if (m[新2] !== undefined) 减 += 1e6;
    if (m[新1] && typeof m[新1] === "object" && !Array.isArray(m[新1]) && m[新1].element === 新2) 减 += 2e6;
    return 减;
  });
  断言("⑤ 随行同轮：目标 B 已入映射", r.mapping[新2] !== undefined, `${新2} → ${JSON.stringify(r.mapping[新2])}`);
  断言("⑤ 随行同轮：同一轮内 A 已归并入 B", r.mapping[新1] && typeof r.mapping[新1] === "object" && r.mapping[新1].element === 新2, `${新1} → ${JSON.stringify(r.mapping[新1])}，轨迹 ${r.轮日志.map((x: any) => x.动作).join("、") || "（空）"}`);
  断言("⑤ 随行同轮：轨迹一行完成（并A）", r.轮日志.length === 1 && r.轮日志[0]!.动作.includes("(并"), r.轮日志.map((x: any) => x.动作).join("、") || "（空）");
}

// ⑥ 随行同轮（已有根转换）：A 是现有字根、B 是池外新字——加 B 的同一轮内 A 转为跟随 B
{
  const r = 跑([{ 根: 根A, 目标: 新2 }], {
    允许加根: true,
    字根表列表: [{ 类型: "手动指定", 字根: [新2] }],
  }, (m) => {
    let 减 = 0;
    if (m[新2] !== undefined) 减 += 1e6;
    if (m[根A] && typeof m[根A] === "object" && !Array.isArray(m[根A]) && m[根A].element === 新2) 减 += 2e6;
    return 减;
  });
  断言("⑥ 随行同轮：B 已入映射", r.mapping[新2] !== undefined, `${新2} → ${JSON.stringify(r.mapping[新2])}`);
  断言("⑥ 随行同轮：同一轮内已有根 A 转为跟随 B", r.mapping[根A] && typeof r.mapping[根A] === "object" && r.mapping[根A].element === 新2, `${根A} → ${JSON.stringify(r.mapping[根A])}，轨迹 ${r.轮日志.map((x: any) => x.动作).join("、") || "（空）"}`);
}

// ⑦ 码位等下一轮：目标不在映射（在池）→ 第一轮只加目标，码位后续轮才归
{
  const r = 跑([{ 根: 根A, 目标: 新2, 根位: 1, 目标位: 1 }], {
    允许加根: true, 轮数: 3,
    字根表列表: [{ 类型: "手动指定", 字根: [新2] }],
  }, (m) => {
    let 减 = 0;
    if (m[新2] !== undefined) 减 += 1e6;
    if (Array.isArray(m[根A]) && JSON.stringify(m[根A][0]) === JSON.stringify({ element: 新2, index: 0 })) 减 += 2e6;
    return 减;
  });
  const 第一轮动作 = r.轮日志[0]?.动作 ?? "";
  断言("⑦ 码位等下轮：第一轮只加目标（无借码）", 第一轮动作 === `+${新2}`, `第一轮 ${第一轮动作}；轨迹 ${r.轮日志.map((x: any) => x.动作).join("、") || "（空）"}`);
  断言("⑦ 码位等下轮：后续轮完成借码", Array.isArray(r.mapping[根A]) && JSON.stringify(r.mapping[根A][0]) === JSON.stringify({ element: 新2, index: 0 }), `${根A} → ${JSON.stringify(r.mapping[根A])}`);
}

// ⑧ 码位随行：根是池外新字、目标已是字根 → 入库即带借码安排（一轮完成）
{
  const r = 跑([{ 根: 新1, 目标: 根B, 根位: 1, 目标位: 2 }], {
    允许加根: true, 轮数: 2,
    字根表列表: [{ 类型: "手动指定", 字根: [新1] }],
  }, (m) => {
    let 减 = 0;
    if (m[新1] !== undefined) 减 += 1e6;
    if (Array.isArray(m[新1]) && JSON.stringify(m[新1][0]) === JSON.stringify({ element: 根B, index: 1 })) 减 += 2e6;
    return 减;
  });
  const 安排 = r.mapping[新1];
  断言("⑧ 码位随行：新根入库即带借码安排", Array.isArray(安排) && JSON.stringify(安排[0]) === JSON.stringify({ element: 根B, index: 1 }), `${新1} → ${JSON.stringify(安排)}，轨迹 ${r.轮日志.map((x: any) => x.动作).join("、") || "（空）"}`);
  断言("⑧ 码位随行：一轮完成", r.轮日志.length === 1, r.轮日志.map((x: any) => x.动作).join("、") || "（空）");
}

console.log(失败 === 0 ? "\n全部通过" : `\n${失败} 项失败`);
process.exit(失败 === 0 ? 0 : 1);
