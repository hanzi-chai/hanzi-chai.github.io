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
import CaretDownOutlined from "@ant-design/icons/CaretDownOutlined";
import CaretUpOutlined from "@ant-design/icons/CaretUpOutlined";
import type { ColumnsType } from "antd/es/table";
import type { 元素 } from "hanzi-chai";
import {
  下转换,
  是强类型归并,
  默认分类器,
  决策图,
  构建强类型决策与决策空间,
  组装,
  笔画,
  type 强类型广义安排,
  type 强类型广义引用,
  type 强类型决策,
  type 强类型元素位或编码,
  type 组装条目,
} from "hanzi-chai";
import { useAtomValue, useSetAtom } from "jotai";
import { range, sumBy } from "lodash-es";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  字形同形键,
  type 搜索结果,
  type 轮结果,
} from "../lib/智能选根核心";
import CharacterSelect from "~/components/CharacterSelect";
import ElementSelect from "~/components/ElementSelect";
import { CharacterDisplay, DeleteButton } from "~/components/Utils";
import Value from "~/components/Value";
import { 安排文本, 根安排描述 } from "~/lib/安排显示";

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

/** 红加绿减：良性（重码减少）绿显示 −，恶性（重码增加）红显示 ＋。显示逻辑与搜索轨迹一致（Math.round(v*100)/100，不补零） */
const 变化显示 = (v: number) => {
  const x = Math.round(v * 100) / 100;
  if (x > 0) return { 文本: `−${x}`, 类: "text-green-600" };
  if (x < 0) return { 文本: `＋${Math.abs(x)}`, 类: "text-red-500" };
  return { 文本: "0", 类: "" };
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

/** 预处理：过滤单字词 + 按频率降序 + 逐位下转换缓存。分组前公共开销只做一次——
 *  旧版每（表×模式）都重新 sort 全量条目并逐条 JSON.stringify，60 次调用就是打字卡顿的大头 */
const 预处理单字 = (条目列表: 组装条目[], maxLength: number) =>
  [...条目列表]
    .filter((x) => [...x.词].length === 1)
    .sort((a, b) => b.频率 - a.频率)
    .map((条目) => {
      const 序列 = 条目.元素序列.元素序列;
      return {
        词: 条目.词.map((c) => c.获取名称()).join(""),
        码: range(maxLength).map((i) => {
          const v =
            序列[i] === undefined ? "ε" : (下转换(序列[i] as any) as any);
          return typeof v === "string" ? v : JSON.stringify(v);
        }),
      };
    });

/** 按模式分组：保留非空位码位的元素序列（布局无关），返回 键→词列表。
 *  键构造与 阶重统计.ts/阶重序列键（统计一、智能选根核心口径）严格一致：
 *  按 maxLength 补齐全部码位（空位优先显示 *，序列越界补 "ε"）——
 *  短序列若不补位，尾部空位模式的通配符不会生成，会与同前缀长序列错误拆组。
 *  入参用 预处理单字 的结果（同一列表分多个模式时排序/下转换不重复做）。 */
const 分组按模式 = (
  预处理: { 词: string; 码: string[] }[],
  空位: number[],
  top: number,
  maxLength: number,
) => {
  const scope = top > 0 ? 预处理.slice(0, top) : 预处理;
  const map = new Map<string, string[]>();
  for (const { 词, 码 } of scope) {
    const 键 = range(maxLength)
      .map((i) => (空位.includes(i) ? "*" : 码[i]!))
      .join("\u0001");
    // push 而非展开重建：全空位模式（如 ****）会把全部字放进同一组，
    // 展开写法是 O(n²)（8230 字 ≈ 3400 万次拷贝），是旧版单次重算的大头
    const 列表 = map.get(键);
    if (列表) 列表.push(词);
    else map.set(键, [词]);
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

// 安排显示文本改由 src/lib/安排显示.ts 提供（与智能选根核心共用同一份，轨迹与差异区同款写法）
// ——此处不再本地定义

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
  // 自建表键入草稿：名称/top/权重 输入期间只改本地，失焦才提交（与共享表同一交互，见下）
  const [自建草稿, 设自建草稿] = useState<表配置[] | null>(null);
  const 自建已提交 = useRef(自建表);
  useEffect(() => {
    if (自建表 !== 自建已提交.current) {
      自建已提交.current = 自建表; // 外部变更 → 丢弃本地草稿
      设自建草稿(null);
    }
  }, [自建表]);
  const 提交自建 = (新表: 表配置[]) => {
    自建已提交.current = 新表;
    设自建草稿(null);
    设自建表(新表);
  };
  const 失焦提交自建 = () => {
    if (自建草稿) 提交自建(自建草稿);
  };
  // 键入路径（名称/top/权重）：只进草稿
  const 改自建草稿 = (id: number, patch: Partial<表配置>) =>
    设自建草稿(当前 => (当前 ?? 自建表).map((t) => (t.id === id ? { ...t, ...patch } : t)));
  // 共享评分表开关：开 = 读写「评分表」页签的 statistics.tables（键入入草稿，失焦写回）
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
  // 共享表键入草稿：输入期间只改本地，失焦才写回配置（逐键写回会让三个重页签全部跟着重算，打字卡顿）
  const [共享草稿, 设共享草稿] = useState<评分表格式[] | null>(null);
  const 共享已提交 = useRef(共享表数据);
  useEffect(() => {
    if (共享表数据 !== 共享已提交.current) {
      共享已提交.current = 共享表数据; // 外部变更（评分表页签编辑等）→ 丢弃本地草稿
      设共享草稿(null);
    }
  }, [共享表数据]);
  const 提交共享 = (新表: 评分表格式[]) => {
    共享已提交.current = 新表;
    设共享草稿(null);
    设配置({ ...配置, statistics: { tables: 新表 } } as any);
  };
  const 失焦提交共享 = () => {
    if (共享草稿) 提交共享(共享草稿);
  };
  const 共享表有效 = 共享草稿 ?? 共享表数据; // 编辑期间草稿为显示与提交的基准
  const 自建表有效 = 自建草稿 ?? 自建表;
  const 表视图 = useMemo<表配置[]>(
    () =>
      共享表
        ? 共享表有效.map((t, i) => ({
            id: 10000 + i,
            模式: (t.patterns ?? []).map((p) => JSON.stringify(p)),
            top: t.top ?? 0,
            权重: t.weight,
            名称: t.name,
          }))
        : 自建表有效,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [共享表, 配置, 自建表有效, 共享表有效],
  );
  // 键入路径（名称/top/权重/空位模式下拉）：只进草稿，失焦提交
  const 更新共享表 = (索引: number, patch: Partial<评分表格式>) => {
    设共享草稿(共享表有效.map((t, i) => (i === 索引 ? { ...t, ...patch } : t)));
  };
  const 删除共享表 = (索引: number) => {
    提交共享(共享表有效.filter((_, i) => i !== 索引));
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
      // 放行短于编码类型的安排（含空串「空」）——双编码下给根安排单键或留空是有意为之，不应阻止；
      // 仅保留两类真正非法的拦截：键数超过编码类型、或含字母表外的键。其余（安排赋值/分析应用/决策图等）逻辑不动。
      if (码串.length > 编码类型 || [...码串].some((c) => !alphabet.includes(c))) {
        设错误(`键位串「${码串}」不能多于 ${编码类型} 个键，且每个键须属于字母表 ${alphabet}`);
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

  /** 单个阶重模式的变化量与变化组（top 为统计范围前 N 字，0 为全部；入参为预处理后的单字列表） */
  const 阶重变化 = (
    空位: number[],
    top: number,
    基线预处理: { 词: string; 码: string[] }[],
    候选预处理: { 词: string; 码: string[] }[],
  ) => {
    const 基线分组 = 分组按模式(基线预处理, 空位, top, maxLength);
    const 候选分组 = 分组按模式(候选预处理, 空位, top, maxLength);
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

  // 分析基准 = 已提交的表（非编辑草稿）：手动分析页所有编辑（名称/权重/top/空位模式）统一失焦后才重算。
  // 键入期间草稿不进这里 → 表分析/总分行/逐表数字全部保持不动；失焦提交（或删除/新建等按钮）才更新。
  const 分析源表 = useMemo<表配置[]>(
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

  // 贵的公共开销（全量过滤+排序+逐位下转换）只在 基线/候选 变化时做一次，失焦重算时只剩廉价分组
  const 表预处理 = useMemo(
    () => ({
      基线: 预处理单字(基线 ?? [], maxLength),
      候选: 候选 ? 预处理单字(候选, maxLength) : null,
    }),
    [基线, 候选, maxLength],
  );

  const 表分析 = useMemo(() => {
    const { 基线: 基线预处理, 候选: 候选预处理 } = 表预处理;
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
    for (const 表 of 分析源表) {
      let 原始合计 = 0;
      let 候选合计 = 0;
      let 变化合计 = 0;
      const 行 = 表模式(表).map((空位) => {
        const 基线值 = 估计选重(
          分组按模式(基线预处理, 空位, 表.top, maxLength),
          空位,
          alphabet.length,
        );
        const 变化结果 =
          候选预处理 && 候选 ? 阶重变化(空位, 表.top, 基线预处理, 候选预处理) : null;
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
  }, [表预处理, 分析源表, 候选, maxLength, alphabet]);

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
            <span title={`精确 ${v}`}>{Math.round(v * 100) / 100}</span>
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
            <span title={`精确 ${v}`}>{Math.round(v * 100) / 100}</span>
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
    for (const 表 of 分析源表) {
      // 总分用未舍入的逐表和累加（与智能选根核心 Σ权重×未舍入表值 同口径），
      // 逐表四舍五入只用于表内显示，进总分会让手动初态与自动搜索分数差在小数位
      预期 += (候选 ? 表分析.变化和.get(表.id) ?? 0 : 0) * 表.权重;
      初 += (表分析.原始和.get(表.id) ?? 0) * 表.权重;
      末 += (候选 ? 表分析.候选和.get(表.id) ?? 0 : 0) * 表.权重;
    }
    return { 总预期值: 预期, 总初态: 初, 总末态: 末 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [表分析, 分析源表, 候选]);

  return (
    <>
      <Typography.Title level={2}>加减根分析</Typography.Title>
      <Typography.Paragraph type="secondary">
        选一批候选字根，以「加根」「减根」任意组合试算：系统按操作重拆分，逐表对比分数变化；已在方案中的根配上新安排即为改根。每张表可自定义空位模式、统计前
        N 字与权重。
        <Popover
          trigger="click"
          content={
            <div style={{ maxWidth: 420 }}>
              候选支持笔画 12345、汉字、别名检索；加根的安排可为键位或归并到已有字根（安排不影响阶重估计）。阶重估计口径：某空位模式下同码
              n 字的组，期望重码 = n²/(2·k^阶)，n=组内字数，k=键盘按键数（取方案字母表大小，通常
              26），阶=空位数；零阶按精确值 Σ(n−1) 计。独立随机编码期望（含自身对），与统计一口径一致。
            </div>
          }
        >
          <InfoCircleOutlined style={{ marginLeft: 6, cursor: "pointer" }} />
        </Popover>
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
              <span title={`精确 ${总初态}`}>{Math.round(总初态 * 100) / 100}</span> → 末{" "}
              <span title={`精确 ${总末态}`}>{Math.round(总末态 * 100) / 100}</span>）
            </Typography.Text>
          </>
        ) : (
          <>
            总初态：
            <span className="text-black" title={`精确 ${总初态}`}>
              {Math.round(总初态 * 100) / 100}
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
            ? "已共享「评分表」页签的表（此处编辑在失焦后写回评分表）"
            : "使用本页自建阶重表"}
        </Typography.Text>
        {!共享表 && (
          <Button
            size="small"
            onClick={() =>
              提交自建([
                ...(自建草稿 ?? 自建表),
                { id: 表序号++, 模式: [], top: 0, 权重: 1, 名称: `表${表序号}` },
              ])
            }
          >
            新建阶重表
          </Button>
        )}
      </Flex>
      <Flex vertical gap="middle">
        {表视图.map((表, 表序) => {
          // 显示数字一律读已提交值（分析源表与表视图同源同序）：键入/选模式期间保持不动，失焦后才更新
          const 已提交表 = 分析源表[表序];
          const 本表变化 = 候选 ? 表变化值(表) : 0;
          const 本表贡献 = 候选 ? 本表变化 * (已提交表?.权重 ?? 0) : 0;
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
                      : 改自建草稿(表.id, { 名称 });
                  }}
                  onBlur={共享表 ? 失焦提交共享 : 失焦提交自建}
                  onPressEnter={(e) => (e.target as HTMLInputElement).blur()}
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
                  （{变化显示(本表变化).文本} × {已提交表?.权重 ?? 0}）
                </Typography.Text>
                <Typography.Text type="secondary">
                  {候选
                    ? (<>（初{" "}
                        <span title={`精确 ${表初态(表)}`}>{Math.round(表初态(表) * 100) / 100}</span> → 末{" "}
                        <span title={`精确 ${表末态(表)}`}>{Math.round(表末态(表) * 100) / 100}</span>）</>)
                    : (<>（初{" "}
                        <span title={`精确 ${表初态(表)}`}>{Math.round(表初态(表) * 100) / 100}</span>）</>)}
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
                    // 只进草稿：勾选期间不重算，下拉关闭且失焦后才提交
                    共享表
                      ? 更新共享表(表.id - 10000, {
                          patterns: 模式.map((v) => JSON.parse(v)),
                        })
                      : 改自建草稿(表.id, { 模式 });
                  }}
                  onBlur={共享表 ? 失焦提交共享 : 失焦提交自建}
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
                        : 改自建草稿(表.id, { top });
                    }}
                    onBlur={共享表 ? 失焦提交共享 : 失焦提交自建}
                    onPressEnter={(e) => (e.target as HTMLInputElement).blur()}
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
                        : 改自建草稿(表.id, { 权重 });
                    }}
                    onBlur={共享表 ? 失焦提交共享 : 失焦提交自建}
                    onPressEnter={(e) => (e.target as HTMLInputElement).blur()}
                  />
                </Flex>
                <Button
                  size="small"
                  danger
                  onClick={() => {
                    共享表
                      ? 删除共享表(表.id - 10000)
                      : 提交自建((自建草稿 ?? 自建表).filter((t) => t.id !== 表.id));
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

  // 输入期间只改本地草稿，失焦才写回配置。配置一变，常挂载的「手动分析」「自动搜索」两个重页签
  // 会全部跟着重算——逐键写回就是打字卡顿的根源（用户要求：有光标不重算，失焦才重算）。
  const [草稿, 设草稿] = useState<评分表格式[]>(() => tables);
  const 已提交引用 = useRef(tables); // 本组件最近一次写回配置的内容：识别外部变更、避免回声覆盖
  const 有未提交 = useRef(false);
  useEffect(() => {
    if (tables !== 已提交引用.current) {
      // 外部变更（手动分析共享编辑、其他入口）→ 以配置为准覆盖草稿
      已提交引用.current = tables;
      有未提交.current = false;
      设草稿(tables);
    }
  }, [tables]);
  const 提交 = (新表: 评分表格式[]) => {
    已提交引用.current = 新表;
    有未提交.current = false;
    设草稿(新表);
    设配置({ ...配置, statistics: { tables: 新表 } } as any);
  };
  const 失焦提交 = () => {
    if (有未提交.current) 提交(草稿);
  };
  // 键入路径：只进草稿
  const 改草稿 = (i: number, patch: Partial<评分表格式>) => {
    有未提交.current = true;
    设草稿(草稿.map((t, ti) => (ti === i ? { ...t, ...patch } : t)));
  };
  // 离散操作（多选下拉/按钮）：立即提交，基于草稿叠加以免覆盖未失焦的键入

  const 模式选项 = range(maxLength + 1).flatMap((阶) =>
    combinations(maxLength, 阶).map((空位) => ({
      label: `${数字标签(阶)}阶 ${模式名称(空位, maxLength)}`,
      value: JSON.stringify(空位),
    })),
  );

  return (
    <>
      <Typography.Paragraph type="secondary">
        这些评分表是「智能选根」的优化目标（加权和最小者优先）。patterns =
        手动指定空位模式（一个模式 = 一组计入统计的码位）。top =
        只统计按字频前 N 字（0 为全部）。编辑在离开输入框（失焦）后才生效重算。
      </Typography.Paragraph>
      <Flex gap="small" style={{ marginBottom: 16 }}>
        <Button onClick={() => 提交([...草稿, { name: `表${草稿.length + 1}`, weight: 1, top: 0, patterns: [] }])}>
          新建表
        </Button>
        <Button onClick={() => 提交(默认四表(maxLength))}>恢复默认四表</Button>
        {草稿.length > 0 && (
          <Button danger onClick={() => 提交([])}>
            清空
          </Button>
        )}
      </Flex>
      {草稿.length === 0 && (
        <Alert type="warning" showIcon message="尚无评分表，请新建或恢复默认四表。" />
      )}
      <Flex vertical gap="middle">
        {草稿.map((表, i) => (
          <div key={i}>
            <Flex gap="small" align="center" wrap="wrap">
              <Input
                className="w-32!"
                value={表.name}
                addonBefore="名"
                onChange={(e) => 改草稿(i, { name: e.target.value })}
                onBlur={失焦提交}
                onPressEnter={(e) => (e.target as HTMLInputElement).blur()}
              />
              <Flex gap={4} align="center">
                权重
                <InputNumber
                  step={0.1}
                  min={0}
                  value={表.weight}
                  onChange={(v) => 改草稿(i, { weight: v ?? 0 })}
                  onBlur={失焦提交}
                  onPressEnter={(e) => (e.target as HTMLInputElement).blur()}
                />
              </Flex>
              <Flex gap={4} align="center">
                统计前
                <InputNumber
                  min={0}
                  value={表.top ?? 0}
                  placeholder="全部"
                  onChange={(v) => 改草稿(i, { top: v ?? 0 })}
                  onBlur={失焦提交}
                  onPressEnter={(e) => (e.target as HTMLInputElement).blur()}
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
                  改草稿(i, { patterns: (vs as string[]).map((s) => JSON.parse(s)) })
                }
                onBlur={失焦提交}
              />
              <Button danger size="small" onClick={() => 提交(草稿.filter((_, ti) => ti !== i))}>
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
  const [字根表, 设字根表] = useState<字根表规则[]>(初始配置.字根表 ?? []);
  // 手动指定输入域：收起索引集 + 打字中的原始文本（不即时归一，避免受控回写跳光标）
  const [手动收起集, 设手动收起集] = useState<Set<number>>(new Set());
  const [手动文本, 设手动文本] = useState<Record<number, string>>({});
  const 手动域引用 = useRef<any>(null);
  const [归并收起, 设归并收起] = useState(false);
  const [归并查看, 设归并查看] = useState(false);
  const 归并域引用 = useRef<any>(null);
  // 删除规则后重排按索引记录的临时状态
  const 重排索引记录 = (记录: Record<number, string>, 删: number): Record<number, string> =>
    Object.fromEntries(
      Object.entries(记录)
        .filter(([j]) => Number(j) !== 删)
        .map(([j, v]) => [Number(j) > 删 ? Number(j) - 1 : Number(j), v]),
    );
  // 可收放的多行输入域（手动指定/预置归并共用渲染函数——直接调用返回 JSX，不产生新组件类型，避免失焦重挂）
  const 渲染收放输入 = (
    原文: string,
    设原文: (v: string) => void,
    收起: boolean,
    设收起: (收: boolean) => void,
    占位: string,
    引用: { current: any },
  ) => {
    const 聚焦末尾 = () => {
      requestAnimationFrame(() => {
        const el: HTMLTextAreaElement | null = 引用.current?.nativeElement ?? 引用.current;
        if (el) {
          el.focus();
          const 末 = 原文.length;
          el.setSelectionRange(末, 末);
        }
      });
    };
    return (
      <Flex gap={4} style={{ flex: "1 1 280px", minWidth: 280 }} align="flex-start">
        {收起 ? (
          <Input
            size="small"
            readOnly
            style={{ cursor: "text" }}
            value={原文}
            placeholder={占位}
            onClick={() => {
              设收起(false);
              聚焦末尾();
            }}
          />
        ) : (
          <Input.TextArea
            size="small"
            ref={引用}
            style={{ resize: "none" }}
            placeholder={占位}
            autoSize={{ minRows: 1, maxRows: 5 }}
            value={原文}
            onChange={(e) => 设原文(e.target.value)}
          />
        )}
        <Button
          size="small"
          type="text"
          icon={收起 ? <CaretDownOutlined /> : <CaretUpOutlined />}
          onClick={() => {
            设收起(!收起);
            if (!收起) 聚焦末尾();
          }}
        />
      </Flex>
    );
  };
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
  const [进度, 设进度] = useState<{ 已评: number; 总数: number; 最优: string; 最优分: number; 变化: number | null } | null>(null);
  const [轮日志, 设轮日志] = useState<轮结果[]>([]);
  // 抓包用：实时镜像最新轮日志与最近一轮的 mapping 快照，强杀后据此合成已选好的根
  const 轮日志引用 = useRef<轮结果[]>([]);
  const 快照引用 = useRef<Record<string, any> | null>(null);
  const [结果, 设结果] = useState<搜索结果 | null>(null);
  const [错误, 设错误] = useState("");
  const worker引用 = useRef<Worker | null>(null);
  // 预置归并筛死 / 手动指定字库找不到 等警告，点开始搜索后由核心上报，常驻显示到下次搜索。
  // 按"实际处理顺序"自然排列：string[] 按发生先后 push，渲染即顺序（不强行调序）
  const [归并失败提示, 设归并失败提示] = useState<string[]>([]);
  useEffect(() => () => worker引用.current?.terminate(), []);

  const 表列表 = ((配置 as any).statistics?.tables ?? []) as 评分表格式[];
  const 键盘 = useAtomValue(键盘原子);
  const 起始mapping = (键盘 as any).mapping as Record<string, any>;
  // 根身份 = string 键位安排 ∪ 数组逐位安排（码位归并把根从 string 改写成数组，仍是根——
  // 增删判定必须按根身份，只认 string 会把"改逐位安排"的根误报成"移除根"）
  const 是根身份 = (v: any) => typeof v === "string" || Array.isArray(v);
  const 起始根集 = new Set(
    Object.keys(起始mapping).filter((k) => 是根身份(起始mapping[k])),
  );

  // 候选预览与搜索池同尺子：形状签名与已有根相同的候选不会入池（如 PUA 变体），
  // 预览必须把这些标出来，否则"看着能加、实际被滤"就是显示与实际脱节
  const 名到字形 = useMemo(() => {
    const m = new Map<string, any>();
    if (字库) {
      for (const { 字符, 字形列表 } of 字库 as any) {
        if (!m.has(字符.获取名称())) m.set(字符.获取名称(), 字形列表?.[0]);
      }
    }
    return m;
  }, [字库]);
  const 签名到已有根 = useMemo(() => {
    const s = new Map<string, string>();
    for (const 名 of Object.keys(起始mapping)) {
      const 签名 = 字形同形键(名到字形.get(名));
      if (签名) s.set(签名, 名);
    }
    return s;
  }, [起始mapping, 名到字形]);
  // 候选名 → 同形的已有根名（无碰撞则 undefined）
  const 同形已有根 = (名: string) => {
    const 签名 = 字形同形键(名到字形.get(名));
    return 签名 ? 签名到已有根.get(签名) : undefined;
  };

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

  // PUA 感知文本：文本里的 PUA 码点（网站自定义字形的字，字体里没有）用字形组件渲染，
  // 其余保持纯文本——用于日志、轨迹、结果块等一切嵌入根名的说明文字
  const 富文本 = (文本: string): ReactNode => {
    if (!文本) return 文本;
    const 匹配 = [...文本.matchAll(/([\uE000-\uF8FF\u{F0000}-\u{FFFFD}\u{100000}-\u{10FFFD}])/gu)];
    if (匹配.length === 0) return 文本;
    const 段: ReactNode[] = [];
    let 光标 = 0;
    for (const m of 匹配) {
      const 起 = m.index!, 码点 = m[1]!;
      if (起 > 光标) 段.push(文本.slice(光标, 起));
      const 字符 = 笔顺索引.名到字符.get(码点);
      段.push(
        字符 ? (
          <CharacterDisplay key={`${起}-${码点}`} character={字符} />
        ) : (
          <span key={`${起}-${码点}`}>{码点}</span>
        ),
      );
      光标 = 起 + 码点.length;
    }
    if (光标 < 文本.length) 段.push(文本.slice(光标));
    return 段;
  };

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
    // 清空上一轮的预置归并提示（解析出问题时再写入，避免旧提示残留）
    设归并失败提示([]);
    // 预置归并解析与校验（条目用中英逗号或换行分隔；空格是码位语法：的 1=人 2）
    const 占位 = 占位安排.trim() || (alphabet[0] ?? "a").repeat(编码类型);
    const 条目 = 预置归并文本
      .split(/[,,，\n]/)
      .map((s: string) => s.trim())
      .filter(Boolean);
    const 预置: { 根: string; 目标: string; 根位?: number; 目标位?: number }[] = [];
    const 已绑定 = new Set<string>();
    const 解归并侧 = (
      s: string,
      条: string,
      序: number,
      侧名: string,
    ): { 名: string; 位: number | null } | null => {
      const ts = s.trim().split(/\s+/).filter(Boolean);
      if (ts.length === 0) {
        设错误(`预置归并第 ${序 + 1} 条（${条}）：${侧名}为空`);
        return null;
      }
      let 位: number | null = null;
      if (ts.length >= 2 && /^\d+$/.test(ts[ts.length - 1]!)) 位 = Number(ts.pop());
      if (ts.length > 1) {
        设错误(
          `预置归并第 ${序 + 1} 条（${条}）：${侧名}「${s.trim()}」元素名不能含空白（空格用于码位语法，如 的 1=人 2）`,
        );
        return null;
      }
      return { 名: ts[0]!, 位 };
    };
    for (let i = 0; i < 条目.length; i++) {
      const 等分 = 条目[i]!.split(/[=＝]/);
      if (等分.length !== 2) {
        设错误(`预置归并第 ${i + 1} 条（${条目[i]}）格式应为「根=目标」或「根 位=目标 位」`);
        return;
      }
      const L = 解归并侧(等分[0]!, 条目[i]!, i, "左边");
      if (!L) return;
      const R = 解归并侧(等分[1]!, 条目[i]!, i, "右边");
      if (!R) return;
      if ((L.位 == null) !== (R.位 == null)) {
        设错误(
          `预置归并第 ${i + 1} 条（${条目[i]}）：码位必须两边都写或都不写，如 的 1=人 2（的的第一码归到人的第二码）或 a=人（整体归并）`,
        );
        return;
      }
      const 根 = L.名;
      const 目标 = R.名;
      if (根 === 目标 && (L.位 == null || L.位 === R.位)) {
        设错误(`预置归并第 ${i + 1} 条：根与目标是同一个（${根}）`);
        return;
      }
      if (已绑定.has(根)) {
        设错误(`预置归并第 ${i + 1} 条：根 ${根} 被绑定了多次（一个根只能归并到一个目标）`);
        return;
      }
      已绑定.add(根);
      预置.push(
        L.位 == null
          ? { 根, 目标 }
          : { 根, 目标, 根位: L.位, 目标位: R.位! },
      );
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
    轮日志引用.current = [];
    快照引用.current = null;
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
          设进度({ 已评: data.已评, 总数: data.总数, 最优: data.最优, 最优分: data.最优分, 变化: data.变化 });
          break;
        case "轮": {
          const 新 = [...轮日志引用.current, data.轮结果];
          轮日志引用.current = 新;
          设轮日志(新);
          if (data.轮结果?.mapping) 快照引用.current = data.轮结果.mapping;
          设进度(null);
          break;
        }
        case "预置归并失败":
          设归并失败提示((旧) => [...旧, data.文本]);
          break;
        case "手动指定问题":
          设归并失败提示((旧) => [...旧, data.文本]);
          break;
        case "完成":
          设结果(data.结果);
          设运行中(false);
          设阶段(data.结果?.备注 ? `搜索完成（${data.结果.备注}）` : "搜索完成");
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
        // 手动指定以原始文本为源（与预置归并一致：框内不格式化、搜索时才解析）；
        // 传给核心前在此把原始文本拆成数组，核心仍按数组消费，语义不变
        字根表列表: 字根表.map((r) =>
          r.类型 === "手动指定" && typeof r.字根 === "string"
            ? { ...r, 字根: r.字根.split(/[,,，\n]/).map((s) => s.trim()).filter(Boolean) }
            : r,
        ),
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

  // 停止 = 立即强杀（搜索同步按整轮跑，等自然停下可能很久，体验上是"停不了"）。
  // 强杀前已从每轮回传的消息里抓包了「最近一轮的 mapping 快照 + 已累积轮日志」，
  // 据此合成部分结果——mapping 只含已完成的轮，正在评的轮还没应用故不计入，
  // 这样「应用到方案」能把已经选好的根落进方案。
  const 停止 = () => {
    const w = worker引用.current;
    w?.postMessage({ type: "stop" });
    if (w) {
      w.terminate();
      worker引用.current = null;
    }
    设运行中(false);
    const 快照 = 快照引用.current;
    const 日志 = 轮日志引用.current;
    if (!结果) {
      设结果({
        mapping: 快照 ?? 起始mapping,
        总分: 日志.length ? 日志[日志.length - 1]!.分数 : 0,
        轮日志: 日志,
        收敛: false,
        已停止: true,
        建议: null,
        备注: 日志.length === 0 ? "停止时尚未完成任何一轮" : undefined,
      });
    }
    设阶段(快照 ? "已手动停止（已选好的根仍可应用）" : "已手动停止（尚未完成任何一轮）");
  };

  // —— 应用与显示共用的单一事实来源：将实际写入方案的 mapping ——
  // （预置归并已是搜索内的普通动作，不再有"建议另有一份 mapping"的口径；轮轨迹含未采用轮）
  const 生效mapping = 结果?.mapping ?? null;

  const 应用 = () => {
    if (!生效mapping) return;
    设配置({ ...配置, form: { ...配置.form, mapping: 生效mapping } } as any);
    message.success("已把结果写入字根映射");
  };

  const 结果直设根 = 生效mapping
    ? Object.keys(生效mapping).filter((k) => typeof 生效mapping[k] === "string")
    : [];
  // diff 按键集比较：任何键的增删都是方案变化——别名条目（{element}，如自动归并相似根的
  // "X→归并→Y"）同样是根身份的获得/失去，只认 string∪数组会把别名增删隐成"无变化"
  const 起始键集 = new Set(Object.keys(起始mapping));
  const 生效键集 = 生效mapping ? new Set(Object.keys(生效mapping)) : new Set<string>();
  const 新增根 = 生效mapping ? [...生效键集].filter((k) => !起始键集.has(k)) : [];
  const 移除项 = 生效mapping ? [...起始键集].filter((k) => !生效键集.has(k)) : [];
  const 连带删除别名 = 移除项.filter((k) => !是根身份(起始mapping[k]));
  const 移除根 = 移除项.filter((k) => 是根身份(起始mapping[k]));
  // 自动归并产生的新根（整体别名 {element} 或借码逐位安排）：安排不是独立键位，
  // 按 2026-10-09 定案写入「安排调整」橙标展示，新增根只显示 +根
  const 新增归并 = 新增根.filter((k) => typeof 生效mapping![k] !== "string");
  const 安排调整 = 生效mapping
    ? [
        ...[...生效键集].filter(
          (k) =>
            起始键集.has(k) &&
            JSON.stringify(起始mapping[k]) !== JSON.stringify(生效mapping![k]),
        ),
        ...新增归并,
      ]
    : [];
  // 新增/移除/安排调整全空 = 相对当前方案无变化 → 应用按钮禁用
  const 无变化 = !!结果 && 新增根.length === 0 && 移除项.length === 0 && 安排调整.length === 0;

  const 改规则 = (i: number, patch: Record<string, any>) =>
    设字根表((x) =>
      x.map((y, j) => (j === i ? ({ ...y, ...patch } as 字根表规则) : y)),
    );

  return (
    <>
      <Typography.Paragraph type="secondary">
        按「开始搜索」后，每轮自动试删、试加字根并显示各表分数变化，自动应用最有利的一步，直到没有改进或达到轮数上限；过程中可随时停止，结果可应用到方案。
        <Popover
          trigger="click"
          content={
            <div style={{ maxWidth: 420 }}>
              算法：算法可操作的空间称为「字根池」，包括所有待加根与当前轮次已在方案内的根。开始后，算法以当前方案的字根映射为起点，以评分表为评判标准，自动枚举「删现有根 /
              加候选字根」两类单步动作，用增量重拆分快速评分（每步只重拆受影响的字），取改进最大的第一个根或前若干根。直到无单步改进。
            </div>
          }
        >
          <InfoCircleOutlined style={{ marginLeft: 6, cursor: "pointer" }} />
        </Popover>
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
                { key: "手动指定", label: "手动指定（标签输入，支持拼音/自定义元素）" },
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
          {字根表.length === 0 && (
            <Typography.Text type="secondary" className="block mb-1">
              暂无规则——不自动加根（删根搜索仍可用）。点上方「+ 添加字根表」创建。
            </Typography.Text>
          )}
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
                {r.类型 === "手动指定" &&
                  渲染收放输入(
                    手动文本[i] ?? (typeof r.字根 === "string" ? r.字根 : r.字根.join("，")),
                    (v) => {
                      设手动文本((t) => ({ ...t, [i]: v }));
                      改规则(i, {
                        字根: v,
                      });
                    },
                    手动收起集.has(i),
                    (收) =>
                      设手动收起集((s) => {
                        const n = new Set(s);
                        if (收) n.add(i);
                        else n.delete(i);
                        return n;
                      }),
                    "输入字根，逗号分隔",
                    手动域引用,
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
                        ? "（自定义，逗号分隔）"
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
                <DeleteButton
                  onClick={() => {
                    设字根表((x) => x.filter((_, j) => j !== i));
                    设手动收起集((s) => new Set([...s].filter((j) => j !== i).map((j) => (j > i ? j - 1 : j))));
                    设手动文本((t) => 重排索引记录(t, i));
                  }}
                />
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
                        共 {状态.结果.根.length} 个候选（灰=已在方案或与已有根同形，同形者不会入池），显示第 {r.根起 ?? 1}~
                        {Math.min(r.根止 ?? 状态.结果.根.length, 状态.结果.根.length)} 名，改范围即时生效：
                      </Typography.Text>
                      <div className="mt-1 flex flex-wrap gap-1 max-h-44 overflow-y-auto items-start">
                        {状态.结果.根
                          .slice((r.根起 ?? 1) - 1, r.根止 ?? 状态.结果.根.length)
                          .map((rk, ri) => {
                            const 同形 = 同形已有根(rk.名);
                            return (
                          <Popover
                            key={ri}
                            trigger="click"
                            content={
                              <div className="max-w-100 max-h-60 overflow-y-auto leading-6 break-all">
                                <div className="font-medium mb-1">
                                  出现于 {rk.字列表.length} 字：
                                </div>
                                {rk.字列表.join("、")}
                                {同形 && (
                                  <div className="text-gray-500 mt-1">
                                    {富文本(`与已有根「${同形}」字形完全相同`)}（形状签名去重），加根搜索不会把它单独入池
                                  </div>
                                )}
                              </div>
                            }
                          >
                            <Tag
                              color={起始mapping[rk.名] === undefined && !同形 ? "purple" : "default"}
                              style={{ cursor: "pointer" }}
                            >
                              {笔顺索引.名到字符.get(rk.名) ? (
                                <CharacterDisplay character={笔顺索引.名到字符.get(rk.名)} />
                              ) : (
                                <span>{rk.名}</span>
                              )}
                              <span className="text-xs ml-1 opacity-70">
                                +{Math.round(rk.得分 * 100) / 100}
                                {同形 ? 富文本(`·与「${同形}」同形`) : ""}
                              </span>
                            </Tag>
                          </Popover>
                            );
                          })}
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
                  // 动态笔画根：与引擎口径一致（名称映射中元素身份为「笔画」者），不写死 '1'-'6'
                  const 笔画根集 = new Set<string>();
                  for (const [名, e] of 名称映射 ?? [])
                    if (e instanceof 笔画) 笔画根集.add(名);
                  const 保护 = 笔画根集;
                  const 已有 = new Set(Object.keys(起始mapping));
                  const 成员: {
                    名: string;
                    标注: string;
                    在方案: boolean;
                    同形?: string;
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
                    const 根列表 =
                      typeof r.字根 === "string"
                        ? r.字根.split(/[,,，\n]/).map((s) => s.trim()).filter(Boolean)
                        : r.字根;
                    const 见过 = new Set<string>();
                    for (const ch of 根列表) {
                      if (保护.has(ch) || 见过.has(ch)) continue;
                      见过.add(ch);
                      const 字符 = 笔顺索引.名到字符.get(ch);
                      const 项 = 状态.按名?.get(ch);
                      const 同形 = 同形已有根(ch);
                      成员.push({
                        名: ch,
                        标注: 字符
                          ? 已有.has(ch)
                            ? "已在方案"
                            : 同形
                              ? `${项?.次数 ?? 0}字·与「${同形}」同形`
                              : `${项?.次数 ?? 0}字`
                          : 名称映射?.has(ch)
                            ? "名称元素"
                            : "不在字库",
                        在方案: 已有.has(ch),
                        同形,
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
                      const 同形 = 同形已有根(w);
                      成员.push({
                        名: w,
                        标注: 同形 ? `频${f}·与「${同形}」同形` : `频${f}`,
                        在方案: 已有.has(w),
                        同形,
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
                      const 同形 = 同形已有根(c.名);
                      成员.push({
                        名: c.名,
                        标注: 同形 ? `${c.次数}字·与「${同形}」同形` : `${c.次数}字`,
                        在方案: 已有.has(c.名),
                        同形,
                        字列表: c.字列表,
                      });
                    }
                  }
                  return (
                    <div className="ml-6 mt-1 max-h-44 overflow-y-auto flex flex-wrap gap-1 items-start bg-gray-50 p-1">
                      <Typography.Text type="secondary" className="w-full!">
                        共 {成员.length} 个候选（灰=已在方案或与已有根同形，同形者不会入池），点字形看它出现在哪些字里：
                      </Typography.Text>
                      {成员.map((m) => (
                        <Popover
                          key={m.名}
                          trigger="click"
                          content={
                            m.同形 && !m.在方案 ? (
                              <div className="text-gray-500">
                                {富文本(`与已有根「${m.同形}」字形完全相同`)}（形状签名去重），加根搜索不会把它单独入池
                              </div>
                            ) : m.字列表 ? (
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
                            ) : m.标注 === "名称元素" ? (
                              <div className="text-gray-500">
                                名称元素（拼音/自定义）：无字形，不参与字内部件字数统计
                              </div>
                            ) : (
                              <div className="text-gray-500">
                                挖掘完成：该字形作为切片出现 0 次（挖不出）
                              </div>
                            )
                          }
                        >
                          <Tag
                            color={
                              m.在方案 || m.同形
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
                            <span className="text-xs ml-1 opacity-70">{富文本(m.标注)}</span>
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
            字根编码
            <Input
              className="w-16! text-center"
              placeholder={(alphabet[0] ?? "a").repeat(编码类型)}
              value={占位安排}
              onChange={(e) => 设占位安排(e.target.value)}
            />
          </Flex>
          <Flex gap={4} align="center" style={{ flex: 1, minWidth: 320 }}>
            <span title="整体归并：大=人（“大”归并入“人”）；码位归并：的 1=人 2（“的”的第一码使用“人”的第二码，根后加空格）条目用中英逗号或换行分隔。注：整体归并是强行归并，始终有效。码位归并时，只有等号右侧的根已存在时，才会考虑将左侧根加入并归并码位。">
              预置归并
            </span>
            {渲染收放输入(
              预置归并文本,
              设预置归并文本,
              归并收起,
              设归并收起,
              "例：a=人，的 1=人 2",
              归并域引用,
            )}
            <Button size="small" onClick={() => 设归并查看(!归并查看)}>
              {归并查看 ? "▾ 收起" : "▸ 查看归并条目"}
            </Button>
          </Flex>
          {归并查看 &&
            (() => {
              const 条目 = 预置归并文本
                .split(/[,,，\n]/)
                .map((s: string) => s.trim())
                .filter(Boolean);
              return (
                <div className="ml-6 mt-1 w-full max-h-44 overflow-y-auto flex flex-wrap gap-1 items-start bg-gray-50 p-1">
                  <Typography.Text type="secondary" className="w-full!">
                    共 {条目.length} 条归并条目（PUA 字根以字形显示）：
                  </Typography.Text>
                  {条目.length === 0 ? (
                    <Typography.Text type="secondary" className="text-xs!">
                      （空——在上面的输入框里写归并条目，如 大=人）
                    </Typography.Text>
                  ) : (
                    条目.map((条: string, i: number) => {
                      const 等分 = 条.split(/[=＝]/);
                      if (等分.length !== 2) return <Tag key={i}>{富文本(条)}</Tag>;
                      const 解侧 = (s: string) => {
                        const ts = s.trim().split(/\s+/).filter(Boolean);
                        let 位: string | null = null;
                        if (ts.length >= 2 && /^\d+$/.test(ts[ts.length - 1]!)) 位 = ts.pop()!;
                        return { 名: ts[0] ?? "", 位 };
                      };
                      const L = 解侧(等分[0]!);
                      const R = 解侧(等分[1]!);
                      const 字形 = (名: string, key: string) => {
                        const 字符 = 笔顺索引.名到字符.get(名);
                        return 字符 ? (
                          <CharacterDisplay key={key} character={字符} />
                        ) : (
                          <span key={key}>{名}</span>
                        );
                      };
                      return (
                        <Tag key={i} style={{ cursor: "default" }}>
                          {字形(L.名, `${i}L`)}
                          {L.位 && <span className="text-xs opacity-70">{L.位}</span>}
                          <span className="opacity-60">=</span>
                          {字形(R.名, `${i}R`)}
                          {R.位 && <span className="text-xs opacity-70">{R.位}</span>}
                        </Tag>
                      );
                    })
                  )}
                </div>
              );
            })()}
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
          message={运行中 ? 富文本(阶段 || "搜索中……") : 富文本(阶段)}
          description={
            运行中 && 进度 ? (
              <>
                <Progress
                  percent={Math.round((进度.已评 / Math.max(进度.总数, 1)) * 100)}
                  size="small"
                />
                <Typography.Text type="secondary">
                  本轮已评 {进度.已评}/{进度.总数}，当前最优 {富文本(进度.最优)}（
                  {进度.变化 != null && isFinite(进度.变化) && (
                    <Typography.Text
                      type={进度.变化 < 0 ? "success" : "danger"}
                      style={{ fontSize: "inherit" }}
                    >
                      {进度.变化 > 0 ? "+" : ""}
                      {Math.round(进度.变化 * 100) / 100}，{" "}
                    </Typography.Text>
                  )}
                  {isFinite(进度.最优分) ? Math.round(进度.最优分 * 100) / 100 : "∞"}）
                </Typography.Text>
              </>
            ) : undefined
          }
        />
      )}
      {归并失败提示.length > 0 && (
        <Alert
          className="mt-2!"
          type="warning"
          showIcon
          message={
            <div>
              {归并失败提示.map((t, i) => (
                <div key={i}>{富文本(t)}</div>
              ))}
            </div>
          }
        />
      )}
      {轮日志.length > 0 && (
        <div className="mt-2 rounded p-2 bg-gray-50">
          <Typography.Text strong>搜索轨迹</Typography.Text>
          <div className="max-h-60 overflow-y-auto">
            {轮日志.map((r, i) => (
              <div key={i}>
                {r.轮 === 0 ? "第零步" : `第${r.轮}轮`} <Tag color={r.轮 === 0 ? "blue" : (r.动作.startsWith("-") ? "red" : "green")}>{富文本(r.动作)}</Tag>
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
        </div>
      )}
      {结果 && (
        <div className="mt-2 rounded p-2 bg-gray-50">
          <Typography.Text strong>
            {(() => {
              const 非零轮 = 结果!.轮日志.filter((r) => r.轮 !== 0);
              // 真正的初态 = 第零步的前分（预置归并前）；末态 = 结果.总分。直接相减得净变化，
              // 绝不计各轮 变化 累加（每个变化已 2 位舍入，累加会累积误差）
              const 初态 = 结果!.轮日志[0]?.前分 ?? 结果!.总分;
              const 净 = 结果!.总分 - 初态;
              // 与搜索轨迹同一套 +/− 与配色：升=＋红(danger)、降=−绿(success)
              const 渲染变化 = (v: number) => (
                <Typography.Text type={v < 0 ? "success" : "danger"}>
                  {v > 0 ? "+" : ""}
                  {Math.round(v * 100) / 100}
                </Typography.Text>
              );
              const 零变化容差 = 0.005;
              return (
                <>
                  最终总分 {结果!.总分}（
                  {Math.abs(净) < 零变化容差 ? "0" : 渲染变化(净)}
                  ，{结果!.收敛 ? "已收敛" : "未收敛"}，共 {非零轮.length} 轮）
                </>
              );
            })()}
          </Typography.Text>
          {结果.收敛 && 结果.轮日志.filter((r) => r.轮 !== 0).length === 0 && (
            <Typography.Text type="secondary" className="mt-1 block">
              无可改进的动作
            </Typography.Text>
          )}
          <div className="mt-1">
            {新增根.length > 0 && (
              <div>
                新增根：
                {新增根.map((k) => (
                  <Tag key={k} color="green">
                    {富文本(`+${k}`)}
                  </Tag>
                ))}
              </div>
            )}
            {移除根.length > 0 && (
              <div>
                移除根：
                {移除根.map((k) => (
                  <Tag key={k} color="red">
                    {富文本(`−${k}`)}
                  </Tag>
                ))}
                {连带删除别名.length > 0 && (
                  <Typography.Text type="secondary" className="ml-2">
                    连带删除别名 {连带删除别名.length} 个：
                    {富文本(连带删除别名.join("、"))}
                  </Typography.Text>
                )}
              </div>
            )}
            {安排调整.length > 0 && (
              <div>
                安排调整：
                {安排调整.map((k) => (
                  <Tag key={k} color="orange">
                    {富文本(根安排描述(k, 生效mapping![k]))}
                  </Tag>
                ))}
                <Typography.Text type="secondary" className="ml-2">
                  （预置归并/自动归并生效后的安排）
                </Typography.Text>
              </div>
            )}
            <Typography.Text type="secondary">
              最终直设根 {结果直设根.length} 个
            </Typography.Text>
          </div>
          <Button
            type="primary"
            className="mt-2!"
            onClick={应用}
            disabled={无变化}
            title={无变化 ? "相对当前方案无变化" : undefined}
          >
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
