import { load } from "js-yaml";
import { readFileSync, writeFileSync } from "fs";
import { Pinyin } from "../lib/pinyin";

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
const RE_TONE2 = /([aeoiuvnm])([0-4])$/;

const parsePinyin = function (s: string): Pinyin {
  let shengdiao: Pinyin["shengdiao"] = 5;
  let shengyun = s.replace(
    RE_PHONETIC_SYMBOL,
    function ($0: string, $1: string) {
      shengdiao = parseInt(PHONETIC_SYMBOL[$1][1]) as Pinyin["shengdiao"];
      return PHONETIC_SYMBOL[$1][0];
    },
  );
  const regularize = new Map<RegExp, string>([
    [/(?<=[zcsh])i/, "-i"],
    [/^(?=[aoe])/, "0"],
    [/^(m|n|ng)$/, "0$1"],
    [/w(?=u)/, "0"],
    [/w(?=[aoe])/, "0u"],
    [/y(?=i)/, "0"],
    [/y(?=[aoe])/, "0i"],
    [/yu/, "0ü"],
    [/(?<=[jqx])u/, "ü"],
    [/iu/, "iou"],
    [/ui/, "uei"],
    [/un/, "uen"],
  ]);
  for (const [re, str] of regularize.entries()) {
    shengyun = shengyun.replace(re, str);
  }
  const breakpoint =
    /(?<=[bpmfdtnlgkhjqxzcsr0])(?=[-aeiouünm])|^(?=[-aeiouünm])/;
  let [shengmu, yunmu] = shengyun.split(breakpoint) as [
    Pinyin["shengmu"] | "0",
    Pinyin["yunmu"],
  ];
  if (shengmu === "0") shengmu = undefined;
  return { shengmu, yunmu, shengdiao };
};

const parsePinyin2 = function (s: string) {
  let shengdiao: Pinyin["shengdiao"] = 5;
  let shengyun = s.replace(
    RE_PHONETIC_SYMBOL,
    function ($0: string, $1: string) {
      shengdiao = parseInt(PHONETIC_SYMBOL[$1][1]) as Pinyin["shengdiao"];
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
