import {
  degenerate as _degenerate,
  indicesToBinary,
  binaryToIndices,
  defaultDegenerator,
  generateSliceBinaries,
} from "~/lib";
import { describe, it, expect } from "vitest";
import { create, all } from "mathjs";
import { computedGlyphs2 as renderedGlyphs, computedComponents } from "./mock";
import type { RenderedGlyph } from "~/lib";

const { randomInt } = create(all!, {
  randomSeed: "a",
});

const degenerate = (glyph: RenderedGlyph) =>
  _degenerate(defaultDegenerator, glyph);

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
    const numbers = [...Array(100).keys()].map(() =>
      randomInt(0, 1 << (n - 1)),
    );
    for (const i of numbers) {
      expect(i2b(b2i(i))).toBe(i);
    }
  });
});

describe("generate slice binaries", () => {
  it("should find multiple occurence of a root", () => {
    const { 丰, 十 } = computedComponents;
    expect(generateSliceBinaries(defaultDegenerator, 丰!, 十!)).toEqual([
      9, 5, 3,
    ]);
  });

  it("should be able to distinguish 土 and 士", () => {
    const { 土, 士, 王, 壬 } = computedComponents;
    expect(generateSliceBinaries(defaultDegenerator, 王!, 土!)).toEqual([7]);
    expect(generateSliceBinaries(defaultDegenerator, 王!, 士!)).toEqual([]);
    expect(generateSliceBinaries(defaultDegenerator, 壬!, 土!)).toEqual([]);
    expect(generateSliceBinaries(defaultDegenerator, 壬!, 士!)).toEqual([7]);
  });

  it("should be able to distinguish 未 and 末", () => {
    const { 未, 末, 朱, 耒 } = computedComponents;
    expect(generateSliceBinaries(defaultDegenerator, 朱!, 未!)).toEqual([31]);
    expect(generateSliceBinaries(defaultDegenerator, 耒!, 未!)).toEqual([
      47, 31,
    ]);
    expect(generateSliceBinaries(defaultDegenerator, 朱!, 末!)).toEqual([]);
    expect(generateSliceBinaries(defaultDegenerator, 耒!, 末!)).toEqual([]);
  });

  it("should be able to distinguish 口 and 囗", () => {
    const { 口, 囗, 中, 日 } = computedComponents;
    expect(generateSliceBinaries(defaultDegenerator, 中!, 口!)).toEqual([14]);
    expect(generateSliceBinaries(defaultDegenerator, 中!, 囗!)).toEqual([]);
    expect(generateSliceBinaries(defaultDegenerator, 日!, 口!)).toEqual([]);
    expect(generateSliceBinaries(defaultDegenerator, 日!, 囗!)).toEqual([13]);
  });

  it("should be able to distinguish 木无十 and 全字头", () => {
    const 木无十 = computedComponents["\ue087"]!;
    const 全字头 = computedComponents["\ue43d"]!;
    const { 朱 } = computedComponents;
    expect(generateSliceBinaries(defaultDegenerator, 朱!, 木无十)).toEqual([3]);
    expect(generateSliceBinaries(defaultDegenerator, 朱!, 全字头)).toEqual([]);
  });
});

const slice = (source: RenderedGlyph, indices: number[]) =>
  source.filter((_, i) => indices.includes(i));

const hasroot = (a: RenderedGlyph, indices: number[], root: RenderedGlyph) => {
  expect(degenerate(slice(a, indices))).toEqual(degenerate(root));
};

describe("degenerate cross tests", () => {
  const { 大, 天, 九, 丸, 山, 出, 冖, 农, 以, 人, 氺, 丆, 疌, 龰, 夫, 龵 } =
    renderedGlyphs as any;
  const han = renderedGlyphs["\ue104"]!;
  const mao3 = renderedGlyphs["\ue17d"]!;
  it("says 天 has 大", () => {
    expect(degenerate(大)).toEqual(degenerate(slice(天, [1, 2, 3])));
  });
  it("says 丸 has 九", () => {
    expect(degenerate(九)).toEqual(degenerate(slice(丸, [0, 1])));
  });
  it("says 出 has 山", () => {
    expect(degenerate(山)).toEqual(degenerate(slice(出, [2, 3, 4])));
  });
  it("says 氺 doesn't have 丆", () => {
    expect(degenerate(丆)).not.toEqual(degenerate(slice(氺, [2, 3])));
  });
  it("says 农 has 冖", () => {
    expect(degenerate(冖)).toEqual(degenerate(slice(农, [0, 1])));
  });
  // it("says 赤 has 亦字底", () => {
  //   expect(degenerate(computedGlyphs["\ue42e"])).toEqual(
  //     degenerate(slice(赤, [3, 4, 5, 6])),
  //   );
  // });
  it("says 以 has 人", () => {
    hasroot(以, [2, 3], 人);
  });
  it("says 疌 has 龰", () => {
    hasroot(疌, [4, 5, 6, 7], 龰);
  });
  it("says E104 has 夫", () => {
    hasroot(han, [7, 8, 9, 10], 夫);
  });
  it("says 龵 has 龵", () => {
    hasroot(龵, [0, 1, 2], mao3);
  });
});

describe("degenerate cross tests 2", () => {
  const { 豕, 彖, 豖, 㒸, 豙 } = renderedGlyphs as any;
  const 蒙下 = renderedGlyphs["\ue0b3"]!;
  const base = slice(豕, [1, 2, 3, 4, 5, 6]);
  it("says 彖 has 豕下", () => {
    hasroot(彖, [3, 4, 5, 6, 7, 8], base);
  });
  it("says 豙 has 豕下", () => {
    hasroot(豙, [5, 6, 7, 8, 9, 10], base);
  });
  it("says 豖 has 豕下", () => {
    hasroot(豖, [1, 2, 3, 4, 6, 7], base);
  });
  it("says 蒙下 has 豕下", () => {
    hasroot(蒙下, [2, 3, 4, 5, 6, 7], base);
  });
  it("says 㒸 has 豕下", () => {
    hasroot(㒸, [3, 4, 5, 6, 7, 8], base);
  });
});

describe("degenerate cross tests 3", () => {
  const { 永, 承, 氶 } = renderedGlyphs as any;
  const base = slice(承, [5, 6, 7]);
  it("says 承 has 水", () => {
    hasroot(承, [5, 6, 7], base);
  });
  it("says 永 has 水", () => {
    hasroot(永, [2, 3, 4], base);
  });
  it("says 氶 has 水", () => {
    hasroot(氶, [2, 3, 4], base);
  });
});

describe("degenerate cross tests 4", () => {
  const { 隶, 氺 } = renderedGlyphs as any;
  it("says 承 has 水", () => {
    hasroot(隶, [3, 4, 5, 6, 7], 氺);
  });
});
