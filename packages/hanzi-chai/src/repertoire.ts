import { sortBy } from "lodash-es";
import { 图形盒子 } from "./affine.js";
import { type 分类器, 合并分类器, 默认分类器 } from "./classifier.js";
import type { 默认部件分析 } from "./component.js";
import { 部件图形 } from "./component.js";
import type {
  元素,
  决策,
  决策空间,
  分析配置,
  变换器,
  安排,
  模式,
  结构变量,
} from "./config.js";
import type {
  基本部件数据,
  复合体数据,
  字库数据,
  字形数据,
  汉字数据,
} from "./data.js";
import { 获取注册表 } from "./main.js";
import { default_err, ok, type Result, 和编码, 字数, 码 } from "./utils.js";

// 变量映射：variable id -> 绑定的子树 key
type 变量映射 = Map<number, string>;

interface 基本分析 {
  字根序列: string[];
}

interface 字形分析结果<
  部件分析 extends 基本分析 = 基本分析,
  复合体分析 extends 基本分析 = 基本分析,
> {
  部件分析结果: Map<string, 部件分析>;
  复合体分析结果: Map<string, 复合体分析>;
  字根笔画映射: Map<string, number[]>;
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
  字根图形映射: Map<string, 部件图形>;
  字根笔画映射: Map<string, number[]>;
}

class 字库 {
  private repertoire: 字库数据;

  constructor(repertoire: 字库数据 = {}) {
    this.repertoire = repertoire;
  }

  _get() {
    return this.repertoire;
  }

  查询字形(character: string): 字形数据 | undefined {
    return this.repertoire[character]?.glyph;
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
    const elements = [...字根决策.keys(), ...可选字根.keys()];
    const 分类器 = 合并分类器(分析配置.classifier);
    const 结果 = this.生成字根映射(elements, 分类器);
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
      字根图形映射: 结果.value.字根图形映射,
      字根笔画映射: 结果.value.字根笔画映射,
    });
  }

  /**
   * 确定需要分析的字符
   */
  获取待分析对象(汉字列表: Set<string>) {
    const 汉字队列 = [...汉字列表];
    const 部件与名称列表: [string, 基本部件数据][] = [];
    const 已知有用汉字 = new Set(汉字列表);
    const 反向复合体映射 = new Map<string, Set<string>>();
    const 无入度: string[] = [];
    while (汉字队列.length) {
      const 汉字 = 汉字队列.shift()!;
      const 字形 = this.repertoire[汉字]!.glyph;
      if (字形.type === "compound") {
        字形.operandList.forEach((部分) => {
          if (!已知有用汉字.has(部分)) {
            已知有用汉字.add(部分);
            汉字队列.push(部分);
          }
          if (!反向复合体映射.has(部分)) {
            反向复合体映射.set(部分, new Set());
          }
          反向复合体映射.get(部分)!.add(汉字);
        });
      } else {
        部件与名称列表.push([汉字, 字形]);
        无入度.push(汉字);
      }
    }
    // 对字符集进行拓扑排序，得到复合体的拆分顺序
    const 部件列表 = new Map(
      sortBy(部件与名称列表, (x) => x[1].strokes.length),
    );
    const 拓扑排序汉字: string[] = [];
    while (无入度.length) {
      const 汉字 = 无入度.shift()!;
      拓扑排序汉字.push(汉字);
      const 用到该字的复合体列表 = 反向复合体映射.get(汉字);
      if (用到该字的复合体列表 === undefined) continue;
      反向复合体映射.delete(汉字);
      for (const 复合体 of 用到该字的复合体列表) {
        const operands = (this.repertoire[复合体]!.glyph as 复合体数据)
          .operandList;
        if (operands.every((x) => !反向复合体映射.has(x))) {
          无入度.push(复合体);
        }
      }
    }
    const 复合体列表 = new Map(
      拓扑排序汉字
        .filter((x) => !部件列表.has(x))
        .map((x) => [x, this.repertoire[x]!.glyph as 复合体数据]),
    );
    return { 部件列表, 复合体列表 };
  }

  /**
   * 将所有的字根都计算成 ComputedComponent
   *
   * @param repertoire - 字符集
   * @param config - 配置
   *
   * @returns 所有计算后字根的列表
   */
  生成字根映射(elements: string[], classifier: 分类器) {
    const 字根图形映射: Map<string, 部件图形> = new Map();
    const 字根笔画映射: Map<string, number[]> = new Map();
    for (const root of elements) {
      const glyph = this.repertoire[root]?.glyph;
      if (glyph === undefined) continue;
      if (glyph.type === "basic_component") {
        字根图形映射.set(root, new 部件图形(root, glyph.strokes));
      } else {
        const 复合体 = this.递归渲染复合体(glyph);
        if (!复合体.ok) return 复合体;
        字根图形映射.set(root, new 部件图形(root, 复合体.value.获取笔画列表()));
      }
    }
    for (const [name, 部件图形] of 字根图形映射) {
      字根笔画映射.set(name, 部件图形.计算笔画序列(classifier));
    }
    return ok({ 字根图形映射, 字根笔画映射 });
  }

  /**
   * 将复合体递归渲染为 SVG 图形
   *
   * @param 复合体 - 复合体
   * @param repertoire - 原始字符集
   *
   * @returns SVG 图形或错误
   */
  递归渲染复合体(
    复合体: 复合体数据,
    图形缓存: Map<string, 图形盒子> = new Map(),
  ): Result<图形盒子, Error> {
    const 图形盒子列表: 图形盒子[] = [];
    for (const 部分 of 复合体.operandList) {
      const 字形数据 = this.repertoire[部分]?.glyph;
      if (字形数据 === undefined)
        return default_err(`无法找到字形数据: ${和编码(部分)}`);
      if (字形数据.type === "basic_component") {
        let 盒子 = 图形缓存.get(部分);
        if (盒子 === undefined) {
          盒子 = 图形盒子.从笔画列表构建(字形数据.strokes);
          图形缓存.set(部分, 盒子);
        }
        图形盒子列表.push(盒子);
      } else {
        const cache = 图形缓存.get(部分);
        if (cache !== undefined) {
          图形盒子列表.push(cache);
          continue;
        }
        const rendered = this.递归渲染复合体(字形数据, 图形缓存);
        if (!rendered.ok) return rendered;
        图形盒子列表.push(rendered.value);
        图形缓存.set(部分, rendered.value);
      }
    }
    return ok(图形盒子.仿射合并(复合体, 图形盒子列表));
  }

  /**
   * 将复合体递归渲染为 SVG 图形
   *
   * @param compound - 复合体
   * @param repertoire - 原始字符集
   *
   * @returns SVG 图形或错误
   */
  递归渲染笔画序列(
    compound: 复合体数据,
    sequenceCache: Map<string, string> = new Map(),
  ): Result<string, Error> {
    const sequences: string[] = [];
    for (const char of compound.operandList) {
      const glyph = this.repertoire[char]?.glyph;
      if (glyph === undefined)
        return default_err(`无法找到字形数据: ${char}（U+${码(char)}）`);
      if (glyph.type === "basic_component") {
        sequences.push(
          glyph.strokes.map((x) => 默认分类器[x.feature]).join(""),
        );
      } else {
        const cache = sequenceCache.get(char);
        if (cache !== undefined) {
          sequences.push(cache);
          continue;
        }
        const rendered = this.递归渲染笔画序列(glyph, sequenceCache);
        if (!rendered.ok) return rendered;
        sequences.push(rendered.value);
        sequenceCache.set(char, rendered.value);
      }
    }
    const { order } = compound;
    if (order === undefined) {
      return ok(sequences.join(""));
    } else {
      const merged: string[] = [];
      for (const { index, strokes } of order) {
        const seq = sequences[index];
        if (seq === undefined) continue;
        if (strokes === 0) {
          merged.push(seq);
        } else {
          merged.push(seq.slice(0, strokes));
          sequences[index] = seq.slice(strokes);
        }
      }
      return ok(merged.join(""));
    }
  }

  /**
   * 在数据库上匹配模式到某个键（按需展开并递归调用自身），
   * 变量绑定为子键字符串。
   */
  模式匹配(字符: string, 模式: 模式, 变量映射: 变量映射) {
    const 复合体 = this.查询字形(字符);
    if (!复合体 || 复合体.type !== "compound") return false;
    if (模式.operator !== 复合体.operator) return false;
    if (模式.operandList.length !== 复合体.operandList.length) return false;
    for (let i = 0; i < 模式.operandList.length; i++) {
      const 操作数 = 模式.operandList[i]!;
      const 子键 = 复合体.operandList[i]!;
      if (typeof 操作数 === "string") {
        if (子键 !== 操作数) return false;
      } else if ("id" in 操作数) {
        const id = 操作数.id;
        const 已绑定 = 变量映射.get(id);
        if (已绑定 === undefined) {
          变量映射.set(id, 子键);
        } else {
          if (已绑定 !== 子键) return false;
        }
      } else {
        // 嵌套 pattern，递归匹配对应的子键
        if (!this.模式匹配(子键, 操作数, 变量映射)) return false;
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
    目标字符: string | undefined,
    项: 模式 | 结构变量 | string,
    映射: 变量映射,
    生成计数: { c: number },
  ): Result<string, Error> {
    if (typeof 项 === "string") return ok(项);
    if ("id" in 项) {
      const 取值 = 映射.get(项.id);
      if (!取值) return default_err(`未知的结构变量 ID: ${项.id}`);
      return ok(取值);
    }
    // Pattern
    const 部分列表: string[] = [];
    for (const 部分 of 项.operandList) {
      const result = this.替换(undefined, 部分, 映射, 生成计数);
      if (!result.ok) return result;
      部分列表.push(result.value);
    }
    const 字符 = 目标字符 ?? String.fromCodePoint(生成计数.c++);
    const 复合体: 复合体数据 = {
      type: "compound",
      operator: 项.operator,
      operandList: 部分列表,
    };
    this.添加(字符, {
      unicode: 字符.codePointAt(0)!,
      gb2312: 0,
      tygf: 0,
      gf0014_id: null,
      gf3001_id: null,
      name: null,
      glyph: 复合体,
    });
    return ok(字符);
  }

  /**
   * 应用变换器到数据库，返回新的数据库。
   */
  应用变换器(变换器: 变换器): 字库 {
    const 匹配集合 = new Map<string, 变量映射>();
    let 新字符起始码位 = 0x100000;
    for (const 字符 of Object.keys(this.repertoire)) {
      const 码位 = 字符.codePointAt(0)!;
      if (码位 >= 0x100000) {
        新字符起始码位 = Math.max(新字符起始码位, 码位 + 1);
      }
      const 变量映射: 变量映射 = new Map();
      if (this.模式匹配(字符, 变换器.from, 变量映射)) {
        匹配集合.set(字符, 变量映射);
      }
    }
    const 输出数据库 = new 字库({ ...this.repertoire });
    const 生成计数 = { c: 新字符起始码位 };
    for (const [字符, 变量映射] of 匹配集合) {
      输出数据库.替换(字符, 变换器.to, 变量映射, 生成计数);
    }
    return 输出数据库;
  }

  /**
   * 对整个字符集中的字符进行拆分
   *
   * @param repertoire - 字符集
   * @param config - 配置
   */
  拆分(
    base: 字形分析基本配置,
    汉字集合: Set<string>,
  ): Result<字形分析结果, Error> {
    const { 分析配置, 决策, 决策空间 } = base;
    const config = this.准备字形分析配置(分析配置, 决策, 决策空间);
    if (!config.ok) return config;
    const configValue = config.value;
    const { 部件列表, 复合体列表 } = this.获取待分析对象(汉字集合);
    const 部件分析器 = 获取注册表().创建部件分析器(
      configValue.分析配置?.component_analyzer || "默认",
      configValue,
    )!;
    const 部件分析结果 = new Map<string, 基本分析 | 默认部件分析>();
    for (const [部件名称, 部件字形] of 部件列表) {
      const 分析 = 部件分析器.分析(部件名称, 部件字形);
      if (!分析.ok) return 分析;
      部件分析结果.set(部件名称, 分析.value);
    }
    const 复合体分析器 = 获取注册表().创建复合体分析器(
      configValue.分析配置?.compound_analyzer || "默认",
      configValue,
    )!;
    const 复合体分析结果 = new Map<string, 基本分析>();
    for (const [复合体名称, 复合体字形] of 复合体列表) {
      const 部分分析列表 = 复合体字形.operandList.map((部分) => {
        return 部件分析结果.get(部分) || 复合体分析结果.get(部分)!;
      });
      const 分析 = 复合体分析器.分析(复合体名称, 复合体字形, 部分分析列表);
      if (!分析.ok) return 分析;
      复合体分析结果.set(复合体名称, 分析.value);
    }
    return ok({
      部件分析结果,
      复合体分析结果,
      字根笔画映射: configValue.字根笔画映射,
    });
  }
}

// interface 动态拆分 {
//   汉字信息: {
//     汉字: string;
//     通规: 0 | 1 | 2 | 3;
//     gb2312: 0 | 1 | 2;
//     频率: number;
//     读音: {
//       拼音: string;
//       频率: number;
//       [key: string]: any;
//     }[];
//     字块: string[];
//   }[];
//   多字词信息: {
//     词: string;
//     频率: number;
//     读音: {
//       拼音: string;
//       [key: string]: any;
//     }[];
//   }[];
//   动态拆分: Record<string, string[][]>;
//   字根笔画: Record<string, number[]>;
// }

// export const dynamicAnalysis = (
//   repertoire: Repertoire,
//   config: AnalysisConfig,
//   characters: string[],
//   dictionary: Dictionary,
//   adaptedFrequency: Map<string, number>,
//   algebra: Algebra,
// ) => {
//   const rootMap = renderRootList(repertoire, [
//     ...config.决策.keys(),
//     ...config.可选字根.keys(),
//   ]);
//   const { components, compounds } = getRequiredTargets(
//     repertoire,
//     config,
//     characters,
//   );
//   const [componentResults, componentError] = disassembleComponents(
//     repertoire,
//     config,
//     components,
//     rootMap,
//   );

//   // 字块映射：把一个字表示为若干个字块
//   const segmentMap = new Map<string, string[]>();
//   // 动态拆分：一个字块有若干种拆分方式
//   const segmentDynamicAnalysis = new Map<string, string[][]>();
//   // 部首映射：只用于飞花
//   const bushouMap = new Map<string, string>();

//   // 处理部件作为字块的动态拆分，而字块映射是它自己
//   for (const [name, analysis] of componentResults) {
//     const maybeCustomDynamicAnalysis =
//       config.分析配置.dynamic_customize?.[name];
//     const dynamicAnalysis = analysis.schemes
//       .filter((x) => x.optional)
//       .map((x) => x.roots);
//     segmentDynamicAnalysis.set(
//       name,
//       maybeCustomDynamicAnalysis ?? dynamicAnalysis,
//     );
//     segmentMap.set(name, [name]);
//   }
//   const classifier = config.分类器;
//   const cachedGetSegment = (part: string, start: number, end?: number) => {
//     const character = repertoire[part]!;
//     const name = `${isPUA(part) ? character.name : part}.${start}-${end ?? 0}`;
//     if (segmentDynamicAnalysis.has(name)) {
//       return name;
//     }
//     if (character.glyph.type !== "basic_component") {
//       console.log(`Cannot segment non-basic component: ${part}`);
//       return name;
//     }
//     const glyph = (character.glyph as BasicComponent).strokes.slice(start, end);
//     const cache = new 部件图形(name, glyph);
//     console.log(
//       `Part: ${part} (${part.codePointAt(0)}) [${start}${end ? `-${end}` : ""}]`,
//     );
//     const analysis = cache.getComponentScheme(
//       rootMap,
//       config,
//       classifier,
//     ) as 部件分析;
//     segmentDynamicAnalysis.set(
//       name,
//       analysis.全部拆分方式.filter((x) => x.可用).map((x) => x.拆分方式),
//     );
//     segmentMap.set(name, [name]);
//     return name;
//   };

//   // 只用于飞花
//   const fullSegmentMap = new Map<string, string[]>(segmentMap.entries());

//   // 处理复合体的字块映射，如果它同时也作为字块，就处理它的动态拆分
//   for (const name of compounds) {
//     const glyph = repertoire[name]!.glyph as Compound;
//     const isCurrentRoots = config.决策.has(name);
//     const isOptionalRoots = config.可选字根.has(name);
//     // 如果复合体是必选字根，则直接视为一个字块
//     if (isCurrentRoots && !isOptionalRoots) {
//       segmentDynamicAnalysis.set(name, [[name]]);
//       segmentMap.set(name, [name]);
//       fullSegmentMap.set(name, [name]);
//       continue;
//     }

//     // 找出复合体对应的字块
//     const componentList: string[] = [];
//     const order =
//       glyph.order ??
//       glyph.operandList.map((_, i) => ({ index: i, strokes: 0 }));
//     if (config.分析配置.serializer === ("qingyun" as SerializerType)) {
//       const seenIndex = new Map<number, number>();
//       for (const { index, strokes } of order) {
//         const part = glyph.operandList[index]!;
//         if (strokes === 0) {
//           if (!seenIndex.has(index)) {
//             componentList.push(...segmentMap.get(part)!);
//           } else {
//             const start = seenIndex.get(index)!;
//             const name = cachedGetSegment(part, start);
//             componentList.push(name);
//           }
//         } else {
//           const start = seenIndex.get(index) ?? 0;
//           const end = start + strokes;
//           const name = cachedGetSegment(part, start, end);
//           componentList.push(name);
//           seenIndex.set(index, end);
//         }
//       }
//     } else if (config.分析配置.serializer === ("feihua" as SerializerType)) {
//       // 飞花需要处理部首
//       const sortedOperandList = sortBy(range(glyph.operandList.length), (i) =>
//         order.findIndex((b) => b.index === i),
//       ).map((i) => glyph.operandList[i]!);
//       const fullComponentList: string[] = [];
//       for (const child of sortedOperandList) {
//         fullComponentList.push(...fullSegmentMap.get(child)!);
//       }
//       fullSegmentMap.set(name, fullComponentList);
//       // 判断部首：第一个或最后一个恰好为一字根
//       const first = sortedOperandList[0]!;
//       const last = sortedOperandList.at(-1)!;
//       const firstDynamic = segmentDynamicAnalysis.get(first);
//       const lastDynamic = segmentDynamicAnalysis.get(last);
//       const res: string[] = [];
//       if (
//         /[⿴⿵⿶⿷⿸⿹⿺⿼⿽⿻]/.test(glyph.operator) &&
//         componentResults.has(glyph.operandList[0]!)
//       ) {
//         bushouMap.set(
//           name,
//           segmentDynamicAnalysis.get(glyph.operandList[0]!)![0]![0]!,
//         );
//         res.push(...glyph.operandList.slice(1));
//       } else if (
//         firstDynamic?.[0]?.length === 1 &&
//         lastDynamic?.[0]?.length === 1 &&
//         /[又]/.test(firstDynamic[0]![0]!)
//       ) {
//         bushouMap.set(name, lastDynamic[0]![0]!);
//         res.push(...sortedOperandList.slice(0, -1));
//       } else if (firstDynamic?.[0]?.length === 1) {
//         bushouMap.set(name, firstDynamic[0]![0]!);
//         res.push(...sortedOperandList.slice(1));
//       } else if (lastDynamic?.[0]?.length === 1) {
//         bushouMap.set(name, lastDynamic[0]![0]!);
//         res.push(...sortedOperandList.slice(0, -1));
//       } else {
//         const firstSegments = fullSegmentMap.get(first)!;
//         const segment = firstSegments[0]!;
//         const bushou = segmentDynamicAnalysis.get(segment)![0]![0]!;
//         bushouMap.set(name, bushou);
//         res.push(...sortedOperandList.slice(1));
//       }
//       if (res.length === 1) {
//         const only = res[0]!;
//         if (!compounds.includes(only)) {
//           componentList.push(...fullSegmentMap.get(only)!.slice(0, 2));
//         } else {
//           const subglyph = repertoire[only]!.glyph as Compound;
//           const order =
//             subglyph.order ??
//             subglyph.operandList.map((_, i) => ({ index: i, strokes: 0 }));
//           const sortedOperandList = sortBy(
//             range(subglyph.operandList.length),
//             (i) => order.findIndex((b) => b.index === i),
//           ).map((i) => subglyph.operandList[i]!);
//           for (const part of sortedOperandList) {
//             componentList.push(...fullSegmentMap.get(part)![0]!);
//           }
//         }
//       } else {
//         for (const child of res) {
//           componentList.push(fullSegmentMap.get(child)![0]!);
//         }
//       }
//     } else {
//       const sortedOperandList = sortBy(range(glyph.operandList.length), (i) =>
//         order.findIndex((b) => b.index === i),
//       ).map((i) => glyph.operandList[i]!);
//       for (const child of sortedOperandList) {
//         componentList.push(...segmentMap.get(child)!);
//       }
//     }
//     if (isOptionalRoots) {
//       let dynamic: string[][] = [[]];
//       for (const operand of componentList) {
//         const dynamicAnalysis = segmentDynamicAnalysis.get(operand)!;
//         dynamic = dynamic
//           .map((x) => dynamicAnalysis.map((y) => x.concat(y)))
//           .flat();
//       }
//       segmentDynamicAnalysis.set(name, [[name]].concat(dynamic));
//       segmentMap.set(name, [name]);
//     } else {
//       segmentMap.set(name, componentList);
//     }
//   }
//   const 汉字信息 = characters.map((x) => {
//     const readings = repertoire[x]?.readings ?? [];
//     const frequency = adaptedFrequency.get(x) ?? 0;
//     const frequencies = readings.map(({ pinyin, importance }) => {
//       const entry: any = {
//         拼音: pinyin,
//         频率: Math.round((frequency * importance) / 100),
//       };
//       for (const [name, rules] of Object.entries(algebra)) {
//         entry[name] = applyRules(name, rules, pinyin);
//       }
//       return entry;
//     });
//     return {
//       汉字: x,
//       通规: repertoire[x]!.tygf,
//       gb2312: repertoire[x]!.gb2312,
//       频率: frequency,
//       读音: frequencies,
//       字块: segmentMap.get(x) ?? [],
//       部首: bushouMap.get(x),
//     };
//   });
//   const 多字词信息 = dictionary.map(([word, syllables]) => {
//     const frequency = adaptedFrequency.get(word) ?? 0;
//     const readings = syllables.split(" ").map((pinyin) => {
//       const entry: any = {
//         拼音: pinyin,
//       };
//       for (const [name, rules] of Object.entries(algebra)) {
//         entry[name] = applyRules(name, rules, pinyin);
//       }
//       return entry;
//     });
//     return {
//       词: word,
//       频率: frequency,
//       读音: readings,
//     };
//   });

//   const 字根笔画 = new Map<string, number[]>();
//   for (const [name, component] of rootMap) {
//     字根笔画.set(
//       name,
//       component.glyph.map((x) => x.feature).map((x) => classifier[x]),
//     );
//   }

//   const result: 动态拆分 = {
//     汉字信息,
//     多字词信息,
//     动态拆分: Object.fromEntries(segmentDynamicAnalysis),
//     字根笔画: Object.fromEntries(字根笔画),
//   };
//   return result;
// };

export { 字库 };
export type { 基本分析, 字形分析结果, 字形分析配置 };
