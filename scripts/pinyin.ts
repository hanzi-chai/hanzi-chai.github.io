import { load } from "js-yaml";
import { readFileSync, writeFileSync } from "fs";

const dict = load(readFileSync("data/kTGHZ2013.txt", "utf-8")) as Record<
  string,
  string
>;

const PHONETIC_SYMBOL: Record<string, string> = {
  ā: "a1",
  á: "a2",
  ǎ: "a3",
  à: "a4",
  ē: "e1",
  é: "e2",
  ě: "e3",
  è: "e4",
  ō: "o1",
  ó: "o2",
  ǒ: "o3",
  ò: "o4",
  ī: "i1",
  í: "i2",
  ǐ: "i3",
  ì: "i4",
  ū: "u1",
  ú: "u2",
  ǔ: "u3",
  ù: "u4",
  ǘ: "v2",
  ǚ: "v3",
  ǜ: "v4",
  ń: "n2",
  ň: "n3",
  "": "m2",
};

const RE_PHONETIC_SYMBOL = new RegExp(
  "([" + Object.keys(PHONETIC_SYMBOL).join("") + "])",
  "g",
);

const parsePinyin2 = function (s: string) {
  let shengdiao: number = 5;
  let shengyun = s.replace(
    RE_PHONETIC_SYMBOL,
    function ($0: string, $1: string) {
      shengdiao = parseInt(PHONETIC_SYMBOL[$1][1]);
      return PHONETIC_SYMBOL[$1][0];
    },
  );
  return shengyun + shengdiao.toString();
};

const data = Object.fromEntries(
  Object.entries(dict).map(([codepoint, pinyinString]) => {
    const char = String.fromCodePoint(parseInt(codepoint.slice(2), 16));
    const pinyin = pinyinString.split(",").map(parsePinyin2);
    return [char, pinyin];
  }),
);

writeFileSync("data/yin.json", JSON.stringify(data));
