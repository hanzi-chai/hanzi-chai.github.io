import type React from "react";
import { useState, useRef, useEffect, useCallback, Fragment } from "react";
import styled from "styled-components";
import type {
  BoundingBox,
  Draw,
  Feature,
  N6,
  Point,
  SVGGlyphWithBox,
  SVGStroke,
} from "~/lib";
import { renderSVGGlyph, renderSVGStroke } from "~/lib";
import { add, subtract } from "~/lib/mathjs";

const Box = styled.div`
  border: 1px solid black;
  aspect-ratio: 1;
  width: 400px;
  height: 400px;
  font-size: 398px;
`;

const drawLength = ({ command, parameterList }: Draw) => {
  if (command === "h" || command === "v") {
    return parameterList[0];
  }
  if (command === "a") {
    return 0;
  }
  const [_x1, _y1, _x2, _y2, x3, y3] = parameterList as N6;
  return Math.sqrt(x3 * x3 + y3 * y3);
};

const processPath = ({ start, feature, curveList }: SVGStroke) => {
  const svgCommands: string[] = [`M${start.join(" ")}`];
  for (const [index, { command, parameterList }] of curveList.entries()) {
    let svgCommand: string;
    if (
      index === curveList.length - 1 &&
      command === "h" &&
      feature.endsWith("提")
    ) {
      const length = parameterList[0];
      svgCommand = `l ${length} ${-0.15 * length}`;
    } else if (command === "a") {
      svgCommands.push("a 50,50 0 1,1 0,100");
      svgCommand = "a 50,50 0 1,1 0,-100";
    } else {
      svgCommand = command.replace("z", "c") + parameterList.join(" ");
    }
    svgCommands.push(svgCommand);
  }
  const type1Gou: Feature[] = ["横钩"]; // 左下
  const type2Gou: Feature[] = [
    "竖钩",
    "横折钩",
    "竖折折钩",
    "横折折折钩",
    "弯钩",
    "横撇弯钩",
  ]; // 左上
  const type3Gou: Feature[] = ["斜钩", "横斜钩", "竖弯钩", "横折弯钩", "撇钩"]; // 上
  const referenceLength = drawLength(curveList.at(-1)!);
  const gouLength = 5 + referenceLength * 0.25;
  if (type1Gou.includes(feature)) {
    svgCommands.push(`l ${0} ${20}`);
  } else if (type2Gou.includes(feature)) {
    svgCommands.push(`l ${-gouLength} ${-gouLength * 0.3}`);
  } else if (type3Gou.includes(feature)) {
    svgCommands.push(`l ${gouLength * 0.3} ${-gouLength}`);
  }
  return svgCommands.join(" ");
};

interface StrokesViewProps {
  glyph: SVGGlyphWithBox;
  setGlyph?: (glyph: SVGStroke[]) => void;
  displayMode?: boolean;
}

interface PointIndex {
  strokeIndex: number;
  curveIndex: number;
  controlIndex: number;
}

const Circle: React.FC<{
  center: Point;
  index: PointIndex;
  setIndex: (i: PointIndex) => void;
}> = ({ center, index, setIndex }) => {
  return (
    <circle
      cx={center[0]}
      cy={center[1]}
      r="1.5"
      fill="red"
      onMouseDown={() => setIndex(index)}
      style={{ cursor: "pointer" }}
    />
  );
};

interface ControlProps {
  stroke: SVGStroke;
  strokeIndex: number;
  setIndex: (i: PointIndex) => void;
}

const Control = ({ stroke, strokeIndex, setIndex }: ControlProps) => {
  const start = stroke.start;
  let current: Point = [start[0], start[1]];
  return (
    <>
      <Circle
        center={start}
        index={{ strokeIndex, curveIndex: -1, controlIndex: -1 }}
        setIndex={setIndex}
      />
      {stroke.curveList.map((curve, curveIndex) => {
        if (curve.command === "h" || curve.command === "v") {
          const previous: Point = [...current];
          if (curve.command === "h") previous[0] += curve.parameterList[0];
          if (curve.command === "v") previous[1] += curve.parameterList[0];
          current = structuredClone(previous);
          return (
            <Circle
              key={curveIndex}
              center={previous}
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
        const previous: Point = [...current];
        const control1 = add(previous, [x1, y1]);
        const control2 = add(previous, [x2, y2]);
        const control3 = add(previous, [x, y]);
        current = structuredClone(control3);
        return (
          <Fragment key={curveIndex}>
            <Circle
              key={0}
              center={control1}
              index={{ strokeIndex, curveIndex, controlIndex: 1 }}
              setIndex={setIndex}
            />
            <Circle
              key={1}
              center={control2}
              index={{ strokeIndex, curveIndex, controlIndex: 2 }}
              setIndex={setIndex}
            />
            <Circle
              key={2}
              center={current}
              index={{ strokeIndex, curveIndex, controlIndex: 3 }}
              setIndex={setIndex}
            />
            <path
              d={`M ${previous.join(" ")} L ${control1[0]} ${control1[1]} L ${control2[0]} ${control2[1]} L ${current[0]} ${current[1]}`}
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

const Rectangles = ({
  stroke,
  strokeWidth,
}: {
  stroke: SVGStroke;
  strokeWidth: number;
}) => {
  const { curveList } = renderSVGStroke(stroke);
  const firstCommand = stroke.curveList[0]?.command;
  const lastCommand = stroke.curveList.at(-1)?.command;
  const firstCurve = curveList[0]!;
  const lastCurve = curveList.at(-1)!;
  const shouldDrawFist =
    (firstCommand === "h" || firstCommand === "v") &&
    !stroke.feature.endsWith("提");
  const shouldDrawLast =
    (lastCommand === "h" || lastCommand === "v") &&
    !stroke.feature.endsWith("提");
  return (
    <>
      {shouldDrawFist && (
        <rect
          fill="currentColor"
          x={firstCurve.controls[0][0] - strokeWidth / 2}
          y={firstCurve.controls[0][1] - strokeWidth / 2}
          width={strokeWidth}
          height={strokeWidth}
        />
      )}
      {shouldDrawLast && (
        <rect
          fill="currentColor"
          x={lastCurve.controls.at(-1)![0] - strokeWidth / 2}
          y={lastCurve.controls.at(-1)![1] - strokeWidth / 2}
          width={strokeWidth}
          height={strokeWidth}
        />
      )}
    </>
  );
};

const determineWidthAndViewBox = (box: BoundingBox, displayMode: boolean) => {
  const strokeWidthPercentage = displayMode ? 0.01 : 0.07;
  const {
    x: [xMin, xMax],
    y: [yMin, yMax],
  } = box;
  const padding = 10;
  const xSpan = xMax - xMin + 2 * padding;
  const ySpan = yMax - yMin + 2 * padding;
  const maxSpan = Math.max(xSpan, ySpan);
  const xMinFinal = (xMax + xMin) / 2 - maxSpan / 2;
  const yMinFinal = (yMax + yMin) / 2 - maxSpan / 2;
  const viewBox = `${xMinFinal} ${yMinFinal} ${maxSpan} ${maxSpan}`;
  const strokeWidth = maxSpan * strokeWidthPercentage;
  return { strokeWidth, viewBox };
};

const StrokesView = ({ glyph, setGlyph, displayMode }: StrokesViewProps) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [index, setIndex] = useState<PointIndex | null>(null);
  const { strokes, box } = glyph;
  const renderedGlyph = renderSVGGlyph(strokes);

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!index || !svgRef.current) return;
      const svg = svgRef.current;
      const point = svg.createSVGPoint();
      point.x = e.clientX;
      point.y = e.clientY;
      const transformedPoint = point.matrixTransform(
        svg.getScreenCTM()?.inverse(),
      );
      const x = Math.round(transformedPoint.x);
      const y = Math.round(transformedPoint.y);
      const newGlyph = structuredClone(strokes);
      const { strokeIndex, curveIndex, controlIndex } = index;
      if (curveIndex === -1) {
        newGlyph[strokeIndex]!.start = [x, y];
      } else {
        const curve = newGlyph[strokeIndex]?.curveList[curveIndex]!;
        const renderedCurve =
          renderedGlyph[strokeIndex]?.curveList[curveIndex]!;
        const previous = renderedCurve.controls[controlIndex]!;
        const diff = subtract([x, y], previous);
        if (curve.command === "h" || curve.command === "v") {
          curve.parameterList[0] += curve.command === "h" ? diff[0] : diff[1];
        } else {
          curve.parameterList[controlIndex * 2 - 2]! += diff[0];
          curve.parameterList[controlIndex * 2 - 1]! += diff[1];
        }
      }

      setGlyph?.(newGlyph);
    },
    [index, strokes, renderedGlyph, setGlyph],
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
  }, [setGlyph, index, strokes, onMouseMove]);

  const { strokeWidth, viewBox } = determineWidthAndViewBox(
    box,
    displayMode ?? false,
  );

  return (
    <svg
      role="img"
      aria-label="strokes view"
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      version="1.1"
      width="1em"
      height="1em"
      viewBox={viewBox}
    >
      {strokes.map((stroke, strokeIndex) => {
        return (
          <g key={strokeIndex}>
            <Rectangles stroke={stroke} strokeWidth={strokeWidth} />
            <path
              d={processPath(stroke)}
              stroke="currentColor"
              strokeWidth={strokeWidth}
              fill="none"
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
};

interface FontViewProps {
  reference: string;
}

const FontView: React.FC<FontViewProps> = ({ reference }) => (
  <svg
    role="img"
    aria-label="font view"
    xmlns="http://www.w3.org/2000/svg"
    version="1.1"
    width="100%"
    viewBox="0 0 1000 1000"
  >
    <path d={reference} stroke="grey" transform="matrix(1,0,0,-1,0,850)" />
  </svg>
);

export { Box, FontView, StrokesView };
