import { 图形盒子 } from "./affine.js";
import { type 分类器, 合并分类器 } from "./classifier.js";
import { 部件 } from "./component.js";
import type { 元素, 决策, 决策空间, 分析配置, 安排 } from "./config.js";
import type { 原始汉字数据, 复合体数据 } from "./data.js";
import { 复合体, 获取注册表 } from "./main.js";
import { ok, type Result, 字数 } from "./utils.js";

export type 统一字形 = 部件 | 复合体;

export function 是部件(字形: 统一字形): 字形 is 部件 {
  return 字形 instanceof 部件;
}

export function 是复合体(字形: 统一字形): 字形 is 复合体 {
  return 字形 instanceof 复合体;
}

export interface 字根 {
  获取名称(): string;
  获取笔画序列(分类器: 分类器): number[];
}

export class 单笔字根 implements 字根 {
  constructor(private 笔画类别: number) {}
  获取名称() {
    return this.笔画类别.toString();
  }
  获取笔画序列() {
    return [this.笔画类别];
  }
}

export class 二笔字根 implements 字根 {
  constructor(
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
export interface 汉字数据 extends Omit<原始汉字数据, "glyphs" | "ambiguous"> {
  glyphs: 统一字形[];
}

/** 字库数据，为字符名称到字符的映射 */
export type 字库数据 = Record<string, 汉字数据>;

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
  分析结果: Map<string, (部件分析 | 复合体分析)[]>;
  字根部件列表: 部件[];
}

interface 动态字形分析结果<
  部件分析 extends 基本部件分析 = 基本部件分析,
  复合体分析 extends 基本复合体分析 = 基本复合体分析,
> {
  分析结果: Map<string, (部件分析 | 复合体分析)[][]>;
  字根部件列表: 部件[];
}

interface 字形分析基本配置 {
  分析配置: 分析配置;
  决策: 决策;
  决策空间: 决策空间;
}

interface 字形分析配置 {
  分析配置: 分析配置;
  字根决策: Map<元素, 安排>;
  可选字根: Set<元素>;
  分类器: 分类器;
  部件字根列表: 部件[];
  复合体字根映射: Map<复合体, 部件>;
}

class 字库 {
  private repertoire: 字库数据;

  constructor(repertoire: 字库数据 = {}) {
    this.repertoire = repertoire;
  }

  _get() {
    return this.repertoire;
  }

  查询字形(character: string): 统一字形[] | undefined {
    return this.repertoire[character]?.glyphs;
  }

  添加(character: string, data: 汉字数据) {
    this.repertoire[character] = data;
  }

  准备字形分析配置(
    分析配置: 分析配置,
    决策: 决策,
    决策空间: 决策空间,
  ): Result<字形分析配置, Error> {
    const 可选字根: Set<元素> = new Set();
    const 字根决策 = new Map(
      Object.entries(决策).filter(([k, _]) => 字数(k) === 1),
    );
    for (const [key, value] of Object.entries(决策空间)) {
      if (value.some((x) => x.value == null) || 决策[key] === undefined) {
        可选字根.add(key);
      }
    }
    const 字根列表 = [...字根决策.keys(), ...可选字根.keys()];
    const 分类器 = 合并分类器(分析配置.classifier);
    const 结果 = this.生成字根部件列表(字根列表);
    if (!结果.ok) {
      return 结果;
    }
    // if (analysis.serializer === "feihua") {
    //   for (const root of roots.keys()) {
    //     // e43d: 全字头、e0e3: 乔字底、e0ba: 亦字底无八、e439: 见二、e431: 聿三、e020: 负字头、e078：卧人、e03e：尚字头、e42d：学字头、e07f：荒字底、e02a：周字框、e087：木无十、f001: 龰字底、e41a：三竖、e001: 两竖、e17e: 西字心
    //     if (
    //       !/[12345二\ue001三\ue41a口八丷\ue087宀日人\ue43d\uf001十乂亠厶冂\ue439\ue02a儿\ue17e\ue0e3\ue0ba大小\ue03e\ue442川彐\ue431\ue020\ue078\ue42d\ue07f]/.test(
    //         root,
    //       )
    //     ) {
    //       optionalRoots.add(root);
    //     }
    //   }
    // }
    return ok({
      分析配置,
      分类器,
      字根决策,
      可选字根,
      ...结果.value,
    });
  }

  /**
   * 确定需要分析的字符
   */
  获取待分析部件(汉字列表: Set<string>) {
    const 待分析部件集合: Set<部件> = new Set();
    const recurse = (glyph: 统一字形) => {
      if (是部件(glyph)) 待分析部件集合.add(glyph);
      else {
        for (const 子字形 of glyph.部分列表) {
          recurse(子字形);
        }
      }
    };
    for (const 汉字 of 汉字列表) {
      const 字形列表 = this.repertoire[汉字]?.glyphs ?? [];
      for (const 字形 of 字形列表) {
        recurse(字形);
      }
    }
    return 待分析部件集合;
  }

  /**
   * 将所有的字根都计算成部件
   *
   * @returns 所有计算后字根的列表
   */
  生成字根部件列表(字根列表: string[]) {
    const 部件字根列表: 部件[] = [];
    const 复合体字根映射: Map<复合体, 部件> = new Map();
    for (const 字根字符 of 字根列表) {
      const 字根字形列表 = this.repertoire[字根字符]?.glyphs ?? [];
      for (const 字根字形 of 字根字形列表) {
        if (字根字形 instanceof 部件) {
          部件字根列表.push(字根字形);
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
        }
      }
    }
    return ok({ 部件字根列表, 复合体字根映射 });
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
          operator: 复合体.结构表示符,
          parameters: {},
        } as 复合体数据,
        图形盒子列表,
      ),
    );
  }

  准备分析(base: 字形分析基本配置, 汉字集合: Set<string>) {
    const { 分析配置, 决策, 决策空间 } = base;
    const config = this.准备字形分析配置(分析配置, 决策, 决策空间);
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
    汉字集合: Set<string>,
  ): Result<字形分析结果, Error> {
    const 分析配置或错误 = this.准备分析(base, 汉字集合);
    if (!分析配置或错误.ok) return 分析配置或错误;
    const 分析配置 = 分析配置或错误.value;
    const 部件分析结果 = new Map<部件, 基本部件分析>();
    for (const 部件 of 分析配置.待分析部件集合) {
      const 分析 = 分析配置.部件分析器.分析(部件);
      if (!分析.ok) return 分析;
      部件分析结果.set(部件, 分析.value);
    }
    分析配置.复合体分析器.部件分析结果 = 部件分析结果;
    const 分析结果 = new Map<string, 基本分析[]>();
    for (const 字符 of 汉字集合) {
      const 结果列表: 基本分析[] = [];
      const 字形列表 = this.repertoire[字符]?.glyphs ?? [];
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
    汉字集合: Set<string>,
  ): Result<动态字形分析结果, Error> {
    const 分析配置或错误 = this.准备分析(base, 汉字集合);
    if (!分析配置或错误.ok) return 分析配置或错误;
    const 分析配置 = 分析配置或错误.value;
    const 动态部件分析结果 = new Map<部件, 基本部件分析[]>();
    for (const 部件 of 分析配置.待分析部件集合) {
      const 分析 = 分析配置.部件分析器.动态分析(部件);
      if (!分析.ok) return 分析;
      动态部件分析结果.set(部件, 分析.value);
    }
    分析配置.复合体分析器.动态部件分析结果 = 动态部件分析结果;
    const 分析结果 = new Map<string, 基本分析[][]>();
    for (const 字符 of 汉字集合) {
      const 结果列表: 基本分析[][] = [];
      const 字形列表 = this.repertoire[字符]?.glyphs ?? [];
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
