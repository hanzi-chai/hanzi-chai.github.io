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

export const table: Record<Op, (target?: string, value?: string) => boolean> = {
  是: (t, v) => t === v,
  不是: (t, v) => t !== v,
  匹配: (t, v) => t !== undefined && new RegExp(v!).test(t),
  不匹配: (t, v) => t !== undefined && !new RegExp(v!).test(t),
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
) => {
  const { object, operator, value } = condition;
  const target = findElement(object, result, data, extra);
  const fn = table[operator];
  return fn(target, value);
};

const merge = (grouping: Mapping, mapping: Mapping) => {
  const compiledGrouping = Object.fromEntries(
    Object.entries(grouping).map(([x, y]) => [x, mapping[y]]),
  );
  return Object.assign(compiledGrouping, mapping);
};

const compile = (
  encoder: Config["encoder"],
  form: Config["form"],
  pronunciation: Config["pronunciation"],
) => {
  const formMerge = merge(form.grouping, form.mapping);
  const pronMerge = pronunciation
    ? merge(pronunciation.grouping, pronunciation.mapping)
    : {};
  const totalMapping = { ...formMerge, ...pronMerge };
  return (result: TotalResult, data: MergedData, extra: Extra) => {
    let node: string | null = "s0";
    const codes = [] as string[];
    while (node) {
      if (node.startsWith("s")) {
        const { object, next, index }: Source = encoder.sources[node]!;
        if (node !== "s0") {
          const element = findElement(object!, result, data, extra);
          const elementcode = totalMapping[element!] || element!;
          const somecode =
            index === undefined ? elementcode : elementcode[index]!;
          codes.push(somecode);
        }
        node = next;
      } else {
        const condition: Condition = encoder.conditions[node]!;
        if (satisfy(condition, result, data, extra)) {
          node = condition.positive;
        } else {
          node = condition.negative;
        }
      }
    }
    return codes.join("");
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

const encode = (config: Config, characters: string[], data: MergedData) => {
  const { form, pronunciation, encoder } = config;
  const [cache, extra] = getCache(characters, form, data);
  const func = compile(encoder, form, pronunciation);
  const result = new Map(
    characters.map((char) => [
      char,
      uniquify(cache[char]!.map((x) => func(x, data, extra))),
    ]),
  );
  return result;
};

export default encode;
