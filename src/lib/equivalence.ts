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
      if (visited.has(u)) continue;
      visited.add(u);
      subgroup.add(u);
      for (const w of group) {
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
  return (p.initial < 20 && p.final >= 15) || (p.initial >= 15 && p.final < 20);
};

const reflect = (n: number) => {
  let [col, row] = [Math.floor(n / 5), n % 5];
  return (6 - col) * 5 + row;
};

export const distance = (p: Pair) => {
  if (isDifferentHand(p)) return -1;
  let [x1, y1] = [Math.floor(p.initial / 5), p.initial % 5];
  let [x2, y2] = [Math.floor(p.final / 5), p.final % 5];
  return (x1 - x2) ** 2 + (y1 - y2) ** 2;
};

export const 手机五行七列: Model<Pair> = {
  group: new Set(
    range(35)
      .map((n) => range(35).map((m) => ({ initial: n, final: m })))
      .flat(),
  ),
  relation: (p1, p2) => {
    return distance(p1) === distance(p2);
    // // 当量 0
    // if (isDifferentHand(p1) && isDifferentHand(p2)) return true;
    // // 当量 1
    // if (p1.initial === p1.final && p2.initial === p2.final) return true;
    // // 时间反演
    // if (p1.initial === p2.final && p1.final === p2.initial) return true;
    // // 空间镜像
    // if (reflect(p1.initial) === p2.initial && reflect(p1.final) === p2.final)
    //   return true;
    // return false;
  },
};
