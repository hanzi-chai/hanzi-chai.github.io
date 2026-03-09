import { min } from "lodash-es";
import { 图形盒子 } from "./affine.js";
import { 部件 } from "./component.js";
import { 复合体 } from "./compound.js";
import type { 变换器, 字形自定义, 模式, 节点 } from "./config.js";
import type {
  原始字库数据,
  原始汉字数据,
  标签字形数据,
  矢量图形数据,
  笔画块,
} from "./data.js";
import { 字库, 是部件, type 汉字数据, type 统一字形 } from "./repertoire.js";
import {
  default_err,
  ok,
  type Result,
  和编码,
  所有源标签,
  排列组合,
  是源标签,
  模拟基本部件,
  type 源标签,
  type 源标签集合,
} from "./utils.js";

// 变量映射：variable id -> 绑定的子树 key
type 变量映射 = Map<number, string>;

interface 字符与字形列表 {
  字符: string;
  字形列表: 标签字形数据[];
}

class 原始字库 {
  constructor(private 字库: 原始字库数据) {}

  _get(): 原始字库数据 {
    return this.字库;
  }

  查询(汉字: string): 原始汉字数据 | undefined {
    return this.字库[汉字];
  }

  /**
   * 将原始字符集转换为字符集
   * 主要的工作是对每个字符，在数据库中的多个字形中选取一个
   *
   * @param 自定义字形 - 自定义字形
   * @param 标签列表 - 用户选择的标签
   *
   * 基本逻辑为，对于每个字符，
   * - 如果用户指定了字形，则使用用户指定的字形
   * - 如果用户指定的某个标签匹配上了这个字符的某个字形，则使用这个字形
   * - 如果都没有，就使用默认字形
   */
  确定(
    自定义字形: 字形自定义 = {},
    变换器列表: 变换器[] = [],
  ): Result<字库, Error> {
    let 字形列表映射 = new Map<string, 标签字形数据[]>();
    // 1. 合并用户自定义
    for (const [字符, { glyphs }] of Object.entries(this.字库)) {
      const 字形列表: 标签字形数据[] = [];
      for (const 字形 of 自定义字形[字符] ?? []) {
        let tags = new Set((字形.tags ?? []).filter(是源标签));
        if (tags.size === 0) tags = new Set(所有源标签);
        字形列表.push({ ...字形, user: true, tags });
      }
      for (const 字形 of glyphs) {
        let tags = new Set((字形.tags ?? []).filter(是源标签));
        if (tags.size === 0) tags = new Set(所有源标签);
        字形列表.push({ ...字形, user: false, tags });
      }
      字形列表映射.set(字符, 字形列表);
    }
    // 2. 应用变换器
    for (const 变换器 of 变换器列表) {
      const result = this.应用变换器(字形列表映射, 变换器);
      if (!result.ok) return result;
      字形列表映射 = result.value;
    }
    // 3. 对字符集进行拓扑排序
    const 字符图 = new Map<string, Set<string>>();
    const 入度表 = new Map<string, number>();
    const 无入度: 字符与字形列表[] = [];
    const 拓扑排序汉字: 字符与字形列表[] = [];
    for (const [字符, 字形列表] of 字形列表映射) {
      const 引用的其他字符 = new Set<string>();
      for (const 字形 of 字形列表) {
        if (字形.type === "compound" || 字形.type === "spliced_component") {
          字形.operandList.forEach((部分) => {
            引用的其他字符.add(部分);
          });
        } else if (
          字形.type === "derived_component" ||
          字形.type === "identity"
        ) {
          引用的其他字符.add(字形.source);
        }
      }
      入度表.set(字符, 引用的其他字符.size);
      if (引用的其他字符.size === 0) {
        无入度.push({ 字符, 字形列表 });
      } else {
        for (const 其他字符 of 引用的其他字符) {
          if (!字符图.has(其他字符)) 字符图.set(其他字符, new Set());
          字符图.get(其他字符)!.add(字符);
        }
      }
    }
    while (无入度.length) {
      const x = 无入度.shift()!;
      const { 字符 } = x;
      拓扑排序汉字.push(x);
      const 用到该字的字列表 = 字符图.get(字符);
      if (用到该字的字列表 === undefined) continue;
      for (const 字 of 用到该字的字列表) {
        const 字形列表 = 字形列表映射.get(字)!;
        入度表.set(字, 入度表.get(字)! - 1);
        if (入度表.get(字) === 0) {
          无入度.push({ 字符: 字, 字形列表 });
        }
      }
    }
    if (拓扑排序汉字.length !== 字形列表映射.size) {
      const s = new Set(拓扑排序汉字.map((x) => x.字符));
      const missing = [...字形列表映射.keys()].filter((x) => !s.has(x));
      return default_err(
        `存在循环依赖的字符: ${missing.slice(0, 100).join(", ")}，共 ${missing.length} 个`,
      );
    }
    // 4. 将字形数据转化为字形
    const 确定字库 = new 字库();
    for (const { 字符, 字形列表 } of 拓扑排序汉字) {
      const { ambiguous: _, ...rest } = this.字库[字符]!;
      const 渲染后字形列表: 统一字形[] = [];
      for (const 字形 of 字形列表) {
        const 渲染后字形 = this.渲染字形(字符, 字形, 确定字库);
        if (!渲染后字形.ok) return 渲染后字形;
        渲染后字形列表.push(...渲染后字形.value);
      }
      if (渲染后字形列表.length === 0) {
        渲染后字形列表.push(
          new 部件(字符, new Set(["G"]), 模拟基本部件().strokes),
        );
      }
      const 确定汉字: 汉字数据 = {
        ...rest,
        glyphs: 渲染后字形列表,
      };
      确定字库.添加(字符, 确定汉字);
    }
    return ok(确定字库);
  }

  /**
   * 在数据库上匹配模式到某个键（按需展开并递归调用自身），
   * 变量绑定为子键字符串。
   */
  模式匹配(
    映射: Map<string, 标签字形数据[]>,
    字形: 标签字形数据,
    模式: 模式,
    变量映射: 变量映射,
  ) {
    if (字形.type !== "compound") return false;
    if (模式.operator !== 字形.operator) return false;
    if (模式.operandList.length !== 字形.operandList.length) return false;
    for (let i = 0; i < 模式.operandList.length; i++) {
      const 子模式 = 模式.operandList[i]!;
      const 子部分 = 字形.operandList[i]!;
      if (typeof 子模式 === "string") {
        if (子部分 !== 子模式) return false;
      } else if ("id" in 子模式) {
        const id = 子模式.id;
        const 已绑定 = 变量映射.get(id);
        if (已绑定 === undefined) {
          变量映射.set(id, 子部分);
        } else {
          if (已绑定 !== 子部分) return false;
        }
      } else {
        const 子字形列表 = 映射.get(子部分);
        if (!子字形列表) return false;
        const 当前变量映射备份 = structuredClone(变量映射);
        for (const 子字形 of 子字形列表) {
          if (this.模式匹配(映射, 子字形, 子模式, 变量映射)) return true;
          变量映射.clear();
          当前变量映射备份.forEach((value, key) => {
            变量映射.set(key, value);
          });
        }
        return false;
      }
    }
    return true;
  }

  /**
   * 把 replacement pattern / variable / string 扁平化并写入 dbOut，返回引用该子树的 key。
   * - 模式中的字符串直接视为已有的键引用
   * - 变量使用 varMap 中绑定的键
   * - 嵌套 pattern 递归生成子键
   *
   * TODO: 目前只处理了每个字的第一个字形
   */
  替换(
    字形映射: Map<string, 标签字形数据[]>,
    项: 节点,
    变量映射: 变量映射,
    生成计数: { c: number },
  ): Result<标签字形数据 | string, Error> {
    if (typeof 项 === "string") return ok(项);
    if ("id" in 项) {
      const 取值 = 变量映射.get(项.id);
      if (!取值) return default_err(`未知的结构变量 ID: ${项.id}`);
      return ok(取值);
    }
    // 当前项是个模式
    const 部分列表: string[] = [];
    for (const 部分 of 项.operandList) {
      const result = this.替换(字形映射, 部分, 变量映射, 生成计数);
      if (!result.ok) return result;
      if (typeof result.value === "string") {
        部分列表.push(result.value);
      } else {
        const 字符 = String.fromCodePoint(生成计数.c++);
        字形映射.set(字符, [result.value]);
        部分列表.push(字符);
      }
    }
    const 复合体: 标签字形数据 = {
      type: "compound",
      operator: 项.operator,
      operandList: 部分列表,
      user: false,
      tags: new Set(所有源标签),
    };
    return ok(复合体);
  }

  /**
   * 应用变换器到数据库，返回新的数据库。
   */
  应用变换器(字形映射: Map<string, 标签字形数据[]>, 变换器: 变换器) {
    const 新映射 = new Map<string, 标签字形数据[]>();
    let 新字符起始码位 = 0x100000;
    for (const 字符 of 字形映射.keys()) {
      const 码位 = 字符.codePointAt(0)!;
      if (码位 >= 0x100000) 新字符起始码位 = Math.max(新字符起始码位, 码位 + 1);
    }
    const 生成计数 = { c: 新字符起始码位 };
    for (const [字符, 字形列表] of 字形映射) {
      const 新列表: 标签字形数据[] = [];
      for (const 字形 of 字形列表) {
        const 变量映射: 变量映射 = new Map();
        if (this.模式匹配(字形映射, 字形, 变换器.from, 变量映射)) {
          const 新字形 = this.替换(字形映射, 变换器.to, 变量映射, 生成计数);
          if (!新字形.ok) return 新字形;
          if (typeof 新字形.value === "string")
            return default_err("Unexpected string result");
          新列表.push(新字形.value);
        } else {
          新列表.push(字形);
        }
      }
      新映射.set(字符, 新列表);
    }
    return ok(新映射);
  }

  匹配标签(字形列表: 统一字形[], 标签: 源标签): number[] {
    const 索引列表: number[] = [];
    let 最佳优先级 = Infinity;
    let 备用索引 = -1;
    for (const [索引, 字形] of 字形列表.entries()) {
      const 优先级 = min([...字形.标签集合].map((v) => 所有源标签.indexOf(v)))!;
      if (优先级 < 最佳优先级) {
        备用索引 = 索引;
        最佳优先级 = 优先级;
      }
      if (字形.标签集合.has(标签)) {
        索引列表.push(索引);
      }
    }
    if (索引列表.length === 0) {
      索引列表.push(备用索引);
    }
    return 索引列表;
  }

  /**
   * 递归渲染一个部件（基本部件或者衍生部件）
   * 如果是基本部件就直接返回，如果是衍生部件则先渲染源字的图形，然后解引用得到这个部件的图形
   *
   * @param component - 部件
   * @param repertoire - 原始字符集
   * @param 字形缓存 - 部件缓存
   *
   * @returns 部件的 SVG 图形
   */
  渲染字形(
    字符: string,
    字形数据: 标签字形数据,
    字库: 字库,
  ): Result<统一字形[], Error> {
    if (字形数据.type === "basic_component") {
      return ok([new 部件(字符, 字形数据.tags, 字形数据.strokes)]);
    } else if (字形数据.type === "derived_component") {
      const 基本部件 = 字库.查询字形(字形数据.source)?.find(是部件);
      if (基本部件 === undefined)
        return default_err(`源部件 ${和编码(字形数据.source)} 不存在`);
      const 笔画列表: 矢量图形数据 = [];
      字形数据.strokes.forEach((x) => {
        if (x.feature === "reference") {
          const 源笔画 = 基本部件.矢量图形[x.index];
          if (源笔画 === undefined) return; // 允许指标越界
          笔画列表.push(源笔画);
        } else {
          笔画列表.push(x);
        }
      });
      return ok([new 部件(字符, 字形数据.tags, 笔画列表)]);
    } else if (字形数据.type === "spliced_component") {
      const 部分列表: 图形盒子[] = [];
      for (const 部分 of 字形数据.operandList) {
        const 基本部件 = 字库.查询字形(部分)?.find(是部件);
        if (基本部件 === undefined)
          return default_err(`源部件 ${和编码(部分)} 不存在`);
        部分列表.push(图形盒子.从笔画列表构建(基本部件.矢量图形));
      }
      const 作为复合体 = {
        ...字形数据,
        type: "compound" as const,
        tags: [...字形数据.tags],
      };
      const 笔画列表 = 图形盒子.仿射合并(作为复合体, 部分列表).获取笔画列表();
      return ok([new 部件(字符, 字形数据.tags, 笔画列表)]);
    } else if (字形数据.type === "identity") {
      const 引用字形列表 = 字库.查询字形(字形数据.source);
      if (引用字形列表 === undefined)
        return default_err(`源部件 ${和编码(字形数据.source)} 不存在`);
      const 字形列表: 统一字形[] = [];
      const 反向索引映射: Map<number, 源标签集合> = new Map();
      for (const 标签 of 字形数据.tags) {
        const 索引列表 = this.匹配标签(引用字形列表, 标签);
        for (const 索引 of 索引列表) {
          if (!反向索引映射.has(索引)) 反向索引映射.set(索引, new Set([标签]));
          else 反向索引映射.get(索引)!.add(标签);
        }
      }
      for (const [index, 标签集合] of 反向索引映射) {
        const 字形 = 引用字形列表[index]!;
        if (字形 instanceof 部件) {
          字形列表.push(new 部件(字形.字符, 标签集合, 字形.矢量图形));
        } else {
          字形列表.push(
            new 复合体(
              字形.字符,
              标签集合,
              字形.结构表示符,
              字形.部分列表,
              字形.笔顺,
            ),
          );
        }
      }
      return ok(字形列表);
    } else {
      const 引用字形列表的列表 = 字形数据.operandList.map(
        (source) => 字库.查询字形(source)!,
      );
      const 约化字形列表: 统一字形[] = [];
      // 0-0: G
      const 反向索引映射: Map<string, 源标签集合> = new Map();
      for (const 标签 of 字形数据.tags) {
        const 索引列表列表: number[][] = [];
        for (const 字形列表 of 引用字形列表的列表) {
          const 索引列表 = this.匹配标签(字形列表, 标签);
          索引列表列表.push(索引列表);
        }
        for (const 组合 of 排列组合(索引列表列表)) {
          const 索引组合 = 组合.map(String).join(",");
          if (!反向索引映射.has(索引组合))
            反向索引映射.set(索引组合, new Set([标签]));
          else 反向索引映射.get(索引组合)!.add(标签);
        }
      }
      for (const [索引组合, 标签集合] of 反向索引映射) {
        const 组合 = 索引组合.split(",").map(Number);
        const 部分列表: 统一字形[] = [];
        for (const [部分索引, 字形索引] of 组合.entries()) {
          部分列表.push(引用字形列表的列表[部分索引]![字形索引]!);
        }
        const 默认笔顺: 笔画块[] = 部分列表.map((_, index) => ({
          index,
          strokes: 0,
        }));
        const 约化字形 = new 复合体(
          字符,
          标签集合,
          字形数据.operator,
          部分列表,
          字形数据.order ?? 默认笔顺,
        );
        约化字形列表.push(约化字形);
      }
      return ok(约化字形列表);
    }
  }
}

export { 原始字库 };
