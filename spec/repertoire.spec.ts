import { describe, expect, it } from "bun:test";
import type { 基本部件数据, 字符数据, 字符数据补丁 } from "../src/index.js";
import { 字库, 字形库, 是复合体 } from "../src/index.js";

const 部件数据: 基本部件数据 = {
  type: "component",
  id: 1,
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

  it("缺少指定来源时按全局来源顺序选一个字形，并保留真实来源", () => {
    const 字形库实例 = new 字形库([1, 2, 3].map((id) => ({ ...部件数据, id })));
    const 字符数据: 字符数据[] = [
      {
        unicode: "一".codePointAt(0)!,
        glyphs: [
          { id: 3, sources: ["U", "V"] },
          { id: 2, sources: ["K", "J"] },
          { id: 1, sources: ["G", "T"] },
        ],
      },
    ];
    const 用例: [string[], 字符数据["glyphs"]][] = [
      [["H"], [{ id: 1, sources: ["G"] }]],
      [[], [{ id: 1, sources: ["G"] }]],
      [
        ["J", "V"],
        [
          { id: 3, sources: ["V"] },
          { id: 2, sources: ["J"] },
        ],
      ],
    ];
    for (const [来源, 预期] of 用例) {
      const 字库实例 = new 字库(字符数据, 字形库实例, [...来源]);
      expect(字库实例.校验字符("一")?.final_glyphs).toEqual(预期);
    }
    const 仅其他来源 = new 字库(
      [{ ...字符数据[0]!, glyphs: 字符数据[0]!.glyphs.slice(0, 2) }],
      字形库实例,
      ["G", "H", "T"],
    );
    expect(仅其他来源.校验字符("一")?.final_glyphs).toEqual([
      { id: 2, sources: ["J"] },
    ]);
  });

  it("兼容形与缺省来源共存，缺省选择采用补丁后的字形", () => {
    const 字形库实例 = new 字形库([1, 2, 3].map((id) => ({ ...部件数据, id })));
    const 字符数据: 字符数据[] = [
      {
        unicode: "一".codePointAt(0)!,
        glyphs: [
          { id: 1, sources: ["J"] },
          { id: 2, sources: ["K"] },
        ],
      },
    ];
    const 字库实例 = new 字库(字符数据, 字形库实例, ["G"], {
      一: [
        { type: "delete", sources: ["J"] },
        { type: "update", id: 1, sources: ["K"] },
        { type: "insert", id: 3, sources: [] },
      ],
    });
    expect(字库实例.校验字符("一")?.final_glyphs).toEqual([
      { id: 1, sources: ["K"] },
      { id: 3, sources: [] },
    ]);
    const 全部删除 = new 字库(字符数据, 字形库实例, ["G"], {
      一: [{ type: "delete", sources: ["J", "K"] }],
    });
    expect(全部删除.校验字符("一")?.final_glyphs).toEqual([]);
    const 仅兼容形 = new 字库(
      [{ ...字符数据[0]!, glyphs: [{ id: 3, sources: [] }] }],
      字形库实例,
      ["G"],
    );
    expect(仅兼容形.校验字符("一")?.final_glyphs).toEqual([
      { id: 3, sources: [] },
    ]);
  });

  it("新增来源未登记优先级时仍可作为缺省字形", () => {
    const 字库实例 = new 字库(
      [
        {
          unicode: "一".codePointAt(0)!,
          glyphs: [{ id: 1, sources: ["新来源"] }],
        },
      ],
      new 字形库([部件数据]),
      ["G"],
    );
    expect(字库实例.校验字符("一")?.final_glyphs).toEqual([
      { id: 1, sources: ["新来源"] },
    ]);
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
        },
        {
          id: 4,
          type: "compound",
          operator: "⿱",
          references: [{ id: 3 }, { id: 1 }],
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
