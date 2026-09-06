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
  | { command: "l"; parameterList: N2 }
  | {
      command: "c" | "z";
      parameterList: N6;
    }
  | { command: "a"; parameterList: N1 };

export type 向量 = N2;

export const 结构描述字符列表 = [
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
 * 结构描述字符
 * 例如 ⿰、⿱ 等
 * 符合 Unicode 中的 Ideography Description Characters
 * 参见 https://en.wikipedia.org/wiki/Ideographic_Description_Characters_(Unicode_block)
 */
export type 结构描述字符 = (typeof 结构描述字符列表)[number];

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
 * SVG 字形是一系列 SVG 笔画的列表
 */
export type 矢量图形数据 = 矢量笔画数据[];

export type 字形来源数据 = { id: number; sources: string[] };

export interface 字符数据 {
  unicode: number;
  glyphs: 字形来源数据[];
  name?: string;
  tygf?: 1 | 2 | 3;
  gb2312?: 1 | 2;
  ambiguous?: 1;
}

interface 字形数据基础 {
  id: number;
  name?: string;
  gf0014_id?: number;
  gf3001_id?: number;
  ambiguous: boolean;
}

export interface 引用数据 {
  id: number;
  xbegin?: number;
  ybegin?: number;
  xend?: number;
  yend?: number;
}

export interface 引用笔画块数据 {
  index: number;
  from?: number;
  to?: number;
}

export interface 部件数据 extends 字形数据基础 {
  type: "component";
  operator?: 结构描述字符;
  references?: 引用数据[];
  strokes?: (矢量笔画数据 | 引用笔画块数据)[];
}

export interface 基本部件数据 extends 字形数据基础 {
  type: "component";
  operator: undefined;
  references: undefined;
  strokes: 矢量笔画数据[];
}

export interface 复合体数据 extends 字形数据基础 {
  type: "compound";
  operator: 结构描述字符;
  references: 引用数据[];
  strokes?: 引用笔画块数据[];
}

export type 字形数据 = 部件数据 | 复合体数据;

export type 基本字形数据 = 基本部件数据 | 复合体数据;
