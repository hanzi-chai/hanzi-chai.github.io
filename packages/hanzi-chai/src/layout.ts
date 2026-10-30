import type { 图形盒子 } from "./affine.js";
import { 区间 } from "./bezier.js";
import type { 向量, 矢量图形数据 } from "./data.js";

type 线段 = [向量, 向量];
type 主轴 = 0 | 1;
const 扫描数 = 64;

/** 仅用于布局度量的折线近似；不改变实际用于渲染或拆分的笔画。 */
function 骨架线段(笔画列表: 矢量图形数据): 线段[] {
  const result: 线段[] = [];
  const 加线段 = (a: 向量, b: 向量) => result.push([a, b]);
  for (const { start, curveList } of 笔画列表) {
    let [x, y] = start;
    for (const { command, parameterList: p } of curveList) {
      const from: 向量 = [x, y];
      switch (command) {
        case "h":
          x += p[0];
          加线段(from, [x, y]);
          break;
        case "v":
          y += p[0];
          加线段(from, [x, y]);
          break;
        case "l":
          x += p[0];
          y += p[1];
          加线段(from, [x, y]);
          break;
        case "a": {
          // 数据中的 a 是半径，圆心在起点正下方；它不移动后续起点。
          let previous = from;
          for (let i = 1; i <= 32; i++) {
            const angle = (i * 2 * Math.PI) / 32;
            const next: 向量 = [
              x + p[0] * Math.sin(angle),
              y + p[0] * (1 - Math.cos(angle)),
            ];
            加线段(previous, next);
            previous = next;
          }
          break;
        }
        case "c":
        case "z": {
          // 固定参数采样不依赖字形的平移、缩放或 ID。扫描只用于空间需求估计。
          let previous = from;
          for (let i = 1; i <= 32; i++) {
            const t = i / 32,
              u = 1 - t;
            const next: 向量 = [
              x + 3 * u * u * t * p[0] + 3 * u * t * t * p[2] + t ** 3 * p[4],
              y + 3 * u * u * t * p[1] + 3 * u * t * t * p[3] + t ** 3 * p[5],
            ];
            加线段(previous, next);
            previous = next;
          }
          x += p[4];
          y += p[5];
          break;
        }
      }
    }
  }
  return result;
}

/**
 * 沿主轴的扫描线穿过多少条骨架。使用交点数的均方根：保留密集区域的影响，
 * 避免只取最大值时，一次偶然的交叉或很短的笔段决定整个部件的大小。
 * 折线连接端点使用半开区间，同坐标交点去重，避免连接点重复计数。
 */
function 扫描轮廓(笔画列表: 矢量图形数据, axis: 主轴) {
  const segments = 骨架线段(笔画列表);
  const other: 主轴 = axis === 0 ? 1 : 0;
  let lo = Infinity,
    hi = -Infinity,
    mainLo = Infinity,
    mainHi = -Infinity;
  for (const segment of segments)
    for (const point of segment) {
      lo = Math.min(lo, point[other]);
      hi = Math.max(hi, point[other]);
      mainLo = Math.min(mainLo, point[axis]);
      mainHi = Math.max(mainHi, point[axis]);
    }
  if (!Number.isFinite(hi - lo) || hi === lo)
    return { complexity: 1, flatness: 0 };
  const step = (hi - lo) / 扫描数;
  const hits: number[][] = Array.from({ length: 扫描数 }, () => []);
  for (const [a, b] of segments) {
    const low = Math.min(a[other], b[other]),
      high = Math.max(a[other], b[other]);
    if (low === high) continue;
    const begin = Math.max(0, Math.ceil((low - lo) / step - 0.5));
    const end = Math.min(扫描数, Math.ceil((high - lo) / step - 0.5));
    for (let i = begin; i < end; i++) {
      const t = (lo + (i + 0.5) * step - a[other]) / (b[other] - a[other]);
      hits[i]!.push(a[axis] + t * (b[axis] - a[axis]));
    }
  }
  const tolerance = Math.max(mainHi - mainLo, Number.EPSILON) * 1e-7;
  let squares = 0,
    flatness = 0;
  for (const row of hits) {
    row.sort((a, b) => a - b);
    let count = 0,
      previous = -Infinity;
    for (const value of row)
      if (value - previous > tolerance) {
        count++;
        previous = value;
      }
    squares += count * count;
    // 外接边界 1% 范围内的轮廓覆盖率。连续边框不是内部笔画层次，
    // 不应仅因两侧都有框线就比开放轮廓占更多空间。
    if (row.length && mainHi > mainLo) {
      const edge = (mainHi - mainLo) * 0.01;
      if (row[0]! - mainLo <= edge) flatness++;
      if (mainHi - row.at(-1)! <= edge) flatness++;
    }
  }
  return {
    complexity: Math.max(1, Math.sqrt(squares / 扫描数)),
    flatness: flatness / 扫描数,
  };
}

export function 方向复杂度(笔画列表: 矢量图形数据, axis: 主轴): number {
  return 扫描轮廓(笔画列表, axis).complexity;
}

/**
 * 原跨度乘以修正复杂度的平方根：保留窄旁形状，适度增加密集部件的空间。
 * KAGE 的平直边缘折扣按几何覆盖率连续应用，不按部件名字判断箱形。
 * 所有参数全局共用，不按字符、部件 ID 或来源调参。
 * 保留原布局的总占位和间隙，只重新分配非零跨度部分的占位。
 */
export function 复杂度布局(部分列表: 图形盒子[], axis: 主轴): 区间[] {
  if (!部分列表.length) return [];
  const intervals = 部分列表.map((part) =>
    axis === 0 ? part.横向区间 : part.纵向区间,
  );
  const total = intervals.reduce((sum, item) => sum + item.长度(), 0);
  const gap = Math.max((100 - total) / intervals.length, 10);
  const extent = total + gap * intervals.length;
  const weights = intervals.map((item, index) => {
    if (item.长度() === 0) return 0;
    const { complexity, flatness } = 扫描轮廓(
      部分列表[index]!.获取笔画列表(),
      axis,
    );
    return item.长度() * Math.sqrt(complexity * 0.7 ** flatness);
  });
  const weightSum = weights.reduce((a, b) => a + b, 0);
  let cursor = gap / 2;
  return intervals.map((item, index) => {
    const length = weightSum === 0 ? 0 : (total * weights[index]!) / weightSum;
    const begin = (cursor / extent) * 100;
    const end = ((cursor + length) / extent) * 100;
    cursor += length + gap;
    // 单横/单竖在主轴上没有厚度：定位中心线，不给它虚构一个大矩形。
    const scale = item.长度() === 0 ? 1 : (end - begin) / item.长度();
    const translate = begin - item.起点() * scale;
    return new 区间(Math.round(translate), Math.round(translate + 100 * scale));
  });
}
