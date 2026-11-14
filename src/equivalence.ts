import { mean, range, round, sortBy, sum } from "lodash-es";

// Abramowitz & Stegun approximation, max error 1.5e-7
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-(x * x));
  return sign * y;
}

function std(data: readonly number[]): number {
  if (data.length < 2) return 0;
  const m = mean(data);
  return Math.sqrt(
    data.reduce((s, x) => s + (x - m) ** 2, 0) / (data.length - 1),
  );
}

export interface EquivalenceData {
  user: string;
  model: string;
  data: (Pair & { time: number })[];
}

type Relation<T> = (v1: T, v2: T) => boolean;

export interface Model<T> {
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
      if (visited.has(u)) continue;
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

export interface Estimation {
  value: number;
  std: number;
  length: number;
}

export interface Equivalence {
  distance: number;
  value: number;
  std: number;
}

// discard outliers using Chauvenet's criterion
function chauvenet(data: number[]) {
  const n = data.length;
  const meanValue = mean(data);
  const stdValue = std(data);
  if (n < 2 || stdValue === 0) return data;
  return data.filter((x) => {
    const k = Math.abs(x - meanValue) / stdValue;
    return erf(k / Math.SQRT2) < 1 - 1 / (2 * n);
  });
}

export function 估计当量测量(values: readonly number[]): Estimation {
  const data = values.filter((value) => Number.isFinite(value) && value >= 0);
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
    std: std(finalData) / Math.sqrt(finalData.length),
    length: finalData.length,
  };
}

function 分析单份当量样本(
  d: EquivalenceData,
  partitions: Set<Pair>[],
  hashmap: Map<string, number>,
) {
  const { data } = d;
  const result = partitions.map((x) => ({ set: x, data: [] as number[] }));
  for (const { initial, final, time } of data) {
    const key = hashmap.get(`${initial},${final}`);
    if (key === undefined || key >= result.length) {
      continue;
    }
    result[key]!.data.push(time);
  }
  const stats = result.map(({ set, data }) => {
    const dist = distance([...set][0]!);
    return {
      ...估计当量测量(data),
      rawLength: data.length,
      distance: dist,
    };
  });
  return stats;
}

export interface 当量样本分组 {
  set: Set<Pair>;
  data: Equivalence[];
}

export function 预处理当量样本(
  modelData: readonly EquivalenceData[],
  model: Model<Pair> = 手机五行七列,
): 当量样本分组[] {
  const partitions = partition(model);
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
    const sampleResult = 分析单份当量样本(sample, partitions, hashmap);
    const baseline = sampleResult.find((x) => x.distance === 0);
    if (!baseline || !Number.isFinite(baseline.value) || baseline.value <= 0)
      continue;
    sampleResult.forEach(({ distance, value, std, length }, index) => {
      if (!length || !Number.isFinite(value) || value <= 0) return;
      if (distance === 0) {
        sampleData[index]!.data.push({ distance, value: 1, std: 0 });
      } else {
        const ratio = value / baseline.value;
        const correction = 1 + baseline.std ** 2 / baseline.value ** 2;
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

export function 汇总当量样本(sampleData: readonly 当量样本分组[]) {
  return sampleData
    .filter(({ data }) => data.length > 0)
    .map(({ set, data }) => {
      const distance = data[0]!.distance;
      const values = data.map((x) => x.value);
      const stds = data.map((x) => x.std);
      const variances = stds.map((x) => x ** 2);
      const coefficients = data.map(() => 1 / data.length);
      const value = sum(values.map((x, j) => x * coefficients[j]!));
      const variance = sum(variances.map((x, j) => x * coefficients[j]! ** 2));
      const std = Math.sqrt(variance);
      const equivalence: Equivalence = { distance, value, std };
      return { set, ...equivalence };
    });
}

/** 计算同一实验模型的相对当量；不访问网络、文件系统或记录日志。 */
export function 分析当量数据(
  data: readonly EquivalenceData[],
  modelName = "手机五行七列",
  model: Model<Pair> = 手机五行七列,
) {
  const records = data.filter((record) => record.model === modelName);
  const 样本 = records.length ? 预处理当量样本(records, model) : [];
  const 当量 = sortBy(汇总当量样本(样本), "distance", "value");
  return { 样本, 当量 };
}

export function 序列化当量统计(
  当量: readonly (Equivalence & { set: Set<Pair> })[],
): string[][] {
  const rows = [["组合", "分组", "当量", "不确定度"]];
  const counter = new Map<number, number>();
  for (const { distance, value, std, set } of sortBy(
    当量,
    "distance",
    "value",
  )) {
    let groupname: string;
    if (distance === -1) {
      groupname = "/";
    } else {
      const count = counter.get(distance) ?? 0;
      groupname = `${distance}${"ABCDEFGHIJKLMNOPQRSTUVWXYZ"[count] ?? count}`;
      counter.set(distance, count + 1);
    }
    for (const { initial, final } of sortBy([...set], "initial", "final")) {
      rows.push([
        `${initial}-${final}`,
        groupname,
        String(round(value, 3)),
        String(round(std, 3)),
      ]);
    }
  }
  return rows;
}
