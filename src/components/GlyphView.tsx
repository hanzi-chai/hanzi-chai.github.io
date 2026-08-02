import type {
  N6,
  向量,
  图形盒子,
  矢量笔画数据,
  笔画名称,
  绘制,
} from "hanzi-chai";
import { 减, 加, 笔画图形 } from "hanzi-chai";
import { isEqual } from "lodash-es";
import type React from "react";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";

const 取绘制长度 = ({ command, parameterList }: 绘制) => {
  if (command === "h" || command === "v") {
    return parameterList[0];
  }
  if (command === "a") {
    return 0;
  }
  const [_x1, _y1, _x2, _y2, x3, y3] = parameterList as N6;
  return Math.sqrt(x3 * x3 + y3 * y3);
};

const 弯笔画列表: 笔画名称[] = ["横折弯", "横折弯钩", "竖弯", "竖弯钩"];
// 二类钩：末段为 v（向下），钩向左上 l(-钩长, -钩长*t)
const 二类钩列表: 笔画名称[] = [
  "竖钩",
  "横折钩",
  "竖折折钩",
  "横折折折钩",
  "弯钩",
  "横撇弯钩",
];
// 三类钩：钩向左上偏竖直 l(钩长*0.3, -钩长)
const 三类钩列表: 笔画名称[] = ["斜钩", "横斜钩", "撇钩"];
// 四类钩：末段为 h（向右），钩竖直向上 l(0, -钩长)，同时属于弯笔画
const 四类钩列表: 笔画名称[] = ["竖弯钩", "横折弯钩"];

const 处理路径 = (
  { start, feature, curveList }: 矢量笔画数据,
  strokeIndex: number,
  self: 矢量笔画数据[],
) => {
  const 路径命令列表: string[] = [`M${start.join(" ")}`];
  const 段数 = curveList.length;
  const 参考长度 = 取绘制长度(curveList.at(-1)!);

  // 1. 笔画分类 —— 判断当前笔画属于哪些美化类别
  // 弯笔画：倒数两段 V→H 的直角连接需要圆角美化
  const 弯美化 = 弯笔画列表.includes(feature);
  // 弯笔画 V→H 圆角半径
  const 弯半径 = 弯美化
    ? Math.min(
        Math.min(
          Math.abs(curveList[段数 - 2]!.parameterList[0]),
          Math.abs(curveList[段数 - 1]!.parameterList[0]),
        ) * 0.3,
        6,
      )
    : 0;
  // 一类钩：横钩，钩向左下
  const 一类钩 = feature === "横钩";
  const 二类钩正切 = 0.1;
  const 二类钩 = 二类钩列表.includes(feature);

  // 二类钩弧：v ↓ → 钩 ↖，sweep=0 (CCW)
  const 二类钩弧半径 = 二类钩 ? Math.min(参考长度 * 0.2, 5) : 0;
  const 二类钩S = Math.sqrt(1 + 二类钩正切 ** 2);
  const 二类钩弧Dx = -二类钩弧半径 * (1 + 二类钩正切 / 二类钩S);
  const 二类钩弧Dy = 二类钩弧半径 / 二类钩S;
  const 三类钩 = 三类钩列表.includes(feature);

  // 四类钩弧：h → → 钩 ↑，sweep=1 (CW)，90° 圆弧
  const 四类钩 = 四类钩列表.includes(feature);
  const 四类钩弧半径 = 四类钩 ? Math.min(参考长度 * 0.2, 5) : 0;

  // 3. 逐段构建路径

  for (const [序号, { command, parameterList }] of curveList.entries()) {
    const 是末段 = 序号 === 段数 - 1;
    const 是倒数二 = 序号 === 段数 - 2;
    const 符号 = (v: number) => (v >= 0 ? 1 : -1);

    if (弯美化 && 是倒数二) {
      // A. 弯笔画倒数第二段（V）→ 截短 + V→H 过渡圆弧
      路径命令列表.push(
        `v ${parameterList[0] - 符号(parameterList[0]) * 弯半径}`,
      );
      路径命令列表.push(`a ${弯半径} ${弯半径} 0 0 0 ${弯半径} ${弯半径}`);
    } else if (是末段 && command === "h" && (弯美化 || 四类钩)) {
      // B. 末段为 H，需要弯和/或四类钩美化 → 截短（可能两端）+ 可选 H→钩弧
      const s = 符号(parameterList[0]);
      const 截短量 = (弯美化 ? 弯半径 : 0) + (四类钩 ? 四类钩弧半径 : 0);
      路径命令列表.push(`h ${parameterList[0] - s * 截短量}`);
      if (四类钩) {
        路径命令列表.push(
          `a ${四类钩弧半径} ${四类钩弧半径} 0 0 0 ${s * 四类钩弧半径} ${-四类钩弧半径}`,
        );
      }
    } else if (是末段 && command === "v" && 二类钩) {
      // C. 末段为 V，需要二类钩美化 → 截短 + V→钩过渡圆弧
      const s = 符号(parameterList[0]);
      const 截短 = parameterList[0] - s * 二类钩弧半径;
      if (截短 * s > 0) 路径命令列表.push(`v ${截短}`);
      路径命令列表.push(
        `a ${二类钩弧半径} ${二类钩弧半径} 0 0 1 ${二类钩弧Dx} ${s * 二类钩弧Dy}`,
      );
    } else if (是末段 && command === "h" && feature.endsWith("提")) {
      // D. 末段为 H，且笔画特征为提 → 自动变成斜线
      路径命令列表.push(`l ${parameterList[0]} ${-0.15 * parameterList[0]}`);
    } else if (command === "a") {
      路径命令列表.push("a 50,50 0 1,1 0,100");
      路径命令列表.push("a 50,50 0 1,1 0,-100");
    } else {
      路径命令列表.push(command.replace("z", "c") + parameterList.join(" "));
    }
  }

  // 4. 添加钩

  const 钩长 = Math.min(5 + 参考长度 * 0.25, 15);

  if (一类钩) {
    let 前一笔画是竖点 = false,
      前一笔画长度 = 0;
    if (strokeIndex > 0) {
      const 前一笔画 = self[strokeIndex - 1]!;
      if (前一笔画.feature === "点" && isEqual(前一笔画.start, start)) {
        前一笔画是竖点 = true;
        前一笔画长度 = 取绘制长度(前一笔画.curveList.at(-1)!);
      }
    }
    if (前一笔画是竖点) {
      路径命令列表.push(`l ${0} ${前一笔画长度}`);
    } else {
      路径命令列表.push(`l ${-钩长} ${钩长}`);
    }
  } else if (二类钩) {
    路径命令列表.push(`l ${-钩长} ${-钩长 * 二类钩正切}`);
  } else if (三类钩) {
    路径命令列表.push(`l ${钩长 * 0.3} ${-钩长}`);
  } else if (四类钩) {
    路径命令列表.push(`l 0 ${-钩长}`);
  }

  return 路径命令列表.join(" ");
};

interface StrokesViewProps {
  glyph: 图形盒子;
  setGlyph?: (glyph: 矢量笔画数据[]) => void;
  displayMode?: boolean;
}

interface PointIndex {
  strokeIndex: number;
  curveIndex: number;
  controlIndex: number;
}

const Circle: React.FC<{
  center: 向量;
  index: PointIndex;
  setIndex: (i: PointIndex) => void;
}> = ({ center, index, setIndex }) => {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: needed for interactions
    <circle
      cx={center[0]}
      cy={center[1]}
      r="1.5"
      fill="red"
      onMouseDown={() => setIndex(index)}
      className="cursor-pointer"
    />
  );
};

interface ControlProps {
  stroke: 矢量笔画数据;
  strokeIndex: number;
  setIndex: (i: PointIndex) => void;
}

const Control = ({ stroke, strokeIndex, setIndex }: ControlProps) => {
  const 起点 = stroke.start;
  let 当前位置: 向量 = [起点[0], 起点[1]];
  return (
    <>
      <Circle
        center={起点}
        index={{ strokeIndex, curveIndex: -1, controlIndex: -1 }}
        setIndex={setIndex}
      />
      {stroke.curveList.map((curve, curveIndex) => {
        if (curve.command === "h" || curve.command === "v") {
          const 前一点: 向量 = [...当前位置];
          if (curve.command === "h") 前一点[0] += curve.parameterList[0];
          if (curve.command === "v") 前一点[1] += curve.parameterList[0];
          当前位置 = structuredClone(前一点);
          return (
            <Circle
              key={curveIndex}
              center={前一点}
              index={{
                strokeIndex,
                curveIndex,
                controlIndex: 1,
              }}
              setIndex={setIndex}
            />
          );
        }
        if (curve.command === "a") {
          return null;
        }
        const [x1, y1, x2, y2, x, y] = curve.parameterList as N6;
        const 前一点: 向量 = [...当前位置];
        const 控制点一 = 加(前一点, [x1, y1]);
        const 控制点二 = 加(前一点, [x2, y2]);
        const 控制点三 = 加(前一点, [x, y]);
        当前位置 = structuredClone(控制点三);
        return (
          <Fragment key={curveIndex}>
            <Circle
              key={0}
              center={控制点一}
              index={{ strokeIndex, curveIndex, controlIndex: 1 }}
              setIndex={setIndex}
            />
            <Circle
              key={1}
              center={控制点二}
              index={{ strokeIndex, curveIndex, controlIndex: 2 }}
              setIndex={setIndex}
            />
            <Circle
              key={2}
              center={当前位置}
              index={{ strokeIndex, curveIndex, controlIndex: 3 }}
              setIndex={setIndex}
            />
            <path
              d={`M ${前一点.join(" ")} L ${控制点一[0]} ${控制点一[1]} L ${控制点二[0]} ${控制点二[1]} L ${当前位置[0]} ${当前位置[1]}`}
              stroke="grey"
              strokeWidth="0.3"
              fill="none"
            />
          </Fragment>
        );
      })}
    </>
  );
};

export default function GlyphView({
  glyph,
  setGlyph,
  displayMode,
}: StrokesViewProps) {
  const 画布引用 = useRef<SVGSVGElement>(null);
  const [index, setIndex] = useState<PointIndex | null>(null);
  const 渲染后字形 = glyph.获取笔画列表().map((x) => new 笔画图形(x));

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!index || !画布引用.current) return;
      const 画布 = 画布引用.current;
      const 原始点 = 画布.createSVGPoint();
      原始点.x = e.clientX;
      原始点.y = e.clientY;
      const 变换后点 = 原始点.matrixTransform(画布.getScreenCTM()?.inverse());
      const x = Math.round(变换后点.x);
      const y = Math.round(变换后点.y);
      const 新笔画列表 = structuredClone(glyph.获取笔画列表());
      const { strokeIndex, curveIndex, controlIndex } = index;
      if (curveIndex === -1) {
        新笔画列表[strokeIndex]!.start = [x, y];
      } else {
        const curve = 新笔画列表[strokeIndex]!.curveList[curveIndex]!;
        const 渲染后曲线 = 渲染后字形[strokeIndex]!.curveList[curveIndex]!;
        const 前一点 = 渲染后曲线._controls()[controlIndex]!;
        const 差值 = 减([x, y], 前一点);
        if (curve.command === "h" || curve.command === "v") {
          curve.parameterList[0] += curve.command === "h" ? 差值[0] : 差值[1];
        } else {
          curve.parameterList[controlIndex * 2 - 2]! += 差值[0];
          curve.parameterList[controlIndex * 2 - 1]! += 差值[1];
        }
      }

      setGlyph?.(新笔画列表);
    },
    [index, 渲染后字形, setGlyph],
  );

  const onMouseUp = () => {
    setIndex(null);
  };

  useEffect(() => {
    if (!setGlyph) return;
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [setGlyph, index, onMouseMove]);

  const { strokeWidth, viewBox } = glyph.确定笔画粗细和视窗(
    displayMode ?? false,
  );

  const 笔画列表 = glyph.获取笔画列表();

  return (
    <svg
      role="img"
      className="inline align-baseline"
      aria-label="strokes view"
      ref={画布引用}
      xmlns="http://www.w3.org/2000/svg"
      version="1.1"
      width="1em"
      height="1em"
      viewBox={viewBox}
    >
      {笔画列表.map((stroke, strokeIndex, self) => {
        return (
          <g key={strokeIndex}>
            <path
              d={处理路径(stroke, strokeIndex, self)}
              stroke="currentColor"
              strokeWidth={strokeWidth}
              fill="transparent"
              strokeLinecap="square"
            />
            {setGlyph && (
              <Control
                stroke={stroke}
                strokeIndex={strokeIndex}
                setIndex={setIndex}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
