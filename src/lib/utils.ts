import type { Feature } from "./classifier";
import { schema } from "./classifier";
import type { Key, Mapping } from "./config";
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
} from "./data";
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

export const isPUA = (char: string) => {
  const code = char.codePointAt(0)!;
  return unicodeBlock(code) === "pua";
};

export const chars = (s: string) => {
  return Array.from(s).length;
};

export const deepcopy = structuredClone ?? cloneDeep;

export const getDummyBasicComponent = function (): BasicComponent {
  return {
    type: "basic_component",
    strokes: [getDummySVGStroke("横")],
  };
};

export const getDummyDerivedComponent = function (): DerivedComponent {
  return {
    type: "derived_component",
    source: "一",
    strokes: [getDummyReferenceStroke()],
  };
};

export const getDummyReferenceStroke = function (): ReferenceStroke {
  return {
    feature: "reference",
    index: 0,
  };
};

export const getDummySVGStroke = function (
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

export const getDummyCompound = function (operator: Operator): Compound {
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

export const isComponent = function (
  glyph: BasicComponent | DerivedComponent | Compound,
): glyph is BasicComponent | DerivedComponent {
  return glyph.type === "basic_component" || glyph.type === "derived_component";
};

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

export const listToObject = function <T extends { unicode: number }>(
  list: T[],
) {
  return Object.fromEntries(
    list.map((x) => [String.fromCodePoint(x.unicode), x]),
  );
};

export const uniquify = (l: string[]) => [...new Set(l)].sort();

export function parseTSV(text: string): Record<string, number> {
  const tsv = text
    .trim()
    .split("\n")
    .map((x) => x.trim().split("\t"));
  const data: Record<string, number> = {};
  tsv.forEach(([char, freq]) => {
    if (char === undefined || freq === undefined) return;
    const maybeNumber = Number(freq);
    if (isNaN(maybeNumber)) return;
    data[char] = maybeNumber;
  });
  return data;
}
