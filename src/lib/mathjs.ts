/** 为了更好的性能，替代mathjs的部分函数 */

import type { N2 } from "./data";

export const add = (a: N2, b: N2): N2 => [a[0] + b[0], a[1] + b[1]];

export const subtract = (a: N2, b: N2): N2 => [a[0] - b[0], a[1] - b[1]];

export const multiply = (a: number, b: N2): N2 => [a * b[0], a * b[1]];

export const divide = (a: N2, b: number): N2 => [a[0] / b, a[1] / b];

export const dot = (a: N2, b: N2): number => a[0] * b[0] + a[1] * b[1];

export const cross = (a: N2, b: N2): number => a[0] * b[1] - a[1] * b[0];

export const mean = (a: N2): number => (a[0] + a[1]) / 2;

export const distance = (a: N2, b: N2): number =>
  Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);
