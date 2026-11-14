import type { N6, 向量, 图形盒子, 矢量笔画数据 } from "hanzi-chai";
import { 减, 加, 生成笔画路径, 笔画图形 } from "hanzi-chai";
import type React from "react";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";

export { 处理路径 } from "hanzi-chai";

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
        if (
          curve.command === "h" ||
          curve.command === "v" ||
          curve.command === "l"
        ) {
          const 前一点: 向量 = [...当前位置];
          if (curve.command === "h") 前一点[0] += curve.parameterList[0];
          if (curve.command === "v") 前一点[1] += curve.parameterList[0];
          if (curve.command === "l") {
            前一点[0] += curve.parameterList[0];
            前一点[1] += curve.parameterList[1];
          }
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
  const 路径列表 = 生成笔画路径(笔画列表);

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
      {笔画列表.map((stroke, strokeIndex) => {
        return (
          <g key={strokeIndex}>
            <path
              d={路径列表[strokeIndex]}
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
