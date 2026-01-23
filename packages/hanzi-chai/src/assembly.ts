import type { 默认部件分析 } from "./component.js";
import type { 星空键道复合体分析 } from "./compound.js";
import {
  是归并,
  type 构词规则,
  type 码位,
  type 编码配置,
  type 键盘配置,
} from "./config.js";
import { type Extra, 取码器 } from "./element.js";
import type { 基本分析, 字形分析结果, 拼音分析结果 } from "./repertoire.js";
import { chars, 序列化 } from "./utils.js";
import { getRegistry } from "./registry.js";

/**
 * 代表了一个有字音、有字形的汉字的中间结果
 * 由拆分结果 [`ComponentResult`](#componentresult) 或 [`CompoundResult`](#compoundresult) 与字音组成
 */
type 默认汉字分析 = (默认部件分析 | 基本分析) & {
  汉字: string;
  拼写运算: Map<string, string>;
  自定义元素: Record<string, string[]>;
};

interface 组装 {
  词: string;
  拼音来源列表: string[][];
  元素序列: 码位[];
  频率: number;
}

class 组词器 {
  constructor(private rules: 构词规则[]) {}

  static signedIndex = <T>(elements: T[], index: string) => {
    const order = index.codePointAt(0)! - "a".codePointAt(0)!;
    const signedOrder = order < 13 ? order : order - 26;
    return elements.at(signedOrder);
  };

  组词(全部码位: 码位[][]) {
    const result: 码位[] = [];
    let matched = false;
    for (const rule of this.rules) {
      if ("length_equal" in rule) {
        matched = 全部码位.length === rule.length_equal;
      } else if ("length_in_range" in rule) {
        matched =
          全部码位.length >= rule.length_in_range[0]! &&
          全部码位.length <= rule.length_in_range[1]!;
      }
      if (matched) {
        const tokens = Array.from(rule.formula);
        for (let i = 0; i < tokens.length; i = i + 2) {
          const charIndex = tokens[i]!.toLowerCase();
          const elementIndex = tokens[i + 1]!;
          const elements = 组词器.signedIndex(全部码位, charIndex);
          if (elements === undefined) continue;
          const element = 组词器.signedIndex(elements, elementIndex);
          if (element === undefined) continue;
          result.push(element);
        }
        break;
      }
    }
    if (matched) return result;
  }
}

interface 组装配置 {
  编码器: 编码配置;
  键盘: 键盘配置;
  自定义元素映射: Map<string, Record<string, string[]>>;
  额外信息: Extra;
  // this.自定义元素映射 = new Map();
  // for (const [类别, map] of Object.entries(原始元素映射)) {
  //   for (const [汉字, 元素列表] of Object.entries(map)) {
  //     const existing = this.自定义元素映射.get(汉字) ?? {};
  //     existing[类别] = 元素列表;
  //     this.自定义元素映射.set(汉字, existing);
  //   }
  // }
}

interface 组装器<
  部件分析 extends 基本分析 = 基本分析,
  复合体分析 extends 基本分析 = 基本分析,
> {
  一字词组装(
    汉字: string,
    字形分析: 部件分析 | 复合体分析,
    拼写运算: Map<string, string>,
  ): 码位[];

  多字词组装(
    词: string,
    字形分析: (部件分析 | 复合体分析)[],
    拼写运算: Map<string, string>[],
  ): 码位[];
}

abstract class 按规则构词<
  A extends 基本分析 = 基本分析,
  B extends 基本分析 = 基本分析,
> implements 组装器<A, B>
{
  private 组词器: 组词器;
  constructor(配置: 组装配置) {
    this.组词器 = new 组词器(配置.编码器.rules || []);
  }

  abstract 一字词组装(
    汉字: string,
    字形分析: A | B,
    拼写运算: Map<string, string>,
  ): 码位[];

  多字词组装(词: string, 字形分析: (A | B)[], 拼写运算: Map<string, string>[]) {
    const 汉字列表 = Array.from(词);
    const 全部元素序列: 码位[][] = [];
    for (const [i, 汉字] of 汉字列表.entries()) {
      const 元素序列 = this.一字词组装(汉字, 字形分析[i]!, 拼写运算[i]!);
      全部元素序列.push(元素序列);
    }
    return this.组词器.组词(全部元素序列)!;
  }
}

class 默认组装器 extends 按规则构词 {
  static readonly type = "默认";
  private 取码器: 取码器;

  constructor(private 配置: 组装配置) {
    super(配置);
    this.取码器 = new 取码器(
      this.配置.键盘,
      this.配置.编码器,
      this.配置.额外信息,
    );
  }

  一字词组装(汉字: string, 字形分析: 基本分析, 拼写运算: Map<string, string>) {
    const 汉字分析: 默认汉字分析 = {
      汉字,
      拼写运算,
      ...字形分析,
      自定义元素: this.配置.自定义元素映射.get(汉字) || {},
    };
    if (字形分析 === undefined) {
      console.log(汉字, 字形分析);
    }
    return this.取码器.取码(汉字分析);
  }
}

class 星空键道组装器 extends 按规则构词<默认部件分析, 星空键道复合体分析> {
  static readonly type = "星空键道";
  constructor(private 配置: 组装配置) {
    super(配置);
  }

  编码长度(字根: string) {
    const 键盘映射 = this.配置.键盘.mapping;
    let value = 键盘映射[字根]!;
    while (是归并(value)) {
      value = 键盘映射[value.element]!;
    }
    return value.length;
  }

  一字词组装(
    _: string,
    字形分析: 默认部件分析 | 星空键道复合体分析,
    拼写运算: Map<string, string>,
  ) {
    const 元素序列: 码位[] = [
      拼写运算.get("键道声母")!,
      拼写运算.get("键道韵母")!,
    ];
    if ("首部字根序列" in 字形分析) {
      for (const 字根 of 字形分析.首部字根序列) {
        for (let i = 0; i < this.编码长度(字根); i++) {
          元素序列.push({ element: 字根, index: i });
        }
      }
      元素序列.splice(2 + 2); // 首部最多取两个形码
      for (const 字根 of 字形分析.余部字根序列) {
        for (let i = 0; i < this.编码长度(字根); i++) {
          元素序列.push({ element: 字根, index: i });
        }
      }
      元素序列.splice(2 + 4); // 一共最多取四个形码
    } else {
      for (const 字根 of 字形分析.字根序列) {
        for (let i = 0; i < this.编码长度(字根); i++) {
          元素序列.push({ element: 字根, index: i });
        }
      }
      元素序列.splice(2 + 4); // 一共最多取四个形码
    }
    return 元素序列;
  }
}

const assemble = (
  配置: 组装配置,
  拼音分析结果: 拼音分析结果,
  字形分析结果: 字形分析结果,
) => {
  const 组装结果: 组装[] = [];
  const 组装器 = getRegistry().创建组装器(
    配置.编码器.assembler || "默认",
    配置,
  )!;
  const { 部件分析结果, 复合体分析结果 } = 字形分析结果;
  // 一字词
  for (const { 词, 拼音, 频率, 元素映射 } of 拼音分析结果) {
    let 元素序列: 码位[] = [];
    if (chars(词) === 1) {
      const 字形分析 = 部件分析结果.get(词) ?? 复合体分析结果.get(词);
      元素序列 = 组装器.一字词组装(词, 字形分析!, 元素映射[0]!);
    } else {
      const 字形分析列表: 基本分析[] = [];
      let valid = true;
      for (const 汉字 of Array.from(词)) {
        const 字形分析 = 部件分析结果.get(汉字) ?? 复合体分析结果.get(汉字);
        if (!字形分析) {
          valid = false;
          break;
        } else {
          字形分析列表.push(字形分析);
        }
      }
      if (!valid) continue;
      元素序列 = 组装器.多字词组装(词, 字形分析列表, 元素映射)!;
    }
    组装结果.push({ 词, 元素序列, 频率, 拼音来源列表: [拼音] });
  }
  const 去重后组装结果: 组装[] = [];
  const 索引映射 = new Map<string, number>();
  for (const 组装 of 组装结果) {
    const hash = `${组装.词}:${组装.元素序列.map(序列化).join(" ")}`;
    const 索引 = 索引映射.get(hash);
    if (索引 !== undefined) {
      const 上一个组装 = 去重后组装结果[索引]!;
      上一个组装.频率 += 组装.频率;
      上一个组装.拼音来源列表.push(...组装.拼音来源列表);
    } else {
      索引映射.set(hash, 去重后组装结果.length);
      去重后组装结果.push(组装);
    }
  }
  return 去重后组装结果;
};

export { assemble, 星空键道组装器, 默认组装器 };
export type { 组装, 组装器, 组装配置, 默认汉字分析 };
