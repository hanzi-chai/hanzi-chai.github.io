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
  ǖ: "v1",
  ǘ: "v2",
  ǚ: "v3",
  ǜ: "v4",
  ü: "v5",
  ñ: "n1",
  ń: "n2",
  ň: "n3",
  ǹ: "n4",
  ḿ: "m2",
  m̀: "m4",
  ê̄: "ei1",
  ế: "ei2",
  ê̌: "ei3",
  ề: "ei4",
};

const RE_PHONETIC_SYMBOL = new RegExp(
  "(" + Object.keys(PHONETIC_SYMBOL).join("|") + ")",
  "g",
);

const parsePinyin2 = function (s: string) {
  let shengdiao: number = 5;
  let shengyun = s.replace(
    RE_PHONETIC_SYMBOL,
    function ($0: string, $1: string) {
      let content = PHONETIC_SYMBOL[$1];
      shengdiao = parseInt(content[content.length - 1]);
      return content.slice(0, content.length - 1);
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
