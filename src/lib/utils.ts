import type { Feature } from "./classifier";
import { schema } from "./classifier";
import type { Key, Mapping } from "./config";
import type {
  Component,
  Compound,
  Repertoire,
  Draw,
  Operator,
  Point,
  SVGStroke,
} from "./data";
import { operators } from "./data";
import { cloneDeep, range } from "lodash-es";

export const printableAscii = range(33, 127).map((x) =>
  String.fromCodePoint(x),
);

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

export const isValidCJKChar = (char: string) => {
  const code = char.codePointAt(0)!;
  const block = unicodeBlock(code);
  return block === "cjk" || block === "cjk-a";
};

export const isValidChar = (char: string) => {
  if (isValidCJKChar(char)) return true;
  const code = char.codePointAt(0)!;
  return unicodeBlock(code) === "ascii";
};

export const isPUA = (char: string) => {
  const code = char.codePointAt(0)!;
  return unicodeBlock(code) === "pua";
};

export const length = (s: string) => {
  return Array.from(s).length;
};

export const deepcopy = structuredClone ?? cloneDeep;

export const getDummyComponent = function (): Component {
  return {
    type: "component",
    source: undefined,
    strokes: [getDummyStroke("横")],
  };
};

export const getDummyStroke = function (
  feature: Feature,
  start: Point = [0, 0],
  oldCurveList: Draw[] = [],
): SVGStroke {
  const typelist = schema[feature];
  return {
    feature,
    start,
    curveList: typelist.map((command, index) => {
      if (oldCurveList[index]?.command === command) {
        return oldCurveList[index]!;
      }
      switch (command) {
        case "h":
        case "v":
          return { command, parameterList: [20] };
        case "c":
        case "z":
          return { command, parameterList: [10, 10, 20, 20, 30, 30] };
      }
    }),
  };
};

export const getDummyPartition = function (operator: Operator): Compound {
  return { type: "compound", operator, operandList: ["一", "一"] };
};

export interface MappedInfo {
  name: string;
  code: string | Key[];
}

export const reverse = (alphabet: string, mapping: Mapping) => {
  const data: Record<string, MappedInfo[]> = Object.fromEntries(
    Array.from(alphabet).map((key) => [key, []]),
  );
  for (const [name, code] of Object.entries(mapping)) {
    const main = code[0]!;
    if (typeof main === "string") {
      data[main]!.push({ name, code });
    }
  }
  return data;
};

export const getSupplemental = (repertoire: Repertoire, list: string[]) => {
  const set = new Set(list);
  const reverseForm: Record<string, string[]> = Object.fromEntries(
    Object.entries(repertoire).map(([x]) => [x, []]),
  );
  for (const [char, glyph] of Object.entries(repertoire)) {
    if (glyph.glyph?.type === "compound") {
      try {
        glyph.glyph!.operandList.forEach((x) => reverseForm[x]!.push(char));
      } catch {
        console.error(char, glyph);
      }
    }
  }
  const componentsNotChar = Object.entries(repertoire)
    .filter(([, v]) => v.glyph?.type === "component")
    .map(([x]) => x)
    .filter((x) => !set.has(x));
  const suppList: string[] = [];
  componentsNotChar.forEach((char) => {
    let trial = char;
    while (trial && !set.has(trial)) {
      trial = reverseForm[trial]![0]!;
    }
    if (trial) suppList.push(trial);
  });
  return Array.from(new Set(suppList));
};

export const listToObject = function <T extends { unicode: number }>(
  list: T[],
) {
  return Object.fromEntries(
    list.map((x) => [String.fromCodePoint(x.unicode), x]),
  );
};
