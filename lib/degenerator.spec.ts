import {
  indicesToBinary,
  binaryToIndices,
  generateSliceBinaries,
} from "./degenerator";
import { describe, it, expect } from "vitest";
import { create, all } from "mathjs";
import findTopology from "./topology";
import wen from "../data/wen.json";
import { Wen } from "./data";
import { Cache } from "./root";
const w = wen as unknown as Wen;

const { randomInt } = create(all, {
  randomSeed: "a",
});

describe("indices to binary converter", () => {
  it("works on 5-stroke simple case", () => {
    expect(indicesToBinary(5)([0, 1, 3])).toBe(26);
  });
});

describe("binary to indices converter", () => {
  it("works on 5-stroke simple case", () => {
    expect(binaryToIndices(5)(19)).toEqual([0, 3, 4]);
  });
});

describe("bi-directional conversion", () => {
  it("should be consistent", () => {
    const n = 10;
    const [i2b, b2i] = [indicesToBinary(n), binaryToIndices(n)];
    const numbers = [...Array(100).keys()].map((_) =>
      randomInt(0, 1 << (n - 1)),
    );
    for (const i of numbers) {
      expect(i2b(b2i(i))).toBe(i);
    }
  });
});

describe("generate slice binaries", () => {
  const { 丰, 十 } = w;
  const [cglyph, rglyph] = [丰.shape[0].glyph, 十.shape[0].glyph];
  const component: Cache = {
    name: "丰",
    glyph: cglyph,
    topology: findTopology(cglyph),
  };
  const root: Cache = {
    name: "十",
    glyph: rglyph,
    topology: findTopology(rglyph),
  };
  it("should find multiple occurence of a root", () => {
    expect(generateSliceBinaries(component, root)).toEqual([9, 5, 3]);
  });
});
