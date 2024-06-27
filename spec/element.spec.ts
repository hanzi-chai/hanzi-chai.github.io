import { describe, it, expect } from "vitest";
import {
  defaultAlgebra,
  applyRules,
  renderName,
  renderList,
  parseList,
} from "../src/lib/element";

describe("element", () => {
  it("applyRules should apply the specified rules to the given syllable", () => {
    const rules = defaultAlgebra["韵母"];
    const syllable = "you";
    expect(applyRules("韵母", rules, syllable)).toBe("韵母-iou");
  });

  it("renderName should render the name of the codable object", () => {
    const result = renderName({ type: "汉字" });
    expect(result).toBe("汉字");
  });

  it("renderList should render the list representation of the codable object", () => {
    const result = renderList({ type: "汉字" });
    expect(result).toEqual(["汉字"]);
  });

  it("parseList should parse the list representation and return the codable object", () => {
    const result = parseList(["汉字"]);
    expect(result).toEqual({ type: "汉字" });
  });

  // it("findElement should find the element in the total result based on the config and extra", () => {
  //   const object = { type: "汉字" };
  //   const result = { /* total result object */ };
  //   const config = { /* config object */ };
  //   const extra = { /* extra object */ };
  //   const foundElement = findElement(object, result, config, extra);
  //   expect(foundElement).toBe(/* expected element */);
  // });
});
