import type { AnalysisConfig } from "./repertoire";
import { affineMerge } from "./affine";
import type {
  ComponentResults,
  ComponentAnalysis,
  CommonAnalysis,
} from "./component";
import { InvalidGlyphError } from "./component";
import type {
  Compound,
  Repertoire,
  Operator,
  SVGGlyph,
  CompoundCharacter,
} from "./data";
import type { CornerSpecifier } from "./topology";

export type CompoundResults = Map<string, CompoundAnalysis>;

type PartitionResult = ComponentAnalysis | CompoundAnalysis;

export type CompoundAnalysis = CompoundBasicAnalysis | CompoundGenuineAnalysis;

/**
 * 复合体本身是字根字，没有拆分细节
 */
interface CompoundBasicAnalysis extends CommonAnalysis {
  operator: Operator;
}

/**
 * 复合体通过自动拆分算法导出的拆分结果
 */
interface CompoundGenuineAnalysis extends CompoundBasicAnalysis {
  operandResults: PartitionResult[];
}

/**
 * 将复合体递归渲染为 SVG 图形
 *
 * @param compound - 复合体
 * @param repertoire - 原始字符集
 *
 * @returns SVG 图形
 * @throws InvalidGlyphError 无法渲染
 */
export const recursiveRenderCompound = function (
  compound: Compound,
  repertoire: Repertoire,
  glyphCache: Map<string, SVGGlyph> = new Map(),
): SVGGlyph | InvalidGlyphError {
  const glyphs: SVGGlyph[] = [];
  for (const char of compound.operandList) {
    const glyph = repertoire[char]?.glyph;
    if (glyph === undefined) return new InvalidGlyphError();
    if (glyph.type === "basic_component") {
      glyphs.push(glyph.strokes);
    } else {
      const cache = glyphCache.get(char);
      if (cache !== undefined) {
        glyphs.push(cache);
        continue;
      }
      const rendered = recursiveRenderCompound(glyph, repertoire, glyphCache);
      if (rendered instanceof Error) return rendered;
      glyphs.push(rendered);
      glyphCache.set(char, rendered);
    }
  }
  return affineMerge(compound, glyphs);
};

/**
 * 对字符集进行拓扑排序，得到复合体的拆分顺序
 *
 * @param repertoire - 字符集
 *
 * @returns 拓扑排序后的复合体
 *
 * @remarks 这个实现目前比较低效，需要改进
 */
const topologicalSort = (repertoire: Repertoire) => {
  let compounds = new Map<string, CompoundCharacter>();
  for (let i = 0; i !== 10; ++i) {
    const thisLevelCompound = new Map<string, CompoundCharacter>();
    for (const [name, character] of Object.entries(repertoire)) {
      const { glyph } = character;
      if (compounds.get(name)) continue;
      if (glyph === undefined || glyph.type !== "compound") continue;
      if (
        glyph.operandList.every(
          (x) =>
            repertoire[x]?.glyph?.type === "basic_component" ||
            compounds.get(x) !== undefined,
        )
      ) {
        thisLevelCompound.set(name, character as CompoundCharacter);
      }
    }
    compounds = new Map([...compounds, ...thisLevelCompound]);
  }
  return compounds;
};

type Serializer = (
  r: PartitionResult[],
  g: Compound,
  name?: string,
) => CompoundAnalysis;

const sequentialSerializer: Serializer = (operandResults, glyph) => {
  const rest = {
    corners: [0, 0, 0, 0] as CornerSpecifier,
    full: [],
    operator: glyph.operator,
    operandResults,
  };
  if (glyph.order === undefined) {
    const sequence = operandResults.map((x) => x.sequence).flat();
    return { sequence, ...rest };
  }
  const sequence: string[] = [];
  const subsequences = operandResults.map((x) => ({
    rest: x.sequence,
    taken: 0,
  }));
  for (const { index, strokes } of glyph.order) {
    const data = subsequences[index];
    if (data === undefined) {
      continue;
    }
    if (strokes === 0) {
      sequence.push(...data.rest);
      data.rest = [];
    } else {
      const partitionResult = operandResults[index]!;
      if ("schemes" in partitionResult) {
        const { best, strokes: totalStrokes } = partitionResult;
        const upperBound = 1 << (totalStrokes - data.taken);
        const lowerBound = 1 << (totalStrokes - data.taken - strokes);
        const toTake = best.scheme.filter(
          (binary) => binary >= lowerBound && binary < upperBound,
        ).length;
        sequence.push(...data.rest.slice(0, toTake));
        data.rest = data.rest.slice(toTake);
      } else {
        sequence.push(...data.rest);
        data.rest = [];
      }
    }
  }
  // 不考虑四角
  return { sequence, ...rest };
};

const robustPartition = (
  operandResults: PartitionResult[],
  operator: Operator,
) => {
  // 第一步：展开同一方向的结构
  // 不管在同一个方向上有多少个结构，都展开到同一个数组中，并用同一个符号表示
  const operatorMap: Map<Operator, Operator> = new Map([
    ["⿲", "⿰"],
    ["⿳", "⿱"],
  ]);
  const realOperator = operatorMap.get(operator) ?? operator;
  const expanded: PartitionResult[] = [];
  for (const part of operandResults) {
    if (
      "operandResults" in part &&
      /[⿱⿰]/.test(part.operator) &&
      part.operator === realOperator
    ) {
      expanded.push(...part.operandResults);
    } else {
      expanded.push(part);
    }
  }
  if (realOperator !== "⿱")
    return { operator: realOperator, operandResults: expanded };
  // 第二步：对于叠型（上下结构），找出叠眼，并且将叠眼之间的结构视为独体字
  // 因为已经完成了展开，所以现在每一部分要么是部件，要么是非叠型复合体
  // 叠眼
  const postProcess = function (
    accumulation: PartitionResult[],
  ): PartitionResult {
    if (accumulation.length === 1) return accumulation[0]!;
    let sequence: string[] = [getTL(accumulation[0]!)];
    let corners: CornerSpecifier = [0, 0, 0, 0];
    if (accumulation.length === 2) {
      const [first, second] = accumulation as [
        PartitionResult,
        PartitionResult,
      ];
      if (first.sequence.length > 1) {
        const candidates = first.sequence.filter(
          (_, i) => i !== first.corners[0],
        );
        sequence.push(candidates[0]!);
        sequence.push(getBR(second));
        corners[3] = 2;
      } else {
        sequence.push(getTL(second));
        if (second.sequence.length > 1) {
          sequence.push(getBR(second, true));
          corners[3] = second.corners[0] === second.corners[3] ? 1 : 2;
        } else {
          corners[3] = 1;
        }
      }
    } else {
      const [first, second] = accumulation as [
        PartitionResult,
        PartitionResult,
      ];
      const third = accumulation.at(-1)!;
      if (first.sequence.length > 1) {
        const candidates = first.sequence.filter(
          (_, i) => i !== first.corners[0],
        );
        sequence.push(candidates[0]!);
      } else {
        sequence.push(getTL(second));
      }
      sequence.push(getBR(third));
      corners[3] = 2;
    }
    return {
      sequence,
      full: [],
      corners,
      operator: undefined,
      strokes: 0,
    };
  };
  const finalResults: PartitionResult[] = [];
  const accumulation: PartitionResult[] = [];
  for (const part of expanded) {
    if (part.operator !== undefined) {
      if (accumulation.length > 0) {
        finalResults.push(postProcess(accumulation));
      }
      accumulation.length = 0;
      finalResults.push(part);
    } else {
      accumulation.push(part);
    }
  }
  if (accumulation.length > 0) {
    finalResults.push(postProcess(accumulation));
  }
  return { operator: realOperator, operandResults: finalResults };
};

const getTL = (x: PartitionResult) => x.sequence[x.corners[0]]!;
const getBR = (x: PartitionResult, already?: boolean) => {
  if (!already) return x.sequence[x.corners[3]]!;
  if ("operandResults" in x) {
    if (/[⿰⿱⿲⿳]/.test(x.operator)) {
      return x.sequence[x.corners[3]]!;
    } else {
      const inner = x.operandResults[1]!;
      return inner.sequence[inner.corners[3]]!;
    }
  } else {
    if (x.corners[3] !== x.corners[0]) {
      return x.sequence[x.corners[3]]!;
    } else {
      return x.sequence.at(-1)!;
    }
  }
};

const c3Serializer: Serializer = (operandResults, glyph) => {
  const robust = robustPartition(operandResults, glyph.operator);
  if (robust.operandResults.length === 1) {
    return robust.operandResults[0]! as CompoundAnalysis;
  }
  const operator = robust.operator;
  const primaryPartition = robust.operandResults;
  const sequence: string[] = [];
  const corners: CornerSpecifier = [0, 0, 0, 0];
  // 三部及以上，取首首末
  if (primaryPartition.length > 2) {
    primaryPartition.forEach((x, i) => {
      if (i === 0 || i === 1) {
        sequence.push(x.sequence[0]!);
      } else if (i === primaryPartition.length - 1) {
        sequence.push(getBR(x));
      }
    });
    corners[3] = 2;
  } else {
    const [first, second] = primaryPartition as [
      PartitionResult,
      PartitionResult,
    ];
    sequence.push(getTL(first));
    let firstBR: number;
    let secondBR: number;
    if (first.sequence.length > 1) {
      sequence.push(getBR(first, true));
      firstBR = 1;
      sequence.push(getBR(second));
      secondBR = 2;
    } else {
      firstBR = 0;
      sequence.push(getTL(second));
      if (second.sequence.length > 1) {
        sequence.push(getBR(second, true));
        secondBR = second.corners[0] === second.corners[3] ? 1 : 2;
      } else {
        secondBR = 1;
      }
    }
    corners[3] = /[⿰⿱⿸]/.test(operator) ? secondBR : firstBR;
  }
  return {
    sequence,
    corners,
    full: [],
    operator,
    operandResults: primaryPartition,
  };
};

const regularize = (x: PartitionResult[], direction: Operator) => {
  const result: PartitionResult[] = [];
  const regex = direction === "⿰" ? /[⿰⿲]/ : /[⿱⿳]/;
  for (const part of x) {
    if (
      result.length < 2 &&
      "operandResults" in part &&
      regex.test(part.operator)
    ) {
      result.push(...part.operandResults);
    } else {
      result.push(part);
    }
  }
  return result;
};

// eslint-disable-next-line complexity
const zhangmaSerializer: Serializer = (operandResults, glyph, name) => {
  const corners: CornerSpecifier = [0, 0, 0, 0];
  const sequence: string[] = [];
  const full: string[] = [];
  if (
    glyph.operator === "⿶" ||
    (glyph.operator === "⿺" && glyph.operandList[0] === "\ue09d")
  ) {
    for (const part of operandResults.reverse()) full.push(...part.full);
  } else {
    for (const part of operandResults) full.push(...part.full);
  }
  const getShouMo = (x: string[]) => (x.length === 1 ? x : [x[0]!, x.at(-1)!]);
  const regularizedResults =
    operandResults.length === 2 && /[⿰⿱]/.test(glyph.operator)
      ? regularize(operandResults, glyph.operator)
      : operandResults;
  if (/[⿱⿳]/.test(glyph.operator)) {
    const dieyanIndex = regularizedResults.findIndex(
      (x) => "operandResults" in x && /[⿰⿲]/.test(x.operator),
    );
    const dieyan = regularizedResults.at(
      dieyanIndex,
    )! as CompoundGenuineAnalysis;
    const aboveDieyanSequence: string[] = [];
    switch (dieyanIndex) {
      case -1: // 没有叠眼
        for (const part of regularizedResults) sequence.push(...part.full);
        break;
      case 0: // 叠眼在开头
        for (const part of dieyan.operandResults)
          sequence.push(...part.full[0]!);
        if (regularizedResults.length > 2) {
          sequence.push(regularizedResults[1]!.full[0]!);
          sequence.push(regularizedResults.at(-1)!.full.at(-1)!);
        } else {
          sequence.push(...getShouMo(regularizedResults[1]!.full));
        }
        break;
      default: // 叠眼在中间或末尾
        for (let index = 0; index < dieyanIndex; ++index) {
          aboveDieyanSequence.push(...regularizedResults[index]!.full);
        }
        sequence.push(...aboveDieyanSequence.slice(0, 2));
        if (dieyanIndex + 1 < regularizedResults.length) {
          // 叠眼在中间
          sequence.push(dieyan.operandResults[0]!.full[0]!);
          if (sequence.length === 2) {
            sequence.push(dieyan.operandResults.at(-1)!.full[0]!);
          }
          sequence.push(regularizedResults.at(-1)!.full.at(-1)!);
        } else {
          sequence.push(...dieyan.full);
        }
    }
  } else if (/[⿰⿲]/.test(glyph.operator)) {
    const left = regularizedResults[0]!;
    if ("operandResults" in left && /[⿱⿳]/.test(left.operator)) {
      // 左部是叠型
      const dieyanIndex = left.operandResults.findIndex(
        (x) => "operandResults" in x && /[⿰⿲]/.test(x.operator),
      );
      const dieyan = left.operandResults.at(
        dieyanIndex,
      )! as CompoundGenuineAnalysis;
      if (dieyanIndex !== -1) {
        sequence.push(left.operandResults[0]!.full[0]!);
        if (dieyanIndex === 0)
          sequence.push(dieyan.operandResults.at(-1)!.full[0]!);
        else sequence.push(dieyan.operandResults[0]!.full[0]!);
        sequence.push(left.operandResults.at(-1)!.full.at(-1)!);
      }
    }
    if (sequence.length > 0) {
      // 已经处理完左部，直接取右部末码即可
      sequence.push(regularizedResults.at(-1)!.full.at(-1)!);
    } else {
      // 一般情况，左部、中部最多各取首尾两根
      sequence.push(...getShouMo(left.full));
      if (regularizedResults.length > 2) {
        sequence.push(...getShouMo(regularizedResults[1]!.full));
      }
      // 如果左部和中部已经有 4 根，舍弃一根
      if (sequence.length === 4) sequence.pop();
      for (
        let index = Math.min(2, regularizedResults.length - 1);
        index < regularizedResults.length;
        ++index
      ) {
        sequence.push(...regularizedResults[index]!.full);
      }
    }
  } else {
    // 围型：先分解围框，再分解围芯
    sequence.push(...full);
  }
  // 不考虑四角
  return {
    sequence,
    corners,
    full,
    operator: glyph.operator,
    operandResults: regularizedResults,
  };
};

const serializerMap: Record<string, Serializer> = {
  sequential: sequentialSerializer,
  c3: c3Serializer,
  zhangma: zhangmaSerializer,
};

/**
 * 对复合体进行拆分
 *
 * @param repertoire - 字符集
 * @param config - 配置
 * @param componentResults - 部件拆分结果
 */
export const disassembleCompounds = (
  repertoire: Repertoire,
  config: AnalysisConfig,
  componentResults: ComponentResults,
  characters: string[],
) => {
  const knownCharacters = new Set(characters);
  const compounds = topologicalSort(repertoire);
  const compoundResults: CompoundResults = new Map();
  const compoundError: string[] = [];
  const getResult = function (s: string): PartitionResult | undefined {
    return componentResults.get(s) || compoundResults.get(s);
  };
  const serializerName = config.analysis.serializer ?? "sequential";
  const serializer = serializerMap[serializerName] ?? sequentialSerializer;
  for (const [char, { glyph }] of compounds.entries()) {
    if (config.primaryRoots.has(char) || config.secondaryRoots.has(char)) {
      // 复合体本身是一个字根
      compoundResults.set(char, {
        sequence: [char],
        full: [char],
        corners: [0, 0, 0, 0],
        operator: glyph.operator,
      });
      continue;
    }
    const rawOperandResults = glyph.operandList.map(getResult);
    if (rawOperandResults.every((x) => x !== undefined)) {
      // this is safe!
      const operandResults = rawOperandResults as PartitionResult[];
      const serialization = serializer(operandResults, glyph, char);
      compoundResults.set(char, serialization);
    } else {
      if (knownCharacters.has(char)) {
        compoundError.push(char);
      }
    }
  }
  return [compoundResults, compoundError] as const;
};
