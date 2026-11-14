import {
  type 优先简码,
  type 构词规则,
  type 简码规则,
  获取默认目标,
  type 部分目标类型,
} from "hanzi-chai";
import { focusAtom } from "jotai-optics";
import { atom, 编码配置原子 } from ".";

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

export const 默认目标原子 = atom((get) => 获取默认目标(get(编码配置原子)));

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
