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
