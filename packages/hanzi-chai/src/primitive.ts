import { min } from "lodash-es";
import { 图形盒子 } from "./affine.js";
import { 部件 } from "./component.js";
import { 复合体 } from "./compound.js";
import type { 变换器, 字形自定义, 字集指示, 模式, 节点 } from "./config.js";
import type {
  原始汉字数据,
  复合体数据,
  字形描述,
  标签字形描述,
  矢量图形数据,
  笔画块,
} from "./data.js";
import { 自定义元素 } from "./element.js";
import { 字库, type 字形 } from "./repertoire.js";
import { 字符, 字集过滤查找表 } from "./unicode.js";
import {
  default_err,
  ok,
  type Result,
  type 原始词典,
  所有源标签,
  排列组合,
  是源标签,
  模拟基本部件,
  type 源标签,
  type 源标签集合,
  type 自定义分析,
  type 自定义分析映射,
  type 词典,
} from "./utils.js";

// 变量映射：variable id -> 字符
type 变量映射 = Map<number, 字符>;

interface 字符与描述列表 {
  字符: 字符;
  描述列表: 标签字形描述[];
}

export interface 校验原始汉字数据 extends 原始汉字数据 {
  character: 字符;
}

class 原始字库 {
  private 字库查找: Map<number, 校验原始汉字数据>;
  constructor(字库: 原始汉字数据[]) {
    this.字库查找 = new Map();
    for (const data of 字库) {
      const 字符实例 = 字符.从码位创建(data.unicode);
      if (!字符实例.ok) continue;
      this.字库查找.set(data.unicode, { ...data, character: 字符实例.value });
    }
  }

  [Symbol.iterator](): Iterator<校验原始汉字数据> {
    return this.字库查找.values();
  }

  查询(字符实例: 字符): 校验原始汉字数据 | undefined {
    return this.字库查找.get(字符实例.toNumber());
  }

  校验(汉字: string): 校验原始汉字数据 | undefined {
    const 字符列表 = [...汉字];
    if (字符列表.length !== 1) return;
    return this.字库查找.get(汉字.codePointAt(0)!);
  }

  /**
   * 将原始字符集转换为字符集
   * 主要的工作是对每个字符，在数据库中的多个字形中选取一个
   *
   * @param 自定义描述 - 自定义字形
   * @param 标签列表 - 用户选择的标签
   *
   * 基本逻辑为，对于每个字符，
   * - 如果用户指定了字形，则使用用户指定的字形
   * - 如果用户指定的某个标签匹配上了这个字符的某个字形，则使用这个字形
   * - 如果都没有，就使用默认字形
   */
  确定(
    自定义描述: 字形自定义,
    变换器列表: 变换器[],
    字形来源列表: 源标签[],
  ): Result<字库, Error> {
    // 0. 将变换器转成用户自定义
    const 用户描述映射 = new Map<字符, 字形描述[]>();
    for (const [字符串, 描述列表] of Object.entries(自定义描述)) {
      const 字符 = this.校验(字符串)?.character;
      if (字符) 用户描述映射.set(字符, [...描述列表]);
    }
    this.应用变换器(用户描述映射, 变换器列表);
    // 1. 合并系统描述列表和用户描述列表
    const 描述列表映射 = new Map<字符, 标签字形描述[]>();
    for (const { character, glyphs } of this.字库查找.values()) {
      const 描述列表: 标签字形描述[] = [];
      const 已有来源 = new Set<源标签>();
      for (const 描述 of 用户描述映射.get(character) ?? []) {
        let 来源集合 = new Set((描述.tags ?? []).filter(是源标签));
        if (来源集合.size === 0) 来源集合 = new Set(所有源标签);
        const 是兼容码 = 已有来源.intersection(来源集合).size > 0;
        描述列表.push({ ...描述, tags: 来源集合, compat: 是兼容码 });
        [...来源集合].map((x) => 已有来源.add(x));
      }
      for (const 描述 of glyphs) {
        let 来源集合 = new Set((描述.tags ?? []).filter(是源标签));
        if (来源集合.size === 0) 来源集合 = new Set(所有源标签);
        const 独立来源集合 = 来源集合.difference(已有来源);
        if (独立来源集合.size > 0) {
          描述列表.push({ ...描述, tags: 独立来源集合, compat: false });
          [...独立来源集合].map((x) => 已有来源.add(x));
        }
      }
      描述列表映射.set(character, 描述列表);
    }
    // 2. 对字符集进行拓扑排序
    const 字符图 = new Map<字符, Set<字符>>();
    const 入度表 = new Map<字符, number>();
    const 无入度: 字符与描述列表[] = [];
    const 拓扑排序汉字: 字符与描述列表[] = [];
    for (const [码位, 字形列表] of 描述列表映射) {
      const 引用的其他字符 = new Set<字符>();
      for (const 字形 of 字形列表) {
        if (字形.type === "compound" || 字形.type === "spliced_component") {
          for (const 字符串 of 字形.operandList) {
            const 字符实例 = this.校验(字符串)?.character;
            if (!字符实例) return default_err(`无法找到字符: ${字符串}`);
            引用的其他字符.add(字符实例);
          }
        } else if (
          字形.type === "derived_component" ||
          字形.type === "identity"
        ) {
          const 字符实例 = this.校验(字形.source)?.character;
          if (!字符实例) return default_err(`无法找到字符: ${字形.source}`);
          引用的其他字符.add(字符实例);
        }
      }
      入度表.set(码位, 引用的其他字符.size);
      if (引用的其他字符.size === 0) {
        无入度.push({ 字符: 码位, 描述列表: 字形列表 });
      } else {
        for (const 其他字符 of 引用的其他字符) {
          if (!字符图.has(其他字符)) 字符图.set(其他字符, new Set());
          字符图.get(其他字符)!.add(码位);
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
        const 字形列表 = 描述列表映射.get(字)!;
        入度表.set(字, 入度表.get(字)! - 1);
        if (入度表.get(字) === 0) {
          无入度.push({ 字符: 字, 描述列表: 字形列表 });
        }
      }
    }
    if (拓扑排序汉字.length !== 描述列表映射.size) {
      const s = new Set(拓扑排序汉字.map((x) => x.字符));
      const missing = [...描述列表映射.keys()].filter((x) => !s.has(x));
      return default_err(
        `存在循环依赖的字符: ${missing.slice(0, 100).map(x => x.获取名称()).join(", ")}，共 ${missing.length} 个`,
      );
    }
    // 3. 将字形数据转化为字形
    const 字库实例 = new 字库();
    for (const { 字符, 描述列表 } of 拓扑排序汉字) {
      const 字形列表: 字形[] = [];
      for (const 描述 of 描述列表) {
        const 字形子列表 = this.渲染字形(字符, 描述, 字库实例);
        if (!字形子列表.ok) return 字形子列表;
        字形列表.push(...字形子列表.value);
      }
      if (字形列表.length === 0) {
        字形列表.push(
          new 部件(
            字符,
            new Set([所有源标签[0]!]),
            false,
            模拟基本部件().strokes,
          ),
        );
      }
      字库实例.添加(字符, 字形列表);
    }
    // 4. 最后根据当前字形来源列表过滤一次
    const 当前来源集合 = new Set(字形来源列表);
    const 过滤后字库 = new 字库();
    for (const { 字符, 字形列表 } of 字库实例) {
      const 过滤后字形列表: 字形[] = [];
      for (const 字形 of 字形列表) {
        const 选取 = 字形.标签集合.intersection(当前来源集合).size > 0;
        if (!选取) continue;
        过滤后字形列表.push(字形);
      }
      if (过滤后字形列表.length === 0) 过滤后字形列表.push(字形列表[0]!);
      let index = 0;
      过滤后字形列表.forEach((x) => {
        if (x instanceof 部件) {
          x.字形序号 = index;
          index += 1;
        }
      });
      过滤后字库.添加(字符, 过滤后字形列表);
    }
    return ok(过滤后字库);
  }

  /**
   * 在数据库上匹配模式到某个键（按需展开并递归调用自身），
   * 变量绑定为子键字符串。
   */
  模式匹配(字形: 字形描述, 模式: 模式, 变量映射: 变量映射) {
    if (字形.type !== "compound") return false;
    if (模式.operator !== 字形.operator) return false;
    if (模式.operandList.length !== 字形.operandList.length) return false;
    for (let i = 0; i < 模式.operandList.length; i++) {
      const 子模式 = 模式.operandList[i]!;
      const 如子部分 = this.校验(字形.operandList[i]!)?.character;
      if (!如子部分) return false;
      const 子部分 = 如子部分;
      if (typeof 子模式 === "string") {
        if (子部分.获取名称() !== 子模式) return false;
      } else if ("id" in 子模式) {
        const id = 子模式.id;
        const 已绑定 = 变量映射.get(id);
        if (已绑定 === undefined) {
          变量映射.set(id, 子部分);
        } else {
          if (已绑定 !== 子部分) return false;
        }
      } else {
        const 子字形列表 = this.字库查找.get(子部分.toNumber())?.glyphs;
        if (!子字形列表) return false;
        const 当前变量映射备份 = structuredClone(变量映射);
        let 至少有一个匹配成功 = false;
        for (const 子字形 of 子字形列表) {
          if (this.模式匹配(子字形, 子模式, 变量映射)) {
            至少有一个匹配成功 = true;
            break;
          }
          变量映射.clear();
          当前变量映射备份.forEach((value, key) => {
            变量映射.set(key, value);
          });
        }
        if (!至少有一个匹配成功) return false;
      }
    }
    return true;
  }

  /**
   * 把 replacement pattern / variable / string 扁平化并写入 dbOut，返回引用该子树的 key。
   * - 模式中的字符串直接视为已有的键引用
   * - 变量使用 varMap 中绑定的键
   * - 嵌套 pattern 递归生成子键
   */
  替换(
    项: 节点,
    变量映射: 变量映射,
    辅助字符映射: Map<字符, 字形描述[]>,
  ): Result<字形描述 | 字符, Error> {
    if (typeof 项 === "string") {
      const ch = this.校验(项)?.character;
      if (!ch) return default_err(`无法找到字符: ${项}`);
      return ok(ch);
    }
    if ("id" in 项) {
      const 取值 = 变量映射.get(项.id);
      if (!取值) return default_err(`未知的结构变量 ID: ${项.id}`);
      return ok(取值);
    }
    // 当前项是个模式
    const 部分列表: string[] = [];
    for (const 部分 of 项.operandList) {
      const result = this.替换(部分, 变量映射, 辅助字符映射);
      if (!result.ok) return result;
      if (result.value instanceof 字符) {
        部分列表.push(result.value.获取名称());
      } else {
        const 如码位 = 字符.获取自由字符();
        if (!如码位.ok) return 如码位;
        辅助字符映射.set(如码位.value, [result.value]);
        部分列表.push(如码位.value.获取名称());
      }
    }
    const 复合体: 复合体数据 = {
      type: "compound",
      operator: 项.operator,
      operandList: 部分列表,
    };
    return ok(复合体);
  }

  /**
   * 应用变换器到数据库，返回新的数据库。
   */
  应用变换器(自定义字形映射: Map<字符, 字形描述[]>, 变换器列表: 变换器[]) {
    const 辅助字符映射 = new Map<字符, 字形描述[]>();
    for (const { character, glyphs } of this.字库查找.values()) {
      const 增补列表: 字形描述[] = [];
      for (const 字形 of glyphs) {
        for (const 变换器 of 变换器列表) {
          const 变量映射: 变量映射 = new Map();
          if (this.模式匹配(字形, 变换器.from, 变量映射)) {
            const 新字形 = this.替换(变换器.to, 变量映射, 辅助字符映射);
            if (!新字形.ok) return 新字形;
            if (新字形.value instanceof 字符)
              return default_err("Unexpected string result");
            增补列表.push(新字形.value);
          }
        }
      }
      if (增补列表.length > 0) {
        const 自定义字形列表 = 自定义字形映射.get(character);
        if (自定义字形列表) 自定义字形列表.push(...增补列表);
        else 自定义字形映射.set(character, 增补列表);
      }
    }
  }

  /**
   * 在字形列表中过滤得到符合该标签的所有字形
   */
  匹配标签(字形列表: 字形[], 标签: 源标签): number[] {
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
    字符实例: 字符,
    字形数据: 标签字形描述,
    字库: 字库,
  ): Result<字形[], Error> {
    if (字形数据.type === "basic_component") {
      return ok([
        new 部件(字符实例, 字形数据.tags, 字形数据.compat, 字形数据.strokes),
      ]);
    } else if (
      字形数据.type === "identity" ||
      字形数据.type === "derived_component"
    ) {
      const 源字符 = this.校验(字形数据.source)?.character;
      if (!源字符) return default_err(`无法找到字符: ${字形数据.source}`);
      const 引用字形列表 = 字库.查询字形(源字符);
      if (引用字形列表 === undefined)
        return default_err(`源部件 ${源字符.十六进制()} 不存在`);
      const 字形列表: 字形[] = [];
      const 反向映射: Map<number, 源标签集合> = new Map();
      for (const 标签 of 字形数据.tags) {
        const 过滤后字形列表 = this.匹配标签(引用字形列表, 标签);
        for (const 索引 of 过滤后字形列表) {
          if (!反向映射.has(索引)) 反向映射.set(索引, new Set([标签]));
          else 反向映射.get(索引)!.add(标签);
        }
      }
      // 重新构造
      for (const [索引, 标签集合] of 反向映射) {
        const 字形 = 引用字形列表[索引]!;
        if (字形数据.type === "identity") {
          if (字形 instanceof 部件) {
            字形列表.push(
              new 部件(字符实例, 标签集合, 字形数据.compat, 字形.矢量图形),
            );
          } else {
            字形列表.push(
              new 复合体(
                字符实例,
                标签集合,
                字形数据.compat,
                字形.结构描述字符,
                字形.部分列表,
                字形.笔顺,
              ),
            );
          }
        } else {
          let 引用矢量图形: 矢量图形数据;
          if (字形 instanceof 部件) {
            引用矢量图形 = 字形.矢量图形;
          } else {
            const 图形盒子实例 = 字库.递归渲染复合体(字形);
            if (!图形盒子实例.ok) return 图形盒子实例;
            引用矢量图形 = 图形盒子实例.value.获取笔画列表();
          }
          const 笔画列表: 矢量图形数据 = [];
          字形数据.strokes.forEach((x) => {
            if (x.feature === "reference") {
              const 源笔画 = 引用矢量图形[x.index];
              if (源笔画 === undefined) return; // 允许指标越界
              笔画列表.push(源笔画);
            } else {
              笔画列表.push(x);
            }
          });
          字形列表.push(
            new 部件(字符实例, 标签集合, 字形数据.compat, 笔画列表),
          );
        }
      }
      return ok(字形列表);
    } else {
      const 引用字形列表的列表: 字形[][] = [];
      for (const 部分名称 of 字形数据.operandList) {
        const 引用字符 = this.校验(部分名称)?.character;
        if (!引用字符) return default_err(`无法找到字符: ${部分名称}`);
        const 引用字形列表 = 字库.查询字形(引用字符);
        if (!引用字形列表) return default_err(`无法找到字符: ${部分名称}`);
        引用字形列表的列表.push(引用字形列表);
      }
      const 字形列表: 字形[] = [];
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
        const 部分列表: 字形[] = [];
        for (const [部分索引, 字形索引] of 组合.entries()) {
          部分列表.push(引用字形列表的列表[部分索引]![字形索引]!);
        }
        const 默认笔顺: 笔画块[] = 部分列表.map((_, index) => ({
          index,
          strokes: 0,
        }));
        // 接下来要分为复合体或拼接部件两种情况处理
        if (字形数据.type === "compound") {
          const 新字形 = new 复合体(
            字符实例,
            标签集合,
            字形数据.compat,
            字形数据.operator,
            部分列表,
            字形数据.order ?? 默认笔顺,
          );
          字形列表.push(新字形);
        } else {
          const 图形盒子列表: 图形盒子[] = [];
          for (const 字形 of 部分列表) {
            if (字形 instanceof 部件)
              图形盒子列表.push(图形盒子.从笔画列表构建(字形.矢量图形));
            else {
              // 尝试把复合体变成图形盒子
              const 如图形盒子 = 字库.递归渲染复合体(字形);
              if (!如图形盒子.ok) return 如图形盒子;
              图形盒子列表.push(如图形盒子.value);
            }
          }
          const 笔画列表 = 图形盒子
            .仿射合并({ ...字形数据, tags: [] }, 图形盒子列表)
            .获取笔画列表();
          字形列表.push(
            new 部件(字符实例, 字形数据.tags, 字形数据.compat, 笔画列表),
          );
        }
      }
      return ok(字形列表);
    }
  }

  校验自定义映射(自定义元素集合: Record<string, 自定义分析>) {
    const 自定义分析映射: 自定义分析映射 = new Map();
    const 自定义元素映射 = new Map<string, 自定义元素[]>();
    for (const [类别, 映射] of Object.entries(自定义元素集合)) {
      const 元素名称映射 = new Map<string, 自定义元素>();
      for (const [汉字, 元素名称列表] of Object.entries(映射)) {
        const 字符实例 = this.校验(汉字);
        if (!字符实例) continue;
        const 记录 =
          自定义分析映射.get(字符实例.character) ??
          new Map<string, 自定义元素[]>();
        const 元素列表: 自定义元素[] = [];
        for (const 元素名称 of 元素名称列表) {
          const 元素 =
            元素名称映射.get(元素名称) ?? new 自定义元素(类别, 元素名称);
          元素列表.push(元素);
          if (!元素名称映射.has(元素名称)) 元素名称映射.set(元素名称, 元素);
        }
        记录.set(类别, 元素列表);
        自定义分析映射.set(字符实例.character, 记录);
      }
      自定义元素映射.set(类别, [...元素名称映射.values()]);
    }
    return { 自定义分析映射, 自定义元素映射 };
  }

  校验词典(原始词典: 原始词典): 词典 {
    const result: 词典 = [];
    for (const { 词, ...rest } of 原始词典) {
      const 字符列表: 字符[] = [];
      let valid = true;
      for (const 字符 of [...词]) {
        const 字符实例 = this.校验(字符)?.character;
        if (字符实例) {
          字符列表.push(字符实例);
        } else {
          valid = false;
        }
      }
      if (valid) result.push({ 词: 字符列表, ...rest });
    }
    return result;
  }

  过滤词典(词典: 词典, 字集指示: 字集指示): 词典 {
    const 过滤函数 = 字集过滤查找表[字集指示]!;
    const result: 词典 = [];
    for (const 条目 of 词典) {
      let valid = true;
      for (const 汉字 of 条目.词) {
        const 汉字数据 = this.查询(汉字);
        if (!汉字数据) continue;
        if (!过滤函数(汉字数据.character, 汉字数据)) valid = false;
      }
      if (valid) result.push(条目);
    }
    return result;
  }

  获取汉字集合(词典: 词典): Set<字符> {
    const 字符集合 = new Set<字符>();
    for (const { 词 } of 词典) {
      for (const 汉字 of 词) {
        const 汉字数据 = this.查询(汉字);
        if (!汉字数据) continue;
        字符集合.add(汉字);
      }
    }
    return 字符集合;
  }
}

export { 原始字库 };
