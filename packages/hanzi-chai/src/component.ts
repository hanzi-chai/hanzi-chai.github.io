import type { Degenerator } from "./config.js";
import type { SVGGlyph, BasicComponent, Component } from "./data.js";
import { defaultDegenerator } from "./degenerator.js";
import { select, type 拆分方式 } from "./selector.js";
import { bisectLeft, bisectRight } from "d3-array";
import type { Feature, Classifier } from "./classifier.js";
import type { AnalysisConfig, 字库 } from "./repertoire.js";
import { isEqual } from "lodash-es";
import { isCollinear, sorted } from "./math.js";
import { 拓扑, 笔画图形 } from "./topology.js";
import { 区间 } from "./bezier.js";
import type { Result } from "./utils.js";

const strokeFeatureEqual = (
  degenerator: Degenerator,
  s1: Feature,
  s2: Feature,
) => {
  const feature = degenerator.feature ?? ({} as Record<Feature, Feature>);
  const d1 = feature[s1] ?? s1;
  const d2 = feature[s2] ?? s2;
  return d1 === d2;
};

/**
 * 计算后的部件
 *
 * 在基本部件 BasicComponent 的基础上，将 SVG 命令转换为参数曲线
 * 再基于参数曲线计算拓扑
 */
export class 部件图形 {
  name: string;
  private glyph: 笔画图形[];
  private topology: 拓扑;

  constructor(name: string, glyph: SVGGlyph) {
    this.name = name;
    this.glyph = glyph.map((x) => new 笔画图形(x));
    this.topology = new 拓扑(this.glyph);
  }

  getLength() {
    return this.glyph.length;
  }

  查询拓扑关系(i: number, j: number) {
    if (i <= j) {
      return this.topology.matrix[j][i];
    } else {
      return this.topology.matrix[i][j];
    }
  }

  具有同向笔画(i: number, j: number) {
    const [smaller, larger] = sorted([i, j]);
    return this.topology.orientedPairs.some((x) =>
      isEqual(x, [larger, smaller]),
    );
  }

  /**
   * 给定一个部件和一个字根，找出这个部件所有包含这个字根的方式
   * 如果部件不包含这个字根，就返回空列表
   *
   * @param config - 配置
   * @param component - 待拆分部件
   * @param root - 字根
   */
  generateSliceBinaries(root: 部件图形, degenerator: Degenerator) {
    const { glyph: cglyph, topology: ctopology } = this;
    const { glyph: rglyph, topology: rtopology } = root;
    if (cglyph.length < rglyph.length) return [];
    let queue = [[]] as number[][];
    for (const [rIndex, rStroke] of rglyph.entries()) {
      const rStrokeTopology = rtopology.matrix[rIndex]?.slice(0, rIndex);
      const end = cglyph.length - rglyph.length + rIndex + 1;
      for (let _ = queue.length; _ !== 0; --_) {
        const indexList = queue.shift()!;
        const start = indexList.length ? indexList.at(-1)! + 1 : 0;
        for (const [cIndex, cStroke] of cglyph.slice(start, end).entries()) {
          if (
            !strokeFeatureEqual(degenerator, cStroke.feature, rStroke.feature)
          )
            continue;
          const realIndex = cIndex + start;
          const cStrokeTopology = ctopology.matrix[realIndex]?.filter((_, i) =>
            indexList.includes(i),
          );
          if (!isEqual(cStrokeTopology, rStrokeTopology)) continue;
          queue.push(indexList.concat(realIndex));
        }
      }
      if (!queue) return [];
    }
    if (degenerator.no_cross) {
      const allindices = [...Array(cglyph.length).keys()];
      queue = queue.filter((indices) => {
        const others = allindices.filter((x) => !indices.includes(x));
        const allCombinations = indices.flatMap((x) =>
          others.map((y) => sorted([x, y])),
        );
        return allCombinations.every(([x, y]) => {
          const relation = ctopology.matrix[y]![x]!;
          return relation.every((cr) => cr.type !== "交");
        });
      });
    }
    return queue
      .filter((x) => this.verifySpecialRoots(root, x))
      .map(this.indicesToBinary);
  }

  /**
   * 根据一个部件中包含的所有字根的情况，导出所有可能的拆分方案
   *
   * @param strokes - 部件笔画数
   * @param roots - 部件包含的字根列表，其中每个字根用二进制表示
   *
   * 函数通过递归的方式，每次选取剩余部分的第一笔，然后在字根列表中找到包含这个笔画的所有字根
   * 将这些可能性与此前已经拆分的部分组合，得到新的拆分方案
   * 直到所有的笔画都使用完毕
   */
  generateSchemes = (roots: number[], requiredRoots: Set<number>) => {
    const strokes = this.getLength();
    const schemeList: number[][] = [];
    const total = (1 << strokes) - 1;
    const intervalSums = this.makeIntervalSum(requiredRoots);
    const combineNext = (
      partialSum: number,
      scheme: number[],
      revcumsum: number[],
    ) => {
      const restBin = total - partialSum;
      const restBin1st = 1 << (restBin.toString(2).length - 1);
      const start = bisectLeft(roots, restBin1st);
      const end = bisectRight(roots, restBin);
      for (const binary of roots.slice(start, end)) {
        if ((partialSum & binary) !== 0) continue;
        const newPartialSum = partialSum + binary;
        const newRevcumsum = revcumsum.map((x) => x + binary);
        const newScheme = scheme.concat(binary);
        if (newRevcumsum.some((x) => intervalSums.has(x))) {
          continue;
        }
        newRevcumsum.push(binary);
        if (newPartialSum === total) {
          schemeList.push(newScheme);
        } else {
          combineNext(newPartialSum, newScheme, newRevcumsum);
        }
      }
    };
    combineNext(0, [], []);
    return schemeList;
  };

  makeIntervalSum(rootsSet: Set<number>) {
    const strokes = this.getLength();
    const array = [...Array(strokes).keys()].map((x) => 1 << x).reverse();
    const intervalSums = new Set<number>();
    for (let start = 0; start !== strokes - 1; ++start) {
      let sum = array[start]!;
      for (let end = start + 1; end !== strokes; ++end) {
        sum += array[end]!;
        if (rootsSet.has(sum)) {
          intervalSums.add(sum);
        }
      }
    }
    return intervalSums;
  }

  indicesToBinary(indices: number[]) {
    const n = this.getLength();
    let binaryCode = 0;
    for (const index of indices) {
      binaryCode += 1 << (n - index - 1);
    }
    return binaryCode;
  }

  binaryToIndices(binary: number) {
    const n = this.getLength();
    const indices = [...Array(n).keys()];
    return indices.filter((index) => binary & (1 << (n - index - 1)));
  }

  /**
   * 对于一些特殊的字根，一般性的字根认同规则可能不足以区分它们，需要特殊处理
   * 这里判断了待拆分部件中的某些笔画究竟是不是这个字根
   *
   * @param component - 待拆分部件
   * @param root - 字根
   * @param indices - 笔画索引列表
   */
  verifySpecialRoots = (root: 部件图形, indices: number[]) => {
    if (["土", "士"].includes(root.name)) {
      const [i1, _, i3] = indices as [number, number, number];
      const upperHeng = this.glyph[i1]!.curveList[0]!;
      const lowerHeng = this.glyph[i3]!.curveList[0]!;
      const lowerIsLonger = upperHeng.length() < lowerHeng.length();
      return root.name === "土" ? lowerIsLonger : !lowerIsLonger;
    }
    if (["未", "末"].includes(root.name)) {
      const [i1, i2] = indices as [number, number];
      const upperHeng = this.glyph[i1]!.curveList[0]!;
      const lowerHeng = this.glyph[i2]!.curveList[0]!;
      const lowerIsLonger = upperHeng.length() < lowerHeng.length();
      return root.name === "未" ? lowerIsLonger : !lowerIsLonger;
    }
    if (["口", "囗"].includes(root.name)) {
      if (["囗", "\ue02d"].includes(this.name)) {
        return root.name === "囗";
      }
      const [i1, _, i3] = indices as [number, number, number];
      const upperLeft = this.glyph[i1]!.curveList[0]!.evaluate(0);
      const lowerRight = this.glyph[i3]!.curveList[0]!.evaluate(1);
      const xrange = new 区间(upperLeft[0], lowerRight[0]);
      const yrange = new 区间(upperLeft[1], lowerRight[1]);
      const otherStrokes = this.glyph.filter(
        (_, index) => !indices.includes(index),
      );
      const containsStroke = otherStrokes.some((stroke) =>
        stroke.isBoundedBy(xrange, yrange),
      );
      return root.name === "囗" ? containsStroke : !containsStroke;
    }
    if (["\ue087" /* 木无十 */, "\ue43d" /* 全字头 */].includes(root.name)) {
      const [i1] = indices as [number];
      const attachPoint = this.glyph[i1]!.curveList[0]!.evaluate(0);
      const otherStrokes = this.glyph.filter(
        (_, index) => !indices.includes(index),
      );
      const otherCurves = otherStrokes.flatMap((s) => s.curveList);
      const pieAndNaIsSeparated = otherCurves.some(
        (x) =>
          x.getType() === "linear" &&
          isCollinear(x.evaluate(0), x.evaluate(1), attachPoint),
      );
      return root.name === "\ue087"
        ? pieAndNaIsSeparated
        : !pieAndNaIsSeparated;
    }
    return true;
  };

  getRootMap(
    rootData: Map<string, 部件图形>,
    degenerator: Degenerator,
    classifier: Classifier,
  ) {
    const rootMap = new Map<number, string>(
      this.glyph.map((stroke, index) => {
        const binary = 1 << (this.getLength() - 1 - index);
        return [binary, classifier[stroke.feature].toString()];
      }),
    );
    for (const root of rootData.values()) {
      const binaries = this.generateSliceBinaries(root, degenerator);
      binaries.map((binary) => rootMap.set(binary, root.name));
    }
    return rootMap;
  }

  /**
   * 通过自动拆分算法，给定字根列表，对部件进行拆分
   * @param component - 部件
   * @param rootData - 字根列表
   * @param config - 配置
   * @param classifier - 笔画分类器
   *
   * 如果拆分唯一，则返回拆分结果；否则返回错误
   *
   * @returns 拆分结果
   * @throws Error 无拆分方案
   * @throws Error 多个拆分方案
   */
  getComponentScheme(
    rootMap: Map<string, 部件图形>,
    config: AnalysisConfig,
  ): 部件分析 | Error {
    const currentRoots = new Set([...config.roots.keys()]);
    const optionalRoots = new Set([...config.optionalRoots.keys()]);
    const requiredRoots = new Set(
      [...currentRoots].filter((x) => !optionalRoots.has(x)),
    );
    const degenerator = config.analysis?.degenerator ?? defaultDegenerator;
    const localRootMap = this.getRootMap(
      rootMap,
      degenerator,
      config.classifier,
    );
    const reversedRootMap = new Map<string, number[][]>();
    for (const [binary, name] of localRootMap) {
      const prevList = reversedRootMap.get(name);
      const indices = this.binaryToIndices(binary);
      if (indices.length === 1) continue;
      if (prevList !== undefined) {
        prevList.push(indices);
      } else {
        reversedRootMap.set(name, [indices]);
      }
    }
    if (requiredRoots.has(this.name)) {
      const sd: SchemeWithData = {
        拆分方式: [
          {
            名称: this.name,
            笔画索引: [...Array(this.getLength()).keys()],
            笔画二进制表示: 1 << (this.getLength() - 1),
          },
        ],
        评价: new Map(),
        可用: true,
      };
      return {
        字根笔画映射: reversedRootMap,
        当前拆分方式: sd,
        全部拆分方式: [sd],
        部件图形: this,
        字根序列: [this.name],
      };
    }
    const roots = Array.from(localRootMap.keys()).sort((a, b) => a - b);
    const requiredRootsBinary = new Set(
      [...localRootMap]
        .filter(([_, v]) => requiredRoots.has(v))
        .map(([K, _]) => K),
    );
    const schemeList = this.generateSchemes(roots, requiredRootsBinary).map(
      (list) =>
        list.map((v) => ({
          名称: localRootMap.get(v)!,
          笔画索引: this.binaryToIndices(v),
          笔画二进制表示: v,
        })),
    );
    if (schemeList.length === 0) {
      return new Error();
    }
    const selectResult = select(
      config,
      this,
      schemeList,
      localRootMap,
      requiredRoots,
    );
    if (selectResult instanceof Error) {
      return selectResult;
    }
    const best = selectResult.find((x) =>
      x.拆分方式.every((y) => currentRoots.has(y.名称) || /\d/.test(y.名称)),
    )!;
    const sequence = best.拆分方式.map(
      (n) => localRootMap.get(n.笔画二进制表示)!,
    );
    return {
      字根序列: sequence,
      部件图形: this,
      字根笔画映射: reversedRootMap,
      当前拆分方式: best,
      全部拆分方式: selectResult,
    };
  }
}

export interface SchemeWithData {
  拆分方式: 拆分方式;
  评价: Map<string, number[]>;
  可用: boolean;
}

export interface 基本分析 {
  字根序列: string[];
  额外信息?: Record<string, any>;
}

/**
 * 部件通过自动拆分算法分析得到的拆分结果的全部细节
 */
export interface 部件分析 extends 基本分析 {
  部件图形: 部件图形;
  字根笔画映射: Map<string, number[][]>;
  当前拆分方式: SchemeWithData;
  全部拆分方式: SchemeWithData[];
}

export type 部件分析结果 = Map<string, 部件分析>;

export interface 部件分析器 {
  /**
   * 对所有部件进行拆分
   *
   * @param repertoire - 字符集
   * @param config - 配置
   *
   * @returns 拆分结果和无法拆分的汉字列表
   */
  分析(部件映射: Map<string, BasicComponent>): Result<部件分析结果>;
}

export class 默认部件分析器 implements 部件分析器 {
  static readonly type = "默认";
  constructor(
    private config: AnalysisConfig,
    private rootMap: Map<string, 部件图形>,
  ) {}

  分析(部件映射: Map<string, BasicComponent>) {
    const result: [string, 部件分析][] = [];
    for (const [name, glyph] of 部件映射) {
      const 图形 = this.rootMap.get(name) ?? new 部件图形(name, glyph.strokes);
      const scheme = 图形.getComponentScheme(this.rootMap, this.config);
      if (scheme instanceof Error) return scheme;
      result.push([name, scheme]);
    }
    return new Map(result);
  }
}

export class 二笔部件分析器 implements 部件分析器 {
  static readonly type = "二笔";
  constructor(
    private config: AnalysisConfig,
    private rootMap: Map<string, 部件图形>,
  ) {}

  分析(部件映射: Map<string, BasicComponent>) {
    const result: Map<string, 部件分析> = new Map();
    const 笔画分类器 = this.config.classifier;
    for (const [名称, 部件] of 部件映射) {
      const 笔画列表 = 部件.strokes;
      const 第一笔 = 笔画列表[0]!;
      const 第二笔 = 笔画列表[1];
      const 第一笔类别 = 笔画分类器[第一笔.feature].toString();
      const 第二笔类别 = 第二笔 ? 笔画分类器[第二笔.feature].toString() : "0";
      const 字根序列 = [第一笔类别 + 第二笔类别];
      if (笔画列表.length > 2) {
        const 末笔 = 笔画列表.at(-1)!;
        const 末笔类别 = 笔画分类器[末笔.feature].toString();
        字根序列.push(末笔类别);
      }
      result.set(名称, { 字根序列 });
    }
    return new Map(result);
  }
}

// if (serializerName === "xkjd") {
//   for (const [_, result] of componentResults.entries()) {
//     result.sequence = limit(result.sequence, 4, config);
//   }
// } else if (serializerName === "snow2") {
//   for (const [key, result] of componentResults.entries()) {
//     result.sequence = result.sequence.slice(0, 1);
//     if (result.sequence[0] !== key) result.sequence.push("");
//   }
// } else if (serializerName === "feihua") {
//   for (const [key, result] of componentResults.entries()) {
//     if ("schemes" in result) {
//       const dc = config.analysis?.dynamic_customize ?? {};
//       const schemeList =
//         dc[key] ??
//         result.schemes.filter((x) => x.optional).map((x) => x.roots);
//       const scheme = schemeList.find((x) =>
//         x.every((r) => {
//           let value = config.roots.get(r)!;
//           while (isMerge(value)) {
//             value = config.roots.get(value.element)!;
//           }
//           return /[aoeiuv;/]/.test(value as string);
//         }),
//       )!;
//       // @ts-ignore
//       result.full2 = scheme;
//       result.sequence = scheme.slice(0, 3);
//     } else {
//       // @ts-ignore
//       result.full2 = [...result.full];
//     }
//   }
// }

// if (serializerName === "feihua") {
//   const rawOperandResults = glyph.operandList.map(getResult);
//   const operandResults = rawOperandResults as PartitionResult[];
//   const serialization = serializer(operandResults, glyph, config);
//   serialization.full = [char];
//   let value = config.roots.get(char)!;
//   while (isMerge(value)) {
//     value = config.roots.get(value.element)!;
//   }
//   if (/[aoeiuv;/]/.test(value as string)) {
//     // @ts-ignore
//     serialization.full2 = [char];
//   }
//   compoundResults.set(char, serialization);
//   continue;
// }
// // 复合体本身是一个字根
// const sequence = [char];
// if (serializerName === "snow2") {
//   sequence.push("q");
// }
