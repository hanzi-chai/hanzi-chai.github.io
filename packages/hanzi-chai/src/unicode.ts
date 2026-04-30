import type { 字集指示 } from "./config.js";
import type { 原始汉字数据 } from "./data.js";
import { default_err, ok, type Result } from "./utils.js";

export interface 区块 {
  name: string; // 简洁的英文名，如 "cjk", "cjk-a"
  label: string; // 中文全名，如 "中日韩统一表意文字"
  begin: number; // 起始 Unicode 码位（十进制）
  end: number; // 终止 Unicode 码位（十进制）
  count: number; // 实际收录数量
}

export const 区块列表: 区块[] = [
  // 统一汉字基本集与扩展
  {
    name: "cjk",
    label: "中日韩统一表意文字",
    begin: 0x4e00,
    end: 0x9fff,
    count: 20992,
  },
  {
    name: "cjk-a",
    label: "中日韩统一表意文字扩展A",
    begin: 0x3400,
    end: 0x4dbf,
    count: 6592,
  },
  {
    name: "cjk-b",
    label: "中日韩统一表意文字扩展B",
    begin: 0x20000,
    end: 0x2a6df,
    count: 42720,
  },
  {
    name: "cjk-c",
    label: "中日韩统一表意文字扩展C",
    begin: 0x2a700,
    end: 0x2b73f,
    count: 4160,
  },
  {
    name: "cjk-d",
    label: "中日韩统一表意文字扩展D",
    begin: 0x2b740,
    end: 0x2b81f,
    count: 222,
  },
  {
    name: "cjk-e",
    label: "中日韩统一表意文字扩展E",
    begin: 0x2b820,
    end: 0x2ceaf,
    count: 5774,
  },
  {
    name: "cjk-f",
    label: "中日韩统一表意文字扩展F",
    begin: 0x2ceb0,
    end: 0x2ebef,
    count: 7473,
  },
  {
    name: "cjk-g",
    label: "中日韩统一表意文字扩展G",
    begin: 0x30000,
    end: 0x3134f,
    count: 4939,
  },
  {
    name: "cjk-h",
    label: "中日韩统一表意文字扩展H",
    begin: 0x31350,
    end: 0x323af,
    count: 4192,
  },
  {
    name: "cjk-i",
    label: "中日韩统一表意文字扩展I",
    begin: 0x2ebf0,
    end: 0x2ee5f,
    count: 622,
  },
  {
    name: "cjk-j",
    label: "中日韩统一表意文字扩展J",
    begin: 0x323b0,
    end: 0x3347f,
    count: 4298,
  },

  // 部件
  {
    name: "radicals-sup",
    label: "中日韩部首补充",
    begin: 0x2e80,
    end: 0x2eff,
    count: 115,
  },
  { name: "kangxi", label: "康熙部首", begin: 0x2f00, end: 0x2fdf, count: 214 },
  {
    name: "strokes",
    label: "中日韩笔画",
    begin: 0x31c0,
    end: 0x31ef,
    count: 38,
  },

  // 兼容汉字
  {
    name: "compat",
    label: "中日韩兼容表意文字",
    begin: 0xf900,
    end: 0xfaff,
    count: 472,
  },
  {
    name: "compat-sup",
    label: "中日韩兼容表意文字补充",
    begin: 0x2f800,
    end: 0x2fa1f,
    count: 542,
  },

  // 古文字系统
  {
    name: "tangut",
    label: "西夏文",
    begin: 0x17000,
    end: 0x187ff,
    count: 6144,
  },
  {
    name: "tangut-comp",
    label: "西夏文字构件",
    begin: 0x18800,
    end: 0x18aff,
    count: 768,
  },
  {
    name: "tangut-sup",
    label: "西夏文补充",
    begin: 0x18d00,
    end: 0x18d7f,
    count: 31,
  },
  {
    name: "tangut-comp-sup",
    label: "西夏文字构件补充",
    begin: 0x18d80,
    end: 0x18dff,
    count: 115,
  },
  {
    name: "khitan-small",
    label: "契丹小字",
    begin: 0x18b00,
    end: 0x18cff,
    count: 470,
  },

  // 标点符号与排版字符
  {
    name: "punct",
    label: "中日韩符号和标点",
    begin: 0x3000,
    end: 0x303f,
    count: 64,
  },
  {
    name: "enclosed",
    label: "中日韩带圈字母和月份",
    begin: 0x3200,
    end: 0x32ff,
    count: 255,
  },
  {
    name: "enclosed-sup",
    label: "中日韩带圈文字补充",
    begin: 0x1f200,
    end: 0x1f2ff,
    count: 64,
  },
  {
    name: "ideo-symbols",
    label: "表意文字符号与标点",
    begin: 0x16fe0,
    end: 0x16fff,
    count: 7,
  },

  // 私用区
  { name: "pua", label: "私用区 (BMP)", begin: 0xe000, end: 0xf8ff, count: 0 },
  {
    name: "pua-plane15",
    label: "私用区 (Plane 15)",
    begin: 0xf0000,
    end: 0xffffd,
    count: 0,
  },
];

const 第十六平面起始位 = 0x100000;

export class 字符 {
  private static 自由码位 = 第十六平面起始位;
  private constructor(private readonly 码位: number) {}

  static 从码位创建(cp: number): Result<字符, Error> {
    if (!Number.isInteger(cp) || cp < 0 || cp > 0x10ffff) {
      return default_err(`不合法的 Unicode 码位: ${cp}`);
    }
    if (cp >= 0xd800 && cp <= 0xdfff) {
      return default_err(`不合法的 Unicode 码位: ${cp} (代理项)`);
    }
    const 新字符实例 = new 字符(cp);
    return ok(新字符实例);
  }

  toString(): string {
    return String.fromCodePoint(this.码位);
  }

  toNumber(): number {
    return this.码位;
  }

  十六进制(): string {
    return `U+${this.toNumber().toString(16).toUpperCase().padStart(4, "0")}`;
  }

  static 获取自由字符() {
    const 自由码位 = 字符.自由码位;
    字符.自由码位++;
    return 字符.从码位创建(自由码位);
  }

  static 重置() {
    字符.自由码位 = 第十六平面起始位;
  }

  区块() {
    for (const block of 区块列表) {
      if (this.码位 >= block.begin && this.码位 <= block.end) {
        return block.name;
      }
    }
    return "unknown";
  }

  是基本区汉字() {
    const block = this.区块();
    return block === "cjk";
  }

  是汉字() {
    const block = this.区块();
    return block.startsWith("cjk");
  }

  是汉字或兼容汉字() {
    const block = this.区块();
    return (
      block.startsWith("cjk") || block === "compat" || block === "compat-sup"
    );
  }

  是汉字补充() {
    const block = this.区块();
    return (
      block === "radicals-sup" ||
      block === "kangxi" ||
      block === "strokes" ||
      block === "compat" ||
      block === "compat-sup" ||
      block === "punct"
    );
  }

  是私用区() {
    const block = this.区块();
    return block === "pua" || block === "pua-plane15";
  }

  是用户私用区() {
    const block = this.区块();
    return block === "pua" && this.码位 >= 0xf000;
  }
}

export const 字集过滤查找表: Record<
  字集指示,
  (k: 字符, v: 原始汉字数据) => boolean
> = {
  minimal: (_, v) => v.gb2312 > 0 && v.tygf > 0,
  gb2312: (_, v) => v.gb2312 > 0,
  general: (_, v) => v.tygf > 0,
  basic: (k, v) => v.tygf > 0 || k.是基本区汉字(),
  extended: (k, v) => v.tygf > 0 || k.是汉字(),
  supplement: (k, v) => v.tygf > 0 || k.是汉字() || k.是汉字补充(),
  panlingual: (k, _) => !k.是私用区(),
  maximal: (_, __) => true,
};

export const 字集过滤选项 = [
  { label: "极简", value: "minimal" },
  { label: "GB2312", value: "gb2312" },
  { label: "通用", value: "general" },
  { label: "基本", value: "basic" },
  { label: "扩展", value: "extended" },
  { label: "补充", value: "supplement" },
  { label: "多语言", value: "panlingual" },
  { label: "全部", value: "maximal" },
];
