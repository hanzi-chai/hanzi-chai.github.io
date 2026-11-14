import { describe, it, expect } from "bun:test";
import { 从列表生成, 摘要, 转列表 } from "../src/index.js";

describe("编码元素", () => {
  it("摘要返回可编码对象的名称", () => {
    const result = 摘要({ type: "汉字" });
    expect(result).toEqual("汉字");
  });

  it("转列表返回列表表示", () => {
    const result = 转列表({ type: "汉字" });
    expect(result).toEqual(["汉字"]);
  });

  it("从列表生成解析列表并返回对象", () => {
    const result = 从列表生成(["汉字"]);
    expect(result).toEqual({ type: "汉字" });
  });
});
