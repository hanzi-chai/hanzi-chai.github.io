import { focusAtom } from "jotai-optics";
import { 键盘原子 } from "./config";
import type { 决策, 决策生成器规则, 决策空间, 变量规则 } from "~/lib";

export const 字母表原子 = focusAtom(键盘原子, (o) =>
  o.prop("alphabet").valueOr("abcdefghijklmnopqrstuvwxyz"),
);

export const 编码类型原子 = focusAtom(键盘原子, (o) =>
  o.prop("mapping_type").valueOr(1),
);

export const 决策原子 = focusAtom(键盘原子, (o) =>
  o.prop("mapping").valueOr({} as 决策),
);

export const 决策空间原子 = focusAtom(键盘原子, (o) =>
  o.prop("mapping_space").valueOr({} as 决策空间),
);

export const 变量规则映射原子 = focusAtom(键盘原子, (o) =>
  o.prop("mapping_variables").valueOr({} as Record<string, 变量规则>),
);

export const 决策生成器配置原子 = focusAtom(键盘原子, (o) =>
  o.prop("mapping_generators").valueOr([] as 决策生成器规则[]),
);
