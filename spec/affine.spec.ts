import type { Compound, SVGGlyph, SVGGlyphWithBox } from "~/lib";
import { affineMerge } from "~/lib";
import { describe, expect, it } from "vitest";

describe("affine transformations", () => {
  it("should merge the components correctly", () => {
    const compound: Compound = {
      type: "compound",
      operator: "⿰",
      operandList: ["A", "B"],
    };
    const A: SVGGlyph = [
      {
        feature: "横",
        start: [20, 50],
        curveList: [{ command: "h", parameterList: [60] }],
      },
    ];
    const B: SVGGlyph = [
      {
        feature: "竖",
        start: [50, 10],
        curveList: [{ command: "v", parameterList: [80] }],
      },
    ];
    const glyphList: SVGGlyphWithBox[] = [
      { strokes: A, box: { x: [20, 80], y: [50, 50] } },
      { strokes: B, box: { x: [50, 50], y: [10, 90] } },
    ];
    const expected: SVGGlyph = [
      {
        feature: "横",
        start: [20, 50],
        curveList: [{ command: "h", parameterList: [60] }],
      },
      {
        feature: "竖",
        start: [100, 10],
        curveList: [{ command: "v", parameterList: [80] }],
      },
    ];

    expect(affineMerge(compound, glyphList).strokes).toEqual(expected);
  });

  it("should merge the components with order info correctly", () => {
    const compound: Compound = {
      type: "compound",
      operator: "⿴",
      operandList: ["A", "B"],
      order: [
        { index: 1, strokes: 1 },
        { index: 0, strokes: 0 },
      ],
    };
    const A: SVGGlyph = [
      {
        feature: "撇",
        start: [50, 10],
        curveList: [{ command: "c", parameterList: [0, -20, 0, -40, 10, -60] }],
      },
    ];
    const B: SVGGlyph = [
      {
        feature: "平点",
        start: [50, 10],
        curveList: [{ command: "z", parameterList: [20, 0, 30, 0, 40, 10] }],
      },
    ];
    const glyphList: SVGGlyphWithBox[] = [
      { strokes: A, box: { x: [0, 100], y: [0, 100] } },
      { strokes: B, box: { x: [0, 100], y: [0, 100] } },
    ];
    const expected: SVGGlyph = [
      {
        feature: "平点",
        start: [50, 30],
        curveList: [{ command: "z", parameterList: [10, 0, 15, 0, 20, 5] }],
      },
      ...A,
    ];

    expect(affineMerge(compound, glyphList).strokes).toEqual(expected);
  });
});
