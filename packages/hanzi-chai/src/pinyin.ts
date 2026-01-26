import type { 拼写运算, 源节点配置, 编码配置, 运算规则 } from "./config.js";
import {
  获取注册表,
  ok,
  type Result,
  type 词典,
  type 词典条目,
} from "./main.js";

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

type 拼音元素映射 = Map<string, string>;

interface 拼音分析器 {
  分析(词: string, 拼音: string[]): Result<拼音元素映射[], Error>;
}

type 拼音分析配置 = Map<string, 拼写运算>;

class 默认拼音分析器 implements 拼音分析器 {
  static readonly type = "默认";
  private 音节表缓存: Map<string, 拼音元素映射> = new Map();
  constructor(private 拼写运算映射: Map<string, 拼写运算>) {}

  分析(_词: string, 拼音: string[]) {
    const 元素映射列表: 拼音元素映射[] = [];
    for (const 音节 of 拼音) {
      let 音节结果 = this.音节表缓存.get(音节);
      if (!音节结果) {
        音节结果 = new Map<string, string>();
        for (const [名称, 规则列表] of this.拼写运算映射.entries()) {
          const 变换后 = 默认拼音分析器.应用拼写运算(名称, 规则列表, 音节);
          音节结果.set(名称, 变换后);
        }
        this.音节表缓存.set(音节, 音节结果);
      }
      元素映射列表.push(音节结果);
    }
    return ok(元素映射列表);
  }

  static 应用拼写运算(名称: string, 规则列表: 运算规则[], 音节: string) {
    let 结果 = 音节;
    for (const { type, from, to } of 规则列表) {
      switch (type) {
        case "xform":
          结果 = 结果.replace(new RegExp(from), to);
          break;
        case "xlit":
          结果 = 结果.replace(new RegExp(`[${from}]`), (s) => {
            const index = from.indexOf(s);
            return to[index] || "";
          });
          break;
      }
    }
    return `${名称}-${结果}`;
  }
}

interface 拼音分析 extends 词典条目 {
  元素映射: 拼音元素映射[];
}

type 拼音分析结果 = 拼音分析[];

function 分析拼音(
  编码器: Record<string, 源节点配置>,
  拼写运算: Map<string, 拼写运算>,
  词典: 词典,
) {
  const 注册表 = 获取注册表();
  const 拼写运算查找表 = new Map<string, 拼写运算>();
  for (const value of Object.values(编码器)) {
    const object = value.object;
    if (object && object.type === "字音") {
      拼写运算查找表.set(object.subtype, 拼写运算.get(object.subtype) || []);
    }
  }
  const 拼音分析器 = 注册表.创建拼音分析器("默认", 拼写运算查找表)!;
  const 拼音分析结果: 拼音分析[] = [];
  for (const { 词, 拼音, 频率 } of 词典) {
    const 元素映射 = 拼音分析器.分析(词, 拼音);
    if (!元素映射.ok) continue;
    拼音分析结果.push({ 词, 拼音, 频率, 元素映射: 元素映射.value });
  }

  return 拼音分析结果;
}

export { 默认拼音分析器, 拼写运算查找表, 合并拼写运算, 分析拼音 };
export type { 拼音分析配置, 拼音分析器, 拼音分析, 拼音分析结果 };
