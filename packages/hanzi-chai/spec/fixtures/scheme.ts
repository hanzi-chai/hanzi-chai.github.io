import Pako from "pako";
import {
  最小方案,
  构建字库,
  准备方案,
  type 基本部件数据,
  type 字符数据,
  type 原始词典,
} from "../../src/index.js";

export const glyphs: 基本部件数据[] = [1, 2].map((id) => ({
  id,
  type: "component",
  operator: undefined,
  references: undefined,
  ambiguous: false,
  strokes: Array.from({ length: id }, (_, index) => ({
    feature: "横",
    start: [10, 20 + index * 30],
    curveList: [{ command: "h", parameterList: [80] }],
  })),
}));
export const characters: 字符数据[] = ["一", "二"].map((character, i) => ({
  unicode: character.codePointAt(0)!,
  tygf: 1,
  glyphs: [{ id: i + 1, sources: ["G"] }],
}));
export const dictionary: 原始词典 = [
  { 词: "一", 拼音: ["yi1"], 频率: 100 },
  { 词: "二", 拼音: ["er4"], 频率: 30 },
  { 词: "一二", 拼音: ["yi1", "er4"], 频率: 10 },
];
export function fixtureConfig() {
  return structuredClone(最小方案);
}
export function fixtureContext(config = fixtureConfig()) {
  return 准备方案(config, {
    字库: 构建字库(config, characters, glyphs),
    原始词典: dictionary,
  });
}
export function fixtureBuffers() {
  return {
    characters: Pako.deflate(JSON.stringify(characters)),
    glyphs: Pako.deflate(JSON.stringify(glyphs)),
    dictionary: new TextEncoder().encode(
      "一\tyi1\t100\n二\ter4\t30\n一二\tyi1 er4\t10\n",
    ),
    distribution: new TextEncoder().encode(
      "a\t0.2\t1\t1\nb\t0.2\t1\t1\nc\t0.2\t1\t1\nd\t0.2\t1\t1\ne\t0.2\t1\t1\n",
    ),
    equivalence: new TextEncoder().encode("aa\t1\nab\t1\n"),
  };
}
