import { describe, expect, it } from "vitest";
import {
  SVGGlyph,
  analysis,
  assemble,
  classifier,
  examples,
  getTSV,
  isValidCJKChar,
  recursiveRenderCompound,
} from "~/lib";
import { repertoire } from "./mock";
import { readFileSync } from "fs";

describe("e2e test", () => {
  it("checks database integrity", () => {
    const config = examples["mswb"];
    const analysisResult = analysis(repertoire, config);
    const { componentError, compoundError } = analysisResult;
    expect(componentError).toHaveLength(0);
    expect(compoundError).toHaveLength(0);
    const characters = Object.keys(repertoire).filter(isValidCJKChar);
    const assemblyResult = assemble(
      repertoire,
      config,
      characters,
      analysisResult,
    );
    expect(getTSV(assemblyResult).length).toBeGreaterThan(6600);
  });

  it("checks stroke orders are correct", () => {
    const tygf = readFileSync("public/cache/tygf.txt", "utf-8")
      .trim()
      .split("\n")
      .map((x) => x.trim().split("\t"));
    const reference = new Map(tygf.map((x) => [x[1]!, x[3]!]));
    const result = new Map<string, string>();
    const summarize = (glyph: SVGGlyph) =>
      glyph.map((x) => classifier[x.feature]).join("");
    for (const [char, { glyph }] of Object.entries(repertoire)) {
      if (glyph === undefined) continue;
      if (glyph.type === "basic_component") {
        result.set(char, summarize(glyph.strokes));
      } else {
        const svgglyph = recursiveRenderCompound(glyph, repertoire);
        if (svgglyph instanceof Error) throw svgglyph;
        result.set(char, summarize(svgglyph));
      }
    }
    let differences = 0;
    for (const [char, order] of result) {
      const referenceOrder = reference.get(char);
      if (referenceOrder === undefined) continue;
      if (order !== referenceOrder) {
        differences += 1;
        console.log(char, order, referenceOrder);
      }
    }
    expect(differences).toBe(0);
  });
});
