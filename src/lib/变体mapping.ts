/**
 * 变体 mapping 的唯一实现（2026-10-27 从 智能选根核心 抽出）。
 *
 * 抽出的原因：同一套「加/删根 + 级联失效」逻辑曾以五份 COPY 存在
 * （核心的 变体mapping 方法 + 评分.ts / 增量评分.ts / 搜索.ts / 搜索增量.ts
 * 四处 CLI 内联副本，每处还各自抄了一遍 收集引用）。任何一次级联改动都要
 * 改五处，漏一处就出现「决策图线性化硬报错"决策中不存在键"」——
 * 数组条目里的借码根悬空正是这条崩溃路径。
 *
 * 本模块**零外部依赖**：搜索.ts / 搜索增量.ts 原先不 import 引擎包，
 * 从这里取实现不会把字库分析链路拉进纯 YAML 脚本。
 */

/**
 * 收集安排值里的**元素引用**：只有 {element: 名} 对象是引用。
 * 裸字符串（顶层或数组内）是键位安排（键位字符，如 "j"），不是引用——旧版把它们
 * 当引用根去校验，导致所有逐位安排数组被判"引用根不全"而遭级联误删（2026-10-08 修复）。
 */
export function 收集引用(v: any, out: Set<string>) {
  if (Array.isArray(v)) v.forEach((x) => 收集引用(x, out));
  else if (v && typeof v === "object" && typeof v.element === "string")
    out.add(v.element);
}

/** 根身份 = string 键位安排 ∪ 数组逐位安排（都占键位，都是映射里的真根） */
const 是根身份 = (v: any) => typeof v === "string" || Array.isArray(v);

export const 根身份集 = (m: Record<string, any>) =>
  new Set(Object.keys(m).filter((k) => 是根身份(m[k])));

/**
 * 根数（**可删根口径**）：string 键位安排 ∪ 数组逐位安排，一个条目算一个根。
 *
 * 全站唯一的根数定义。凡是「有几个根」的计数都必须走这里，别再各写
 * `typeof v === "string"` —— 那会把数组形式的根漏掉，而数组形态恰恰是搜索自己
 * 造出来的：核心加根分支里，带半归并（`A 1=B 1`）或码位借码的根入库时写的就是
 * 数组（`["a", {element:B, index:0}]`），于是「加了根、根数却没涨」，罚分失效。
 *
 * 整体别名 `{element: X}` 不算根：它跟着 X 走，不占自己的键位。
 * 与 `可删候选`（核心搜索每轮的 直设根）同一口径，两处必须永远一致。
 */
export const 根数 = (m: Record<string, any>) => 根身份集(m).size;

/** 引用根全都仍具根身份的别名条目（整体归并 / 码位借码等非 string 条目） */
export const 活跃别名 = (m: Record<string, any>) => {
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

/**
 * 应用加/删并级联失效（2026-10-08 修订，修复"连带删除别名 53 个"误删）。
 * 条目三形态：string 键位安排（直设根）/ 数组逐位安排（带自身键位的根，可含
 * {element,index} 借码位）/ 纯别名 {element: X}（整体归并，跟随 X 的码）。
 *
 * 级联规则（不动点）：非 string 条目引用的根**因本次动作从映射中消失**
 * （被显式删除，或沿引用链上游失效）时随之失效——数组条目也必须遵守：
 * 借码根悬空时决策图线性化硬报错"决策中不存在键"（实测）。
 * 引用**从未入映射**的名字（基线悬空条目，如 {element:忄} 且 忄 不是根）
 * 不属本次动作的后果，保持原样——这类条目在恢复安排里本就被跳过（死条目），
 * 删与不删不影响任何分数，动了反而惊扰用户。
 *
 * 旧 bug 双根因：①收集引用把数组里的键位字符（如 "j"）当引用根，所有数组条目
 * 被判引用不全；②直设集只认 string 值，"引用数组根"的 444 个别名全被误判失效。
 *
 * 唯一口径，CLI 脚本也照此执行（2026-10-27 定案：CLI 地位低于核心，凡与核心
 * 不同的写法一律改 CLI，不给核心开分支）。具体两条容易走偏的地方：
 *  - 「加∩删」按加处理：根要进来就不删它，保留原有安排，不做「删完再补占位」；
 *  - 加根不改变它的身份：已在映射中的别名 / 数组条目保持原样，不降级成占位
 *    直设根；若它引用的根被删，它跟着级联消失（补加在级联之前，占位是 string
 *    不参与级联，但同名条目本就是数组 / 别名时 `!(r in m)` 为假、不会覆盖）。
 */
export function 变体mapping(
  基: Record<string, any>,
  加: string[],
  删: string[],
  占位 = "aa",
): Record<string, any> {
  const m: Record<string, any> = { ...基 };
  const 加集 = new Set(加 ?? []);
  const 死 = new Set(删 ?? []);
  for (const r of 死) if (!加集.has(r)) delete m[r];
  for (const r of 加集) if (!(r in m)) m[r] = 占位;
  const 非串条目 = Object.entries(m).filter(
    ([, v]) => typeof v !== "string",
  ) as [string, any][];
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

/**
 * 两个安排值是不是同一条（string 键位串 / 数组逐位安排 / 整体别名 `{element}`）。
 * 三条形态的字段是 `{element, index?}` 与裸字符串，逐位递归比即可；**不用 JSON.stringify**
 * ——键序不同会误判成不同。
 */
function 同安排(a: any, b: any): boolean {
  if (a === b) return true;
  if (typeof a === "string" || typeof b === "string") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    return a.length === b.length && a.every((x: any, i: number) => 同安排(x, b[i]));
  }
  return a?.element === b?.element && (a?.index ?? 0) === (b?.index ?? 0);
}

/**
 * 影响拆分的根差异：直接根增删 + 别名开/关（别名键自身获得/失去根身份）+
 * 开关别名的引用根（保守，覆盖归并安排对引用根选取的潜在影响）+
 * **两边都在、但安排值变了**（换键位串、string↔数组、借码位换了引用对象）。
 *
 * 最后一条是保底：搜索当前只产生「加根/删根」动作，改不到已有根的安排；但只要哪天
 * 出现「改已有根安排」的动作（差异区手工调整、同根多个编码候选），漏掉它就会让
 * `评变体` 判「无变化」**静默返回基态分**——实测把「土」改成借「口」的码，增量说
 * 总分不变，全量真值是 +4057.89。
 */
export function 差异根(
  m1: Record<string, any>,
  m2: Record<string, any>,
): Set<string> {
  const d1 = 根身份集(m1);
  const d2 = 根身份集(m2);
  const out = new Set<string>();
  for (const k of d1) if (!d2.has(k)) out.add(k);
  for (const k of d2) if (!d1.has(k)) out.add(k);
  const a1 = 活跃别名(m1);
  const a2 = 活跃别名(m2);
  const 并入 = (k: string, v: any) => {
    out.add(k);
    收集引用(v, out);
  };
  for (const k of a1) if (!a2.has(k)) 并入(k, m1[k]);
  for (const k of a2) if (!a1.has(k)) 并入(k, m2[k]);
  // 安排值变化：根与别名一视同仁（别名换了引用对象同样要重算）。
  // 用 === 快路径挡住绝大多数同名同值的键，别用 Object.entries（406 键会白建 406 个数组）
  for (const k in m1) {
    const v1 = m1[k];
    if (!(k in m2)) continue;
    const v2 = m2[k];
    if (v1 === v2) continue;
    if (同安排(v1, v2)) continue;
    out.add(k);
    收集引用(v1, out);
    收集引用(v2, out);
  }
  return out;
}
