import type { 笔画名称 } from "./classifier.js";

export type N1 = [number];
export type N2 = [number, number];
export type N3 = [number, number, number];
export type N6 = [number, number, number, number, number, number];

/**
 * 一条 SVG 路径命令
 * h, v, c 的含义参见 SVG 规范
 * z 和 c 的含义相同，但是只用于表示平撇、平点、平捺，这是为了区分
 */
export type 绘制 =
  | {
      command: "h" | "v";
      parameterList: N1;
    }
  | {
      command: "c" | "z";
      parameterList: N6;
    }
  | { command: "a"; parameterList: N1 };

export type 向量 = N2;

/**
 * SVG 笔画
 * feature: 笔画的种类
 * start: 笔画的起点
 * curveList: 笔画的命令列表
 */
export interface 矢量笔画数据 {
  feature: 笔画名称;
  start: 向量;
  curveList: 绘制[];
}

/**
 * 引用笔画
 * index: 源字中笔画的索引
 */
export interface 引用笔画数据 {
  feature: "reference";
  index: number;
}

/**
 * SVG 字形是一系列 SVG 笔画的列表
 */
export type 矢量图形数据 = 矢量笔画数据[];

/**
 * 广义的笔画，包括 SVG 笔画和引用笔画
 */
export type 笔画数据 = 矢量笔画数据 | 引用笔画数据;

/**
 * 基本部件 BasicComponent
 * tags: 部件的标签
 * strokes: 部件包含的 SVG 笔画
 */
export interface 基本部件数据 {
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
export interface 衍生部件数据 {
  type: "derived_component";
  tags?: string[];
  source: string;
  strokes: 笔画数据[];
}

/**
 * 拼接部件 SplicedComponent
 * 与复合体相同，但作为部件使用
 */
export interface 拼接部件数据 extends Omit<复合体数据, "type"> {
  type: "spliced_component";
}

/**
 * 部件，包括基本部件和派生部件
 */
export type 部件数据 = 基本部件数据 | 衍生部件数据 | 拼接部件数据;

export const 结构表示符列表 = [
  "⿰",
  "⿱",
  "⿲",
  "⿳",
  "⿴",
  "⿵",
  "⿶",
  "⿷",
  "⿸",
  "⿹",
  "⿺",
  "⿻",
  "⿼",
  "⿽",
  "⿾",
  "⿿",
] as const;

/**
 * 结构表示符
 * 例如 ⿰、⿱ 等
 * 符合 Unicode 中的 Ideography Description Characters
 * 参见 https://en.wikipedia.org/wiki/Ideographic_Description_Characters_(Unicode_block)
 */
export type 结构表示符 = (typeof 结构表示符列表)[number];

/**
 * 笔画块
 * index: 部分的索引
 * strokes: 笔画块包含的笔画数，0 表示该笔画块包含所有剩余的笔画
 */
export interface 笔画块 {
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
export interface 复合体参数 {
  gap2?: number;
  scale2?: number;
  gap3?: number;
  scale3?: number;
}

/**
 * 复合体 Compound
 * operator: 结构表示符
 * operandList: 部分列表，有可能是两部分，也可能是三部分（对于 ⿲、⿳）
 * tags: 复合体的标签
 * order: 笔画块的顺序
 */
export interface 复合体数据 {
  type: "compound";
  operator: 结构表示符;
  operandList: string[];
  tags?: string[];
  order?: 笔画块[];
  parameters?: 复合体参数;
}

/**
 * 全等 Identity
 * source: 全等的源字
 * tags: 全等的标签
 */
export interface 全等数据 {
  type: "identity";
  tags?: string[];
  source: string;
}

/**
 * 一个字形可以是复合体、部件或全等
 */
export type 字形数据 = 部件数据 | 复合体数据 | 全等数据;

/**
 *
 */
export type 约化字形数据 = 基本部件数据 | 复合体数据;

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
  glyphs: 字形数据[];
  ambiguous: boolean;
}

/**
 * 字符 Character
 * 与原始字符相比，省略了 ambiguous 字段，并且将 glyphs 字段替换为唯一的一个 glyph
 * 此时的 glyph 要么是基本部件，要么是复合体
 */
export interface 汉字数据 extends Omit<原始汉字数据, "glyphs" | "ambiguous"> {
  glyphs: 约化字形数据[];
}

/** 原始字库数据，为字符名称到原始字符的映射 */
export type 原始字库数据 = Record<string, 原始汉字数据>;

/** 字库数据，为字符名称到字符的映射 */
export type 字库数据 = Record<string, 汉字数据>;
