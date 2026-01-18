export * from "./main.js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Pako from "pako";
import { PrimitiveCharacter, PrimitiveRepertoire, Repertoire } from "./data.js";
import {
  characterSetFilters,
  Dictionary,
  Frequency,
  listToObject,
} from "./utils.js";
import { Config } from "./config.js";
import { analysis, 字形分析配置, determine } from "./repertoire.js";
import { 应用变换器 } from "./primitive.js";
import { 组装 } from "./assembly.js";

export interface Item {
  id: number;
  name: string;
  price: number;
}

// ESM 中模拟 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Model {
  unicode: number;
  tygf: 0 | 1 | 2 | 3;
  gb2312: 0 | 1 | 2;
  readings: string;
  glyphs: string;
  name: string | null;
  gf0014_id: number | null;
  gf3001_id: number | null;
  ambiguous: 0 | 1;
}

const codeToChar = (code: number) => String.fromCodePoint(code);

const glyphForward = (c: any) => {
  if (c.type === "basic_component") {
    return c;
  } else if (c.type === "derived_component" || c.type === "identity") {
    return { ...c, source: codeToChar(c.source) };
  } else {
    return { ...c, operandList: c.operandList.map(codeToChar) };
  }
};

export function fromModel(model: Model): PrimitiveCharacter {
  return {
    ...model,
    readings: JSON.parse(model.readings),
    glyphs: JSON.parse(model.glyphs).map(glyphForward),
    ambiguous: model.ambiguous === 1,
  };
}

export function getPrimitveRepertoire(): PrimitiveRepertoire {
  const filePath = path.join(__dirname, "data", "repertoire.json.deflate");
  const compressed = readFileSync(filePath);
  const decompressed = Pako.inflate(compressed, { to: "string" });
  const raw = JSON.parse(decompressed).map(fromModel) as PrimitiveCharacter[];
  const primitiveRepertoire = listToObject(raw);
  return primitiveRepertoire;
}

export function getDictionary(): Dictionary {
  const filePath = path.join(__dirname, "data", "dictionary.txt");
  const raw = readFileSync(filePath, "utf-8");
  return raw
    .trim()
    .split("\n")
    .map((line) => {
      const [key, value] = line.split("\t");
      return [key, value];
    });
}

export function getFrequency(): Frequency {
  const filePath = path.join(__dirname, "data", "frequency.txt");
  const raw = readFileSync(filePath, "utf-8");
  return Object.fromEntries(
    raw
      .trim()
      .split("\n")
      .map((line) => {
        const [char, freq] = line.split("\t");
        return [char, Number(freq)];
      }),
  );
}

export function getRepertoire(config: Config): Repertoire {
  const primitiveRepertoire = getPrimitveRepertoire();
  const userRepertoire = config.data?.repertoire ?? {};
  const allRepertoire = { ...primitiveRepertoire, ...userRepertoire };
  const customGlyph = config.data?.glyph_customization ?? {};
  const customReadings = config.data?.reading_customization ?? {};
  const tags = config.data?.tags ?? [];
  let determined = determine(allRepertoire, customGlyph, customReadings, tags);
  const transformers = config.data?.transformers ?? [];
  for (const transformer of transformers) {
    determined = 应用变换器(determined, transformer);
  }
  return determined;
}

export function getCharacters(
  config: Config,
  repertoire: Repertoire,
): string[] {
  const characterSet = config.data?.character_set ?? "minimal";
  const filter = characterSetFilters[characterSet];
  const characters = Object.entries(repertoire)
    .filter(([k, v]) => filter(k, v))
    .map(([k]) => k);
  return characters;
}

export function getAnalysisConfig(
  config: Config,
  repertoire: Repertoire,
): 字形分析配置 {
  const mapping = config.form.mapping;
  const mappingSpace = config.form.mapping_space ?? {};
  const optionalRoots = new Set<string>();
  for (const [key, value] of Object.entries(mappingSpace)) {
    if (value.some((x) => x.value == null) || mapping[key] === undefined) {
      optionalRoots.add(key);
    }
  }
  const analysis = config.analysis ?? {};
  const roots = new Map(Object.entries(mapping).filter(([x]) => repertoire[x]));
  return {
    分析配置: analysis,
    字根决策: roots,
    可选字根: optionalRoots,
  };
}

export function getAnalysisResult(config: Config, repertoire: Repertoire) {
  const analysisConfig = getAnalysisConfig(config, repertoire);
  const characters = getCharacters(config, repertoire);
  return analysis(repertoire, analysisConfig, characters);
}

export function getAssemblyResult(config: Config, repertoire: Repertoire) {
  const characters = getCharacters(config, repertoire);
  const analysisResult = getAnalysisResult(config, repertoire);
  const assembleConfig = {
    algebra: config.algebra ?? {},
    encoder: config.encoder ?? {},
    keyboard: config.form ?? {},
    priority: config.encoder?.priority_short_codes ?? [],
  };
  组装(
    repertoire,
    assembleConfig,
    characters,
    getDictionary(),
    new Map(Object.entries(getFrequency())),
    analysisResult,
    {},
  );
}
