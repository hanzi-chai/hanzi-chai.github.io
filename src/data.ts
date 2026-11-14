import type { 笔画名称 } from "./classifier.js";
import { 是合法字形ID } from "./glyph-id.js";

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

// 只支持二元、三元结构；一元镜像与旋转操作符已停用，变换结果保存为部件。
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
] as const;

/**
 * 结构描述字符
 * 例如 ⿰、⿱ 等
 * 符合 Unicode 中的 Ideography Description Characters
 * 参见 https://en.wikipedia.org/wiki/Ideographic_Description_Characters_(Unicode_block)
 */
export type 结构描述字符 = (typeof 结构描述字符列表)[number];

export function 获取并列布局主轴(operator?: 结构描述字符): 0 | 1 | undefined {
  if (operator === "⿰" || operator === "⿲") return 0;
  if (operator === "⿱" || operator === "⿳") return 1;
}

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
  tygf?: 1 | 2 | 3;
  gb2312?: 1 | 2;
  ambiguous?: 1;
}

interface 字形数据基础 {
  id: number;
  name?: string;
}

export interface 引用数据 {
  id: number;
  xbegin?: number;
  ybegin?: number;
  xend?: number;
  yend?: number;
  /** 左右或上下结构中，沿主轴平移，使当前部分的包围盒紧贴前一部分。 */
  attach_to_previous?: boolean;
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

/** 在入库前定位 JSON 中首个无法以安全整数保存的数值。 */
export function 校验字库整数(数据: unknown, 路径 = ""): string | undefined {
  if (typeof 数据 === "number" && !Number.isSafeInteger(数据)) {
    return `字段 ${路径 || "/"} 必须是安全整数`;
  }
  if (数据 === null || typeof 数据 !== "object") return;
  for (const [字段, 值] of Object.entries(数据)) {
    if (字段 === "id" && !是合法字形ID(值))
      return `字段 ${路径}/${字段} 必须是 0–1048575 的字形 ID 整数`;
    const 错误 = 校验字库整数(值, `${路径}/${字段}`);
    if (错误) return 错误;
  }
}
