import { describe, expect, it } from "vitest";
import type { SVGGlyph } from "~/lib";
import {
  analysis,
  assemble,
  classifier,
  examples,
  isValidCJKChar,
  recursiveRenderComponent,
  recursiveRenderCompound,
} from "~/lib";
import { focusAnalysis, primitiveRepertoire, repertoire } from "./mock";
import { readFileSync } from "fs";

describe("e2e test", () => {
  it("checks database integrity", () => {
    const config = examples["mswb"];
    const analysisResult = analysis(
      repertoire,
      focusAnalysis(config, repertoire),
      Object.keys(repertoire).filter(isValidCJKChar),
    );
    const { componentError, compoundError } = analysisResult;
    expect(componentError).toHaveLength(0);
    expect(compoundError).toHaveLength(0);
    const characters = Object.keys(repertoire).filter(isValidCJKChar);

    const assemblyResult = assemble(
      repertoire,
      {
        algebra: config.algebra,
        encoder: config.encoder,
        keyboard: config.form,
        priority: [],
      },
      characters,
      [],
      new Map(),
      analysisResult,
      {},
    );
    expect(assemblyResult.length).toBeGreaterThan(6600);
  });

  it("checks stroke orders are correct", () => {
    const tygf = new Map(
      readFileSync("public/cache/tygf.txt", "utf-8")
        .trim()
        .split("\n")
        .map((x) => x.trim().split("\t") as [string, string]),
    );
    const cjk = new Map(
      readFileSync("public/cache/cjk.txt", "utf-8")
        .trim()
        .split("\n")
        .map((x) => x.trim().split("\t") as [string, string]),
    );
    const result = new Map<string, string[]>();
    const summarize = (glyph: SVGGlyph) =>
      glyph.map((x) => classifier[x.feature]).join("");
    for (const [char, { glyphs }] of Object.entries(primitiveRepertoire)) {
      for (const glyph of glyphs) {
        if (glyph.tags?.includes("中竖截断")) continue;
        if (glyph.tags?.includes("戈部截断")) continue;
        let svg: SVGGlyph;
        if (glyph.type === "basic_component") {
          svg = glyph.strokes;
        } else if (
          glyph.type === "derived_component" ||
          glyph.type === "spliced_component"
        ) {
          const svgglyph = recursiveRenderComponent(glyph, primitiveRepertoire);
          svg = svgglyph instanceof Error ? [] : svgglyph;
        } else {
          const svgglyph = recursiveRenderCompound(glyph, repertoire);
          svg = svgglyph instanceof Error ? [] : svgglyph.strokes;
        }
        result.set(char, (result.get(char) ?? []).concat(summarize(svg)));
      }
    }
    let differences = 0;
    for (const [char, orders] of result) {
      const referenceOrder = tygf.get(char) ?? cjk.get(char);
      if (referenceOrder === undefined) continue;
      for (const order of orders) {
        if (order !== referenceOrder) {
          differences += 1;
          console.log(char, order, referenceOrder);
        }
      }
    }
    expect(differences).toBeLessThan(30);
  });
});
