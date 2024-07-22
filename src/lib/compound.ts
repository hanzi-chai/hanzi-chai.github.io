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

const recursiveExpand: (x: PartitionResult[]) => PartitionResult[] = (x) => {
  const result: PartitionResult[] = [];
  for (const part of x) {
    if ("operandResults" in part && /[⿱⿳]/.test(part.operator)) {
      result.push(...recursiveExpand(part.operandResults));
    } else {
      result.push(part);
    }
  }
  return result;
};

const robustPartition = (p: {
  operandResults: PartitionResult[];
  operator: Operator;
}) => {
  const { operandResults, operator } = p;
  let start = 0;
  let dieyanAfter;
  // 叠和非叠
  const die = /[⿱⿳]/;
  const notDie = /[^⿱⿳]/;
  // 叠眼
  let dieyan: boolean[];
  const postProcess: (x: PartitionResult[]) => PartitionResult = (x) => {
    if (x.length === 1) return x[0]!;
    const simplified = x.length > 3 ? x.slice(0, 2).concat(x.slice(-1)) : x;
    let operator: Operator;
    let sequence: string[] = [getTL(simplified[0]!)];
    let corners: CornerSpecifier = [0, 0, 0, 0];
    if (simplified.length === 2) {
      const [first, second] = simplified as [PartitionResult, PartitionResult];
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
      operator = "⿱";
    } else {
      operator = "⿳";
      const [first, second, third] = simplified as [
        PartitionResult,
        PartitionResult,
        PartitionResult,
      ];
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
      operator,
      operandResults: x,
    };
  };
  if (die.test(operator)) {
    const firstPartition: PartitionResult[] = [];
    const expanded = recursiveExpand(operandResults);
    dieyan = expanded.map((x) => notDie.test(x.operator ?? ""));
    for (const [i, x] of dieyan.entries()) {
      if (x) {
        const dieyanBefore = expanded.slice(start, i);
        if (dieyanBefore.length > 0) {
          firstPartition.push(postProcess(dieyanBefore));
        }
        firstPartition.push(expanded[i]!);
        start = i + 1;
      }
    }
    dieyanAfter = expanded.slice(start);
    if (dieyanAfter.length > 0) {
      firstPartition.push(postProcess(dieyanAfter));
    }
    return firstPartition;
  } else {
    return operandResults;
  }
};

const _c3Serializer: Serializer = (operandResults, glyph) => {
  const primaryPartition = robustPartition({
    operandResults,
    operator: glyph.operator,
  });
  let sequence: string[] = [];
  if (primaryPartition.length === 1) {
    sequence = primaryPartition[0]!.sequence.slice(0, 3);
  } else if (primaryPartition.length === 3) {
    sequence = primaryPartition.map((x) => x.sequence[0]!);
  } else {
    // 需要执行二次拆分
    for (const part of primaryPartition) {
      if ("operandResults" in part) {
        const smallerParts = robustPartition(part).slice(0, 2);
        if (smallerParts.length >= 2) {
          sequence.push(...smallerParts.map((x) => x.sequence[0]!));
        } else {
          sequence.push(...smallerParts[0]!.sequence.slice(0, 2));
        }
      } else {
        sequence.push(...part.sequence.slice(0, 2));
      }
    }
  }
  return {
    sequence: sequence.slice(0, 3),
    corners: [0, 0, 0, 0],
    full: [],
    operator: glyph.operator,
    operandResults,
  };
};

const getTL = (x: PartitionResult) => x.sequence[x.corners[0]]!;
const getBR = (x: PartitionResult, already?: boolean) => {
  if (!already) return x.sequence[x.corners[3]]!;
  if (x.corners[3] !== x.corners[0]) {
    return x.sequence[x.corners[3]]!;
  } else {
    return x.sequence.at(-1)!;
  }
};

const combine = (primaryPartition: PartitionResult[], operator: Operator) => {
  const sequence: string[] = [];
  const corners: CornerSpecifier = [0, 0, 0, 0];
  if (primaryPartition.length === 3) {
    primaryPartition.forEach((x, i) => {
      if (i === 0 || i === 1) {
        sequence.push(x.sequence[0]!);
      } else {
        sequence.push(getBR(x));
      }
    });
    corners[3] = sequence.length - 1;
  } else {
    const [first, second] = primaryPartition as [
      PartitionResult,
      PartitionResult,
    ];
    sequence.push(getTL(first));
    if (first.sequence.length > 1) {
      sequence.push(getBR(first, true));
      sequence.push(getBR(second));
      if (/[⿰⿱⿸]/.test(operator)) {
        corners[3] = sequence.length - 1;
      } else {
        corners[3] = sequence.length - 2;
      }
    } else {
      sequence.push(getTL(second));
      if (second.sequence.length > 1) {
        sequence.push(getBR(second, true));
        if (/[⿰⿱⿸]/.test(operator)) {
          corners[3] =
            second.corners[0] === second.corners[3]
              ? sequence.length - 2
              : sequence.length - 1;
        }
      } else {
        if (/[⿰⿱⿸]/.test(operator)) {
          corners[3] = sequence.length - 1;
        }
      }
    }
  }
  return {
    sequence,
    corners,
    full: [],
    operator,
    operandResults: primaryPartition,
  };
};

const c3Serializer: Serializer = (operandResults, glyph) => {
  const operator = glyph.operator;
  const primaryPartition = robustPartition({ operandResults, operator });
  if (primaryPartition.length === 1) {
    return primaryPartition[0]!;
  } else {
    return combine(primaryPartition, operator);
  }
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
  if (name === "摊") {
    console.log(sequence, full, regularizedResults);
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
