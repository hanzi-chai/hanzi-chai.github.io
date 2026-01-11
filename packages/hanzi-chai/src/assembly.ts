import {
  isMerge,
  Mapping,
  Value,
  type Algebra,
  type Condition,
  type EncoderConfig,
  type Keyboard,
  type Op,
  type Source,
  type WordRule,
} from "./config.js";
import type { 部件分析 } from "./component.js";
import type { 复合体分析 } from "./compound.js";
import type { Extra } from "./element.js";
import { findElement } from "./element.js";
import type { AnalysisResult } from "./repertoire.js";
import type { CustomElementMap, IndexedElement } from "./utils.js";
import type { 拼音分析结果 } from "./pinyin.js";

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
export type CharacterResult = (部件分析 | 复合体分析) & {
  汉字: string;
  拼写运算: Map<string, string>;
  自定义元素: Record<string, string[]>;
};

export interface 组装 {
  词: string;
  拼音列表: string[];
  元素序列: IndexedElement[];
  频率: number;
  简码级别?: number;
}

export type 组装结果 = 组装[];

class 取码器 {
  private totalMapping: Record<string, string> = {};

  constructor(
    private keyboard: Keyboard,
    private encoder: EncoderConfig,
  ) {
    const { mapping } = keyboard;
    for (const [element, value] of Object.entries(mapping)) {
      this.totalMapping[element] = this.getValue(mapping, value!);
    }
  }

  getValue(mapping: Mapping, value: Exclude<Value, null>): string {
    if (isMerge(value)) {
      const newValue = mapping[value.element]!;
      return this.getValue(mapping, newValue);
    } else if (Array.isArray(value)) {
      const parts = [];
      for (const part of value) {
        if (typeof part === "string") {
          parts.push(part);
        } else {
          parts.push(this.getValue(mapping, part.element)[part.index]!);
        }
      }
      return parts.join("");
    } else {
      return value;
    }
  }

  取码(result: CharacterResult, extra: Extra) {
    const { mapping } = this.keyboard;
    const alphabet = this.keyboard.alphabet ?? "";
    let node: string | null = "s0";
    const codes = [] as IndexedElement[];
    while (node) {
      if (node.startsWith("s")) {
        const source: Source = this.encoder.sources[node]!;
        const { object, next, index } = source;
        if (node !== "s0") {
          const element = findElement(object!, result, extra);
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
          let mapped = mapping[element];
          let groupedElement = element;
          if (mapped === undefined) {
            node = next;
            continue;
          }
          while (isMerge(mapped)) {
            groupedElement = mapped.element;
            mapped = mapping[mapped.element]!;
          }
          if (index === undefined) {
            // 如果没有定义指标，就是全取
            for (const [index, key] of Array.from(mapped).entries()) {
              codes.push({ element: groupedElement, index });
            }
          } else {
            // 检查指标是否有效
            const key = mapped[index];
            if (key !== undefined) {
              codes.push({ element: groupedElement, index });
            }
          }
        }
        node = next;
      } else {
        const condition: Condition = this.encoder.conditions[node]!;
        if (this.满足(condition, result, extra)) {
          node = condition.positive;
        } else {
          node = condition.negative;
        }
      }
    }
    return codes.slice(0, this.encoder.max_length ?? codes.length);
  }

  /**
   * 给定一个条件，判断是否满足
   *
   * @param condition - 条件
   * @param result - 中间结果
   * @param config - 配置
   * @param extra - 额外信息
   * @param totalMapping - 映射
   */
  满足(condition: Condition, result: CharacterResult, extra: Extra) {
    const { object, operator } = condition;
    const target = findElement(object, result, extra);
    const fn = table[operator];
    if ("value" in condition) {
      return fn(target, condition.value, this.totalMapping);
    }
    return fn(target, null, this.totalMapping);
  }
}

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
        if (elements === undefined) continue;
        const element = signedIndex(elements, elementIndex);
        if (element === undefined) continue;
        result.push(element);
      }
      break;
    }
  }
  if (matched) return result;
};

export interface AssembleConfig {
  encoder: EncoderConfig;
  keyboard: Keyboard;
  algebra: Algebra;
  priority: [string, string, number][];
}

export interface 汇编器 {
  汇编(
    拼音分析结果: 拼音分析结果,
    字形分析结果: AnalysisResult,
    频率: Map<string, number>,
  ): 组装结果;
}

export class 默认汇编器 implements 汇编器 {
  static readonly type = "默认";
  private config: AssembleConfig;
  private customElements: Map<string, Record<string, string[]>>;

  constructor(
    config: AssembleConfig,
    customElements: Record<string, CustomElementMap>,
  ) {
    this.config = config;
    this.customElements = new Map();
    for (const [name, map] of Object.entries(customElements)) {
      for (const [character, elements] of Object.entries(map)) {
        const existing = this.customElements.get(character) ?? {};
        existing[name] = elements;
        this.customElements.set(character, existing);
      }
    }
  }

  /**
   * 给定一个拆分结果，返回所有可能的编码
   *
   * @param 拼音分析结果 - 拼音分析结果
   * @param 字形分析结果 - 字形分析结果
   * @param 频率 - 频率映射
   *
   * @returns 组装结果
   */
  汇编(
    拼音分析结果: 拼音分析结果,
    字形分析结果: AnalysisResult,
    频率: Map<string, number>,
  ) {
    const { customized, compoundResults } = 字形分析结果;
    const extra = { rootSequence: 字形分析结果.rootSequence };
    const finder = new 取码器(this.config.keyboard, this.config.encoder);
    const 汇编结果: 组装结果 = [];
    const 单字元素缓存 = new Map<string, IndexedElement[]>();
    // 用于给一字词去重
    const indexMap = new Map<string, number[]>();
    // 一字词
    for (const { 词, 拼音, 拼写运算 } of 拼音分析结果.一字词) {
      const 键 = `${词}:${拼音}`;
      const frequency = 频率.get(键) ?? 0;
      // TODO: 支持多个拆分结果
      const shapeInfo = customized.get(词) || compoundResults.get(词);
      if (shapeInfo === undefined) continue;
      const result: CharacterResult = {
        汉字: 词,
        拼写运算,
        ...shapeInfo,
        自定义元素: this.customElements.get(词) || {},
      };
      const elements = finder.取码(result, extra);
      单字元素缓存.set(键, elements);
      const summary = summarize(elements);
      let isDuplicated = false;
      for (const previousIndex of indexMap.get(词) ?? []) {
        const previous = 汇编结果[previousIndex]!;
        if (summarize(previous.元素序列) === summary) {
          previous.频率 += frequency;
          previous.拼音列表.push(拼音);
          isDuplicated = true;
          break;
        }
      }
      if (!isDuplicated) {
        汇编结果.push({
          词: 词,
          元素序列: elements,
          频率: frequency,
          拼音列表: [拼音],
        });
        const list = indexMap.get(词) ?? [];
        list.push(汇编结果.length - 1);
        indexMap.set(词, list);
      }
    }
    const rules = this.config.encoder.rules;
    if (!rules) return 汇编结果;
    // 多字词
    for (const { 词, 拼音, 拼写运算 } of 拼音分析结果.多字词) {
      const 键 = `${词}:${拼音.join(" ")}`;
      const frequency = 频率.get(键) ?? 0;
      const characters = Array.from(词);
      let valid = true;
      const totalElements: IndexedElement[][] = [];
      for (const [i, character] of characters.entries()) {
        const pinyin = 拼音[i]!;
        // 复用已有的编码
        const hash = `${character}:${pinyin}`;
        let elements = 单字元素缓存.get(hash);
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
          汉字: character,
          拼写运算: 拼写运算[i]!,
          ...shapeInfo,
          自定义元素: this.customElements.get(character) || {},
        };
        elements = finder.取码(result, extra);
        totalElements.push(elements);
      }
      if (!valid) continue;
      const wordElements = gather(totalElements, rules);
      if (wordElements === undefined) continue;
      // 多音的多字词数量很少，所以不再计算分频比例，直接设为 100
      汇编结果.push({
        词: 词,
        元素序列: wordElements,
        频率: frequency,
        拼音列表: [拼音.join(" ")],
      });
    }
    const priorityMap = getPriorityMap(this.config.priority);
    return 汇编结果.map((x) => {
      const hash = `${x.词}-${x.拼音列表.join(",")}`;
      const level = priorityMap.get(hash);
      return level !== undefined ? { ...x, 简码级别: level } : x;
    });
  }
}

export const stringifySequence = (result: 组装结果) => {
  return result.map((x) => {
    return { ...x, sequence: summarize(x.元素序列) };
  });
};

export const summarize = (elements: (IndexedElement | undefined)[]) => {
  return elements
    .map((x) => {
      if (x === undefined) return "ε";
      if (typeof x === "string") return x;
      if (x.index === 0) {
        return x.element;
      }
      return `${x.element}.${x.index}`;
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
