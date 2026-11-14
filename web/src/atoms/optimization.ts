import { focusAtom } from "jotai-optics";
import { 优化配置原子 } from ".";

export const 目标原子 = focusAtom(优化配置原子, (o) => o.prop("objective"));

export const 求解器原子 = focusAtom(优化配置原子, (o) =>
  o.prop("metaheuristic"),
);

export const 正则化强度原子 = focusAtom(目标原子, (o) =>
  o.prop("regularization_strength"),
);
