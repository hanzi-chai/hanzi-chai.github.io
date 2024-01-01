import { ComponentCache, ComponentResult } from "./component";
import { FormConfig, MergedData } from "./config";
import { Block, CompoundGlyph, Form, Operator } from "./data";

export type CompoundCache = Map<string, CompoundResult>;

type PartitionResult = ComponentResult | CompoundResult;

export type CompoundResult = CompoundRootResult | CompoundRegularResult;

// 两个以上字根
interface CompoundRegularResult {
  sequence: string[];
  detail: {
    operator: Operator;
    partitionResults: PartitionResult[];
  };
}

// 本身是字根字，无拆分细节
interface CompoundRootResult {
  sequence: [string];
}

const topologicalSort = (form: Form) => {
  let compounds = new Map<string, CompoundGlyph>();
  for (let i = 0; i !== 10; ++i) {
    const thisLevelCompound = new Map<string, CompoundGlyph>();
    for (const [k, glyph] of Object.entries(form)) {
      if (compounds.get(k)) continue;
      if (glyph.default_type !== "compound") continue;
      // this will change later, allowing user to choose desired partition
      const selectedPartition = glyph.compound[0];
      if (selectedPartition === undefined) continue;
      if (
        selectedPartition.operandList.every(
          (x) =>
            form[x]?.default_type === "component" ||
            compounds.get(x) !== undefined,
        )
      ) {
        thisLevelCompound.set(k, glyph);
      }
    }
    compounds = new Map([...compounds, ...thisLevelCompound]);
  }
  return compounds;
};

const assembleSequence = (
  partitionResults: PartitionResult[],
  order: Block[],
) => {
  const sequence: string[] = [];
  const subsequences = partitionResults.map((x) => ({
    rest: x.sequence,
    taken: 0,
  }));
  for (const { index, strokes } of order) {
    const data = subsequences[index];
    if (data === undefined) {
      continue;
    }
    if (strokes === 0) {
      sequence.push(...data.rest);
      data.rest = [];
    } else {
      const partitionResult = partitionResults[index]!;
      if ("schemes" in partitionResult) {
        const { detail, strokes: totalStrokes } = partitionResult;
        const upperBound = 1 << (totalStrokes - data.taken);
        const lowerBound = 1 << (totalStrokes - data.taken - strokes);
        const toTake = detail.filter(
          ({ binary }) => binary >= lowerBound && binary < upperBound,
        ).length;
        sequence.push(...data.rest.slice(0, toTake));
        data.rest = data.rest.slice(toTake);
      } else {
        sequence.push(...data.rest);
        data.rest = [];
      }
    }
  }
  return sequence;
};

export const disassembleCompounds = (
  data: MergedData,
  config: FormConfig,
  componentCache: ComponentCache,
) => {
  const { mapping, grouping } = config;
  const compounds = topologicalSort(data.form);
  const compoundCache: CompoundCache = new Map();
  const compoundError: string[] = [];
  const getResult = function (s: string): PartitionResult | undefined {
    return componentCache.get(s) || compoundCache.get(s);
  };
  for (const [char, glyph] of compounds.entries()) {
    if (mapping[char] || grouping[char]) {
      // 复合体本身是一个字根
      compoundCache.set(char, { sequence: [char] });
      continue;
    }
    const { operator, operandList, order } = glyph.compound[0]!;
    const rawPartitionResults = operandList.map(getResult);
    if (rawPartitionResults.every((x) => x !== undefined)) {
      // this is safe!
      const partitionResults = rawPartitionResults as PartitionResult[];
      const sequence =
        order === undefined
          ? partitionResults.map((x) => x.sequence).flat()
          : assembleSequence(partitionResults, order);
      compoundCache.set(char, {
        sequence,
        detail: {
          operator,
          partitionResults,
        },
      });
    } else {
      compoundError.push(char);
    }
  }
  return [compoundCache, compoundError] as const;
};
