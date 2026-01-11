import type { N2 } from "./data.js";

export const add = (a: N2, b: N2): N2 => [a[0] + b[0], a[1] + b[1]];

export const subtract = (a: N2, b: N2): N2 => [a[0] - b[0], a[1] - b[1]];

export const multiply = (a: number, b: N2): N2 => [a * b[0], a * b[1]];

export const divide = (a: N2, b: number): N2 => [a[0] / b, a[1] / b];

export const dot = (a: N2, b: N2): number => a[0] * b[0] + a[1] * b[1];

export const cross = (a: N2, b: N2): number => a[0] * b[1] - a[1] * b[0];

export const mean = (a: N2): number => (a[0] + a[1]) / 2;

export const distance = (a: N2, b: N2): number =>
  Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);

export const sorted = (a: N2): N2 => (a[0] < a[1] ? a : [a[1], a[0]]);

export const area = (p: N2, q: N2) => p[0] * q[1] - p[1] * q[0];

/**
 * Determine if the point is on a given segment
 * @param from - starting point
 * @param to - end point
 * @param point - another point
 * @returns
 */
export const isCollinear = (from: N2, to: N2, point: N2) => {
  const [u, v] = [subtract(to, point), subtract(from, point)];
  return area(u, v) === 0 && dot(u, v) < 0;
};

/**
 * 比较两个数列的大小
 * @param a - 数列 a
 * @param b - 数列 b
 * @returns 如果 a < b 则返回 true，否则返回 false
 */
export const isLess = (a: number[], b: number[]) => {
  for (const [i, v] of a.entries()) {
    const u = b[i];
    if (u === undefined) return false;
    if (v < u) return true;
    if (v > u) return false;
  }
  return false;
};
