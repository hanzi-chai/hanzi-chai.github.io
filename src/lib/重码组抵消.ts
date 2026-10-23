/** 重码组变化的「抵消」清洗（手动分析页 / 加减根分析的展示层用）。
 *
 *  问题：加根后一批字的码整体挪了位置，于是同一批成员在一条里显示成「－甲、乙…」
 *  又在另一条里显示成「＋甲、乙…」——两个列表一模一样，看着像自相矛盾，实际只是搬家。
 *  实测加「二」一根：218 条变化组里有 47 对「离开集 == 加入集」完全对，涉及 8580 个字/词
 *  被重复显示两遍，长的组动辄几百个成员，根本没法看。
 *
 *  两趟处理，都是线性或排序级（按名字哈希，不做两两比较）：
 *   ① 整组抵消：成员集合完全相同的「解散组 / 新生组」按数量配对，整对不显示。
 *      这种对是纯粹的原地搬家：组的规模没变，分数一点没动，留着毫无信息。
 *   ② 成员抵消：跨组按名字对消——某个名字在某处的「离开」里出现、又在另一处的「加入」里
 *      出现，两边的这一项都划掉。只划名字、保留「组（基线→候选）」的表头：表头是规模变化，
 *      是真正要看的东西（比如「1299→318」外加新出现一个「981」的大组，这个必须留着）。
 *
 *  每个条目在同一个模式里只属于一个组，所以「离开」与「加入」的名字基本不重叠，
 *  候选表长度接近 1，② 不会退化成平方级。
 */

export interface 阶重变化组 {
  基线词: string[];
  候选词: string[];
  基线: number;
  候选: number;
}

/** 成员集合的身份：与码位无关，只看「哪几个字挤在一起」 */
const 签名 = (词: string[]) => [...词].sort().join("\u0001");

export function 抵消组变化(变化组: 阶重变化组[]): 阶重变化组[] {
  if (变化组.length === 0) return 变化组;

  // ---------- ① 整组抵消：解散组 / 新生组 成员集相同 ----------
  const 解散池 = new Map<string, number[]>();
  const 新生池 = new Map<string, number[]>();
  变化组.forEach((g, i) => {
    const 是解散 = g.候选词.length === 0;
    const 是新生 = g.基线词.length === 0;
    if (!是解散 && !是新生) return; // 组还在、只是换了人：规模变化有信息，留给 ② 处理
    const 池 = 是解散 ? 解散池 : 新生池;
    const s = 签名(是解散 ? g.基线词 : g.候选词);
    const 列 = 池.get(s);
    if (列) 列.push(i);
    else 池.set(s, [i]);
  });
  const 整组消 = new Uint8Array(变化组.length);
  解散池.forEach((解列, s) => {
    const 新列 = 新生池.get(s);
    if (!新列) return;
    for (let k = 0; k < Math.min(解列.length, 新列.length); k++) {
      整组消[解列[k]!] = 1;
      整组消[新列[k]!] = 1;
    }
  });

  // ---------- ② 成员抵消：按名字统计「离开」与「加入」的多重集 ----------
  const 离额 = new Map<string, number>(); // 该名字还能划掉几次「离开」
  const 加额 = new Map<string, number>(); // 该名字还能划掉几次「加入」
  const 计数离 = new Map<string, number>();
  const 计数加 = new Map<string, number>();
  变化组.forEach((g, i) => {
    if (整组消[i]) return;
    const 基集 = new Set(g.基线词);
    const 候集 = new Set(g.候选词);
    for (const x of g.基线词)
      if (!候集.has(x)) 计数离.set(x, (计数离.get(x) ?? 0) + 1);
    for (const x of g.候选词)
      if (!基集.has(x)) 计数加.set(x, (计数加.get(x) ?? 0) + 1);
  });
  计数离.forEach((n, x) => {
    const m = 计数加.get(x) ?? 0;
    const 对 = Math.min(n, m);
    if (对 <= 0) return;
    离额.set(x, 对);
    加额.set(x, 对);
  });

  const 输出: 阶重变化组[] = [];
  变化组.forEach((g, i) => {
    if (整组消[i]) return;
    const 基集 = new Set(g.基线词);
    const 候集 = new Set(g.候选词);
    const 基线词 = g.基线词.filter((x) => {
      if (候集.has(x)) return true; // 两侧共有 = 不变那部分，与搬家无关
      const n = 离额.get(x) ?? 0;
      if (n <= 0) return true;
      离额.set(x, n - 1);
      return false;
    });
    const 候选词 = g.候选词.filter((x) => {
      if (基集.has(x)) return true;
      const n = 加额.get(x) ?? 0;
      if (n <= 0) return true;
      加额.set(x, n - 1);
      return false;
    });
    // 名字全被划掉也保留：表头（基线→候选）是规模变化，正是要判断的东西；
    // 只有①②都无事可报的整组消失已在上面 return 掉了。
    输出.push({ 基线词, 候选词, 基线: g.基线, 候选: g.候选 });
  });
  return 输出;
}
