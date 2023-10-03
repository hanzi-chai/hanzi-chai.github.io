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
import { buildCache, useWen } from "./mock";
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
  const 丰 = buildCache("丰");
  const 十 = buildCache("十");
  it("should find multiple occurence of a root", () => {
    expect(generateSliceBinaries(丰, 十)).toEqual([9, 5, 3]);
  });
});

const slice = (source: Glyph, indices: number[]) =>
  indices.map((i) => source[i]);

describe("degenerate cross tests", () => {
  const {
    大,
    天,
    九,
    丸,
    儿,
    充,
    其,
    艹,
    山,
    出,
    冖,
    农,
    亦,
    赤,
    以,
    人,
    良,
    展内,
  } = useWen();
  const slice = (source: Glyph, indices: number[]) =>
    indices.map((i) => source[i]);
  it("says 天 has 大", () => {
    expect(degenerate(大)).toEqual(degenerate(slice(天, [1, 2, 3])));
  });
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
  it("says 赤下 is 亦下", () => {
    expect(degenerate(slice(亦, [2, 3, 4, 5]))).toEqual(
      degenerate(slice(赤, [3, 4, 5, 6])),
    );
  });
  it("says 良下 is 展下", () => {
    expect(degenerate(slice(良, [4, 5, 6]))).toEqual(
      degenerate(slice(展内, [4, 5, 6])),
    );
  });
  it("says 以 has 人", () => {
    hasroot(以, [2, 3], 人);
  });
});

const hasroot = (a: Glyph, indices: number[], root: Glyph) => {
  expect(degenerate(slice(a, indices))).toEqual(degenerate(root));
};

describe("degenerate cross tests 2", () => {
  const { 豕, 彖, 象, 毅左, 涿右, 蒙下, 遂内 } = useWen();
  const base = slice(豕, [1, 2, 3, 4, 5, 6]);
  it("says 彖 has 豕下", () => {
    hasroot(彖, [3, 4, 5, 6, 7, 8], base);
  });
  it("says 象 has 豕下", () => {
    hasroot(象, [5, 6, 7, 8, 9, 10], base);
  });
  it("says 毅左 has 豕下", () => {
    hasroot(毅左, [5, 6, 7, 8, 9, 10], base);
  });
  it("says 涿右 has 豕下", () => {
    hasroot(涿右, [1, 2, 3, 4, 6, 7], base);
  });
  it("says 蒙下 has 豕下", () => {
    hasroot(蒙下, [2, 3, 4, 5, 6, 7], base);
  });
  it("says 遂内 has 豕下", () => {
    hasroot(遂内, [3, 4, 5, 6, 7, 8], base);
  });
});

describe("degenerate cross tests 3", () => {
  const { 永, 承, 水, 丞 } = useWen();
  const base = slice(承, [5, 6, 7]);
  it("says 承 has 水", () => {
    hasroot(承, [5, 6, 7], base);
  });
  it("says 永 has 水", () => {
    hasroot(永, [2, 3, 4], base);
  });
  it("says 丞 has 水", () => {
    hasroot(丞, [2, 3, 4], base);
  });
});
