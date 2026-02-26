import { describe, expect, it } from "vitest";
import { 获取数据 } from "./index.js";
import type { 同源部件组 } from "../src/config.js";

const { 字库 } = 获取数据();

/** 獲取字庫中 Plane 15 PUA 字符集合 */
function 获取Plane15字符(字库数据: Record<string, unknown>): Set<string> {
  const 结果 = new Set<string>();
  for (const ch of Object.keys(字库数据)) {
    const code = ch.codePointAt(0)!;
    if (code >= 0xf0000 && code <= 0xffffd) {
      结果.add(ch);
    }
  }
  return 结果;
}

describe("应用同源部件", () => {
  it("空列表不改变字库", () => {
    const 新字库 = 字库.应用同源部件([]);
    // 应该返回同一个实例
    expect(新字库).toBe(字库);
  });

  it("创建 PUA 字符并替换 operandList", () => {
    // 户 (U+6237, G source) 和 戶 (U+6236, T source)
    const 原有字符 = 获取Plane15字符(字库._get());
    const 同源部件组列表: 同源部件组[] = [{ G: "户", T: "戶" }];
    const 新字库 = 字库.应用同源部件(同源部件组列表);
    const 新字库数据 = 新字库._get();

    // 应该新创建了一个 PUA 字符（Plane 15）
    const 新字符 = 获取Plane15字符(新字库数据);
    const 新增字符列表 = [...新字符].filter((ch) => !原有字符.has(ch));
    expect(新增字符列表.length).toBe(1);

    // PUA 字符应该有名称和两个字形
    const PUA字 = 新增字符列表[0]!;
    const PUA数据 = 新字库数据[PUA字]!;
    expect(PUA数据.name).toContain("同源:");
    expect(PUA数据.glyphs.length).toBe(2);
    // 两个字形应该有不同的地区标签
    const 标签列表 = PUA数据.glyphs.map((g) => g.tags);
    expect(标签列表).toContainEqual(["G"]);
    expect(标签列表).toContainEqual(["T"]);

    // 房（⿸户方）应该被替换为引用 PUA 字
    const 房数据 = 新字库数据["房"];
    if (房数据) {
      const 复合体字形 = 房数据.glyphs.find((g) => g.type === "compound");
      if (复合体字形 && 复合体字形.type === "compound") {
        // operandList 应该引用 PUA 字而不是 户
        expect(复合体字形.operandList).toContain(PUA字);
        expect(复合体字形.operandList).not.toContain("户");
        expect(复合体字形.operandList).not.toContain("戶");
      }
    }
  });

  it("不影响不相关的字", () => {
    const 同源部件组列表: 同源部件组[] = [{ G: "户", T: "戶" }];
    const 新字库 = 字库.应用同源部件(同源部件组列表);
    const 新字库数据 = 新字库._get();

    // 一 应该保持不变
    expect(新字库数据["一"]).toEqual(字库._get()["一"]);
    // 木 应该保持不变
    expect(新字库数据["木"]).toEqual(字库._get()["木"]);
  });

  it("处理单个源的组（应跳过）", () => {
    // 只有一个源的组不应该处理
    const 同源部件组列表: 同源部件组[] = [{ G: "户" }];
    const 新字库 = 字库.应用同源部件(同源部件组列表);
    // 没有配对，应该返回原始字库
    expect(新字库).toBe(字库);
  });

  it("正确处理多个同源部件组", () => {
    const 原有字符 = 获取Plane15字符(字库._get());
    const 同源部件组列表: 同源部件组[] = [
      { G: "户", T: "戶" },
      { G: "青", T: "靑" },
    ];
    const 新字库 = 字库.应用同源部件(同源部件组列表);
    const 新字库数据 = 新字库._get();

    // 應當新創建兩個 PUA 字符
    const 新字符 = 获取Plane15字符(新字库数据);
    const 新增字符列表 = [...新字符].filter((ch) => !原有字符.has(ch));
    expect(新增字符列表.length).toBe(2);
  });
});
