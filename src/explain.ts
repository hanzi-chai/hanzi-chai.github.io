import type { 默认部件分析 } from "./component.js";
import { 取码器 } from "./element.js";
import { 分析方案, type 方案上下文 } from "./scheme.js";
import { 下转换 } from "./utils.js";

export function 解释取码(
  上下文: 方案上下文,
  分析: ReturnType<typeof 分析方案>,
  text: string,
  limit = 20,
) {
  const config = 上下文.组装配置;
  if (config.组装器 !== "默认")
    return { supported: false, assembler: config.组装器, items: [] };
  const encoder = new 取码器(
    config.决策,
    config.决策空间,
    config.线性化决策,
    config.源映射,
    config.条件映射,
    config.最大码长,
    config.分类器,
  );
  const items: object[] = [];
  for (const char of new Set([...text])) {
    for (const pinyin of 上下文.拼音分析结果.filter(
      (x) => x.词.length === 1 && x.词[0]!.获取名称() === char,
    )) {
      const 汉字 = pinyin.词[0]!;
      for (const entry of 分析.value.分析结果.get(汉字) ?? []) {
        const entries = "字根序列" in entry ? [entry] : [...entry];
        for (const glyph of entries) {
          const steps: object[] = [];
          const positions = encoder.取码(
            {
              ...glyph,
              sources: entry.sources,
              汉字,
              拼写运算: pinyin.元素映射[0]!,
              自定义元素: config.自定义分析映射.get(汉字) ?? new Map(),
            },
            (step) =>
              steps.push({ ...step, positions: step.positions.map(下转换) }),
          );
          items.push({
            character: char,
            pinyin: pinyin.拼音,
            steps,
            positions: positions.map(下转换),
          });
          if (items.length >= limit)
            return { supported: true, truncated: true, items };
        }
      }
    }
  }
  return { supported: true, truncated: false, items };
}

export function 查询字符(上下文: 方案上下文, text: string) {
  return [...new Set([...text])].map((character) => {
    const data = 上下文.字库.校验字符(character);
    return {
      character,
      found: data !== undefined,
      glyphs:
        data?.final_glyphs.map((entry) => {
          const glyph = 上下文.字库.获取字形(entry.id);
          return { ...entry, type: glyph?.type, strokes: glyph?.标准笔顺 };
        }) ?? [],
    };
  });
}

/** 只分析请求字符及其依赖，不要求它们出现在评估词典中。 */
export function 解释拆分(
  上下文: 方案上下文,
  text: string,
  limit = 20,
  offset = 0,
) {
  const chars = [...new Set([...text])]
    .map((char) => 上下文.字库.校验字符(char)?.character)
    .filter((char) => char !== undefined);
  const 分析 = 分析方案(上下文, new Set(chars));
  const describe = (entry: { 字根序列: { 获取名称(): string }[] } & object) => {
    const result: Record<string, unknown> = {
      roots: entry.字根序列.map((root) => root.获取名称()),
    };
    if ("部件" in entry) {
      const component = entry as 默认部件分析;
      result.glyph = component.部件.id;
      if (component.全部拆分方式) {
        const candidate = (x: 默认部件分析["当前拆分方式"]) => ({
          roots: x.拆分方式.map((y) => ({
            element: y.字根.获取名称(),
            strokes: y.笔画索引,
          })),
          scores: Object.fromEntries(x.评价),
          available: x.可用,
        });
        result.selected = candidate(component.当前拆分方式);
        result.overridden = component.被覆盖拆分方式
          ? candidate(component.被覆盖拆分方式)
          : undefined;
        result.candidates = component.全部拆分方式
          .slice(offset, offset + limit)
          .map(candidate);
        result.candidateCount = component.全部拆分方式.length;
      }
    } else if ("复合体" in entry)
      result.glyph = (entry.复合体 as { id: number }).id;
    return result;
  };
  return {
    dynamic: 分析.dynamic,
    characters: 查询字符(上下文, text).map((char) => ({
      ...char,
      analyses:
        [...分析.value.分析结果]
          .find(([c]) => c.获取名称() === char.character)?.[1]
          .map((entry) =>
            "字根序列" in entry
              ? [describe(entry)]
              : [...entry].map((x) => ({
                  ...describe(x),
                  conditions: x.条件列表,
                })),
          ) ?? [],
    })),
    // 复合体依赖的部件也返回候选评价，便于定位子部件的拆分原因。
    components: [...分析.value.部件分析结果]
      .slice(offset, offset + limit)
      .map(([, entry]) =>
        "字根序列" in entry
          ? [describe(entry)]
          : [...entry]
              .slice(0, limit)
              .map((x) => ({ ...describe(x), conditions: x.条件列表 })),
      ),
    componentCount: 分析.value.部件分析结果.size,
  };
}
