import { describe, it, expect } from "vitest";
import {
  从列表生成,
  摘要,
  转列表,
} from "../src/main";

describe("element", () => {
  it("renderName should render the name of the codable object", () => {
    const result = 摘要({ type: "汉字" });
    expect(result).toEqual("汉字");
  });

  it("renderList should render the list representation of the codable object", () => {
    const result = 转列表({ type: "汉字" });
    expect(result).toEqual(["汉字"]);
  });

  it("parseList should parse the list representation and return the codable object", () => {
    const result = 从列表生成(["汉字"]);
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
