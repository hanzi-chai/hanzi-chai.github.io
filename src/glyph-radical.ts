import { 仿射变换, 图形盒子 } from "./affine.js";
import { 默认分类器 } from "./classifier.js";
import type { 字形数据, 引用笔画块数据, 矢量笔画数据 } from "./data.js";
import { 获取包围内部范围 } from "./enclosure.js";
import {
  创建部首反查表,
  type 康熙部首定义,
  康熙部首表,
} from "./kangxi-radicals.js";
import { 复杂度布局 } from "./layout.js";
import { isVectorStroke, 仿射合并 } from "./utils.js";

export interface 字形归部结果 {
  /** 多个编号表示实际字形共用，须消歧后才能分配 ID。 */
  radical_numbers: readonly number[];
  radical_glyph_id: number;
  remaining_strokes: number;
  /** 中间十六进制位；余笔 16 及以上合并为 15，余笔为 0 时无编码。 */
  stroke_bucket: number | undefined;
  fallback: boolean;
}

/** 基于实际引用树归部，不从字符名称、字源或 Unihan 归部反推。 */
export class 字形归部检索 {
  private 字形表: Map<number, 字形数据>;
  private 部首反查表: ReadonlyMap<number, readonly number[]>;
  private 笔顺缓存 = new Map<number, string>();
  private 图形缓存 = new Map<number, 图形盒子>();

  constructor(
    字形列表: readonly 字形数据[],
    部首表: readonly 康熙部首定义[] = 康熙部首表,
  ) {
    this.字形表 = new Map(字形列表.map((字形) => [字形.id, 字形]));
    if (this.字形表.size !== 字形列表.length) throw new Error("字形 ID 重复");
    this.部首反查表 = 创建部首反查表(部首表);
  }

  private 获取字形(id: number): 字形数据 {
    const 字形 = this.字形表.get(id);
    if (!字形) throw new Error(`字形 ${id} 不存在`);
    return 字形;
  }

  private 获取图形(id: number): 图形盒子 {
    const 缓存 = this.图形缓存.get(id);
    if (缓存) return 缓存;
    const 字形 = this.获取字形(id);
    const 图形 = 字形.references?.length
      ? 仿射合并(
          字形.references.map((引用) => this.获取图形(引用.id)),
          字形.references,
          字形.operator,
          字形.strokes,
        )
      : 图形盒子.从笔画列表构建((字形.strokes ?? []).filter(isVectorStroke));
    this.图形缓存.set(id, 图形);
    return 图形;
  }

  private 获取横向中点(
    父字形: Extract<字形数据, { type: "compound" }>,
    index: number,
  ) {
    const 引用 = 父字形.references[index]!;
    let [xb, xe] = [0, 100];
    if (父字形.operator === "⿰" || 父字形.operator === "⿲") {
      [xb, xe] = 复杂度布局(
        父字形.references.map((引用) => this.获取图形(引用.id)),
        0,
      )[index]!.toArray();
    } else {
      const 范围 = 仿射变换.查找表[父字形.operator][index]?.[0];
      if (范围) [xb, xe] = 范围.toArray();
      if (index === 1) {
        const 内框 = 获取包围内部范围(父字形.references[0], 父字形.operator);
        if (内框) [xb, xe] = [内框.xbegin, 内框.xend];
      }
    }
    const 左界 = 引用.xbegin ?? xb;
    const 右界 = 引用.xend ?? xe;
    const [原左界, 原右界] = this.获取图形(引用.id).横向区间.toArray();
    return 左界 + ((原左界 + 原右界) / 200) * (右界 - 左界);
  }

  获取笔顺(id: number, 路径 = new Set<number>()): string {
    const 缓存 = this.笔顺缓存.get(id);
    if (缓存 !== undefined) return 缓存;
    if (路径.has(id)) throw new Error(`字形 ${id} 存在循环引用`);
    路径.add(id);
    const 字形 = this.获取字形(id);
    const 子笔顺 = (字形.references ?? []).map((引用) =>
      this.获取笔顺(引用.id, 路径),
    );
    const 笔画块: (矢量笔画数据 | 引用笔画块数据)[] = 字形.strokes?.length
      ? 字形.strokes
      : 子笔顺.map((_, index) => ({ index }));
    const 笔顺 = 笔画块
      .map((块) => {
        if ("feature" in 块) return String(默认分类器[块.feature]);
        const 子序列 = 子笔顺[块.index];
        if (子序列 === undefined)
          throw new Error(`字形 ${id} 的笔画块引用越界`);
        // 引用笔画块的 to 是闭区间端点，与实际展开笔画保持一致。
        return 子序列.slice(块.from ?? 0, (块.to ?? 子序列.length - 1) + 1);
      })
      .join("");
    路径.delete(id);
    this.笔顺缓存.set(id, 笔顺);
    return 笔顺;
  }

  归部(id: number): 字形归部结果 {
    const 根 = this.获取字形(id);
    if (根.type !== "compound") throw new Error(`字形 ${id} 是部件，无需归部`);
    // 先展开校验引用树，避免循环引用被广度优先遍历中的去重掩盖。
    const 总笔数 = this.获取笔顺(id).length;
    const 入队 = (父字形: typeof 根) =>
      父字形.references.map((引用, index) => ({
        id: 引用.id,
        parent: 父字形,
        index,
      }));
    const 队列 = 入队(根);
    const 已访问 = new Set<number>();
    let 首部件: number | undefined;
    for (let 位置 = 0; 位置 < 队列.length; 位置++) {
      const { id: 当前ID, parent, index } = 队列[位置]!;
      if (已访问.has(当前ID)) continue;
      已访问.add(当前ID);
      const 字形 = this.获取字形(当前ID);
      let 部首编号 = this.部首反查表.get(当前ID);
      if (部首编号 && 部首编号.length > 1) {
        const 规则 =
          部首编号.includes(163) && 部首编号.includes(170)
            ? { left: 170, right: 163 }
            : undefined;
        if (规则) {
          const 中点 = this.获取横向中点(parent, index);
          if (中点 !== 50) 部首编号 = [中点 < 50 ? 规则.left : 规则.right];
        }
      }
      if (部首编号) {
        const 余笔 = 总笔数 - this.获取笔顺(当前ID).length;
        return {
          radical_numbers: 部首编号,
          radical_glyph_id: 当前ID,
          remaining_strokes: 余笔,
          stroke_bucket: 余笔 > 0 ? Math.min(16, 余笔) - 1 : undefined,
          fallback: false,
        };
      }
      if (字形.type === "component") 首部件 ??= 当前ID;
      else 队列.push(...入队(字形));
    }
    if (首部件 === undefined) throw new Error(`字形 ${id} 没有部件`);
    const 首笔 = Number(this.获取笔顺(首部件)[0]);
    // 横、竖、撇、点、折分别归一、丨、丿、丶、乙。
    const 部首编号 = [0, 1, 2, 4, 3, 5][首笔];
    if (!部首编号) throw new Error(`字形 ${首部件} 没有可识别的首笔`);
    const 余笔 = 总笔数 - 1;
    return {
      radical_numbers: [部首编号],
      radical_glyph_id: 首部件,
      remaining_strokes: 余笔,
      stroke_bucket: 余笔 > 0 ? Math.min(16, 余笔) - 1 : undefined,
      fallback: true,
    };
  }
}
