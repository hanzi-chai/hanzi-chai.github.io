import { describe, expect, it } from "vitest";
import {
  length,
  bias,
  order,
  crossing,
  attaching,
  Scheme,
} from "~/lib/selector";
import select from "~/lib/selector";
import { rendered } from "./mock";
import { defaultKeyboard } from "~/lib/templates";

const config = defaultKeyboard;

const { 天 } = rendered;

const rootMap = new Map<number, string>();

describe("length", () => {
  it("should measure the length of scheme", () => {
    expect(length.key([8, 7], 天, config, rootMap)).toBe(2);
  });
});

describe("bias", () => {
  it("should measure the bias of scheme", () => {
    expect(bias.key([8, 7], 天, config, rootMap)).toEqual([-1, -3]);
  });
});

describe("order", () => {
  it("should measure the order of scheme", () => {
    expect(order.key([8, 7], 天, config, rootMap)).toEqual(0);
  });
});

describe("crossing", () => {
  it("should measure the crossing of scheme", () => {
    expect(crossing.key([8, 7], 天, config, rootMap)).toBe(0);
    expect(crossing.key([12, 3], 天, config, rootMap)).toBe(1);
  });
});

describe("attaching", () => {
  it("should measure the attaching of scheme", () => {
    expect(attaching.key([8, 7], 天, config, rootMap)).toBe(1);
    expect(attaching.key([12, 3], 天, config, rootMap)).toBe(0);
  });
});

describe("select", () => {
  it("should select the correct scheme for 天", () => {
    expect(
      (
        select(
          config,
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
