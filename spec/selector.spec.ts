import { describe, expect, it } from "vitest";
import type { Environment, Scheme } from "~/lib";
import { length, bias, order, crossing, attaching } from "~/lib";
import { select } from "~/lib";
import { computedComponents, focusAnalysis, repertoire } from "./mock";
import { defaultConfig } from "~/lib";

const analysisConfig = focusAnalysis(defaultConfig, repertoire);
const { 天 } = computedComponents as any;
const env: Environment = {
  component: 天,
  rootMap: new Map(),
  ...analysisConfig,
};

const rootMap = new Map<number, string>();

describe("length", () => {
  it("should measure the length of scheme", () => {
    expect(length.key([8, 7], env)).toBe(2);
  });
});

describe("bias", () => {
  it("should measure the bias of scheme", () => {
    expect(bias.key([8, 7], env)).toEqual([-1, -3]);
  });
});

describe("order", () => {
  it("should measure the order of scheme", () => {
    expect(order.key([8, 7], env)).toEqual(0);
  });
});

describe("crossing", () => {
  it("should measure the crossing of scheme", () => {
    expect(crossing.key([8, 7], env)).toBe(0);
    expect(crossing.key([12, 3], env)).toBe(1);
  });
});

describe("attaching", () => {
  it("should measure the attaching of scheme", () => {
    expect(attaching.key([8, 7], env)).toBe(1);
    expect(attaching.key([12, 3], env)).toBe(0);
  });
});

describe("select", () => {
  it("should select the correct scheme for 天", () => {
    expect(
      (
        select(
          analysisConfig,
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
