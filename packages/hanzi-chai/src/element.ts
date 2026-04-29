import type { 默认汉字分析 } from "./assembly.js";
import { type 分类器, 默认分类器 } from "./classifier.js";
import type {
  条件节点配置,
  源节点配置,
  码位,
  运算符,
  键盘配置,
} from "./config.js";
import type { 结构描述字符 } from "./main.js";
import type { 字根 } from "./repertoire.js";
import type { 字符 } from "./unicode.js";
import { 展开决策, 计算当前或潜在长度 } from "./utils.js";

export type 元素识别结果 = 单笔 | 二笔 | 字符 | string;

export function 识别元素(
  元素: string,
  分类器: 分类器,
  查找汉字: (s: string) => 字符 | undefined,
): 元素识别结果 {
  const 数字集合 = Object.values(分类器).map(String);
  if (元素.length === 1 && 数字集合.includes(元素)) {
    return 单笔.创建(Number(元素));
  }
  const [ch1, ch2] = [...元素];
  if (
    元素.length === 2 &&
    ch1 &&
    ch2 &&
    数字集合.includes(ch1) &&
    数字集合.includes(ch2)
  ) {
    return 二笔.创建(Number(ch1), Number(ch2));
  }
  const 字符实例 = 查找汉字(元素);
  if (字符实例) {
    return 字符实例;
  }
  return 元素;
}

export class 结构符 {
  constructor(public operator: 结构描述字符) {}
}

export class 拼音元素 {
  constructor(
    public 类型: string,
    public 元素: string,
  ) {}
}

export class 自定义元素 {
  constructor(
    public 类型: string,
    public 元素: string,
  ) {}
}

export class 单笔 {
  static pool: Map<number, 单笔> = new Map();
  static 创建(笔画类别: number) {
    if (!单笔.pool.has(笔画类别)) {
      单笔.pool.set(笔画类别, new 单笔(笔画类别));
    }
    return 单笔.pool.get(笔画类别)!;
  }
  private constructor(private 笔画类别: number) {}
  获取名称() {
    return this.笔画类别.toString();
  }
  获取笔画序列() {
    return [this.笔画类别];
  }
}

export class 二笔 {
  static pool: Map<string, 二笔> = new Map();
  static 创建(笔画类别1: number, 笔画类别2: number) {
    const key = `${笔画类别1}${笔画类别2}`;
    if (!二笔.pool.has(key)) {
      二笔.pool.set(key, new 二笔(笔画类别1, 笔画类别2));
    }
    return 二笔.pool.get(key)!;
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

interface 基本 {
  type: string;
}

interface 汉字自身 extends 基本 {
  type: "汉字";
}

interface 固定取码 extends 基本 {
  type: "固定";
  key: string;
}

interface 字音取码 extends 基本 {
  type: "字音";
  subtype: string;
}

interface 字根取码 extends 基本 {
  type: "字根";
  rootIndex: number;
}

interface 字根笔画取码 extends 基本 {
  type: "笔画";
  rootIndex: number;
  strokeIndex: number;
}

interface 字根二笔取码 extends 基本 {
  type: "二笔";
  rootIndex: number;
  strokeIndex: number;
}

interface 结构取码 extends 基本 {
  type: "结构";
}

interface 自定义取码 extends 基本 {
  type: "自定义";
  subtype: string;
  rootIndex: number;
}

interface 特殊取码 extends 基本 {
  type: "特殊";
  index: number;
}

export type 取码对象 =
  | 汉字自身
  | 固定取码
  | 字音取码
  | 字根取码
  | 字根笔画取码
  | 字根二笔取码
  | 结构取码
  | 自定义取码
  | 特殊取码;

export const 摘要 = (object: 取码对象) => {
  switch (object.type) {
    case "汉字":
    case "结构":
      return object.type;
    case "固定":
      return object.key;
    case "字音":
      return object.subtype;
    case "字根":
      return `根 ${object.rootIndex}`;
    case "笔画":
      return `根 ${object.rootIndex} 笔 ${object.strokeIndex}`;
    case "二笔":
      return `根 ${object.rootIndex} 笔 (${
        object.strokeIndex * 2 - Math.sign(object.strokeIndex)
      }, ${object.strokeIndex * 2})`;
    case "自定义":
      return `${object.subtype} ${object.rootIndex}`;
    default:
      return `${object.type} ${object.index}`;
  }
};

export const 转列表 = (object: 取码对象): (string | number)[] => {
  const list = [object.type];
  switch (object.type) {
    case "汉字":
    case "结构":
      return list;
    case "固定":
      return [...list, object.key];
    case "字音":
      return [...list, object.subtype];
    case "字根":
      return [...list, object.rootIndex];
    case "笔画":
      return [...list, object.rootIndex, object.strokeIndex];
    case "二笔":
      return [...list, object.rootIndex, object.strokeIndex];
    case "自定义":
      return [...list, object.subtype, object.rootIndex];
    default:
      return [...list, object.index];
  }
};

export const 从列表生成 = (value: (string | number)[]): 取码对象 => {
  const type = value[0] as 取码对象["type"];
  switch (type) {
    case "汉字":
    case "结构":
      return { type };
    case "固定":
      return { type, key: value[1] as string };
    case "字音":
      return { type, subtype: value[1] as string };
    case "字根":
      return { type, rootIndex: value[1] as number };
    case "笔画":
      return {
        type,
        rootIndex: value[1] as number,
        strokeIndex: value[2] as number,
      };
    case "二笔":
      return {
        type,
        rootIndex: value[1] as number,
        strokeIndex: value[2] as number,
      };
    case "自定义":
      return {
        type,
        subtype: value[1] as string,
        rootIndex: value[2] as number,
      };
    default:
      return { type, index: value[1] as number };
  }
};

function signedIndex<T>(a: T[], i: number): T | undefined {
  return i >= 0 ? a[i - 1] : a[a.length + i];
}

export class 取码器 {
  private 最终映射: Map<string, string>;
  private 当前或潜在长度: Map<string, number>;
  private 谓词表: Record<
    运算符,
    (
      target: string | undefined,
      value: string | null,
      totalMapping: Map<string, string>,
    ) => boolean
  > = {
    是: (t, v) => t === v,
    不是: (t, v) => t !== v,
    匹配: (t, v) => t !== undefined && new RegExp(v!).test(t),
    不匹配: (t, v) => t !== undefined && !new RegExp(v!).test(t),
    编码匹配: (t, v, m) => t !== undefined && new RegExp(v!).test(m.get(t)!),
    编码不匹配: (t, v, m) => t !== undefined && !new RegExp(v!).test(m.get(t)!),
    存在: (t) => t !== undefined,
    不存在: (t) => t === undefined,
  };

  constructor(
    private keyboard: 键盘配置,
    private sources: Record<string, 源节点配置>,
    private conditions: Record<string, 条件节点配置>,
    private max_length: number,
  ) {
    const { mapping, mapping_space } = keyboard;
    const expanded = 展开决策(mapping);
    const 当前或潜在长度 = 计算当前或潜在长度(mapping, mapping_space ?? {});
    if (!expanded.ok) {
      throw new Error(`键盘映射展开失败: ${expanded.error}`);
    }
    if (!当前或潜在长度.ok) {
      throw new Error(`键盘映射长度计算失败: ${当前或潜在长度.error}`);
    }
    this.最终映射 = expanded.value;
    this.当前或潜在长度 = 当前或潜在长度.value;
  }

  取码(汉字分析: 默认汉字分析) {
    const 字母表 = Array.from(this.keyboard.alphabet ?? "");
    let 节点: string | null = "s0";
    const 码位序列: 码位[] = [];
    while (节点) {
      if (节点.startsWith("s")) {
        const 源: 源节点配置 = this.sources[节点]!;
        const { object, next, index } = 源;
        if (节点 === "s0") {
          节点 = next;
          continue;
        }
        const 元素 = this.寻找(object!, 汉字分析);
        if (元素 === undefined) {
          // 如果找不到该元素，跳过
        } else if (字母表.includes(元素)) {
          // 如果是固定编码，直接加入
          码位序列.push(元素);
        } else {
          const 长度 = this.当前或潜在长度.get(元素) ?? 0;
          // 如果没有定义指标，就是全取；否则检查指标是否有效并取
          if (index === undefined) {
            for (let i = 0; i < 长度; i++) {
              码位序列.push({ element: 元素, index: i });
            }
          } else {
            if (index < 长度 && index >= 0) {
              码位序列.push({ element: 元素, index });
            }
          }
        }
        节点 = next;
      } else {
        const 条件: 条件节点配置 = this.conditions[节点]!;
        if (this.满足(条件, 汉字分析)) {
          节点 = 条件.positive;
        } else {
          节点 = 条件.negative;
        }
      }
    }
    return 码位序列.slice(0, this.max_length ?? 码位序列.length);
  }

  寻找(object: 取码对象, result: 默认汉字分析) {
    const { 拼写运算, 字根序列 } = result;
    let root: 字根 | undefined;
    let strokes: number[];
    let name: string;
    let stroke1: number | undefined;
    let stroke2: number | undefined;
    let special: string[] | undefined;
    switch (object.type) {
      case "汉字":
        return result.汉字.toString();
      case "固定":
        return object.key;
      case "字音":
        name = object.subtype;
        return 拼写运算.get(name);
      case "字根":
        root = signedIndex(字根序列, object.rootIndex);
        if (root === undefined) return undefined;
        if (root.获取名称 === undefined) console.log(字根序列);
        return root.获取名称();
      case "笔画":
      case "二笔":
        root = signedIndex(字根序列, object.rootIndex);
        if (root === undefined) return undefined;
        strokes = root.获取笔画序列(默认分类器);
        if (object.type === "笔画") {
          const number = signedIndex(strokes, object.strokeIndex);
          return number?.toString();
        }
        stroke1 = signedIndex(
          strokes,
          object.strokeIndex * 2 - Math.sign(object.strokeIndex),
        );
        if (stroke1 === undefined) return undefined;
        stroke2 = signedIndex(strokes, object.strokeIndex * 2);
        return [stroke1, stroke2 ?? 0].join("");
      case "结构":
        return "结构" in result ? result.结构 : undefined;
      case "自定义":
        return signedIndex(
          result.自定义元素[object.subtype] ?? [],
          object.rootIndex,
        );
      default:
        special = (result as any)[object.type] as string[];
        if (!Array.isArray(special)) return undefined;
        return signedIndex(special, object.index);
    }
  }

  /**
   * 给定一个条件，判断是否满足
   *
   * @param condition - 条件
   * @param result - 中间结果
   * @param config - 配置
   * @param extra - 额外信息
   * @param totalMapping - 映射
   */
  满足(condition: 条件节点配置, result: 默认汉字分析) {
    const { object, operator } = condition;
    const target = this.寻找(object, result);
    const fn = this.谓词表[operator];
    if ("value" in condition) {
      return fn(target, condition.value, this.最终映射);
    }
    return fn(target, null, this.最终映射);
  }
}
