import { affineMerge, Compound, SVGGlyph } from "~/lib";
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
        start: [10, 50],
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
    const glyphList: SVGGlyph[] = [A, B];
    const expected: SVGGlyph = [
      {
        feature: "横",
        start: [5, 50],
        curveList: [{ command: "h", parameterList: [30] }],
      },
      {
        feature: "竖",
        start: [75, 10],
        curveList: [{ command: "v", parameterList: [80] }],
      },
    ];

    expect(affineMerge(compound, glyphList)).toEqual(expected);
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
    const glyphList: SVGGlyph[] = [A, B];
    const expected: SVGGlyph = [
      {
        feature: "平点",
        start: [50, 30],
        curveList: [{ command: "z", parameterList: [10, 0, 15, 0, 20, 5] }],
      },
      ...A,
    ];

    expect(affineMerge(compound, glyphList)).toEqual(expected);
  });
});
