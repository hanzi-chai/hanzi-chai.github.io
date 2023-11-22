import { describe, expect, it } from "vitest";
import { buildCache } from "~/lib/form";
import { length, bias, order, crossing, attaching } from "~/lib/selector";
import select from "~/lib/selector";
import { rendered } from "./mock";

const { 天: raw } = rendered;
const 天 = buildCache(raw);

describe("length", () => {
  it("should measure the length of scheme", () => {
    expect(length.key(天, [8, 7])).toBe(2);
  });
});

describe("bias", () => {
  it("should measure the bias of scheme", () => {
    expect(bias.key(天, [8, 7])).toEqual([-1, -3]);
  });
});

describe("order", () => {
  it("should measure the order of scheme", () => {
    expect(order.key(天, [8, 7])).toEqual([0, 1, 2, 3]);
  });
});

describe("crossing", () => {
  it("should measure the crossing of scheme", () => {
    expect(crossing.key(天, [8, 7])).toBe(0);
    expect(crossing.key(天, [12, 3])).toBe(1);
  });
});

describe("attaching", () => {
  it("should measure the attaching of scheme", () => {
    expect(attaching.key(天, [8, 7])).toBe(1);
    expect(attaching.key(天, [12, 3])).toBe(0);
  });
});

describe("select", () => {
  it("should select the correct scheme for 天", () => {
    expect(
      select(["根少优先", "能连不交", "能散不连", "笔顺优先", "取大优先"], 天, [
        [12, 3],
        [8, 7],
        [8, 4, 3],
        [8, 4, 2, 1],
      ])[0],
    ).toEqual([8, 7]);
  });
});
