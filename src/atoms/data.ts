import { 数据配置原子 } from ".";
import { focusAtom } from "jotai-optics";
import type { 原始字库数据, 变换器, 兼容字形自定义, 字集指示 } from "~/lib";

export const 用户原始字库数据原子 = focusAtom(数据配置原子, (o) =>
  o.prop("repertoire").valueOr({} as 原始字库数据),
);

export const 字集指示原子 = focusAtom(数据配置原子, (o) =>
  o.prop("character_set").valueOr("general" as 字集指示),
);

export const 字形自定义原子 = focusAtom(数据配置原子, (o) =>
  o.prop("glyph_customization").valueOr({} as 兼容字形自定义),
);

export const 变换器列表原子 = focusAtom(数据配置原子, (o) =>
  o.prop("transformers").valueOr([] as 变换器[]),
);
