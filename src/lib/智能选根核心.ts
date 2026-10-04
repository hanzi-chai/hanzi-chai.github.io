/**
 * 智能选根核心：增量重拆分评分 + 贪心搜索。
 * 评分口径与 方案/选根/增量评分.ts 完全一致（已通过 160 次随机对拍 + 独立实现交叉验证）。
 * 与 CLI 版的差异：基态=当前 mapping（无独立基线 yaml），加/删直接作用于 mapping，
 * 新根安排由参数给出（占位键，不影响元素序列层面的结构统计）。
 * 本文件不含 DOM/fs 依赖，供 Web Worker 与 CLI 校验脚本共用。
 */
import { range } from "lodash-es";
import {
  原始字库,
  构建强类型决策与决策空间,
  决策图,
  组装,
  默认分类器,
  是部件,
  是复合体,
  是强类型归并,
  部件,
  type 组装条目,
  默认退化配置,
  type 退化配置,
} from "../../packages/hanzi-chai/src/main";
import { 构建标准上下文, 装配输入自配置 } from "./标准装配";
import { 阶重序列键, 阶重估计计数, 阶重加增量, 阶重减增量 } from "./阶重统计";

// ---------- 类型 ----------
export interface 评分表输入 {
  name: string;
  weight: number;
  top?: number;
  orders?: number[];
  patterns?: number[][];
}
export interface 挖掘结果项 {
  名: string;
  次数: number;
  字列表: string[];
}

const 挖掘缓存 = new WeakMap<object, Map<string, 挖掘结果项[]>>();

/** 引擎版字内部件挖掘（原名切片挖掘）：按「分析字集中包含该形状的字数」对全字库候选形状排名。
 *  两类候选、两类判定：
 *  - 部件候选（叶部件字形）：在扫描字的叶部件上做引擎切片判定（笔画特征等价 + 拓扑矩阵校验，
 *    支持离散切片；快筛：长度、特征存在位掩码、特征多重集包含）。
 *  - 复合候选（复合体字形，允许复合体=开时参与）：复合体无逐笔几何/拓扑，无法做切片判定，
 *    改按「分析字的字形树中存在分类笔顺完全相同的复合体节点」精确匹配计数（整字与各层复合体均覆盖）。
 *  候选形状 = 全字库各字符的主字形（允许复合体时含复合体字形），单笔画除外（笔画根恒可用）；
 *  同形状按键去重（部#分类串#拓扑 / 复#分类串），取词典频度最高者为代表。
 *  结果按字库对象+模式缓存（WeakMap）。 */
export function 挖掘切片候选(
  字库: any,
  汉字集合: Iterable<any>,
  频率表: Map<string, number>,
  退化器: 退化配置,
  cb?: { on进度?: (已完成: number, 总数: number) => void; 应停止?: () => boolean },
  选项?: { 允许复合体?: boolean },
): 挖掘结果项[] {
  const 允许复合体 = 选项?.允许复合体 === true;
  const 缓存键 = 允许复合体 ? "复合体" : "仅叶部件";
  const cached = 挖掘缓存.get(字库)?.get(缓存键);
  if (cached) return cached;
  const 中止 = () => cb?.应停止?.() === true;

  // 1) 候选形状 = 全字库每字符的主字形，按分类笔顺（部件另加拓扑）去重，取词典频度最高者为代表
  const 形状代表 = new Map<string, { 字形: any; 名: string; 频: number; 复合体: boolean; 分类串: string }>();
  for (const { 字符, 字形列表 } of 字库) {
    const 字形 = 字形列表?.[0];
    if (!字形) continue;
    const 复 = 是复合体(字形);
    if (复 && !允许复合体) continue; // 仅叶部件模式：复合体字形不参与
    const 名 = 字符.获取名称();
    const 分类串 = (字形.获取笔画序列(默认分类器) as unknown as number[]).join("");
    if (分类串.length < 2) continue; // 单笔画 = 笔画根，恒可用
    let 键: string;
    if (复) {
      键 = `复#${分类串}`;
    } else {
      const 拓扑 = (字形 as any)._拓扑();
      const 拓扑签名 = 拓扑?.matrix
        ?.map((行: any[]) => 行.map((关系: any) => (关系?.map?.((r: any) => r.type).join("+") ?? "")).join(",")).join(";");
      键 = `部#${分类串}#${拓扑签名 ?? ""}`;
    }
    const 频 = 频率表.get(名) ?? -1;
    const 旧 = 形状代表.get(键);
    if (!旧 || 频 > 旧.频) 形状代表.set(键, { 字形, 名, 频, 复合体: 复, 分类串 });
  }
  const 部件候选: { 部件: any; 名: string; 计数: Map<string, number>; 掩码: bigint; 长度: number }[] = [];
  const 复合候选: { 名: string; 分类串: string }[] = [];
  for (const { 字形, 名, 复合体: 复, 分类串 } of 形状代表.values()) {
    if (复) {
      复合候选.push({ 名, 分类串 });
      continue;
    }
    const 笔画列表 = (字形 as any)._笔画列表() as { feature: string }[];
    const 计数 = new Map<string, number>();
    for (const { feature } of 笔画列表) 计数.set(feature, (计数.get(feature) ?? 0) + 1);
    部件候选.push({ 部件: 字形, 名, 计数, 掩码: 0n, 长度: 笔画列表.length });
  }
  const 特征全序 = [...new Set(部件候选.flatMap((c) => [...c.计数.keys()]))];
  const 位掩码 = (计数: Map<string, number>) => {
    let m = 0n;
    for (const [i, f] of 特征全序.entries()) if (计数.has(f)) m |= 1n << BigInt(i);
    return m;
  };
  for (const c of 部件候选) c.掩码 = 位掩码(c.计数) as any;

  const 累计 = new Map<string, { 次数: number; 字集: Set<string> }>();
  const 记 = (名: string, 字: string) => {
    let e = 累计.get(名);
    if (!e) { e = { 次数: 0, 字集: new Set<string>() }; 累计.set(名, e); }
    if (!e.字集.has(字)) { e.字集.add(字); e.次数++; }
  };

  // 2a) 复合候选：精确节点匹配（分析字的字形树中存在分类笔顺相同的复合体节点）
  if (允许复合体 && 复合候选.length) {
    const 复合键集 = new Map<string, string>();
    for (const c of 复合候选) 复合键集.set(c.分类串, c.名);
    const 复合命中 = new Map<string, Set<string>>(); // 分类串 → 分析字集
    for (const 字符 of 汉字集合) {
      const 字形 = 字库.查询字形(字符)?.[0];
      if (!字形) continue;
      const 名 = 字符.获取名称();
      const 串集 = new Set<string>();
      const walk = (g: any) => {
        if (是部件(g)) return;
        串集.add((g.获取笔画序列(默认分类器) as unknown as number[]).join(""));
        for (const 子 of g.部分列表 ?? []) walk(子);
      };
      walk(字形);
      for (const 串 of 串集) {
        if (!复合键集.has(串)) continue;
        let e = 复合命中.get(串);
        if (!e) { e = new Set(); 复合命中.set(串, e); }
        e.add(名);
      }
    }
    for (const c of 复合候选) {
      const 字集 = 复合命中.get(c.分类串);
      if (!字集) continue;
      for (const 字 of 字集) 记(c.名, 字);
    }
  }

  // 2b) 扫描字 → 叶部件位置（部件为字库字形对象，跨字共享、天然去重）
  const 叶子字表 = new Map<any, string[]>();
  for (const 字符 of 汉字集合) {
    const 字形 = 字库.查询字形(字符)?.[0];
    if (!字形) continue;
    const 叶子 = new Set<any>();
    const walk = (g: any) => {
      if (是部件(g)) 叶子.add(g);
      else for (const 子 of g.部分列表 ?? []) walk(子);
    };
    walk(字形);
    const 名 = 字符.获取名称();
    for (const L of 叶子) {
      let e = 叶子字表.get(L);
      if (!e) { e = []; 叶子字表.set(L, e); }
      e.push(名);
    }
  }

  // 3) 逐叶子 × 部件候选：快筛 + 引擎切片判定
  const 叶子列表 = [...叶子字表.entries()];
  let 已扫叶子 = 0;
  for (const [L, 字列表] of 叶子列表) {
    if (中止()) {
      // 中止：返回部分结果但不入任何缓存
      return [...累计.entries()]
        .map(([名, { 次数, 字集 }]) => ({ 名, 次数, 字列表: [...字集] }))
        .sort((a, b) => b.次数 - a.次数);
    }
    已扫叶子 += 1;
    // 每 2% 或最后 5 个位置报一次进度——粒度太粗时尾段会长时间静默，看起来像卡死
    if (cb?.on进度 && (已扫叶子 % Math.max(1, Math.ceil(叶子列表.length / 50)) === 0 || 叶子列表.length - 已扫叶子 <= 5))
      cb.on进度(已扫叶子, 叶子列表.length);
    const L笔画 = (L as any)._笔画列表() as { feature: string }[];
    const L计数 = new Map<string, number>();
    for (const { feature } of L笔画) L计数.set(feature, (L计数.get(feature) ?? 0) + 1);
    const L掩码 = 位掩码(L计数);
    const L长 = L笔画.length;
    for (const c of 部件候选) {
      if (c.长度 > L长) continue;
      if ((c.掩码 & ~L掩码) !== 0n) continue;
      let 包含 = true;
      for (const [f, n] of c.计数) if ((L计数.get(f) ?? 0) < n) { 包含 = false; break; }
      if (!包含) continue;
      if ((L as any).生成二进制切片列表(c.部件, 退化器).length === 0) continue;
      for (const w of 字列表) 记(c.名, w);
    }
  }

  const 结果 = [...累计.entries()]
    .map(([名, { 次数, 字集 }]) => ({ 名, 次数, 字列表: [...字集] }))
    .sort((a, b) => b.次数 - a.次数);
  let 层 = 挖掘缓存.get(字库);
  if (!层) { 层 = new Map(); 挖掘缓存.set(字库, 层); }
  层.set(缓存键, 结果);
  return 结果;
}

export interface 重码组信息 {
  表名: string;
  表权重: number;
  空位: number[];
  成员: string[];
  大小: number;
  组分: number;
}
export interface 重码根候选 {
  名: string;
  得分: number;
  字列表: string[];
}

/** 重码组挖掘：
 *  1) 组枚举与伤害排名：对每张表的每个空位模式枚举重码组，组伤害 = 表权重 × n²/2/26^k
 *     （零阶 = ×(n−1)），降序排名；全部组都参与根计分（组起/组止只作用于根排名，不截组）。
 *  2) 根计分（分离收益）：借切片挖掘的「形状 → 可拆字」倒排索引，统计形状在某组内能覆盖的
 *     成员数 m；「把该形状从组中分离出去（m 个成员改拆此形状）」可消除的重码伤害
 *     = 表权重 × [n²−(n−m)²]/2/26^k（零阶 = ×[n(n−1)−(n−m)(n−m−1)]/2），
 *     对全部组求和即形状得分，降序取 [根起, 根止]。全部口径与搜索目标一致。 */
export function 挖掘重码组根(
  词序列: Iterable<[string, { element: string; index: number }[]]>,
  表列表: 评分表输入[],
  maxLength: number,
  根起: number,
  根止: number,
  切片挖掘结果: 挖掘结果项[],
  cb?: { on阶段?: (文本: string) => void },
): { 组: 重码组信息[]; 根: 重码根候选[] } {
  // 1) 组枚举与伤害排名
  const 组全: 重码组信息[] = [];
  const 枚举步数 = 表列表.reduce((a, t) => a + 展开表模式(t).length, 0);
  let 已完成步 = 0;
  for (const t of 表列表) {
    const 模式列表 = 展开表模式(t);
    模式列表.forEach((空位) => {
      cb?.on阶段?.(`重码组挖掘 ${++已完成步}/${枚举步数}……`);
      const 组 = new Map<string, string[]>();
      for (const [名, seq] of 词序列) {
        const 键 = JSON.stringify(
          range(maxLength).map((i) => {
            if (空位.includes(i)) return "*";
            const 码位 = seq[i];
            return 码位 === undefined
              ? "ε"
              : typeof 码位 === "string"
                ? 码位
                : { element: 码位.element, index: 码位.index };
          }),
        );
        let e = 组.get(键);
        if (!e) { e = []; 组.set(键, e); }
        e.push(名);
      }
      const k = 空位.length;
      组.forEach((成员) => {
        const n = 成员.length;
        if (n < 2) return;
        const 组分 = k === 0 ? t.weight * (n - 1) : (t.weight * n * n) / 2 / 26 ** k;
        组全.push({ 表名: t.name, 表权重: t.weight, 空位: [...空位], 成员, 大小: n, 组分 });
      });
    });
  }
  组全.sort((a, b) => b.组分 - a.组分);
  const 组选定 = 组全; // 根计分遍历全部组（伤害大的组自然贡献大）

  // 2) 倒排索引：字 → 能从它拆出的形状（Set 供计分内层的成员判断，数组供遍历）
  const 字到形状 = new Map<string, string[]>();
  const 字到形状集 = new Map<string, Set<string>>();
  for (const 形状 of 切片挖掘结果) {
    for (const 字 of 形状.字列表) {
      let e = 字到形状.get(字);
      if (!e) { e = []; 字到形状.set(字, e); }
      e.push(形状.名);
      let s = 字到形状集.get(字);
      if (!s) { s = new Set(); 字到形状集.set(字, s); }
      s.add(形状.名);
    }
  }

  // 3) 根计分：分离收益（把形状从各组中分离出成员所消除的重码伤害）。
  //    组按组分降序处理，头部全是几百字的大组、最耗时；单遍同时收集每形状的成员数与成员集
  const 根累计 = new Map<string, { 得分: number; 字集: Set<string> }>();
  let 已计分组 = 0;
  const 报告间隔 = Math.max(1, Math.floor(组选定.length / 50));
  for (const g of 组选定) {
    const n = g.大小;
    const k = g.空位.length;
    const 成员形状 = new Map<string, { m: number; 字集: Set<string> }>(); // 形状 → 成员数 + 成员集（一遍收集）
    for (const 字 of g.成员) {
      for (const 形状名 of 字到形状.get(字) ?? []) {
        let e = 成员形状.get(形状名);
        if (!e) { e = { m: 0, 字集: new Set<string>() }; 成员形状.set(形状名, e); }
        e.m += 1;
        e.字集.add(字);
      }
    }
    for (const [形状名, { m, 字集 }] of 成员形状) {
      const 收益 =
        k === 0
          ? g.表权重 * ((n * (n - 1) - (n - m) * (n - m - 1)) / 2)
          : (g.表权重 * (n * n - (n - m) * (n - m))) / 2 / 26 ** k;
      let e = 根累计.get(形状名);
      if (!e) { e = { 得分: 0, 字集: new Set<string>() }; 根累计.set(形状名, e); }
      e.得分 += 收益;
      for (const 字 of 字集) e.字集.add(字);
    }
    if (cb?.on阶段 && ++已计分组 % 报告间隔 === 0)
      cb.on阶段(`重码组挖掘 ${枚举步数 + 已计分组}/${枚举步数 + 组选定.length}……`);
  }
  const 根 = [...根累计.entries()]
    .map(([名, { 得分, 字集 }]) => ({ 名, 得分: Math.round(得分 * 100) / 100, 字列表: [...字集] }))
    .sort((a, b) => b.得分 - a.得分)
    .slice(Math.max(0, 根起 - 1), Math.max(根起 - 1, 根止));

  return { 组: 组选定, 根 };
}

/** 可选字根配置：一条字根表规则
 *  - 字频范围：按词典单字字频排名的 [起, 止] 区间（1 起，含端点）
 *  - 字内部件（内部名 切片挖掘）：按「分析字集中包含该形状的字数」排名的 [起, 止] 区间；
 *    允许复合体（默认开）时形状覆盖整字与各层复合体，否则仅叶部件
 *  - 重码组挖掘：按「把形状从重码组中分离出去可消除的伤害」排名的 [根起, 根止] 区间
 *  - 手动指定：文本逐字即字根（一字符一根），方便从别处整串粘贴 */
export type 字根表规则 =
  | { 类型: "字频范围"; 起: number; 止: number }
  | { 类型: "字内部件"; 起: number; 止: number; 允许复合体?: boolean }
  | { 类型: "重码组挖掘"; 根起: number; 根止: number; 允许复合体?: boolean }
  | { 类型: "手动指定"; 字根: string };
export interface 搜索参数 {
  轮数: number;
  /** 旧版单值（字频 1~N），字根表列表缺省时兜底使用 */
  高频字数?: number;
  /** 可选字根配置：多条字根表规则，并集去重后作为加根候选池 */
  字根表列表?: 字根表规则[];
  占位安排: string;
  保护根: string[];
  表列表: 评分表输入[];
  允许加根?: boolean;
  允许减根?: boolean;
  /** 删除根范围：正则（对根名称匹配）。留空=全部可减；无效正则忽略并记日志 */
  减根范围?: string;
  /** 根数惩罚：以 n（直设根数）为自变量的表达式，如 "max(0, n-150)*50000"；空=不惩罚 */
  根数惩罚?: string;
  /** 加根时，若候选的相似字形分组兄弟已在方案中，自动归并到该根（缺省开启） */
  自动归并相似根?: boolean;
  /** 预置归并：[{根, 目标}]——两者都不占基态键位；目标强制加入候选池，
   *  执行「加目标」动作时，绑定的根自动以 {element: 目标} 随行入映射 */
  预置归并?: { 根: string; 目标: string }[];
}
export interface 轮结果 {
  轮: number;
  动作: string;
  分数: number;
  前分: number;
  变化: number;
  根数: number;
  动作数: number;
  耗时: number;
}
export interface 搜索回调 {
  on阶段?: (文本: string) => void;
  on轮进度?: (已评: number, 总数: number, 最优描述: string, 最优分: number) => void;
  on轮?: (r: 轮结果) => void;
  on日志?: (文本: string) => void;
  应停止?: () => boolean;
}
export interface 搜索结果 {
  mapping: Record<string, any>;
  总分: number;
  轮日志: 轮结果[];
  收敛: boolean;
  已停止: boolean;

  /** 收敛时的下一步建议（未自动应用的最优动作，mapping 为执行后的方案） */
  建议?: { 动作: string; 分数: number; mapping: Record<string, any> } | null;}
interface 变体评分 {
  总分: number;
  表: Record<string, number>;
  字数: number;
  脏字数: number;
}

const combinations = (n: number, k: number): number[][] => {
  const out: number[][] = [];
  const dfs = (s: number, cur: number[]) => {
    if (cur.length === k) return void out.push([...cur]);
    for (let i = s; i < n; i++) dfs(i + 1, [...cur, i]);
  };
  dfs(0, []);
  return out;
};

export class 智能选根核心 {
  配置0: any;
  原始字库: any;
  词典: any;
  过滤词典: any;
  字库: any;
  拼音分析: any;
  汉字集合: Set<any>;
  频率表: Map<string, number>;
  字符对象映射: Map<string, any>;
  名称映射: Map<string, any>;
  /** 合并方案 analysis.classifier 后的分类器（组装取码依赖它，必须与面板/CLI 同口径） */
  分类器: any;
  /** analysis.customize / dynamic_customize 的强类型形式（与 cache.ts 字形分析配置原子同口径），
   *  构造时算一次；不传入字形分析的话，自定义拆分的字会按默认规则重拆，分数与面板对不上 */
  自定义分析: { 自定义分析映射: Map<any, any>; 动态自定义分析映射: Map<any, any> };
  父映射 = new Map<any, Set<any>>();
  按频词序: string[];
  词全集: Set<string>;
  域缓存 = new Map<number, Set<string>>();
  表配置: { 名: string; 权重: number; top: number | undefined; 模式: number[][] }[];

  constructor(
    配置: any,
    原始词典: { 词: string; 拼音: string[]; 频率: number }[],
    内置字库数据: any[],
  ) {
    this.配置0 = 配置;
    // 字库 = 内置字形库 + 用户方案字库（与 CLI 获取原始字库 同口径）
    const 原始字库实例 = new 原始字库([
      ...内置字库数据,
      ...Object.values(配置.data?.repertoire ?? {}),
    ]);
    this.原始字库 = 原始字库实例;
    // 映射无关装配全部走 标准装配.ts（与网页手动分析、CLI 评分同一配方，见其头注释）
    const 上下文 = 构建标准上下文(装配输入自配置(配置, 原始词典 as any, 原始字库实例));
    if (!上下文.字库 || !上下文.名称映射) throw 上下文.字库错误 ?? new Error("字库构建失败");
    this.词典 = 上下文.词典;
    this.过滤词典 = 上下文.过滤词典;
    this.字库 = 上下文.字库;
    this.拼音分析 = 上下文.拼音分析;
    this.名称映射 = 上下文.名称映射;
    this.汉字集合 = 上下文.汉字集合;
    this.分类器 = 上下文.分类器;
    this.自定义分析 = {
      自定义分析映射: 上下文.自定义分析映射,
      动态自定义分析映射: 上下文.动态自定义分析映射,
    };
    this.频率表 = new Map(原始词典.map((d) => [d.词, d.频率]));
    this.字符对象映射 = new Map([...this.汉字集合].map((c) => [c.获取名称(), c]));
    // 字形组合反向图：子字形 → 父复合体（结构静态，与根集无关）
    for (const 字符 of this.汉字集合) {
      const 递归 = (g: any) => {
        if (是部件(g)) return;
        for (const 子 of g.部分列表) {
          if (!this.父映射.has(子)) this.父映射.set(子, new Set());
          this.父映射.get(子)!.add(g);
          递归(子);
        }
      };
      for (const g of this.字库.查询字形(字符) ?? []) 递归(g);
    }
    this.按频词序 = [...this.频率表.entries()]
      .filter(([w]) => [...w].length === 1)
      .sort((a, b) => b[1] - a[1])
      .map(([w]) => w);
    this.词全集 = new Set(this.按频词序);
    this.表配置 = (配置.statistics?.tables ?? []).map((t: any) => ({
      名: t.name as string,
      权重: t.weight as number,
      top: t.top as number | undefined,
      模式: 展开表模式(t),
    }));
  }

  // ---------- mapping 变换 ----------
  /** 应用加/删并级联别名（引用根不全的别名条目失效） */
  变体mapping(基: Record<string, any>, 加: string[], 删: string[], 占位 = "aa"): Record<string, any> {
    const m: Record<string, any> = { ...基 };
    for (const r of 删 ?? []) delete m[r];
    for (const r of 加 ?? []) if (!(r in m)) m[r] = 占位;
    const 直 = new Set(Object.keys(m).filter((k) => typeof m[k] === "string"));
    for (const k of Object.keys(m)) {
      const v = m[k];
      if (typeof v === "string") continue;
      const refs = new Set<string>();
      收集引用(v, refs);
      if (![...refs].every((r) => 直.has(r))) delete m[k];
    }
    return m;
  }

  // ---------- 流水线 ----------
  建决策(mapping: Record<string, any>) {
    const 强 = 构建强类型决策与决策空间(
      mapping as any,
      this.配置0.form.mapping_space ?? {},
      this.名称映射,
    );
    const 线性化 = new 决策图(强.决策).线性化();
    if (!线性化.ok) throw 线性化.error;
    return { 强, 线性化: 线性化.value };
  }
  建准备(强: any, 线性化: any) {
    return (this.字库 as any).准备分析(
      {
        分析配置: this.配置0.analysis ?? {},
        决策: 强.决策,
        决策空间: 强.决策空间,
        线性化决策: 线性化,
        自定义分析映射: this.自定义分析.自定义分析映射,
        动态自定义分析映射: this.自定义分析.动态自定义分析映射,
        字形来源列表: (this.配置0.data?.glyph_sources ?? ["G"]) as any[],
      },
      this.汉字集合,
    );
  }
  全量分析(mapping: Record<string, any>) {
    const { 强, 线性化 } = this.建决策(mapping);
    const 准备 = this.建准备(强, 线性化);
    if (!准备.ok) throw 准备.error;
    const 部件分析结果 = new Map<any, any>();
    for (const 部件 of 准备.value.待分析部件集合) {
      const a = 准备.value.部件分析器.分析(部件);
      if (!a.ok) throw a.error;
      部件分析结果.set(部件, a.value);
    }
    准备.value.复合体分析器.部件分析结果 = 部件分析结果;
    const 分析结果 = new Map<any, any[]>();
    for (const 字符 of this.汉字集合) {
      const 列表: any[] = [];
      for (const 字形 of this.字库.查询字形(字符) ?? []) {
        if (是部件(字形)) {
          列表.push(部件分析结果.get(字形)!);
        } else {
          const a = 准备.value.复合体分析器.分析(字形);
          if (!a.ok) throw a.error;
          列表.push(a.value);
        }
      }
      分析结果.set(字符, 列表);
    }
    for (const [部件, 分析] of 部件分析结果) {
      if (!this.汉字集合.has(部件.字符)) {
        分析结果.set(部件.字符, (分析结果.get(部件.字符) ?? []).concat([分析]));
      }
    }
    return { 强, 线性化, 准备: 准备.value, 分析结果, 部件分析结果 };
  }
  条目提取(r: { value: 组装条目[] }, 决策?: Map<any, any>) {
    // 一字多条目全部保留：多音字/多字形字在面板与统计一里逐条参与分组，
    // 在这里去重会让自动搜索的分母与手动分析不一致（词库里多音字越多差得越大）
    const out = new Map<string, { 元素序列: { element: string; index: number }[]; 频率: number }[]>();
    for (const 条目 of r.value) {
      const 词 = 条目.词.map((c: any) => c.获取名称()).join("");
      if ([...词].length !== 1) continue;
      const 元素序列 = (条目.元素序列.元素序列 as any[]).map((c) => {
        let cur: any = c;
        if (typeof cur !== "string" && 决策) {
          for (let t = 0; t < 100; t++) {
            const 安排 = 决策.get(cur.element);
            if (!安排) break;
            if (是强类型归并(安排)) {
              cur = { ...cur, element: 安排.element };
            } else if (Array.isArray(安排)) {
              const 引 = 安排[cur.index ?? 0];
              if (引 === undefined || typeof 引 === "string") break;
              cur = 引;
            } else break;
          }
        }
        return {
          element: typeof cur === "string" ? cur : cur.element.获取名称(),
          index: cur.index ?? 0,
        };
      });
      const 列表 = out.get(词);
      if (列表) 列表.push({ 元素序列, 频率: 条目.频率 });
      else out.set(词, [{ 元素序列, 频率: 条目.频率 }]);
    }
    return out;
  }
  运行组装(mapping: Record<string, any>, 强: any, 线性化: any, 分析结果: Map<any, any>, 字根部件列表: any[]) {
    return 组装(
      {
        源映射: this.配置0.encoder.sources,
        条件映射: this.配置0.encoder.conditions,
        线性化决策: 线性化,
        组装器: undefined,
        构词规则列表: this.配置0.encoder.rules ?? [],
        最大码长: this.配置0.encoder.max_length,
        键盘配置: { ...this.配置0.form, mapping },
        自定义分析映射: new Map(),
        决策: 强.决策,
        决策空间: 强.决策空间,
        分类器: this.分类器,
      },
      this.拼音分析,
      { 分析结果, 字根部件列表 },
    );
  }

  // ---------- 计分 ----------
  取域(top: number | undefined) {
    const key = top ?? 0;
    if (!this.域缓存.has(key))
      this.域缓存.set(key, new Set(top && top > 0 ? this.按频词序.slice(0, top) : this.按频词序));
    return this.域缓存.get(key)!;
  }
  全量计分(词条: Map<string, { 元素序列: { element: string; index: number }[]; 频率: number }[]>) {
    const 表值: Record<string, number> = {};
    let 总分 = 0;
    for (const t of this.表配置) {
      let v = 0;
      if (t.top) {
        const 切片 = this.平铺排序(词条).slice(0, t.top);
        for (const 空位 of t.模式) {
          const 组 = new Map<string, number>();
          for (const { j } of 切片) {
            const 键 = 阶重序列键(JSON.parse(j), 空位, 4);
            组.set(键, (组.get(键) ?? 0) + 1);
          }
          v += 阶重估计计数(组, 空位, 26);
        }
      } else {
        const 域 = this.取域(t.top);
        for (const 空位 of t.模式) {
          const 组 = new Map<string, number>();
          for (const w of this.按频词序) {
            if (!域.has(w)) continue;
            const 列表 = 词条.get(w);
            if (!列表) continue;
            for (const { 元素序列 } of 列表) {
              const 键 = 阶重序列键(元素序列, 空位, 4);
              组.set(键, (组.get(键) ?? 0) + 1);
            }
          }
          v += 阶重估计计数(组, 空位, 26);
        }
      }
      表值[t.名] = Math.round(v * 100) / 100;
      总分 += t.权重 * v;
    }
    return { 总分: Math.round(总分 * 100) / 100, 表值 };
  }

  // ---------- 基态与增量 ----------
  基态mapping!: Record<string, any>;
  基态分析结果!: Map<any, any[]>;
  基态部件分析结果!: Map<any, any>;
  基态退化配置!: any;
  基态待分析部件!: Set<any>;
  基态根列表!: any[];
  基态词序列!: Map<string, string[]>;
  /** 基态词条（含组装条目频率）；top>0 表的逐条目切片口径要用 */
  基态词条!: Map<string, { 元素序列: { element: string; index: number }[]; 频率: number }[]>;
  基态平铺!: { j: string; 频率: number }[];
  表组!: { 名: string; 组: Map<string, number>[]; 值: number }[];
  总分基 = 0;

  /** 条目级平铺并按组装频率降序稳定排序——与手动分析面板的 分组按模式 切片完全同序。
   *  top>0 表是逐条目口径：多音字的多条序列各自占排名位（官方编码页同款，不合并）。 */
  private 平铺排序(词条: Map<string, { 元素序列: { element: string; index: number }[]; 频率: number }[]>) {
    const 平铺: { j: string; 频率: number }[] = [];
    // 大词库同一字可能占多行（多音），组装侧已按 词+序列 合并频率；这里每字只取一次，
    // 首次出现位置 = 组装条目顺序，与面板的排序底序完全一致
    const 已见 = new Set<string>();
    for (const { 词 } of this.过滤词典) {
      // 过滤词典的 词 是字符数组，词条表以名称字符串为键
      const 名 = 词.map((c: any) => c.获取名称()).join("");
      if (已见.has(名)) continue;
      已见.add(名);
      const 列表 = 词条.get(名);
      if (!列表) continue;
      for (const x of 列表) 平铺.push({ j: JSON.stringify(x.元素序列), 频率: x.频率 });
    }
    return 平铺.sort((a, b) => b.频率 - a.频率);
  }

  设置基态(mapping: Record<string, any>) {
    this.基态mapping = mapping;
    const { 强, 线性化, 准备, 分析结果, 部件分析结果 } = this.全量分析(mapping);
    this.基态分析结果 = 分析结果;
    this.基态部件分析结果 = 部件分析结果;
    this.基态退化配置 = (准备.复合体分析器 as any).配置.退化配置;
    this.基态待分析部件 = 准备.待分析部件集合;
    this.基态根列表 = 准备.字根部件列表 as any[];
    const r = this.运行组装(mapping, 强, 线性化, 分析结果, 准备.字根部件列表);
    if (!r.ok) throw r.error;
    const 词条 = this.条目提取(r, 强.决策);
    this.基态词条 = 词条;
    this.基态词序列 = new Map([...词条].map(([w, 列表]) => [w, 列表.map((x) => JSON.stringify(x.元素序列))]));
    this.基态平铺 = this.平铺排序(词条);
    this.表组 = this.表配置.map((t) => ({ 名: t.名, 组: t.模式.map(() => new Map<string, number>()), 值: 0 }));
    let 总分 = 0;
    for (const [ti, t] of this.表配置.entries()) {
      let v = 0;
      if (t.top) {
        // top>0：逐条目口径——按组装频率排序取前 N 条（多音字各序列独立占位，官方编码页同款）
        const 切片 = this.基态平铺.slice(0, t.top);
        t.模式.forEach((空位, pi) => {
          const 组 = this.表组[ti]!.组[pi]!;
          for (const { j } of 切片) {
            const 键 = 阶重序列键(JSON.parse(j), 空位, 4);
            const m = 组.get(键) ?? 0;
            v += 阶重加增量(空位.length, m);
            组.set(键, m + 1);
          }
        });
      } else {
        const 域 = this.取域(t.top);
        for (const w of this.按频词序) {
          if (!域.has(w)) continue;
          const 列表 = this.基态词序列.get(w);
          if (!列表) continue;
          for (const seqJson of 列表) {
            const seq = JSON.parse(seqJson);
            t.模式.forEach((空位, pi) => {
              const 键 = 阶重序列键(seq, 空位, 4);
              const 组 = this.表组[ti]!.组[pi]!;
              const m = 组.get(键) ?? 0;
              v += 阶重加增量(空位.length, m);
              组.set(键, m + 1);
            });
          }
        }
      }
      this.表组[ti]!.值 = v;
      总分 += t.权重 * v;
    }
    this.总分基 = 总分; // 裸分；罚分只在搜索比较点叠加，避免增量路径重复计费
  }

  根数惩罚?: string;
  private 罚分缓存?: { 源: string; 函数: (...a: any[]) => number };
  /** 根数惩罚：n=直设根数（mapping 中字符串值的键数），套用用户表达式；非法表达式按 0 处理 */
  根数罚分(m: Record<string, any>): number {
    const 源 = (this.根数惩罚 ?? "").trim();
    if (!源) return 0;
    if (!this.罚分缓存 || this.罚分缓存.源 !== 源) {
      try {
        const 函数 = new Function("n", "max", "min", `"use strict"; return (${源});`) as (...a: any[]) => number;
        函数(0, Math.max, Math.min); // 试编译+试运行
        this.罚分缓存 = { 源, 函数 };
      } catch {
        this.罚分缓存 = { 源, 函数: () => 0 };
      }
    }
    const 根数 = Object.values(m).filter((v) => typeof v === "string").length;
    let 值 = 0;
    try {
      值 = this.罚分缓存.函数(根数, Math.max, Math.min);
    } catch {
      return 0;
    }
    return typeof 值 === "number" && isFinite(值) ? 值 : 0;
  }

  /** 变体评分（增量）：mapping 相对基态mapping 的差异自动求出 */
  评变体(mapping: Record<string, any>): 变体评分 | { 失败: string } {
    const 变化根 = 差异根(this.基态mapping, mapping);
    const 无变化 = 变化根.size === 0;
    let 强: any, 线性化: any, 准备: any;
    try {
      ({ 强, 线性化 } = this.建决策(mapping));
      准备 = this.建准备(强, 线性化);
      if (!准备.ok) return { 失败: String(准备.error) };
    } catch (e) {
      return { 失败: String(e) };
    }
    const 脏部件 = new Set<any>();
    if (!无变化) {
      const 变体根 = 准备.value.字根部件列表 as any[];
      const 根表示列表: any[][] = [];
      for (const X of 变化根) {
        const seen = new Set<any>();
        根表示列表.push(
          [...this.基态根列表, ...变体根].filter((p: any) => {
            if (p.字符?.获取名称?.() !== X) return false;
            if (seen.has(p)) return false;
            seen.add(p);
            return true;
          }),
        );
      }
      for (const C of this.基态待分析部件) {
        for (const reps of 根表示列表) {
          for (const R of reps) {
            if (C === R || C.生成二进制切片列表(R, this.基态退化配置).length) {
              脏部件.add(C);
              break;
            }
          }
          if (脏部件.has(C)) break;
        }
      }
    }
    const 脏字形 = new Set<any>(脏部件);
    if (!无变化) {
      const 变体根 = 准备.value.字根部件列表 as any[];
      for (const X of 变化根) {
        const 任一 = [...this.基态根列表, ...变体根].find((p: any) => p.字符?.获取名称?.() === X);
        if (!任一) continue;
        for (const g of this.字库.查询字形(任一.字符) ?? []) 脏字形.add(g);
      }
    }
    const 队列 = [...脏字形];
    while (队列.length) {
      const g = 队列.pop()!;
      for (const 父 of this.父映射.get(g) ?? []) {
        if (!脏字形.has(父)) { 脏字形.add(父); 队列.push(父); }
      }
    }
    const 脏字符 = new Set<string>();
    for (const g of 脏字形) 脏字符.add(g.字符.获取名称());
    const 新部件分析结果 = new Map(this.基态部件分析结果);
    const 替换表 = new Map<any, any>();
    for (const C of 脏部件) {
      const a = 准备.value.部件分析器.分析(C);
      if (!a.ok) return { 失败: `${C.字符.获取名称()}: ${String(a.error)}` };
      新部件分析结果.set(C, a.value);
      const 旧 = this.基态部件分析结果.get(C);
      if (旧) 替换表.set(旧, a.value);
    }
    准备.value.复合体分析器.部件分析结果 = 新部件分析结果;
    const 新分析结果 = new Map(this.基态分析结果);
    for (const w of 脏字符) {
      const 字符对象 = this.字符对象映射.get(w);
      if (字符对象 === undefined) continue;
      const 列表: any[] = [];
      for (const 字形 of this.字库.查询字形(字符对象) ?? []) {
        if (是部件(字形)) {
          列表.push(新部件分析结果.get(字形)!);
        } else {
          const a = 准备.value.复合体分析器.分析(字形);
          if (!a.ok) return { 失败: `${w}: ${String(a.error)}` };
          列表.push(a.value);
        }
      }
      新分析结果.set(字符对象, 列表);
    }
    if (替换表.size) {
      for (const [字符对象, 列表] of 新分析结果) {
        if (this.汉字集合.has(字符对象)) continue;
        let 变了 = false;
        const 新列表 = 列表.map((a) => {
          const r2 = 替换表.get(a);
          if (r2) { 变了 = true; return r2; }
          return a;
        });
        if (变了) 新分析结果.set(字符对象, 新列表);
      }
    }
    const r = this.运行组装(mapping, 强, 线性化, 新分析结果, 准备.value.字根部件列表);
    if (!r.ok) return { 失败: String(r.error) };
    const 新词条 = this.条目提取(r, 强.决策);
    const 组副本 = this.表组.map((t) => ({ 名: t.名, 组: t.组.map((g) => new Map(g)), 值: t.值 }));
    let 总分 = this.总分基;
    let 脏字数 = 0;
    for (const [w, 新列表] of 新词条) {
      // 新旧序列多重集对比：多音字/多字形字一个词可有多条序列，每条都独立参与分组
      const 差 = new Map<string, number>();
      for (const j of this.基态词序列.get(w) ?? []) 差.set(j, (差.get(j) ?? 0) - 1);
      for (const x of 新列表) {
        const j = JSON.stringify(x.元素序列);
        差.set(j, (差.get(j) ?? 0) + 1);
      }
      let 变了 = false;
      for (const 变化量 of 差.values()) if (变化量 !== 0) { 变了 = true; break; }
      if (!变了) continue;
      脏字数++;
      for (const [ti, t] of this.表配置.entries()) {
        if (t.top) continue; // top>0 是逐条目切片口径，由下方平铺差分统一处理
        const 表副本 = 组副本[ti]!;
        t.模式.forEach((空位, pi) => {
          const 组 = 表副本.组[pi]!;
          for (const [j, 变化量] of 差) {
            if (变化量 === 0) continue;
            const seq = JSON.parse(j);
            const 键 = 阶重序列键(seq, 空位, 4);
            if (变化量 < 0) {
              for (let k = 0; k < -变化量; k++) {
                const n = 组.get(键) ?? 0;
                表副本.值 += 阶重减增量(空位.length, n);
                if (n <= 1) 组.delete(键); else 组.set(键, n - 1);
              }
            } else {
              for (let k = 0; k < 变化量; k++) {
                const m = 组.get(键) ?? 0;
                表副本.值 += 阶重加增量(空位.length, m);
                组.set(键, m + 1);
              }
            }
          }
        });
      }
    }
    // 变体中拆分无解而被丢弃的字：基态有条目、新组装没有——必须扣掉它们的全部旧贡献，
    // 否则增量分系统性高于全量分（删根的收益会被低估，搜索决策随之失真）
    for (const [w, 旧列表] of this.基态词序列) {
      if (新词条.has(w)) continue;
      脏字数++;
      for (const [ti, t] of this.表配置.entries()) {
        if (t.top) continue; // 同上，top>0 由平铺差分处理
        const 表副本 = 组副本[ti]!;
        t.模式.forEach((空位, pi) => {
          const 组 = 表副本.组[pi]!;
          for (const j of 旧列表) {
            const 键 = 阶重序列键(JSON.parse(j), 空位, 4);
            const n = 组.get(键) ?? 0;
            表副本.值 += 阶重减增量(空位.length, n);
            if (n <= 1) 组.delete(键); else 组.set(键, n - 1);
          }
        });
      }
    }
    // top>0 表：逐条目切片差分——基态切片 vs 变体切片按序列多重集求差。
    // 词频不随加删根变化，切片顺序稳定，条目进出与序列变化都能被这层差分精确覆盖
    const 变体平铺 = this.平铺排序(新词条);
    for (const [ti, t] of this.表配置.entries()) {
      if (!t.top) continue;
      const 基计数 = new Map<string, number>();
      for (const { j } of this.基态平铺.slice(0, t.top))
        基计数.set(j, (基计数.get(j) ?? 0) + 1);
      const 变计数 = new Map<string, number>();
      for (const { j } of 变体平铺.slice(0, t.top))
        变计数.set(j, (变计数.get(j) ?? 0) + 1);
      const 差 = new Map<string, number>();
      for (const [j, n] of 基计数) 差.set(j, (差.get(j) ?? 0) - n);
      for (const [j, n] of 变计数) 差.set(j, (差.get(j) ?? 0) + n);
      const 表副本 = 组副本[ti]!;
      t.模式.forEach((空位, pi) => {
        const 组 = 表副本.组[pi]!;
        for (const [j, 变化量] of 差) {
          if (变化量 === 0) continue;
          const seq = JSON.parse(j);
          const 键 = 阶重序列键(seq, 空位, 4);
          if (变化量 < 0) {
            for (let k = 0; k < -变化量; k++) {
              const n = 组.get(键) ?? 0;
              表副本.值 += 阶重减增量(空位.length, n);
              if (n <= 1) 组.delete(键); else 组.set(键, n - 1);
            }
          } else {
            for (let k = 0; k < 变化量; k++) {
              const m = 组.get(键) ?? 0;
              表副本.值 += 阶重加增量(空位.length, m);
              组.set(键, m + 1);
            }
          }
        }
      });
    }
    for (const [ti, t] of this.表配置.entries())
      总分 += t.权重 * (组副本[ti]!.值 - this.表组[ti]!.值);
    const 表值: Record<string, number> = {};
    for (const g of 组副本) 表值[g.名] = Math.round(g.值 * 100) / 100;
    return { 总分: Math.round(总分 * 100) / 100, 表: 表值, 字数: 新词条.size, 脏字数 };
  }

  // ---------- 切片挖掘 ----------
  private 切片挖掘缓存: { 允许复合体: boolean; 结果: 挖掘结果项[] } | null = null;

  /** 挖掘全部潜在根形状（引擎版，结果按实例+模式缓存）。允许复合体：默认 false（仅叶部件） */
  挖掘切片候选(
    cb?: { on进度?: (已完成: number, 总数: number) => void; 应停止?: () => boolean },
    允许复合体 = false,
  ): 挖掘结果项[] {
    if (this.切片挖掘缓存?.允许复合体 === 允许复合体) return this.切片挖掘缓存.结果;
    const 退化器: 退化配置 = (this.配置0.analysis as any)?.degenerator ?? 默认退化配置;
    const 结果 = 挖掘切片候选(this.字库, this.汉字集合, this.频率表, 退化器, cb, { 允许复合体 });
    if (!(cb?.应停止?.() ?? false)) this.切片挖掘缓存 = { 允许复合体, 结果 }; // 中止的半成品不入缓存
    return 结果;
  }

  /** 重码组挖掘：基于当前基态词序列 + 字内部件挖掘缓存。组按伤害降序、全部参与根计分；
   *  根按「从组中分离出的收益」（可消除的重码伤害）降序取 [根起, 根止] */
  重码组挖掘(
    表列表: 评分表输入[],
    根起: number,
    根止: number,
    cb?: { 应停止?: () => boolean; on阶段?: (文本: string) => void },
    允许复合体 = false,
  ): { 组: 重码组信息[]; 根: 重码根候选[] } {
    const 词序列: [string, { element: string; index: number }[]][] = [];
    for (const [名, 列表] of this.基态词序列)
      for (const j of 列表) 词序列.push([名, JSON.parse(j)]);
    const 挖掘结果 = this.挖掘切片候选(cb, 允许复合体);
    return 挖掘重码组根(词序列, 表列表, 4, 根起, 根止, 挖掘结果, cb);
  }

  // ---------- 贪心搜索 ----------
  搜索(起始mapping: Record<string, any>, 参数: 搜索参数, cb: 搜索回调 = {}): 搜索结果 {
    const 占位 =
      参数.占位安排 ||
      (this.配置0.form.alphabet?.[0] ?? "a").repeat(this.配置0.form.mapping_type ?? 2);
    // 候选池：按「可选字根配置」的字根表规则并集去重（有字形、非保护根）
    const 保护 = new Set(参数.保护根 ?? ["1", "2", "3", "4", "5", "6"]);
    const 规则列表 =
      参数.字根表列表 ??
      [{ 类型: "字频范围" as const, 起: 1, 止: 参数.高频字数 ?? 200 }];
    const 允许加根总开关 = 参数.允许加根 !== false;
    const 按频单字 = 允许加根总开关
      ? [...this.频率表.entries()].filter(([w]) => [...w].length === 1).sort((a, b) => b[1] - a[1])
      : [];
    const 池Set = new Set<string>();
    // 预置归并：绑定的根从基态摘除（不占键位），目标稍后强制入池
    const 预置归并表 = 参数.预置归并 ?? [];
    const 预置根集 = new Set(预置归并表.map((x) => x.根));
    const 预置目标到根 = new Map<string, string[]>();
    for (const { 根, 目标 } of 预置归并表) {
      const e = 预置目标到根.get(目标) ?? [];
      e.push(根);
      预置目标到根.set(目标, e);
    }
    const 起始去预置 = { ...起始mapping };
    for (const 根 of 预置根集) delete 起始去预置[根];
    // 目标已在基态映射中：绑定根在起点立即随行（否则「加目标」动作不会出现，绑定永不生效）
    for (const [目标, 根s] of 预置目标到根) {
      if (起始去预置[目标] !== undefined) {
        for (const 根 of 根s) 起始去预置[根] = { element: 目标 }; // 真归并
      }
    }
    const 已有根 = new Set(Object.keys(起始mapping));
    this.根数惩罚 = 参数.根数惩罚;
    this.设置基态(起始去预置); // 必须在候选池之前：重码组挖掘规则需要基态词序列
    for (const 规则 of 规则列表) {
      if (规则.类型 === "重码组挖掘") {
        const { 根: 组根 } = this.重码组挖掘(参数.表列表, 规则.根起, 规则.根止, { 应停止: () => cb.应停止?.() ?? false, on阶段: (文本) => cb.on阶段?.(文本) }, 规则.允许复合体 !== false);
        for (let i = 规则.根起 - 1; i < Math.min(规则.根止, 组根.length); i++) {
          const 名 = 组根[i]!.名;
          if (保护.has(名) || 已有根.has(名)) continue;
          池Set.add(名);
        }
        continue;
      }
      if (规则.类型 === "字频范围") {
        const 起 = Math.max(1, Math.floor(规则.起));
        const 止 = Math.max(起, Math.floor(规则.止));
        for (let i = 起 - 1; i < Math.min(止, 按频单字.length); i++) {
          const w = 按频单字[i]![0];
          if (保护.has(w)) continue;
          if (this.字库.查询字形(this.字符对象映射.get(w))?.length === 0) continue;
          池Set.add(w);
        }
      } else if (规则.类型 === "字内部件") {
        const 起 = Math.max(1, Math.floor(规则.起));
        const 止 = Math.max(起, Math.floor(规则.止));
        const 候选 = this.挖掘切片候选(
          {
            on进度: (已完成, 总数) => cb.on阶段?.(`字内部件扫描 ${已完成}/${总数} 位置……`),
            应停止: () => cb.应停止?.() ?? false,
          },
          规则.允许复合体 !== false,
        );
        cb.on阶段?.(`字内部件扫描完成（${候选.length} 个形状），构建候选池……`);
        for (let i = 起 - 1; i < Math.min(止, 候选.length); i++) {
          const 名 = 候选[i]!.名;
          if (保护.has(名) || 已有根.has(名)) continue;
          池Set.add(名);
        }
      } else if (规则.类型 === "手动指定") {
        for (const w of [...规则.字根]) {
          if (保护.has(w) || 已有根.has(w)) continue;
          const 字符对象 = this.字符对象映射.get(w);
          if (!字符对象 || this.字库.查询字形(字符对象)?.length === 0) {
            cb.on日志?.(`手动指定字根「${w}」不在字库或无字形，已跳过`);
            continue;
          }
          池Set.add(w);
        }
      }
    }
    if (cb.应停止?.()) {
      return { mapping: { ...起始mapping }, 总分: Math.round(this.总分基 * 100) / 100, 轮日志: [], 收敛: false, 已停止: true, 建议: null };
    }
    let mapping = { ...起始去预置 };

    // 形状签名去重：与已有根（含别名）同形状+同拓扑的字形不是新根（如 ⼆/二/PUA 变体）
    const 名到字形 = new Map<string, any>();
    for (const { 字符, 字形列表 } of this.字库 as any) {
      if (!名到字形.has(字符.获取名称())) 名到字形.set(字符.获取名称(), 字形列表?.[0]);
    }
    const 形状签名 = (字形: any) => {
      if (!字形 || !是部件(字形)) return null;
      const 分类串 = (字形.获取笔画序列(默认分类器) as unknown as number[]).join("");
      const 拓扑 = (字形 as any)._拓扑();
      const 拓扑签名 = 拓扑?.matrix
        ?.map((行: any[]) => 行.map((关系: any) => (关系?.map?.((r: any) => r.type).join("+") ?? "")).join(","))
        .join(";");
      return `${分类串}#${拓扑签名 ?? ""}`;
    };
    const 已有签名 = new Set<string>();
    for (const 名 of Object.keys(mapping)) {
      const 签名 = 形状签名(名到字形.get(名));
      if (签名) 已有签名.add(签名);
    }
    // 预置归并：目标强制入池（即使不在任何字根表规则里）
    for (const 目标 of 预置目标到根.keys()) {
      if (!已有根.has(目标) && !保护.has(目标)) 池Set.add(目标);
    }
    const 池: string[] = 允许加根总开关
      ? [...池Set].filter((w) => {
          if (预置根集.has(w)) return false; // 绑定根不作为独立候选
          const 签名 = 形状签名(名到字形.get(w));
          return !签名 || !已有签名.has(签名);
        })
      : [];
    if (允许加根总开关) cb.on日志?.(`候选池 ${池.length} 个（${规则列表.length} 条字根表规则，已按形状去重）`);
    let 当前分 = this.总分基 + this.根数罚分(起始mapping);
    const 轮日志: 轮结果[] = [];
    let 收敛 = false, 已停止 = false;
    let 建议动作: { 动作: string; 分数: number; mapping: Record<string, any> } | null = null;
    for (let 轮 = 1; 轮 <= 参数.轮数; 轮++) {
      if (cb.应停止?.()) { 已停止 = true; break; }
      const 直设根 = Object.keys(mapping).filter((k) => typeof mapping[k] === "string");
      const 范围文本 = (参数.减根范围 ?? "").trim();
      let 减根正则: RegExp | null = null;
      if (范围文本) {
        try {
          减根正则 = new RegExp(范围文本, "u");
        } catch {
          cb.on日志?.(`减根范围「${范围文本}」不是有效正则，已忽略（全部可减）`);
        }
      }
      const 可删 = 直设根.filter(
        (k) => !保护.has(k) && (!减根正则 || 减根正则.test(k)),
      );
      const 在集 = new Set(Object.keys(mapping)); // 含别名：已是任何形式条目的字不能再加
      const 可加 = 池.filter((k) => !在集.has(k));
      const 允许加根 = 参数.允许加根 !== false;
      const 允许减根 = 参数.允许减根 !== false;
      const 动作: { 加: string[]; 删: string[]; 描述: string; m: Record<string, any> }[] = [];
      if (允许减根) for (const r of 可删) 动作.push({ 加: [], 删: [r], 描述: `-${r}`, m: this.变体mapping(mapping, [], [r], 占位) });
      if (允许加根)
        for (const c of 可加) {
          const m0 = this.变体mapping(mapping, [c], [], 占位);
          let 描述 = `+${c}`;
          if (参数.自动归并相似根 !== false) {
            const 伴 = 查相似已映射根(c, mapping);
            if (伴 && mapping[伴] !== undefined) {
              m0[c] = { element: 伴 }; // 真归并：永久跟随兄弟根键位
              描述 = `+${c}(并${伴})`;
            }
          }
          // 预置归并随行：加目标时，绑定的根以真归并 {element: 目标} 入映射（永久跟随目标键位）
          const 随行根 = 预置目标到根.get(c);
          if (随行根?.length) {
            for (const 根 of 随行根) m0[根] = { element: c };
            描述 = `${描述}(并${随行根.join("、")})`;
          }
          动作.push({ 加: [c], 删: [], 描述, m: m0 });
        }
      if (动作.length === 0) {
        cb.on日志?.(`第${轮}轮 无可执行动作（${允许加根 && 允许减根 ? "" : "开关限制："}${允许加根 ? "" : "禁加根 "}${允许减根 ? "" : "禁减根"}）`);
        收敛 = true;
        break;
      }
      const t0 = Date.now();
      let best = -1, best分 = Infinity;
      for (let i = 0; i < 动作.length; i++) {
        if (cb.应停止?.()) { 已停止 = true; break; }
        const r = this.评变体(动作[i]!.m);
        const 分 = "失败" in r ? Infinity : r.总分 + this.根数罚分(动作[i]!.m);
        if (分 < best分) { best分 = 分; best = i; }
        // 每个动作都报进度：大词库下单动作可达十几秒，每 10 个才报会在轮首造成长时间静默
        cb.on轮进度?.(i + 1, 动作.length, best === -1 ? "—" : 动作[best]!.描述, best分);
      }
      if (已停止) break;
      const 耗时 = (Date.now() - t0) / 1000;
      if (!isFinite(best分) || best === -1 || best分 >= 当前分 - 1e-9) {
        // 无代价减根：删除动作且分数完全不变 → 免费缩小根集，直接应用并继续搜索
        const 前分 = 当前分;
        const 无代价减根动作 =
          best !== -1 && isFinite(best分) && Math.abs(best分 - 当前分) <= 1e-9 && 动作[best]!.删.length > 0
            ? 动作[best]!
            : null;
        if (无代价减根动作) {
          mapping = 无代价减根动作.m;
          当前分 = best分;
          const 轮r: 轮结果 = {
            轮,
            动作: 无代价减根动作.描述,
            分数: Math.round(best分 * 100) / 100,
            前分: Math.round(前分 * 100) / 100,
            变化: 0,
            根数: Object.keys(mapping).length,
            动作数: 动作.length,
            耗时,
          };
          轮日志.push(轮r);
          cb.on轮?.(轮r);
          cb.on日志?.(`第${轮}轮 [无代价减根] ${无代价减根动作.描述}（分数不变，免费缩小根集至 ${轮r.根数}）`);
          continue; // 继续搜：可能还有更多无代价减根或真正的改进
        }
        收敛 = true;
        cb.on日志?.(`第${轮}轮 无改进（最优 ${best === -1 ? "无" : 动作[best]!.描述} ${isFinite(best分) ? Math.round(best分) : "∞"} ≥ 当前 ${Math.round(当前分)}）`);
        建议动作 = best === -1 || !isFinite(best分) ? null : { 动作: 动作[best]!.描述, 分数: Math.round(best分 * 100) / 100, mapping: 动作[best]!.m };
        break;
      }
      mapping = 动作[best]!.m;
      const 前分0 = 当前分;
      当前分 = best分;
      if (动作[best]!.加.length > 0 && Math.abs(best分 - 前分0) < 0.01) {
        try {
          const 变化根集 = 差异根(this.基态mapping, mapping);
          const 诊断: string[] = [];
          const { 准备: 准备v } = this.全量分析(mapping);
          const 变体根v: any[] = 准备v.value.字根部件列表;
          for (const X of 变化根集) {
            const 基态匹配 = this.基态根列表.filter((p: any) => p.字符?.获取名称?.() === X).length;
            const 变体匹配 = 变体根v.filter((p: any) => p.字符?.获取名称?.() === X).length;
            let 脏 = 0;
            if (变体匹配 > 0) {
              const R = 变体根v.find((p: any) => p.字符?.获取名称?.() === X);
              for (const C of this.基态待分析部件) {
                if (C === R || C.生成二进制切片列表(R, this.基态退化配置).length) 脏++;
              }
            }
            诊断.push(`根${X}: 基态表示${基态匹配} 变体表示${变体匹配} 脏部件${脏}`);
          }
          cb.on日志?.(`⚠ ${动作[best]!.描述} 增量为0 —— ${诊断.join(" | ")}（脏部件=0 意味着该根字形与任何字的部件都对不上，请检查自定义字形/字形来源）`);
        } catch (e) {
          cb.on日志?.(`⚠ ${动作[best]!.描述} 增量为0（诊断失败: ${String(e)}）`);
        }
      }
      const 轮r: 轮结果 = {
        轮,
        动作: 动作[best]!.描述,
        分数: Math.round(best分 * 100) / 100,
        前分: Math.round(前分0 * 100) / 100,
        变化: Math.round((best分 - 前分0) * 100) / 100,
        根数: Object.keys(mapping).length,
        动作数: 动作.length,
        耗时,
      };
      轮日志.push(轮r);
      cb.on轮?.(轮r);
      cb.on日志?.(`第${轮}轮 ${轮r.动作} ${轮r.前分} → ${轮r.分数}（${轮r.变化 > 0 ? "+" : ""}${轮r.变化}，根 ${轮r.根数}，${动作.length} 动作 ${耗时.toFixed(1)}s）`);
      cb.on阶段?.(`第${轮 + 1} 轮：重建基态……`);
      this.设置基态(mapping); // 下一轮以此为基态
    }
    return { mapping, 总分: Math.round(当前分 * 100) / 100, 轮日志, 收敛, 已停止, 建议: 建议动作 };
  }
}

// ---------- 共享工具 ----------
/** 相似字形分组（移植自根部件页「推荐相似字根」的手工分组）：同组字根形状相近 */
export const 相似根分组 = [
  // 笔顺统一
  "力\ue401",
  "王\ue102",
  "土\ue43a",
  "十\ue452",
  "\ue068\ue443", // 𠂇
  "\ue011\ue43f", // 𠤎
  // 左点
  "八\ue446",
  // 横折弯钩 - 横斜钩
  "几\ue0d6",
  // 拓扑关系
  "人\ue43d",
  "彐\ue432",
  "止\ue451",
  // 匕 35 变 15
  "比\ue839",
  "北\ue822",
  "此\ue807",
  "鹿\ue838",
  // 竖钩变竖
  "小\ue442",
  "氺\ue18e",
  "冂\ue439",
  // 框类
  "木朩\ue04c",
  "大\ue043",
  "禾\ue44b",
  // 竖变撇
  "丰\ue003",
  "羊\ue042",
];

/** 找 c 的同组兄弟中已被设为字根（键位串安排）的第一个；无则 null */
export function 查相似已映射根(c: string, mapping: Record<string, any>): string | null {
  for (const group of 相似根分组) {
    if (![...group].includes(c)) continue;
    for (const mate of [...group]) {
      if (mate === c) continue;
      if (typeof mapping[mate] === "string") return mate;
    }
  }
  return null;
}

export function 收集引用(v: any, out: Set<string>) {
  if (typeof v === "string") out.add(v);
  else if (Array.isArray(v)) v.forEach((x) => 收集引用(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => 收集引用(x, out));
}
const 直设 = (m: Record<string, any>) => new Set(Object.keys(m).filter((k) => typeof m[k] === "string"));
const 活跃别名 = (m: Record<string, any>) => {
  const 有 = 直设(m);
  const keys = new Set<string>();
  for (const [k, v] of Object.entries(m)) {
    if (typeof v === "string") continue;
    const refs = new Set<string>();
    收集引用(v, refs);
    if ([...refs].every((r) => 有.has(r))) keys.add(k);
  }
  return keys;
};
/** 影响拆分的根差异：直接根增删 + 别名开/关（别名键自身获得/失去根身份）+ 开关别名的引用根 */
export function 差异根(m1: Record<string, any>, m2: Record<string, any>): Set<string> {
  const d1 = 直设(m1), d2 = 直设(m2);
  const out = new Set<string>();
  for (const k of d1) if (!d2.has(k)) out.add(k);
  for (const k of d2) if (!d1.has(k)) out.add(k);
  const a1 = 活跃别名(m1), a2 = 活跃别名(m2);
  const 并入 = (k: string, v: any) => {
    out.add(k);
    收集引用(v, out);
  };
  for (const k of a1) if (!a2.has(k)) 并入(k, m1[k]);
  for (const k of a2) if (!a1.has(k)) 并入(k, m2[k]);
  return out;
}
/** 表模式展开：patterns 优先，否则按 orders 展开为空位组合 */
export function 展开表模式(t: { patterns?: number[][]; orders?: number[]; maxLength?: number }): number[][] {
  if (t.patterns && t.patterns.length) return t.patterns;
  const len = t.maxLength ?? 4;
  const out: number[][] = [];
  for (const k of t.orders ?? []) {
    if (k === 0) out.push([]);
    else out.push(...combinations(len, k));
  }
  return out;
}
