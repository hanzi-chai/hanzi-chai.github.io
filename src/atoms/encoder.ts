import { focusAtom } from "jotai-optics";
import { atom, 编码配置原子 } from ".";
import type {
  优先简码,
  构词规则,
  目标配置,
  码长权重,
  简码规则,
  部分权重,
  部分目标类型,
} from "~/lib";
import { range } from "lodash-es";

export const 最大码长原子 = focusAtom(编码配置原子, (o) =>
  o.prop("max_length"),
);

export const 自动上屏长度原子 = focusAtom(编码配置原子, (o) =>
  o.prop("auto_select_length"),
);

export const 自动上屏模式原子 = focusAtom(编码配置原子, (o) =>
  o.prop("auto_select_pattern"),
);

export const 选择键原子 = focusAtom(编码配置原子, (o) =>
  o.prop("select_keys").valueOr([] as string[]),
);

export const 简码配置原子 = focusAtom(编码配置原子, (o) =>
  o.prop("short_code").valueOr([] as 简码规则[]),
);

export const 构词配置原子 = focusAtom(编码配置原子, (o) =>
  o.prop("rules").valueOr([] as 构词规则[]),
);

export const 优先简码原子 = focusAtom(编码配置原子, (o) =>
  o.prop("short_code_list").valueOr([] as 优先简码[]),
);

export const 源映射原子 = focusAtom(编码配置原子, (o) => o.prop("sources"));

export const 条件映射原子 = focusAtom(编码配置原子, (o) =>
  o.prop("conditions"),
);

export const 组装器原子 = focusAtom(编码配置原子, (o) =>
  o.prop("assembler").valueOr("默认"),
);

const isMulti = (s: 简码规则) => {
  if ("length_equal" in s) {
    return s.length_equal > 1;
  }
  return s.length_in_range[1] > 1;
};

const makeTier = (top: number, levelWeights: 码长权重[]) => ({
  top: top === 0 ? undefined : top,
  duplication: 1,
  levels: levelWeights,
  fingering: [1, 1, 1, 1, 1, 1, null, null],
});

export const 默认目标原子 = atom((get) => {
  const wordRules = get(构词配置原子);
  const shortCodeConfig = get(简码配置原子);
  const maxLength = get(最大码长原子);
  const levelWeights: 码长权重[] = range(1, maxLength + 1).map((i) => ({
    length: i,
    frequency: 1,
  }));
  const partialObjective: 部分权重 = {
    duplication: 1,
    key_distribution: 1,
    pair_equivalence: 1,
    fingering: [1, 1, 1, 1, 1, 1, null, null],
    levels: levelWeights,
  };
  const p1 = {
    ...partialObjective,
    tiers: [300, 500, 1500, 3000, 4500, 6000, 0].map((x) =>
      makeTier(x, levelWeights),
    ),
  };
  const p2 = {
    ...partialObjective,
    tiers: [2000, 5000, 10000, 20000, 40000, 60000, 0].map((x) =>
      makeTier(x, levelWeights),
    ),
  };
  const objective: 目标配置 = {
    characters_full: p1,
  };
  if (wordRules.length > 0) {
    objective.words_full = p2;
  }
  if (shortCodeConfig.length > 0) {
    objective.characters_short = p1;
    if (wordRules.length > 0 && shortCodeConfig.some(isMulti)) {
      objective.words_short = p2;
    }
  }
  return objective;
});

export const 默认目标类型原子 = atom((get) => {
  const objective = get(默认目标原子);
  return Object.keys(objective) as 部分目标类型[];
});

export const 部分目标类型名称映射: Record<部分目标类型, string> = {
  characters_full: "一字全码",
  characters_short: "一字简码",
  words_full: "多字全码",
  words_short: "多字简码",
};
