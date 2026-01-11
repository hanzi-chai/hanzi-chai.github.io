import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mean, round, sortBy, sum } from "lodash-es";
import { erf, std } from "math";
import { exit } from "node:process";
import { get } from "~/api";
import { range } from "lodash-es";

export interface EquivalenceData {
  user: string;
  model: string;
  data: (Pair & { time: number })[];
}

type Relation<T> = (v1: T, v2: T) => boolean;

interface Model<T> {
  group: Set<T>;
  relation: Relation<T>;
}

// partition the group into subgroups according to binary equivalence relation
// using DFS algorithm
export function partition<T>({ group, relation }: Model<T>) {
  const visited = new Set<T>();
  const result: Set<T>[] = [];
  for (const v of group) {
    if (visited.has(v)) continue;
    const subgroup = new Set<T>();
    const stack = [v];
    while (stack.length > 0) {
      const u = stack.pop()!;
      visited.add(u);
      subgroup.add(u);
      for (const w of group) {
        if (visited.has(w)) continue;
        if (relation(u, w)) stack.push(w);
      }
    }
    result.push(subgroup);
  }
  return result;
}

export interface Pair {
  initial: number;
  final: number;
}

const isDifferentHand = (p: Pair) => {
  if (p.initial === p.final) return false;
  return (p.initial < 20 && p.final >= 15) || (p.initial >= 15 && p.final < 20);
};

const isSameHand = (p1: Pair, p2: Pair) => {
  const numbers = [p1.initial, p1.final, p2.initial, p2.final];
  return numbers.every((n) => n < 15) || numbers.every((n) => n >= 20);
};

const reflect = (n: number) => {
  const [col, row] = [Math.floor(n / 5), n % 5];
  return (6 - col) * 5 + row;
};

export const distance = (p: Pair) => {
  if (isDifferentHand(p)) return -1;
  const [x1, y1] = [Math.floor(p.initial / 5), p.initial % 5];
  const [x2, y2] = [Math.floor(p.final / 5), p.final % 5];
  return (x1 - x2) ** 2 + (y1 - y2) ** 2;
};

export const displacement = (p: Pair) => {
  const [x1, y1] = [Math.floor(p.initial / 5), p.initial % 5];
  const [x2, y2] = [Math.floor(p.final / 5), p.final % 5];
  return [x2 - x1, y2 - y1] as const;
};

export const 手机五行七列: Model<Pair> = {
  group: new Set(
    range(35).flatMap((n) => range(35).map((m) => ({ initial: n, final: m }))),
  ),
  relation: (p1, p2) => {
    // 异指连击当量相同
    if (isDifferentHand(p1) && isDifferentHand(p2)) return true;
    // 同键连击当量相同
    if (p1.initial === p1.final && p2.initial === p2.final) return true;
    // 时间反演
    if (p1.initial === p2.final && p1.final === p2.initial) return true;
    // 空间镜像
    if (reflect(p1.initial) === p2.initial && reflect(p1.final) === p2.final)
      return true;
    // 空间平移（同手）
    const [dx1, dy1] = displacement(p1);
    const [dx2, dy2] = displacement(p2);
    if (isSameHand(p1, p2) && dx1 === dx2 && dy1 === dy2) return true;
    return false;
  },
};

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
