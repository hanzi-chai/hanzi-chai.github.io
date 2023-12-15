import {
  ComponentCache,
  ComponentResult,
  disassembleComponents,
  recursiveGetSequence,
} from "./component";
import { disassembleCompounds } from "./compound";
import type { FormConfig, MergedData } from "./config";
import type { Extra } from "./element";

export const getFormCore = (data: MergedData, config: FormConfig) => {
  const [componentCache, componentError] = disassembleComponents(data, config);
  const customizations: ComponentCache = new Map(
    Object.entries(config?.analysis?.customize ?? {}).map(
      ([component, sequence]) => {
        const pseudoResult: ComponentResult = { sequence: sequence };
        return [component, pseudoResult] as const;
      },
    ),
  );
  const customized = new Map([...componentCache, ...customizations]);
  const [compoundCache, compoundError] = disassembleCompounds(
    data,
    config,
    customized,
  );
  return {
    componentCache,
    componentError,
    customizations,
    customized,
    compoundCache,
    compoundError,
  };
};

const getExtra = function (data: MergedData, config: FormConfig): Extra {
  const { form, classifier } = data;
  const { mapping, grouping } = config;
  const roots = Object.keys(mapping).concat(Object.keys(grouping));
  const findSequence = (x: string) => {
    if (form[x] === undefined) {
      // 单笔画
      return [Number(x)];
    }
    const sequence = recursiveGetSequence(form, classifier, x);
    if (sequence instanceof Error) {
      return [];
    }
    return sequence;
  };
  const rootSequence = Object.fromEntries(
    roots.map((x) => [x, findSequence(x)]),
  );
  return {
    rootSequence,
  };
};

export const getForm = (
  list: string[],
  data: MergedData,
  config: FormConfig,
) => {
  const extra = getExtra(data, config);
  const { customized, compoundCache } = getFormCore(data, config);
  const value = new Map(
    list.map((char) => {
      const result = customized.get(char) || compoundCache.get(char);
      // 这里只处理一种情况，未来可以返回多个拆分
      return result === undefined ? [char, []] : [char, [result]];
    }),
  );
  return [value, extra] as const;
};
