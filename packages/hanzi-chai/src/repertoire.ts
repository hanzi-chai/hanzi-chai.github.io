import { isEqual } from "lodash-es";
import { 图形盒子 } from "./affine.js";
import { type 分类器, 合并分类器 } from "./classifier.js";
import { 部件 } from "./component.js";
import { 复合体 } from "./compound.js";
import type { 决策, 决策空间, 分析配置, 安排, 条件 } from "./config.js";
import type { 复合体数据 } from "./data.js";
import { 二笔, 单笔, 识别元素 } from "./element.js";
import type { 原始字库 } from "./primitive.js";
import { 获取注册表 } from "./registry.js";
import { 字符 } from "./unicode.js";
import { ok, type Result, type 源标签 } from "./utils.js";

export type 字形 = 部件 | 复合体;

export function 是部件(字形: 字形): 字形 is 部件 {
  return 字形 instanceof 部件;
}

export function 是复合体(字形: 字形): 字形 is 复合体 {
  return 字形 instanceof 复合体;
}

export type 字根 = 单笔 | 二笔 | 部件;

interface 基本部件分析 {
  类型: "部件";
  字根序列: 字根[];
  部件: 部件;
}

export type 带条件<T extends object> = T & {
  条件列表: 条件[];
};

export const 存在 = (x: 字根): 条件 => ({
  element: x.获取名称(),
  op: "不是" as const,
  value: null,
});

interface 基本复合体分析 {
  类型: "复合体";
  字根序列: 字根[];
  复合体: 复合体;
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
  分析结果: Map<字符, (优先表<部件分析> | 优先表<复合体分析>)[]>;
  字根部件列表: 部件[];
}

interface 字形分析基本配置 {
  分析配置: 分析配置;
  决策: 决策;
  决策空间: 决策空间;
  字形来源列表: string[];
}

interface 字形分析配置 {
  分析配置: 分析配置; // 原始分析配置
  字根决策: Map<字根, 安排>;
  可选字根: Set<字根>;
  分类器: 分类器; // 已经填充过默认值
  部件字根列表: 部件[];
  复合体字根映射: Map<复合体, 部件>;
}

export class 优先表<T extends object> {
  constructor(private 列表: 带条件<T>[]) {}

  [Symbol.iterator]() {
    return this.列表[Symbol.iterator]();
  }
}

export function 贝叶斯推断<T extends object, U extends object>(
  优先表列表: 带条件<T>[][],
  reducer: (a: T[]) => U,
): 带条件<U>[] {
  const recurse = (l: 带条件<T>[][]): 带条件<{ array: T[] }>[] => {
    if (l.length === 1) return l[0]!.map((x) => ({ ...x, array: [x] }));
    const 前一个表 = recurse(l.slice(0, -1));
    const 当前表 = l.at(-1)!;
    const 结果列表: 带条件<{ array: T[] }>[] = [];
    for (const 前一个项 of 前一个表) {
      for (const 当前项 of 当前表) {
        const 合并项 = { array: [...前一个项.array, 当前项] };
        if (蕴含(前一个项.条件列表, 当前项.条件列表)) {
          结果列表.push({ ...合并项, 条件列表: 前一个项.条件列表 });
          break;
        } else {
          const 扩充条件列表 = [...前一个项.条件列表];
          for (const 条件 of 当前项.条件列表) {
            if (!前一个项.条件列表.some((c) => isEqual(c, 条件))) {
              扩充条件列表.push(条件);
            }
          }
          结果列表.push({ ...合并项, 条件列表: 扩充条件列表 });
        }
      }
    }
    return 结果列表;
  };
  const 结果列表 = recurse(优先表列表).map((x) => ({
    ...reducer(x.array),
    条件列表: x.条件列表,
  }));
  return 结果列表;
}

function 蕴含(已有列表: 条件[], 目标列表: 条件[]): boolean {
  for (const 目标 of 目标列表) {
    if (!已有列表.some((条件) => isEqual(条件, 目标))) {
      return false;
    }
  }
  return true;
}

class 字库 {
  private repertoire: Map<字符, 字形[]>;

  constructor(repertoire: Map<字符, 字形[]> = new Map()) {
    this.repertoire = repertoire;
  }

  *[Symbol.iterator](): Iterator<{ 字符: 字符; 字形列表: 字形[] }> {
    for (const [字符, 字形列表] of this.repertoire) {
      yield { 字符, 字形列表 };
    }
  }

  查询字形(character: 字符): 字形[] | undefined {
    return this.repertoire.get(character);
  }

  添加(character: 字符, 字形列表: 字形[]) {
    this.repertoire.set(character, 字形列表);
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
      const 识别结果 = 识别元素(
        元素,
        分类器,
        (s) => 原始字库.校验(s)?.character,
      );
      if (识别结果 instanceof 单笔 || 识别结果 instanceof 二笔) {
        所有字根.push(识别结果);
      } else if (识别结果 instanceof 字符) {
        const 字根字符 = 识别结果;
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
              字根字形.用户自定义,
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
    const 当前标签集合 = new Set(base.字形来源列表);
    for (const 字符 of 汉字集合) {
      const 结果列表: 基本分析[] = [];
      const 字形列表 = this.查询字形(字符) ?? [];
      const 已存在标签集合 = new Set<源标签>();
      for (const 字形 of 字形列表) {
        const 剩余有效标签集合 = 字形.标签集合.difference(已存在标签集合);
        const 选取 =
          字形.用户自定义 ||
          剩余有效标签集合.intersection(当前标签集合).size > 0;
        if (!选取) continue;
        [...字形.标签集合].map((x) => 已存在标签集合.add(x));
        if (字形 instanceof 部件) {
          const 分析 = 部件分析结果.get(字形)!;
          结果列表.push(分析);
        } else {
          const 分析 = 分析配置.复合体分析器.分析(字形);
          if (!分析.ok) return 分析;
          结果列表.push(分析.value);
        }
      }
      if (结果列表.length > 1)
        console.log(
          `字符 ${字符} 的分析结果有多个，分别是：`,
          字形列表,
          结果列表,
        );
      分析结果.set(字符, 结果列表);
    }
    for (const [部件, 分析] of 部件分析结果) {
      if (!汉字集合.has(部件.字符)) {
        分析结果.set(部件.字符, (分析结果.get(部件.字符) ?? []).concat([分析]));
      }
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
    const 动态部件分析结果 = new Map<部件, 优先表<基本部件分析>>();
    for (const 部件 of 分析配置.待分析部件集合) {
      const 分析 = 分析配置.部件分析器.动态分析(部件);
      if (!分析.ok) return 分析;
      动态部件分析结果.set(部件, 分析.value);
    }
    分析配置.复合体分析器.动态部件分析结果 = 动态部件分析结果;
    const 分析结果 = new Map<
      字符,
      (优先表<基本部件分析> | 优先表<基本复合体分析>)[]
    >();
    for (const 字符 of 汉字集合) {
      const 结果列表: (优先表<基本部件分析> | 优先表<基本复合体分析>)[] = [];
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
