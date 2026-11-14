import type {
  基本字形数据,
  字形拼写运算,
  字符数据,
  字符数据补丁,
  字集指示,
} from "hanzi-chai";
import { focusAtom } from "jotai-optics";
import { 数据配置原子 } from ".";

export const 字集指示原子 = focusAtom(数据配置原子, (o) =>
  o.prop("character_set").valueOr("general" as 字集指示),
);

export const 用户字符列表原子 = focusAtom(数据配置原子, (o) =>
  o.prop("characters").valueOr([] as 字符数据[]),
);

export const 用户字形列表原子 = focusAtom(数据配置原子, (o) =>
  o.prop("glyphs").valueOr([] as 基本字形数据[]),
);

export const 字形自定义原子 = focusAtom(数据配置原子, (o) =>
  o.prop("character_customization").valueOr({} as Record<string, 字符数据补丁[]>),
);

export const 字形拼写运算列表原子 = focusAtom(数据配置原子, (o) =>
  o.prop("glyph_algebra").valueOr([] as 字形拼写运算[]),
);

export const 字形来源列表原子 = focusAtom(数据配置原子, (o) =>
  o.prop("glyph_sources").valueOr(["G"]),
);
