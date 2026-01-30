import { describe, expect, it } from "vitest";
import { 合并拼写运算, 默认拼音分析器 } from "../src/index.js";

describe("拼音分析", () => {
  const 查找表 = 合并拼写运算();
  const 拼音分析器 = new 默认拼音分析器(查找表);
  it("能够分析拼音", () => {
    const 结果 = 拼音分析器.分析("有", ["you3"]);
    if (!结果.ok) throw 结果.error;
    expect(结果.value[0]!.get("韵母")).toBe("韵母-iou");
  });
});
