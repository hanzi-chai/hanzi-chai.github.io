import { beforeAll, describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import {
  区块列表,
  type 字集指示,
  字集过滤查找表,
  type 获取字库,
} from "../src/index.js";
import { 获取数据 } from "./index.js";

let 字库: ReturnType<typeof 获取字库>;

beforeAll(() => {
  ({ 字库 } = 获取数据());
});

describe("字集过滤", () => {
  it("Unicode 18 新增的 U+2B81E 计入扩展 D 区及其上层字集", () => {
    const 记录 = 字库.校验字符(String.fromCodePoint(0x2b81e))!;
    expect(区块列表.find((区块) => 区块.name === "cjk-d")?.count).toBe(223);
    for (const 指示 of [
      "extended",
      "supplement",
      "panlingual",
      "maximal",
    ] as const) {
      expect(字集过滤查找表[指示](记录.character, 记录)).toBe(true);
    }
  });

  it("各字集大小符合预期", () => {
    const specifiers: 字集指示[] = [
      "minimal",
      "gb2312",
      "general",
      "basic",
      "extended",
      "supplement",
      "panlingual",
      "maximal",
    ];
    // maximal 包含数据快照中的全部字符；私用区条目数量会随字库更新变化。
    const 原始字符列表 = JSON.parse(
      readFileSync(new URL("../data/characters.json", import.meta.url), "utf8"),
    );
    // Unicode 18.0 在扩展 D 区新增 U+2B81E，扩展／补充／多语言字集各增加一字。
    // https://www.unicode.org/versions/Unicode18.0.0/core-spec/chapter-18/
    const 汉字数量 = [
      6638,
      6763,
      8105,
      21265,
      101985,
      103367,
      110895,
      原始字符列表.length,
    ];
    for (let i = 0; i < specifiers.length; i++) {
      const 指示 = specifiers[i]!;
      const 结果 = [...字库].filter(([, 信息]) => {
        const 过滤器 = 字集过滤查找表[指示];
        return 过滤器(信息.character, 信息);
      });
      expect(结果.length).toBe(汉字数量[i]!);
    }
  });
});
