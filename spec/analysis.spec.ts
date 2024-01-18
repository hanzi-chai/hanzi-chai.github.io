import { describe, expect, it } from "vitest";
import { analysis, assemble, examples, getTSV, isValidCJKChar } from "~/lib";
import { repertoire } from "./mock";

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
});
