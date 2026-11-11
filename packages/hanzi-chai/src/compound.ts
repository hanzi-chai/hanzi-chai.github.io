import { range, sortBy } from "lodash-es";
import type { 图形盒子 } from "./affine.js";
import {
  type 分析执行环境,
  字根存在,
  推导动态分析,
  选择分析,
} from "./analysis-execution.js";
import { type 分类器, 默认分类器 } from "./classifier.js";
import {
  冰雪飞花分析器,
  type 冰雪飞花部件分析,
  type 张码部件分析,
  计算张码补码,
  type 逸码部件分析,
  部件,
  type 首末取大部件分析,
  type 默认部件分析,
} from "./component.js";
import type { 复合体数据, 引用笔画块数据, 结构描述字符 } from "./data.js";
import { 二笔, 未知元素, 结构符元素 } from "./element.js";
import {
  type 基本部件分析,
  type 字形,
  type 字形分析配置,
  是复合体,
  是部件,
} from "./repertoire.js";
import {
  default_err,
  ok,
  type Result,
  仿射合并,
  type 优先表,
  type 字根,
  存在,
} from "./utils.js";

export interface 基本复合体分析 {
  字根序列: 字根[];
  复合体: 复合体;
}

class 复合体 {
  public readonly type = "compound";
  public id: number;
  public name: string | undefined;
  public gf0014_id: number | undefined;
  public gf3001_id: number | undefined;
  public 结构描述字符: 结构描述字符;
  public 笔画列表: 引用笔画块数据[];
  public 图形盒子: 图形盒子;
  public 标准笔顺: string;
  public ambiguous: boolean;

  constructor(
    数据: 复合体数据,
    public 部分列表: 字形[],
  ) {
    this.id = 数据.id;
    this.name = 数据.name;
    this.gf0014_id = 数据.gf0014_id;
    this.gf3001_id = 数据.gf3001_id;
    this.ambiguous = 数据.ambiguous;
    this.结构描述字符 = 数据.operator;
    this.笔画列表 = 数据.strokes?.length
      ? 数据.strokes
      : 部分列表.map((_, index) => ({ index }));
    this.图形盒子 = 仿射合并(
      部分列表.map((x) => x.图形盒子),
      数据.references,
      数据.operator,
      数据.strokes,
    );
    this.标准笔顺 = this.获取笔画序列(默认分类器).join("");
  }

  获取名称() {
    return `字形-${this.id}`;
  }

  替换分析部分(部分列表: 字形[]): 复合体 {
    // 融合只改变分部边界。沿用已经排版的图形、笔顺和原字形 ID。
    return Object.assign(Object.create(复合体.prototype) as 复合体, this, {
      部分列表,
    });
  }

  按首笔排序部分(): 字形[] {
    const 部分列表 = sortBy(range(this.部分列表.length), (i) =>
      this.笔画列表.findIndex((b) => b.index === i),
    ).map((i) => this.部分列表[i]!);
    return 部分列表;
  }

  获取笔画序列(classifier: 分类器) {
    return this.图形盒子.获取笔画列表().map((f) => classifier[f.feature]);
  }
}

abstract class 复合体分析器<
  部件分析 extends 基本部件分析 = 基本部件分析,
  复合体分析 extends 基本复合体分析 = 基本复合体分析,
> {
  public 部件分析结果: Map<部件, 部件分析> = new Map();
  public 动态部件分析结果: Map<部件, 优先表<部件分析>> = new Map();

  private 结构元素映射: Map<string, 结构符元素>;

  constructor(protected 配置: 字形分析配置) {
    this.结构元素映射 = new Map(
      [...配置.决策.keys(), ...配置.决策空间.keys()]
        .filter((元素): 元素 is 结构符元素 => 元素 instanceof 结构符元素)
        .map((元素) => [元素.获取名称(), 元素]),
    );
  }

  protected 获取结构(字形: 复合体) {
    return this.结构元素映射.get(字形.结构描述字符)!;
  }

  查找部件分析结果(部件: 部件, 环境?: 分析执行环境): 部件分析 | undefined {
    if (!环境) return this.部件分析结果.get(部件);
    const 候选 = this.动态部件分析结果.get(部件);
    return 候选 && 选择分析(候选, 环境);
  }

  查找字根(字形: 复合体, 环境?: 分析执行环境) {
    const 根 = this.配置.复合体字根映射.get(字形);
    return 根 !== undefined && 字根存在(this.配置, 根, 环境) ? 根 : undefined;
  }

  顺序取根(字形: 字形, 环境?: 分析执行环境): 字根[] {
    if (是部件(字形)) return this.查找部件分析结果(字形, 环境)!.字根序列;
    const 字根 = this.查找字根(字形, 环境);
    if (字根 !== undefined) return [字根];
    const 部分结果列表 = 字形.部分列表.map((子字形) => {
      let 字根序列: 字根[];
      let 部件分析: 部件分析 | undefined;
      if (是部件(子字形)) {
        部件分析 = this.查找部件分析结果(子字形, 环境);
        字根序列 = 部件分析!.字根序列;
      } else 字根序列 = this.顺序取根(子字形, 环境);
      return { 字根序列, 部件分析 };
    });
    return this.执行笔顺(部分结果列表, 字形.笔画列表);
  }

  执行笔顺(
    部分结果列表: {
      字根序列: 字根[];
      部件分析?: 部件分析;
    }[],
    笔顺: 引用笔画块数据[],
  ): 字根[] {
    const 字根序列: 字根[] = [];
    const 剩余字根序列列表 = 部分结果列表.map((x) => [...x.字根序列]);
    for (const { index, from, to } of 笔顺) {
      const 剩余部分 = 部分结果列表[index];
      const 剩余部分字根序列 = 剩余字根序列列表[index];
      if (剩余部分 === undefined || 剩余部分字根序列 === undefined) continue; // 忽略无效部分
      const 部件分析 = 剩余部分.部件分析;
      if (部件分析 === undefined || !("当前拆分方式" in 部件分析)) {
        字根序列.push(...剩余部分字根序列);
        剩余字根序列列表[index] = [];
      } else {
        const { 当前拆分方式 } = 部件分析 as any as 默认部件分析;
        const toTake = 当前拆分方式.拆分方式.filter(
          (x) =>
            x.笔画索引[0]! >= (from ?? 0) && x.笔画索引[0]! <= (to ?? Infinity),
        ).length;
        字根序列.push(...剩余部分字根序列.slice(0, toTake));
        剩余字根序列列表[index] = 剩余部分字根序列.slice(toTake);
      }
    }
    return 字根序列;
  }

  /**
   * 所有复合体分析器共用动态执行入口。
   */
  动态分析(字形: 复合体): Result<优先表<复合体分析>, Error> {
    return 推导动态分析((环境) => this.分析(字形, 环境));
  }

  分析(_: 复合体, _环境?: 分析执行环境): Result<复合体分析, Error> {
    return default_err("分析未实现");
  }
}

export interface 默认复合体分析 extends 基本复合体分析 {
  结构: 结构符元素;
}

class 默认复合体分析器 extends 复合体分析器<默认部件分析, 默认复合体分析> {
  static readonly type = "默认";

  override 顺序取根(字形: 字形, 环境?: 分析执行环境): 字根[] {
    if (是复合体(字形)) {
      const 静态拆分 = this.配置.自定义分析映射.get(字形);
      if (!环境 && 静态拆分) return 静态拆分;
      const 自定义拆分 =
        this.配置.动态自定义分析映射.get(字形) ??
        (静态拆分 ? [静态拆分] : undefined);
      if (环境 && 自定义拆分) {
        return 选择分析(
          自定义拆分.map((字根序列) => ({
            字根序列,
            条件列表: [...new Set(字根序列)]
              .filter((根) => this.配置.可选字根.has(根))
              .map(存在),
          })),
          环境,
        ).字根序列;
      }
    }
    return super.顺序取根(字形, 环境);
  }

  分析(复合体: 复合体, 环境?: 分析执行环境) {
    const 分析: 默认复合体分析 = {
      复合体,
      结构: this.获取结构(复合体),
      字根序列: [],
    };
    分析.字根序列.push(...this.顺序取根(复合体, 环境));
    return ok(分析);
  }
}

class 首末取大复合体分析器 extends 复合体分析器<
  首末取大部件分析,
  默认复合体分析
> {
  static readonly type = "首末取大";

  分析(复合体: 复合体, 环境?: 分析执行环境) {
    const 分析: 默认复合体分析 = {
      复合体,
      结构: this.获取结构(复合体),
      字根序列: [],
    };
    const 首末取大结果 = this.首末取大顺序取根(复合体, true, 环境);
    分析.字根序列.push(首末取大结果[0]!, 首末取大结果.at(-1)!);
    return ok(分析);
  }

  // 重写这个方法，考虑到首部件取大优先，末部件倒序取大
  首末取大顺序取根(字形: 字形, 末尾 = true, 环境?: 分析执行环境): 字根[] {
    if (是部件(字形)) {
      const 部件分析 = this.查找部件分析结果(字形, 环境)!;
      return 末尾 ? 部件分析.逆序取大字根序列 : 部件分析.正序取大字根序列;
    }
    const 字根 = this.查找字根(字形, 环境);
    if (字根 !== undefined) return [字根];
    const 排序部分列表 = 字形.按首笔排序部分();
    const 部分结果列表 = 字形.部分列表.map((子字形) => {
      let 部件分析: 首末取大部件分析 | undefined;
      const 当前是末尾 =
        排序部分列表.indexOf(子字形) === 排序部分列表.length - 1;
      if (是部件(子字形)) 部件分析 = this.查找部件分析结果(子字形, 环境);
      const 下一级末尾 = 当前是末尾 && 末尾;
      const 字根序列 = this.首末取大顺序取根(子字形, 下一级末尾, 环境);
      return { 字根序列, 部件分析 };
    });
    const result = this.执行笔顺(部分结果列表, 字形.笔画列表);
    return result;
  }
}

class 真码复合体分析器 extends 复合体分析器<默认部件分析> {
  static readonly type = "真码";

  分析(复合体: 复合体, 环境?: 分析执行环境) {
    const 分析: 基本复合体分析 = {
      复合体,
      字根序列: [],
    };
    const 字根 = this.查找字根(复合体, 环境);
    if (字根 !== undefined) {
      分析.字根序列.push(字根);
    } else {
      if (复合体.结构描述字符 === "⿶") {
        // 下包围结构优先取内部
        for (const 字形 of [...复合体.部分列表].reverse()) {
          分析.字根序列.push(...this.顺序取根(字形, 环境));
        }
      } else {
        for (const 字形 of 复合体.部分列表) {
          分析.字根序列.push(...this.顺序取根(字形, 环境));
        }
      }
    }
    return ok(分析);
  }
}

class 首右复合体分析器 extends 复合体分析器<默认部件分析> {
  static readonly type = "首右";

  分析(复合体: 复合体, 环境?: 分析执行环境) {
    const 分析: 基本复合体分析 = {
      复合体,
      字根序列: [],
    };
    const 字根 = this.查找字根(复合体, 环境);
    if (字根 !== undefined) {
      分析.字根序列.push(字根);
    } else {
      const [第一部, 第二部] = 复合体.按首笔排序部分();
      if (!第一部 || !第二部) return default_err(`${复合体.id} 缺少部分`);
      if (/[⿰⿲]/.test(复合体.结构描述字符)) {
        const 第一部字根序列 = this.顺序取根(第一部, 环境);
        const 第二部字根序列 = this.顺序取根(第二部, 环境);
        分析.字根序列 = [第一部字根序列[0]!, 第二部字根序列[0]!];
      } else {
        const 完整字根序列 = this.顺序取根(复合体, 环境);
        分析.字根序列 = [完整字根序列[0]!, 完整字根序列.at(-1)!];
      }
    }
    return ok(分析);
  }
}

class 二笔复合体分析器 extends 复合体分析器 {
  static readonly type = "二笔";

  取首根(字形: 字形, 环境?: 分析执行环境): Result<字根, Error> {
    if (是部件(字形)) {
      const 首根 = this.查找部件分析结果(字形, 环境)?.字根序列[0];
      return 首根 === undefined
        ? default_err(`${字形.id} 查询不到首根`)
        : ok(首根);
    }
    const 字根 = this.查找字根(字形, 环境);
    if (字根 !== undefined) return ok(字根);
    const 第一部 = 字形.按首笔排序部分()[0];
    if (!第一部) return default_err(`${字形.id} 缺少部分`);
    return this.取首根(第一部, 环境);
  }

  分析(复合体: 复合体, 环境?: 分析执行环境): Result<基本复合体分析, Error> {
    const 分析: 基本复合体分析 = { 复合体, 字根序列: [] };
    const 字根 = this.查找字根(复合体, 环境);
    if (字根 !== undefined) {
      分析.字根序列.push(字根);
      return ok(分析);
    }
    const 排序部分结果 = 复合体.按首笔排序部分();
    if (排序部分结果.length === 3) {
      for (const 部分 of 排序部分结果) {
        const 首根 = this.取首根(部分, 环境);
        if (!首根.ok) return 首根;
        分析.字根序列.push(首根.value);
      }
    } else {
      const [第一部, 第二部] = 排序部分结果;
      if (!第一部 || !第二部) return default_err(`${复合体.id} 缺少部分`);
      const 首根 = this.取首根(第一部, 环境);
      if (!首根.ok) return 首根;
      分析.字根序列.push(首根.value);
      if (是部件(第二部)) {
        const 部件分析 = this.查找部件分析结果(第二部, 环境);
        if (!部件分析) return default_err(`${第二部.id} 查询不到`);
        分析.字根序列.push(...部件分析.字根序列);
      } else {
        const 第二部字根 = this.查找字根(第二部, 环境);
        if (第二部字根 !== undefined) {
          分析.字根序列.push(第二部字根);
        } else {
          const [第二部之一, 第二部之二] = 第二部.按首笔排序部分();
          if (!第二部之一 || !第二部之二)
            return default_err(`${复合体.id} 缺少部分`);
          for (const 部分 of [第二部之一, 第二部之二]) {
            const 首根 = this.取首根(部分, 环境);
            if (!首根.ok) return 首根;
            分析.字根序列.push(首根.value);
          }
        }
      }
    }
    return ok(分析);
  }
}

interface 星空键道复合体分析 extends 基本复合体分析 {
  首部字根序列: 字根[];
  余部字根序列: 字根[];
}

class 星空键道复合体分析器 extends 复合体分析器<
  默认部件分析,
  星空键道复合体分析
> {
  static readonly type = "星空键道";

  分析(复合体: 复合体, 环境?: 分析执行环境) {
    const 分析: 星空键道复合体分析 = {
      复合体,
      字根序列: [],
      首部字根序列: [],
      余部字根序列: [],
    };
    const 字根 = this.查找字根(复合体, 环境);
    if (字根 !== undefined) {
      分析.字根序列.push(字根);
      return ok(分析);
    }
    分析.字根序列 = this.顺序取根(复合体, 环境);
    if (复合体.笔画列表[0]?.index === 1) {
      // 第一个书写的部分只写了一笔，视同独体字取码
    } else {
      const 排序部分结果 = 复合体.按首笔排序部分();
      for (const [index, part] of 排序部分结果.entries()) {
        if (index === 0) {
          分析.首部字根序列.push(...this.顺序取根(part, 环境));
        } else {
          分析.余部字根序列.push(...this.顺序取根(part, 环境));
        }
      }
    }
    return ok(分析);
  }
}

interface 张码复合体分析 extends 基本复合体分析 {
  结构符: 结构描述字符;
  补码: 二笔;
  准码元: 未知元素;
}

class 张码复合体分析器 extends 复合体分析器<张码部件分析, 张码复合体分析> {
  static readonly type = "张码";

  顺序取根(字形: 字形, 环境?: 分析执行环境): 字根[] {
    if (是部件(字形)) return this.查找部件分析结果(字形, 环境)!.字根序列;
    const 字根 = this.查找字根(字形, 环境);
    if (字根 !== undefined) return [字根];
    const 部分结果列表 = 字形.部分列表.map((子字形) => {
      let 字根序列: 字根[];
      if (是部件(子字形)) {
        const 部件分析 = this.查找部件分析结果(子字形, 环境);
        字根序列 = 部件分析!.字根序列;
      } else 字根序列 = this.顺序取根(子字形, 环境);
      return 字根序列;
    });
    if (字形.结构描述字符 === "⿶") {
      // 下包围结构优先取内部
      return 部分结果列表.reverse().flat();
    } else {
      return 部分结果列表.flat();
    }
  }

  分析(复合体: 复合体, 环境?: 分析执行环境) {
    const 分析: 张码复合体分析 = {
      复合体,
      字根序列: [],
      结构符: 复合体.结构描述字符,
      补码: 二笔.创建(1, 1),
      准码元: new 未知元素("false"),
    };
    const 字根 = this.查找字根(复合体, 环境);
    if (字根 !== undefined) {
      分析.字根序列.push(字根);
    } else {
      const 展开部分列表 = this.展开嵌套上下和左右结构(复合体, 环境);
      if (/[⿱⿳]/.test(复合体.结构描述字符)) {
        分析.字根序列 = this.上下结构取码规则(展开部分列表, 环境);
      } else if (/[⿰⿲]/.test(复合体.结构描述字符)) {
        分析.字根序列 = this.左右结构取码规则(展开部分列表, 环境);
      } else {
        // 下包围和「竖折」笔画的左下包围优先取内部，其余取外部
        if (
          复合体.结构描述字符 === "⿶" ||
          (复合体.结构描述字符 === "⿺" && 复合体.部分列表[0]?.id === 0x31d7)
        ) {
          for (const part of [...复合体.部分列表].reverse())
            分析.字根序列.push(...this.顺序取根(part, 环境));
        } else {
          for (const part of 复合体.部分列表)
            分析.字根序列.push(...this.顺序取根(part, 环境));
        }
      }
    }
    分析.补码 = 计算张码补码(
      分析.字根序列,
      this.配置.分类器,
      复合体.结构描述字符,
    );
    return ok(分析);
  }

  展开嵌套上下和左右结构(复合体: 复合体, 环境?: 分析执行环境) {
    if (复合体.部分列表.length !== 2 || !/[⿰⿱]/.test(复合体.结构描述字符))
      return 复合体.部分列表;
    const 展开后: 字形[] = [];
    const regex = 复合体.结构描述字符 === "⿰" ? /[⿰⿲]/ : /[⿱⿳]/;
    for (const 字形 of 复合体.部分列表) {
      if (
        展开后.length < 2 &&
        !是部件(字形) &&
        regex.test(字形.结构描述字符) &&
        this.查找字根(字形, 环境) === undefined
      ) {
        展开后.push(...字形.部分列表);
      } else {
        展开后.push(字形);
      }
    }
    return 展开后;
  }

  寻找叠眼及其索引(部分列表: 字形[], 环境?: 分析执行环境) {
    // 叠眼不能是部件，不能是字根，必须是左右结构
    const index = 部分列表.findIndex(
      (x) =>
        !是部件(x) &&
        /[⿰⿲]/.test(x.结构描述字符) &&
        this.查找字根(x, 环境) === undefined,
    );
    return [部分列表.at(index) as 复合体 | undefined, index] as const;
  }

  上下结构取码规则(部分列表: 字形[], 环境?: 分析执行环境) {
    const 字根序列: 字根[] = [];
    const [叠眼, 叠眼索引] = this.寻找叠眼及其索引(部分列表, 环境);
    const 叠眼以上序列: 字根[] = [];
    let 叠眼展开: 字形[];
    switch (叠眼索引) {
      case -1: // 没有叠眼
        for (const 字形 of 部分列表)
          字根序列.push(...this.顺序取根(字形, 环境));
        break;
      case 0: // 叠眼在开头
        叠眼展开 = this.展开嵌套上下和左右结构(叠眼!, 环境);
        // 先取叠眼各部分的首根
        for (const [index, 部分分析] of 叠眼展开.entries()) {
          if (index >= 2 && index < 叠眼展开.length - 1) continue; // 叠眼只取一二末
          字根序列.push(this.顺序取根(部分分析, 环境)[0]!);
        }
        // 然后取剩余部分的首根和末根
        if (部分列表.length > 2) {
          字根序列.push(this.顺序取根(部分列表[1]!, 环境)[0]!);
          字根序列.push(this.顺序取根(部分列表.at(-1)!, 环境).at(-1)!);
        } else {
          字根序列.push(...this.首末(this.顺序取根(部分列表[1]!, 环境)));
        }
        break;
      default: // 叠眼在中间或末尾
        叠眼展开 = this.展开嵌套上下和左右结构(叠眼!, 环境);
        // 叠眼以上，最多可顺序取两根
        for (let index = 0; index < 叠眼索引; ++index) {
          叠眼以上序列.push(...this.顺序取根(部分列表[index]!, 环境));
        }
        字根序列.push(...叠眼以上序列.slice(0, 2));
        if (叠眼索引 + 1 < 部分列表.length) {
          // 叠眼在中间时：
          // 如果已取两根，则取叠眼首根和叠眼以下的末根
          // 如果只取了一根，则取叠眼第一部分的首根、叠眼最后一部分的首根、叠眼以下的末根
          字根序列.push(this.顺序取根(叠眼展开[0]!, 环境).at(0)!);
          if (字根序列.length === 2) {
            字根序列.push(this.顺序取根(叠眼展开.at(-1)!, 环境).at(0)!);
          }
          字根序列.push(this.顺序取根(部分列表.at(-1)!, 环境).at(-1)!);
        } else {
          // 叠眼在末尾时：按正常顺序取根
          字根序列.push(...this.顺序取根(叠眼!, 环境));
        }
    }
    return 字根序列;
  }

  左右结构取码规则(部分列表: 字形[], 环境?: 分析执行环境) {
    const 字根序列: 字根[] = [];
    const 左部 = 部分列表[0]!;
    let 左部是眼叠 = false;
    if (是复合体(左部) && /[⿱⿳]/.test(左部.结构描述字符)) {
      // 左部是叠型
      const 左部展开 = this.展开嵌套上下和左右结构(左部, 环境);
      const [叠眼, 叠眼索引] = this.寻找叠眼及其索引(左部展开, 环境);
      let 叠眼展开: 字形[];
      switch (叠眼索引) {
        case -1: // 没有叠眼
          break;
        case 0: // 叠眼在开头
          左部是眼叠 = true;
          // 取左部叠眼首部分和末部分的首根
          叠眼展开 = this.展开嵌套上下和左右结构(叠眼!, 环境);
          字根序列.push(this.顺序取根(叠眼展开[0]!, 环境)[0]!);
          字根序列.push(this.顺序取根(叠眼展开.at(-1)!, 环境)[0]!);
          // 取左部剩余部分的末根
          字根序列.push(this.顺序取根(左部展开.at(-1)!, 环境).at(-1)!);
          break;
        default: // 叠眼在中间或末尾
          叠眼展开 = this.展开嵌套上下和左右结构(叠眼!, 环境);
          左部是眼叠 = true;
          // 取叠眼以上部分的首根
          字根序列.push(this.顺序取根(左部展开[0]!, 环境)[0]!);
          // 取叠眼首部分的首根
          字根序列.push(this.顺序取根(叠眼展开[0]!, 环境)[0]!);
          // 叠眼在末尾时，取叠眼末部分的末根
          if (叠眼索引 === 左部展开.length - 1)
            字根序列.push(this.顺序取根(叠眼展开.at(-1)!, 环境).at(-1)!);
          // 叠眼在中间时，取左部末部分的末根
          else 字根序列.push(this.顺序取根(左部展开.at(-1)!, 环境).at(-1)!);
      }
    }
    if (左部是眼叠) {
      // 已经处理完左部，直接取右部末码即可
      字根序列.push(this.顺序取根(部分列表.at(-1)!, 环境).at(-1)!);
    } else {
      // 一般情况，左部、中部最多各取首尾两根
      let 余部开始索引 = 1;
      字根序列.push(...this.首末(this.顺序取根(左部, 环境)));
      if (部分列表.length > 2) {
        字根序列.push(...this.首末(this.顺序取根(部分列表[1]!, 环境)));
        余部开始索引 = 2;
      }
      // 如果左部和中部已经有 4 根，舍弃一根
      if (字根序列.length === 4) 字根序列.pop();
      for (const 部分分析 of 部分列表.slice(余部开始索引)) {
        字根序列.push(...this.顺序取根(部分分析, 环境));
      }
    }
    return 字根序列;
  }

  首末(x: 字根[]) {
    return x.length === 1 ? x : [x[0]!, x.at(-1)!];
  }
}

class 逸码复合体分析器 extends 复合体分析器<逸码部件分析> {
  static readonly type = "逸码";

  列举全部部件(复合体: 复合体, 环境?: 分析执行环境) {
    const 部件结果列表: 逸码部件分析[] = [];
    for (const 部分 of 复合体.部分列表) {
      if (部分 instanceof 部件) {
        部件结果列表.push(this.查找部件分析结果(部分, 环境)!);
      } else {
        const 部分结果 = this.列举全部部件(部分, 环境);
        部件结果列表.push(...部分结果);
      }
    }
    return 部件结果列表;
  }

  分析(复合体: 复合体, 环境?: 分析执行环境) {
    const 分析: 基本复合体分析 = {
      复合体,
      字根序列: [],
    };
    const 字根 = this.查找字根(复合体, 环境);
    if (字根 !== undefined) {
      分析.字根序列.push(字根);
      const 笔画序列 = 字根.获取笔画序列(this.配置.分类器);
      for (const 笔画 of 笔画序列) {
        分析.字根序列.push(二笔.创建(笔画, 0));
      }
      while (分析.字根序列.length < 6) {
        分析.字根序列.push(分析.字根序列.at(-1)!);
      }
      return ok(分析);
    }
    const 部件序列 = this.列举全部部件(复合体, 环境);
    const 最后索引 = 部件序列.length - 1;
    for (const [索引, 部分] of 部件序列.entries()) {
      if (分析.字根序列.length === 0) {
        分析.字根序列.push(...部分.余二拆分方式.字根);
        if (索引 === 最后索引) 分析.字根序列.push(...部分.余二拆分方式.补码);
      } else if (分析.字根序列.length === 1) {
        分析.字根序列.push(...部分.余一拆分方式.字根);
        if (索引 === 最后索引) 分析.字根序列.push(...部分.余一拆分方式.补码);
      } else {
        分析.字根序列.push(...部分.笔画拆分方式.字根);
        if (索引 === 最后索引) 分析.字根序列.push(...部分.笔画拆分方式.补码);
      }
    }
    return ok(分析);
  }
}

export const 冰雪飞花意符优先字 =
  "刈划刖列刘刮劝功孜对忌悲戏戕改攻敉敌敲斐斧欢欣欲歆汞畋瞽紊翔翡翮致蜚裴观贡败赦辈邓邛邝邯邺郅郝难雀雉靓项顺须顼颀颇飒鸡鸹鹆鹘";

interface 冰雪飞花复合体分析 extends 基本复合体分析 {
  部首?: 字根;
  余部: 字根[];
  常规字根序列?: 字根[];
}

interface 冰雪飞花部分信息 {
  部分: 字形;
  是单字根: boolean;
  首根: 字根;
}

class 冰雪飞花复合体分析器 extends 复合体分析器<
  冰雪飞花部件分析,
  冰雪飞花复合体分析
> {
  static readonly type = "冰雪飞花";
  static readonly 弱字根列表: string[] = ["又"];
  private 分析器: 冰雪飞花分析器;

  constructor(配置: 字形分析配置) {
    super(配置);
    this.分析器 = 冰雪飞花分析器.创建(配置);
  }

  是小集合字根(复合体: 复合体, 环境?: 分析执行环境) {
    const 字根 = this.查找字根(复合体, 环境);
    if (字根 !== undefined && this.分析器.当前在小集合(字根, 环境)) return 字根;
  }

  取全集合首根和余部(字形: 字形, 环境?: 分析执行环境): 冰雪飞花部分信息 {
    let 当前字形 = 字形;
    while (!是部件(当前字形)) {
      const 字根 = this.查找字根(当前字形, 环境);
      if (字根 !== undefined) {
        return {
          部分: 字形,
          是单字根: 当前字形 === 字形,
          首根: 字根,
        };
      } else {
        当前字形 = 当前字形.按首笔排序部分()[0]!;
      }
    }
    const 部件分析结果 = this.查找部件分析结果(当前字形, 环境);
    if (部件分析结果 === undefined)
      throw new Error(`部件 ${字形.id} 没有分析结果`);
    return {
      部分: 字形,
      是单字根: 当前字形 === 字形 && 部件分析结果.全集合字根序列.length === 1,
      首根: 部件分析结果.全集合字根序列[0]!,
    };
  }

  取余部(字形列表: 字形[], 环境?: 分析执行环境): 字根[] {
    if (字形列表.length >= 2) {
      const [第一部, 第二部] = 字形列表;
      const 第一部字根 = this.取小集合首根(第一部!, 环境);
      const 第二部字根 = this.取小集合首根(第二部!, 环境);
      return [第一部字根, 第二部字根];
    } else if (字形列表.length === 1) {
      const 字形 = 字形列表[0]!;
      if (是部件(字形)) {
        const 部件分析结果 = this.查找部件分析结果(字形, 环境);
        if (部件分析结果 === undefined)
          throw new Error(`部件 ${字形.id} 没有分析结果`);
        return 部件分析结果.字根序列.slice(0, 2);
      } else {
        const 字根 = this.是小集合字根(字形, 环境);
        if (字根) return [字根];
        return this.取余部(字形.按首笔排序部分(), 环境);
      }
    } else {
      throw new Error("没有余部");
    }
  }

  取小集合首根(字形: 字形, 环境?: 分析执行环境): 字根 {
    let 当前字形 = 字形;
    while (!是部件(当前字形)) {
      const 字根 = this.是小集合字根(当前字形, 环境);
      if (字根) return 字根;
      当前字形 = 当前字形.按首笔排序部分()[0]!;
    }
    const 部件分析结果 = this.查找部件分析结果(当前字形, 环境);
    if (部件分析结果 === undefined)
      throw new Error(`部件 ${字形.id} 没有分析结果`);
    return 部件分析结果.字根序列[0]!;
  }

  组合逻辑(
    复合体: 复合体,
    首部信息: 冰雪飞花部分信息,
    末部信息: 冰雪飞花部分信息,
    兼容优先 = true,
  ) {
    let 部首取法: "首" | "末";
    const 是包围结构 = /[⿴⿵⿶⿷⿸⿹⿺⿼⿽⿻]/.test(复合体.结构描述字符);
    // 包围结构二择一：外部是字根就一定取外部，不是就一定取内部
    if (是包围结构) {
      let 外部信息: 冰雪飞花部分信息;
      let 外部: "首" | "末", 内部: "首" | "末";
      if (复合体.部分列表[0] === 首部信息.部分) {
        外部信息 = 首部信息;
        外部 = "首";
        内部 = "末";
      } else {
        外部信息 = 末部信息;
        外部 = "末";
        内部 = "首";
      }
      if (外部信息.是单字根) 部首取法 = 外部;
      else 部首取法 = 内部;
    } else {
      if (首部信息.是单字根 && 末部信息.是单字根) {
        部首取法 =
          兼容优先 && this.配置.意符优先字形?.has(复合体.id) ? "末" : "首";
      } else if (首部信息.是单字根) {
        部首取法 = "首";
      } else if (末部信息.是单字根) {
        部首取法 = "末";
      } else {
        部首取法 = "首";
      }
    }
    return 部首取法;
  }

  分析(
    复合体: 复合体,
    环境?: 分析执行环境,
    兼容优先 = true,
  ): Result<冰雪飞花复合体分析, Error> {
    const 分析: 冰雪飞花复合体分析 = {
      复合体,
      字根序列: [],
      余部: [],
    };
    const 字根 = this.是小集合字根(复合体, 环境);
    if (字根 !== undefined) {
      分析.余部.push(字根);
    } else {
      const 按首笔排序列表 = 复合体.按首笔排序部分();
      const 首部 = 按首笔排序列表[0]!;
      const 末部 = 按首笔排序列表.at(-1)!;
      const 首部信息 = this.取全集合首根和余部(首部, 环境);
      const 末部信息 = this.取全集合首根和余部(末部, 环境);
      const 取法 = this.组合逻辑(复合体, 首部信息, 末部信息, 兼容优先);
      let 部首: 字根, 余部: 字根[];
      if (取法 === "首") {
        部首 = 首部信息.首根;
        余部 = this.取余部(按首笔排序列表.slice(1), 环境);
      } else {
        部首 = 末部信息.首根;
        余部 = this.取余部(按首笔排序列表.slice(0, -1), 环境);
      }
      分析.部首 = 部首;
      分析.余部.push(...余部);
    }
    if (分析.部首) 分析.字根序列.push(分析.部首);
    分析.字根序列.push(...分析.余部);
    if (兼容优先 && this.配置.意符优先字形?.has(复合体.id)) {
      const 常规 = this.分析(复合体, 环境, false);
      if (常规.ok) 分析.常规字根序列 = 常规.value.字根序列;
    }
    return ok(分析);
  }
}

export type { 冰雪飞花复合体分析, 复合体分析器, 星空键道复合体分析 };
export {
  二笔复合体分析器,
  冰雪飞花复合体分析器,
  复合体,
  张码复合体分析器,
  星空键道复合体分析器,
  真码复合体分析器,
  逸码复合体分析器,
  首右复合体分析器,
  首末取大复合体分析器,
  默认复合体分析器,
};
