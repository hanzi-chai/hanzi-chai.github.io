// @ts-ignore
import underscoreIsEqual from "underscore/modules/isEqual";
import type { Feature } from "./classifier";
import { schema } from "./classifier";
import type { Mapping } from "./config";
import type {
  Draw,
  Form,
  Glyph,
  Operator,
  Partition,
  Point,
  SVGStroke,
} from "./data";
import { operators } from "./data";

/**
 * Performs an optimized deep comparison between `object` and `other`
 * to determine if they should be considered equal.
 * @param object - Compare to `other`.
 * @param other - Compare to `object`.
 * @returns True if `object` should be considered equal to `other`.
 */
type IsEqualFunction = (object: any, other: any) => boolean;
export const isEqual = underscoreIsEqual as IsEqualFunction;

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

export const length = (s: string) => {
  return Array.from(s).length;
};

export function deepcopy<T>(t: T) {
  return JSON.parse(JSON.stringify(t)) as T;
}

export const halfToFull = (s: string) => {
  let result = "";
  for (let i = 0; i !== s.length; ++i) {
    const code = s.charCodeAt(i);
    if (code <= 128) {
      result += String.fromCharCode(code + 65248);
    } else {
      result += s[i];
    }
  }
  return result;
};

export const fullToHalf = (s: string) => {
  let result = "";
  for (let i = 0; i !== s.length; ++i) {
    const code = s.charCodeAt(i);
    if (65248 <= code && code <= 65248 + 128) {
      result += String.fromCharCode(code - 65248);
    } else {
      result += s[i];
    }
  }
  return result;
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

export const getDummyPartition = function (operator: Operator): Partition {
  return { operator, operandList: ["一", "一"] };
};

export const formDefault: Required<Pick<Glyph, "component" | "compound">> = {
  component: { strokes: [], source: undefined },
  compound: [{ operator: operators[0], operandList: ["一", "一"] }],
};

export interface MappedInfo {
  name: string;
  code: string;
}

export const reverse = (alphabet: string, mapping: Mapping) => {
  const data: Record<string, MappedInfo[]> = Object.fromEntries(
    Array.from(alphabet).map((key) => [key, []]),
  );
  for (const [name, code] of Object.entries(mapping)) {
    const main = code[0]!;
    data[main]!.push({ name, code });
  }
  return data;
};

export const getSupplemental = (form: Form, list: string[]) => {
  const set = new Set(list);
  const reverseForm: Record<string, string[]> = Object.fromEntries(
    Object.entries(form).map(([x]) => [x, []]),
  );
  for (const [char, glyph] of Object.entries(form)) {
    if (glyph.default_type === "compound") {
      glyph.compound[0]!.operandList.forEach((x) => reverseForm[x]!.push(char));
    }
  }
  const componentsNotChar = Object.entries(form)
    .filter(([, v]) => v.default_type === "component")
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
