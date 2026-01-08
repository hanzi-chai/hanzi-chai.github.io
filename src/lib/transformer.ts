import type { Operator, Compound, Repertoire } from "./data";

export interface 变换器 {
  from: 模式;
  to: 模式;
}

export type 节点类型 = 模式 | 结构变量 | string;

export interface 模式 {
  operator: Operator;
  operandList: (string | 模式 | 结构变量)[];
}

export interface 结构变量 {
  id: number;
}

// 变量映射：variable id -> 绑定的子树 key
type 变量映射 = { [id: number]: string };

export function isVariable(x: any): x is 结构变量 {
  return x && typeof x.id === "number";
}

/**
 * 把 replacement pattern / variable / string 扁平化并写入 dbOut，返回引用该子树的 key。
 * - 模式中的字符串直接视为已有的键引用
 * - 变量使用 varMap 中绑定的键
 * - 嵌套 pattern 递归生成子键
 */
function 物化替换(
  项: 模式 | 结构变量 | string,
  映射: 变量映射,
  输出: Repertoire,
  签名缓存: Map<string, string>,
  生成计数: { c: number },
  目标字符?: string,
): string {
  if (typeof 项 === "string") return 项;
  if (isVariable(项)) {
    const k = 映射[项.id];
    if (!k) throw new Error(`unbound variable $${项.id}`);
    return k;
  }
  // Pattern
  const 子键们: string[] = 项.operandList.map((op) =>
    物化替换(op, 映射, 输出, 签名缓存, 生成计数),
  );
  const sig = `${项.operator}:${子键们.join(",")}`;
  if (目标字符 === undefined) {
    const existing = 签名缓存.get(sig);
    if (existing) return existing;
  }
  const 字符 = 目标字符 ?? String.fromCodePoint(生成计数.c++);
  const 复合体: Compound = {
    type: "compound",
    operator: 项.operator,
    operandList: 子键们,
  };
  输出[字符] = {
    unicode: 字符.codePointAt(0)!,
    gb2312: 0,
    tygf: 0,
    gf0014_id: null,
    gf3001_id: null,
    name: null,
    glyph: 复合体,
    readings: [],
  };
  签名缓存.set(sig, 字符);
  return 字符;
}

/**
 * 在数据库上匹配模式到某个键（按需展开并递归调用自身），
 * 变量绑定为子键字符串。
 */
function 匹配模式到键(
  模式: 模式,
  字符: string,
  变量映射: 变量映射,
  字库: Repertoire,
): boolean {
  const 复合体 = 字库[字符]?.glyph;
  if (!复合体 || 复合体.type !== "compound") return false;
  if (模式.operator !== 复合体.operator) return false;
  if (模式.operandList.length !== 复合体.operandList.length) return false;
  for (let i = 0; i < 模式.operandList.length; i++) {
    const 操作数 = 模式.operandList[i]!;
    const 子键 = 复合体.operandList[i]!;
    if (typeof 操作数 === "string") {
      if (子键 !== 操作数) return false;
    } else if (isVariable(操作数)) {
      const id = 操作数.id;
      const 已绑定 = 变量映射[id];
      if (已绑定 === undefined) {
        变量映射[id] = 子键;
      } else {
        if (已绑定 !== 子键) return false;
      }
    } else {
      // 嵌套 pattern，递归匹配对应的子键
      if (!匹配模式到键(操作数, 子键, 变量映射, 字库)) return false;
    }
  }
  return true;
}

/**
 * 应用变换器到数据库，返回新的数据库。
 */
export function 应用变换器(字库: Repertoire, 变换器: 变换器): Repertoire {
  // 逐键匹配（按需展开）
  const 匹配集合 = new Map<string, 变量映射>();
  const 签名缓存 = new Map<string, string>();
  let 新字符起始码位 = 0x100000;
  for (const 字符 of Object.keys(字库)) {
    const 码位 = 字符.codePointAt(0)!;
    if (码位 >= 0x100000) {
      新字符起始码位 = Math.max(新字符起始码位, 码位 + 1);
    }
    const c = 字库[字符]!;
    const sig = JSON.stringify(c.glyph);
    签名缓存.set(sig, 字符);
    const 变量映射: 变量映射 = {};
    if (匹配模式到键(变换器.from, 字符, 变量映射, 字库)) {
      匹配集合.set(字符, 变量映射);
    }
  }

  const 输出数据库 = { ...字库 };
  const 生成计数 = { c: 新字符起始码位 };

  for (const [键, 变量映射] of 匹配集合) {
    物化替换(变换器.to, 变量映射, 输出数据库, 签名缓存, 生成计数, 键);
  }

  return 输出数据库;
}
