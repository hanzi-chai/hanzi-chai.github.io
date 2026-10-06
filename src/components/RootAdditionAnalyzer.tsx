import {
  Alert,
  Button,
  Cascader,
  Dropdown,
  Flex,
  Input,
  InputNumber,
  Popover,
  Progress,
  Radio,
  Select,
  Spin,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from "antd";
import InfoCircleOutlined from "@ant-design/icons/InfoCircleOutlined";
import type { ColumnsType } from "antd/es/table";
import type { 元素 } from "hanzi-chai";
import {
  下转换,
  是强类型归并,
  默认分类器,
  决策图,
  构建强类型决策与决策空间,
  组装,
  type 强类型广义安排,
  type 强类型广义引用,
  type 强类型决策,
  type 强类型元素位或编码,
  type 组装条目,
} from "hanzi-chai";
import { useAtomValue, useSetAtom } from "jotai";
import { range, sumBy } from "lodash-es";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useAtomValueUnwrapped,
  如带归并组装结果原子,
  如字库原子,
  全部合法元素原子,
  配置原子,
  键盘原子,
  原始词典原子,
  汉字集合原子,
  拼音分析结果原子,
  决策原子,
  决策空间原子,
  编码类型原子,
  最大码长原子,
  字母表原子,
  字形分析配置原子,
  组装配置原子,
} from "~/atoms";
import { get预加载数据 } from "~/preload";
import {
  挖掘结果项,
  展开表模式,
  重码根候选,
  重码组信息,
  字根表规则,
  type 搜索结果,
  type 轮结果,
} from "../lib/智能选根核心";
import CharacterSelect from "~/components/CharacterSelect";
import ElementSelect from "~/components/ElementSelect";
import { CharacterDisplay, DeleteButton } from "~/components/Utils";
import Value from "~/components/Value";

export const combinations = (n: number, k: number): number[][] => {
  const result: number[][] = [];
  const dfs = (start: number, current: number[]) => {
    if (current.length === k) {
      result.push([...current]);
      return;
    }
    for (let i = start; i < n; i++) {
      dfs(i + 1, [...current, i]);
    }
  };
  dfs(0, []);
  return result;
};

const 数字标签 = (n: number) => "零一二三四五六七八九十"[n] ?? String(n);

/** 模式名：空位显示 *（每个 * 后带空格），保留位显示位数 */
export const 模式名称 = (空位: number[], 总位数: number) => {
  const tokens = range(总位数).map((i) =>
    空位.includes(i) ? "* " : 数字标签(i + 1),
  );
  return tokens.join("").trimEnd() || "*".repeat(总位数);
};

/** 红加绿减：良性（重码减少）绿显示 −，恶性（重码增加）红显示 ＋。显示统一 2 位小数 */
const 变化显示 = (v: number) => {
  const x = Math.round(v * 100) / 100;
  if (x > 0) return { 文本: `−${x.toFixed(2)}`, 类: "text-green-600" };
  if (x < 0) return { 文本: `＋${Math.abs(x).toFixed(2)}`, 类: "text-red-500" };
  return { 文本: "0.00", 类: "" };
};

/** 与 如带归并组装结果原子 相同的归并展开后处理 */
const 带归并处理 = (组装结果: 组装条目[], 决策: 强类型决策): 组装条目[] => {
  const out: 组装条目[] = [];
  for (const 条目 of 组装结果) {
    const 新元素序列: 强类型元素位或编码[] = [];
    for (const 码位 of 条目.元素序列.元素序列) {
      if (typeof 码位 === "string") {
        新元素序列.push(码位);
        continue;
      }
      let 当前码位 = 码位;
      let i = 0;
      while (true) {
        i += 1;
        if (i > 100) break;
        const 安排 = 决策.get(当前码位.element);
        if (!安排) break;
        if (是强类型归并(安排)) {
          当前码位 = { ...当前码位, element: 安排.element };
        } else if (Array.isArray(安排)) {
          const 引用码位 = 安排[当前码位.index];
          if (引用码位 === undefined || typeof 引用码位 === "string") {
            break;
          } else {
            当前码位 = 引用码位;
          }
        } else {
          break;
        }
      }
      新元素序列.push(当前码位);
    }
    out.push({ ...条目, 元素序列: { 元素序列: 新元素序列 } });
  }
  return out;
};

interface 表配置 {
  id: number;
  /** 空位模式，序列化为 JSON 字符串数组 */
  模式: string[];
  top: number;
  权重: number;
  名称?: string;
}

type 操作类型 = "加" | "减";

interface 根操作 {
  id: number;
  类型: 操作类型;
  名: string;
  /** 加根时的安排：键位串 / 纯归并（{element}）/ 广义码位列表（字母键与归并引用混排） */
  安排?: string | { element: string } | (string | { element: string; index: number })[];
}

let 表序号 = 0;
let 操作序号 = 0;

/** 按模式分组：保留非空位码位的元素序列（布局无关），返回 键→词列表。
 *  键构造与 阶重统计.ts/阶重序列键（统计一、智能选根核心口径）严格一致：
 *  按 maxLength 补齐全部码位（空位优先显示 *，序列越界补 "ε"）——
 *  短序列若不补位，尾部空位模式的通配符不会生成，会与同前缀长序列错误拆组。 */
const 分组按模式 = (
  条目列表: 组装条目[],
  空位: number[],
  top: number,
  maxLength: number,
) => {
  const relevant = [...条目列表]
    .sort((a, b) => b.频率 - a.频率)
    .filter((x) => [...x.词].length === 1);
  const scope = top > 0 ? relevant.slice(0, top) : relevant;
  const map = new Map<string, string[]>();
  for (const 条目 of scope) {
    const 序列 = 条目.元素序列.元素序列;
    const 键 = JSON.stringify(
      range(maxLength).map((i) =>
        空位.includes(i)
          ? "*"
          : 序列[i] === undefined
            ? "ε"
            : 下转换(序列[i] as any),
      ),
    );
    const 词 = 条目.词.map((c) => c.获取名称()).join("");
    map.set(键, [...(map.get(键) ?? []), 词]);
  }
  return map;
};

/** 口径：n²/2÷26^阶（独立随机编码期望，含自身对），与统计一、智能选根、CLI 统一（src/lib/阶重统计.ts） */
const 估计选重 = (
  分组: Map<string, string[]>,
  空位: number[],
  alphabetSize: number,
) => {
  const space = alphabetSize ** 空位.length;
  let total = 0;
  分组.forEach((items) => {
    total +=
      空位.length === 0
        ? Math.max(0, items.length - 1)
        : (items.length * items.length) / 2 / space;
  });
  return total;
};

/** 安排显示文本（用于操作列表 Tag 与「已分析」行） */
const 安排文本 = (安排: 根操作["安排"]) =>
  typeof 安排 === "string"
    ? 安排
    : 安排 && !Array.isArray(安排)
      ? `归并→${(安排 as { element: string }).element ?? ""}`
      : (安排 ?? [])
          .map((c) =>
            typeof c === "string"
              ? c
              : `${typeof c.element === "string" ? c.element : (c.element as any)?.获取名称?.() ?? ""}${c.index ? "'" + c.index : ""}`,
          )
          .join("");

// ==================== 页签一：手动分析 ====================

function 手动分析面板() {
  const maxLength = useAtomValue(最大码长原子);
  const alphabet = useAtomValue(字母表原子);
  // Result 原子一律安全读取（手动解包不抛错，表格壳秒渲染）
  const 如基线 = useAtomValue(如带归并组装结果原子);
  const 基线 = 如基线?.ok ? 如基线.value : null;
  const 如字形分析配置 = useAtomValue(字形分析配置原子);
  const 字形分析配置 = 如字形分析配置?.ok ? 如字形分析配置.value : null;
  const 如组装配置基线 = useAtomValue(组装配置原子);
  const 组装配置基线 = 如组装配置基线?.ok ? 如组装配置基线.value : null;
  const 拼音分析 = useAtomValue(拼音分析结果原子);
  const 汉字集合 = useAtomValue(汉字集合原子);
  const 如字库 = useAtomValue(如字库原子);
  const 字库 = 如字库?.ok ? 如字库.value : null;
  const 如全部合法元素 = useAtomValue(全部合法元素原子);
  const 合法元素 = 如全部合法元素?.ok ? 如全部合法元素.value : null;
  const 名称映射 = 如全部合法元素?.ok ? 如全部合法元素.value.名称映射 : null;
  // 加根类别（与元素页元素选择器同分类）：字形/字音/自定义
  const [加根类别, 设加根类别] = useState<[string, string]>(["字形", "字根"]);
  const 加根类别选项 = [
    {
      value: "字形",
      label: "字形",
      children: ["字根", "二笔", "笔画", "结构"].map((v) => ({ value: v, label: v })),
    },
    {
      value: "字音",
      label: "字音",
      children: [...(合法元素?.拼音元素映射?.keys() ?? [])].map((v) => ({ value: v, label: v })),
    },
    {
      value: "自定义",
      label: "自定义",
      children: [...(合法元素?.自定义元素映射?.keys() ?? [])].map((v) => ({ value: v, label: v })),
      disabled: (合法元素?.自定义元素映射?.size ?? 0) === 0,
    },
  ];
  const 决策 = useAtomValue(决策原子);
  const 决策空间 = useAtomValue(决策空间原子);

  const [操作, 设操作] = useState<操作类型>("加");
  const 加根候选: 元素[] | undefined = (() => {
    if (!合法元素 || 操作 !== "加") return undefined;
    const [一级, 二级] = 加根类别;
    if (一级 === "字形") {
      if (二级 === "字根") return undefined; // 字根类别走 CharacterSelect 原路径
      if (二级 === "二笔") return 合法元素.二笔列表;
      if (二级 === "笔画") return 合法元素.笔画列表;
      if (二级 === "结构") return 合法元素.结构符元素列表;
      return [];
    }
    if (一级 === "字音") return 合法元素.拼音元素映射.get(二级) ?? [];
    return 合法元素.自定义元素映射.get(二级) ?? [];
  })();
  const 编码类型 = useAtomValue(编码类型原子);
  const [当前根, 设当前根] = useState("");
  // 单字符串码串（默认预填键盘前几位字母）；经 Value 编辑器可为广义码位列表或纯归并
  const [码串, 设码串] = useState<强类型广义安排>(
    () => (alphabet[0] ?? "").repeat(编码类型),
  );
  const [操作列表, 设操作列表] = useState<根操作[]>([]);
  // 空操作两段式确认：第一次点「分析」提示，再点一次清空结果回到初态
  const [空操作确认, 设空操作确认] = useState(false);
  useEffect(() => {
    if (操作列表.length > 0) 设空操作确认(false);
  }, [操作列表.length]);
  const [运行中, 设运行中] = useState(false);
  const [错误, 设错误] = useState("");
  const [已完成, 设已完成] = useState("");
  const [候选, 设候选] = useState<组装条目[] | null>(null);
  // 自建表持久化（localStorage，跨刷新保留；与自动搜索配置同模式）
  const 自建表键 = "智能选根-手动分析自建表";
  const 初始自建表 = (() => {
    try {
      const 存 = JSON.parse(localStorage.getItem(自建表键) ?? "null") as 表配置[] | null;
      if (存?.length) {
        表序号 = Math.max(表序号, ...存.map((t) => t.id + 1)); // 新建表 id 不与恢复数据冲突
        return 存;
      }
    } catch {
      // 存档损坏按无存档处理
    }
    return null;
  })();
  const [自建表, 设自建表] = useState<表配置[]>(
    初始自建表 ?? [{ id: 表序号++, 模式: [], top: 0, 权重: 1, 名称: `表${表序号}` }],
  );
  useEffect(() => {
    try {
      localStorage.setItem(自建表键, JSON.stringify(自建表));
    } catch {
      // 存储失败不影响本页使用
    }
  }, [自建表]);
  // 共享评分表开关：开 = 读写「评分表」页签的 statistics.tables（此处编辑直接写回）
  const [共享表, 设共享表] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("智能选根-手动分析共享表") ?? "null") ?? true;
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("智能选根-手动分析共享表", JSON.stringify(共享表));
    } catch {
      // 存储失败不影响本页使用
    }
  }, [共享表]);
  const 配置 = useAtomValue(配置原子);
  const 设配置 = useSetAtom(配置原子);
  const 共享表数据 = ((配置 as any).statistics?.tables ?? []) as 评分表格式[];
  const 表视图 = useMemo<表配置[]>(
    () =>
      共享表
        ? 共享表数据.map((t, i) => ({
            id: 10000 + i,
            模式: (t.patterns ?? []).map((p) => JSON.stringify(p)),
            top: t.top ?? 0,
            权重: t.weight,
            名称: t.name,
          }))
        : 自建表,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [共享表, 配置, 自建表],
  );
  const 更新共享表 = (索引: number, patch: Partial<评分表格式>) => {
    设配置({
      ...配置,
      statistics: {
        tables: 共享表数据.map((t, i) => (i === 索引 ? { ...t, ...patch } : t)),
      },
    } as any);
  };
  const 删除共享表 = (索引: number) => {
    设配置({
      ...配置,
      statistics: { tables: 共享表数据.filter((_, i) => i !== 索引) },
    } as any);
  };

  const 已映射元素集 = useMemo(() => new Set(Object.keys(决策)), [决策]);
  useEffect(() => {
    设码串((alphabet[0] ?? "").repeat(编码类型));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [编码类型]);
  const 全部模式 = useMemo(
    () => range(maxLength + 1).flatMap((阶) => combinations(maxLength, 阶)),
    [maxLength],
  );

  const 添加操作 = () => {
    设错误("");
    if (!名称映射) {
      设错误("基础数据仍在加载中，请稍候再试");
      return;
    }
    if (!当前根) {
      设错误("请先选择字根");
      return;
    }
    if (!名称映射.has(当前根)) {
      设错误(`「${当前根}」不是字库中的合法元素`);
      return;
    }
    if (操作列表.some((x) => x.名 === 当前根 && x.类型 === 操作)) {
      设错误(
        操作 === "加"
          ? `「${当前根}」已有一条加根操作，删掉后重新添加即可修改安排`
          : `「${当前根}」已有一条减根操作`,
      );
      return;
    }
    if (操作 === "减") {
      if (!已映射元素集.has(当前根)) {
        设错误(`「${当前根}」不在当前方案的字根映射中，无法减去`);
        return;
      }
      设操作列表([...操作列表, { id: 操作序号++, 类型: "减", 名: 当前根 }]);
      设当前根("");
      return;
    }
    let 安排: 根操作["安排"];
    if (码串 === null) {
      设错误("安排不能为「禁用」");
      return;
    } else if (typeof 码串 === "string") {
      if (码串.length !== 编码类型 || [...码串].some((c) => !alphabet.includes(c))) {
        设错误(`键位串「${码串}」应为 ${编码类型} 个字母表 ${alphabet} 中的键`);
        return;
      }
      安排 = 码串;
    } else if (Array.isArray(码串)) {
      安排 = (码串 as (string | { element: any; index?: number })[]).map((c) =>
        typeof c === "string"
          ? c
          : {
              element:
                typeof c.element === "string"
                  ? c.element
                  : (c.element as any)?.获取名称?.() ?? "",
              index: c.index ?? 0,
            },
      );
    } else {
      const 目标 = (码串 as any)?.element?.获取名称?.();
      if (!目标) {
        设错误("归并目标无效");
        return;
      }
      const 目标已加 = 操作列表.some((x) => x.类型 === "加" && x.名 === 目标);
      if (!已映射元素集.has(目标) && !目标已加) {
        设错误(
          `归并目标「${目标}」尚未在方案映射中：请先添加一条「加 ${目标}」（定好键位安排）的操作，再添加本条归并`,
        );
        return;
      }
      if (操作列表.some((x) => x.类型 === "减" && x.名 === 目标)) {
        设错误(`归并目标「${目标}」正在被减去，不能作为归并目标`);
        return;
      }
      安排 = { element: 目标 };
    }
    设操作列表([...操作列表, { id: 操作序号++, 类型: "加", 名: 当前根, 安排 }]);
    设当前根("");
    设码串((alphabet[0] ?? "").repeat(编码类型));
  };

  const 分析 = async () => {
    设错误("");
    if (!名称映射 || !字库 || !字形分析配置 || !组装配置基线) {
      设错误("基础数据仍在加载中，请稍候再点分析");
      return;
    }
    if (操作列表.length === 0) {
      // 空操作两段式：第一次点击提示，第二次点击清空对比结果，回到初态（只显示原始数据）
      if (!空操作确认) {
        设空操作确认(true);
        设错误("当前没有加/减根操作：再点一次「分析」将清空对比结果，回到初态（只显示原始数据）");
        return;
      }
      设空操作确认(false);
      设候选(null);
      设已完成("");
      return;
    }
    设空操作确认(false);
    for (const op of 操作列表) {
      if (!名称映射.has(op.名)) {
        设错误(`「${op.名}」不是字库中的合法元素`);
        return;
      }
      if (op.类型 === "减" && !已映射元素集.has(op.名)) {
        设错误(`「${op.名}」不在当前方案的字根映射中，无法减去`);
        return;
      }
    }
    设运行中(true);
    try {
      // 1. 候选决策：先应用减根，再应用加根（同根先减后加即“改根”）
      const 候选决策Record: Record<string, any> = { ...决策 };
      for (const op of 操作列表) {
        if (op.类型 === "减") delete 候选决策Record[op.名];
      }
      for (const op of 操作列表) {
        if (op.类型 === "加") 候选决策Record[op.名] = op.安排;
      }
      const 强 = 构建强类型决策与决策空间(候选决策Record, 决策空间, 名称映射);
      const 如线性化 = new 决策图(强.决策).线性化();
      if (!如线性化.ok) throw 如线性化.error;
      // 2. 候选拆分
      const 字形分析 = 字库.分析(
        {
          ...字形分析配置,
          决策: 强.决策,
          决策空间: 强.决策空间,
          线性化决策: 如线性化.value,
        },
        汉字集合,
      );
      if (!字形分析.ok) throw 字形分析.error;
      // 3. 候选组装
      const 组装结果 = 组装(
        {
          ...组装配置基线,
          决策: 强.决策,
          决策空间: 强.决策空间,
          线性化决策: 如线性化.value,
        },
        拼音分析,
        字形分析.value,
      );
      if (!组装结果.ok) throw 组装结果.error;
      设候选(带归并处理(组装结果.value, 强.决策));
      设已完成(
        操作列表
          .map((x) =>
            x.类型 === "减" ? `−${x.名}` : `＋${x.名}→${安排文本(x.安排)}`,
          )
          .join("、"),
      );
    } catch (e: any) {
      设错误(String(e?.message ?? e));
      设候选(null);
    } finally {
      设运行中(false);
    }
  };

  /** 单个阶重模式的变化量与变化组（top 为统计范围前 N 字，0 为全部） */
  const 阶重变化 = (空位: number[], top: number) => {
    const 基线分组 = 分组按模式(基线 ?? [], 空位, top, maxLength);
    const 候选分组 = 分组按模式(候选!, 空位, top, maxLength);
    const 基线值 = 估计选重(基线分组, 空位, alphabet.length);
    const 候选值 = 估计选重(候选分组, 空位, alphabet.length);
    // 成员构成发生变化（人数或成员互换）的组
    const 变化组: {
      基线词: string[];
      候选词: string[];
      基线: number;
      候选: number;
    }[] = [];
    const 全部键 = new Set([...基线分组.keys(), ...候选分组.keys()]);
    全部键.forEach((键) => {
      const 基线词 = 基线分组.get(键);
      const 候选词 = 候选分组.get(键);
      const 基线数 = 基线词?.length ?? 0;
      const 候选数 = 候选词?.length ?? 0;
      if (基线数 < 2 && 候选数 < 2) return; // 两边都是单字组，无重码含义
      if (基线词 && 候选词) {
        const 候选集 = new Set(候选词);
        const 构成不变 =
          基线数 === 候选数 && 基线词.every((x) => 候选集.has(x));
        if (构成不变) return;
      }
      变化组.push({
        基线词: 基线词 ?? [],
        候选词: 候选词 ?? [],
        基线: 基线数,
        候选: 候选数,
      });
    });
    return {
      基线: 基线值,
      候选: 候选值,
      变化: 基线值 - 候选值,
      变化组,
    };
  };

  const 表模式 = (表: 表配置) =>
    表.模式.length > 0 ? 表.模式.map((v) => JSON.parse(v) as number[]) : 全部模式;

  const 表分析 = useMemo(() => {
    const 行数据 = new Map<
      number,
      {
        key: string;
        模式: string;
        阶: string;
        原始: number;
        加减根后: number | "—";
        变化: number | "—";
        变化组: {
          基线词: string[];
          候选词: string[];
          基线: number;
          候选: number;
        }[];
      }[]
    >();
    const 原始和 = new Map<number, number>();
    const 候选和 = new Map<number, number>();
    const 变化和 = new Map<number, number>();
    for (const 表 of 表视图) {
      let 原始合计 = 0;
      let 候选合计 = 0;
      let 变化合计 = 0;
      const 行 = 表模式(表).map((空位) => {
        const 基线值 = 估计选重(
          分组按模式(基线 ?? [], 空位, 表.top, maxLength),
          空位,
          alphabet.length,
        );
        const 变化结果 = 候选 ? 阶重变化(空位, 表.top) : null;
        原始合计 += 基线值;
        if (变化结果) {
          候选合计 += 变化结果.候选;
          变化合计 += 变化结果.变化;
        }
        return {
          key: JSON.stringify(空位),
          模式: 模式名称(空位, maxLength),
          阶: 数字标签(空位.length),
          原始: 基线值,
          加减根后: 变化结果 ? 变化结果.候选 : ("—" as const),
          变化: 变化结果 ? 变化结果.变化 : ("—" as const),
          变化组: 变化结果?.变化组 ?? [],
        };
      });
      行数据.set(表.id, 行);
      原始和.set(表.id, 原始合计);
      候选和.set(表.id, 候选合计);
      变化和.set(表.id, 变化合计);
    }
    return { 行数据, 原始和, 候选和, 变化和 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [候选, 基线, 表视图, maxLength, alphabet]);

  const 渲染表 = (表: 表配置) => {
    const 行 = 表分析.行数据.get(表.id) ?? [];
    const columns: ColumnsType<(typeof 行)[number]> = [
      { title: "阶", dataIndex: "阶", key: "阶", width: 56 },
      { title: "模式", dataIndex: "模式", key: "模式", width: 130 },
      {
        title: "原始",
        dataIndex: "原始",
        key: "原始",
        width: 90,
        render: (v: number | string) =>
          typeof v === "number" ? (
            <span title={`精确 ${v}`}>{v.toFixed(2)}</span>
          ) : (
            v
          ),
      },
      {
        title: "加减根后",
        dataIndex: "加减根后",
        key: "加减根后",
        width: 100,
        render: (v: number | string) =>
          typeof v === "number" ? (
            <span title={`精确 ${v}`}>{v.toFixed(2)}</span>
          ) : (
            v
          ),
      },
      {
        title: (
          <Flex vertical>
            <span>变化</span>
            <Typography.Text type="secondary" className="text-xs! font-normal! whitespace-nowrap">
              点击展开变化组
            </Typography.Text>
          </Flex>
        ),
        dataIndex: "变化",
        key: "变化",
        width: 120,
        render: (v, record) =>
          typeof v === "number" ? (
            <Popover
              trigger="click"
              content={
                <div className="max-w-130 max-h-96 overflow-y-auto">
                  {record.变化组.length === 0 ? (
                    <div>无组变化</div>
                  ) : (
                    record.变化组.map((组, gi) => {
                      const 基线集 = new Set(组.基线词);
                      const 候选集 = new Set(组.候选词);
                      const 不变 = 组.基线词.filter((x) => 候选集.has(x));
                      const 加入 = 组.候选词.filter((x) => !基线集.has(x));
                      const 离开 = 组.基线词.filter((x) => !候选集.has(x));
                      return (
                        <div key={gi} className="mb-1">
                          <div className="font-medium">
                            组（{组.基线}→{组.候选}）：
                          </div>
                          {加入.length > 0 && (
                            <div className="text-red-500">
                              ＋{加入.join("、")}
                            </div>
                          )}
                          {离开.length > 0 && (
                            <div className="text-green-600">
                              －{离开.join("、")}
                            </div>
                          )}
                          {不变.length > 0 &&
                            (不变.length <= 8 ? (
                              <div>＝{不变.join("、")}</div>
                            ) : (
                              <div className="text-gray-500">
                                ＝{不变.slice(0, 8).join("、")} 等 {不变.length}{" "}
                                字不变
                              </div>
                            ))}
                        </div>
                      );
                    })
                  )}
                </div>
              }
            >
              <span
                className={变化显示(v).类}
                title={typeof v === "number" ? `精确 ${v}` : undefined}
              >
                {变化显示(v).文本}
              </span>
            </Popover>
          ) : (
            "—"
          ),
      },
    ];
    return <Table dataSource={行} columns={columns} size="small" pagination={false} />;
  };

  const 表变化值 = (表: 表配置) => (候选 ? 表分析.变化和.get(表.id) ?? 0 : 0);
  // 初/末态取精确值（显示层负责舍入到 2 位 + 悬浮展示精确值）
  const 表初态 = (表: 表配置) => 表分析.原始和.get(表.id) ?? 0;
  const 表末态 = (表: 表配置) => 表分析.候选和.get(表.id) ?? 0;

  const { 总预期值, 总初态, 总末态 } = useMemo(() => {
    let 预期 = 0;
    let 初 = 0;
    let 末 = 0;
    for (const 表 of 表视图) {
      // 总分用未舍入的逐表和累加（与智能选根核心 Σ权重×未舍入表值 同口径），
      // 逐表四舍五入只用于表内显示，进总分会让手动初态与自动搜索分数差在小数位
      预期 += (候选 ? 表分析.变化和.get(表.id) ?? 0 : 0) * 表.权重;
      初 += (表分析.原始和.get(表.id) ?? 0) * 表.权重;
      末 += (候选 ? 表分析.候选和.get(表.id) ?? 0 : 0) * 表.权重;
    }
    return { 总预期值: 预期, 总初态: 初, 总末态: 末 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [表分析, 表视图, 候选]);

  return (
    <>
      <Typography.Title level={2}>加减根分析</Typography.Title>
      <Typography.Paragraph type="secondary">
        选一批候选字根，以「加根」「减根」任意组合试算：系统按操作重拆分，逐表对比分数变化；已在方案中的根配上新安排即为改根。每张表可自定义空位模式、统计前
        N 字与权重。
        <span
          title="候选支持笔画 12345、汉字、别名检索；加根的安排可为键位或归并到已有字根（安排不影响阶重估计）。阶重估计口径：某空位模式下同码 n 字的组，期望重码 = n²/(2·k^阶)，n=组内字数，k=键盘按键数（取方案字母表大小，通常 26），阶=空位数；零阶按精确值 Σ(n−1) 计。独立随机编码期望（含自身对），与统计一、智能选根、CLI 口径统一。"
        >
          <InfoCircleOutlined style={{ marginLeft: 6 }} />
        </span>
      </Typography.Paragraph>
      <Flex gap="small" align="center" wrap="wrap">
        <Radio.Group
          value={操作}
          onChange={(e) => 设操作(e.target.value)}
          optionType="button"
          buttonStyle="solid"
          options={[
            { label: "加根", value: "加" },
            { label: "减根", value: "减" },
          ]}
        />
        {操作 === "加" && (
          <Cascader
            className="min-w-36"
            placeholder={`${加根类别[0]} / ${加根类别[1]}`}
            value={加根类别}
            onChange={(x) => {
              设加根类别(x as [string, string]);
              设当前根("");
            }}
            options={加根类别选项}
          />
        )}
        {操作 === "加" ? (
          <CharacterSelect
            className="w-36"
            placeholder={加根类别[1]}
            候选元素={加根候选}
            value={当前根 || undefined}
            onChange={(v) => 设当前根(v ?? "")}
          />
        ) : (
          <ElementSelect
            className="w-52"
            allowClear
            placeholder="已映射元素（可减声韵等）"
            value={当前根 ? 名称映射?.get(当前根) : undefined}
            onChange={(e) => 设当前根(e.获取名称())}
          />
        )}
        {操作 === "加" && (
          <Flex gap="small" align="center" wrap="wrap">
            <Value
              value={码串}
              onChange={(v) => 设码串(v)}
              allowDisabled={false}
              extraMergeTargets={操作列表.flatMap((x) =>
                x.类型 === "加" && 名称映射?.has(x.名)
                  ? [名称映射.get(x.名)!]
                  : [],
              )}
            />
          </Flex>
        )}
        <Button onClick={添加操作}>添加</Button>
      </Flex>
      {操作列表.length > 0 && (
        <Flex gap="small" align="center" wrap="wrap" className="mt-2">
          <Typography.Text type="secondary">操作列表：</Typography.Text>
          {操作列表.map((x) => (
            <Tag
              key={x.id}
              closable
              color={x.类型 === "减" ? "red" : "green"}
              onClose={() => 设操作列表(操作列表.filter((y) => y.id !== x.id))}
            >
              {x.类型 === "减"
                ? `减 ${x.名}`
                : `加 ${x.名} → ${安排文本(x.安排).replace(/^归并→/, "并→")}`}
            </Tag>
          ))}
          <Button size="small" danger onClick={() => 设操作列表([])}>
            清空
          </Button>
        </Flex>
      )}
      <Flex gap="small" align="center" wrap="wrap" style={{ marginTop: 24 }}>
        <Button type="primary" onClick={分析} loading={运行中}>
          分析
        </Button>
        {错误 && <Typography.Text type="danger">{错误}</Typography.Text>}
      </Flex>
      {已完成 && !运行中 && 候选 && (
        <Typography.Text
          className="mt-1! block text-base!"
          style={{ color: "#059669", fontWeight: 600 }}
        >
          已分析：{已完成}
        </Typography.Text>
      )}
      {运行中 && <Spin tip="正在重新拆分……" />}
      <Typography.Title level={3} className="mt-2!">
        {候选 ? (
          <>
            总预期值：
            <span className={变化显示(总预期值).类}>
              {变化显示(总预期值).文本}
            </span>
            <Typography.Text type="secondary" className="text-base! font-normal!">
              （初{" "}
              <span title={`精确 ${总初态}`}>{总初态.toFixed(2)}</span> → 末{" "}
              <span title={`精确 ${总末态}`}>{总末态.toFixed(2)}</span>）
            </Typography.Text>
          </>
        ) : (
          <>
            总初态：
            <span className="text-black" title={`精确 ${总初态}`}>
              {总初态.toFixed(2)}
            </span>
            <Typography.Text type="secondary" className="text-base! font-normal!">
              （添加加/减根操作并点「分析」后显示末态）
            </Typography.Text>
          </>
        )}
        <Typography.Text type="secondary" className="text-base! font-normal!">
          （绿减＝重码变少，红加＝重码变多）
        </Typography.Text>
      </Typography.Title>
      <Flex gap="small" align="center" className="mb-2">
        <Switch size="small" checked={共享表} onChange={设共享表} />
        <Typography.Text type="secondary">
          {共享表
            ? "已共享「评分表」页签的表（此处编辑会直接写回评分表）"
            : "使用本页自建阶重表"}
        </Typography.Text>
        {!共享表 && (
          <Button
            size="small"
            onClick={() =>
              设自建表([
                ...自建表,
                { id: 表序号++, 模式: [], top: 0, 权重: 1, 名称: `表${表序号}` },
              ])
            }
          >
            新建阶重表
          </Button>
        )}
      </Flex>
      <Flex vertical gap="middle">
        {表视图.map((表) => {
          const 本表变化 = 候选 ? 表变化值(表) : 0;
          const 本表贡献 = 候选 ? 本表变化 * 表.权重 : 0;
          return (
            <div key={表.id}>
              <Flex gap="small" align="center" wrap="wrap" className="mb-2">
                <Tag>阶重</Tag>
                <Input
                  className="w-24! text-center"
                  placeholder="表名"
                  value={表.名称 ?? ""}
                  onChange={(e) => {
                    const 名称 = e.target.value;
                    共享表
                      ? 更新共享表(表.id - 10000, { name: 名称 })
                      : 设自建表(
                          自建表.map((t) =>
                            t.id === 表.id ? { ...t, 名称 } : t,
                          ),
                        );
                  }}
                />
                <Typography.Text strong>
                  总变化{" "}
                  <span
                    className={变化显示(本表变化).类}
                    title={`精确 ${本表变化}`}
                  >
                    {变化显示(本表变化).文本}
                  </span>
                </Typography.Text>
                <Typography.Text type="secondary">
                  加权贡献{" "}
                  <span
                    className={变化显示(本表贡献).类}
                    title={`精确 ${本表贡献}`}
                  >
                    {变化显示(本表贡献).文本}
                  </span>{" "}
                  （{变化显示(本表变化).文本} × {表.权重}）
                </Typography.Text>
                <Typography.Text type="secondary">
                  {候选
                    ? (<>（初{" "}
                        <span title={`精确 ${表初态(表)}`}>{表初态(表).toFixed(2)}</span> → 末{" "}
                        <span title={`精确 ${表末态(表)}`}>{表末态(表).toFixed(2)}</span>）</>)
                    : (<>（初{" "}
                        <span title={`精确 ${表初态(表)}`}>{表初态(表).toFixed(2)}</span>）</>)}
                </Typography.Text>
                <Select
                  mode="multiple"
                  allowClear
                  placeholder="选择空位模式（默认全部）"
                  value={表.模式}
                  className="min-w-80"
                  options={range(maxLength + 1).map((阶) => ({
                    label: `${数字标签(阶)}阶`,
                    options: combinations(maxLength, 阶).map((空位) => ({
                      label: 模式名称(空位, maxLength),
                      value: JSON.stringify(空位),
                    })),
                  }))}
                  onChange={(vs) => {
                    const 模式 = vs as string[];
                    共享表
                      ? 更新共享表(表.id - 10000, {
                          patterns: 模式.map((v) => JSON.parse(v)),
                        })
                      : 设自建表(
                          自建表.map((t) =>
                            t.id === 表.id ? { ...t, 模式 } : t,
                          ),
                        );
                  }}
                />
                <Flex gap="small" align="center">
                  范围前
                  <InputNumber
                    min={0}
                    value={表.top || undefined}
                    placeholder="全部"
                    onChange={(v) => {
                      const top = v ?? 0;
                      共享表
                        ? 更新共享表(表.id - 10000, { top })
                        : 设自建表(
                            自建表.map((t) =>
                              t.id === 表.id ? { ...t, top } : t,
                            ),
                          );
                    }}
                  />
                  字
                </Flex>
                <Flex gap="small" align="center">
                  权重
                  <InputNumber
                    step={0.1}
                    value={表.权重}
                    onChange={(v) => {
                      const 权重 = v ?? 0;
                      共享表
                        ? 更新共享表(表.id - 10000, { weight: 权重 })
                        : 设自建表(
                            自建表.map((t) =>
                              t.id === 表.id ? { ...t, 权重 } : t,
                            ),
                          );
                    }}
                  />
                </Flex>
                <Button
                  size="small"
                  danger
                  onClick={() => {
                    共享表
                      ? 删除共享表(表.id - 10000)
                      : 设自建表(自建表.filter((t) => t.id !== 表.id));
                  }}
                >
                  删除
                </Button>
              </Flex>
              {渲染表(表)}
            </div>
          );
        })}
      </Flex>
    </>
  );
}

// ==================== 评分表（statistics.tables 查看/编辑，与 CLI 评分共用） ====================

/** 与 方案 yaml 的 statistics.tables 同构，CLI 评分.ts 与 智能选根 Worker 共用 */
interface 评分表格式 {
  name: string;
  weight: number;
  top?: number;
  orders?: number[];
  patterns?: number[][];
}

const 默认四表 = (maxLength: number): 评分表格式[] => [
  { name: "必撞", top: 0, weight: 1000, patterns: [[]] },
  {
    name: "总阶重",
    top: 0,
    weight: 1,
    patterns: range(Math.min(4, maxLength)).flatMap((阶) =>
      combinations(maxLength, 阶),
    ),
  },
  {
    name: "四码拥挤",
    top: 1500,
    weight: 26,
    patterns: [[3], [0, 3], [1, 3], [2, 3], [0, 1, 3], [0, 2, 3], [1, 2, 3], [0, 1, 2, 3]],
  },
  {
    name: "二简拥挤",
    top: 800,
    weight: 676,
    patterns: [[2, 3], [0, 2, 3], [1, 2, 3], [0, 1, 2, 3]],
  },
];

function 评分表面板() {
  const 配置 = useAtomValue(配置原子);
  const 设配置 = useSetAtom(配置原子);
  const maxLength = useAtomValue(最大码长原子);
  const tables = ((配置 as any).statistics?.tables ?? []) as 评分表格式[];

  const 更新 = (新表: 评分表格式[]) => {
    设配置({ ...配置, statistics: { tables: 新表 } } as any);
  };
  const 改表 = (i: number, patch: Partial<评分表格式>) =>
    更新(tables.map((t, ti) => (ti === i ? { ...t, ...patch } : t)));

  const 模式选项 = range(maxLength + 1).flatMap((阶) =>
    combinations(maxLength, 阶).map((空位) => ({
      label: `${数字标签(阶)}阶 ${模式名称(空位, maxLength)}`,
      value: JSON.stringify(空位),
    })),
  );

  return (
    <>
      <Typography.Paragraph type="secondary">
        这些评分表是「智能选根」的优化目标（加权和最小者优先），同时供本地 CLI
        评分脚本（方案/选根/评分.ts）读取，一处编辑两边生效。patterns =
        手动指定空位模式（一个模式 = 一组计入统计的码位）。top =
        只统计按字频前 N 字（0 为全部）。
      </Typography.Paragraph>
      <Flex gap="small" className="mb-2">
        <Button
          onClick={() =>
            更新([...tables, { name: `表${tables.length + 1}`, weight: 1, top: 0, patterns: [] }])
          }
        >
          新建表
        </Button>
        <Button onClick={() => 更新(默认四表(maxLength))}>恢复默认四表</Button>
        {tables.length > 0 && (
          <Button danger onClick={() => 更新([])}>
            清空
          </Button>
        )}
      </Flex>
      {tables.length === 0 && (
        <Alert type="warning" showIcon message="尚无评分表，请新建或恢复默认四表。" />
      )}
      <Flex vertical gap="middle">
        {tables.map((表, i) => (
          <div key={i}>
            <Flex gap="small" align="center" wrap="wrap">
              <Input
                className="w-32!"
                value={表.name}
                addonBefore="名"
                onChange={(e) => 改表(i, { name: e.target.value })}
              />
              <Flex gap={4} align="center">
                权重
                <InputNumber
                  step={0.1}
                  min={0}
                  value={表.weight}
                  onChange={(v) => 改表(i, { weight: v ?? 0 })}
                />
              </Flex>
              <Flex gap={4} align="center">
                统计前
                <InputNumber
                  min={0}
                  value={表.top ?? 0}
                  placeholder="全部"
                  onChange={(v) => 改表(i, { top: v ?? 0 })}
                />
                字
              </Flex>
              <Select
                mode="multiple"
                allowClear
                showSearch
                className="min-w-60"
                placeholder="指定空位模式"
                value={(表.patterns ?? []).map((p) => JSON.stringify(p))}
                options={模式选项}
                onChange={(vs) =>
                  改表(i, { patterns: (vs as string[]).map((s) => JSON.parse(s)) })
                }
              />
              <Button danger size="small" onClick={() => 更新(tables.filter((_, ti) => ti !== i))}>
                删除
              </Button>
            </Flex>
            <Typography.Text type="secondary" className="text-xs!">
              展开为{" "}
              {展开表模式({ patterns: 表.patterns, orders: 表.orders, maxLength }).length}{" "}
              个模式
            </Typography.Text>
          </div>
        ))}
      </Flex>
    </>
  );
}

// ==================== 页签二：自动搜索（智能选根） ====================

type 挖掘状态类型 = {
  进行中: boolean;
  阶段: string;
  结果: 挖掘结果项[] | null;
  按名: Map<string, 挖掘结果项> | null;
};

function 智能选根面板({ 转评分表 }: { 转评分表: () => void }) {
  const 配置 = useAtomValue(配置原子);
  const 设配置 = useSetAtom(配置原子);
  const { 名称映射 } = useAtomValueUnwrapped(全部合法元素原子);
  const 字库 = useAtomValueUnwrapped(如字库原子);
  const 原始词典 = useAtomValue(原始词典原子);
  const 编码类型 = useAtomValue(编码类型原子);
  const alphabet = useAtomValue(字母表原子);

  // 自动搜索配置持久化（localStorage，跨刷新保留）
  const 自动搜索配置键 = "智能选根-自动搜索配置";
  const 初始配置 = (() => {
    try {
      return JSON.parse(localStorage.getItem(自动搜索配置键) ?? "{}");
    } catch {
      return {};
    }
  })();
  const [轮数, 设轮数] = useState(初始配置.轮数 ?? 12);
  const [单轮根数, 设单轮根数] = useState(初始配置.单轮根数 ?? 1);
  const [字根表, 设字根表] = useState<字根表规则[]>(
    初始配置.字根表 ?? [{ 类型: "字频范围", 起: 1, 止: 200 }],
  );
  const [占位安排, 设占位安排] = useState(
    初始配置.占位安排 ?? (alphabet[0] ?? "a").repeat(编码类型),
  );
  const [罚分表达式, 设罚分表达式] = useState(初始配置.罚分表达式 ?? "");
  const [减根范围文本, 设减根范围文本] = useState(初始配置.减根范围 ?? "");
  const [允许加根, 设允许加根] = useState(初始配置.允许加根 ?? true);
  const [允许减根, 设允许减根] = useState(初始配置.允许减根 ?? true);
  const [自动归并相似根, 设自动归并相似根] = useState(初始配置.自动归并相似根 ?? true);
  const [预置归并文本, 设预置归并文本] = useState(初始配置.预置归并文本 ?? "");
  useEffect(() => {
    try {
      localStorage.setItem(
        自动搜索配置键,
        JSON.stringify({
          轮数,
          单轮根数,
          字根表,
          占位安排,
          允许加根,
          允许减根,
          罚分表达式,
          减根范围: 减根范围文本,
          自动归并相似根,
          预置归并文本,
        }),
      );
    } catch {
      /* 忽略存储失败 */
    }
  }, [轮数, 单轮根数, 字根表, 占位安排, 允许加根, 允许减根, 罚分表达式, 减根范围文本, 自动归并相似根, 预置归并文本]);

  const [展开规则, 设展开规则] = useState<number[]>([]);
  const [运行中, 设运行中] = useState(false);
  const [阶段, 设阶段] = useState("");
  const [进度, 设进度] = useState<{ 已评: number; 总数: number; 最优: string; 最优分: number } | null>(null);
  const [轮日志, 设轮日志] = useState<轮结果[]>([]);
  const [结果, 设结果] = useState<搜索结果 | null>(null);
  const [错误, 设错误] = useState("");
  const worker引用 = useRef<Worker | null>(null);
  useEffect(() => () => worker引用.current?.terminate(), []);

  const 表列表 = ((配置 as any).statistics?.tables ?? []) as 评分表格式[];
  const 键盘 = useAtomValue(键盘原子);
  const 起始mapping = (键盘 as any).mapping as Record<string, any>;
  const 起始直设根 = Object.keys(起始mapping).filter(
    (k) => typeof 起始mapping[k] === "string",
  );

  // —— 可选字根配置的数据准备：全字库笔顺索引 ——
  const 频率表 = useMemo(
    () => new Map(原始词典.map((d) => [d.词, d.频率] as [string, number])),
    [原始词典],
  );
  const 笔顺索引 = useMemo(() => {
    const 串到代表 = new Map<string, { 名: string; 串: string; 频: number }>();
    const 名到串 = new Map<string, string>();
    const 名到字符 = new Map<string, any>();
    if (字库) {
      for (const { 字符, 字形列表 } of 字库 as any) {
        const 字形 = 字形列表?.[0];
        if (!字形) continue;
        const 串 = (字形.获取笔画序列(默认分类器) as string[]).join("");
        if (!串) continue;
        const 名 = 字符.获取名称();
        const 频 = 频率表.get(名) ?? -1;
        const 旧 = 串到代表.get(串);
        if (!旧 || 频 > 旧.频) 串到代表.set(串, { 名, 串, 频 });
        if (!名到串.has(名)) 名到串.set(名, 串);
        if (!名到字符.has(名)) 名到字符.set(名, 字符);
      }
    }
    return { 串到代表, 名到串, 名到字符 };
  }, [字库, 频率表]);

  // —— 字内部件挖掘：复/叶 双模式，各自后台 worker（带旗守卫防重复启动） ——
  const 空挖掘状态: 挖掘状态类型 = { 进行中: false, 阶段: "", 结果: null, 按名: null };
  const [挖掘状态, 设挖掘状态] = useState<{ 复: 挖掘状态类型; 叶: 挖掘状态类型 }>({
    复: 空挖掘状态,
    叶: 空挖掘状态,
  });
  const 挖掘worker引用 = useRef<Record<string, Worker>>({});
  useEffect(() => {
    const 需要模式 = new Set<boolean>();
    for (const i of 展开规则) {
      const r = 字根表[i];
      if (r && (r.类型 === "字内部件" || r.类型 === "重码组挖掘")) {
        需要模式.add(r.允许复合体 !== false);
      } else {
        需要模式.add(true);
      }
    }
    for (const 允许复合体 of [true, false]) {
      if (!需要模式.has(允许复合体)) continue;
      const 模式 = 允许复合体 ? "复" : "叶";
      if (挖掘状态[模式].结果 || 挖掘worker引用.current[模式]) continue;
      设挖掘状态((x) => ({
        ...x,
        [模式]: { ...x[模式], 进行中: true, 阶段: "启动后台挖掘……" },
      }));
      const w = new Worker(new URL("../lib/智能选根.worker.ts", import.meta.url), {
        type: "module",
      });
      挖掘worker引用.current[模式] = w;
      w.onmessage = ({ data }: { data: any }) => {
        switch (data.type) {
          case "阶段":
            设挖掘状态((x) => ({ ...x, [模式]: { ...x[模式], 阶段: data.文本 } }));
            break;
          case "挖掘完成": {
            const 按名 = new Map<string, 挖掘结果项>(
              data.结果.map((x: 挖掘结果项) => [x.名, x]),
            );
            设挖掘状态((x) => ({
              ...x,
              [模式]: { 进行中: false, 阶段: "", 结果: data.结果, 按名 },
            }));
            w.terminate();
            if (挖掘worker引用.current[模式] === w) delete 挖掘worker引用.current[模式];
            break;
          }
          case "错误":
            设错误(`字内部件挖掘失败: ${data.错误}`);
            设挖掘状态((x) => ({ ...x, [模式]: { ...x[模式], 进行中: false } }));
            w.terminate();
            if (挖掘worker引用.current[模式] === w) delete 挖掘worker引用.current[模式];
            break;
        }
      };
      w.onerror = (e) => {
        设错误(
          `挖掘 Worker 加载/运行失败（${e.message || "无错误消息，多为页面版本过期"}）——请 Ctrl+Shift+R 强制刷新后重试`,
        );
        设挖掘状态((x) => ({ ...x, [模式]: { ...x[模式], 进行中: false } }));
        w.terminate();
        if (挖掘worker引用.current[模式] === w) delete 挖掘worker引用.current[模式];
      };
      w.postMessage({
        type: "mine",
        配置,
        内置字库数据: Object.values(get预加载数据().原始字库数据),
        原始词典,
        允许复合体,
      });
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [展开规则, 挖掘状态, 字根表]);

  // —— 重码组挖掘：按规则×复/叶 各自后台 worker ——
  const [组挖掘状态, 设组挖掘状态] = useState<
    Record<string, { 进行中: boolean; 阶段: string; 结果: { 组: 重码组信息[]; 根: 重码根候选[] } | null }>
  >({});
  const 组挖掘worker引用 = useRef<Record<string, Worker>>({});
  useEffect(() => {
    for (let i = 0; i < 字根表.length; i++) {
      const r = 字根表[i];
      if (!r || r.类型 !== "重码组挖掘" || !展开规则.includes(i)) continue;
      const 允许复合体 = r.允许复合体 !== false;
      const 键 = `${i}:${允许复合体 ? "复" : "叶"}`;
      const 现状 = 组挖掘状态[键];
      if (现状?.结果 || 现状?.进行中 || 组挖掘worker引用.current[键]) continue;
      设组挖掘状态((x) => ({
        ...x,
        [键]: {
          ...(x[键] ?? { 进行中: false, 阶段: "", 结果: null }),
          进行中: true,
          阶段: "启动后台分析……",
          结果: null,
        },
      }));
      const w = new Worker(new URL("../lib/智能选根.worker.ts", import.meta.url), {
        type: "module",
      });
      组挖掘worker引用.current[键] = w;
      w.onmessage = ({ data }: { data: any }) => {
        switch (data.type) {
          case "阶段":
            设组挖掘状态((x) => ({
              ...x,
              [键]: {
                ...(x[键] ?? { 进行中: false, 阶段: "", 结果: null }),
                阶段: data.文本,
              },
            }));
            break;
          case "组挖掘完成":
            设组挖掘状态((x) => ({
              ...x,
              [键]: { 进行中: false, 阶段: "", 结果: data.结果 },
            }));
            w.terminate();
            if (组挖掘worker引用.current[键] === w) delete 组挖掘worker引用.current[键];
            break;
          case "错误":
            设错误(`重码组挖掘失败: ${data.错误}`);
            设组挖掘状态((x) => ({
              ...x,
              [键]: {
                ...(x[键] ?? { 进行中: false, 阶段: "", 结果: null }),
                进行中: false,
              },
            }));
            w.terminate();
            if (组挖掘worker引用.current[键] === w) delete 组挖掘worker引用.current[键];
            break;
        }
      };
      w.onerror = (e) => {
        设错误(
          `组挖掘 Worker 加载/运行失败（${e.message || "无错误消息，多为页面版本过期，请 Ctrl+Shift+R 强刷"}）`,
        );
        设组挖掘状态((x) => ({
          ...x,
          [键]: {
            ...(x[键] ?? { 进行中: false, 阶段: "", 结果: null }),
            进行中: false,
          },
        }));
        w.terminate();
        if (组挖掘worker引用.current[键] === w) delete 组挖掘worker引用.current[键];
      };
      w.postMessage({
        type: "组挖掘",
        配置,
        内置字库数据: Object.values(get预加载数据().原始字库数据),
        原始词典,
        mapping: 起始mapping,
        表列表,
        根起: r.根起 ?? 1,
        根止: r.根止 ?? 100,
        允许复合体,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [展开规则, 组挖掘状态, 字根表]);

  const 开始 = () => {
    if (表列表.length === 0) {
      设错误("请先在「评分表」页签配置至少一张评分表");
      return;
    }
    // 预置归并解析与校验
    const 占位 = 占位安排.trim() || (alphabet[0] ?? "a").repeat(编码类型);
    const 条目 = 预置归并文本
      .split(/[,，;；\n]/)
      .map((s: string) => s.trim())
      .filter(Boolean);
    const 预置: { 根: string; 目标: string }[] = [];
    const 已绑定 = new Set<string>();
    for (let i = 0; i < 条目.length; i++) {
      const [根, 目标] = 条目[i]!.split(/[=＝]/).map((s: string) => s.trim());
      if (!根 || !目标) {
        设错误(`预置归并第 ${i + 1} 条（${条目[i]}）格式应为「根=目标」`);
        return;
      }
      if (根 === 目标) {
        设错误(`预置归并第 ${i + 1} 条：根与目标是同一个（${根}）`);
        return;
      }
      if (!名称映射?.has(根) || !名称映射?.has(目标)) {
        设错误(
          `预置归并第 ${i + 1} 条：${名称映射?.has(根) ? 目标 : 根} 不是字库中的合法元素`,
        );
        return;
      }
      if (已绑定.has(根)) {
        设错误(`预置归并第 ${i + 1} 条：根 ${根} 被绑定了多次（一个根只能归并到一个目标）`);
        return;
      }
      已绑定.add(根);
      预置.push({ 根, 目标 });
    }
    const 范围文本 = 减根范围文本.trim();
    if (范围文本) {
      try {
        new RegExp(范围文本, "u");
      } catch {
        设错误(`减根范围「${范围文本}」不是有效正则`);
        return;
      }
    }
    const worker = new Worker(new URL("../lib/智能选根.worker.ts", import.meta.url), {
      type: "module",
    });
    worker引用.current = worker;
    设轮日志([]);
    设结果(null);
    设错误("");
    设运行中(true);
    设进度(null);
    设阶段("启动 Worker……");
    worker.onmessage = ({ data }: { data: any }) => {
      switch (data.type) {
        case "阶段":
          设阶段(data.文本);
          break;
        case "轮进度":
          设进度({ 已评: data.已评, 总数: data.总数, 最优: data.最优, 最优分: data.最优分 });
          break;
        case "轮":
          设轮日志((x) => [...x, data.轮结果]);
          设进度(null);
          break;
        case "日志":
          设阶段(data.文本);
          break;
        case "完成":
          设结果(data.结果);
          设运行中(false);
          设阶段("搜索完成");
          worker.terminate();
          break;
        case "已停止":
          设结果(data.结果);
          设运行中(false);
          设阶段("已手动停止（当前结果仍可应用）");
          worker.terminate();
          break;
        case "错误":
          设错误(data.错误);
          设运行中(false);
          worker.terminate();
          break;
      }
    };
    worker.onerror = (e) => {
      设错误(
        `Worker 加载/运行失败（${e.message || "无错误消息，多为页面版本过期，请 Ctrl+Shift+R 强刷"}）`,
      );
      设运行中(false);
    };
    worker.postMessage({
      type: "start",
      配置,
      内置字库数据: Object.values(get预加载数据().原始字库数据),
      原始词典,
      mapping: 起始mapping,
      参数: {
        轮数,
        单轮根数,
        字根表列表: 字根表,
        占位安排: 占位,
        允许加根,
        允许减根,
        减根范围: 减根范围文本,
        表列表,
        根数惩罚: 罚分表达式,
        自动归并相似根,
        预置归并: 预置,
      },
    });
  };

  // 停止 = 通知 + 300ms 后强杀兜底（同步搜索期间消息队列不会处理）
  const 停止 = () => {
    worker引用.current?.postMessage({ type: "stop" });
    window.setTimeout(() => {
      worker引用.current?.terminate();
      worker引用.current = null;
      设运行中(false);
    }, 300);
  };

  const 应用 = () => {
    if (!结果) return;
    // 零轮收敛（如全部动作被拒绝）时只有建议可应用
    const 应用建议 = 结果.轮日志.length === 0 && 结果.建议?.mapping;
    const mapping = 应用建议 ? 结果.建议!.mapping : 结果.mapping;
    设配置({ ...配置, form: { ...配置.form, mapping } } as any);
    message.success(
      应用建议
        ? `已按建议应用：${结果.建议!.动作}（可在「编码」页查看，注意新根为占位键，键位请再经「优化」调整）`
        : "已把搜索出的根集写入方案的字根映射（可在「编码」页查看，注意新根为占位键，键位请再经「优化」调整）",
    );
  };

  const 结果直设根 = 结果
    ? Object.keys(结果.mapping).filter((k) => typeof 结果.mapping[k] === "string")
    : [];
  const 起始直设集 = new Set(起始直设根);
  const 新增根 = 结果直设根.filter((k) => !起始直设集.has(k));
  const 连带删除别名 = 结果
    ? Object.keys(起始mapping).filter(
        (k) => typeof 起始mapping[k] !== "string" && !(k in 结果.mapping),
      )
    : [];
  const 移除根 = 起始直设根.filter(
    (k) => !结果 || typeof 结果.mapping[k] !== "string",
  );

  const 改规则 = (i: number, patch: Record<string, any>) =>
    设字根表((x) =>
      x.map((y, j) => (j === i ? ({ ...y, ...patch } as 字根表规则) : y)),
    );

  return (
    <>
      <Typography.Paragraph type="secondary">
        按「开始搜索」后，每轮自动试删、试加字根并显示各表分数变化，自动应用最有利的一步，直到没有改进或达到轮数上限；过程中可随时停止，结果可应用到方案。
        <span
          title="算法：以当前方案的字根映射为起点，以评分表为评判标准，自动枚举「删现有根 / 加高频字根」两类单步动作，用增量重拆分快速评分（每步只重拆受影响的字），取改进最大的第一个根或前若干根。直到无单步改进。"
        >
          <InfoCircleOutlined style={{ marginLeft: 6 }} />
        </span>
      </Typography.Paragraph>
      <Typography.Title level={3} className="mt-2!">可选字根配置</Typography.Title>
      <Flex gap="small" align="center" wrap="wrap">
          <Dropdown
            menu={{
              items: [
                { key: "字频范围", label: "字频范围（按词典单字字频排名）" },
                { key: "字内部件", label: "字内部件（按包含该根的字数排名）" },
                {
                  key: "重码组挖掘",
                  label: "重码组挖掘（按有该根的字从组中分离出的收益排名）",
                },
                { key: "手动指定", label: "手动指定（文本框逐字输入，一字符一根）" },
              ],
              onClick: ({ key }) => {
                const 类型 = key as "字频范围" | "字内部件" | "重码组挖掘" | "手动指定";
                设字根表((x) =>
                  [
                    ...x,
                    类型 === "重码组挖掘"
                      ? { 类型, 根起: 1, 根止: 100, 允许复合体: true }
                      : 类型 === "手动指定"
                        ? { 类型, 字根: "" }
                        : {
                            类型,
                            起: 1,
                            止: 类型 === "字内部件" ? 100 : 200,
                            允许复合体: true,
                          },
                  ] as 字根表规则[],
                );
              },
            }}
          >
            <Button size="small">+ 添加字根表</Button>
          </Dropdown>
          <Typography.Text type="secondary">
            各表并集去重为加根候选池；自动过滤笔画、已有根与无字形字。
          </Typography.Text>
        </Flex>
        <div className="mt-1">
          {字根表.map((r, i) => (
            <div key={i}>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {r.类型 === "字频范围" ? (
                  <Tag color="blue">字频范围</Tag>
                ) : r.类型 === "字内部件" ? (
                  <Tag color="purple">字内部件</Tag>
                ) : r.类型 === "手动指定" ? (
                  <Tag color="cyan">手动指定</Tag>
                ) : (
                  <Tag color="magenta">重码组挖掘</Tag>
                )}
                {r.类型 === "手动指定" && (
                  <Input
                    size="small"
                    className="w-72!"
                    placeholder="直接输入/粘贴字根字符，一字符一根"
                    value={r.字根}
                    onChange={(e) => 改规则(i, { 字根: e.target.value })}
                  />
                )}
                {(r.类型 === "字频范围" || r.类型 === "字内部件") && (
                  <>
                    第
                    <InputNumber
                      size="small"
                      min={1}
                      max={9999}
                      value={r.起}
                      onChange={(v) => 改规则(i, { 起: v ?? r.起 })}
                    />
                    ~
                    <InputNumber
                      size="small"
                      min={1}
                      max={9999}
                      value={r.止}
                      onChange={(v) => 改规则(i, { 止: v ?? r.止 })}
                    />
                    名
                  </>
                )}
                {r.类型 === "重码组挖掘" && (
                  <>
                    第
                    <InputNumber
                      size="small"
                      min={1}
                      max={9999}
                      value={r.根起}
                      onChange={(v) => 改规则(i, { 根起: v ?? r.根起 })}
                    />
                    ~
                    <InputNumber
                      size="small"
                      min={1}
                      max={9999}
                      value={r.根止}
                      onChange={(v) => 改规则(i, { 根止: v ?? r.根止 })}
                    />
                    名
                  </>
                )}
                {(r.类型 === "字内部件" || r.类型 === "重码组挖掘") && (
                  <Flex gap={2} align="center">
                    <Switch
                      size="small"
                      checked={r.允许复合体 !== false}
                      onChange={(v) => 改规则(i, { 允许复合体: v })}
                    />
                    <span
                      title="允许把复合体（数据库里还有子结构的形状，如糹、你）也挖出来当候选；关闭=只挖叶部件"
                      style={{ opacity: r.允许复合体 === false ? 0.4 : 1 }}
                    >
                      复合体
                    </span>
                  </Flex>
                )}
                <Typography.Text type="secondary" style={{ fontSize: "0.85em" }}>
                  {r.类型 === "字频范围"
                    ? "（按词典单字字频）"
                    : r.类型 === "字内部件"
                      ? "（按包含该根的字数排名，可挖到整字与各层部件）"
                      : r.类型 === "手动指定"
                        ? "（逐字直接作为候选，非法字会被跳过并记日志）"
                        : "（按有该根的字从组中分离出的收益排名）"}
                </Typography.Text>
                <Button
                  size="small"
                  type="text"
                  onClick={() =>
                    设展开规则((x) =>
                      x.includes(i) ? x.filter((y) => y !== i) : [...x, i],
                    )
                  }
                >
                  {展开规则.includes(i)
                    ? "▾ 收起"
                    : r.类型 === "重码组挖掘"
                      ? "▸ 查看排行"
                      : "▸ 查看候选"}
                </Button>
                <DeleteButton onClick={() => 设字根表((x) => x.filter((_, j) => j !== i))} />
              </div>
              {展开规则.includes(i) &&
                r.类型 === "重码组挖掘" &&
                (() => {
                  const 状态 = 组挖掘状态[`${i}:${r.允许复合体 === false ? "叶" : "复"}`];
                  if (!状态 || 状态.进行中 || !状态.结果) {
                    return (
                      <div className="ml-6 mt-1 rounded p-2 bg-gray-50 text-gray-500">
                        {状态?.阶段 || "准备中……"}（后台线程执行，页面不卡顿）
                      </div>
                    );
                  }
                  return (
                    <div className="ml-6 mt-1 rounded p-2 bg-gray-50">
                      <Typography.Text strong>
                        注：假设加的根可以把有该根的字从所有阶重码组中完全分离，计算其可消除的重码伤害，由大至小排列：
                      </Typography.Text>
                      <Typography.Text type="secondary" className="w-full!">
                        共 {状态.结果.根.length} 个候选（灰=已在方案），点字形看它出现在哪些字里：
                      </Typography.Text>
                      <div className="mt-1 flex flex-wrap gap-1 max-h-44 overflow-y-auto items-start">
                        {状态.结果.根.map((rk, ri) => (
                          <Popover
                            key={ri}
                            trigger="click"
                            content={
                              <div className="max-w-100 max-h-60 overflow-y-auto leading-6 break-all">
                                <div className="font-medium mb-1">
                                  出现于 {rk.字列表.length} 字：
                                </div>
                                {rk.字列表.join("、")}
                              </div>
                            }
                          >
                            <Tag
                              color={起始mapping[rk.名] === undefined ? "purple" : "default"}
                              style={{ cursor: "pointer" }}
                            >
                              {笔顺索引.名到字符.get(rk.名) ? (
                                <CharacterDisplay character={笔顺索引.名到字符.get(rk.名)} />
                              ) : (
                                <span>{rk.名}</span>
                              )}
                              <span className="text-xs ml-1 opacity-70">
                                +{Math.round(rk.得分 * 100) / 100}
                              </span>
                            </Tag>
                          </Popover>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              {展开规则.includes(i) &&
                r.类型 !== "重码组挖掘" &&
                (() => {
                  const 状态 =
                    r.类型 === "字内部件" && r.允许复合体 === false
                      ? 挖掘状态.叶
                      : 挖掘状态.复;
                  const 起 = Math.max(1, Math.floor((r as any).起 ?? 1));
                  const 止 = Math.max(起, Math.floor((r as any).止 ?? 200));
                  const 保护 = new Set(["1", "2", "3", "4", "5", "6"]);
                  const 已有 = new Set(Object.keys(起始mapping));
                  const 成员: {
                    名: string;
                    标注: string;
                    在方案: boolean;
                    字列表?: string[];
                  }[] = [];
                  if (r.类型 === "手动指定") {
                    if (!状态.结果) {
                      return (
                        <div className="ml-6 mt-1 rounded p-2 bg-gray-50 text-gray-500">
                          {状态.阶段 || "字内部件挖掘中……"}
                          （后台首次需扫全字集笔顺，稍等数秒）
                        </div>
                      );
                    }
                    const 见过 = new Set<string>();
                    for (const ch of [...(r.字根 ?? "")]) {
                      if (保护.has(ch) || 见过.has(ch)) continue;
                      见过.add(ch);
                      const 字符 = 笔顺索引.名到字符.get(ch);
                      const 项 = 状态.按名?.get(ch);
                      成员.push({
                        名: ch,
                        标注: 字符
                          ? 已有.has(ch)
                            ? "已在方案"
                            : `${项?.次数 ?? 0}字`
                          : "不在字库",
                        在方案: 已有.has(ch),
                        字列表: 项?.字列表,
                      });
                    }
                  } else if (r.类型 === "字频范围") {
                    const 排名单 = [...频率表.entries()]
                      .filter(([w]) => [...w].length === 1)
                      .sort((a, b) => b[1] - a[1]);
                    for (let k = 起 - 1; k < Math.min(止, 排名单.length); k++) {
                      const [w, f] = 排名单[k]!;
                      if (!笔顺索引.名到串.has(w) || 保护.has(w)) continue;
                      成员.push({
                        名: w,
                        标注: `频${f}`,
                        在方案: 已有.has(w),
                        字列表: 状态.按名?.get(w)?.字列表,
                      });
                    }
                  } else {
                    if (状态.进行中) {
                      return (
                        <div className="ml-6 mt-1 rounded p-2 bg-gray-50 text-gray-500">
                          {状态.阶段 || "字内部件挖掘中……"}
                          （在后台线程执行，页面不卡顿）
                        </div>
                      );
                    }
                    if (!状态.结果) return null;
                    for (let k = 起 - 1; k < Math.min(止, 状态.结果.length); k++) {
                      const c = 状态.结果[k]!;
                      成员.push({
                        名: c.名,
                        标注: `${c.次数}字`,
                        在方案: 已有.has(c.名),
                        字列表: c.字列表,
                      });
                    }
                  }
                  return (
                    <div className="ml-6 mt-1 max-h-44 overflow-y-auto flex flex-wrap gap-1 items-start bg-gray-50 p-1">
                      <Typography.Text type="secondary" className="w-full!">
                        共 {成员.length} 个候选（灰=已在方案），点字形看它出现在哪些字里：
                      </Typography.Text>
                      {成员.map((m) => (
                        <Popover
                          key={m.名}
                          trigger="click"
                          content={
                            m.字列表 ? (
                              <div className="max-w-120 max-h-80 overflow-y-auto">
                                <div className="font-medium mb-1">
                                  出现于 {m.字列表.length} 字：
                                </div>
                                <div className="leading-6 break-all">
                                  {m.字列表.slice(0, 400).join("、")}
                                  {m.字列表.length > 400
                                    ? ` ……（共 ${m.字列表.length} 字）`
                                    : ""}
                                </div>
                              </div>
                            ) : 状态.进行中 || !状态.按名 ? (
                              <div className="text-gray-500">字内部件挖掘中……</div>
                            ) : (
                              <div className="text-gray-500">
                                挖掘完成：该字形作为切片出现 0 次（挖不出）
                              </div>
                            )
                          }
                        >
                          <Tag
                            color={
                              m.在方案
                                ? "default"
                                : r.类型 === "字内部件"
                                  ? "purple"
                                  : r.类型 === "手动指定"
                                    ? "cyan"
                                    : "geekblue"
                            }
                            style={{ cursor: "pointer" }}
                          >
                            {笔顺索引.名到字符.get(m.名) ? (
                              <CharacterDisplay character={笔顺索引.名到字符.get(m.名)} />
                            ) : (
                              <span>{m.名}</span>
                            )}
                            <span className="text-xs ml-1 opacity-70">{m.标注}</span>
                          </Tag>
                        </Popover>
                      ))}
                    </div>
                  );
                })()}
            </div>
          ))}
        </div>
      <Typography.Title level={3} className="mt-2!">搜索行为</Typography.Title>
      <Flex gap="small" align="center" wrap="wrap">
          <Flex gap={4} align="center">
            轮数上限
            <InputNumber min={1} max={200} value={轮数} onChange={(v) => 设轮数(v ?? 12)} />
          </Flex>
          <Flex gap={4} align="center">
            <span title="每轮把改善最大的前 K 个加根动作同时应用（按各自单加收益降序选，组合后整体合评，根间相互作用以合评分为准）。1=经典单步贪心">
              单轮根数
            </span>
            <InputNumber min={1} max={200} value={单轮根数} onChange={(v) => 设单轮根数(v ?? 1)} />
          </Flex>
          <Flex gap={4} align="center">
            <Switch size="small" checked={允许加根} onChange={设允许加根} />
            <span style={{ opacity: 允许加根 ? 1 : 0.4 }}>加根</span>
          </Flex>
          <Flex gap={4} align="center">
            <Switch size="small" checked={允许减根} onChange={设允许减根} />
            <span style={{ opacity: 允许减根 ? 1 : 0.4 }}>减根</span>
          </Flex>
          {允许减根 && (
            <Flex gap={4} align="center">
              <span title="正则，匹配根名称的才允许被删除。留空=全部可减。如 ^鹤声- 表示只删声母类元素">
                减根范围
              </span>
              <Input
                className="w-40! text-center"
                placeholder="正则，留空=全部"
                value={减根范围文本}
                onChange={(e) => 设减根范围文本(e.target.value)}
              />
            </Flex>
          )}
        </Flex>
      <Typography.Title level={3} className="mt-2!">根与归并</Typography.Title>
      <Flex gap="small" align="center" wrap="wrap">
          <Flex gap={4} align="center">
            <Switch size="small" checked={自动归并相似根} onChange={设自动归并相似根} />
            <span
              title="加根时若其相似字形分组（力/𠃛、木/朩、比/北 等）的兄弟已在方案中，自动归并到该根"
              style={{ opacity: 自动归并相似根 ? 1 : 0.4 }}
            >
              自动归并相似根
            </span>
          </Flex>
          <Flex gap={4} align="center">
            占位安排
            <Input
              className="w-16! text-center"
              placeholder={(alphabet[0] ?? "a").repeat(编码类型)}
              value={占位安排}
              onChange={(e) => 设占位安排(e.target.value)}
            />
          </Flex>
          <Flex gap={4} align="center">
            <span title="预登记归并绑定：等号两边都不占基态键位。搜索把右边的根强制加入候选池，执行「加它」时左边的根自动以归并随行。多条用逗号分隔，如 ,b=人">
              预置归并
            </span>
            <Input
              className="w-40! text-center"
              placeholder="例：a=人，b=人"
              value={预置归并文本}
              onChange={(e) => 设预置归并文本(e.target.value)}
            />
          </Flex>
          <Flex gap={4} align="center">
            <span title="n=直设根数。须为单个 JavaScript 表达式（可用变量 n、max、min），非法会报错。留空=0。例：max(0, n-150)*50000 表示150根起每根罚5万">
              根数罚分 f(n)
            </span>
            <Input
              className="w-56! text-center"
              placeholder="例：max(0, n-150)**2"
            value={罚分表达式}
            onChange={(e) => 设罚分表达式(e.target.value)}
          />
          </Flex>
        </Flex>
      <Typography.Title level={3} className="mt-2!">评判标准</Typography.Title>
      <Flex gap="small" align="center" wrap="wrap">
          <Typography.Text type="secondary">
            评分表：
            {表列表.length === 0
              ? "（未配置，请先到「评分表」页签）"
              : 表列表.map((t) => t.name).join("、")}
          </Typography.Text>
          {!运行中 && 表列表.length === 0 && (
            <Button size="small" onClick={转评分表}>
              去配置评分表
            </Button>
          )}
        </Flex>
      <Flex gap="small" align="center" className="mt-2">
        <Button type="primary" onClick={开始} loading={运行中}>
          开始搜索
        </Button>
        <Button danger onClick={停止} disabled={!运行中}>
          停止
        </Button>
        {错误 && <Typography.Text type="danger">{错误}</Typography.Text>}
      </Flex>
      {(运行中 || 阶段) && (
        <Alert
          className="mt-2!"
          type={运行中 ? "info" : 结果 ? "success" : "warning"}
          showIcon={!!错误}
          message={运行中 ? 阶段 || "搜索中……" : 阶段}
          description={
            运行中 && 进度 ? (
              <>
                <Progress
                  percent={Math.round((进度.已评 / Math.max(进度.总数, 1)) * 100)}
                  size="small"
                />
                <Typography.Text type="secondary">
                  本轮已评 {进度.已评}/{进度.总数}，当前最优 {进度.最优}（
                  {isFinite(进度.最优分) ? Math.round(进度.最优分) : "∞"}）
                </Typography.Text>
              </>
            ) : undefined
          }
        />
      )}
      {轮日志.length > 0 && (
        <div className="mt-2 rounded p-2 bg-gray-50 max-h-60 overflow-y-auto">
          <Typography.Text strong>搜索轨迹</Typography.Text>
          {轮日志.map((r) => (
            <div key={r.轮}>
              第{r.轮}轮 <Tag color="green">{r.动作}</Tag>
              {r.前分} → {r.分数}（
              <Typography.Text type={r.变化 < 0 ? "success" : "danger"}>
                {r.变化 > 0 ? "+" : ""}
                {r.变化}
              </Typography.Text>
              ，根 {r.根数}，{r.动作数} 动作 / {r.耗时.toFixed(1)}s）
              {r.单加明细 && (
                <div className="ml-2 text-xs text-gray-500 leading-5">
                  {r.单加明细.map((x) => (
                    <div key={x.描述}>
                      {x.描述} 单加预期 {x.预期变化 > 0 ? "+" : ""}
                      {x.预期变化}
                    </div>
                  ))}
                  <div>合评 {r.变化 > 0 ? "+" : ""}{r.变化}（单加之和≠合评：根间相互作用）</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {结果 && (
        <div className="mt-2 rounded p-2 bg-gray-50">
          <Typography.Text strong>
            最终总分 {结果.总分}（{结果.收敛 ? "已收敛" : "未收敛"}，共{" "}
            {结果.轮日志.length} 轮）
          </Typography.Text>
          {结果.收敛 && 结果.建议 && (
            <div className="mt-1">
              <Typography.Text type="secondary">
                下一步建议（分数无改进故未自动应用；点下方「应用到方案」可强制执行此建议）：
              </Typography.Text>
              <Tag color="orange" style={{ marginLeft: 4 }}>
                {结果.建议.动作}
              </Tag>
              {(() => {
                const 差 = Math.round((结果.建议!.分数 - 结果.总分) * 100) / 100;
                return (
                  <Typography.Text type="secondary">
                    执行后总分将为 {结果.建议!.分数}（
                    <Typography.Text
                      type={差 > 0 ? "danger" : 差 < 0 ? "success" : undefined}
                    >
                      {差 > 0 ? "变差 +" : 差 < 0 ? "改善 " : "不变 "}
                      {差}
                    </Typography.Text>
                    ）
                  </Typography.Text>
                );
              })()}
            </div>
          )}
          <div className="mt-1">
            {新增根.length > 0 && (
              <div>
                新增根：
                {新增根.map((k) => (
                  <Tag key={k} color="green">
                    +{k}
                  </Tag>
                ))}
              </div>
            )}
            {移除根.length > 0 && (
              <div>
                移除根：
                {移除根.map((k) => (
                  <Tag key={k} color="red">
                    −{k}
                  </Tag>
                ))}
                {连带删除别名.length > 0 && (
                  <Typography.Text type="secondary" className="ml-2">
                    连带删除别名 {连带删除别名.length} 个：
                    {连带删除别名.join("、")}
                  </Typography.Text>
                )}
              </div>
            )}
            <Typography.Text type="secondary">
              最终直设根 {结果直设根.length} 个
            </Typography.Text>
          </div>
          <Button type="primary" className="mt-2!" onClick={应用}>
            应用到方案
          </Button>
        </div>
      )}
    </>
  );
}

export default function RootAdditionAnalyzer() {
  const [页签, 设页签] = useState("手动");
  return (
    <>
      <Typography.Title level={2}>智能选根</Typography.Title>
      <Tabs
        activeKey={页签}
        onChange={设页签}
        items={[
          { key: "手动", label: "手动分析", children: <手动分析面板 /> },
          {
            key: "智能",
            label: "自动搜索",
            children: <智能选根面板 转评分表={() => 设页签("评分表")} />,
          },
          { key: "评分表", label: "评分表", children: <评分表面板 /> },
        ]}
      />
    </>
  );
}
