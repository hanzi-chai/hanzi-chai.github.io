import type {
  BinaryCondition,
  Condition,
  Config,
  Grouping,
  Mapping,
  Op,
  Source,
} from "./config";
import type { ComponentAnalysis } from "./component";
import { recursiveRenderCompound, type CompoundAnalysis } from "./compound";
import type { Extra } from "./element";
import { findElement } from "./element";
import { Repertoire } from "./data";
import { AnalysisResult, analysis } from "./repertoire";
import { mergeClassifier } from "./classifier";

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
};

/**
 * 给定一个条件，判断是否满足
 *
 * @param condition 条件
 * @param result 中间结果
 * @param config 配置
 * @param extra 额外信息
 * @param totalMapping 映射
 */
const satisfy = (
  condition: Condition,
  result: CharacterResult,
  config: Config,
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
export type AssemblyResult = Map<string, IndexedElement[][]>;

const compile = (config: Config) => {
  const { mapping, grouping, alphabet } = config.form;
  const totalMapping = merge(mapping, grouping);
  return (result: CharacterResult, data: Repertoire, extra: Extra) => {
    let node: string | null = "s0";
    const codes = [] as IndexedElement[];
    while (node) {
      if (node.startsWith("s")) {
        const { object, next, index }: Source = config.encoder.sources[node]!;
        if (node !== "s0") {
          const element = findElement(object!, result, config, extra);
          // 检查元素或键位是否有效
          if (element === undefined) {
            node = next;
            continue;
          }
          if (element.length === 1 && alphabet.includes(element)) {
            codes.push(element);
            continue;
          }
          const groupedElement = grouping[element] || element;
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
        const condition: Condition = config.encoder.conditions[node]!;
        if (satisfy(condition, result, config, extra, totalMapping)) {
          node = condition.positive;
        } else {
          node = condition.negative;
        }
      }
    }
    return codes.slice(0, config.encoder.max_length ?? codes.length);
  };
};

const extraAnalysis = function (repertoire: Repertoire, config: Config): Extra {
  const { mapping, grouping } = config.form;
  const classifier = mergeClassifier(config.analysis?.classifier);
  const findSequence = (x: string) => {
    if (x.match(/[0-9]+/)) {
      return [...x].map(Number);
    }
    const glyph = repertoire[x]?.glyph;
    if (glyph === undefined) {
      return [];
    }
    if (glyph.type === "basic_component") {
      return glyph.strokes.map((s) => classifier[s.feature]);
    } else {
      const sequence = recursiveRenderCompound(glyph, repertoire);
      if (sequence instanceof Error) return [];
      return sequence.map((s) => classifier[s.feature]);
    }
  };
  const rootSequence = new Map<string, number[]>();
  const roots = Object.keys(mapping).concat(Object.keys(grouping));
  for (const root of roots) {
    rootSequence.set(root, findSequence(root));
  }
  return {
    rootSequence,
  };
};

/**
 * 给定一个拆分结果，返回所有可能的编码
 *
 * @param repertoire 字符集
 * @param config 配置
 * @param characters 需要编码的汉字列表
 * @param analysisResult 分析结果
 *
 * @returns 组装结果
 */
export const assemble = (
  repertoire: Repertoire,
  config: Config,
  characters: string[],
  analysisResult: AnalysisResult,
) => {
  const { customized, compoundResults } = analysisResult;
  const extra = extraAnalysis(repertoire, config);
  const func = compile(config);
  const result: AssemblyResult = new Map(
    characters.map((char) => {
      // TODO: 支持多个拆分结果
      const shapeInfo: ComponentAnalysis | CompoundAnalysis | undefined =
        customized.get(char) || compoundResults.get(char);
      if (shapeInfo === undefined) return [char, []];
      const readings = repertoire[char]!.readings;
      const total: CharacterResult[] = readings.map((pinyin) => ({
        char,
        pinyin,
        ...shapeInfo,
      }));
      const final = total.map((x) => func(x, repertoire, extra));
      return [char, final];
    }),
  );
  return result;
};

export const getTSV = (collection: AssemblyResult) => {
  const tsv = [...collection]
    .filter(([, code]) => code.length >= 1)
    .map(([char, elements_list]) => {
      // 目前只支持一种拆分
      const elements = elements_list[0]!;
      const summary = elements
        .map((x) => {
          if (typeof x === "string") return x;
          else if (x.index === 0) {
            return x.element;
          } else {
            return `${x.element}.${x.index}`;
          }
        })
        .join(" ");
      return [char, summary] as [string, string];
    });
  return tsv;
};
