import type { 拼写运算, 运算规则 } from "./config.js";
import type { 拼音元素 } from "./element.js";
import { 获取注册表 } from "./registry.js";
import type { 字符 } from "./unicode.js";
import {
  default_err,
  ok,
  type Result,
  type 词典,
  type 词典条目,
} from "./utils.js";

const r = String.raw;

const 拼写运算查找表: Record<string, 拼写运算> = {
  声母: [
    { type: "xform", from: "^([bpmfdtnlgkhjqxzcsr]h?|^).+$", to: "$1" },
    { type: "xform", from: "^$", to: "0" },
  ],
  韵母: [
    // 恢复 v
    { type: "xform", from: "^([jqxy])u", to: "$1v" },
    // 恢复合、齐、撮口的韵母形式
    { type: "xform", from: "yv", to: "v" },
    { type: "xform", from: "yi?", to: "i" },
    { type: "xform", from: "wu?", to: "u" },
    // 恢复 iou, uei, uen
    { type: "xform", from: "iu", to: "iou" },
    { type: "xform", from: "u([in])", to: "ue$1" },
    { type: "xform", from: r`^.*?([aeêiouv].*|m|ng?)\d$`, to: "$1" },
  ],
  双拼声母: [
    { type: "xform", from: "^([bpmfdtnlgkhjqxzcsryw]h?|^).+$", to: "$1" },
    { type: "xform", from: "^$", to: "0" },
  ],
  双拼韵母: [{ type: "xform", from: r`^.*?([aeêiouv].*|m|ng?)\d$`, to: "$1" }],
  声调: [{ type: "xform", from: r`.+(\d)`, to: "$1" }],
  首字母: [{ type: "xform", from: r`^(.).+`, to: "$1" }],
  末字母: [{ type: "xform", from: r`.*(.)\d`, to: "$1" }],
};

function 合并拼写运算(自定义?: Record<string, 拼写运算>) {
  const 查找表 = new Map<string, 拼写运算>();
  const 合并 = { ...拼写运算查找表, ...(自定义 ?? {}) };
  for (const [名称, 规则列表] of Object.entries(合并)) {
    查找表.set(名称, 规则列表);
  }
  return 查找表;
}

type 拼音元素映射 = Map<string, 拼音元素>;

interface 拼音分析器 {
  分析(词: 字符[], 拼音: string[]): Result<拼音元素映射[], Error>;
}

export function 应用拼写运算(规则列表: 运算规则[], 音节: string) {
  let 结果 = 音节;
  for (const { type, from, to } of 规则列表) {
    switch (type) {
      case "xform":
        结果 = 结果.replace(new RegExp(from, "u"), to);
        break;
      case "xlit":
        结果 = 结果.replace(new RegExp(`[${from}]`, "u"), (s) => {
          const index = from.indexOf(s);
          return to[index] || "";
        });
        break;
    }
  }
  return 结果;
}

class 默认拼音分析器 implements 拼音分析器 {
  static readonly type = "默认";
  constructor(private 拼音分析映射: 拼音分析映射) {}

  分析(_词: 字符[], 拼音: string[]) {
    const 元素映射列表: 拼音元素映射[] = [];
    for (const 音节 of 拼音) {
      const 音节结果 = this.拼音分析映射.get(音节);
      if (!音节结果) return default_err(`未知音节：${音节}`);
      元素映射列表.push(音节结果);
    }
    return ok(元素映射列表);
  }
}

interface 拼音分析 extends 词典条目 {
  元素映射: 拼音元素映射[];
}

type 拼音分析结果 = 拼音分析[];

type 拼音分析映射 = Map<string, Map<string, 拼音元素>>;

function 分析拼音(音节表: 拼音分析映射, 词典: 词典) {
  const 注册表 = 获取注册表();
  const 拼音分析器 = 注册表.创建拼音分析器("默认", 音节表)!;
  const 拼音分析结果: 拼音分析[] = [];
  for (const { 词, 拼音, 频率 } of 词典) {
    const 元素映射 = 拼音分析器.分析(词, 拼音);
    if (!元素映射.ok) continue;
    拼音分析结果.push({ 词, 拼音, 频率, 元素映射: 元素映射.value });
  }

  return 拼音分析结果;
}

export type { 拼音分析, 拼音分析器, 拼音分析映射, 拼音分析结果 };
export { 分析拼音, 合并拼写运算, 拼写运算查找表, 默认拼音分析器 };
