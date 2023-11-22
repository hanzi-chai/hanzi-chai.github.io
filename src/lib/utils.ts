import { Feature, schema } from "./classifier";
import { Mapping } from "./config";
import {
  Character,
  Form,
  Glyph,
  Operator,
  Partition,
  Stroke,
  operators,
} from "./data";

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

export const isValidCJKChar = (code: number) => {
  const block = unicodeBlock(code);
  return block === "cjk" || block === "cjk-a";
};

export const isValidChar = (char: string) => {
  const code = char.codePointAt(0)!;
  if (isValidCJKChar(code)) return true;
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
  for (let i = 0; i != s.length; ++i) {
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
  for (let i = 0; i != s.length; ++i) {
    const code = s.charCodeAt(i);
    if (65248 <= code && code <= 65248 + 128) {
      result += String.fromCharCode(code - 65248);
    } else {
      result += s[i];
    }
  }
  return result;
};

export const getDummyStroke = function (feature: Feature): Stroke {
  const typelist = schema[feature];
  return {
    feature,
    start: [0, 0],
    curveList: typelist.map((command) => {
      switch (command) {
        case "h":
          return { command, parameterList: [20] };
        case "v":
          return { command, parameterList: [20] };
        case "l":
          return { command, parameterList: [20, 20] };
        case "c":
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

export type MappedInfo = { name: string; code: string };

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
