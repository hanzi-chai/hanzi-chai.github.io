import { 图形盒子 } from "./affine.js";
import { type 分类器, 合并分类器 } from "./classifier.js";
import { 部件 } from "./component.js";
import type { 决策, 决策空间, 分析配置, 安排 } from "./config.js";
import type { 复合体数据 } from "./data.js";
import { type 原始字库, 复合体, type 字符, 获取注册表 } from "./main.js";
import { ok, type Result, 表示二笔字根, 表示单笔字根 } from "./utils.js";

export type 字形 = 部件 | 复合体;

export function 是部件(字形: 字形): 字形 is 部件 {
  return 字形 instanceof 部件;
}

export function 是复合体(字形: 字形): 字形 is 复合体 {
  return 字形 instanceof 复合体;
}

export interface 字根 {
  获取名称(): string;
  获取笔画序列(分类器: 分类器): number[];
}

/**
 * 用于表示单个笔画构成的字根，笔画为数字类别
 */
export class 单笔字根 implements 字根 {
  static pool: Map<number, 单笔字根> = new Map();
  static 创建(笔画类别: number) {
    if (!单笔字根.pool.has(笔画类别)) {
      单笔字根.pool.set(笔画类别, new 单笔字根(笔画类别));
    }
    return 单笔字根.pool.get(笔画类别)!;
  }
  private constructor(private 笔画类别: number) {}
  获取名称() {
    return this.笔画类别.toString();
  }
  获取笔画序列() {
    return [this.笔画类别];
  }
}

/**
 * 表示二笔类输入方案中的隐式字根，笔画为数字类别
 * 也可以用于表示张码、易码、蓝宝石等方案中的二笔补码
 */
export class 二笔字根 implements 字根 {
  static pool: Map<string, 二笔字根> = new Map();
  static 创建(笔画类别1: number, 笔画类别2: number) {
    const key = `${笔画类别1}${笔画类别2}`;
    if (!二笔字根.pool.has(key)) {
      二笔字根.pool.set(key, new 二笔字根(笔画类别1, 笔画类别2));
    }
    return 二笔字根.pool.get(key)!;
  }
  private constructor(
    private 笔画类别1: number,
    private 笔画类别2: number,
  ) {}
  获取名称() {
    return `${this.笔画类别1}${this.笔画类别2}`;
  }
  获取笔画序列() {
    return [this.笔画类别1, this.笔画类别2];
  }
}

/**
 * 字符 Character
 * 与原始字符相比，省略了 ambiguous 字段，并且将 glyphs 字段替换为唯一的一个 glyph
 * 此时的 glyph 要么是基本部件，要么是复合体
 */
export class 汉字 {
  constructor(
    public 字符: 字符,
    public 字形列表: 字形[],
  ) {}
}

interface 基本部件分析 {
  类型: "部件";
  字根序列: 字根[];
}

interface 基本复合体分析 {
  类型: "复合体";
  字根序列: 字根[];
}

type 基本分析 = 基本部件分析 | 基本复合体分析;

interface 字形分析结果<
  部件分析 extends 基本部件分析 = 基本部件分析,
  复合体分析 extends 基本复合体分析 = 基本复合体分析,
> {
  分析结果: Map<字符, (部件分析 | 复合体分析)[]>;
  字根部件列表: 部件[];
}

interface 动态字形分析结果<
  部件分析 extends 基本部件分析 = 基本部件分析,
  复合体分析 extends 基本复合体分析 = 基本复合体分析,
> {
  分析结果: Map<字符, (部件分析 | 复合体分析)[][]>;
  字根部件列表: 部件[];
}

interface 字形分析基本配置 {
  分析配置: 分析配置;
  决策: 决策;
  决策空间: 决策空间;
}

interface 字形分析配置 {
  分析配置: 分析配置; // 原始分析配置
  字根决策: Map<字根, 安排>;
  可选字根: Set<字根>;
  分类器: 分类器; // 已经填充过默认值
  部件字根列表: 部件[];
  复合体字根映射: Map<复合体, 部件>;
}

class 字库 {
  private repertoire: Map<number, 汉字>;

  constructor(repertoire: Map<number, 汉字> = new Map()) {
    this.repertoire = repertoire;
  }

  _get() {
    return this.repertoire;
  }

  查询字形(character: 字符): 字形[] | undefined {
    return this.repertoire.get(character.toNumber())?.字形列表;
  }

  添加(character: 字符, data: 汉字) {
    this.repertoire.set(character.toNumber(), data);
  }

  准备字形分析配置(
    分析配置: 分析配置,
    决策: 决策,
    决策空间: 决策空间,
    原始字库: 原始字库,
  ): Result<字形分析配置, Error> {
    const 字根决策 = new Map<字根, 安排>();
    const 可选字根 = new Set<字根>();
    const 分类器 = 合并分类器(分析配置.classifier);
    const 全部元素 = new Set(Object.keys(决策).concat(Object.keys(决策空间)));
    const 部件字根列表: 部件[] = [];
    const 复合体字根映射: Map<复合体, 部件> = new Map();
    for (const 元素 of 全部元素) {
      const 安排 = 决策[元素];
      const 安排列表 = 决策空间[元素];
      const 所有字根: 字根[] = [];
      const 单笔字根 = 表示单笔字根(元素, 分类器);
      const 二笔字根 = 表示二笔字根(元素, 分类器);
      const 字根字符 = 原始字库.校验(元素)?.character;
      if (单笔字根) {
        所有字根.push(单笔字根);
      } else if (二笔字根) {
        所有字根.push(二笔字根);
      } else if (字根字符) {
        const 字形列表 = this.查询字形(字根字符) ?? [];
        for (const 字根字形 of 字形列表) {
          if (字根字形 instanceof 部件) {
            部件字根列表.push(字根字形);
            所有字根.push(字根字形);
          } else {
            const 图形盒子 = this.递归渲染复合体(字根字形);
            if (!图形盒子.ok) return 图形盒子;
            const 真部件 = new 部件(
              字根字符,
              字根字形.标签集合,
              图形盒子.value.获取笔画列表(),
            );
            部件字根列表.push(真部件);
            复合体字根映射.set(字根字形, 真部件);
            所有字根.push(真部件);
          }
        }
      }
      for (const 字根 of 所有字根) {
        if (安排) 字根决策.set(字根, 安排);
        if (安排 === undefined || 安排列表?.some((x) => x.value == null)) {
          可选字根.add(字根);
        }
      }
    }
    return ok({
      分析配置,
      分类器,
      字根决策,
      可选字根,
      部件字根列表,
      复合体字根映射,
    });
  }

  /**
   * 确定需要分析的字符
   */
  获取待分析部件(汉字列表: Set<字符>) {
    const 待分析部件集合: Set<部件> = new Set();
    const recurse = (glyph: 字形) => {
      if (是部件(glyph)) 待分析部件集合.add(glyph);
      else {
        for (const 子字形 of glyph.部分列表) {
          recurse(子字形);
        }
      }
    };
    for (const 汉字 of 汉字列表) {
      const 字形列表 = this.查询字形(汉字) ?? [];
      for (const 字形 of 字形列表) {
        recurse(字形);
      }
    }
    return 待分析部件集合;
  }

  /**
   * 将复合体递归渲染为 SVG 图形
   *
   * @param 复合体 - 复合体
   * @param repertoire - 原始字符集
   *
   * @returns SVG 图形或错误
   */
  递归渲染复合体(复合体: 复合体): Result<图形盒子, Error> {
    const 图形盒子列表: 图形盒子[] = [];
    for (const 部分 of 复合体.部分列表) {
      if (部分 instanceof 部件) {
        const 盒子 = 图形盒子.从笔画列表构建(部分.矢量图形);
        图形盒子列表.push(盒子);
      } else {
        const rendered = this.递归渲染复合体(部分);
        if (!rendered.ok) return rendered;
        图形盒子列表.push(rendered.value);
      }
    }
    return ok(
      图形盒子.仿射合并(
        {
          type: "compound",
          operator: 复合体.结构描述字符,
          parameters: {},
        } as 复合体数据,
        图形盒子列表,
      ),
    );
  }

  准备分析(base: 字形分析基本配置, 汉字集合: Set<字符>, 原始字库: 原始字库) {
    console.log(汉字集合);
    const { 分析配置, 决策, 决策空间 } = base;
    const config = this.准备字形分析配置(分析配置, 决策, 决策空间, 原始字库);
    if (!config.ok) return config;
    const configValue = config.value;
    const 待分析部件集合 = this.获取待分析部件(汉字集合);
    const 部件分析器 = 获取注册表().创建部件分析器(
      分析配置.component_analyzer || "默认",
      configValue,
    )!;
    const 复合体分析器 = 获取注册表().创建复合体分析器(
      分析配置.compound_analyzer || "默认",
      configValue,
    )!;
    return ok({
      待分析部件集合,
      部件分析器,
      复合体分析器,
      字根部件列表: configValue.部件字根列表,
    });
  }

  /**
   * 对整个字符集中的字符进行拆分
   *
   * @param repertoire - 字符集
   * @param config - 配置
   */
  分析(
    base: 字形分析基本配置,
    汉字集合: Set<字符>,
    原始字库: 原始字库,
  ): Result<字形分析结果, Error> {
    const 分析配置或错误 = this.准备分析(base, 汉字集合, 原始字库);
    if (!分析配置或错误.ok) return 分析配置或错误;
    const 分析配置 = 分析配置或错误.value;
    const 部件分析结果 = new Map<部件, 基本部件分析>();
    for (const 部件 of 分析配置.待分析部件集合) {
      const 分析 = 分析配置.部件分析器.分析(部件);
      if (!分析.ok) return 分析;
      部件分析结果.set(部件, 分析.value);
    }
    分析配置.复合体分析器.部件分析结果 = 部件分析结果;
    const 分析结果 = new Map<字符, 基本分析[]>();
    for (const 字符 of 汉字集合) {
      const 结果列表: 基本分析[] = [];
      const 字形列表 = this.查询字形(字符) ?? [];
      for (const 字形 of 字形列表) {
        if (字形 instanceof 部件) {
          const 分析 = 部件分析结果.get(字形)!;
          结果列表.push(分析);
        } else {
          const 分析 = 分析配置.复合体分析器.分析(字形);
          if (!分析.ok) return 分析;
          结果列表.push(分析.value);
        }
      }
      分析结果.set(字符, 结果列表);
    }
    return ok({
      分析结果,
      字根部件列表: 分析配置.字根部件列表,
    });
  }

  /**
   * 对整个字符集中的字符进行拆分
   *
   * @param repertoire - 字符集
   * @param config - 配置
   */
  动态分析(
    base: 字形分析基本配置,
    汉字集合: Set<字符>,
    原始字库: 原始字库,
  ): Result<动态字形分析结果, Error> {
    const 分析配置或错误 = this.准备分析(base, 汉字集合, 原始字库);
    if (!分析配置或错误.ok) return 分析配置或错误;
    const 分析配置 = 分析配置或错误.value;
    const 动态部件分析结果 = new Map<部件, 基本部件分析[]>();
    for (const 部件 of 分析配置.待分析部件集合) {
      const 分析 = 分析配置.部件分析器.动态分析(部件);
      if (!分析.ok) return 分析;
      动态部件分析结果.set(部件, 分析.value);
    }
    分析配置.复合体分析器.动态部件分析结果 = 动态部件分析结果;
    const 分析结果 = new Map<字符, 基本分析[][]>();
    for (const 字符 of 汉字集合) {
      const 结果列表: 基本分析[][] = [];
      const 字形列表 = this.查询字形(字符) ?? [];
      for (const 字形 of 字形列表) {
        if (字形 instanceof 部件) {
          const 分析 = 动态部件分析结果.get(字形)!;
          结果列表.push(分析);
        } else {
          const 分析 = 分析配置.复合体分析器.动态分析(字形);
          if (!分析.ok) return 分析;
          结果列表.push(分析.value);
        }
      }
      分析结果.set(字符, 结果列表);
    }
    return ok({
      分析结果,
      字根部件列表: 分析配置.字根部件列表,
    });
  }
}

export { 字库 };
export type {
  基本分析,
  基本部件分析,
  基本复合体分析,
  字形分析结果,
  动态字形分析结果,
  字形分析配置,
};
