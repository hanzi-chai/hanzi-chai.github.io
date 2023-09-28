import degenerate, {
  indicesToBinary,
  binaryToIndices,
  generateSliceBinaries,
} from "./degenerator";
import { describe, it, expect } from "vitest";
import { create, all, exp } from "mathjs";
import findTopology from "./topology";
import wen from "../data/wen.json";
import { Glyph, Wen } from "./data";
import { Cache } from "./root";
import { useWen, useWenSimp } from "./mock";
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

describe("degenerate cross tests", () => {
  const { 九, 丸, 儿, 充, 其, 艹, 山, 出, 冖, 农, 厶, 瓜 } = useWenSimp();
  const slice = (source: Glyph, indices: number[]) =>
    indices.map((i) => source[i]);
  it("says 丸 has 九", () => {
    expect(degenerate(九)).toEqual(degenerate(slice(丸, [0, 1])));
  });
  it("says 充 has 儿", () => {
    expect(degenerate(儿)).toEqual(degenerate(slice(充, [4, 5])));
  });
  it("says 其 has 艹", () => {
    expect(degenerate(艹)).toEqual(degenerate(slice(其, [0, 1, 2])));
  });
  it("says 出 has 山", () => {
    expect(degenerate(山)).toEqual(degenerate(slice(出, [2, 3, 4])));
  });
  it("says 农 has 冖", () => {
    expect(degenerate(冖)).toEqual(degenerate(slice(农, [0, 1])));
  });
  it("says 瓜 has 厶", () => {
    expect(degenerate(厶)).toEqual(degenerate(slice(瓜, [2, 3])));
  });
});
