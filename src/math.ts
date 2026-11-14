import type { N2 } from "./data.js";

export const 加 = (a: N2, b: N2): N2 => [a[0] + b[0], a[1] + b[1]];

export const 减 = (a: N2, b: N2): N2 => [a[0] - b[0], a[1] - b[1]];

export const 乘 = (a: number, b: N2): N2 => [a * b[0], a * b[1]];

export const 除 = (a: N2, b: number): N2 => [a[0] / b, a[1] / b];

export const 点乘 = (a: N2, b: N2): number => a[0] * b[0] + a[1] * b[1];

export const 叉乘 = (a: N2, b: N2): number => a[0] * b[1] - a[1] * b[0];

export const 距离 = (a: N2, b: N2): number =>
  Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);

export const 排序 = (a: number, b: number): N2 => (a < b ? [a, b] : [b, a]);

/**
 * Determine if the point is on a given segment
 * @param from - starting point
 * @param to - end point
 * @param point - another point
 * @returns
 */
export const 是共线 = (from: N2, to: N2, point: N2) => {
  const [u, v] = [减(to, point), 减(from, point)];
  return 叉乘(u, v) === 0 && 点乘(u, v) < 0;
};

/**
 * 比较两个数列的大小
 * @param a - 数列 a
 * @param b - 数列 b
 * @returns 如果 a < b 则返回 true，否则返回 false
 */
export const 是小于 = (a: number[], b: number[]) => {
  for (const [i, v] of a.entries()) {
    const u = b[i];
    if (u === undefined) return false;
    if (v < u) return true;
    if (v > u) return false;
  }
  return false;
};
