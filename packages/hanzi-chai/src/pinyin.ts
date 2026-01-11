import type { AssembleConfig } from "./assembly.js";
import type { Rule } from "./config.js";
import type { 字库 } from "./repertoire.js";
import type { Dictionary } from "./utils.js";

const r = String.raw;

export const defaultAlgebra: Record<string, Rule[]> = {
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

export type 拼写运算结果 = Map<string, Map<string, string>>;

interface 一字词分析 {
  词: string;
  拼音: string;
  拼写运算: Map<string, string>;
}

interface 多字词分析 {
  词: string;
  拼音: string[];
  拼写运算: Map<string, string>[];
}

export interface 拼音分析结果 {
  一字词: 一字词分析[];
  多字词: 多字词分析[];
}

export interface 拼音分析器 {
  分析(
    字库: 字库,
    一字词列表: string[],
    多字词列表: Dictionary,
    频率: Map<string, number>,
  ): 拼音分析结果;
}

export class 默认拼音分析器 implements 拼音分析器 {
  static readonly type = "默认";
  private 拼写运算: Map<string, Rule[]>;

  constructor(config: AssembleConfig) {
    const 拼写运算 = new Map<string, Rule[]>();
    for (const value of Object.values(config.encoder.sources)) {
      const object = value.object;
      if (object && object.type === "字音") {
        拼写运算.set(object.subtype, config.algebra[object.subtype] || []);
      }
    }
    this.拼写运算 = 拼写运算;
  }

  分析(字库: 字库, 一字词列表: string[], 多字词列表: Dictionary) {
    const 音节表 = new Set<string>("");
    for (const char of 一字词列表) {
      const readings = 字库.getReadings(char);
      readings?.map((x) => 音节表.add(x.pinyin));
    }
    for (const [, pinyin] of 多字词列表) {
      for (const syllable of pinyin.split(" ")) {
        音节表.add(syllable);
      }
    }

    const 运算结果: 拼写运算结果 = new Map();
    for (const 音节 of 音节表) {
      const 新结果: Map<string, string> = new Map();
      for (const [名称, 规则] of this.拼写运算.entries()) {
        const 变换后 = 默认拼音分析器.applyRules(名称, 规则, 音节);
        新结果.set(名称, 变换后);
      }
      运算结果.set(音节, 新结果);
    }

    const 一字词: 一字词分析[] = [];
    for (const char of 一字词列表) {
      const readings = 字库.getReadings(char) ?? [];
      if (readings.length === 0) {
        readings.push({ pinyin: "", importance: 100 });
      }
      for (const { pinyin } of readings) {
        const 拼写运算 = 运算结果.get(pinyin)!;
        一字词.push({ 词: char, 拼音: pinyin, 拼写运算 });
      }
    }

    const 多字词: 多字词分析[] = [];
    for (const [word, pinyin] of 多字词列表) {
      const syllables = pinyin.split(" ");
      const 拼写运算: Map<string, string>[] = [];
      for (const syllable of syllables) {
        const result = 运算结果.get(syllable)!;
        拼写运算.push(result);
      }
      多字词.push({ 词: word, 拼音: syllables, 拼写运算 });
    }

    return { 一字词, 多字词 };
  }

  static applyRules(name: string, rules: Rule[], syllable: string) {
    let result = syllable;
    for (const { type, from, to } of rules) {
      switch (type) {
        case "xform":
          result = result.replace(new RegExp(from), to);
          break;
        case "xlit":
          result = result.replace(new RegExp(`[${from}]`), (s) => {
            const index = from.indexOf(s);
            return to[index] || "";
          });
          break;
      }
    }
    return `${name}-${result}`;
  }
}
