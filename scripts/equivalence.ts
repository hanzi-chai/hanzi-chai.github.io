import { mean, round, sortBy } from "lodash-es";
import { erf, std } from "mathjs";
import { get } from "~/api";
import type { EquivalenceData } from "~/lib/equivalence";
import { distance, partition, 手机五行七列 } from "~/lib/equivalence";

const partitions = partition(手机五行七列);
const hashmap = new Map<string, number>();

for (const [index, set] of partitions.entries()) {
  for (const v of set) {
    hashmap.set(`${v.initial},${v.final}`, index);
  }
}

interface Measurement {
  mean: number;
  std: number;
  length: number;
}

// discard outliers using Chauvenet's criterion
function chauvenet(data: number[]) {
  const n = data.length;
  const meanValue = mean(data);
  const stdValue = std(data, "unbiased") as number;
  return data.filter((x) => {
    const k = Math.abs(x - meanValue) / stdValue;
    return erf(k / Math.SQRT2) < 1 - 1 / (2 * n);
  });
}

function measure(data: number[]): Measurement {
  if (data.length === 0) {
    return {
      mean: NaN,
      std: NaN,
      length: 0,
    };
  }
  // recursively discard outliers
  let finalData = data;
  while (true) {
    const newData = chauvenet(finalData);
    if (newData.length === finalData.length) break;
    finalData = newData;
  }
  return {
    mean: mean(finalData),
    std: std(finalData, "unbiased") as number,
    length: finalData.length,
  };
}

function analyze(d: EquivalenceData) {
  const { data } = d;
  const result = partitions.map((x) => ({ set: x, data: [] as number[] }));
  for (const { initial, final, time } of data) {
    const key = hashmap.get(`${initial},${final}`);
    if (key === undefined || key >= result.length) {
      console.error(`Key not found for ${initial},${final}`);
      continue;
    }
    result[key]!.data.push(time);
  }
  const stats = result.map(({ set, data }) => {
    const dist = distance([...set][0]!);
    console.log(dist, data);
    return {
      ...measure(data),
      rawLength: data.length,
      distance: dist,
    };
  });
  return sortBy(stats, (x) => x.distance);
}

const data = await get<EquivalenceData[], undefined>("equivalence");

const modelData = data.find((d) => d.model === "手机五行七列")!;

const analyzeResult = analyze(modelData);
for (const { distance, mean, std } of analyzeResult) {
  console.log(`键距 ${distance}：${round(mean, 2)} ± ${round(std, 2)} ms`);
}
const baseline = analyzeResult.find((x) => x.distance === 0)!;
const others = analyzeResult.filter((x) => x.distance !== 0);

for (const { distance, mean, std, rawLength, length } of others) {
  const quotient = mean / baseline.mean;
  const qstd = std / baseline.mean;
  const diff = rawLength - length;
  console.log(
    `键距 ${distance}：${round(quotient, 2)} ± ${round(qstd, 2)}（${rawLength} 个样本${diff ? `，${diff} 个无效样本` : ""}）`,
  );
}
