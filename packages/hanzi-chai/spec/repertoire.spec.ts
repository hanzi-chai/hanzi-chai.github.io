import { describe, it, expect } from "bun:test";
import { 是复合体, 字库, 字形库 } from "../src/index.js";
import type { 基本部件数据, 字符数据, 字符数据补丁 } from "../src/index.js";

const 部件数据: 基本部件数据 = {
  type: "component",
  id: 1,
  ambiguous: false,
  operator: undefined,
  references: undefined,
  strokes: [
    {
      feature: "横",
      start: [0, 0],
      curveList: [{ command: "h", parameterList: [100] }],
    },
  ],
};

const 字符列表: 字符数据[] = [
  { unicode: "一".codePointAt(0)!, glyphs: [{ id: 1, sources: ["G"] }] },
];

describe("字形库与字库的分阶段构造", () => {
  it("字符数据变化时复用同一字形库实例的字形", () => {
    const 字形库实例 = new 字形库([部件数据]);
    const 字库一 = new 字库(字符列表, 字形库实例, ["G"]);
    const 字库二 = new 字库(字符列表, 字形库实例, ["G"]);
    const [, 字形一] = [...字库一.字形迭代器()][0]!;
    const [, 字形二] = [...字库二.字形迭代器()][0]!;
    expect(字形一).toBe(字形二);
    // 不同字形库构建的字形实例相互独立
    const 另一字形库实例 = new 字形库([部件数据]);
    const [, 另一字形] = [...另一字形库实例.字形迭代器()][0]!;
    expect(字形一).not.toBe(另一字形);
  });

  it("字符表随字符列表变化", () => {
    const 字形库实例 = new 字形库([部件数据]);
    const 字库实例 = new 字库(字符列表, 字形库实例, ["G"]);
    expect(字库实例.校验字符("一")?.final_glyphs).toEqual([
      { id: 1, sources: ["G"] },
    ]);
    const 空字库实例 = new 字库([], 字形库实例, ["G"]);
    expect(空字库实例.校验字符("一")).toBeUndefined();
  });

  it("字形运算保留字符与父字形的引用，并在规则间独立绑定变量", () => {
    const 变量 = { variable: 1 };
    const 字形库实例 = new 字形库(
      [
        部件数据,
        { ...部件数据, id: 2 },
        {
          id: 3,
          name: "变换对象",
          type: "compound",
          operator: "⿰",
          references: [{ id: 1 }, { id: 2 }],
          ambiguous: false,
        },
        {
          id: 4,
          type: "compound",
          operator: "⿱",
          references: [{ id: 3 }, { id: 1 }],
          ambiguous: false,
        },
      ],
      [
        {
          from: { operator: "⿰", references: [变量, 1] },
          to: 1,
        },
        {
          from: { operator: "⿰", references: [1, 变量] },
          to: {
            operator: "⿱",
            references: [{ operator: "⿻", references: [1, 变量] }, 1],
          },
        },
        {
          from: { operator: "⿱", references: [变量, 1] },
          to: { operator: "⿰", references: [变量, 2] },
        },
      ],
    );
    const 字库实例 = new 字库(
      [{ unicode: "二".codePointAt(0)!, glyphs: [{ id: 3, sources: ["G"] }] }],
      字形库实例,
      ["G"],
    );
    const 字符 = 字库实例.校验字符("二")!.character;
    const [字形] = 字库实例.查询字符的字形(字符) ?? [];
    if (!字形 || !是复合体(字形)) throw new Error("找不到变换后的复合体");
    expect(字形.id).toBe(3);
    expect(字形.name).toBe("变换对象");
    expect(字形.结构描述字符).toBe("⿰");
    const [新分部] = 字形.部分列表;
    if (!新分部 || !是复合体(新分部)) throw new Error("找不到合成的分部");
    expect(新分部.结构描述字符).toBe("⿻");
    expect(新分部.部分列表.map((x) => x.id)).toEqual([1, 2]);
    const 父字形 = 字形库实例.获取字形(4);
    if (!父字形 || !是复合体(父字形)) throw new Error("找不到父字形");
    expect(父字形.部分列表[0]).toBe(字形);
  });

  it("补丁校验原始字形存在性", () => {
    const 字形库实例 = new 字形库([部件数据]);
    const 存在补丁: 字符数据补丁 = { type: "insert", id: 1, sources: ["G"] };
    const 缺失补丁: 字符数据补丁 = { type: "insert", id: 2, sources: ["G"] };
    const 字库实例 = new 字库(
      [{ unicode: "一".codePointAt(0)!, glyphs: [] }],
      字形库实例,
      ["G"],
      { 一: [存在补丁, 缺失补丁] },
    );
    // id 2 不存在于字形库中，对应的补丁被跳过
    expect(字库实例.校验字符("一")?.final_glyphs).toEqual([
      { id: 1, sources: ["G"] },
    ]);
  });
});
