import _degenerate, {
  indicesToBinary,
  binaryToIndices,
  generateSliceBinaries,
  defaultDegenerator,
} from "~/lib/degenerator";
import { describe, it, expect } from "vitest";
import { create, all } from "mathjs";
import type { SVGGlyph } from "~/lib/data";
import { computedGlyphs, rendered } from "./mock";
import { RenderedGlyph } from "~/lib/topology";
import { defaultKeyboard } from "~/lib/templates";
import { computeComponent } from "~/lib/component";

const { randomInt } = create(all, {
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

// describe("generate slice binaries", () => {
//   const { 丰, 十 } = computedGlyphs;
//   const feng = computeComponent("丰", 丰);
//   it("should find multiple occurence of a root", () => {
//     expect(generateSliceBinaries(defaultForm, 丰, 十)).toEqual([9, 5, 3]);
//   });
// });

const slice = (source: RenderedGlyph, indices: number[]) =>
  source.filter((_, i) => indices.includes(i));

const hasroot = (a: RenderedGlyph, indices: number[], root: RenderedGlyph) => {
  expect(degenerate(slice(a, indices))).toEqual(degenerate(root));
};

describe("degenerate cross tests", () => {
  const { 大, 天, 九, 丸, 山, 出, 冖, 农, 赤, 以, 人, 氺, 丆, 疌, 龰 } =
    computedGlyphs;
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
});

describe("degenerate cross tests 2", () => {
  const { 豕, 彖, 豖, 㒸, 豙 } = computedGlyphs;
  const 蒙下 = computedGlyphs["\ue0b3"];
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
  const { 永, 承, 氶 } = computedGlyphs;
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
  const { 隶, 氺 } = computedGlyphs;
  it("says 承 has 水", () => {
    hasroot(隶, [3, 4, 5, 6, 7], 氺);
  });
});
