import type { Config, Rule } from "./config";
import type { TotalResult } from "./encoder";

export interface Extra {
  rootSequence: Record<string, number[]>;
}

interface Base {
  type: string;
}

export const pronunciationElementTypes = [
  "声母",
  "双拼声母",
  "韵母",
  "双拼韵母",
  "声调",
  "首字母",
  "末字母",
] as const;

export type PronunciationElementTypes =
  (typeof pronunciationElementTypes)[number];

const shengdiao = ["阴平", "阳平", "上声", "去声", "轻声"];

const r = String.raw;

export const defaultAlgebra: Record<PronunciationElementTypes, Rule[]> = {
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
    { type: "xform", from: r`^.*?([aeiouv].*|m|ng?)\d$`, to: "$1" },
  ],
  双拼声母: [
    { type: "xform", from: "^([bpmfdtnlgkhjqxzcsryw]h?|^).+$", to: "$1" },
    { type: "xform", from: "^$", to: "0" },
  ],
  双拼韵母: [{ type: "xform", from: r`^.*?([aeiouv].*|m|ng?)\d$`, to: "$1" }],
  声调: [{ type: "xform", from: r`.+(\d)`, to: "$1" }],
  首字母: [{ type: "xform", from: r`^(.).+`, to: "$1" }],
  末字母: [{ type: "xform", from: r`.*(.)\d`, to: "$1" }],
};

export const applyRules = (name: string, rules: Rule[], syllable: string) => {
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
  return name + "-" + result;
};

interface This extends Base {
  type: "汉字";
}

interface Constant extends Base {
  type: "固定";
  key: string;
}

interface Structure extends Base {
  type: "结构";
}

interface Pronunciation extends Base {
  type: "字音";
  subtype: PronunciationElementTypes;
}

interface Root extends Base {
  type: "字根";
  rootIndex: number;
}

interface Stroke extends Base {
  type: "笔画";
  rootIndex: number;
  strokeIndex: number;
}

interface StrokePair extends Base {
  type: "二笔";
  rootIndex: number;
  strokeIndex: number;
}

export type CodableObject =
  | This
  | Constant
  | Structure
  | Pronunciation
  | Root
  | Stroke
  | StrokePair;

export const renderName = (object: CodableObject) => {
  switch (object.type) {
    case "汉字":
    case "结构":
      return object.type;
    case "固定":
      return object.key;
    case "字音":
      return object.subtype;
    case "字根":
      return `根 ${object.rootIndex}`;
    case "笔画":
      return `根 ${object.rootIndex} 笔 ${object.strokeIndex}`;
    case "二笔":
      return `根 ${object.rootIndex} 笔 (${object.strokeIndex * 2 - 1}, ${
        object.strokeIndex * 2
      })`;
  }
};

export const renderList = (object: CodableObject) => {
  const list = [object.type];
  switch (object.type) {
    case "固定":
      return [...list, object.key];
    case "字音":
      return [...list, object.subtype];
    case "字根":
      return [...list, object.rootIndex];
    case "笔画":
      return [...list, object.rootIndex, object.strokeIndex];
    case "二笔":
      return [...list, object.rootIndex, object.strokeIndex];
  }
  return list;
};

export const parseList = function (value: (string | number)[]): CodableObject {
  const type = value[0] as CodableObject["type"];
  switch (type) {
    case "固定":
      return { type, key: value[1] as string };
    case "字音":
      return { type, subtype: value[1] as PronunciationElementTypes };
    case "字根":
      return { type, rootIndex: value[1] as number };
    case "笔画":
      return {
        type,
        rootIndex: value[1] as number,
        strokeIndex: value[2] as number,
      };
    case "二笔":
      return {
        type,
        rootIndex: value[1] as number,
        strokeIndex: value[2] as number,
      };
  }
  return { type };
};

function getindex<T>(a: T[], i: number): T | undefined {
  return i >= 0 ? a[i - 1] : a[a.length + i];
}

function getslice<T>(a: T[], i: number, j: number) {
  return i >= 0 ? a.slice(i - 1, j) : a.slice(a.length + j, a.length + i + 1);
}

export const findElement = (
  object: CodableObject,
  result: TotalResult,
  config: Config,
  extra: Extra,
) => {
  const { pinyin, sequence } = result;
  let root: string | undefined;
  let strokes: number[] | undefined;
  switch (object.type) {
    case "汉字":
      return result.char;
    case "固定":
      return object.key;
    case "结构":
      if ("detail" in result && "operator" in result.detail) {
        return result.detail.operator;
      }
      return undefined;
    case "字音":
      const name = object.subtype;
      const rules = defaultAlgebra[name] || config.algebra?.[name];
      return applyRules(name, rules, pinyin);
    case "字根":
      return getindex(sequence, object.rootIndex);
    case "笔画":
    case "二笔": {
      root = getindex(sequence, object.rootIndex);
      if (root === undefined) return undefined;
      strokes = extra.rootSequence[root];
      if (strokes === undefined) {
        if (Math.abs(object.strokeIndex) === 1) return root;
        return undefined;
      }
      if (object.type === "笔画") {
        const number = getindex(strokes, object.strokeIndex);
        return number?.toString();
      }
      const [i1, i2] = [
        object.strokeIndex * 2 - Math.sign(object.strokeIndex),
        object.strokeIndex * 2,
      ];
      const stroke1 = getindex(strokes, i1);
      if (stroke1 === undefined) return undefined;
      const stroke2 = getindex(strokes, i2);
      return [stroke1, stroke2 ?? 0].join("");
    }
  }
};
