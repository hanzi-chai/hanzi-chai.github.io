import type {
  Algebra,
  Condition,
  EncoderConfig,
  Grouping,
  Keyboard,
  Mapping,
  Op,
  Source,
  WordRule,
} from "./config";
import type { ComponentAnalysis } from "./component";
import type { CompoundAnalysis } from "./compound";
import type { Extra } from "./element";
import { algebraCache, findElement } from "./element";
import type { Repertoire } from "./data";
import type { AnalysisResult } from "./repertoire";
import type { Dictionary, CustomElementMap } from "./utils";

export const getPriorityMap = (
  priorityShortCodes: [string, string, number][],
) => {
  return new Map<string, number>(
    priorityShortCodes.map(([word, pinyin_list, level]) => {
      const hash = `${word}-${pinyin_list}`;
      return [hash, level] as [string, number];
    }),
  );
};

const table: Record<
  Op,
  (
    target: string | undefined,
    value: string | null,
    totalMapping: Record<string, string>,
  ) => boolean
> = {
  是: (t, v) => t === v,
  不是: (t, v) => t !== v,
  匹配: (t, v) => t !== undefined && new RegExp(v!).test(t),
  不匹配: (t, v) => t !== undefined && !new RegExp(v!).test(t),
  编码匹配: (t, v, m) => t !== undefined && new RegExp(v!).test(m[t]!),
  编码不匹配: (t, v, m) => t !== undefined && !new RegExp(v!).test(m[t]!),
  存在: (t) => t !== undefined,
  不存在: (t) => t === undefined,
};

/**
 * 代表了一个有字音、有字形的汉字的中间结果
 * 由拆分结果 [`ComponentResult`](#componentresult) 或 [`CompoundResult`](#compoundresult) 与字音组成
 */
export type CharacterResult = (ComponentAnalysis | CompoundAnalysis) & {
  char: string;
  pinyin: string;
  importance: number;
  custom: Record<string, string[]>;
};

/**
 * 给定一个条件，判断是否满足
 *
 * @param condition - 条件
 * @param result - 中间结果
 * @param config - 配置
 * @param extra - 额外信息
 * @param totalMapping - 映射
 */
const satisfy = (
  condition: Condition,
  result: CharacterResult,
  config: Algebra,
  extra: Extra,
  totalMapping: Record<string, string>,
) => {
  const { object, operator } = condition;
  const target = findElement(object, result, config, extra);
  const fn = table[operator];
  if ("value" in condition) {
    return fn(target, condition.value, totalMapping);
  }
  return fn(target, null, totalMapping);
};

const merge = (mapping: Mapping, grouping: Grouping) => {
  const compiledMapping: Record<string, string> = {};
  for (const [element, mapped] of Object.entries(mapping)) {
    compiledMapping[element] =
      typeof mapped === "string"
        ? mapped
        : mapped
            .map((x) =>
              typeof x === "string" ? x : mapping[x.element]?.[x.index],
            )
            .join("");
  }
  const compiledGrouping = Object.fromEntries(
    Object.entries(grouping).map(([x, y]) => [x, compiledMapping[y]!]),
  );
  return Object.assign(compiledGrouping, compiledMapping);
};

export type IndexedElement = string | { element: string; index: number };
export interface Assembly {
  name: string;
  pinyin_list: string[];
  sequence: IndexedElement[];
  importance: number;
  level?: number;
}
export type AssemblyResult = Assembly[];

const compile = (
  keyboard: Keyboard,
  encoder: EncoderConfig,
  algebra: Algebra,
) => {
  const { mapping, grouping, alphabet } = keyboard;
  const totalMapping = merge(mapping, grouping ?? {});
  return (result: CharacterResult, data: Repertoire, extra: Extra) => {
    let node: string | null = "s0";
    const codes = [] as IndexedElement[];
    while (node) {
      if (node.startsWith("s")) {
        const source: Source = encoder.sources[node]!;
        const { object, next, index } = source;
        if (node !== "s0") {
          const element = findElement(object!, result, algebra, extra);
          // 检查元素或键位是否有效
          if (element === undefined) {
            node = next;
            continue;
          }
          // 如果是固定编码，直接加入
          if (element.length === 1 && alphabet.includes(element)) {
            codes.push(element);
            node = next;
            continue;
          }
          const groupedElement = grouping?.[element] || element;
          const mappedElement = mapping[groupedElement];
          if (mappedElement === undefined) {
            node = next;
            continue;
          }
          if (index === undefined) {
            // 如果没有定义指标，就是全取
            for (const [index, key] of Array.from(mappedElement).entries()) {
              codes.push(
                typeof key === "string"
                  ? { element: groupedElement, index }
                  : key,
              );
            }
          } else {
            // 检查指标是否有效
            const key = mappedElement[index];
            if (key !== undefined) {
              codes.push(
                typeof key === "string"
                  ? { element: groupedElement, index }
                  : key,
              );
            }
          }
        }
        node = next;
      } else {
        const condition: Condition = encoder.conditions[node]!;
        if (satisfy(condition, result, algebra, extra, totalMapping)) {
          node = condition.positive;
        } else {
          node = condition.negative;
        }
      }
    }
    return codes.slice(0, encoder.max_length ?? codes.length);
  };
};

const signedIndex = <T>(elements: T[], index: string) => {
  const order = index.codePointAt(0)! - "a".codePointAt(0)!;
  const signedOrder = order < 13 ? order : order - 26;
  return elements.at(signedOrder);
};

const gather = (totalElements: IndexedElement[][], rules: WordRule[]) => {
  const result: IndexedElement[] = [];
  let matched = false;
  for (const rule of rules) {
    if ("length_equal" in rule) {
      matched = totalElements.length === rule.length_equal;
    } else if ("length_in_range" in rule) {
      matched =
        totalElements.length >= rule.length_in_range[0]! &&
        totalElements.length <= rule.length_in_range[1]!;
    }
    if (matched) {
      const tokens = Array.from(rule.formula);
      for (let i = 0; i < tokens.length; i = i + 2) {
        const charIndex = tokens[i]!.toLowerCase();
        const elementIndex = tokens[i + 1]!;
        const elements = signedIndex(totalElements, charIndex);
        if (elements === undefined) return undefined;
        const element = signedIndex(elements, elementIndex);
        if (element === undefined) return undefined;
        result.push(element);
      }
      break;
    }
  }
  if (matched) return result;
};

interface AssembleConfig {
  encoder: EncoderConfig;
  keyboard: Keyboard;
  algebra: Algebra;
  priority: [string, string, number][];
}

/**
 * 给定一个拆分结果，返回所有可能的编码
 *
 * @param repertoire - 字符集
 * @param config - 配置
 * @param characters - 需要编码的汉字列表
 * @param analysisResult - 分析结果
 *
 * @returns 组装结果
 */
export const assemble = (
  repertoire: Repertoire,
  config: AssembleConfig,
  characters: string[],
  dictionary: Dictionary,
  analysisResult: AnalysisResult,
  customElements: Record<string, CustomElementMap>,
) => {
  const { customized, compoundResults } = analysisResult;
  const extra = { rootSequence: analysisResult.rootSequence };
  const func = compile(config.keyboard, config.encoder, config.algebra);
  const result: AssemblyResult = [];
  algebraCache.clear();
  const characterCache = new Map<string, IndexedElement[]>();
  const customLookup = (character: string) =>
    Object.fromEntries(
      Object.entries(customElements).map(([name, map]) => {
        return [name, (map[character] ?? []).map((x) => `${name}-${x}`)];
      }),
    );
  // 一字词
  for (const character of characters) {
    // TODO: 支持多个拆分结果
    const shapeInfo =
      customized.get(character) || compoundResults.get(character);
    if (shapeInfo === undefined) continue;
    const final: Assembly[] = [];
    for (const reading of repertoire[character]!.readings) {
      const result: CharacterResult = {
        char: character,
        ...reading,
        ...shapeInfo,
        custom: customLookup(character),
      };
      const elements = func(result, repertoire, extra);
      characterCache.set(character + ":" + reading.pinyin, elements);
      const summary = summarize(elements);
      let isDuplicated = false;
      for (const previous of final) {
        if (summarize(previous.sequence) === summary) {
          previous.importance += result.importance;
          previous.pinyin_list.push(reading.pinyin);
          isDuplicated = true;
          break;
        }
      }
      if (!isDuplicated) {
        final.push({
          name: character,
          sequence: elements,
          importance: result.importance,
          pinyin_list: [reading.pinyin],
        });
      }
    }
    result.push(...final);
  }
  const rules = config.encoder.rules;
  if (!rules) return result;
  const knownWords = new Set();
  // 多字词
  for (const [word, pinyin] of dictionary) {
    const characters = Array.from(word);
    const syllables = pinyin.split(" ");
    let valid = true;
    const totalElements: IndexedElement[][] = [];
    for (const [i, character] of characters.entries()) {
      const pinyin = syllables[i]!;
      // 复用已有的编码
      const hash = character + ":" + pinyin;
      let elements = characterCache.get(hash);
      if (elements !== undefined) {
        totalElements.push(elements);
        continue;
      }
      const shapeInfo =
        customized.get(character) || compoundResults.get(character);
      if (shapeInfo === undefined) {
        valid = false;
        break;
      }
      const result: CharacterResult = {
        char: character,
        pinyin,
        importance: 100,
        ...shapeInfo,
        custom: customLookup(character),
      };
      elements = func(result, repertoire, extra);
      totalElements.push(elements);
    }
    if (!valid) continue;
    const wordElements = gather(totalElements, rules);
    if (wordElements === undefined) continue;
    const hash = word + ":" + summarize(wordElements);
    if (knownWords.has(hash)) continue;
    // 多音的多字词数量很少，所以不再计算分频比例，直接设为 100
    result.push({
      name: word,
      sequence: wordElements,
      importance: 100,
      pinyin_list: [pinyin],
    });
    knownWords.add(hash);
  }
  const priorityMap = getPriorityMap(config.priority);
  return result.map((x) => {
    const hash = `${x.name}-${x.pinyin_list.join(",")}`;
    const level = priorityMap.get(hash);
    return level !== undefined ? { ...x, level } : x;
  });
};

export const stringifySequence = (result: AssemblyResult) => {
  return result.map((x) => {
    return {
      ...x,
      sequence: summarize(x.sequence),
    };
  });
};

export const summarize = (elements: (IndexedElement | undefined)[]) => {
  return elements
    .map((x) => {
      if (x === undefined) return "ε";
      if (typeof x === "string") return x;
      else if (x.index === 0) {
        return x.element;
      } else {
        return `${x.element}.${x.index}`;
      }
    })
    .join(" ");
};

export interface DictEntry {
  name: string;
  full: string;
  full_rank: number;
  short: string;
  short_rank: number;
}

export type EncodeResult = DictEntry[];
