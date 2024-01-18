import { describe, expect, it } from "vitest";
import { length, bias, order, crossing, attaching, Scheme } from "~/lib";
import { select } from "~/lib";
import { computedComponents, repertoire } from "./mock";
import { defaultConfig } from "~/lib";
import { Config } from "~/lib";

const { 天 } = computedComponents as any;

const rootMap = new Map<number, string>();

describe("length", () => {
  it("should measure the length of scheme", () => {
    expect(length.key([8, 7], 天, defaultConfig, rootMap)).toBe(2);
  });
});

describe("bias", () => {
  it("should measure the bias of scheme", () => {
    expect(bias.key([8, 7], 天, defaultConfig, rootMap)).toEqual([-1, -3]);
  });
});

describe("order", () => {
  it("should measure the order of scheme", () => {
    expect(order.key([8, 7], 天, defaultConfig, rootMap)).toEqual(0);
  });
});

describe("crossing", () => {
  it("should measure the crossing of scheme", () => {
    expect(crossing.key([8, 7], 天, defaultConfig, rootMap)).toBe(0);
    expect(crossing.key([12, 3], 天, defaultConfig, rootMap)).toBe(1);
  });
});

describe("attaching", () => {
  it("should measure the attaching of scheme", () => {
    expect(attaching.key([8, 7], 天, defaultConfig, rootMap)).toBe(1);
    expect(attaching.key([12, 3], 天, defaultConfig, rootMap)).toBe(0);
  });
});

describe("select", () => {
  it("should select the correct scheme for 天", () => {
    expect(
      (
        select(
          defaultConfig,
          天,
          [
            [12, 3],
            [8, 7],
            [8, 4, 3],
            [8, 4, 2, 1],
          ],
          rootMap,
        ) as [Scheme, unknown]
      )[0],
    ).toEqual([8, 7]);
  });
});
