import { atom } from "jotai";
import { focusAtom } from "jotai-optics";
import { type 分析配置, 合并分类器, type 笔画名称, type 退化配置 } from "~/lib";
import { 分析配置原子 } from "./config";

export const 退化配置原子 = focusAtom(分析配置原子, (o) =>
  o.prop("degenerator").valueOr({} as 退化配置),
);

export const 笔画归并原子 = focusAtom(退化配置原子, (o) =>
  o.prop("feature").valueOr({} as NonNullable<退化配置["feature"]>),
);

export const 相交不拆原子 = focusAtom(退化配置原子, (o) =>
  o.prop("no_cross").valueOr(false),
);

export const 过滤器列表原子 = focusAtom(分析配置原子, (o) =>
  o.prop("selector").valueOr([] as string[]),
);

export const 强字根原子 = focusAtom(分析配置原子, (o) =>
  o.prop("strong").valueOr([] as string[]),
);

export const 弱字根原子 = focusAtom(分析配置原子, (o) =>
  o.prop("weak").valueOr([] as string[]),
);

export const 自定义拆分原子 = focusAtom(分析配置原子, (o) =>
  o.prop("customize").valueOr({} as NonNullable<分析配置["customize"]>),
);

export const 动态自定义拆分原子 = focusAtom(分析配置原子, (o) =>
  o
    .prop("dynamic_customize")
    .valueOr({} as NonNullable<分析配置["dynamic_customize"]>),
);

export const 分类器自定义原子 = focusAtom(分析配置原子, (o) =>
  o.prop("classifier").valueOr({} as Record<笔画名称, number>),
);

export const 分类器原子 = atom((get) => {
  const customization = get(分类器自定义原子);
  return 合并分类器(customization);
});
