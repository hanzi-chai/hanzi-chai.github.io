import {
  ok,
  下转换,
  type 元素,
  type 元素位或编码,
  决策图,
  分析拼音,
  动态组装,
  原始字库,
  type 原始字库数据,
  type 原始词典,
  合并拼写运算,
  图形盒子,
  type 字符,
  序列化强类型决策,
  序列化强类型决策空间,
  type 强类型元素位或编码,
  type 强类型决策,
  type 强类型决策空间,
  type 当量映射,
  是强类型归并,
  是部件,
  type 条件,
  构建强类型决策与决策空间,
  构建强类型自定义分析,
  标准化自定义,
  添加优先简码,
  生成,
  type 码表条目,
  组装,
  type 组装条目,
  type 组装配置,
  type 自定义分析,
  计算全部合法元素与元素映射,
  计算拼音分析与元素映射,
  识别符,
  type 键位分布目标,
  默认分类器,
} from "hanzi-chai";
import { atom } from "jotai";
import { MiniDb } from "jotai-minidb";
import { sortBy } from "lodash-es";
import type { Metric } from "~/components/MetricTable";
import { get预加载数据 } from "~/preload";
import { thread, type 编码条目, type 编码结果 } from "~/utils";
import {
  优先简码原子,
  决策原子,
  决策空间原子,
  分析配置原子,
  分类器原子,
  动态分析原子,
  动态自定义拆分原子,
  变换器列表原子,
  字形来源列表原子,
  字形自定义原子,
  字母表原子,
  字集指示原子,
  拼写运算自定义原子,
  最大码长原子,
  条件映射原子,
  构词配置原子,
  源映射原子,
  用户原始字库数据原子,
  组装器原子,
  自定义拆分原子,
  键盘原子,
  默认目标原子,
} from ".";
import { 位置原子, 配置原子 } from "./config";

// 服务器资源

export const 远程原子 = atom((get) => {
  const location = get(位置原子);
  return location.pathname === "/admin" || location.hash === "#/admin";
});

export const 原始字库数据原子 = atom(
  (): 原始字库数据 => get预加载数据().原始字库数据,
);

export const 原始可编辑字库数据原子 = atom({} as 原始字库数据);

export const 默认原始词典原子 = atom((): 原始词典 => get预加载数据().原始词典);

export const 默认键位分布目标原子 = atom(
  (): 键位分布目标 => get预加载数据().键位分布目标,
);

export const 默认当量原子 = atom((): 当量映射 => get预加载数据().当量映射);

// 用户数据存储
const 用户原始词典数据库 = new MiniDb<原始词典>({ name: "原始词典" });

export const 用户原始词典原子 = 用户原始词典数据库.item("user_dictionary");

const 用户键位分布目标数据库 = new MiniDb<键位分布目标>({
  name: "键位分布目标",
});

export const 用户键位分布目标原子 =
  用户键位分布目标数据库.item("user_distribution");

const 用户当量映射数据库 = new MiniDb<当量映射>({ name: "当量映射" });

export const 用户当量映射原子 = 用户当量映射数据库.item("user_equivalence");

export const 自定义分析数据库 = new MiniDb<自定义分析>({ name: "自定义分析" });

export const 码表数据库 = new MiniDb<码表条目[]>({ name: "码表" });

export const 原始词典原子 = atom((get) => {
  return get(用户原始词典原子) ?? get(默认原始词典原子);
});

export const 词典原子 = atom((get) => {
  const 原始词典 = get(原始词典原子);
  const 字库 = get(原始字库原子);
  return 字库.校验词典(原始词典);
});

export const 过滤词典原子 = atom((get) => {
  const 词典 = get(词典原子);
  const 字库 = get(原始字库原子);
  const 字集指示 = get(字集指示原子);
  return 字库.过滤词典(词典, 字集指示);
});

export const 自定义元素映射原子 = atom((get) => {
  const 自定义元素集合 = get(自定义分析数据库.entries);
  const 字库 = get(原始字库原子);
  return 字库.校验自定义映射(Object.fromEntries(自定义元素集合));
});

export const 汉字集合原子 = atom((get) => {
  const 词典 = get(过滤词典原子);
  const 字库 = get(原始字库原子);
  return 字库.获取汉字集合(词典);
});

export const 原始字库原子 = atom((get) => {
  const 远程 = get(远程原子);
  if (远程) {
    const 原始字库数据 = get(原始可编辑字库数据原子);
    return new 原始字库(Object.values(原始字库数据));
  }
  const 原始字库数据 = get(原始字库数据原子);
  const 用户原始字库数据 = get(用户原始字库数据原子);
  return new 原始字库([
    ...Object.values(原始字库数据),
    ...Object.values(用户原始字库数据),
  ]);
});

export const GF0014映射原子 = atom((get) => {
  const tsv = get预加载数据().GF0014;
  const map = new Map<字符, { gf0014_id: number; pinyin: string[] }>();
  const 字库 = get(原始字库原子);
  for (const { character, gf0014_id } of 字库) {
    if (gf0014_id !== null) {
      map.set(character, { gf0014_id, pinyin: tsv[gf0014_id - 1] ?? [] });
    }
  }
  return map;
});

export const 别名显示原子 = atom((get) => {
  const 字库 = get(原始字库原子);
  return (字符实例: 字符) => {
    if (!字符实例.是私用区()) return 字符实例.获取名称();
    const name = 字库.查询(字符实例)?.name;
    return name ?? "丢失的字根";
  };
});

export const 标准字形自定义原子 = atom((get) => {
  const 字形自定义 = get(字形自定义原子);
  return 标准化自定义(字形自定义);
});

export const 如字库原子 = atom((get) => {
  const 字库 = get(原始字库原子);
  const 字形自定义 = get(标准字形自定义原子);
  const 变换器列表 = get(变换器列表原子);
  const 字形来源列表 = get(字形来源列表原子);
  return 字库.确定(字形自定义, 变换器列表, 字形来源列表);
});

export const 如私用区图形原子 = atom((get) => {
  const 如字库 = get(如字库原子);
  if (!如字库.ok) return 如字库;
  const 字库 = 如字库.value;
  const result = new Map<字符, 图形盒子>();
  for (const { 字符, 字形列表 } of 字库) {
    if (!字符.是私用区()) continue;
    if (result.has(字符)) continue;
    const glyph = 字形列表[0]!;
    if (是部件(glyph)) {
      result.set(字符, 图形盒子.从笔画列表构建(glyph.矢量图形));
    } else {
      const 盒子 = 字库.递归渲染复合体(glyph);
      if (!盒子.ok) continue;
      result.set(字符, 盒子.value);
    }
  }
  return ok(result);
});

export const 如笔顺映射原子 = atom((get) => {
  const 如字库 = get(如字库原子);
  if (!如字库.ok) return 如字库;
  const result = new Map<字符, string[]>();
  for (const { 字符, 字形列表 } of 如字库.value) {
    result.set(
      字符,
      字形列表.map((g) => g.获取笔画序列(默认分类器).join("")),
    );
  }
  return ok(result);
});

export const 如按笔顺排序字符原子 = atom((get) => {
  const 字库 = get(原始字库原子);
  const 如笔顺映射 = get(如笔顺映射原子);
  if (!如笔顺映射.ok) return 如笔顺映射;
  const 笔顺映射 = 如笔顺映射.value;
  const 全部字符 = [...字库].map((x) => x.character);
  const result = sortBy(全部字符, (c) => 笔顺映射.get(c)?.[0]?.length ?? 0);
  return ok(result);
});

export const 全部标签原子 = atom((get) => {
  const 字库 = get(原始字库原子);
  const 标签数量映射 = new Map<string, number>();
  for (const { glyphs } of 字库) {
    for (const { tags } of glyphs) {
      tags?.map((s) => 标签数量映射.set(s, (标签数量映射.get(s) ?? 0) + 1));
    }
  }
  return [...标签数量映射].sort((a, b) => b[1] - a[1]).map((x) => x[0]);
});

export const 下一个可用的码位原子 = atom((get) => {
  const 用户原始字库数据 = get(用户原始字库数据原子);
  const codes = new Set(
    Object.keys(用户原始字库数据).map((x) => x.codePointAt(0)!),
  );
  for (let i = 0xf000; i <= 0xf8ff; ++i) {
    if (!codes.has(i)) return i;
  }
  return 0xffff;
});

export const 全部合法元素原子 = atom((get) => {
  const 分类器 = get(分类器原子);
  const { 拼音元素映射 } = get(拼音元素映射原子);
  const { 自定义元素映射 } = get(自定义元素映射原子);
  const 如字符列表 = get(如按笔顺排序字符原子);
  if (!如字符列表.ok) return 如字符列表;
  const 字符列表 = 如字符列表.value;
  return ok(
    计算全部合法元素与元素映射(字符列表, 分类器, 拼音元素映射, 自定义元素映射),
  );
});

export const 当前元素原子 = atom<元素 | undefined>(undefined);

export const 原始字库同步原子 = 原始字库原子;

export const 强类型决策与决策空间原子 = atom((get) => {
  const 决策 = get(决策原子);
  const 决策空间 = get(决策空间原子);
  const 全部合法元素 = get(全部合法元素原子);
  if (!全部合法元素.ok) return 全部合法元素;
  return ok(
    构建强类型决策与决策空间(决策, 决策空间, 全部合法元素.value.名称映射),
  );
});

export const 强类型决策原子 = atom(
  (get) => {
    const r = get(强类型决策与决策空间原子);
    return r.ok ? ok(r.value.决策) : r;
  },
  (_, set, action: 强类型决策) => {
    set(决策原子, 序列化强类型决策(action));
  },
);

export const 强类型决策空间原子 = atom(
  (get) => {
    const r = get(强类型决策与决策空间原子);
    return r.ok ? ok(r.value.决策空间) : r;
  },
  (_, set, action: 强类型决策空间) => {
    set(决策空间原子, 序列化强类型决策空间(action));
  },
);

export const 决策图原子 = atom((get) => {
  const 决策 = get(强类型决策与决策空间原子);
  if (!决策.ok) return 决策;
  return ok(new 决策图(决策.value.决策));
});

export const 强类型线性化决策原子 = atom((get) => {
  const 图 = get(决策图原子);
  if (!图.ok) return 图;
  return 图.value.线性化();
});

export const 强类型翻转决策原子 = atom((get) => {
  const 决策图结果 = get(决策图原子);
  if (!决策图结果.ok) return 决策图结果;
  const 字母表 = get(字母表原子);
  return 决策图结果.value.生成翻转决策(字母表);
});

export const 拼写运算查找表原子 = atom((get) => {
  const 拼写运算自定义 = get(拼写运算自定义原子);
  return 合并拼写运算(拼写运算自定义);
});

export const 拼音元素映射原子 = atom((get) => {
  const 词典 = get(词典原子);
  const 拼写运算查找表 = get(拼写运算查找表原子);
  return 计算拼音分析与元素映射(词典, 拼写运算查找表);
});

export const 强类型自定义分析原子 = atom((get) => {
  const 如字库 = get(如字库原子);
  if (!如字库.ok) return 如字库;
  const 字库 = 如字库.value;
  const 原始字库 = get(原始字库原子);
  const 全部合法元素 = get(全部合法元素原子);
  if (!全部合法元素.ok) return 全部合法元素;
  const { 名称映射 } = 全部合法元素.value;
  const 自定义分析 = get(自定义拆分原子);
  const 动态自定义拆分 = get(动态自定义拆分原子);
  const 结果 = 构建强类型自定义分析(
    字库,
    原始字库,
    名称映射,
    自定义分析,
    动态自定义拆分,
  );
  return ok(结果);
});

export const 字形分析配置原子 = atom((get) => {
  const 分析配置 = get(分析配置原子);
  const 强类型决策与决策空间 = get(强类型决策与决策空间原子);
  if (!强类型决策与决策空间.ok) return 强类型决策与决策空间;
  const 字形来源列表 = get(字形来源列表原子);
  const { 决策, 决策空间 } = 强类型决策与决策空间.value;
  const 强类型自定义分析 = get(强类型自定义分析原子);
  if (!强类型自定义分析.ok) return 强类型自定义分析;
  const { 自定义分析映射, 动态自定义分析映射 } = 强类型自定义分析.value;
  const 如线性化决策 = get(强类型线性化决策原子);
  if (!如线性化决策.ok) return 如线性化决策;
  const 线性化决策 = 如线性化决策.value;
  return ok({
    分析配置,
    决策,
    决策空间,
    线性化决策,
    自定义分析映射,
    动态自定义分析映射,
    字形来源列表,
  });
});

export const 如字形分析结果原子 = atom((get) => {
  const 如字库 = get(如字库原子);
  if (!如字库.ok) return 如字库;
  const 字形分析配置 = get(字形分析配置原子);
  if (!字形分析配置.ok) return 字形分析配置;
  const 汉字集合 = get(汉字集合原子);
  return 如字库.value.分析(字形分析配置.value, 汉字集合);
});

export const 如动态字形分析结果原子 = atom((get) => {
  const 如字库 = get(如字库原子);
  if (!如字库.ok) return 如字库;
  const 字形分析配置 = get(字形分析配置原子);
  if (!字形分析配置.ok) return 字形分析配置;
  const 汉字集合 = get(汉字集合原子);
  return 如字库.value.动态分析(字形分析配置.value, 汉字集合);
});

export const 拼音分析结果原子 = atom((get) => {
  const { 拼音分析映射: 音节表 } = get(拼音元素映射原子);
  const 词典 = get(过滤词典原子);
  return 分析拼音(音节表, 词典);
});

export const 组装配置原子 = atom((get) => {
  const { 自定义分析映射 } = get(自定义元素映射原子);
  const 决策与决策空间 = get(强类型决策与决策空间原子);
  if (!决策与决策空间.ok) return 决策与决策空间;
  const 分类器 = get(分类器原子);
  const { 决策, 决策空间 } = 决策与决策空间.value;
  const 如线性化决策 = get(强类型线性化决策原子);
  if (!如线性化决策.ok) return 如线性化决策;
  const 线性化决策 = 如线性化决策.value;
  const config: 组装配置 = {
    源映射: get(源映射原子),
    条件映射: get(条件映射原子),
    线性化决策,
    组装器: get(组装器原子),
    构词规则列表: get(构词配置原子),
    最大码长: get(最大码长原子),
    键盘配置: get(键盘原子),
    自定义分析映射,
    决策,
    决策空间,
    分类器,
  };
  return ok(config);
});

export const 如组装结果原子 = atom((get) => {
  const 拼音分析结果 = get(拼音分析结果原子);
  const 如字形分析结果 = get(如字形分析结果原子);
  if (!如字形分析结果.ok) return 如字形分析结果;
  const 字形分析结果 = 如字形分析结果.value;
  const config = get(组装配置原子);
  if (!config.ok) return config;
  const result = 组装(config.value, 拼音分析结果, 字形分析结果);
  return result;
});

export const 如带归并组装结果原子 = atom((get) => {
  const 如组装结果 = get(如组装结果原子);
  if (!如组装结果.ok) return 如组装结果;
  const 决策与决策空间 = get(强类型决策与决策空间原子);
  if (!决策与决策空间.ok) return 决策与决策空间;
  const 带归并组装结果: 组装条目[] = [];
  for (const 条目 of 如组装结果.value) {
    const 新元素序列: 强类型元素位或编码[] = [];
    for (const 码位 of 条目.元素序列.元素序列) {
      if (typeof 码位 === "string") {
        新元素序列.push(码位);
      } else {
        // 判断当前元素位是自由还是归并的
        let 当前码位 = 码位;
        let i = 0;
        while (true) {
          i += 1;
          if (i > 100) break; // 防止死循环
          const 安排 = 决策与决策空间.value.决策.get(当前码位.element);
          if (!安排) continue;
          if (是强类型归并(安排)) {
            // 如果当前元素是归并的，更新元素为归并元素，位置不变
            当前码位 = { ...当前码位, element: 安排.element };
          } else if (Array.isArray(安排)) {
            const 引用码位 = 安排[当前码位.index];
            if (引用码位 === undefined || typeof 引用码位 === "string") {
              break;
            } else {
              当前码位 = 引用码位;
            }
          }
        }
        新元素序列.push(当前码位);
      }
    }
    带归并组装结果.push({ ...条目, 元素序列: { 元素序列: 新元素序列 } });
  }
  return ok(带归并组装结果);
});

export const 如动态组装结果原子 = atom((get) => {
  const 拼音分析结果 = get(拼音分析结果原子);
  const 如字形分析结果 = get(如动态字形分析结果原子);
  if (!如字形分析结果.ok) return 如字形分析结果;
  const 字形分析结果 = 如字形分析结果.value;
  const config = get(组装配置原子);
  if (!config.ok) return config;
  const result = 动态组装(config.value, 拼音分析结果, 字形分析结果);
  return result;
});

export const 优先简码映射原子 = atom((get) => {
  const 字库 = get(原始字库原子);
  const 优先简码列表 = get(优先简码原子);
  const map = new Map<string, number>();
  for (const { word, sources, level } of 优先简码列表) {
    const chars: 字符[] = [];
    for (const char of word) {
      const charInstance = 字库.校验(char);
      if (!charInstance) {
        console.warn(`优先简码中的字符不在字库中: ${char}`);
        continue;
      }
      chars.push(charInstance.character);
    }
    const hash = 识别符(chars, sources);
    map.set(hash, level);
  }
  return map;
});

export const 如组装结果与优先简码原子 = atom((get) => {
  const 如组装结果 = get(如组装结果原子);
  if (!如组装结果.ok) return 如组装结果;
  const 优先简码映射 = get(优先简码映射原子);
  return ok(添加优先简码(如组装结果.value, 优先简码映射));
});

export const 如动态组装结果与优先简码原子 = atom((get) => {
  const 如动态组装结果 = get(如动态组装结果原子);
  if (!如动态组装结果.ok) return 如动态组装结果;
  const 优先简码映射 = get(优先简码映射原子);
  return ok(添加优先简码(如动态组装结果.value, 优先简码映射));
});

type 序列化组装结果 = {
  词: string;
  全部元素序列: { 元素序列: 元素位或编码[]; 条件列表: 条件[] }[];
  频率: number;
  简码长度?: number;
};

export const 如导出组装结果原子 = atom((get) => {
  const 序列化词列表: 序列化组装结果[] = [];
  const 词列表 = get(如组装结果与优先简码原子);
  if (!词列表.ok) return 词列表;
  词列表.value.forEach((x) => {
    const { 元素序列, ...rest } = x;
    序列化词列表.push({
      ...rest,
      词: x.词.map((v) => v.获取名称()).join(""),
      全部元素序列: [
        { 元素序列: x.元素序列.元素序列.map(下转换), 条件列表: [] },
      ],
    });
  });
  return ok(序列化词列表);
});

export const 如导出动态组装结果原子 = atom((get) => {
  const 序列化词列表: 序列化组装结果[] = [];
  const 词列表 = get(如动态组装结果与优先简码原子);
  if (!词列表.ok) return 词列表;
  词列表.value.forEach((x) => {
    const { 元素序列, ...rest } = x;
    序列化词列表.push({
      ...rest,
      词: x.词.map((v) => v.获取名称()).join(""),
      全部元素序列: [...x.元素序列].map((x) => ({
        元素序列: x.元素序列.map(下转换),
        条件列表: x.条件列表,
      })),
    });
  });
  return ok(序列化词列表);
});

export const 如前端输入原子 = atom((get) => {
  const 配置 = 生成(get(配置原子));
  const 动态分析 = get(动态分析原子);
  const 序列化词列表 = 动态分析
    ? get(如导出动态组装结果原子)
    : get(如导出组装结果原子);
  if (!序列化词列表.ok) return 序列化词列表;

  return ok({
    配置,
    词列表: 序列化词列表.value,
    原始键位分布信息: get(用户键位分布目标原子) ?? get(默认键位分布目标原子),
    原始当量信息: get(用户当量映射原子) ?? get(默认当量原子),
  });
});

export const 如编码结果原子 = atom(async (get) => {
  const 默认目标 = get(默认目标原子);
  const 如前端输入 = get(如前端输入原子);
  if (!如前端输入.ok) return 如前端输入;
  const result = await thread.spawn<[编码结果, Metric]>("encode", [
    如前端输入.value,
    默认目标,
  ]);
  return ok(result);
});

export interface 联合条目 extends 组装条目, Omit<编码条目, "词"> {}

export const 联合结果原子 = atom(async (get) => {
  const 如组装结果 = get(如组装结果原子);
  if (!如组装结果.ok) return 如组装结果;
  const 如编码结果 = await get(如编码结果原子);
  if (!如编码结果.ok) return 如编码结果;
  const [编码结果] = 如编码结果.value;
  const combined: 联合条目[] = 如组装结果.value.map((x, i) => {
    const { 词, ...rest } = 编码结果[i] ?? {
      全码: "",
      简码: "",
      全码排名: 0,
      简码排名: 0,
    };
    return {
      ...x,
      ...rest,
    };
  });
  return ok(combined);
});
