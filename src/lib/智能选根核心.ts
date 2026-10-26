/**
 * 智能选根核心：增量重拆分评分 + 贪心搜索。
 * 评分口径与 方案/选根/增量评分.ts 完全一致（已通过 160 次随机对拍 + 独立实现交叉验证）。
 * 与 CLI 版的差异：基态=当前 mapping（无独立基线 yaml），加/删直接作用于 mapping，
 * 新根安排由参数给出（占位键，不影响元素序列层面的结构统计）。
 * 本文件不含 DOM/fs 依赖，供 Web Worker 与 CLI 校验脚本共用。
 */
import { range } from "lodash-es";
import { 根安排描述 } from "./安排显示";
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
  笔画,
  type 组装条目,
  默认退化配置,
  type 退化配置,
} from "../../packages/hanzi-chai/src/main";
import { 构建标准上下文, 装配输入自配置 } from "./标准装配";
import { 阶重序列键, 阶重估计计数, 阶重加增量, 阶重减增量 } from "./阶重统计";

// 「两个字形是不是同一个根」的判据必须全站共用一套（见 字形同形键 注释），
// 界面自己判同形时也要走 部件同形，所以把退化配置从这里一并转出去，别各处另造。
export { 默认退化配置, type 退化配置 };

// ---------- 类型 ----------
/** 评分表的统计对象类型——与「统计一」的「类型」下拉完全同义（2026-10-23 定案）：
 *  all = 全部（一字词与多字词混在同一个频率榜里排名）、single = 一字词、multi = 多字词。
 *  缺省 = single：照统计一的做法（它的「类型」下拉不可清空，初始值就是「一字词」），
 *  即「没写类型」等价于「一字词」，而不是报错。只有写了无法识别的值才抛错。 */
export type 表类型 = "all" | "single" | "multi";

/** 类型取值表：英文值与统计一的表单值同源（yaml 里写这个，UI 也写这个）；
 *  中文别名只为手写 yaml 时别写错——写「一字词」和写 single 等价，不允许第三种写法。 */
const 类型别名: Record<string, 表类型> = {
  all: "all",
  single: "single",
  multi: "multi",
  全部: "all",
  一字词: "single",
  多字词: "multi",
};

/** 规范化表类型：缺省补 single（统计一口径），非法值抛错（搜索点下去即报）。
 *  评分表、手动分析的共享表/自建表共用本函数，禁止各处各写一套缺省。 */
export function 规范表类型(t: { name?: string; type?: string }): 表类型 {
  const v = t.type ?? "single";
  const 规 = 类型别名[v];
  if (规) return 规;
  throw new Error(
    `评分表「${t.name ?? "未命名"}」的类型「${v}」无法识别：只能是 全部 / 一字词 / 多字词（或 all / single / multi）`,
  );
}

/** 类型判据（唯一实现）：按词的字符数，与统计一 filterRelevant 的 `[...词].length` 判定同义。
 *  字符串入参是为了让「未规范化的原始 yaml 值」也能走同一判据（非法值按一字词处理，报错交给 规范表类型）。 */
export function 类型含(类型: string, 名: string): boolean {
  const 规 = 类型别名[类型] ?? "single";
  if (规 === "all") return true;
  const 单字 = [...名].length === 1;
  return 规 === "multi" ? !单字 : 单字;
}

export interface 评分表输入 {
  name: string;
  weight: number;
  /** 统计对象类型（照统计一）：缺省 single = 一字词。非法值在建核心时抛错 */
  type?: 表类型;
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

/** 官方 `验证特殊字根`（packages/hanzi-chai/src/component.ts:249）会按 **root 的字符名**分流，
 *  对这些名字做上横/下横长度、外框是否含内部笔画等几何校验；**名字不在集合里就整段跳过（return true）**。
 *
 *  后果：「土」只认土字形，「士」只认士字形，而 `⼟`(U+2F1F)、`⼠`(U+2F20)、U+F000 这类名字不在集合里的
 *  同形变体**跳过校验** → 土士通吃。实测覆盖字数：土 1476、士 486、变体 1904 = 1476+486−58（并集）。
 *  所以「几何同形」不等于「切片能力相同」，这些名字不能与同形兄弟合并、也不能互相当重复项拦掉。
 *  （U+E02D 是 target 侧的特判名字，一并保守列入。）*/
export const 特殊字根名: ReadonlySet<string> = new Set([
  "土",
  "士",
  "未",
  "末",
  "口",
  "囗",
  "\ue087", // 木无十
  "\ue43d", // 全字头
  "\ue02d", // target 侧「口/囗」分支的特判
]);

/** 字形同形键：**快筛签名**（笔画数 + 逐笔完整特征 + 拓扑矩阵的关系类型），返回 null = 不参与同形判定
 *  （非部件、复合体、无逐笔笔画列表的空壳、单笔画笔画根）。
 *
 *  注意「同键」只是**有可能**同形，不等于同形：匹配器 `生成二进制切片列表` 还有一层
 *  `验证特殊字根` 的几何校验，签名罩不住——「人/入」「目/且」「口/囗」「土/士」签名完全相同，
 *  但官方切片互测互切不出（2026-10-25 实测 46 组）。所以凡是要判「两个字形是否同一个根」的地方，
 *  都必须**再走 部件同形**，不能只比这个键。
 *
 *  挖掘去重与搜索的候选池「与已有根同形则不进池」过滤必须共用同一套判据
 *  （字形同形键 快筛 + 部件同形 定案），两层判据一旦不同步就会静默漏候选（E00d 被 E446 误杀的教训）。 */
export function 字形同形键(字形: any): string | null {
  if (!字形 || !是部件(字形)) return null;
  const 笔画列表 = 字形._笔画列表?.() as { feature: string }[] | undefined;
  if ((笔画列表?.length ?? 0) < 2) return null; // 单笔画 = 笔画根，恒可用，不参与同形
  const 拓扑 = 字形._拓扑?.();
  const 拓扑签名 = 拓扑?.matrix
    ?.map((行: any[]) => 行.map((关系: any) => (关系?.map?.((r: any) => r.type).join("+") ?? "")).join(",")).join(";");
  return `部#${笔画列表!.length}#${笔画列表!.map((s) => s.feature).join("|")}#${拓扑签名 ?? ""}`;
}

/** 两个部件字形是否**真同形**：官方匹配器口径 —— 双向都能切出对方，缺一不可。
 *  只判单向会把「A 包含 B」误当同形，而 A 那个部件其实拆不出 B，B 仍是独立有用的根
 *  （如「入」不能被「人」顶掉）。调用前应先用 字形同形键 快筛（不同键必然不同形）。 */
export function 部件同形(甲: any, 乙: any, 退化器: 退化配置): boolean {
  if (甲 === 乙) return true;
  const 切出 = (a: any, b: any) => {
    try {
      return a.生成二进制切片列表(b, 退化器).length > 0;
    } catch {
      return false;
    }
  };
  return 切出(甲, 乙) && 切出(乙, 甲);
}

/** 引擎版字内部件挖掘（原名切片挖掘）：按「分析字集中包含该形状的字数」对全字库候选形状排名。
 *  两类候选、两类判定：
 *  - 部件候选（叶部件字形）：在扫描字的叶部件上做引擎切片判定（笔画特征等价 + 拓扑矩阵校验，
 *    支持离散切片；快筛：长度、特征存在位掩码、特征多重集包含）。
 *  - 复合候选（复合体字形，允许复合体=开时参与）：复合体没有逐笔几何/拓扑，无法做切片判定，
 *    改按「分析字的字形树里存在同一个复合体**实例**」匹配计数（整字与各层复合体均覆盖）。
 *    字库里的复合体字形是跨字共享的实例（父映射就拿字形对象当 Map 键），所以「对象相同 = 结构相同」，
 *    这比按分类笔顺串判同精确得多——笔画串相同但结构不同的复合体（⿰木木 vs ⿱木木、PUA 与基本平面
 *    同笔画字）曾因共用串而互相借走对方的可拆字集，2026-10-25 修。
 *  候选形状 = 全字库各字符的主字形（允许复合体时含复合体字形），单笔画除外（笔画根恒可用）；
 *  同形状按键去重（部#分类串#拓扑 / 复#名），取词典频度最高者为代表。
 *  **例外（2026-10-26）**：名字在 `特殊字根名` 里、或在 `选项.强制独立` 里的候选**不参与合并**——
 *  前者的切片能力受名字影响（见 特殊字根名 注释），后者是用户点名的根（外形相同也可能是两个不同的根）。
 *  结果按字库对象+模式+白名单指纹缓存（WeakMap）。 */
export function 挖掘切片候选(
  字库: any,
  汉字集合: Iterable<any>,
  频率表: Map<string, number>,
  退化器: 退化配置,
  cb?: { on进度?: (已完成: number, 总数: number) => void; 应停止?: () => boolean },
  选项?: { 允许复合体?: boolean; 强制独立?: Iterable<string> },
): 挖掘结果项[] {
  const 允许复合体 = 选项?.允许复合体 === true;
  const 强制独立 = new Set<string>(选项?.强制独立 ?? []);
  // 白名单进缓存键：候选集依赖它，不带上会拿到别的方案/别的白名单的结果
  const 独立键 = [...强制独立].sort().join("\u0001");
  const 缓存键 = `${允许复合体 ? "复合体" : "仅叶部件"}|${独立键}`;
  const cached = 挖掘缓存.get(字库)?.get(缓存键);
  if (cached) return cached;
  const 中止 = () => cb?.应停止?.() === true;
  // 快筛计数口径必须与切片判定一致：判定走 笔画名称等价（退化器让 提≡横、捺≡点、平撇≡撇），
  // 快筛若按原始名计数，会把「靠退化器等价才能匹配」的候选误杀（实测 土 少记 192 字，全是虫部）。
  const 等价名 = (f: string) => ((退化器 as any).feature?.[f] as string) ?? f;

  // 1) 候选形状 = 全字库每字符的主字形。部件按「同形」归并（签名快筛 → 双向切片互测定案），
  //    每类取词典频度最高者为代表；复合体逐名独立（身份按字形对象判，见 2a）。
  type 代表项 = { 字形: any; 名: string; 频: number };
  const 复合代表 = new Map<string, 代表项>();
  const 部件按签名 = new Map<string, 代表项[]>();
  for (const { 字符, 字形列表 } of 字库) {
    const 字形 = 字形列表?.[0];
    if (!字形) continue;
    const 复 = 是复合体(字形);
    if (复 && !允许复合体) continue; // 仅叶部件模式：复合体字形不参与
    const 名 = 字符.获取名称();
    const 笔画列表 = (字形 as any)._笔画列表?.() as { feature: string }[] | undefined;
    const 分类串 = (字形.获取笔画序列(默认分类器) as unknown as number[]).join("");
    if (分类串.length < 2) continue; // 单笔画 = 笔画根，恒可用
    // 复合体：逐名独立候选（宁多勿错），不做空壳过滤（复合体没有逐笔笔画列表），
    // 匹配按字形对象身份判（见 2a）——不用笔画串，否则结构不同的同笔画复合体会混成一个
    if (复) {
      复合代表.set(`复#${名}`, { 字形, 名, 频: 频率表.get(名) ?? -1 });
      continue;
    }
    // 部件：无真实笔画列表的空壳字形不作为候选
    if ((笔画列表?.length ?? 0) < 2) continue;
    const 键 = 字形同形键(字形)!;
    const 项: 代表项 = { 字形, 名, 频: 频率表.get(名) ?? -1 };
    const 同键 = 部件按签名.get(键);
    if (同键) 同键.push(项);
    else 部件按签名.set(键, [项]);
  }
  // 同形归并：签名相同只说明「笔画名与拓扑类型一致」，匹配器还有几何校验，
  // 「人/入」「目/且」「口/囗」「土/士」都是签名相同却互切不出——必须按官方口径
  // （双向切片互测）再分家，否则一个根会被另一个顶掉、永远进不了池。
  // 注意「同形」**不传递**：土≡⼟、⼟≡⼠、⼠≡士，但土≢士。所以不能用并查集求传递闭包，
  // 否则 土 又会被 士 的类吞掉；改为「按频度降序星形聚类」——每个成员只与已有类的**代表**
  // 互测，通过就归入代表（频度最高的那个真字），不通过就自成一类。
  // **两类例外不参与合并（2026-10-26）**：
  //  ① 名字在 特殊字根名 里 —— 官方 验证特殊字根 按名字分流做几何校验，同形变体的切片能力并不相同
  //     （土 只认土，⼟/U+F000 土士通吃），合并就等于把"通吃"这份能力丢掉；
  //  ② 名字在 强制独立 里 —— 用户手动点名的根，外形相同也可能是方案里两个不同的根，没人能替他判断。
  const 部件代表: 代表项[] = [];
  for (const 组 of 部件按签名.values()) {
    if (组.length === 1) {
      部件代表.push(组[0]!);
      continue;
    }
    const 排好 = [...组].sort((a, b) => b.频 - a.频);
    const 类: 代表项[] = [];
    const 自成一类 = new Set<string>();
    for (const x of 排好) {
      if (特殊字根名.has(x.名) || 强制独立.has(x.名)) {
        自成一类.add(x.名);
        类.push(x);
        continue;
      }
      const 命中 = 类.find((r) => !自成一类.has(r.名) && 部件同形(r.字形, x.字形, 退化器));
      if (!命中) 类.push(x);
    }
    部件代表.push(...类);
  }
  const 部件候选: { 部件: any; 名: string; 计数: Map<string, number>; 掩码: bigint; 长度: number }[] = [];
  const 复合候选: { 名: string; 字形: any }[] = [];
  for (const { 字形, 名 } of 部件代表) {
    const 笔画列表 = (字形 as any)._笔画列表() as { feature: string }[];
    const 计数 = new Map<string, number>();
    for (const { feature } of 笔画列表) {
      const k = 等价名(feature);
      计数.set(k, (计数.get(k) ?? 0) + 1);
    }
    部件候选.push({ 部件: 字形, 名, 计数, 掩码: 0n, 长度: 笔画列表.length });
  }
  for (const { 字形, 名 } of 复合代表.values()) 复合候选.push({ 名, 字形 });
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

  // 2a) 复合候选：按字形**对象身份**精确匹配（分析字的字形树里存在同一个复合体实例）。
  //     复合体没有逐笔几何/拓扑，但字库里的复合体字形跨字共享实例，所以对象同一即结构同一。
  //     曾按分类笔顺串匹配：串相同但结构不同的复合体会拿到同一份「可拆出它的字」集合，
  //     互相借走对方的字集（⿰木木 vs ⿱木木、PUA 与基本平面同笔画字），2026-10-25 修。
  if (允许复合体 && 复合候选.length) {
    const 候选对象 = new Map<any, string>();
    for (const c of 复合候选) 候选对象.set(c.字形, c.名);
    const 复合命中 = new Map<any, Set<string>>(); // 复合体对象 → 分析字集
    for (const 字符 of 汉字集合) {
      const 字形 = 字库.查询字形(字符)?.[0];
      if (!字形) continue;
      const 名 = 字符.获取名称();
      const walk = (g: any) => {
        if (是部件(g)) return;
        if (候选对象.has(g)) {
          let e = 复合命中.get(g);
          if (!e) { e = new Set(); 复合命中.set(g, e); }
          e.add(名);
        }
        for (const 子 of g.部分列表 ?? []) walk(子);
      };
      walk(字形);
    }
    for (const [g, 字集] of 复合命中)
      for (const 字 of 字集) 记(候选对象.get(g)!, 字);
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
    for (const { feature } of L笔画) {
      const k = 等价名(feature); // 与切片判定的 笔画名称等价 同口径（提≡横、捺≡点、平撇≡撇）
      L计数.set(k, (L计数.get(k) ?? 0) + 1);
    }
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

/** 重码组挖掘的选项 */
export interface 挖掘选项 {
  cb?: { on阶段?: (文本: string) => void };
  /** 阶重底数 = 方案字母表大小（26 键方案才等于 26，不写死） */
  按键数?: number;
  /** 每张表的统计域（已按「类型过滤 → 按频率降序 → 前 top」切好）——与评分同一份切片。
   *  缺省 = 只按类型过滤（全库、词典序），仅给没有方案上下文的探针兜底。 */
  取域?: (t: 评分表输入) => [string, { element: string; index: number }[]][];
}

/** 重码组挖掘：把各表的阶重伤害按「哪个形状能摘走成员」摊到根上的归因榜。
 *  0) 词与字同权：组成员是词时，它可被形状 R 分离 ⟺ R 能从这个词的**某个组成字**里拆出
 *     （= 组成字可拆形状的并集；词没有字形，只能经由它的字被拆分）。一词多码按条目各算一份
 *     （组成员本就逐条计入），与评分「按条目平铺/切片」一致。
 *  1) 组枚举与伤害排名：对每张表在**它自己的统计域**上、每个空位模式枚举重码组，
 *     组伤害 = 表权重 × n²/2/按键数^k（零阶 = ×(n−1)），降序排名；全部组都参与根计分
 *     （组起/组止只作用于根排名，不截组）。统计域由 取域 给出（= 评分同一份切片，含 top）：
 *     表要求词而词条里没有词时域为空、该表表值自然为 0，与手动分析/自动搜索同款——不报错、不特判。
 *  2) 根计分（分离收益）：借切片挖掘的「形状 → 可拆字」倒排索引，统计形状在某组内能覆盖的
 *     成员数 m；「把该形状从组中分离出去（m 个成员改拆此形状）」可消除的重码伤害
 *     = 表权重 × [n²−(n−m)²]/2/按键数^k（零阶见下），
 *     对全部组求和即形状得分，降序取 [根起, 根止]。全部口径与搜索目标一致。
 *     零阶必须与阶重的精确 Σ(n−1) 同标度：n−1 → max(0, n−m−1)，故收益 = min(m, n−1)
 *     （m<n 时就是 m；m=n 时整组消失，收益正好等于该组伤害 n−1）。
 *     曾用配对数 n(n−1)/2 的差（= m(2n−m−1)/2），比真实伤害大 n/2 倍量级——
 *     必撞表权重最高，这个放大直接压过其它表，2026-10-25 修掉。
 *  m 的口径不变式：同一形状对同一个成员只计一次（成员的多字形状已按并集去重，
 *  否则一个词里两个字都能拆出同一形状时会重复计 m）。 */
export function 挖掘重码组根(
  词序列: Iterable<[string, { element: string; index: number }[]]>,
  表列表: 评分表输入[],
  maxLength: number,
  切片挖掘结果: 挖掘结果项[],
  选项: 挖掘选项 = {},
): { 组: 重码组信息[]; 根: 重码根候选[] } {
  const { cb, 按键数 = 26, 取域 } = 选项;
  const 序列表 = [...词序列];
  // 1) 组枚举与伤害排名（每张表在自己的统计域上枚举：域 = 评分同一份切片，含类型过滤与 top）
  const 组全: 重码组信息[] = [];
  const 枚举步数 = 表列表.reduce((a, t) => a + 展开表模式(t).length, 0);
  let 已完成步 = 0;
  for (const t of 表列表) {
    const 类型 = 规范表类型(t);
    const 用序列 = 取域 ? 取域(t) : 类型 === "all" ? 序列表 : 序列表.filter(([名]) => 类型含(类型, 名));
    const 模式列表 = 展开表模式(t);
    模式列表.forEach((空位) => {
      cb?.on阶段?.(`重码组挖掘 ${++已完成步}/${枚举步数}……`);
      const 组 = new Map<string, string[]>();
      for (const [名, seq] of 用序列) {
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
        const 组分 = k === 0 ? t.weight * (n - 1) : (t.weight * n * n) / 2 / 按键数 ** k;
        组全.push({ 表名: t.name, 表权重: t.weight, 空位: [...空位], 成员, 大小: n, 组分 });
      });
    });
  }
  组全.sort((a, b) => b.组分 - a.组分);
  const 组选定 = 组全; // 根计分遍历全部组（伤害大的组自然贡献大）

  // 2) 倒排索引：成员 → 能从它拆出的形状（数组供遍历）
  //    字：形状能从这个字的字形里拆出（切片挖掘给的 字列表）。
  //    词：词没有字形，取它**各组成字的可拆形状并集**——「词里任何元素能拆出就算能分离这个词」。
  //    并集去重是必须的：一个词里若两个字都能拆出同一形状，不去重会把同一个形状的 m 计两次。
  const 字到形状 = new Map<string, string[]>();
  for (const 形状 of 切片挖掘结果) {
    for (const 字 of 形状.字列表) {
      let e = 字到形状.get(字);
      if (!e) { e = []; 字到形状.set(字, e); }
      e.push(形状.名);
    }
  }
  /** 成员 → 可分离形状。字走现成索引；词懒算并集并缓存（同一个词会在每个空位模式、每张表里被反复问到，
   *  词库 7 万词、每词并集约 20~30 个形状，缓存的字符串都是共享引用，内存压力很小）。 */
  const 词到形状 = new Map<string, string[]>();
  const 形状集 = (名: string): string[] => {
    const 直 = 字到形状.get(名);
    if (直) return 直;
    let e = 词到形状.get(名);
    if (e) return e;
    const s = new Set<string>();
    for (const c of 名) for (const x of 字到形状.get(c) ?? []) s.add(x);
    e = [...s];
    词到形状.set(名, e);
    return e;
  };

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
      for (const 形状名 of 形状集(字)) {
        let e = 成员形状.get(形状名);
        if (!e) { e = { m: 0, 字集: new Set<string>() }; 成员形状.set(形状名, e); }
        e.m += 1;
        e.字集.add(字);
      }
    }
    for (const [形状名, { m, 字集 }] of 成员形状) {
      const 收益 =
        k === 0
          ? g.表权重 * Math.min(m, n - 1)
          : (g.表权重 * (n * n - (n - m) * (n - m))) / 2 / 按键数 ** k;
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
    .sort((a, b) => b.得分 - a.得分);
  // 不在此切片：调用方按各自的根起/根止取用（界面改范围无需重新挖掘）

  return { 组: 组选定, 根 };
}

/** 候选字根：一条字根表规则
 *  - 字频范围：按词典单字字频排名的 [起, 止] 区间（1 起，含端点）
 *  - 字内部件（内部名 切片挖掘）：按「分析字集中包含该形状的字数」排名的 [起, 止] 区间；
 *    允许复合体（默认开）时形状覆盖整字与各层复合体，否则仅叶部件
 *  - 重码组挖掘：按「把形状从重码组中分离出去可消除的伤害」排名的 [根起, 根止] 区间
 *  - 手动指定：文本逐字即字根（一字符一根），方便从别处整串粘贴 */
export type 字根表规则 =
  | { 类型: "字频范围"; 起: number; 止: number }
  | { 类型: "字内部件"; 起: number; 止: number; 允许复合体?: boolean }
  | { 类型: "重码组挖掘"; 根起: number; 根止: number; 允许复合体?: boolean }
  | { 类型: "手动指定"; 字根: string | string[] };
export interface 搜索参数 {
  /** 轮数上限 */
  轮数: number;
  /** 旧版单值（字频 1~N），字根表列表缺省时兜底使用 */
  高频字数?: number;
  /** 候选字根：多条字根表规则，并集去重后作为加根候选池 */
  字根表列表?: 字根表规则[];
  占位安排: string;
  保护根: string[];
  表列表: 评分表输入[];
  允许加根?: boolean;
  允许减根?: boolean;
  /** 删除根范围：正则（对根名称匹配）。留空=全部可减；无效正则忽略并记日志 */
  减根范围?: string;
  /** 单轮根数：每轮把改善最大的前 K 个加根动作同时应用（按各自单加收益降序选，组合后整体合评）。
   *  1 = 经典单步贪心（默认） */
  单轮根数?: number;
  /** 每隔 N 轮重建一次加根池（0/缺省 = 不重建）。
   *  时序为「建，1，2，建，3，4，建……」：第 1 轮用初始池，跑满 N 轮后在下轮开始前重建。
   *  重建重算与映射相关的部分（重码组挖掘排行、形状去重、相似/预置归并拉入），
   *  字频排序与字内部件名单复用初次结果；基态无需额外重建（每轮末尾与码位归并触发段都会重设）。 */
  重建加根池间隔?: number;
  /** 根数惩罚：以 n（直设根数）为自变量的表达式，如 "max(0, n-150)*50000"；空=不惩罚 */
  根数惩罚?: string;
  /** 相似字形分组的强制归并（缺省开启）：组内任一成员进了字根池（候选池 ∪ 当前映射），整组即归并——
   *  不常用者整体归入组内最常用者（{element: 最常用}）。与硬性预置归并同等强度，冲突时手写条目优先；
   *  提示上只对「整组休眠/条目无效」静默，成环、被手写占位而让位等情况与手写条目一样在橙框上报。 */
  自动归并相似根?: boolean;
  /** 预置归并：[{根, 目标, 根位?, 目标位?}]。
   *  无码位：两者都不占基态键位，根整体随目标（真归并 {element: 目标}）；目标强制加入候选池，
   *  执行「加目标」动作时，绑定的根自动以 {element: 目标} 随行入映射。
   *  带码位（1 起）：根保留自己的键位，仅第 根位 码改用 目标元素的第 目标位 码
   *  （安排=逐位数组，该位={element: 目标, index: 目标位-1}）；不摘除、不随行。 */
  预置归并?: { 根: string; 目标: string; 根位?: number; 目标位?: number; 相似?: boolean }[];
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
  /** 单轮多根时：入选动作的描述与其单独评分相对前分的预期降幅（合评分 ≠ 各项之和，供对照） */
  单加明细?: { 描述: string; 预期变化: number }[];
  /** 该轮结束（动作已应用到 mapping）后的方案快照，供主线程在「强杀后」抓包还原已选好的根 */
  mapping?: Record<string, any>;
}
export interface 搜索回调 {
  on阶段?: (文本: string) => void;
  on轮进度?: (已评: number, 总数: number, 最优描述: string, 最优分: number, 变化: number | null) => void;
  on轮?: (r: 轮结果) => void;
  /** 预置归并筛死（两边不都在字根池）——候选池建好后即刻上报，不等搜索结束 */
  on预置归并失败?: (文本: string) => void;
  /** 手动指定字根里字库找不到（无字形）被跳过的字——候选池建好后上报 */
  on手动指定问题?: (文本: string) => void;
  应停止?: () => boolean;
}
export interface 搜索结果 {
  mapping: Record<string, any>;
  总分: number;
  轮日志: 轮结果[];
  收敛: boolean;
  已停止: boolean;

  /** 收敛时的下一步建议（未自动应用的最优动作，mapping 为执行后的方案） */
  建议?: { 动作: string; 分数: number; mapping: Record<string, any> } | null;

  /** 预置归并里永远无法应用的条目汇总（一句话，给绿框），无问题则缺省 */
  备注?: string;
}
interface 变体评分 {
  总分: number;
  表: Record<string, number>;
  字数: number;
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
  表配置: { 名: string; 权重: number; 类型: 表类型; top: number | undefined; 模式: number[][] }[];
  /** 是否有表要统计多字词（类型 ≠ 一字词）。为 false 时 条目提取 直接丢掉多字词，
   *  全站的单字方案（表全是一字词）就完全不受词分析影响——装机量最大的一条路零回归 */
  需要词 = false;
  /** 增量组装的索引（与 mapping 无关，构造时建一次）：
   *  拼音分组 = 词名 → 该词的拼音分析条目（多音/多拼音全在内）；子集喂给 组装 只产出子集。
   *  字到词名 = 字名 → 含该字的词名（含自身）：「根变 → 字变 → 这些词的码才可能变」。 */
  拼音分组 = new Map<string, any[]>();
  字到词名 = new Map<string, Set<string>>();
  /** 键盘按键数 = 方案字母表大小（阶重估计的底数，随方案而定，不写死 26） */
  按键数: number;

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
    this.按键数 = (this.配置0.form.alphabet as string | undefined)?.length || 26;
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
    // 单字按频序（原始词典口径，仅字频排名用：字频范围候选池）。
    // 注意：表的统计切片不走这条——那是「组装条目按频率降序 + 类型过滤」（见 平铺排序），
    // 与统计一完全同源；两者混用会重现 2026-10-23 之前「top=0 走单字、top>0 走全条目」的双轨。
    this.按频词序 = [...this.频率表.entries()]
      .filter(([w]) => [...w].length === 1)
      .sort((a, b) => b[1] - a[1])
      .map(([w]) => w);
    this.词全集 = new Set(this.按频词序);
    this.表配置 = (配置.statistics?.tables ?? []).map((t: any) => ({
      名: t.name as string,
      权重: t.weight as number,
      类型: 规范表类型(t),
      top: t.top as number | undefined,
      模式: 展开表模式(t),
    }));
    this.需要词 = this.表配置.some((t) => t.类型 !== "single");
    this.建词索引();
  }

  /** 建增量组装索引（拼音分组 / 字到词名）。构造时按 表配置 自动建一次；
   *  只有「构造后改 表配置」的场景（探针/校验脚本先把表类型改成 all）才需要手动重调。
   *  词只在「有表统计词」时索引：否则多字词在 条目提取 就被丢掉，永远不会进词条。 */
  建词索引() {
    this.拼音分组 = new Map();
    this.字到词名 = new Map();
    for (const 项 of this.拼音分析 as any[]) {
      const 单字 = 项.词.length === 1;
      if (!单字 && !this.需要词) continue;
      const 名 = 项.词.map((c: any) => c.获取名称()).join("");
      let g = this.拼音分组.get(名);
      if (!g) { g = []; this.拼音分组.set(名, g); }
      g.push(项);
      if (!this.需要词) continue;
      for (const c of 项.词) {
        const 字名 = c.获取名称();
        let s = this.字到词名.get(字名);
        if (!s) { s = new Set(); this.字到词名.set(字名, s); }
        s.add(名);
      }
    }
  }

  // ---------- mapping 变换 ----------
  /**
   * 应用加/删并级联失效（2026-10-08 修订，修复"连带删除别名 53 个"误删）。
   * 条目三形态：string 键位安排（直设根）/ 数组逐位安排（带自身键位的根，可含 {element,index} 借码位）/
   * 纯别名 {element: X}（整体归并，跟随 X 的码）。
   * 级联规则（不动点）：非 string 条目引用的根**因本次动作从映射中消失**（被显式删除，或沿引用链上游失效）时
   * 随之失效——数组条目也必须遵守：借码根悬空时决策图线性化硬报错"决策中不存在键"（实测）。
   * 引用**从未入映射**的名字（基线悬空条目，如 {element:忄} 且 忄 不是根）不属本次动作的后果，保持原样
   * ——这类条目在恢复安排里本就被跳过（死条目），删与不删不影响任何分数，动了反而惊扰用户。
   * 旧 bug 双根因：①收集引用把数组里的键位字符（如 "j"）当引用根，所有数组条目被判引用不全；
   * ②直设集只认 string 值，"引用数组根"的 444 个别名全被误判失效。
   */
  变体mapping(基: Record<string, any>, 加: string[], 删: string[], 占位 = "aa"): Record<string, any> {
    const m: Record<string, any> = { ...基 };
    const 加集 = new Set(加 ?? []);
    const 死 = new Set(删 ?? []);
    for (const r of 死) if (!加集.has(r)) delete m[r];
    for (const r of 加集) if (!(r in m)) m[r] = 占位;
    const 非串条目 = Object.entries(m).filter(([, v]) => typeof v !== "string") as [string, any][];
    let 变了 = true;
    while (变了) {
      变了 = false;
      for (const [k, v] of 非串条目) {
        if (死.has(k)) continue;
        const refs = new Set<string>();
        收集引用(v, refs);
        if ([...refs].some((r) => 死.has(r))) {
          死.add(k);
          delete m[k];
          变了 = true;
        }
      }
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
    // 在这里去重会让自动搜索的分母与手动分析不一致（词库里多音字越多差得越大）。
    // 多字词只在「有表要统计词」（类型 ≠ 一字词）时才收：全部一字词的方案照旧只看单字，
    // 既不多算也不变慢（2026-10-23 随评分表类型一起改）
    const out = new Map<string, { 元素序列: { element: string; index: number }[]; 频率: number }[]>();
    for (const 条目 of r.value) {
      const 词 = 条目.词.map((c: any) => c.获取名称()).join("");
      if (!this.需要词 && [...词].length !== 1) continue;
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
  /** 组装。拼音默认全库（基态用）；传子集时只组装这批条目——组装是纯逐条函数
   *  （只读 分析结果 与 配置），喂子集必然只产出对应的子集，见 评变体 的增量路径。 */
  运行组装(
    mapping: Record<string, any>,
    强: any,
    线性化: any,
    分析结果: Map<any, any>,
    字根部件列表: any[],
    拼音: any = this.拼音分析,
  ) {
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
      拼音,
      { 分析结果, 字根部件列表 },
    );
  }
  // ---------- 计分 ----------
  /** 一张表的统计切片 = 「该类型的全部组装条目按频率降序」→ 取前 N（0 = 全部）。
   *  这就是统计一「类型 + 范围」的唯一口径（sort → type 过滤 → slice），
   *  全量计分、基态、增量评估三处共用，不再有「top=0 走单字按频序、top>0 走全条目」的双轨。 */
  private 取切片(t: { 类型: 表类型; top: number | undefined }, 平铺: { j: string; 频率: number }[]) {
    return t.top && t.top > 0 ? 平铺.slice(0, t.top) : 平铺;
  }
  全量计分(词条: Map<string, { 元素序列: { element: string; index: number }[]; 频率: number }[]>) {
    const 表值: Record<string, number> = {};
    let 总分 = 0;
    const 平铺缓存 = new Map<表类型, { j: string; 频率: number }[]>();
    for (const t of this.表配置) {
      let 平 = 平铺缓存.get(t.类型);
      if (!平) {
        平 = this.平铺排序(词条, t.类型);
        平铺缓存.set(t.类型, 平);
      }
      const 切片 = this.取切片(t, 平).map((x) => JSON.parse(x.j));
      let v = 0;
      for (const 空位 of t.模式) {
        const 组 = new Map<string, number>();
        for (const 序列 of 切片) {
          const 键 = 阶重序列键(序列, 空位, 4);
          组.set(键, (组.get(键) ?? 0) + 1);
        }
        v += 阶重估计计数(组, 空位, this.按键数);
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
  /** 基态词条（含组装条目频率）；各类型表的切片口径要用 */
  基态词条!: Map<string, { 元素序列: { element: string; index: number }[]; 频率: number }[]>;
  /** 基态「按类型」的条目级平铺（同类型多张表共用一次排序）。
   *  `键 = 名#序号` 是该条目的身份：平铺顺序只由「频率 + 过滤词典顺序」决定，与 mapping 无关，
   *  所以变体的切片成员与位置与基态逐个相同，差异只可能出现在序列值上（见 评变体）。
   *  `名` 单独存一份（不从 键 反解）：重码组挖掘要按同一份切片取域，而词名里可能含 # 之类的字符。 */
  基态平铺!: Map<表类型, { 名: string; j: string; 频率: number; 键: string }[]>;
  /** 类型 → (键 → 平铺位置)：增量差分用它判断「这个脏条目是否落在切片里」 */
  基态位置!: Map<表类型, Map<string, number>>;
  /** 每张表的基态切片（j 序列列表）与其多重集计数——增量评估只跟变体切片求差，不再重算基态 */
  基态切片!: string[][];
  基态切片计数!: Map<string, number>[];
  表组!: { 名: string; 组: Map<string, number>[]; 值: number }[];
  总分基 = 0;

  /** 条目级平铺并按组装频率降序稳定排序——与统计一/手动分析的「按频率降序」完全同序。
   *  逐条目口径：多音字的多条序列各自占排名位（官方编码页同款，不合并）。
   *  类型过滤在此做（类型 → 只看该类型条目），排序后由调用方 slice，与统计一的
   *  「sort → 按类型过滤 → 取前 N」等价。 */
  private   平铺排序(
    词条: Map<string, { 元素序列: { element: string; index: number }[]; 频率: number }[]>,
    类型: 表类型 = "single",
  ) {
    const 平铺: { 名: string; j: string; 频率: number; 键: string }[] = [];
    // 大词库同一字可能占多行（多音），组装侧已按 词+序列 合并频率；这里每字只取一次，
    // 首次出现位置 = 组装条目顺序，与面板的排序底序完全一致
    const 已见 = new Set<string>();
    for (const { 词 } of this.过滤词典) {
      // 过滤词典的 词 是字符数组，词条表以名称字符串为键
      const 名 = 词.map((c: any) => c.获取名称()).join("");
      if (已见.has(名)) continue;
      已见.add(名);
      if (!类型含(类型, 名)) continue;
      const 列表 = 词条.get(名);
      if (!列表) continue;
      for (const [idx, x] of 列表.entries())
        平铺.push({ 名, j: JSON.stringify(x.元素序列), 频率: x.频率, 键: `${名}#${idx}` });
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
    this.基态平铺 = new Map();
    this.基态位置 = new Map();
    this.基态切片 = [];
    this.基态切片计数 = [];
    this.表组 = this.表配置.map((t) => ({ 名: t.名, 组: t.模式.map(() => new Map<string, number>()), 值: 0 }));
    let 总分 = 0;
    for (const [ti, t] of this.表配置.entries()) {
      let 平 = this.基态平铺.get(t.类型);
      if (!平) {
        平 = this.平铺排序(词条, t.类型);
        this.基态平铺.set(t.类型, 平);
        // 位置索引：增量差分靠它判断「脏条目在不在切片里、旧序列是哪个」
        this.基态位置.set(t.类型, new Map(平.map((x, i) => [x.键, i])));
      }
      const js = this.取切片(t, 平).map((x) => x.j);
      const 计数 = new Map<string, number>();
      for (const j of js) 计数.set(j, (计数.get(j) ?? 0) + 1);
      this.基态切片.push(js);
      this.基态切片计数.push(计数);
      const 解析 = js.map((j) => JSON.parse(j));
      let v = 0;
      t.模式.forEach((空位, pi) => {
        const 组 = this.表组[ti]!.组[pi]!;
        for (const seq of 解析) {
          const 键 = 阶重序列键(seq, 空位, 4);
          const m = 组.get(键) ?? 0;
          v += 阶重加增量(空位.length, m, this.按键数);
          组.set(键, m + 1);
        }
      });
      this.表组[ti]!.值 = v;
      总分 += t.权重 * v;
    }
    this.总分基 = 总分; // 裸分；罚分只在搜索比较点叠加，避免增量路径重复计费
  }

  根数惩罚?: string;
  private 罚分缓存?: { 源: string; 函数: (...a: any[]) => number };
  /** 根数惩罚：n=直设根数（mapping 中字符串值的键数），套用用户表达式。
   *  非法表达式 / 求值失败 / 非有限结果一律抛错（worker 会作为「错误」上报 UI），不做静默降级 */
  根数罚分(m: Record<string, any>): number {
    const 源 = (this.根数惩罚 ?? "").trim();
    if (!源) return 0;
    if (!this.罚分缓存 || this.罚分缓存.源 !== 源) {
      let 函数: (...a: any[]) => number;
      try {
        函数 = new Function("n", "max", "min", `"use strict"; return (${源});`) as (...a: any[]) => number;
        函数(0, Math.max, Math.min); // 试编译+试运行：编译错误、引用未定义变量在此暴露
      } catch (err: any) {
        throw new Error(`根数罚分表达式「${源}」非法（须为单个 JavaScript 表达式，变量 n=直设根数、max、min）：${err?.message ?? err}`);
      }
      this.罚分缓存 = { 源, 函数 };
    }
    const 根数 = Object.values(m).filter((v) => typeof v === "string").length;
    let 值: unknown;
    try {
      值 = this.罚分缓存.函数(根数, Math.max, Math.min);
    } catch (err: any) {
      throw new Error(`根数罚分表达式「${源}」在 n=${根数} 时求值失败：${err?.message ?? err}`);
    }
    if (typeof 值 !== "number" || !isFinite(值))
      throw new Error(`根数罚分表达式「${源}」在 n=${根数} 时结果为 ${String(值)}，须为有限数`);
    return 值;
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
    /** 变化根里只要有一个「没有部件/字形表示」（笔画根、拼音或自定义元素）就无法定位脏集——
     *  这类根（如删掉笔画根 '3'）会改动全库所有用到它的字，而它不在 待分析部件 里也没有字形，
     *  脏集必然算成空、增量组装会静默返回基态分。故直接走全量回退。实测删笔画根即触发。 */
    let 无法定位 = false;
    const 根表示列表: any[][] = [];
    if (!无变化) {
      const 变体根 = 准备.value.字根部件列表 as any[];
      for (const X of 变化根) {
        const seen = new Set<any>();
        const reps = [...this.基态根列表, ...变体根].filter((p: any) => {
          if (p.字符?.获取名称?.() !== X) return false;
          if (seen.has(p)) return false;
          seen.add(p);
          return true;
        });
        根表示列表.push(reps);
        if (reps.length === 0) 无法定位 = true;
      }
      if (!无法定位)
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
    // 无法定位脏集 → 整个评估退回全量（连分析结果都要从头算：增量的 新分析结果 此时是脏的）
    if (无法定位) return this.评变体全量(mapping);
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
    // ---------- 增量组装：只重组「脏字本身 + 含脏字的词」 ----------
    // 依赖链：mapping 变 → 脏部件 → 脏字形 → 脏字符（以上照旧）→ 脏词名（字到词名倒排）→ 子集组装。
    // 组的码 = 各字按构词规则组合，所以「字码没变」的词码必然没变——这就是根指向字、字指向词。
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
    const 脏词名 = new Set<string>();
    for (const w of 脏字符) {
      脏词名.add(w);
      if (!this.需要词) continue;
      for (const 词名 of this.字到词名.get(w) ?? []) 脏词名.add(词名);
    }
    const 子集: any[] = [];
    for (const 名 of 脏词名) {
      const g = this.拼音分组.get(名);
      if (g) 子集.push(...g);
    }
    const r = this.运行组装(mapping, 强, 线性化, 新分析结果, 准备.value.字根部件列表, 子集);
    if (!r.ok) return { 失败: String(r.error) };
    const 子集词条 = this.条目提取(r, 强.决策);
    // 结构不变校验：同一词名的条目数必须与基态一致。唯一的破例是多音字的两条读法在新映射下
    // 序列变得相同 → 组装的末尾去重把它们并成一条（频率相加）→ 条目数变 → 平铺顺序与切片成员
    // 整体错位，稀疏差分的前提（位置不变）失效。此时退回全量路径（罕见；实测未触发）。
    let 结构变 = false;
    for (const 名 of 脏词名) {
      if ((子集词条.get(名)?.length ?? 0) !== (this.基态词条.get(名)?.length ?? 0)) { 结构变 = true; break; }
    }
    const 组副本 = this.表组.map((t) => ({ 名: t.名, 组: t.组.map((g) => new Map(g)), 值: t.值 }));
    const 字数 = this.基态词条.size;
    if (!结构变) {
      // 稀疏差分：平铺顺序只由「频率 + 过滤词典顺序」决定，mapping 改不了它 →
      // 变体切片与基态切片的成员和位置逐个相同，差异只可能出在脏条目的序列值上。
      // 脏条目的新序列只 stringify 一次；同类型（全部/一字词/多字词）的若干张表共用同一次
      // 位置比对，各自只按自己的 top 截断——比逐表重算省掉 3/4 的重复活。
      const 新序列 = new Map<string, string>();
      for (const 名 of 脏词名) {
        const 新列表 = 子集词条.get(名);
        if (!新列表) continue;
        for (const [idx, 条目] of 新列表.entries())
          新序列.set(`${名}#${idx}`, JSON.stringify(条目.元素序列));
      }
      const 按类型 = new Map<
        表类型,
        { ti: number; t: { 名: string; 权重: number; 类型: 表类型; top: number | undefined; 模式: number[][] } }[]
      >();
      for (const [ti, t] of this.表配置.entries()) {
        const 组 = 按类型.get(t.类型);
        if (组) 组.push({ ti, t });
        else 按类型.set(t.类型, [{ ti, t }]);
      }
      for (const [类型, 表们] of 按类型) {
        const 平 = this.基态平铺.get(类型)!;
        const 位置 = this.基态位置.get(类型)!;
        const 项: { pos: number; 旧j: string; 新j: string }[] = [];
        for (const [键, 新j] of 新序列) {
          const pos = 位置.get(键);
          if (pos === undefined) continue; // 不在该类型的平铺里（类型过滤掉的多字词等）
          const 旧j = 平[pos]!.j;
          if (旧j !== 新j) 项.push({ pos, 旧j, 新j });
        }
        if (!项.length) continue;
        for (const { ti, t } of 表们) {
          const 切片长 = t.top && t.top > 0 ? Math.min(t.top, 平.length) : 平.length;
          const 差 = new Map<string, number>();
          for (const { pos, 旧j, 新j } of 项) {
            if (pos >= 切片长) continue; // 不在本表切片里，分数与它无关
            差.set(旧j, (差.get(旧j) ?? 0) - 1);
            差.set(新j, (差.get(新j) ?? 0) + 1);
          }
          for (const [j, n] of [...差]) if (n === 0) 差.delete(j);
          if (差.size) this.应用差(组副本, ti, t, 差);
        }
      }
    } else {
      // 结构错位：分析结果本身是完整的（脏集只可能因为「多音合并」失真），直接走全量组装计分
      return this.评变体全量(mapping, { 强, 线性化, 准备: 准备.value, 分析结果: 新分析结果 });
    }
    let 总分 = this.总分基;
    for (const [ti, t] of this.表配置.entries())
      总分 += t.权重 * (组副本[ti]!.值 - this.表组[ti]!.值);
    const 表值: Record<string, number> = {};
    for (const g of 组副本) 表值[g.名] = Math.round(g.值 * 100) / 100;
    return { 总分: Math.round(总分 * 100) / 100, 表: 表值, 字数 };
  }

  /** 全量评估（不依赖任何增量假设）：整体重算组装与计分。
   *  无法定位脏集（笔画根/拼音元素等无字形根被加删、会改动全库）时从 全量分析 从头来；
   *  只是条目结构错位时可由调用方传入已算好的分析结果，省掉一次全量重分析。 */
  private 评变体全量(
    mapping: Record<string, any>,
    已算?: { 强: any; 线性化: any; 准备: any; 分析结果: Map<any, any> },
  ): 变体评分 | { 失败: string } {
    try {
      const { 强, 线性化, 准备, 分析结果 } = 已算 ?? this.全量分析(mapping);
      const r = this.运行组装(mapping, 强, 线性化, 分析结果, 准备.字根部件列表);
      if (!r.ok) return { 失败: String(r.error) };
      const 新词条 = this.条目提取(r, 强.决策);
      const 组副本 = this.表组.map((t) => ({ 名: t.名, 组: t.组.map((g) => new Map(g)), 值: t.值 }));
      const 平铺缓存 = new Map<表类型, { j: string; 频率: number }[]>();
      for (const [ti, t] of this.表配置.entries()) {
        let 平 = 平铺缓存.get(t.类型);
        if (!平) {
          平 = this.平铺排序(新词条, t.类型);
          平铺缓存.set(t.类型, 平);
        }
        const 变计数 = new Map<string, number>();
        for (const { j } of this.取切片(t, 平)) 变计数.set(j, (变计数.get(j) ?? 0) + 1);
        const 差 = new Map<string, number>();
        for (const [j, n] of 变计数) 差.set(j, n);
        for (const [j, n] of this.基态切片计数[ti]!) 差.set(j, (差.get(j) ?? 0) - n);
        for (const [j, n] of [...差]) if (n === 0) 差.delete(j);
        if (差.size) this.应用差(组副本, ti, t, 差);
      }
      let 总分 = this.总分基;
      for (const [ti, t] of this.表配置.entries())
        总分 += t.权重 * (组副本[ti]!.值 - this.表组[ti]!.值);
      const 表值: Record<string, number> = {};
      for (const g of 组副本) 表值[g.名] = Math.round(g.值 * 100) / 100;
      return { 总分: Math.round(总分 * 100) / 100, 表: 表值, 字数: 新词条.size };
    } catch (e) {
      return { 失败: String(e) };
    }
  }

  /** 把「序列多重集差」应用到某张表的组副本（负=移出、正=移入）。增量与全量回退共用一处，
   *  保证两条路的口径不会各自漂。 */
  private 应用差(
    组副本: { 名: string; 组: Map<string, number>[]; 值: number }[],
    ti: number,
    t: { 模式: number[][] },
    差: Map<string, number>,
  ) {
    const 表副本 = 组副本[ti]!;
    // 差集里存的是 stringify 过的序列（平铺里要按串比较，只能存串），用的时候得解析回来。
    // 解析必须提到模式循环外面：「总阶重」这张表有十几个空位模式，同一串逐模式各解析一次就是
    // 十几倍的重复开销。阶重序列键 只读 序列[i]、不修改入参，所以解析结果可安全复用给所有模式。
    const 已解析: [any, number][] = [...差].map(([j, 变化量]) => [JSON.parse(j), 变化量]);
    t.模式.forEach((空位, pi) => {
      const 组 = 表副本.组[pi]!;
      for (const [序列, 变化量] of 已解析) {
        const 键 = 阶重序列键(序列, 空位, 4);
        if (变化量 < 0) {
          for (let k = 0; k < -变化量; k++) {
            const n = 组.get(键) ?? 0;
            表副本.值 += 阶重减增量(空位.length, n, this.按键数);
            if (n <= 1) 组.delete(键); else 组.set(键, n - 1);
          }
        } else {
          for (let k = 0; k < 变化量; k++) {
            const m = 组.get(键) ?? 0;
            表副本.值 += 阶重加增量(空位.length, m, this.按键数);
            组.set(键, m + 1);
          }
        }
      }
    });
  }

  // ---------- 切片挖掘 ----------
  private 切片挖掘缓存: { 键: string; 结果: 挖掘结果项[] } | null = null;

  /** 显式白名单：`搜索()` 里由「手动指定」规则收集，用户点名要的根不参与同形合并、建池时也不被拦。
   *  语义 = 外形完全相同的两个根在方案设计里可能就是两个不同的根，没有任何结构判据能替用户判断。 */
  private 强制独立根 = new Set<string>();

  /** 方案的退化配置：字形判同（部件同形）、切片判定的等价口径，与匹配器同源 */
  get 退化器(): 退化配置 {
    return (this.配置0.analysis as any)?.degenerator ?? 默认退化配置;
  }

  /** 挖掘全部潜在根形状（引擎版，结果按实例+模式缓存）。允许复合体：默认 false（仅叶部件） */
  挖掘切片候选(
    cb?: { on进度?: (已完成: number, 总数: number) => void; 应停止?: () => boolean },
    允许复合体 = false,
  ): 挖掘结果项[] {
    // 缓存键含白名单指纹：换了白名单候选集就变，不能复用
    const 键 = `${允许复合体 ? "复" : "叶"}|${[...this.强制独立根].sort().join("\u0001")}`;
    if (this.切片挖掘缓存?.键 === 键) return this.切片挖掘缓存.结果;
    const 结果 = 挖掘切片候选(this.字库, this.汉字集合, this.频率表, this.退化器, cb, {
      允许复合体,
      强制独立: this.强制独立根,
    });
    if (!(cb?.应停止?.() ?? false)) this.切片挖掘缓存 = { 键, 结果 }; // 中止的半成品不入缓存
    return 结果;
  }

  /** 重码组挖掘：基于当前基态词序列 + 字内部件挖掘缓存。组按伤害降序、全部参与根计分；
   *  根按「从组中分离出的收益」（可消除的重码伤害）降序取 [根起, 根止] */
  重码组挖掘(
    表列表: 评分表输入[],
    cb?: { 应停止?: () => boolean; on阶段?: (文本: string) => void },
    允许复合体 = false,
  ): { 组: 重码组信息[]; 根: 重码根候选[] } {
    const 词序列: [string, { element: string; index: number }[]][] = [];
    for (const [名, 列表] of this.基态词序列)
      for (const j of 列表) 词序列.push([名, JSON.parse(j)]);
    // 切片挖掘的回调形状是 { on进度, 应停止 }，而本方法的 cb 是 { on阶段, 应停止 }：
    // 直接透传会让调用方（worker 的组挖掘分支）收不到进度、也传不进中止信号，故适配一层。
    const 挖掘结果 = this.挖掘切片候选(
      {
        应停止: cb?.应停止,
        on进度: (已完成, 总数) => cb?.on阶段?.(`字内部件挖掘 ${已完成}/${总数} 位置……`),
      },
      允许复合体,
    );
    // 根返回完整收益榜（不切片）：调用方按各自的根起/根止取用，改范围无需重新挖掘
    // 按键数取本方案字母表大小；取域 = 本核心的基态切片，保证挖掘与 评变体 同一口径（含 top）
    return 挖掘重码组根(词序列, 表列表, 4, 挖掘结果, {
      cb,
      按键数: this.按键数,
      取域: (t) => this.表域(t),
    });
  }

  /** 某张表的统计域 = 与 设置基态/评变体 完全同一份切片：类型 → 平铺（按频率降序）→ 前 top。
   *  平铺里没有该类型时按基态词条现算并缓存。于是「表要求词、而词条里没有词」自然得空域：
   *  多字词表表值为 0、全部表退化成一字词——与手动分析/自动搜索同款，不报错、不特判。 */
  private 表域(t: 评分表输入): [string, { element: string; index: number }[]][] {
    const 类型 = 规范表类型(t);
    let 平 = this.基态平铺.get(类型);
    if (!平) {
      平 = this.平铺排序(this.基态词条, 类型);
      this.基态平铺.set(类型, 平);
      if (!this.基态位置.has(类型)) this.基态位置.set(类型, new Map(平.map((x, i) => [x.键, i])));
    }
    const 切片 = t.top && t.top > 0 ? 平.slice(0, Math.min(t.top, 平.length)) : 平;
    return 切片.map((x) => [x.名, JSON.parse(x.j) as { element: string; index: number }[]]);
  }

  // ---------- 贪心搜索 ----------
  搜索(起始mapping: Record<string, any>, 参数: 搜索参数, cb: 搜索回调 = {}): 搜索结果 {
    const 占位 =
      参数.占位安排 ||
      (this.配置0.form.alphabet?.[0] ?? "a").repeat(this.配置0.form.mapping_type ?? 2);
    // 候选池：按「候选字根」的字根表规则并集去重（有字形、非保护根）
    // 动态笔画根：名称映射中元素身份为「笔画」的根名。笔画根的命名与数量随方案而定
    //（双乱 6 类、他案可能 5 类或 10 类，名字任意——双乱 '1'-'6' 甚至不在字库里），
    // 不可写死。自动加根与自动删根都排除笔画根：加根不把笔画当新根，删根不拆笔画基座。
    // 参数.保护根 仍可额外指定受保护根（如用户自定义基座）。
    const 笔画根集 = new Set<string>();
    for (const [名, e] of this.名称映射 as Map<string, any>)
      if (e instanceof 笔画) 笔画根集.add(名);
    const 保护 = new Set([...(参数.保护根 ?? []), ...笔画根集]);
    const 规则列表 =
      参数.字根表列表 ??
      [{ 类型: "字频范围" as const, 起: 1, 止: 参数.高频字数 ?? 200 }];
    const 允许加根总开关 = 参数.允许加根 !== false;
    // 显式白名单 = 「手动指定」规则里的全部根（2026-10-26）。必须在规则循环**之前**收集：
    // 循环里的「重码组挖掘」会调 挖掘切片候选，白名单要参与那一次的候选构建。
    // 语义：用户点名的根，即使外形与已有根完全相同也不合并、不拦——外形相同在方案设计里
    // 可能就是两个不同的根（如自定义 PUA 的「风味土」与「土」），没有结构判据能替他判断。
    this.强制独立根 = new Set<string>();
    for (const 规则 of 规则列表) {
      if (规则.类型 !== "手动指定") continue;
      const 根列表 = Array.isArray(规则.字根) ? 规则.字根 : [...规则.字根];
      for (const w of 根列表) this.强制独立根.add(w);
    }
    const 白名单 = this.强制独立根;
    const 按频单字 = 允许加根总开关
      ? [...this.频率表.entries()].filter(([w]) => [...w].length === 1).sort((a, b) => b[1] - a[1])
      : [];
    const 池Set = new Set<string>();
    // 手动指定里字库找不到（无字形）且非合法元素、被跳过的字，收集后一次性上报 UI（橙条另起一行）
    const 手动指定问题: string[] = [];
    // 每条规则**未经保护根/已有根过滤**的候选名单：初次建池与「每隔 N 轮重建加根池」都从这里取，
    // 保证"重建"与"初次"走同一套过滤（保护根/当前映射），而不是两套代码各滤一遍。
    const 各规则候选: { 规则: 字根表规则; 名单: string[] }[] = [];
    // 预置归并（2026-10-08 用户定案）：配对不变式——配对的根同进同出。
    // 初态先施加不变式（见下），搜索中由随行（B 入带 A）与级联（B 出带 A）维持；
    // 参与者不在（映射∪候选池）的条目判死（筛掉），已在初态产生的改写回滚。
    const 预置归并表: { 根: string; 目标: string; 根位?: number; 目标位?: number; 相似?: boolean }[] = (
      参数.预置归并 ?? []
    ).map((x) => {
      if ((x.根位 == null) !== (x.目标位 == null)) {
        return { 根: x.根, 目标: x.目标 };
      }
      return x;
    });
    // 用户手写条目（规范化后）——相似归并必须让位于它。
    // 缺陷修复（2026-10-20 用户反馈）：相似条目原先直接追加在表尾，两者落在同一根上时是「后写者胜」——
    // 整体边 set 只留最后一个、初态不变式也按顺序覆盖，于是用户写的 a=b 会被静默替换成组内主导根 a=c，
    // 表现为"我写的预置归并 a=b 被扔掉"。现在：用户显式声明过归并的根（整体或半归并都算）与手写反向边，
    // 相似条目一律让位。用户文本里同一根写两条整体归并（a=b 且 a=c）仍由 UI 解析阶段报「根已参与其它归并」拦截。
    const 用户条目 = 预置归并表.slice();
    const 用户条目键 = new Set(用户条目.map((x) => `${x.根}>${x.目标}`));
    // 相似归并并入预置归并：先规定若干条「A = 更常用的 B」（B 主导）。激活组（组内任一成员在候选池或起始映射）
    // 由下方候选池补入后整体归并——A 跟随 B、A 动不了（禁删+锁定）、减 B 级联 A。
    // 注意（用户 2026-10-20 定案）：这**不是**软归并——一旦激活，归并强度与用户手写的硬性预置归并完全一致。
    // 提示口径（用户 2026-10-20 21:39 定案）：**只有「组内根压根不在字根池/不是合法元素」这一种情况静默**；
    // 其余一律提示，且与手写条目同一通道、同一外观（on预置归并失败 的橙框，「根=目标（原因）」格式）——
    // 成环被拆、被手写条目占位而让位，都走这条，不另设"软提示"样式。
    const 相似让位: string[] = [];
    if (参数.自动归并相似根 !== false) {
      for (const group of 相似根分组) {
        const 名s = [...group];
        if (名s.length < 2) continue;
        const 主导 = 名s[0]!; // 组内更常用者置首，作为主导根 B
        for (let i = 1; i < 名s.length; i++) {
          const 根 = 名s[i]!;
          if (根 === 主导) continue;
          const 描述 = `${根}=${主导}`;
          const 占用 = 用户条目.filter((x) => x.根 === 根);
          if (占用.length) {
            // 手写与自动完全同款（同根、同目标、同为整体）→ 本就等价，免掉且不必提示；
            // 其余（不同目标、或手写成半归并）都是真冲突：自动条目让位并提示。
            const 完全同款 = 占用.some((x) => x.根位 == null && x.目标位 == null && x.目标 === 主导);
            if (!完全同款) {
              const 手写 = 占用
                .map((x) => (x.根位 != null ? `${x.根} ${x.根位}=${x.目标} ${x.目标位}` : `${x.根}=${x.目标}`))
                .join("、");
              相似让位.push(`${描述}（自动归并让位：手写 ${手写} 优先）`);
            }
            continue;
          }
          if (用户条目键.has(`${主导}>${根}`)) {
            相似让位.push(`${描述}（自动归并让位：手写 ${主导}=${根} 方向相反）`);
            continue;
          }
          预置归并表.push({ 根, 目标: 主导, 相似: true });
        }
      }
    }
    this.根数惩罚 = 参数.根数惩罚;
    let mapping = { ...起始mapping };
    const 归并码数 = this.配置0.form.mapping_type ?? 2;
    // 实际码长：从映射中已有根取「决策图受理的真实码长」。mapping_type 未正确设置（与根实际码长不一致）时，
    // 借码数组长度仍以真实码长为准，避免 A在&B在 等码位归并因 位数!==归并码数 失守而不触发
    const 实际码长 = (() => {
      for (const v of Object.values(mapping)) {
        if (typeof v === "string") return [...v].length;
        if (Array.isArray(v)) return v.length;
      }
      return 归并码数;
    })();
    // 初态不变式的施加放在候选池筛死之后（见下）：只对活条目施加，判死条目不得动方案
    this.设置基态(mapping); // 必须在候选池之前：重码组挖掘规则需要基态词序列
    // 预置归并前的真实初态总分：此刻 mapping 还是「未施加初态不变式」的起始态，
    // 记下它供「第零轮」展示预置归并带来的分数变化（否则第一轮前分直接显示归并后分数，初态不可见）
    const 初始分 = this.总分基 + this.根数罚分(起始mapping);
    // 重码组挖掘的排行依赖**基态词序列**（随映射变化），所以「重建加根池」时必须重算；
    // 其余规则（字频范围/字内部件/手动指定）与映射无关，重放初次算出的名单即可（省掉整库扫描）。
    const 组挖掘候选 = (规则: Extract<字根表规则, { 类型: "重码组挖掘" }>): string[] => {
      const { 根: 组根 } = this.重码组挖掘(
        参数.表列表,
        { 应停止: () => cb.应停止?.() ?? false, on阶段: (文本) => cb.on阶段?.(文本) },
        规则.允许复合体 !== false,
      );
      return 组根
        .slice(Math.floor(规则.根起) - 1, Math.min(Math.floor(规则.根止), 组根.length))
        .map((x) => x.名);
    };
    for (const 规则 of 规则列表) {
      if (规则.类型 === "重码组挖掘") {
        各规则候选.push({ 规则, 名单: 组挖掘候选(规则) });
        continue;
      }
      if (规则.类型 === "字频范围") {
        const 起 = Math.max(1, Math.floor(规则.起));
        const 止 = Math.max(起, Math.floor(规则.止));
        const 名单: string[] = [];
        for (let i = 起 - 1; i < Math.min(止, 按频单字.length); i++) {
          const w = 按频单字[i]![0];
          if (this.字库.查询字形(this.字符对象映射.get(w))?.length === 0) continue;
          名单.push(w);
        }
        各规则候选.push({ 规则, 名单 });
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
        各规则候选.push({
          规则,
          名单: 候选.slice(起 - 1, Math.min(止, 候选.length)).map((c) => c.名),
        });
      } else if (规则.类型 === "手动指定") {
        // 字根列表两种形态：string[]（新版，一根一名，支持拼音/自定义等多字符元素）与
        // string（旧版单字符串，逐码点一根——仅兼容历史配置）
        const 根列表 = Array.isArray(规则.字根) ? 规则.字根 : [...规则.字根];
        const 名单: string[] = [];
        for (const w of 根列表) {
          const 字符对象 = this.字符对象映射.get(w);
          if (!字符对象 || this.字库.查询字形(字符对象)?.length === 0) {
            // 拼音/自定义元素没有字形，但在名称映射中是合法元素，同样允许入池
            if (!this.名称映射.has(w)) {
              手动指定问题.push(w);
              continue;
            }
          }
          名单.push(w);
        }
        各规则候选.push({ 规则, 名单 });
      }
    }
    // —— 建池(重算挖掘)：初次建池与「每隔 N 轮重建加根池」共用同一套流程 ——
    // 规则名单重放（重码组挖掘按 flag 重算，它的排行依赖基态词序列）→ 保护根/当前映射过滤
    // → 相似＋预置归并拉入 → 同形去重（对着当前映射）。
    const 名到字形 = new Map<string, any>();
    for (const { 字符, 字形列表 } of this.字库 as any) {
      if (!名到字形.has(字符.获取名称())) 名到字形.set(字符.获取名称(), 字形列表?.[0]);
    }
    // 与挖掘去重共用同一套判据（字形同形键 快筛 + 部件同形 定案），两层判据必须一致
    // ——见 字形同形键 注释。只比签名会把「人/入」「目/且」当成同一个根而误拦候选。
    const 形状签名 = (字形: any) => 字形同形键(字形);
    let 池: string[] = [];
    const 建池 = (重算挖掘: boolean) => {
      const 已有根 = new Set(Object.keys(mapping)); // 当前映射（含本轮已加入的根）；起点建池时等于起始映射
      池Set.clear();
      for (const { 规则, 名单 } of 各规则候选) {
        const 有效 = 重算挖掘 && 规则.类型 === "重码组挖掘" ? 组挖掘候选(规则) : 名单;
        for (const 名 of 有效) {
          if (保护.has(名) || 已有根.has(名)) continue;
          池Set.add(名);
        }
      }
      // 相似归并候选池补入：组内任一成员已在候选池或起始映射，则把其余成员也拉入候选池，
      // 保证「A=更常用的 B」两边都能成为根/别名（B 主导，A 跟随）；整组都没入选则保持休眠（不强行拉入）。
      if (参数.自动归并相似根 !== false) {
        for (const group of 相似根分组) {
          const 名s = [...group];
          if (名s.length < 2) continue;
          if (名s.some((n) => 池Set.has(n) || mapping[n] !== undefined)) {
            for (const n of 名s) 池Set.add(n);
          }
        }
      }
      // 预置归并放宽（用户 2026-10-11）：只要「后者/目标」在册（在映射或候选池）、且两边都是合法元素，
      // 就把「前者/根」也补进候选池——不强行要求前者本来就在池里（条件松一点，实际用起来更舒服）。
      // （相似归并已在上面按「组内任一在则全拉入」处理；此处覆盖用户手写的硬预置归并。）
      for (const x of 预置归并表) {
        if (x.根 === x.目标) continue;
        if (!this.名称映射.has(x.根) || !this.名称映射.has(x.目标)) continue;
        if (mapping[x.目标] === undefined && !池Set.has(x.目标)) continue; // 目标不在册 → 该归并本就无法应用，不动
        if (mapping[x.根] === undefined) 池Set.add(x.根); // 前者入池（在册判定即通过）
      }
      // 同形去重：与已有根（含别名）**真同形**的字形不是新根（如 ⼆/二/PUA 变体）。
      // 签名只做快筛（不同签名必然不同形）；同签名还要官方切片双向互测通过才算同形，
      // 否则「人/入」「目/且」「口/囗」「土/士」这类签名相同的不同根会被误拦（2026-10-25 修）。
      // **两边任一在 特殊字根名 / 白名单 里就不拦（2026-10-26）**：前者切片能力受名字影响
      // （土 只认土、⼟/U+F000 土士通吃，合并就丢了"通吃"），后者是用户点名的根。
      const 退化器 = this.退化器;
      const 豁免 = (名: string) => 特殊字根名.has(名) || 白名单.has(名);
      const 已有按签名 = new Map<string, { 名: string; 字形: any }[]>();
      for (const 名 of Object.keys(mapping)) {
        const 字形 = 名到字形.get(名);
        const 签名 = 形状签名(字形);
        if (!签名 || 豁免(名)) continue; // 豁免的已有根不作为"重复项"去拦别人
        const e = 已有按签名.get(签名);
        if (e) e.push({ 名, 字形 });
        else 已有按签名.set(签名, [{ 名, 字形 }]);
      }
      池 = 允许加根总开关
        ? [...池Set].filter((w) => {
            if (豁免(w)) return true;
            const 字形 = 名到字形.get(w);
            const 签名 = 形状签名(字形);
            if (!签名) return true; // 复合体/空壳/单笔画：不参与同形
            const 同签名已有 = 已有按签名.get(签名);
            if (!同签名已有) return true;
            return !同签名已有.some((x) => 部件同形(x.字形, 字形, 退化器));
          })
        : [];
    };
    建池(false); // 初次：名单刚由上面的规则循环算出，重码组挖掘无需再跑一遍
    if (手动指定问题.length)
      cb.on手动指定问题?.(`手动指定失败：${手动指定问题.join("，")}（不是字库中的合法元素）`);
    if (cb.应停止?.()) {
      return { mapping: { ...起始mapping }, 总分: Math.round(this.总分基 * 100) / 100, 轮日志: [], 收敛: false, 已停止: true, 建议: null };
    }
    // 预置归并筛选：参与者都得是（或能成为）字根——在映射里或进了候选池，否则永远无法应用，
    // 判死并在绿框说明；判死条目完全不参与初态不变式（死条目不该动方案）
    const 在册 = (名: string) => mapping[名] !== undefined || 池Set.has(名);
    // 根当前真实码长（码位数）：字符串取字符数、借码数组取长度、整体别名沿用目标码长；
    // 每个根的码数可能不同。未成根（不在映射）返回 null，留给成根后再校验，避免误报。
    const 码长 = (名: string): number | null => {
      const v = mapping[名];
      if (v === undefined) return null;
      if (typeof v === "string") return [...v].length;
      if (Array.isArray(v)) return v.length;
      if (v && typeof v === "object" && "element" in (v as object)) {
        const tv = mapping[(v as { element: string }).element];
        if (typeof tv === "string") return [...tv].length;
        if (Array.isArray(tv)) return tv.length;
      }
      return null;
    };
    // 侧界：某根「真实码长」的上界——已落库（在 mapping）按实际码长；尚未成根（候选根，搜索期会被占位补齐）按 占位安排 的码数。
    // 半归并两边的根都可能是还没加进去的候选根；候选根由 变体mapping 赋 占位（长度=占位安排码数），故用 占位.length 兜底其将拥有的码长。
    const 侧界 = (名: string): number => 码长(名) ?? 占位.length;
    // 整体边 / 反整体边 / 随行者 在「环检测」之后构建（见下）：必须用**清洗后的待归并条目**，
    // 否则被判死（含成环）的整体条目仍会经「随行者」在加根时生效，造成"显示了失败却仍被使用"。
    const 待归并: { 条目: (typeof 预置归并表)[number]; 描述: string }[] = [];
    const 死归并: string[] = [];
    for (const x of 预置归并表) {
      const 是码位 = x.根位 != null && x.目标位 != null;
      const 描述 = 是码位 ? `${x.根} ${x.根位}=${x.目标} ${x.目标位}` : `${x.根}=${x.目标}`;
      const 死因 =
        x.根 === x.目标
          ? "根和目标是同一个字"
          : !this.名称映射.has(x.根)
            ? `「${x.根}」不是字库中的合法元素`
            : !this.名称映射.has(x.目标)
              ? `「${x.目标}」不是字库中的合法元素`
              : !在册(x.根)
                ? `「${x.根}」不在字根池`
                : !在册(x.目标)
                  ? `「${x.目标}」不在字根池`
                  : null;
      if (死因) {
        // 只有"参与者压根不在字根池/不是合法元素"这一类静默（不刷橙框）——相似归并的休眠组正在此列；
        // 其余（成环、被手写占位等）一律按手写条目的同款格式上报，见上方注入处与环检测
        if (!x.相似) 死归并.push(`${描述}（${死因}）`);
      } else 待归并.push({ 条目: x, 描述 });
    }
    // 环检测：预置归并引用图（每条 根→目标 算一条边）若成环，线性化会报「循环依赖」——
    // 借码环（A 1=B 2 且 B 1=A 2）/整体环（A=B 且 B=A）施加后映射不可线性化。
    // 判据：**只有"根自己就在环上"（沿边能回到自己）的条目才判死拆掉**——拆掉环上条目后，环节点回归普通根，
    // 那些"只是指向环"的条目（如 三=四 而 四 在环上）就有效了，不该被误杀。
    {
      const 边图 = new Map<string, string[]>();
      const 加边 = (a: string, b: string) => {
        const 列 = 边图.get(a);
        if (列) 列.push(b);
        else 边图.set(a, [b]);
      };
      // 起始映射里已有的整体别名也算边（可能与预置归并连成环）
      for (const [k, v] of Object.entries(起始mapping)) {
        if (v && typeof v === "object" && !Array.isArray(v) && typeof (v as any).element === "string") 加边(k, (v as { element: string }).element);
      }
      for (const { 条目: x } of 待归并) 加边(x.根, x.目标);
      // 起 是否在环上：从 起 出发，沿边能否回到 起（图作为参数传入，拆环时可用"摘过边"的更新图）
      const 在环上 = (图: Map<string, string[]>, 起: string): boolean => {
        const 见 = new Set<string>();
        const 栈 = [...(图.get(起) ?? [])];
        while (栈.length) {
          const u = 栈.pop()!;
          if (u === 起) return true;
          if (见.has(u)) continue;
          见.add(u);
          for (const v of 图.get(u) ?? []) 栈.push(v);
        }
        return false;
      };
      // 拆环顺序（"手写优先"的延伸，2026-10-20 定案）：**先拆自动（相似）条目，再拆手写条目**——
      // 自动归并是默认值，不能因为它的存在把用户手写的归并链一起判死。两个阶段都不静默，都按手写同款格式上报。
      //  · 第一阶段拆自动条目时同步摘边：已删的自动边不该继续把后面的条目判成环（否则手写链被连坐）；
      //  · 第二阶段拆手写条目时**不动图**：同一批手写环仍按原语义全判死（不因为先删了一条就放过另一半）。
      const 拆环 = (只拆自动: boolean, 拆时摘边: boolean) => {
        const 图 = 拆时摘边 ? 边图 : new Map([...边图].map(([k, v]) => [k, [...v]]));
        for (let j = 待归并.length - 1; j >= 0; j--) {
          const 项 = 待归并[j]!;
          if ((项.条目.相似 === true) !== 只拆自动) continue;
          if (!在环上(图, 项.条目.根)) continue;
          死归并.push(`${项.描述}（循环依赖：归并引用成环，无法线性化）`);
          待归并.splice(j, 1);
          if (拆时摘边) {
            const 列 = 图.get(项.条目.根);
            if (列) {
              const i = 列.indexOf(项.条目.目标);
              if (i >= 0) 列.splice(i, 1);
              if (列.length === 0) 图.delete(项.条目.根);
            }
          }
        }
      };
      拆环(true, true); // 第一阶段：自动归并让位
      拆环(false, false); // 第二阶段：剩下的（手写/起始别名）仍成环 → 照旧判死并上报
    }
    // 整体边：根 → 直接整体目标（来源 = 起始映射别名 + **清洗后的待归并整体条目**；判死的（含成环）不进，
    // 保证"显示的失败"与"真实施加的逻辑"一致）。
    const 整体边 = new Map<string, string>();
    for (const [k, v] of Object.entries(起始mapping)) {
      if (v && typeof v === "object" && !Array.isArray(v) && typeof (v as any).element === "string") 整体边.set(k, (v as { element: string }).element);
    }
    for (const { 条目: x } of 待归并) if (x.根位 == null && x.目标位 == null) 整体边.set(x.根, x.目标);
    // 反整体边（反向邻接）：目标 → 直接整体归并到它的根们。随机访问用它，避免每次全扫整体边（原 O(整体边²)）。
    const 反整体边 = new Map<string, string[]>();
    for (const [根, 目标] of 整体边) {
      const 列 = 反整体边.get(目标);
      if (列) 列.push(根);
      else 反整体边.set(目标, [根]);
    }
    // 随行者(c)：c 入映射时，应随之入的归根们（沿反整体边传递地收集所有归并到 c 的根），按"从底到顶"排序（离 c 近者先）。
    // 只走整体边——半根不随入（半根走它自己的独立动作）。复杂度 O(跟随者数 · log)，与整体边总数无关。
    const 随行者 = (c: string): string[] => {
      const 果: { 根: string; 深: number }[] = [];
      const 见 = new Set<string>();
      const 栈: [string, number][] = (反整体边.get(c) ?? []).map((r) => [r, 1]);
      while (栈.length) {
        const [u, d] = 栈.pop()!;
        if (见.has(u)) continue;
        见.add(u);
        果.push({ 根: u, 深: d });
        for (const v of 反整体边.get(u) ?? []) if (!见.has(v)) 栈.push([v, d + 1]);
      }
      return 果.sort((a, b) => a.深 - b.深).map((x) => x.根);
    };
    // 死归并（参与者不都成根）先收集；与下方「被踢出导致无法拆分」的失败合并到同一条橙框消息，统一以「根=目标（原因）」格式上报（早于搜索开始，强杀也不会丢）
    // —— 初态不变式（只施加于活条目）——
    // 整体 A=B：B 在映射 ⇒ A 以 {element:B} 入/转（AB 同在）；B 不在 ⇒ A 被踢出（A 只能跟随 B 存在）
    // 码位 A 1=B x：B 在映射 ⇒ A 在映射时安排改写为借码（A 不在则不入，等 B 在后经加根带借码）；
    //              B 不在 ⇒ A 被踢出（B 入后 A 才被允许入）
    // 成链时反复施加直至稳定。踢出可能让部分字无法拆分（需要 A 的字失去唯一拆法）——
    // 试建基态失败则该预置归并判失败（经 on预置归并失败 在橙框说明原因）；被踢的根回滚保留为独立根（否则部分字无法拆分）。
    // 初态删除集：记录初态被踢出（含级联引用者）的根，失败回滚时一并恢复到起始状态
    const 初态删除集 = new Set<string>();
    // 引用闭包：把「（传递）引用 删集 中根的根」也纳入 删集——整体别名 {element:X}、码位借码数组里的 {element:X} 都引用 X。
    // A 被踢出时，归并/借码到 A 的根必须一并随出，否则留下悬空引用会让决策图崩。
    const 引用闭包 = (删集: Set<string>) => {
      let 变了 = true;
      while (变了) {
        变了 = false;
        for (const [k, v] of Object.entries(mapping)) {
          if (删集.has(k)) continue;
          const refs = new Set<string>();
          收集引用(v, refs);
          for (const r of refs) {
            if (删集.has(r)) { 删集.add(k); 变了 = true; break; }
          }
        }
      }
    };
    const 被踢: (typeof 预置归并表)[number][] = [];
    {
      for (let 遍 = 0; 遍 < 8; 遍++) {
        let 变了 = false;
        for (const { 条目: x } of 待归并) {
          const B在 = mapping[x.目标] !== undefined;
          const A在 = mapping[x.根] !== undefined;
          if (B在 && !A在) {
            if (x.根位 == null || x.目标位 == null) {
              mapping[x.根] = { element: x.目标 }; // 整体：随 B 入（别名形态）
              变了 = true;
            }
            // 码位：A 不在则不入（等 B 在后经加根带借码），初态无事可做
          } else if (B在 && A在) {
            if (x.根位 == null || x.目标位 == null) {
              if (JSON.stringify(mapping[x.根]) !== JSON.stringify({ element: x.目标 })) {
                mapping[x.根] = { element: x.目标 }; // 整体：转为跟随 B
                变了 = true;
              }
            } else {
              const 原 = mapping[x.根];
              if (typeof 原 === "string" || Array.isArray(原)) {
                // 借码安排长度以「根自身实际码长」为准——A 已在映射里、其长度已被决策图受理，
                // 故用 位数 而非固定的 归并码数（mapping_type 可能未正确设置，导致 位数===归并码数 失守、A在&B在 时归并不触发）
                const 位数 = typeof 原 === "string" ? [...原].length : 原.length;
                // 根位落在 A 自身码长内；目标位落在 B 自身码长内（每个根码数可能不同，不能用 A 的码长兜底 B）
                const 长B = 码长(x.目标);
                if (
                  x.根位! >= 1 && x.根位! <= 位数 && x.目标位! >= 1 && x.目标位! <= (长B ?? 0)
                ) {
                  const 目标状态 = Array.from({ length: 位数 }, (_, i) =>
                    i === x.根位! - 1
                      ? { element: x.目标, index: x.目标位! - 1 }
                      : typeof 原 === "string"
                        ? [...原][i]!
                        : 原[i],
                  );
                  if (JSON.stringify(目标状态) !== JSON.stringify(原)) {
                    mapping[x.根] = 目标状态; // 码位：安排改写为借码
                    变了 = true;
                  }
                }
              }
            }
          } else if (!B在 && A在) {
            // 被踢出：跟随 B 入出。级联——引用 A 的根（整体别名 C={element:A} / 码位借码 C 数组引用 A）一并随出，避免悬空引用
            const 删集 = new Set<string>([x.根]);
            引用闭包(删集);
            for (const k of 删集) {
              初态删除集.add(k);
              delete mapping[k];
            }
            被踢.push(x);
            变了 = true;
          }
        }
        if (!变了) break;
      }
    }
    // 半归并码位存在性检测（用户 2026-10-10 定案）：A、B 均已成根时，
    // 根位必须落在 A 自身真实码长内、目标位必须落在 B 自身真实码长内（每个根码数可能不同）。
    // 越界条目从待归并移出并计入死归并，经 on预置归并失败 在橙框上报；尚未成根的延后（加根/触发段另有守卫）。
    for (let j = 待归并.length - 1; j >= 0; j--) {
      const 项 = 待归并[j];
      if (!项) continue;
      const x = 项.条目;
      if (x.根位 == null || x.目标位 == null) continue; // 整体归并不走码位
      // 两边的根都可能是「还没加进去的候选根」：已落库按真实码长，候选根按归并码数（其搜索期将被补齐的码长）判定上界
      const 界A = 侧界(x.根);
      const 界B = 侧界(x.目标);
      // 两侧各自独立判定越界：1 码的根第 1 位合法，不可与越界侧混报
      const 根越界 = x.根位 < 1 || x.根位 > 界A;
      const 目标越界 = x.目标位 < 1 || x.目标位 > 界B;
      if (根越界 || 目标越界) {
        const 片段: string[] = [];
        if (根越界) 片段.push(`「${x.根}」共 ${界A} 码无第 ${x.根位} 位`);
        if (目标越界) 片段.push(`「${x.目标}」共 ${界B} 码无第 ${x.目标位} 位`);
        死归并.push(`${项.描述}（码位不存在：${片段.join("；")}）`);
        待归并.splice(j, 1);
      }
    }
    if (被踢.length) {
      try {
        this.设置基态(mapping);
      } catch (e) {
        // 踢出导致部分字无法拆分：该预置归并直接判失败失效（从待归并移出，后续轮首触发/加根随行不再施加），
        // 并把初态删掉的所有根（被踢 + 级联引用者）回滚到起始状态，保留为独立根（否则部分字无法拆分）
        for (const 根 of 初态删除集) {
          if (起始mapping[根] === undefined) delete mapping[根];
          else mapping[根] = 起始mapping[根];
        }
        for (const x of 被踢) {
          const idx = 待归并.findIndex((y) => y.条目 === x);
          if (idx >= 0) 待归并.splice(idx, 1);
        }
        this.设置基态(mapping);
        死归并.push(
          `${被踢
            .map((x) => {
              const 描述 = x.根位 != null && x.目标位 != null ? `${x.根} ${x.根位}=${x.目标} ${x.目标位}` : `${x.根}=${x.目标}`;
              return `${描述}（初态「${x.根}」随「${x.目标}」出元素序列，导致部分字无法拆分）`;
            })
            .join("；")}`,
        );
      }
    }
    // 半-3：既有根 A 因半归并悬空被踢出后，放回候选池（B 入后 A 才可再被加入，同半-1→半-2）。
    // 失败回滚、仍留在映射里的不算（判 mapping[根]===undefined），避免把已存在的根误当候选。
    for (const x of 被踢) {
      if (mapping[x.根] === undefined && !池.includes(x.根)) {
        池.push(x.根);
        池Set.add(x.根);
      }
    }
    // 死归并、被踢失败、自动归并让位 合并为同一条橙框消息（「根=目标（原因）」格式，；连接），行为统一；
    // 让位消息排在前面（它是注入期就判定的），再接运行期判死的条目
    if (死归并.length || 相似让位.length) cb.on预置归并失败?.(`预置归并失败：${[...相似让位, ...死归并].join("；")}`);
    // 预置归并处理已改写 mapping（别名/借码安排/被踢回滚）；以其结果重设基态，
    // 否则 总分基 仍停留在未归并的初态，导致 当前分 与轨迹「初态」分数显示错误
    try { this.设置基态(mapping); } catch { /* 维持未归并初态基态，保持既有语义 */ }
    let 当前分 = this.总分基 + this.根数罚分(mapping);
    const 轮日志: 轮结果[] = [];
    let 收敛 = false, 已停止 = false;
    let 建议动作: { 动作: string; 分数: number; mapping: Record<string, any> } | null = null;
    let 轮序 = 0;
    const 重建间隔 = Math.max(0, Math.floor(参数.重建加根池间隔 ?? 0)); // 0 = 不重建
    // 每轮结束（动作已应用到 mapping）后拍一份快照，供主线程强杀后抓包还原已选好的根
    const 快照 = () => JSON.parse(JSON.stringify(mapping)) as Record<string, any>;
    // 第零轮：把预置归并处理单列一行，展示其对初态分数的影响；否则第一轮前分直接显示归并后分数，初态分数无从可见。
    // 动作文字逐条列出真正生效的归并条目（用户 2026-10-20 定案）：表序天然是「先手写、后自动」（相似条目追加在尾），
    // 因此列表顺序本身就体现了「手写优先」，外观上不再区分来源。
    // 只有确实有预置归并要处理（待归并非空）时才加这一轮——没有任何预归并时不显示，避免 0 变化噪声行。
    if (待归并.length > 0) {
      const 轮零: 轮结果 = {
        轮: 0,
        动作: `预置归并处理：${待归并.map((x) => x.描述).join("，")}`,
        分数: Math.round(当前分 * 100) / 100,
        前分: Math.round(初始分 * 100) / 100,
        变化: Math.round((当前分 - 初始分) * 100) / 100,
        根数: Object.keys(mapping).length,
        动作数: 0,
        耗时: 0,
        mapping: 快照(),
      };
      轮日志.push(轮零);
      cb.on轮?.(轮零);
    }
    // 零变化容差：与轨迹显示精度一致（分数保留 2 位小数，|Δ| < 0.005 显示为 0）。
    // 「减根变化为零不停」按显示零判定——真实 +0.004 的减根轨迹上就是 0，按 1e-9 判会误停（显得太硬）
    const 零变化容差 = 0.005;
    while (轮序 < 参数.轮数) {
      if (cb.应停止?.()) { 已停止 = true; break; }
      // 预置归并触发（码位改写，不占轮数）：目标已成根但安排还没借码的，自动生效、代价如实计分。
      // （整体归并的生效由初态不变式 + 加根随行 + 级联覆盖，无需在此触发）
      const 触发 = 待归并.filter(({ 条目: x }) => {
        if (x.根位 == null || x.目标位 == null) return false; // 整体：随行/初态已覆盖
        if (mapping[x.目标] === undefined) return false;
        const 原 = mapping[x.根];
        if (原 === undefined || (typeof 原 !== "string" && !Array.isArray(原))) return false;
        const 根位 = x.根位, 目标位 = x.目标位;
        if ((typeof 原 === "string" ? [...原].length : 原.length) !== 实际码长) return false;
        // 根位落在 A 码长内；目标位落在 B 自身码长内（每个根码数可能不同；候选根按归并码数计）
        const 界B触发 = 侧界(x.目标);
        if (根位 < 1 || 根位 > 实际码长 || 目标位 < 1 || 目标位 > 界B触发) return false;
        const 目标状态 = Array.from({ length: 实际码长 }, (_, i) =>
          i === 根位 - 1 ? { element: x.目标, index: 目标位 - 1 } : typeof 原 === "string" ? [...原][i] : 原[i]);
        return JSON.stringify(目标状态) !== JSON.stringify(原);
      });
      if (触发.length) {
        const 前分0 = 当前分;
        const 描述列表: string[] = [];
        for (const { 条目: x } of 触发) {
          const 原 = mapping[x.根];
          const 根位 = x.根位!, 目标位 = x.目标位!;
          const 新安排 = Array.from({ length: 实际码长 }, (_, i) =>
            i === 根位 - 1 ? { element: x.目标, index: 目标位 - 1 } : typeof 原 === "string" ? [...原][i]! : 原[i]);
          mapping[x.根] = 新安排;
          // 触发描述用「根=安排」用户语法（自由位保留原码）；加「+」前缀，与加根显示统一，避免轨迹里出现无符号的 根=(…)
          描述列表.push(`+${根安排描述(x.根, 新安排)}`);
          待归并.splice(待归并.findIndex((y) => y.条目 === x), 1);
        }
        const 评 = this.评变体(mapping) as any;
        if (!("失败" in 评)) 当前分 = 评.总分 + this.根数罚分(mapping);
        const 轮r: 轮结果 = {
          轮: 轮序 + 1,
          动作: 描述列表.join("、"),
          分数: Math.round(当前分 * 100) / 100,
          前分: Math.round(前分0 * 100) / 100,
          变化: Math.round((当前分 - 前分0) * 100) / 100,
          根数: Object.keys(mapping).length,
          动作数: 0,
          耗时: 0,
          mapping: 快照(),
        };
        轮日志.push(轮r);
        cb.on轮?.(轮r);
        try { this.设置基态(mapping); } catch { /* 触发改写若致无法拆分，保持既有基态，避免抛到 worker 外 */ }
        continue; // 触发不消耗轮数
      }
      轮序++;
      const 轮 = 轮序;
      // 每隔 N 轮重建一次加根池（用户 2026-10-22）：时序「建，1，2，建，3，4，建……」——
      // 第 1 轮用初始池，之后每跑满 N 轮、在下轮开始前重建；0/空 = 不重建。
      // 基态不用另建：码位归并触发段（上面 continue 之前）与上一轮末尾都已 设置基态(mapping)，
      // 此处基态就是当前映射，重码组挖掘直接按它重排即可。
      // **这两步的顺序不能反**：建池里的「重码组挖掘」读的是 基态词序列（分离收益按当前映射的组结构算），
      // 所以必须「先 设置基态(mapping)，再 建池(true)」——与初次建池同一顺序（见 搜索 开头那行）。
      // 若反过来先建池，重码组挖掘会用上一轮的基态，排行整整滞后一轮（正是本轮刚加的那根看不见）。
      if (重建间隔 > 0 && 轮 > 1 && (轮 - 1) % 重建间隔 === 0) {
        cb.on阶段?.(`第 ${轮} 轮：重建加根池（每 ${重建间隔} 轮一次）……`);
        建池(true);
        if (cb.应停止?.()) { 已停止 = true; break; }
      }
      const 范围文本 = (参数.减根范围 ?? "").trim();
      let 减根正则: RegExp | null = null;
      if (范围文本) {
        try {
          减根正则 = new RegExp(范围文本, "u");
        } catch {
          // 无效正则必须炸而不是降级：静默忽略会让「想限制范围」变成「全部可减」
          throw new Error(`减根范围「${范围文本}」不是有效正则`);
        }
      }
      // 预置归并配对根禁止单独删除（纯归并 A 跟着 B 出）：整体条目的根只能经级联随 B 消失
      const 禁删 = new Set(
        待归并.filter(({ 条目: x }) => x.根位 == null || x.目标位 == null).map(({ 条目: x }) => x.根),
      );
      // 可直接删的根：值为 string（普通根）或 数组（码位借码安排——归入根可单独出，见 A 1=B 1 第五/六种情况）；
      // 整体系数别名 {element:B} 是对象、不在其列（须随 B 出，且已列入 禁删）——故 A=B 整体归入的根绝不被单独删除
      const 直设根 = Object.keys(mapping).filter((k) => typeof mapping[k] === "string" || Array.isArray(mapping[k]));
      const 可删 = 直设根.filter(
        (k) => !保护.has(k) && !禁删.has(k) && (!减根正则 || 减根正则.test(k)),
      );
      const 在集 = new Set(Object.keys(mapping)); // 含别名：已是任何形式条目的字不能再加
      // 预置归并锁定：待归并条目里目标还没成根的，其根禁止单独入映射（纯归并 A 绝不单独出入；
      // 码位 A 要等 B 入后才被允许入）——只能随目标一起进，或等目标成根后解锁
      const 锁定 = new Set(
        待归并.filter(({ 条目: x }) => mapping[x.目标] === undefined).map(({ 条目: x }) => x.根),
      );
      const 可加 = 池.filter((k) => !在集.has(k) && !锁定.has(k));
      const 允许加根 = 参数.允许加根 !== false;
      const 允许减根 = 参数.允许减根 !== false;
      // 整体随行改用全局「随行者(c)」（见上）：加 c 时沿整体边把整条链的归根一并带入，
      // 支持任意深度的链与分支（H→I、J→I），中途不再逐轮补层、也不再把整体根退化成普通占位。
      const 动作: { 加: string[]; 删: string[]; 描述: string; m: Record<string, any>; 随行?: string[] }[] = [];
      if (允许减根)
        for (const r of 可删) {
          const m0 = this.变体mapping(mapping, [], [r], 占位);
          // B 出经级联把跟随它的别名/借码根一并删掉（A 动不了、减 B 级联 A）——轮次表要同步显示，否则逻辑与显示不一致
          const 连带 = Object.keys(mapping).filter((k) => !(k in m0) && k !== r);
          // 显示顺序统一：整体-归并到 r 的归根按"从底到顶"（随行者(r) 已排好），其余（半根等）随后
          const 随行序 = 随行者(r);
          const 有序连带 = [
            ...随行序.filter((k) => 连带.includes(k)),
            ...连带.filter((k) => !随行序.includes(k)),
          ];
          const 描述 = 有序连带.length
            ? `-${r}，${有序连带.map((k) => 根安排描述(k, mapping[k])).join("，")}`
            : `-${r}`;
          动作.push({ 加: [], 删: [r, ...连带], 描述, m: m0 });
        }
      if (允许加根)
        for (const c of 可加) {
          const m0 = this.变体mapping(mapping, [c], [], 占位);
          // 描述段：普通加根 +根；归并/借码类用「根=安排」用户语法（与差异区安排调整同款）
          const 段: string[] = [`+${c}`];
          // 预置归并随行：加 c 时，沿整体边传递地把它整条链的归根一并带入（任意深度/分支），各归其直接目标
          const 随行根 = 随行者(c).filter((根) => mapping[根] === undefined);
          if (随行根.length) {
            for (const 根 of 随行根) m0[根] = { element: 整体边.get(根)! };
            段.push(...随行根.map((根) => `${根}=${整体边.get(根)!}`));
          }
          // 预置归并码位随行：新根入库即带上借码安排（目标已是字根时）；目标未成根则先普通入库，
          // 借码安排等目标成根后作为独立动作再来。与整体随行独立（c 可同时是整体目标与半根）。
          // 同一根可有多个半借位（如 九 1=三 2 且 九 2=三 1）——取该根**全部**半条目，一次合并写入一条数组。
          const 该根半条目 = 待归并.filter(
            ({ 条目: x }) => x.根 === c && x.根位 != null && x.目标位 != null && mapping[x.目标] !== undefined,
          );
          if (该根半条目.length) {
            // 码位存在性守卫：根位落在 c 码长内、目标位落在各自目标码长内（每根码数可能不同；候选根按 侧界 计）。
            // 任一条目越界则不施加借码、按普通加根入库，并在橙框上报——避免静默错借。
            const 界A加 = 侧界(c);
            const 越界段: string[] = [];
            for (const { 条目: x } of 该根半条目) {
              const 界B加 = 侧界(x.目标);
              if (x.根位! < 1 || x.根位! > 界A加) 越界段.push(`「${x.根}」共 ${界A加} 码无第 ${x.根位} 位`);
              if (x.目标位! < 1 || x.目标位! > 界B加) 越界段.push(`「${x.目标}」共 ${界B加} 码无第 ${x.目标位} 位`);
            }
            if (越界段.length === 0) {
              const 列 = 该根半条目.map(({ 条目: x }) => x);
              m0[c] = Array.from({ length: 占位.length }, (_, i) => {
                const e = 列.find((z) => z.根位 === i + 1);
                return e ? { element: e.目标, index: e.目标位! - 1 } : (占位[i] ?? 占位[0]!);
              });
              段[0] = `+${根安排描述(c, m0[c])}`; // 保留加根 + 前缀（与普通加根/差异区新增根统一）
            } else {
              const 条目文本 = 该根半条目.map(({ 条目: x }) => `${x.根} ${x.根位}=${x.目标} ${x.目标位}`).join("；");
              cb.on预置归并失败?.(
                `预置归并失败：${条目文本}（码位不存在：${[...new Set(越界段)].join("；")}）`,
              );
            }
          }
          动作.push({ 加: [c], 删: [], 描述: 段.join("，"), m: m0, 随行: 随行根 });
        }
      // 预置归并不作为候选动作：它是用户预设的义务，条件满足就在轮首自动生效（见轮首触发段），
      // 代价如实计分但不由分数竞争否决
      if (动作.length === 0) {
        收敛 = true;
        break;
      }
      const t0 = Date.now();
      let best = -1, best分 = Infinity;
      const 各动作分: number[] = [];
      for (let i = 0; i < 动作.length; i++) {
        if (cb.应停止?.()) { 已停止 = true; break; }
        const r = this.评变体(动作[i]!.m);
        const 分 = "失败" in r ? Infinity : r.总分 + this.根数罚分(动作[i]!.m);
        各动作分.push(分);
        if (分 < best分) { best分 = 分; best = i; }
        // 每个动作都报进度：大词库下单动作可达十几秒，每 10 个才报会在轮首造成长时间静默
        cb.on轮进度?.(i + 1, 动作.length, best === -1 ? "—" : 动作[best]!.描述, best分, best === -1 ? null : best分 - 当前分);
      }
      if (已停止) break;
      const 单轮根数 = Math.max(1, Math.floor(参数.单轮根数 ?? 1));
      if (单轮根数 > 1) {
        // 单轮多根：取改善最多的前 K 个「加根」动作同时应用（按各自单加收益降序选，
        // 组合后整体合评——根间相互作用使合评分 ≠ 各自单加之和，以合评为准）。
        // 减根不参与多选（一次删多个容易破坏拆分，探索收益低）
        const 改善加根 = 动作
          .map((a, i) => ({ a, i, 分: 各动作分[i]! }))
          .filter((x) => x.a.加.length > 0 && isFinite(x.分) && x.分 < 当前分 - 1e-9)
          .sort((x, y) => x.分 - y.分)
          .slice(0, 单轮根数);
        if (改善加根.length > 1) {
          const 组合m = this.变体mapping(mapping, 改善加根.map((x) => x.a.加).flat(), [], 占位);
          // 随行归并：选中动作里带归并的（自动归并相似根/预置归并随行）把各自安排也带进组合。
          // 归根各自指向"它的直接整体目标"（链结构），不能一律指向 a.加[0]，故直接抄动作自带的 a.m。
          for (const { a } of 改善加根) {
            for (const k2 of a.加)
              if (组合m[k2] !== undefined) 组合m[k2] = a.m[k2];
            for (const 根 of a.随行 ?? []) if (a.m[根] !== undefined) 组合m[根] = a.m[根];
          }
          const 合评 = this.评变体(组合m);
          if (!("失败" in 合评)) {
            const 合评分 = 合评.总分 + this.根数罚分(组合m);
            const 前分0 = 当前分;
            if (合评分 < 前分0 - 1e-9) {
              mapping = 组合m;
              当前分 = 合评分;
              const 轮r: 轮结果 = {
                轮,
                动作: 改善加根.map((x) => x.a.描述).join("，"),
                分数: Math.round(合评分 * 100) / 100,
                前分: Math.round(前分0 * 100) / 100,
                变化: Math.round((合评分 - 前分0) * 100) / 100,
                根数: Object.keys(mapping).length,
                动作数: 动作.length,
                耗时: (Date.now() - t0) / 1000,
                单加明细: 改善加根.map((x) => ({
                  描述: x.a.描述,
                  预期变化: Math.round((x.分 - 前分0) * 100) / 100,
                })),
                mapping: 快照(),
              };
              轮日志.push(轮r);
              cb.on轮?.(轮r);
              this.设置基态(mapping);
              continue;
            } else {
            }
          } else {
          }
        }
      }
      const 耗时 = (Date.now() - t0) / 1000;
      if (!isFinite(best分) || best === -1 || best分 >= 当前分 - 1e-9) {
        // 无代价减根：删根动作且分数变化在显示零范围内（|Δ|<0.005，轨迹显示 0）→ 免费缩小根集，直接应用并继续搜索（不算停止）。
        // 用户定案：减根变化为零时不该停、只有变化大于零（变差）才停——零按显示精度判定，而非 1e-9。
        // 优先取全局最优 best；否则在动作里任取一个零变化减根，避免与零变化加根并列时漏掉可免费剪枝者。
        const 前分 = 当前分;
        const 无代价减根 = (() => {
          if (best !== -1 && isFinite(best分) && Math.abs(best分 - 当前分) < 零变化容差 && 动作[best]!.删.length > 0)
            return { 动作: 动作[best]!, 分: best分 };
          const i = 动作.findIndex(
            (a, idx) =>
              a.删.length > 0 && isFinite(各动作分[idx]!) && Math.abs(各动作分[idx]! - 当前分) < 零变化容差,
          );
          return i >= 0 ? { 动作: 动作[i]!, 分: 各动作分[i]! } : null;
        })();
        if (无代价减根) {
          mapping = 无代价减根.动作.m;
          当前分 = 无代价减根.分;
          const 轮r: 轮结果 = {
            轮,
            动作: 无代价减根.动作.描述,
            分数: Math.round(无代价减根.分 * 100) / 100,
            前分: Math.round(前分 * 100) / 100,
            变化: Math.round((无代价减根.分 - 前分) * 100) / 100,
            根数: Object.keys(mapping).length,
          动作数: 动作.length,
          耗时,
          mapping: 快照(),
        };
        轮日志.push(轮r);
        cb.on轮?.(轮r);
          continue; // 继续搜：可能还有更多无代价减根或真正的改进
        }
        收敛 = true;
        // 轮显示统一：没改进的最后一轮也进轨迹（标"未采用"），提前停只是停，最好的一步照样可见
        if (best !== -1 && isFinite(best分)) {
          const 轮r: 轮结果 = {
            轮,
            动作: `${动作[best]!.描述}（未采用）`,
            // 显示真实最优分与真实变化：停是因为最优动作也会变差（+Δ），不显示假 0 让人误以为零变化被拒
            分数: Math.round(best分 * 100) / 100,
            前分: Math.round(当前分 * 100) / 100,
            变化: Math.round((best分 - 当前分) * 100) / 100,
            根数: Object.keys(mapping).length,
            动作数: 动作.length,
            耗时,
            mapping: 快照(),
          };
          轮日志.push(轮r);
          cb.on轮?.(轮r);
        }
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
        } catch (e) {
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
      mapping: 快照(),
    };
    轮日志.push(轮r);
    cb.on轮?.(轮r);
      cb.on阶段?.(`第${轮 + 1} 轮：重建基态……`);
      this.设置基态(mapping); // 下一轮以此为基态；重建加根池也必须在它之后（重码组挖掘读基态词序列）
    }
    // 预置归并的触发与否完全反映在轮轨迹（命令行）里——哪根被加、哪种归并生效都已逐轮打印，
    // 故结尾不再单列"未触发"备注（冗余且与轨迹重复）
    // 一轮都没跑（无任何可执行动作）时说明原因，最常见的是范围内候选均已是字根
    const 无动作说明 =
      轮日志.filter((r) => r.轮 !== 0).length === 0 && 收敛
        ? 池.length === 0
          ? "候选池为空——字根表范围内的候选均已是字根或被过滤，可尝试扩大范围"
          : "候选池中的候选均已是字根或被预置归并锁定，无可加入项"
        : undefined;
    // 成功的归并不进备注（差异区的「安排调整」已可见），备注只报异常。
    // 死归并也不进备注：候选池建好时就经 on预置归并失败 上报、UI 常驻显示，再进备注会与绿条重复
    const 备注段 = [
      无动作说明 ?? "",
    ].filter(Boolean).join("；");
    return {
      mapping,
      总分: Math.round(当前分 * 100) / 100,
      轮日志,
      收敛,
      已停止,
      建议: 建议动作,
      备注: 备注段 || undefined,
    };
  }
}

// ---------- 共享工具 ----------
/** 相似字形分组（移植自根部件页「推荐相似字根」的手工分组）：同组字根形状相近。
 *  **每组第一个是组内最常用者（主导根 B）**，其余成员整体归并到它（{element: B}）；组内任一在字根池即整组归并。 */
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

/**
 * 收集安排值里的**元素引用**：只有 {element: 名} 对象是引用。
 * 裸字符串（顶层或数组内）是键位安排（键位字符，如 "j"），不是引用——旧版把它们当引用根去校验，
 * 导致所有逐位安排数组被判"引用根不全"而遭级联误删（2026-10-08 修复）。
 */
export function 收集引用(v: any, out: Set<string>) {
  if (Array.isArray(v)) v.forEach((x) => 收集引用(x, out));
  else if (v && typeof v === "object" && typeof v.element === "string") out.add(v.element);
}
/** 根身份 = string 键位安排 ∪ 数组逐位安排（都占键位，都是映射里的真根） */
const 是根身份 = (v: any) => typeof v === "string" || Array.isArray(v);
const 根身份集 = (m: Record<string, any>) => new Set(Object.keys(m).filter((k) => 是根身份(m[k])));
const 活跃别名 = (m: Record<string, any>) => {
  const 有 = 根身份集(m); // 引用数组根的别名同样有效（数组条目是真根，旧版只认 string 值导致误判失效）
  const keys = new Set<string>();
  for (const [k, v] of Object.entries(m)) {
    if (是根身份(v)) continue;
    const refs = new Set<string>();
    收集引用(v, refs);
    if ([...refs].every((r) => 有.has(r))) keys.add(k);
  }
  return keys;
};
/** 影响拆分的根差异：直接根增删 + 别名开/关（别名键自身获得/失去根身份）+ 开关别名的引用根 */
export function 差异根(m1: Record<string, any>, m2: Record<string, any>): Set<string> {
  const d1 = 根身份集(m1), d2 = 根身份集(m2);
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
/** 表模式展开：patterns 优先，否则按 orders 展开为空位组合；**两者都空 = 全选**（0..maxLength 全部空位组合），
 *  与手动分析「空位模式不选=全选」口径统一。 */
export function 展开表模式(t: { patterns?: number[][]; orders?: number[]; maxLength?: number }): number[][] {
  if (t.patterns && t.patterns.length) return t.patterns;
  const len = t.maxLength ?? 4;
  const out: number[][] = [];
  for (const k of t.orders ?? []) {
    if (k === 0) out.push([]);
    else out.push(...combinations(len, k));
  }
  if (out.length) return out;
  return range(len + 1).flatMap((阶) => combinations(len, 阶));
}
