import {
  degenerate as _degenerate,
  indicesToBinary,
  binaryToIndices,
  defaultDegenerator,
  generateSliceBinaries,
} from "~/lib";
import { describe, it, expect } from "vitest";
import { create, all } from "mathjs";
import { computedComponents } from "./mock";
import type { RenderedGlyph } from "~/lib";

const { randomInt } = create(all!, {
  randomSeed: "a",
});

const degenerate = (glyph: RenderedGlyph) =>
  _degenerate(defaultDegenerator, glyph);

describe("二进制数和索引的相互转换", () => {
  it("works on 5-stroke simple case", () => {
    expect(indicesToBinary(5)([0, 1, 3])).toBe(26);
  });
  it("works on 5-stroke simple case", () => {
    expect(binaryToIndices(5)(19)).toEqual([0, 3, 4]);
  });
  it("should be consistent", () => {
    const n = 10;
    const [i2b, b2i] = [indicesToBinary(n), binaryToIndices(n)];
    const numbers = [...Array(100).keys()].map(() =>
      randomInt(0, 1 << (n - 1)),
    );
    for (const i of numbers) {
      expect(i2b(b2i(i))).toBe(i);
    }
  });
});

describe("退化函数：特殊情况", () => {
  it("should find multiple occurence of a root", () => {
    const { 丰, 十 } = computedComponents;
    expect(generateSliceBinaries(defaultDegenerator, 丰!, 十!)).toEqual([
      9, 5, 3,
    ]);
  });

  it("区分「土」和「士」", () => {
    const { 土, 士, 王, 壬 } = computedComponents;
    expect(generateSliceBinaries(defaultDegenerator, 王!, 土!)).toEqual([7]);
    expect(generateSliceBinaries(defaultDegenerator, 王!, 士!)).toEqual([]);
    expect(generateSliceBinaries(defaultDegenerator, 壬!, 土!)).toEqual([]);
    expect(generateSliceBinaries(defaultDegenerator, 壬!, 士!)).toEqual([7]);
  });

  it("区分「未」和「末」", () => {
    const { 未, 末, 朱, 耒 } = computedComponents;
    expect(generateSliceBinaries(defaultDegenerator, 朱!, 未!)).toEqual([31]);
    expect(generateSliceBinaries(defaultDegenerator, 耒!, 未!)).toEqual([
      47, 31,
    ]);
    expect(generateSliceBinaries(defaultDegenerator, 朱!, 末!)).toEqual([]);
    expect(generateSliceBinaries(defaultDegenerator, 耒!, 末!)).toEqual([]);
  });

  it("区分「口」和「囗」", () => {
    const { 口, 囗, 中, 日 } = computedComponents;
    expect(generateSliceBinaries(defaultDegenerator, 中!, 口!)).toEqual([14]);
    expect(generateSliceBinaries(defaultDegenerator, 中!, 囗!)).toEqual([]);
    expect(generateSliceBinaries(defaultDegenerator, 日!, 口!)).toEqual([]);
    expect(generateSliceBinaries(defaultDegenerator, 日!, 囗!)).toEqual([13]);
  });

  it("区分「木无十」和「全字头」", () => {
    const 木无十 = computedComponents["\ue087"]!;
    const 全字头 = computedComponents["\ue43d"]!;
    const { 朱 } = computedComponents;
    expect(generateSliceBinaries(defaultDegenerator, 朱!, 木无十)).toEqual([3]);
    expect(generateSliceBinaries(defaultDegenerator, 朱!, 全字头)).toEqual([]);
  });
});

const 包含 = (字根名: string, 部件名: string, indices: number[]) => {
  const 字根 = computedComponents[字根名]!;
  const 部件 = computedComponents[部件名]!;
  const 切片 = 部件.glyph.filter((_, i) => indices.includes(i));
  expect(degenerate(切片)).toEqual(degenerate(字根.glyph));
};

interface 切片来源 {
  部件名: string;
  索引: number[];
}

interface 切片系列 {
  字根名: string;
  切片来源列表: 切片来源[];
}

const 检查全部切片来源 = (字根名: string, 切片来源列表: 切片来源[]) => {
  for (const { 部件名, 索引 } of 切片来源列表) {
    it(`确认「${部件名}」包含「${字根名}」`, () => 包含(字根名, 部件名, 索引));
  }
};

const 切片系列数据: 切片系列[] = [
  {
    字根名: "\ue420",
    切片来源列表: [
      { 部件名: "彖", 索引: [3, 4, 5, 6, 7, 8] },
      { 部件名: "豙", 索引: [5, 6, 7, 8, 9, 10] },
      { 部件名: "豖", 索引: [1, 2, 3, 4, 6, 7] },
      { 部件名: "\ue0b3", 索引: [2, 3, 4, 5, 6, 7] },
      { 部件名: "㒸", 索引: [3, 4, 5, 6, 7, 8] },
    ],
  },
  {
    字根名: "\ue42c",
    切片来源列表: [
      { 部件名: "承", 索引: [5, 6, 7] },
      { 部件名: "永", 索引: [2, 3, 4] },
      { 部件名: "氶", 索引: [2, 3, 4] },
    ],
  },
  {
    字根名: "\ue010", // 免五,
    切片来源列表: [
      { 部件名: "免", 索引: [0, 1, 2, 3, 4] },
      { 部件名: "兔", 索引: [0, 1, 2, 3, 4] },
      { 部件名: "象", 索引: [0, 1, 2, 3, 4] },
    ],
  },
  {
    字根名: "\ue17d", // 毛三
    切片来源列表: [
      { 部件名: "毛", 索引: [0, 1, 2] },
      { 部件名: "龵", 索引: [0, 1, 2] },
      { 部件名: "手", 索引: [0, 1, 2] },
    ],
  },
  {
    字根名: "氺",
    切片来源列表: [{ 部件名: "隶", 索引: [3, 4, 5, 6, 7] }],
  },
  {
    字根名: "龰",
    切片来源列表: [{ 部件名: "疌", 索引: [4, 5, 6, 7] }],
  },
  {
    字根名: "大",
    切片来源列表: [
      { 部件名: "天", 索引: [1, 2, 3] },
      { 部件名: "夫", 索引: [1, 2, 3] },
    ],
  },
  {
    字根名: "夫",
    切片来源列表: [
      { 部件名: "\ue104", 索引: [7, 8, 9, 10] }, // 漢字边
    ],
  },
  {
    字根名: "山",
    切片来源列表: [{ 部件名: "出", 索引: [2, 3, 4] }],
  },
  {
    字根名: "\uE40F", // 朱三
    切片来源列表: [
      { 部件名: "朱", 索引: [0, 1, 2] },
      { 部件名: "午", 索引: [0, 1, 2] },
      { 部件名: "牛", 索引: [0, 1, 2] },
      { 部件名: "失", 索引: [0, 1, 2] },
      { 部件名: "牜", 索引: [0, 1, 3] },
      { 部件名: "矢", 索引: [0, 1, 2] },
      { 部件名: "缶", 索引: [0, 1, 2] },
      { 部件名: "\uE00F", 索引: [0, 1, 2] }, // 制字旁
      { 部件名: "\uE021", 索引: [0, 1, 2] }, // 卸字旁
      { 部件名: "\uE0B1", 索引: [0, 1, 2] }, // 舞字头
    ],
  },
  {
    字根名: "\uE0FF", // 气三
    切片来源列表: [
      { 部件名: "气", 索引: [0, 1, 2] },
      { 部件名: "生", 索引: [0, 1, 2] },
      { 部件名: "年", 索引: [0, 1, 2] },
    ],
  },
  {
    字根名: "\uE444", // 瓜字心
    切片来源列表: [
      { 部件名: "瓜", 索引: [2, 3] },
      { 部件名: "\uE01C", 索引: [3, 4] },
    ],
  },
  {
    字根名: "鱼",
    切片来源列表: [{ 部件名: "\uE9F0", 索引: [0, 1, 2, 3, 4, 5, 6, 7] }],
  },
];

describe("退化函数：一般情况", () => {
  for (const { 字根名, 切片来源列表 } of 切片系列数据) {
    检查全部切片来源(字根名, 切片来源列表);
  }
});
