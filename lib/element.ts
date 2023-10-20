import { Config, TotalResult } from "./config";
import { Glyph } from "./data";

export interface Extra {
  rootData: Record<string, { glyph: Glyph }>;
}

interface Base {
  type: string;
}

export const analyzerNames = ["声", "韵", "调", "首字母", "末字母"] as const;

export type AName = (typeof analyzerNames)[number];

export const pinyinAnalyzers = {
  声: (p: string) => {
    const sm = p.match(/^[bpmfdtnlgkhjqxzcsryw]h?/) || ["零"];
    return sm[0];
  },
  韵: (p: string) => {
    const ym = p.match(/[aeiouv].*(?=\d)/) || ["零"];
    return ym[0];
  },
  调: (p: string) => p.match(/\d/)![0],
  首字母: (p: string) => p[0],
  末字母: (p: string) => p[p.length - 2],
} as Record<AName, (p: string) => string>;

interface This extends Base {
  type: "汉字";
}

interface Pronunciation extends Base {
  type: "字音";
  subtype: keyof typeof pinyinAnalyzers;
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

export type CodableObject = This | Pronunciation | Root | Stroke;

export const renderName = (object: CodableObject) => {
  switch (object.type) {
    case "汉字":
      return object.type;
    case "字音":
      return object.subtype;
    case "字根":
      return `根 ${object.rootIndex}`;
    case "笔画":
      return `根 ${object.rootIndex} 笔 ${object.strokeIndex}`;
  }
};

export const renderList = (object: CodableObject) => {
  const list = [object.type];
  switch (object.type) {
    case "字音":
      return [...list, object.subtype];
    case "字根":
      return [...list, object.rootIndex];
    case "笔画":
      return [...list, object.rootIndex, object.strokeIndex];
  }
  return list;
};

export const parseList = (value: (string | number)[]) => {
  const object = { type: value[0] };
  switch (value[0] as CodableObject["type"]) {
    case "字音":
      return { ...object, subtype: value[1] };
    case "字根":
      return { ...object, rootIndex: value[1] };
    case "笔画":
      return { ...object, rootIndex: value[1], strokeIndex: value[2] };
  }
  return object;
};

function getindex<T>(a: T[], i: number) {
  return i >= 0 ? a[i - 1] : a[a.length + i];
}

export const findElement = (
  object: CodableObject,
  result: TotalResult,
  data: Config["data"],
  extra: Extra,
) => {
  const { pinyin, sequence, all } = result;
  switch (object.type) {
    case "汉字":
      return result.char;
    case "字音":
      return pinyinAnalyzers[object.subtype](pinyin);
    case "字根":
      return getindex(sequence, object.rootIndex);
    case "笔画":
      const root = getindex(sequence, object.rootIndex);
      if (extra.rootData[root] === undefined) {
        if (object.strokeIndex === 1) return root;
        return undefined;
      }
      const { glyph } = extra.rootData[root];
      const stroke = getindex(glyph, object.strokeIndex);
      return stroke && data.classifier[stroke.feature].toString();
  }
};
