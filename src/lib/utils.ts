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
} from "./data";
import { range } from "lodash-es";
import { dump } from "js-yaml";
import type { Key } from "./config";
import type { IndexedElement } from "./assembly";

interface Loss {
  ideal: number;
  lt_penalty: number;
  gt_penalty: number;
}

export type Dictionary = [string, string][];
export type Frequency = Record<string, number>;
export type Distribution = Record<string, Loss>;
export type Equivalence = Record<string, number>;

export type CustomElementMap = Record<string, string[]>;

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
        default:
          return { command, parameterList: [10, 10, 20, 20, 30, 30] };
      }
    }),
  };
};

export const getDummyCompound = function (operator: Operator): Compound {
  return { type: "compound", operator, operandList: ["一", "一"] };
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

export function getRecordFromTSV(text: string): Record<string, number> {
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
    if (isNaN(ideal) || isNaN(lt_penalty) || isNaN(gt_penalty)) return;
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
    return `"\\u${c.codePointAt(0)!.toString(16)}"`;
  });
  processExport(fileContent, filename + ".yaml");
};

export const exportJSON = (data: object, filename: string) => {
  const unsafeContent = JSON.stringify(data);
  const fileContent = unsafeContent.replace(/[\uE000-\uFFFF]/g, (c) => {
    return `\\u${c.codePointAt(0)!.toString(16)}`;
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
  } else if (typeof element === "string") {
    return display(element);
  } else {
    return renderSuperScript(display(element.element), element.index);
  }
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

export const makeJsWorker = () => {
  return new Worker(new URL("../jsworker.ts", import.meta.url), {
    type: "module",
  });
};

export const makeWasmWorker = () => {
  return new Worker(new URL("../worker.ts", import.meta.url), {
    type: "module",
  });
};

export const makeCharacterFilter =
  (
    input: CharacterFilter,
    repertoire: Repertoire | PrimitiveRepertoire,
    sequence: Map<string, string>,
  ) =>
  (char: string) => {
    const character = repertoire[char];
    if (character === undefined) return false;
    const name = character.name ?? "";
    const seq = sequence.get(char) ?? "";
    const isNameMatched = (name + char).includes(input.name ?? "");
    const isSequenceMatched = seq.startsWith(input.sequence ?? "");
    const isUnicodeMatched =
      input.unicode === undefined || input.unicode === char.codePointAt(0);
    const isTagMatched =
      input.tag === undefined ||
      ("glyphs" in character &&
        character.glyphs.some((x) => x.tags?.includes(input.tag!))) ||
      ("glyph" in character && character.glyph?.tags?.includes(input.tag));
    const isOperatorMatched =
      input.operator === undefined ||
      ("glyphs" in character &&
        character.glyphs.some(
          (x) => "operator" in x && x.operator.includes(input.operator!),
        )) ||
      ("glyph" in character &&
        character.glyph?.type === "compound" &&
        character.glyph.operator.includes(input.operator));
    const isPartMatched =
      input.part === undefined ||
      ("glyphs" in character &&
        character.glyphs.some(
          (x) => "operandList" in x && x.operandList.includes(input.part!),
        )) ||
      ("glyph" in character &&
        character.glyph?.type === "compound" &&
        character.glyph.operandList.includes(input.part));
    return (
      isNameMatched &&
      isSequenceMatched &&
      isUnicodeMatched &&
      isTagMatched &&
      isOperatorMatched &&
      isPartMatched
    );
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
    let name = form[char]?.name ?? "";
    let seq = sequence.get(char) ?? "";
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
