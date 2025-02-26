import type { BoundingBox } from "./bezier";
import type { Feature } from "./classifier";

export type N1 = [number];
export type N2 = [number, number];
export type N3 = [number, number, number];
export type N6 = [number, number, number, number, number, number];

/**
 * 一条 SVG 路径命令
 * h, v, c 的含义参见 SVG 规范
 * z 和 c 的含义相同，但是只用于表示平撇、平点、平捺，这是为了区分
 */
export type Draw =
  | {
      command: "h" | "v";
      parameterList: N1;
    }
  | {
      command: "c" | "z";
      parameterList: N6;
    };

export type Point = N2;

/**
 * SVG 笔画
 * feature: 笔画的种类
 * start: 笔画的起点
 * curveList: 笔画的命令列表
 */
export interface SVGStroke {
  feature: Feature;
  start: Point;
  curveList: Draw[];
}

/**
 * 引用笔画
 * index: 源字中笔画的索引
 */
export interface ReferenceStroke {
  feature: "reference";
  index: number;
}

/**
 * SVG 字形是一系列 SVG 笔画的列表
 */
export type SVGGlyph = SVGStroke[];

export interface SVGGlyphWithBox {
  strokes: SVGGlyph;
  box: BoundingBox;
}

/**
 * 广义的笔画，包括 SVG 笔画和引用笔画
 */
export type Stroke = SVGStroke | ReferenceStroke;

/**
 * 基本部件 BasicComponent
 * tags: 部件的标签
 * strokes: 部件包含的 SVG 笔画
 */
export interface BasicComponent {
  type: "basic_component";
  tags?: string[];
  strokes: SVGStroke[];
}

/**
 * 派生部件 DerivedComponent
 * tags: 部件的标签
 * source: 部件的源字
 * strokes: 部件包含的 SVG 笔画或引用笔画
 *
 * 引用的笔画的内容需要在渲染时从源字中获取
 */
export interface DerivedComponent {
  type: "derived_component";
  tags?: string[];
  source: string;
  strokes: Stroke[];
}

/**
 * 拼接部件 SplicedComponent
 * 与复合体相同，但作为部件使用
 */
export interface SplicedComponent extends Omit<Compound, "type"> {
  type: "spliced_component";
}

/**
 * 部件，包括基本部件和派生部件
 */
export type Component = BasicComponent | DerivedComponent | SplicedComponent;

export const operators = [
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
] as const;

/**
 * 结构表示符
 * 例如 ⿰、⿱ 等
 * 符合 Unicode 中的 Ideography Description Characters
 * 参见 https://en.wikipedia.org/wiki/Ideographic_Description_Characters_(Unicode_block)
 */
export type Operator = (typeof operators)[number];

/**
 * 一个笔画块
 */
export interface Block {
  index: number;
  strokes: number;
}

export interface CompoundParameters {
  gap2?: number;
  scale2?: number;
}

/**
 * 复合体 Compound
 * operator: 结构表示符
 * operandList: 部分列表，有可能是两部分，也可能是三部分（对于 ⿲、⿳）
 * tags: 复合体的标签
 * order: 笔画块的顺序
 */
export interface Compound {
  type: "compound";
  operator: Operator;
  operandList: string[];
  tags?: string[];
  order?: Block[];
  parameters?: CompoundParameters;
}

export interface Reading {
  pinyin: string;
  importance: number;
}

/**
 * 原始字符 PrimitiveCharacter
 * unicode: 字符的 Unicode 编码
 * tygf: 字符在通用规范汉字集中的类型，0 为不存在，1 为一级字，2 为二级字，3 为三级字
 * gb2312: 字符在 GB2312 中的类型，0 为不存在，1 为一级字，2 为二级字
 * name: 字符的别名（当字符是 PUA 时，这个别名会用来在界面上渲染）
 * gf0014_id: 字符在 GF0014-2009 中的编号
 * gf3001_id: 字符在 GF3001-1997 中的编号
 * readings: 字符的读音列表
 * glyphs: 字符的字形列表，其中每一个有可能是基本部件、派生部件或复合体
 * ambiguous: 字符是否有分部歧义
 */
export interface PrimitiveCharacter {
  unicode: number;
  tygf: 0 | 1 | 2 | 3;
  gb2312: 0 | 1 | 2;
  name: string | null;
  gf0014_id: number | null;
  gf3001_id: number | null;
  readings: Reading[];
  glyphs: (BasicComponent | DerivedComponent | SplicedComponent | Compound)[];
  ambiguous: boolean;
}

/**
 * 字符 Character
 * 与原始字符相比，省略了 ambiguous 字段，并且将 glyphs 字段替换为唯一的一个 glyph
 */
export interface Character
  extends Omit<PrimitiveCharacter, "glyphs" | "ambiguous"> {
  glyph: BasicComponent | Compound | undefined;
}

export interface ComponentCharacter extends Character {
  glyph: BasicComponent;
}

export interface CompoundCharacter extends Character {
  glyph: Compound;
}

/** 原始字符集，为字符名称到原始字符的映射 */
export type PrimitiveRepertoire = Record<string, PrimitiveCharacter>;

/** 字符集，为字符名称到字符的映射 */
export type Repertoire = Record<string, Character>;
