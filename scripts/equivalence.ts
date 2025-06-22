import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mean, round, sortBy, sum } from "lodash-es";
import { erf, std } from "mathjs";
import { exit } from "node:process";
import { get } from "~/api";
import type { EquivalenceData, Pair } from "~/lib/equivalence";
import { distance, partition, 手机五行七列 } from "~/lib/equivalence";

interface Estimation {
  value: number;
  std: number;
  length: number;
}

interface Equivalence {
  distance: number;
  value: number;
  std: number;
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

function measure(data: number[]): Estimation {
  if (data.length === 0) {
    return {
      value: Number.NaN,
      std: Number.NaN,
      length: 0,
    };
  }
  if (data.length === 1) {
    return {
      value: data[0]!,
      std: 0,
      length: 1,
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
    value: mean(finalData),
    std: (std(finalData, "unbiased") as number) / Math.sqrt(finalData.length),
    length: finalData.length,
  };
}

function analyze(
  d: EquivalenceData,
  partitions: Set<Pair>[],
  hashmap: Map<string, number>,
) {
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
    return {
      ...measure(data),
      rawLength: data.length,
      distance: dist,
    };
  });
  return stats;
}

function preprocess(modelData: EquivalenceData[]) {
  const partitions = partition(手机五行七列);
  const hashmap = new Map<string, number>();
  for (const [index, set] of partitions.entries()) {
    for (const v of set) {
      hashmap.set(`${v.initial},${v.final}`, index);
    }
  }

  const sampleData = partitions.map((x) => ({
    set: x,
    data: [] as Equivalence[],
  }));

  for (const sample of modelData) {
    // 和 partitions 一一对应
    const sampleResult = analyze(sample, partitions, hashmap);
    const baseline = sampleResult.find((x) => x.distance === 0);
    if (!baseline) continue;
    sampleResult.forEach(({ distance, value, std }, index) => {
      if (distance === 0) {
        sampleData[index]!.data.push({ distance, value: 1, std: 0 });
      } else {
        const ratio = value / baseline.value;
        const correction = 1 + baseline.std ** 2 / baseline.value ** 2;
        if (correction > 1.0003) console.log(distance, ratio, correction);
        const ratioStd =
          Math.sqrt((std / value) ** 2 + (baseline.std / baseline.value) ** 2) *
          ratio;
        sampleData[index]!.data.push({
          distance,
          value: ratio * correction,
          std: ratioStd,
        });
      }
    });
  }
  return sampleData;
}

function finalize(sampleData: { set: Set<Pair>; data: Equivalence[] }[]) {
  return sampleData.map(({ set, data }) => {
    const distance = data[0]!.distance;
    const values = data.map((x) => x.value);
    const stds = data.map((x) => x.std);
    const variances = stds.map((x) => x ** 2);
    const coefficients = data.map(() => 1 / data.length);
    // 另一种权重计算方法
    // const suminvvar = sum(variances.map((x) => 1 / x));
    // const coefficients = variances.map((x) => 1 / x / suminvvar);
    const value = sum(values.map((x, j) => x * coefficients[j]!));
    const variance = sum(variances.map((x, j) => x * coefficients[j]! ** 2));
    const std = Math.sqrt(variance);
    const equivalence: Equivalence = { distance, value, std };
    return { set, ...equivalence };
  });
}

let data: EquivalenceData[];
if (existsSync("scripts/data.json")) {
  data = JSON.parse(readFileSync("scripts/data.json", "utf-8"));
} else {
  const res = await get<EquivalenceData[], undefined>("equivalence");
  if ("err" in res) exit(1);
  data = res;
  writeFileSync("scripts/data.json", JSON.stringify(data, null, 2));
}
const modelData = data.filter((d) => d.model === "手机五行七列");
const sampleData = preprocess(modelData);
const equivalence = finalize(sampleData);
const sortedEquivalence = sortBy(equivalence, "distance", "value");

writeFileSync("scripts/equivalence.json", JSON.stringify(sampleData, null, 2));

const content = [["组合", "分组", "当量", "不确定度"].join("\t")];
const counter = new Map<number, number>();
for (const { distance, value, std, set } of sortedEquivalence) {
  let groupname: string;
  if (distance === -1) {
    groupname = "/";
  } else {
    const distanceCount = counter.get(distance) ?? 0;
    groupname = `${distance}${"ABCDEFGHIJKLMNOPQRSTUVWXYZ"[distanceCount]}`;
    counter.set(distance, distanceCount + 1);
  }
  for (const { initial, final } of sortBy([...set], "initial", "final")) {
    content.push(
      [`${initial}-${final}`, groupname, round(value, 3), round(std, 3)].join(
        "\t",
      ),
    );
  }
}

writeFileSync("scripts/手机 5 × 7 当量.txt", `${content.join("\n")}\n`);
