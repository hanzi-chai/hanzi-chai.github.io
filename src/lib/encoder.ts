import type {
  BinaryCondition,
  Condition,
  Config,
  Grouping,
  Mapping,
  MergedData,
  Op,
  Source,
} from "./config";
import type { ComponentResult } from "./component";
import type { CompoundResult } from "./compound";
import { getForm } from "./form";
import type { Extra } from "./element";
import { findElement } from "./element";
import { Character } from "./data";

export const filtervalues = ["是", "否", "未定义"] as const;
export type CharsetFilter = (typeof filtervalues)[number];
export const filtermap: Record<
  CharsetFilter,
  (s: "gb2312" | "tygf") => (t: [string, Character]) => boolean
> = {
  是:
    (s) =>
    ([, c]) =>
      !!c[s],
  否:
    (s) =>
    ([, c]) =>
      !c[s],
  未定义: () => () => true,
};

export const table: Record<
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

interface Metadata {
  char: string;
  pinyin: string;
}
type ComponentTotalResult = ComponentResult & Metadata;
type CompoundTotalResult = CompoundResult & Metadata;
export type TotalResult = ComponentTotalResult | CompoundTotalResult;
export type TotalCache = Record<
  string,
  ComponentTotalResult[] | CompoundTotalResult[]
>;

export type EncoderResult = Map<
  string,
  {
    code: string[];
    sequence: IndexedElement[][];
  }
>;

const satisfy = (
  condition: Condition,
  result: TotalResult,
  config: Config,
  extra: Extra,
  totalMapping: Record<string, string>,
) => {
  const { object, operator } = condition;
  const target = findElement(object, result, config, extra);
  const fn = table[operator];
  return fn(target, (condition as BinaryCondition).value, totalMapping);
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

const compile = (config: Config) => {
  const { mapping, grouping } = config.form;
  const totalMapping = merge(mapping, grouping);
  return (result: TotalResult, data: MergedData, extra: Extra) => {
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
          const groupedElement = grouping[element] || element;
          const mappedElement = mapping[groupedElement];
          if (mappedElement === undefined) {
            node = next;
            continue;
          }
          if (mappedElement.length === 1) {
            // 对于单码根，单独判断一下，可以省略 ".0"
            if (index === undefined || index === 0) {
              codes.push(groupedElement);
            }
          } else if (index === undefined) {
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

export const getCache = (
  list: string[],
  form: Config["form"],
  data: MergedData,
) => {
  const [formResult, extra] = getForm(list, data, form);
  const result = Object.fromEntries(
    list.map((char) => {
      const formData = formResult.get(char)!;
      const pronunciationData = data.repertoire[char]!.pinyin;
      return [
        char,
        formData
          .map((x) =>
            pronunciationData.map((pinyin) => ({
              char,
              pinyin,
              ...x,
            })),
          )
          .flat() as TotalResult[],
      ];
    }),
  );
  return [result, extra] as const;
};

export const uniquify = (l: string[]) => [...new Set(l)].sort();

export const collect = (
  config: Config,
  characters: string[],
  data: MergedData,
) => {
  const [cache, extra] = getCache(characters, config.form, data);
  const func = compile(config);
  const result = new Map(
    characters.map((char) => [
      char,
      cache[char]!.map((x) => func(x, data, extra)),
    ]),
  );
  return result;
};

export const autoSplit = (collection: Map<string, IndexedElement[][]>) => {
  const tsv = [...collection]
    .filter(([, code]) => code.length >= 1)
    .map(([char, elements_list]) => {
      // 目前只支持一种拆分
      const elements = elements_list[0]!;
      const summary = elements
        .map((x) => {
          if (typeof x === "string") return x;
          else {
            return `${x.element}.${x.index}`;
          }
        })
        .join(" ");
      return [char, summary] as [string, string];
    });
  return tsv;
};

const encode = (config: Config, characters: string[], data: MergedData) => {
  const characterElements = collect(config, characters, data);
  const { encoder } = config;
  const process = (elements: IndexedElement[]) => {
    const code = elements
      .map((e) =>
        typeof e === "string"
          ? config.form.mapping[e]!
          : config.form.mapping[e.element]![e.index]!,
      )
      .join("");
    return encoder.max_length ? code.slice(0, encoder.max_length) : code;
  };
  const result = new Map(
    [...characterElements].map(([char, elements_list]) => [
      char,
      {
        sequence: elements_list,
        code: uniquify(elements_list.map((elements) => process(elements))),
      },
    ]),
  );
  return result;
};

export default encode;
