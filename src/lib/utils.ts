import { Feature, schema } from "./classifier";
import { Mapping } from "./config";
import {
  Alias,
  Compound,
  Form,
  Glyph,
  GlyphOptionalUnicode,
  Operator,
  Partition,
  SVGCommand,
  Stroke,
} from "./data";

export const validUnicode = (char: string) => {
  const code = char.codePointAt(0)!;
  if (code <= 0x7f) return true;
  if (code >= 0x4e00 && code <= 0x9fff) return true;
  if (code >= 0x3400 && code <= 0x4dbf) return true;
  return false;
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

export type MappedInfo = { name: string; code: string };

export const reverse = (alphabet: string, mapping: Mapping) => {
  const data: Record<string, MappedInfo[]> = Object.fromEntries(
    Array.from(alphabet).map((key) => [key, []]),
  );
  for (const [name, code] of Object.entries(mapping)) {
    const [main] = [code[0]];
    data[main].push({ name, code });
  }
  return data;
};

export const getSupplemental = (form: Form, list: string[]) => {
  const set = new Set(list);
  const reverseForm: Record<string, string[]> = Object.fromEntries(
    Object.entries(form).map(([x]) => [x, []]),
  );
  for (const [char, glyph] of Object.entries(form)) {
    if (glyph.default_type === 2) {
      glyph.compound[0].operandList.forEach((x) => reverseForm[x].push(char));
    }
  }
  const componentsNotChar = Object.entries(form)
    .filter(([, v]) => v.default_type === 0)
    .map(([x]) => x)
    .filter((x) => !set.has(x));
  const suppList: string[] = [];
  componentsNotChar.forEach((char) => {
    let trial = char;
    while (trial && !set.has(trial)) {
      trial = reverseForm[trial][0];
    }
    if (trial) suppList.push(trial);
  });
  return Array.from(new Set(suppList));
};

export const preprocessRepertoire = (r: any[]) => {
  return Object.fromEntries(
    r.map((x) => [
      String.fromCodePoint(x.unicode),
      {
        tygf: x.tygf,
        gb2312: x.gb2312,
        pinyin: JSON.parse(x.pinyin),
      },
    ]),
  );
};

export const preprocessForm = (f: any[]) => {
  return Object.fromEntries(f.map((x) => [String.fromCodePoint(x.unicode), x]));
};

export const displayName = (x: string, v: Glyph) => {
  return validUnicode(x) ? x : v.name!;
};
