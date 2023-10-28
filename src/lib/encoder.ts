import { Condition, Config, Mapping, Op, Source } from "./config";
import { ComponentResult, CompoundResult, getForm } from "./form";
import { renderName, findElement, Extra } from "./element";

export const table: Record<Op, (target?: string, value?: string) => boolean> = {
  是: (t, v) => t === v,
  不是: (t, v) => t !== v,
  匹配: (t, v) => t !== undefined && new RegExp(v!).test(t),
  不匹配: (t, v) => t !== undefined && !new RegExp(v!).test(t),
  存在: (t) => t !== undefined,
  不存在: (t) => t === undefined,
};

type Metadata = { char: string; pinyin: string };
type ComponentTotalResult = ComponentResult & Metadata;
type CompoundTotalResult = CompoundResult & Metadata;
export type TotalResult = ComponentTotalResult | CompoundTotalResult;
export type TotalCache = Record<
  string,
  ComponentTotalResult[] | CompoundTotalResult[]
>;

export type EncoderResult = Record<string, string[]>;

const satisfy = (
  condition: Condition,
  result: TotalResult,
  data: Config["data"],
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
  const totalMapping = Object.assign({}, formMerge, pronMerge);
  return (result: TotalResult, data: Config["data"], extra: Extra) => {
    let node: string | null = "s0";
    const codes = [] as string[];
    while (node) {
      if (node.startsWith("s")) {
        const { object, next, index }: Source = encoder.sources[node];
        if (node !== "s0") {
          const element = findElement(object!, result, data, extra);
          const elementcode = totalMapping[element!] || element!;
          const somecode =
            index === undefined ? elementcode : elementcode[index];
          codes.push(somecode);
        }
        node = next;
      } else {
        const condition: Condition = encoder.conditions[node];
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
  data: Config["data"],
) => {
  const [formResult, extra] = getForm(list, data, form);
  const result = Object.fromEntries(
    list.map((char) => {
      const formData = formResult[char];
      const pronunciationData = data.repertoire[char].pinyin;
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

const encode = (
  encoder: Config["encoder"],
  form: Config["form"],
  pronunciation: Config["pronunciation"],
  characters: string[],
  cache: TotalCache,
  data: Config["data"],
  extra: Extra,
) => {
  const func = compile(encoder, form, pronunciation);
  const result = Object.fromEntries(
    characters.map((char) => [
      char,
      uniquify(cache[char].map((x) => func(x, data, extra))),
    ]),
  );
  return result;
};

export default encode;
