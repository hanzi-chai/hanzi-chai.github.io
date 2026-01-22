import { atom } from "jotai";
import type { 字形分析结果, 组装, 码位, 原始字库数据 } from "~/lib";
import {
  拼写运算查找表,
  展开决策,
  是归并,
  默认拼音分析器,
  ok,
  图形盒子,
  默认分类器,
} from "~/lib";
import {
  拼写运算自定义原子,
  字母表原子,
  分析配置原子,
  字集指示原子,
  编码配置原子,
  键盘原子,
  决策原子,
  决策空间原子,
  默认目标原子,
  优先简码原子,
  用户原始字库数据原子,
  字形自定义原子,
  读音自定义原子,
  用户标签列表原子,
  变换器列表原子,
} from ".";
import { atomWithStorage } from "jotai/utils";
import type {
  自定义元素映射,
  词典,
  键位分布目标,
  当量映射,
  频率映射,
} from "~/lib";
import { MiniDb } from "jotai-minidb";
import {
  listToObject,
  解析词典,
  解析键位分布目标,
  解析频率映射,
  读取表格,
} from "~/lib";
import { configAtom } from "./config";
import pako from "pako";
import { 从模型构建 } from "~/api";
import { type DictEntry, type EncodeResult, thread } from "~/utils";
import type { Metric } from "~/components/MetricTable";
import { 字集过滤查找表, 是私用区 } from "packages/hanzi-chai/src/unicode";
import 原始字库 from "packages/hanzi-chai/src/primitive";
import { sortBy } from "lodash-es";

const 资源缓存: Record<string, string> = {};

export async function 拉取资源(文件名: string) {
  // 检查缓存
  if (文件名 in 资源缓存) {
    return 资源缓存[文件名]!;
  }
  try {
    const 响应 = await fetch(`/cache/${文件名}`);
    if (!响应.ok) {
      throw new Error(`获取资源失败: ${文件名}, 状态码: ${响应.status}`);
    }
    let 文本: string;
    if (文件名.endsWith(".deflate")) {
      文本 = await 处理压缩文件(文件名, 响应);
    } else {
      文本 = await 响应.text();
    }
    // 缓存结果
    资源缓存[文件名] = 文本;
    return 文本;
  } catch (error) {
    console.error(`处理资源时出错: ${文件名}`, error);
    throw error;
  }
}

async function 处理压缩文件(filename: string, response: Response) {
  const name = filename.replace(/\.deflate$/, "");
  const arrayBuffer = await response.arrayBuffer();
  try {
    const content = pako.inflate(arrayBuffer, { to: "string" });
    return content;
  } catch (error) {
    throw new Error(`解压文件失败: ${name}`);
  }
}

// 服务器资源

export const 原始字库数据初始化原子 = atom(async () => {
  const content = await 拉取资源("repertoire.json.deflate");
  const json = JSON.parse(content) as any[];
  return listToObject(json.map(从模型构建));
});

export const 原始字库数据原子 = atom<原始字库数据>({});

原始字库数据原子.onMount = (setAtom) => {
  let cancelled = false;
  (async () => {
    const content = await 拉取资源("repertoire.json.deflate");
    const json = JSON.parse(content) as any[];
    const data = listToObject(json.map(从模型构建));
    if (!cancelled) {
      setAtom(data);
    }
  })();
  return () => {
    cancelled = true;
  };
};

export const 默认词典原子 = atom(async () => {
  const content = await 拉取资源("dictionary.txt");
  return 解析词典(读取表格(content));
});

export const 默认频率原子 = atom(async () => {
  const content = await 拉取资源("frequency.txt");
  return 解析频率映射(读取表格(content));
});

export const 默认键位分布原子 = atom(async () => {
  const content = await 拉取资源("key_distribution.txt");
  return 解析键位分布目标(读取表格(content));
});

export const 默认双键当量原子 = atom(async () => {
  const content = await 拉取资源("pair_equivalence.txt");
  return 解析频率映射(读取表格(content));
});

// 用户数据存储
const db = new MiniDb<词典>();

export const 用户字集指示原子 = atomWithStorage<string[] | undefined>(
  "user_character_set",
  undefined,
);

export const 用户频率原子 = atomWithStorage<频率映射 | undefined>(
  "user_frequency",
  undefined,
);

export const 用户词典原子 = db.item("user_dictionary");

export const 用户键位分布原子 = atomWithStorage<键位分布目标 | undefined>(
  "user_key_distribution",
  undefined,
);

export const 用户双键当量原子 = atomWithStorage<当量映射 | undefined>(
  "user_pair_equivalence",
  undefined,
);

export const 自定义元素原子 = atomWithStorage<Record<string, 自定义元素映射>>(
  "custom_elements",
  {},
);

export const 频率原子 = atom(async (get) => {
  return get(用户频率原子) ?? (await get(默认频率原子));
});

export const 词典原子 = atom(async (get) => {
  return get(用户词典原子) ?? (await get(默认词典原子));
});

export const processedCustomElementsAtom = atom((get) => {
  const customElements = get(自定义元素原子);
  const content = new Map<string, string[]>(
    Object.entries(customElements).map(([name, map]) => {
      const set = new Set(Object.values(map).flat());
      return [name, [...set].sort().map((x) => `${name}-${x}`)];
    }),
  );
  return content;
});

export const 前端输入原子 = atom(async (get) => {
  const 配置 = get(configAtom);
  const 词列表 = await get(如组装结果原子);
  return {
    配置,
    词列表,
    原始键位分布信息: get(用户键位分布原子) ?? (await get(默认键位分布原子)),
    原始当量信息: get(用户双键当量原子) ?? (await get(默认双键当量原子)),
  };
});

export const 平铺决策原子 = atom((get) => {
  const mapping = get(决策原子);
  return 展开决策(mapping);
});

export interface 首码分组 {
  name: string;
  code: string | 码位[];
}

export const 按首码分组决策原子 = atom((get) => {
  const mapping = get(决策原子);
  const expandedMapping = get(平铺决策原子);
  if (!expandedMapping.ok) throw new Error("Failed to expand mapping");
  const alphabet = get(字母表原子);
  const reversedMapping = new Map<string, 首码分组[]>(
    Array.from(alphabet).map((key) => [key, []]),
  );

  for (const [name, code] of Object.entries(mapping)) {
    if (!是归并(code)) {
      const first = expandedMapping.value.get(name)![0]!;
      reversedMapping.get(first)?.push({ name, code });
    }
  }
  return reversedMapping;
});

const mergedAlgebraAtom = atom((get) => {
  const algebra = get(拼写运算自定义原子);
  return { ...algebra, ...拼写运算查找表 };
});

export const 拼音元素枚举原子 = atom(async (get) => {
  const 如字库 = await get(如字库原子);
  if (!如字库.ok) return 如字库;
  const 字库 = 如字库.value;
  const syllables = [
    ...new Set(
      Object.values(字库.get()).flatMap((x) => x.readings.map((y) => y.pinyin)),
    ),
  ];
  const 合并拼写运算原子 = Object.entries(get(mergedAlgebraAtom));
  const content: Map<string, string[]> = new Map(
    合并拼写运算原子.map(([name, rules]) => {
      const list = [
        ...new Set(
          syllables.map((s) => 默认拼音分析器.应用规则列表(name, rules, s)),
        ),
      ].sort();
      return [name, list];
    }),
  );
  return content;
});

export const 如字形分析配置原子 = atom(async (get) => {
  const 如字库 = await get(如字库原子);
  if (!如字库.ok) return 如字库;
  const 字库 = 如字库.value;
  const analysis = get(分析配置原子);
  const mapping = get(决策原子);
  const mappingSpace = get(决策空间原子);
  const result = 字库.准备字形分析配置(analysis, mapping, mappingSpace);
  return result;
});

export const 如字形分析结果原子 = atom(async (get) => {
  const repertoire = await get(如字库原子);
  if (!repertoire.ok) return repertoire;
  const analysisConfig = await get(如字形分析配置原子);
  const characters = get(charactersAtom);
  return await thread.spawn<字形分析结果>("analysis", [
    repertoire,
    analysisConfig,
    characters,
  ]);
});

export const 如组装结果原子 = atom(async (get) => {
  const repertoire = get(如字库原子);
  const algebra = get(mergedAlgebraAtom);
  const encoder = get(编码配置原子);
  const keyboard = get(键盘原子);
  const characters = get(charactersAtom);
  const dictionary = await get(词典原子);
  const analysisResult = await get(如字形分析结果原子);
  const customElements = get(自定义元素原子);
  const priority = get(优先简码原子);
  const adaptedFrequency = await get(频率原子);
  const config = { algebra, encoder, keyboard, priority };
  return await thread.spawn<组装[]>("assembly", [
    repertoire,
    config,
    characters,
    dictionary,
    adaptedFrequency,
    analysisResult,
    customElements,
  ]);
});

export const getPriorityMap = (
  priorityShortCodes: [string, string, number][],
) => {
  return new Map<string, number>(
    priorityShortCodes.map(([word, pinyin_list, level]) => {
      const hash = `${word}-${pinyin_list}`;
      return [hash, level] as [string, number];
    }),
  );
};

export const assemblyWithPriorityAtom = atom(async (get) => {
  const assemblyResult = await get(如组装结果原子);
  const priorityShortCodes = get(优先简码原子);
  const priorityMap = getPriorityMap(priorityShortCodes);
  return assemblyResult.map((x) => {
    const hash = `${x.词}-${x.拼音列表.join(",")}`;
    const level = priorityMap.get(hash);
    return level !== undefined ? { ...x, 简码级别: level } : x;
  });
});

export const encodeResultAtom = atom(async (get) => {
  const objective = get(默认目标原子);
  const input = await get(前端输入原子);
  return await thread.spawn<[EncodeResult, Metric]>("encode", [
    input,
    objective,
  ]);
});

export interface Combined extends 组装, DictEntry {}

export const combinedResultAtom = atom(async (get) => {
  const assemblyResult = await get(如组装结果原子);
  const [encodeResult] = await get(encodeResultAtom);
  const combined: Combined[] = assemblyResult.map((x, i) => ({
    ...x,
    ...encodeResult[i]!,
  }));
  return combined;
});

export const charactersAtom = atom((get) => {
  const repertoire = get(如字库原子);
  const characterSet = get(字集指示原子);
  const userCharacterSet = get(用户字集指示原子);
  const userCharacterSetSet = new Set(userCharacterSet ?? []);

  const filter = 字集过滤查找表[characterSet];
  const characters = Object.entries(repertoire)
    .filter(([k, v]) => filter(k, v, userCharacterSetSet))
    .map(([k]) => k);
  return characters;
});

export const 原始字库原子 = atom(async (get) => {
  const repertoire = await get(原始字库数据原子);
  const userRepertoire = get(用户原始字库数据原子);
  return new 原始字库(repertoire, userRepertoire);
});

export const displayAtom = atom(async (get) => {
  const repertoire = await get(原始字库原子);
  return (char: string) => {
    if (!是私用区(char)) return char;
    const name = repertoire._get()[char]?.name;
    return name ?? "丢失的字根";
  };
});

export const determinedRepertoireAtom = atom(async (get) => {
  const repertoire = await get(原始字库原子);
  const customGlyph = get(字形自定义原子);
  const customReadings = get(读音自定义原子);
  const tags = get(用户标签列表原子);
  return repertoire.确定(customGlyph, customReadings, tags);
});

export const 如字库原子 = atom(async (get) => {
  const determined = await get(determinedRepertoireAtom);
  if (!determined.ok) return determined;
  const transformers = get(变换器列表原子);
  let result = determined.value;
  for (const transformer of transformers) {
    result = result.应用变换器(transformer);
  }
  return ok(result);
});

export const 如私用区图形原子 = atom(async (get) => {
  const repertoire = await get(如字库原子);
  if (!repertoire.ok) return repertoire;
  const 字库 = repertoire.value;
  const result = new Map<string, 图形盒子>();
  for (const [char, { glyph }] of Object.entries(字库.get())) {
    if (!是私用区(char)) continue;
    if (glyph === undefined) continue;
    if (result.has(char)) continue;
    if (glyph.type === "basic_component") {
      result.set(char, 图形盒子.从笔画列表构建(glyph.strokes));
    } else {
      const svgglyph = 字库.递归渲染复合体(glyph, result);
      if (!svgglyph.ok) return svgglyph;
      result.set(char, svgglyph.value);
    }
  }
  return ok(result);
});

export const 如笔顺映射原子 = atom(async (get) => {
  const repertoire = await get(如字库原子);
  if (!repertoire.ok) return repertoire;
  const 字库 = repertoire.value;
  const result = new Map<string, string>();
  for (const [char, { glyph }] of Object.entries(repertoire.value.get())) {
    if (glyph === undefined) continue;
    if (result.has(char)) continue;
    if (glyph.type === "basic_component") {
      result.set(
        char,
        glyph.strokes.map((x) => 默认分类器[x.feature]).join(""),
      );
    } else {
      const svgglyph = 字库.递归渲染笔画序列(glyph, result);
      if (!svgglyph.ok) return svgglyph;
      result.set(char, svgglyph.value);
    }
  }
  return ok(result);
});

export const 如排序汉字原子 = atom(async (get) => {
  const repertoire = await get(如字库原子);
  if (!repertoire.ok) return repertoire;
  const sequence = await get(如笔顺映射原子);
  if (!sequence.ok) return sequence;
  const result = sortBy(
    Object.keys(repertoire.value.get()),
    (char) => sequence.value.get(char)?.length ?? 0,
  );
  return ok(result);
});

export const 全部标签原子 = atom(async (get) => {
  const allRepertoire = await get(原始字库原子);
  const allTags = new Map<string, number>();
  for (const { glyphs } of Object.values(allRepertoire._get())) {
    for (const { tags } of glyphs) {
      tags?.map((s) => allTags.set(s, (allTags.get(s) ?? 0) + 1));
    }
  }
  return [...allTags].sort((a, b) => b[1] - a[1]).map((x) => x[0]);
});

export const 下一个可用的码位原子 = atom((get) => {
  const customization = get(用户原始字库数据原子);
  const codes = new Set(
    Object.keys(customization).map((x) => x.codePointAt(0)!),
  );
  for (let i = 0xf000; i <= 0xf8ff; ++i) {
    if (!codes.has(i)) return i;
  }
  return 0xffff;
});
