import type {
  Condition,
  Config,
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

export const table: Record<
  Op,
  (
    target: string | undefined,
    value: string | undefined,
    totalMapping: Mapping,
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

export type EncoderResult = Map<string, string[]>;

const satisfy = (
  condition: Condition,
  result: TotalResult,
  data: MergedData,
  extra: Extra,
  totalMapping: Mapping,
) => {
  const { object, operator, value } = condition;
  const target = findElement(object, result, data, extra);
  const fn = table[operator];
  return fn(target, value, totalMapping);
};

const merge = (grouping: Mapping, mapping: Mapping) => {
  const compiledGrouping = Object.fromEntries(
    Object.entries(grouping).map(([x, y]) => [x, mapping[y]]),
  );
  return Object.assign(compiledGrouping, mapping);
};

type IndexedElement = string | { element: string; index: number };

const compile = (encoder: Config["encoder"], totalMapping: Mapping) => {
  return (result: TotalResult, data: MergedData, extra: Extra) => {
    let node: string | null = "s0";
    const codes = [] as IndexedElement[];
    while (node) {
      if (node.startsWith("s")) {
        const { object, next, index }: Source = encoder.sources[node]!;
        if (node !== "s0") {
          const element = findElement(object!, result, data, extra);
          if (element === undefined) {
            node = next;
            continue;
          }
          const mappedElement = totalMapping[element];
          if (mappedElement === undefined || mappedElement.length === 1) {
            // 对于字面量和单码根，总是输出常规映射
            codes.push(element);
          } else if (index === undefined) {
            for (let index = 0; index != mappedElement.length; ++index) {
              codes.push({ element, index });
            }
          } else {
            codes.push({ element, index });
          }
        }
        node = next;
      } else {
        const condition: Condition = encoder.conditions[node]!;
        if (satisfy(condition, result, data, extra, totalMapping)) {
          node = condition.positive;
        } else {
          node = condition.negative;
        }
      }
    }
    return codes;
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

const uniquify = (l: string[]) => [...new Set(l)].sort();

export const collect = (
  config: Config,
  characters: string[],
  data: MergedData,
) => {
  const { form, encoder } = config;
  const totalMapping = getTotalMapping(config);
  const [cache, extra] = getCache(characters, form, data);
  const func = compile(encoder, totalMapping);
  const result = new Map(
    characters.map((char) => [
      char,
      cache[char]!.map((x) => func(x, data, extra)),
    ]),
  );
  return result;
};

const getTotalMapping = (config: Config) => {
  const { form, pronunciation } = config;
  const formMerge = merge(form.grouping, form.mapping);
  const pronMerge = pronunciation
    ? merge(pronunciation.grouping, pronunciation.mapping)
    : {};
  const totalMapping = { ...formMerge, ...pronMerge };
  return totalMapping;
};

const encode = (config: Config, characters: string[], data: MergedData) => {
  const totalMapping = getTotalMapping(config);
  const characterElements = collect(config, characters, data);
  const { encoder } = config;
  const process = (elements: IndexedElement[]) => {
    const code = elements
      .map((e) =>
        typeof e === "string"
          ? totalMapping[e] || e
          : totalMapping[e.element]![e.index]!,
      )
      .join("");
    return encoder.maxlength ? code.slice(0, encoder.maxlength) : code;
  };
  const result = new Map(
    [...characterElements].map(([char, elements_list]) => [
      char,
      uniquify(elements_list.map((elements) => process(elements))),
    ]),
  );
  return result;
};

export default encode;
