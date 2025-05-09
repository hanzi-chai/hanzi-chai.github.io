import type { Feature } from "./classifier";
import { schema } from "./classifier";
import type {
  DerivedComponent,
  Compound,
  Repertoire,
  Draw,
  Operator,
  Point,
  SVGStroke,
  BasicComponent,
  ReferenceStroke,
  PrimitiveRepertoire,
  PrimitiveCharacter,
  Character,
  SplicedComponent,
} from "./data";
import { range } from "lodash-es";
import { dump } from "js-yaml";
import type { Key, Mapped, Mapping } from "./config";
import type { IndexedElement } from "./assembly";

interface Loss {
  ideal: number;
  lt_penalty: number;
  gt_penalty: number;
}

export type Dictionary = [string, string][];
export type Frequency = Record<string, number>;
export type AdaptedFrequency = Map<string, number>;
export type Distribution = Record<string, Loss>;
export type Equivalence = Record<string, number>;

export type CustomElementMap = Record<string, string[]>;

export const printableAscii = range(33, 127).map((x) =>
  String.fromCodePoint(x),
);

export const formatDate = (date: Date) => {
  return `${
    date.getMonth() + 1
  }-${date.getDate()} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
};

export const unicodeBlock = (code: number) => {
  // ASCII
  if (code >= 0 && code <= 0x7f) return "ascii";
  // CJK
  if (code >= 0x4e00 && code <= 0x9fff) return "cjk";
  // CJK extension A
  if (code >= 0x3400 && code <= 0x4dbf) return "cjk-a";
  // PUA
  if (code >= 0xe000 && code <= 0xf9ff) return "pua";
  return "unknown";
};

export const isValidCJKBasicChar = (char: string) => {
  const code = char.codePointAt(0)!;
  const block = unicodeBlock(code);
  return block === "cjk";
};

export const isValidCJKChar = (char: string) => {
  const code = char.codePointAt(0)!;
  const block = unicodeBlock(code);
  return block === "cjk" || block === "cjk-a";
};

export const isPUA = (char: string) => {
  const code = char.codePointAt(0)!;
  return unicodeBlock(code) === "pua";
};

export const chars = (s: string) => {
  return Array.from(s).length;
};

export const getDummyBasicComponent = (): BasicComponent => ({
  type: "basic_component",
  strokes: [getDummySVGStroke("横")],
});

export const getDummyDerivedComponent = (): DerivedComponent => ({
  type: "derived_component",
  source: "一",
  strokes: [getDummyReferenceStroke()],
});

export const getDummySplicedComponent = (): SplicedComponent => ({
  type: "spliced_component",
  operator: "⿰",
  operandList: ["一", "丨"],
});

export const getDummyReferenceStroke = (): ReferenceStroke => ({
  feature: "reference",
  index: 0,
});

export const getDummySVGStroke = (
  feature: Feature,
  start: Point = [0, 0],
  oldCurveList: Draw[] = [],
): SVGStroke => {
  const typelist = schema[feature];
  return {
    feature,
    start,
    curveList: typelist.map((command, index) => {
      if (oldCurveList[index]?.command === command) {
        return oldCurveList[index]!;
      }
      switch (command) {
        case "a":
          return { command, parameterList: [20] };
        case "h":
        case "v":
          return { command, parameterList: [20] };
        default:
          return { command, parameterList: [10, 10, 20, 20, 30, 30] };
      }
    }),
  };
};

export const getDummyCompound = (operator: Operator): Compound => ({
  type: "compound",
  operator,
  operandList: ["一", "一"],
});

export const isComponent = (
  glyph: BasicComponent | DerivedComponent | SplicedComponent | Compound,
): glyph is BasicComponent | DerivedComponent | SplicedComponent =>
  glyph.type === "basic_component" ||
  glyph.type === "derived_component" ||
  glyph.type === "spliced_component";

export const getSupplemental = (repertoire: Repertoire, list: string[]) => {
  const set = new Set(list);
  const reverseForm: Record<string, string[]> = Object.fromEntries(
    Object.entries(repertoire).map(([x]) => [x, []]),
  );
  for (const [char, { glyph }] of Object.entries(repertoire)) {
    if (glyph?.type === "compound") {
      glyph.operandList.forEach((x) => reverseForm[x]?.push(char));
    }
  }
  const componentsNotChar = Object.entries(repertoire)
    .filter(([, v]) => v.glyph?.type === "basic_component")
    .map(([x]) => x)
    .filter((x) => !set.has(x));
  const suppList: string[] = [];
  componentsNotChar.forEach((char) => {
    let trial: string | undefined = char;
    while (trial && !set.has(trial)) {
      trial = reverseForm[trial]?.[0];
    }
    if (trial) suppList.push(trial);
  });
  return Array.from(new Set(suppList));
};

export const listToObject = <T extends { unicode: number }>(list: T[]) =>
  Object.fromEntries(list.map((x) => [String.fromCodePoint(x.unicode), x]));

export function getRecordFromTSV(text: string): Record<string, number> {
  const tsv = text
    .trim()
    .split("\n")
    .map((x) => x.trim().split("\t"));
  const data: Record<string, number> = {};
  tsv.forEach(([char, freq]) => {
    if (char === undefined || freq === undefined) return;
    const maybeNumber = Number(freq);
    if (Number.isNaN(maybeNumber)) return;
    data[char] = maybeNumber;
  });
  return data;
}

export function getDistributionFromTSV(text: string): Distribution {
  const tsv = text
    .trim()
    .split("\n")
    .map((x) => x.trim().split("\t"));
  const data: Distribution = {};
  tsv.forEach(([char, ideal_s, lt_penalty_s, gt_penalty_s]) => {
    if (
      char === undefined ||
      ideal_s === undefined ||
      lt_penalty_s === undefined ||
      gt_penalty_s === undefined
    )
      return;
    const [ideal, lt_penalty, gt_penalty] = [
      ideal_s,
      lt_penalty_s,
      gt_penalty_s,
    ].map(Number) as [number, number, number];
    if (
      Number.isNaN(ideal) ||
      Number.isNaN(lt_penalty) ||
      Number.isNaN(gt_penalty)
    )
      return;
    data[char] = { ideal, lt_penalty, gt_penalty };
  });
  return data;
}

export function getDictFromTSV(text: string): [string, string][] {
  const result: [string, string][] = [];
  for (const line of text.trim().split("\n")) {
    const [key, value] = line.trim().split("\t");
    if (key === undefined || value === undefined) continue;
    result.push([key, value]);
  }
  return result;
}

const processExport = (content: string, filename: string) => {
  const blob = new Blob([content], { type: "text/plain" });
  const a = document.createElement("a");
  a.download = filename;
  const url = window.URL.createObjectURL(blob);
  a.href = url;
  a.click();
  window.URL.revokeObjectURL(url); // 避免内存泄漏
};

export const exportYAML = (config: object, filename: string) => {
  const unsafeContent = dump(config, { flowLevel: 4 });
  const fileContent = unsafeContent.replace(/[\uE000-\uFFFF]/g, (c) => {
    return `"\\u${c.codePointAt(0)?.toString(16)}"`;
  });
  processExport(fileContent, `${filename}.yaml`);
};

export const exportJSON = (data: object, filename: string) => {
  const unsafeContent = JSON.stringify(data);
  const fileContent = unsafeContent.replace(/[\uE000-\uFFFF]/g, (c) => {
    return `\\u${c.codePointAt(0)?.toString(16)}`;
  });
  processExport(fileContent, filename);
};

export const exportTSV = (data: string[][], filename: string) => {
  const fileContent = data.map((x) => x.join("\t")).join("\n");
  processExport(fileContent, filename);
};

export const renderIndexed = (
  element: IndexedElement | undefined,
  display: (s: string) => string,
) => {
  if (element === undefined) {
    return "ε";
  }
  if (typeof element === "string") {
    return display(element);
  }
  return renderSuperScript(display(element.element), element.index);
};

export const renderSuperScript = (element: string, index: number) => {
  const superscripts = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  return index
    ? element + (superscripts[index + 1] ?? superscripts[0])
    : element;
};

export const joinKeys = (keys: Key[]) => {
  return keys.every((x) => typeof x === "string") ? keys.join("") : keys;
};

export const renderMapped = (mapped: string | Key[]) => {
  if (typeof mapped === "string") {
    return mapped;
  }
  return mapped.map((x) => {
    return typeof x === "string" ? x : renderSuperScript(x.element, x.index);
  });
};

const match = (
  character: PrimitiveCharacter | Character,
  input: CharacterFilter,
) => {
  const { tag, operator, part } = input;
  if ("glyphs" in character) {
    const isTagMatched =
      tag === undefined || character.glyphs.some((x) => x.tags?.includes(tag));
    const isOperatorMatched =
      operator === undefined ||
      character.glyphs.some(
        (x) => "operator" in x && x.operator.includes(operator),
      );
    const isPartMatched =
      part === undefined ||
      character.glyphs.some(
        (x) => "operandList" in x && x.operandList.includes(part),
      );
    return isTagMatched && isOperatorMatched && isPartMatched;
  }
  const isTagMatched =
    tag === undefined || character.glyph?.tags?.includes(tag);
  const isOperatorMatched =
    operator === undefined ||
    (character.glyph?.type === "compound" &&
      character.glyph.operator.includes(operator));
  const isPartMatched =
    part === undefined ||
    (character.glyph?.type === "compound" &&
      character.glyph.operandList.includes(part));
  return isTagMatched && isOperatorMatched && isPartMatched;
};

export const makeCharacterFilter = (
  input: CharacterFilter,
  repertoire: Repertoire | PrimitiveRepertoire,
  sequenceMap: Map<string, string>,
) => {
  let sequenceRegex: RegExp | undefined;
  try {
    if (input.sequence) {
      sequenceRegex = new RegExp(input.sequence);
    }
  } catch {}
  return (name: string) => {
    const character = repertoire[name];
    if (character === undefined) return false;
    const sequence = sequenceMap.get(name) ?? "";
    const isNameMatched = ((character.name ?? "") + name).includes(
      input.name ?? "",
    );
    const isSequenceMatched = sequenceRegex?.test(sequence) ?? true;
    const isUnicodeMatched =
      input.unicode === undefined || input.unicode === name.codePointAt(0);
    const isMatched = match(character, input);
    return isNameMatched && isSequenceMatched && isUnicodeMatched && isMatched;
  };
};

export interface CharacterFilter {
  name?: string;
  sequence?: string;
  unicode?: number;
  tag?: string;
  part?: string;
  operator?: Operator;
}

export const makeFilter =
  (input: string, form: Repertoire, sequence: Map<string, string>) =>
  (char: string) => {
    if ((sequence.get(char)?.length ?? 0) <= 1) return false;
    const name = form[char]?.name ?? "";
    const seq = sequence.get(char) ?? "";
    return (
      name.includes(input) || char.includes(input) || seq.startsWith(input)
    );
  };

export interface AnalyzerForm {
  type: "single" | "multi" | "all";
  position: number[];
  top: number;
}

export const makeDefaultAnalyzer = (maxLength: number) => {
  const form: AnalyzerForm = {
    type: "all",
    position: range(0, maxLength),
    top: 0,
  };
  return form;
};

interface LevelMetric {
  length: number;
  frequency: number;
}

interface TierMetric {
  top?: number;
  duplication?: number;
  levels?: LevelMetric[];
  fingering?: (number | undefined)[];
}

export interface PartialMetric {
  tiers?: TierMetric[];
  duplication?: number;
  key_distribution?: number;
  pair_equivalence?: number;
  extended_pair_equivalence?: number;
  fingering?: (number | undefined)[];
  levels?: LevelMetric[];
}

export interface Metric {
  characters_full?: PartialMetric;
  characters_short?: PartialMetric;
  words_full?: PartialMetric;
  words_short?: PartialMetric;
}

function 最大逆向匹配分词(词典: Set<string>, 文本: string) {
  const 词列表: string[] = [];
  const 字符列表 = [...文本];
  let 结束位置 = 字符列表.length;
  while (结束位置 > 0) {
    const 末字 = 字符列表[结束位置 - 1]!;
    if (!词典.has(末字)) {
      词列表.unshift(末字);
      结束位置 -= 1;
      continue;
    }
    for (let 开始位置 = 0; 开始位置 < 结束位置; 开始位置++) {
      const 词 = 字符列表.slice(开始位置, 结束位置).join("");
      if (词典.has(词)) {
        词列表.unshift(词);
        结束位置 = 开始位置;
        break;
      }
    }
  }
  return 词列表;
}

// 使用使用逆向最大匹配算法来分词
export const adapt = (原始词频映射: Frequency, 词典: Set<string>) => {
  const 新词频映射: Map<string, number> = new Map();
  for (const [词, 词频] of Object.entries(原始词频映射)) {
    if (词典.has(词)) {
      新词频映射.set(词, (新词频映射.get(词) ?? 0) + 词频);
    } else {
      const 子词列表 = 最大逆向匹配分词(词典, 词);
      for (const 子词 of 子词列表) {
        新词频映射.set(子词, (新词频映射.get(子词) ?? 0) + 词频);
      }
    }
  }
  return 新词频映射;
};

export type Tuple<T, N extends number> = N extends N
  ? number extends N
    ? T[]
    : _TupleOf<T, N, []>
  : never;

type _TupleOf<T, N extends number, R extends unknown[]> = R["length"] extends N
  ? R
  : _TupleOf<T, N, [T, ...R]>;

export interface MappedInfo {
  name: string;
  code: Mapped;
}

export const getReversedMapping = (mapping: Mapping, alphabet: string) => {
  const reversedMapping = new Map<string, MappedInfo[]>(
    Array.from(alphabet).map((key) => [key, []]),
  );
  for (const [name, code] of Object.entries(mapping)) {
    const main = code[0];
    if (typeof main === "string") {
      reversedMapping.get(main)?.push({ name, code });
    }
  }
  return reversedMapping;
};
