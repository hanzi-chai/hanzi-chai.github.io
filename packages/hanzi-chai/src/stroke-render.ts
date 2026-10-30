import type { 笔画名称 } from "./classifier.js";
import type { 向量, 矢量图形数据, 矢量笔画数据 } from "./data.js";

type 曲线 = [向量, 向量, 向量, 向量];
interface 段 {
  points: 曲线;
  line: boolean;
  lengths: number[];
  length: number;
}
type 线段 = [向量, 向量];
const epsilon = 1e-7;
const mix = (a: 向量, b: 向量, t: number): 向量 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
];
const sub = (a: 向量, b: 向量): 向量 => [a[0] - b[0], a[1] - b[1]];
const move = (p: 向量, d: 向量, t: number): 向量 => [
  p[0] + d[0] * t,
  p[1] + d[1] * t,
];
const dot = (a: 向量, b: 向量) => a[0] * b[0] + a[1] * b[1];
const cross = (a: 向量, b: 向量) => a[0] * b[1] - a[1] * b[0];
const norm = (a: 向量) => Math.hypot(...a);
const unit = (a: 向量): 向量 =>
  norm(a) > epsilon ? [a[0] / norm(a), a[1] / norm(a)] : [0, 0];

/** de Casteljau 分割保留原曲线；只裁掉显示圆角需要的短段。 */
function split(p: 曲线, t: number): [曲线, 曲线] {
  const a = mix(p[0], p[1], t),
    b = mix(p[1], p[2], t),
    c = mix(p[2], p[3], t);
  const d = mix(a, b, t),
    e = mix(b, c, t),
    f = mix(d, e, t);
  return [
    [p[0], a, d, f],
    [f, e, c, p[3]],
  ];
}
const at = (p: 曲线, t: number) => split(p, t)[0][3];
function tangent(p: 曲线, end: boolean): 向量 {
  const candidates = end
    ? [sub(p[3], p[2]), sub(p[3], p[1]), sub(p[3], p[0])]
    : [sub(p[1], p[0]), sub(p[2], p[0]), sub(p[3], p[0])];
  return unit(candidates.find((v) => norm(v) > epsilon) ?? [0, 0]);
}
function makeSegment(points: 曲线, line: boolean): 段 {
  const lengths = [0];
  let previous = points[0];
  for (let i = 1; i <= 24; i++) {
    const next = at(points, i / 24);
    lengths.push(lengths[i - 1]! + norm(sub(next, previous)));
    previous = next;
  }
  return { points, line, lengths, length: lengths.at(-1)! };
}
function parameterAt(segment: 段, length: number) {
  if (segment.length < epsilon) return 0;
  const target = Math.max(0, Math.min(segment.length, length));
  const i = Math.max(
    1,
    segment.lengths.findIndex((x) => x >= target),
  );
  const a = segment.lengths[i - 1]!,
    b = segment.lengths[i]!;
  return (i - 1 + (b === a ? 0 : (target - a) / (b - a))) / 24;
}
function slice(segment: 段, from: number, to: number): 曲线 {
  const t0 = parameterAt(segment, from),
    t1 = parameterAt(segment, to);
  const left = split(segment.points, t1)[0];
  return t1 < epsilon ? left : split(left, t0 / t1)[1];
}

function parse(stroke: 矢量笔画数据): 段[] {
  const result: 段[] = [];
  let p = stroke.start;
  for (const [i, { command, parameterList: a }] of stroke.curveList.entries()) {
    let q: 向量;
    if (command === "a") continue; // 圈的显示保留既有约定，另行输出。
    if (command === "c" || command === "z") {
      q = move(p, [a[4], a[5]], 1);
      result.push(
        makeSegment(
          [p, move(p, [a[0], a[1]], 1), move(p, [a[2], a[3]], 1), q],
          false,
        ),
      );
    } else {
      const dx = command === "v" ? 0 : a[0];
      const dy =
        command === "v"
          ? a[0]
          : command === "l"
            ? a[1]
            : i === stroke.curveList.length - 1 && stroke.feature.endsWith("提")
              ? -0.15 * dx
              : 0;
      q = move(p, [dx, dy], 1);
      result.push(
        makeSegment([p, mix(p, q, 1 / 3), mix(p, q, 2 / 3), q], true),
      );
    }
    p = q;
  }
  return result;
}
function lines(segments: 段[]): 线段[] {
  return segments.flatMap((s) => curveLines(s.points, s.line));
}
function curveLines(points: 曲线, line = false): 线段[] {
  if (line) return [[points[0], points[3]]];
  return Array.from(
    { length: 24 },
    (_, i) => [at(points, i / 24), at(points, (i + 1) / 24)] as 线段,
  );
}
function distance(p: 向量, [a, b]: 线段) {
  const v = sub(b, a),
    l2 = dot(v, v);
  return norm(
    sub(
      p,
      mix(
        a,
        b,
        l2 < epsilon ** 2
          ? 0
          : Math.max(0, Math.min(1, dot(sub(p, a), v) / l2)),
      ),
    ),
  );
}

function intersects([a, b]: 线段, [c, d]: 线段) {
  // 大多数邻笔远离待修饰的短段，先用包围盒排除，避免逐对求距离。
  if (
    Math.max(a[0], b[0]) < Math.min(c[0], d[0]) - epsilon ||
    Math.max(c[0], d[0]) < Math.min(a[0], b[0]) - epsilon ||
    Math.max(a[1], b[1]) < Math.min(c[1], d[1]) - epsilon ||
    Math.max(c[1], d[1]) < Math.min(a[1], b[1]) - epsilon
  )
    return false;
  if (
    distance(a, [c, d]) < epsilon ||
    distance(b, [c, d]) < epsilon ||
    distance(c, [a, b]) < epsilon ||
    distance(d, [a, b]) < epsilon
  )
    return true;
  const ab = sub(b, a),
    cd = sub(d, c);
  return (
    cross(ab, sub(c, a)) * cross(ab, sub(d, a)) < 0 &&
    cross(cd, sub(a, c)) * cross(cd, sub(b, c)) < 0
  );
}
const touches = (path: 线段[], obstacles: 线段[]) =>
  path.some((a) => obstacles.some((b) => intersects(a, b)));

/** 沿钩方向寻找邻笔障碍，并留出几何净距；不按字符或部件设例外。 */
function clearance(
  origin: 向量,
  direction: 向量,
  length: number,
  obstacles: 线段[],
) {
  const margin = Math.min(length * 0.15, 0.8);
  let limit = length;
  for (const [a, b] of obstacles) {
    const v = sub(b, a),
      w = sub(a, origin),
      den = cross(direction, v);
    if (Math.abs(den) > epsilon) {
      const t = cross(w, v) / den,
        u = cross(w, direction) / den;
      if (t > epsilon && u >= 0 && u <= 1)
        limit = Math.min(limit, Math.max(0, t - margin));
    }
    // 端点的安全带也限制钩长，避免刚好擦过另一笔的端头。
    for (const p of [a, b]) {
      const d = sub(p, origin),
        t = dot(d, direction);
      if (t > epsilon && Math.abs(cross(direction, d)) < margin)
        limit = Math.min(limit, Math.max(0, t - margin));
    }
    // 与钩方向重合且从收笔点延伸的笔画，不再叠上一条钩。
    if (Math.abs(den) <= epsilon && Math.abs(cross(direction, w)) < epsilon) {
      const ta = dot(w, direction),
        tb = dot(sub(b, origin), direction);
      if (Math.min(ta, tb) <= epsilon && Math.max(ta, tb) > epsilon) limit = 0;
    }
  }
  return limit;
}

const 弯 = new Set<笔画名称>([
  "竖弯",
  "竖弯左",
  "竖弯钩",
  "横折弯",
  "横折弯钩",
]);
const 上钩 = new Set<笔画名称>(["竖弯钩", "横折弯钩", "横斜弯钩", "卧钩"]);
const 斜钩 = new Set<笔画名称>(["斜钩", "横斜钩", "撇钩"]);
const format = (p: 向量) => p.map((x) => Number(x.toFixed(6))).join(" ");
const cubic = (p: 曲线) => `C${format(p[1])} ${format(p[2])} ${format(p[3])}`;

function render(
  stroke: 矢量笔画数据,
  index: number,
  self: 矢量图形数据,
  all: 段[][],
  polylines: 线段[][],
) {
  const segments = all[index]!;
  // a 是历史上的整圆专用命令，与 SVG 的椭圆弧参数格式不同。
  if (stroke.curveList.some((c) => c.command === "a"))
    return `M${format(stroke.start)} ${stroke.curveList.map((c) => (c.command === "a" ? "a 50,50 0 1,1 0,100 a 50,50 0 1,1 0,-100" : c.command.replace("z", "c") + c.parameterList.join(" "))).join(" ")}`;
  if (!segments.length) return `M${format(stroke.start)}`;
  const others =
    stroke.feature.endsWith("钩") || 弯.has(stroke.feature)
      ? polylines.flatMap((p, i) => (i === index ? [] : p))
      : [];
  const begins = segments.map(() => 0),
    ends = segments.map((s) => s.length);
  const joins = new Map<number, 曲线>();
  const n = segments.length,
    tail = segments[n - 1]!,
    anchor = tail.points[3];

  // 只有语义为“弯”的末次连接圆滑化；“折”仍保留折角。
  if (弯.has(stroke.feature) && n >= 2) {
    const a = segments[n - 2]!,
      b = tail,
      vertex = a.points[3];
    const incoming = tangent(a.points, true),
      outgoing = tangent(b.points, false);
    const cosine = dot(incoming, outgoing);
    const contact = others.some((line) => distance(vertex, line) < epsilon);
    if (!contact && cosine > -0.95 && cosine < 0.95) {
      const trim = Math.min(6, a.length * 0.3, b.length * 0.3);
      if (trim > epsilon) {
        const left = slice(a, 0, a.length - trim),
          right = slice(b, trim, b.length);
        // 三次曲线两端沿被裁段的实际切线连接；直角时近似四分之一圆。
        const join: 曲线 = [
          left[3],
          move(left[3], tangent(left, true), trim * 0.55),
          move(right[0], tangent(right, false), -trim * 0.55),
          right[0],
        ];
        // 不抹掉裁剪区域内的既有连接，也不让新圆角碰到邻笔。
        const changed = [
          ...curveLines(slice(a, a.length - trim, a.length), a.line),
          ...curveLines(slice(b, 0, trim), b.line),
          ...curveLines(join),
        ];
        if (!touches(changed, others)) {
          ends[n - 2] = a.length - trim;
          begins[n - 1] = trim;
          joins.set(n - 2, join);
        }
      }
    }
  }

  let hook: 曲线 | undefined;
  if (stroke.feature.endsWith("钩") && tail.length > epsilon) {
    const incoming = tangent(tail.points, true);
    let direction: 向量;
    if (stroke.feature === "横钩") {
      direction = unit([-0.65 * (Math.sign(incoming[0]) || 1), 0.76]);
      // 同起点的竖点和横钩组成对称的顶盖：由实际笔画关系确定下垂方向。
      const previous = self[index - 1],
        prevSegments = all[index - 1];
      if (
        previous?.feature === "点" &&
        norm(sub(previous.start, stroke.start)) < epsilon &&
        prevSegments?.length
      ) {
        const delta = sub(prevSegments.at(-1)!.points[3], previous.start);
        if (delta[1] > 0 && Math.abs(delta[0]) < delta[1] * 0.3)
          direction = [0, 1];
      }
    } else if (上钩.has(stroke.feature)) {
      direction = unit([incoming[1], -Math.abs(incoming[0])]);
    } else if (斜钩.has(stroke.feature)) {
      direction = unit([0.25, -1]);
    } else {
      // 竖钩/弯钩沿末端切线转向左上，曲线与直线使用相同规则。
      direction = unit([
        -0.8 * incoming[1] - 0.6 * incoming[0],
        0.8 * incoming[0] - 0.6 * incoming[1],
      ]);
    }
    const obstacles = [...others, ...lines(segments.slice(0, -1))];
    // 复合笔画的短末段还要参考整笔尺度；但钩不能超过末段的 35%。
    // 等比缩小时两种尺度同步缩小，不使用固定最小钩长。
    const strokeLength = segments.reduce((sum, s) => sum + s.length, 0);
    const length = clearance(
      anchor,
      direction,
      Math.min(
        8,
        tail.length * 0.35,
        0.18 * Math.sqrt(tail.length * strokeLength),
      ),
      obstacles,
    );
    if (length > epsilon && norm(direction) > epsilon) {
      const contact = others.some((line) => distance(anchor, line) < epsilon);
      let trim = contact
        ? 0
        : Math.min(length * 0.45, (tail.length - begins[n - 1]!) * 0.2);
      if (
        trim &&
        touches(
          curveLines(slice(tail, tail.length - trim, tail.length), tail.line),
          others,
        )
      )
        trim = 0;
      ends[n - 1] = tail.length - trim;
      const clipped = slice(tail, begins[n - 1]!, ends[n - 1]!);
      const tip = move(anchor, direction, length);
      hook = [
        clipped[3],
        move(clipped[3], tangent(clipped, true), trim * 0.65),
        move(tip, direction, -length * 0.45),
        tip,
      ];
    }
  }
  const commands = [`M${format(stroke.start)}`];
  for (const [i, segment] of segments.entries()) {
    const p =
      begins[i] === 0 && ends[i] === segment.length
        ? segment.points
        : slice(segment, begins[i]!, ends[i]!);
    commands.push(segment.line ? `L${format(p[3])}` : cubic(p));
    if (joins.has(i)) commands.push(cubic(joins.get(i)!));
  }
  if (hook) commands.push(cubic(hook));
  return commands.join(" ");
}

/** 显示专用：不修改笔画、笔顺、布局边界或拆分拓扑。网页和离线 SVG 共用。 */
export function 生成笔画路径(strokes: 矢量图形数据): string[] {
  const parsed = strokes.map(parse),
    polylines = parsed.map(lines);
  return strokes.map((stroke, index) =>
    render(stroke, index, strokes, parsed, polylines),
  );
}

/** 保留原来的 Array.map 回调接口。批量渲染请用生成笔画路径，避免重复建立邻笔几何。 */
export function 处理路径(
  stroke: 矢量笔画数据,
  index: number,
  self: 矢量图形数据,
) {
  const parsed = self.map(parse);
  return render(stroke, index, self, parsed, parsed.map(lines));
}
