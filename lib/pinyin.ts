interface Pinyin {
  shengmu?:
    | "b"
    | "p"
    | "m"
    | "f"
    | "d"
    | "t"
    | "n"
    | "l"
    | "g"
    | "k"
    | "h"
    | "j"
    | "q"
    | "x"
    | "zh"
    | "ch"
    | "sh"
    | "r"
    | "z"
    | "c"
    | "s";
  yunmu:
    | "er"
    | "-i"
    | "i"
    | "u"
    | "ü"
    | "a"
    | "ia"
    | "ua"
    | "o"
    | "uo"
    | "e"
    | "ê"
    | "ie"
    | "üe"
    | "ai"
    | "uai"
    | "ei"
    | "uei"
    | "ao"
    | "iao"
    | "ou"
    | "iou"
    | "an"
    | "ian"
    | "uan"
    | "üan"
    | "en"
    | "in"
    | "uen"
    | "ün"
    | "ang"
    | "iang"
    | "uang"
    | "eng"
    | "ing"
    | "ueng"
    | "ong"
    | "iong"
    | "m"
    | "n"
    | "ng";
  shengdiao: 1 | 2 | 3 | 4 | 5;
}

const renderWithoutShengdiao = ({
  shengmu,
  yunmu,
}: Omit<Pinyin, "shengdiao">) => {
  const xform = new Map<RegExp, string>([
    [/-/, ""], // zh + -i -> zhi
    [/^i([n$])/, "yi$1"],
    [/^i/, "y"],
    [/^u$/, "wu"],
    [/^u/, "w"],
    [/^ü/, "yu"],
    [/(?![jqx])ü/, "u"],
    [/(?<!^)iou/, "iu"],
    [/(?<!^)ue([in])/, "u$1"],
  ]);
  let syllable = shengmu || "" + yunmu;
  for (const [regex, sub] of xform.entries()) {
    syllable = syllable.replace(regex, sub);
  }
  return syllable;
};

const render = (pinyin: Pinyin) => {
  return renderWithoutShengdiao(pinyin) + pinyin.shengdiao.toString();
};
