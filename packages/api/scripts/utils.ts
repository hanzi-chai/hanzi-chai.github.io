import "dotenv/config";
import type {
  矢量笔画数据,
  结构描述字符,
} from "hanzi-chai";
import { createClient } from "../src/client";

const { get, post, put, del } = createClient(() => {
  return process.env.JWT ?? null;
});

export { get, post, put, del };

// legacy

/**
 * 引用笔画
 * index: 源字中笔画的索引
 */
export interface 旧引用笔画数据 {
  feature: "reference";
  index: number;
}

/**
 * 广义的笔画，包括 SVG 笔画和引用笔画
 */
export type 旧笔画数据 = 矢量笔画数据 | 旧引用笔画数据;

/**
 * 基本部件 BasicComponent
 * tags: 部件的标签
 * strokes: 部件包含的 SVG 笔画
 */
export interface 旧基本部件数据 {
  type: "basic_component";
  tags?: string[];
  strokes: 矢量笔画数据[];
}

/**
 * 派生部件 DerivedComponent
 * tags: 部件的标签
 * source: 部件的源字
 * strokes: 部件包含的 SVG 笔画或引用笔画
 *
 * 引用的笔画的内容需要在渲染时从源字中获取
 */
export interface 旧衍生部件数据 {
  type: "derived_component";
  tags?: string[];
  source: string;
  strokes: 旧笔画数据[];
}

/**
 * 拼接部件 SplicedComponent
 * 与复合体相同，但作为部件使用
 */
export interface 旧拼接部件数据 extends Omit<旧复合体数据, "type"> {
  type: "spliced_component";
}

/**
 * 笔画块
 * index: 部分的索引
 * strokes: 笔画块包含的笔画数，0 表示该笔画块包含所有剩余的笔画
 */
export interface 旧笔画块 {
  index: number;
  strokes: number;
}

/**
 * 复合体的参数
 * gap2: 第二部分复合体和之前的间距
 * scale2: 第二部分复合体的缩放比例
 * gap3: 第三部分复合体和之前的间距
 * scale3: 第三部分复合体的缩放比例
 */
export interface 旧复合体参数 {
  gap2?: number;
  scale2?: number;
  gap3?: number;
  scale3?: number;
}

/**
 * 复合体 Compound
 * operator: 结构描述字符
 * operandList: 部分列表，有可能是两部分，也可能是三部分（对于 ⿲、⿳）
 * tags: 复合体的标签
 * order: 笔画块的顺序
 */
export interface 旧复合体数据 {
  type: "compound";
  tags?: string[];
  operator: 结构描述字符;
  operandList: string[];
  order?: 旧笔画块[];
  parameters?: 旧复合体参数;
}

/**
 * 全等 Identity
 * source: 全等的源字
 * tags: 全等的标签
 */
export interface 旧全等数据 {
  type: "identity";
  tags?: string[];
  source: string;
}

/**
 * 一个字形可以是复合体、部件或全等
 */
export type 字形描述 =
  | 旧基本部件数据
  | 旧衍生部件数据
  | 旧拼接部件数据
  | 旧复合体数据
  | 旧全等数据;

/**
 * 原始字符 PrimitiveCharacter
 * unicode: 字符的 Unicode 编码
 * tygf: 字符在通用规范汉字集中的类型，0 为不存在，1 为一级字，2 为二级字，3 为三级字
 * gb2312: 字符在 GB2312 中的类型，0 为不存在，1 为一级字，2 为二级字
 * name: 字符的别名（当字符是 PUA 时，这个别名会用来在界面上渲染）
 * gf0014_id: 字符在 GF0014-2009 中的编号
 * gf3001_id: 字符在 GF3001-1997 中的编号
 * glyphs: 字符的字形列表，其中每一个有可能是基本部件、派生部件或复合体
 * ambiguous: 字符是否有分部歧义
 */
export interface 原始汉字数据 {
  unicode: number;
  tygf: 0 | 1 | 2 | 3;
  gb2312: 0 | 1 | 2;
  name: string | null;
  gf0014_id: number | null;
  gf3001_id: number | null;
  glyphs: 字形描述[];
  ambiguous: boolean;
}

export type 原始字库数据 = Record<string, 原始汉字数据>;

export function listToObject<T extends { unicode: number }>(list: T[]) {
  return Object.fromEntries(
    list.map((x) => [String.fromCodePoint(x.unicode), x]),
  );
}

const charToCode = (char: string) => char.codePointAt(0)!;

const glyphReverse = (c: 字形描述) => {
  if (c.type === "basic_component") {
    return c;
  } else if (c.type === "derived_component" || c.type === "identity") {
    return { ...c, source: charToCode(c.source as any) };
  } else {
    return { ...c, operandList: c.operandList.map(charToCode as any) };
  }
};

export function toModel(character: 原始汉字数据) {
  return {
    ...character,
    glyphs: JSON.stringify(character.glyphs.map(glyphReverse)),
    ambiguous: +character.ambiguous as 0 | 1,
  };
}

export interface 旧衍生部件模型 {
  type: "derived_component";
  tags?: string[];
  source: number;
  strokes: 旧笔画数据[];
}

export interface 旧拼接部件模型 {
  type: "spliced_component";
  operator: 结构描述字符;
  operandList: number[];
  tags?: string[];
  order?: 旧笔画块[];
  parameters?: 旧复合体参数;
}

export interface 旧复合体模型 {
  type: "compound";
  operator: 结构描述字符;
  operandList: number[];
  tags?: string[];
  order?: 旧笔画块[];
  parameters?: 旧复合体参数;
}

export interface 旧全等模型 {
  type: "identity";
  tags?: string[];
  source: number;
}

export type 旧字形数据模型 = 旧基本部件数据
  | 旧衍生部件模型
  | 旧拼接部件模型 | 旧复合体模型 | 旧全等模型;

export interface 原始命名汉字数据 extends Omit<原始汉字数据, "unicode"> {
  name: string;
}

export interface 原始汉字模型 {
  unicode: number;
  tygf: 0 | 1 | 2 | 3;
  gb2312: 0 | 1 | 2;
  glyphs: string; // JSON 字符串
  name: string | null;
  gf0014_id: number | null;
  gf3001_id: number | null;
  ambiguous: 0 | 1;
}