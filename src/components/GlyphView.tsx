import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  Fragment,
} from "react";
import styled from "styled-components";
import { renderSVGGlyph, type N6, type Point, type SVGStroke } from "~/lib";
import { add, subtract } from "~/lib/mathjs";

const Box = styled.div`
  border: 1px solid black;
  aspect-ratio: 1;
  display: grid;

  & svg {
    grid-area: 1 / 1 / 1 / 1;
  }
`;

const processPath = ({ start, curveList }: SVGStroke) =>
  "M" +
  start.join(" ") +
  curveList
    .map(
      ({ command, parameterList }) =>
        command.replace("z", "c") + parameterList.join(" "),
    )
    .join("");

interface StrokesViewProps {
  glyph: SVGStroke[];
  setGlyph?: (glyph: SVGStroke[]) => void;
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

const StrokesView: React.FC<StrokesViewProps> = ({ glyph, setGlyph }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [index, setIndex] = useState<PointIndex | null>(null);
  const renderedGlyph = renderSVGGlyph(glyph);

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!index || !svgRef.current) return;
      const svg = svgRef.current;
      const point = svg.createSVGPoint();
      point.x = e.clientX;
      point.y = e.clientY;
      const transformedPoint = point.matrixTransform(
        svg.getScreenCTM()!.inverse(),
      );
      const x = Math.round(transformedPoint.x);
      const y = Math.round(transformedPoint.y);
      const newGlyph = structuredClone(glyph);
      const { strokeIndex, curveIndex, controlIndex } = index;
      if (curveIndex === -1) {
        newGlyph[strokeIndex]!.start = [x, y];
      } else {
        const curve = newGlyph[strokeIndex]!.curveList[curveIndex]!;
        const renderedCurve =
          renderedGlyph[strokeIndex]!.curveList[curveIndex]!;
        const previous = renderedCurve.controls[controlIndex]!;
        const diff = subtract([x, y], previous);
        if (curve.command === "h" || curve.command === "v") {
          curve.parameterList[0] += curve.command === "h" ? diff[0] : diff[1];
        } else {
          curve.parameterList[controlIndex * 2 - 2] += diff[0];
          curve.parameterList[controlIndex * 2 - 1] += diff[1];
        }
      }

      setGlyph!(newGlyph);
    },
    [index, glyph, renderedGlyph, setGlyph],
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
  }, [setGlyph, index, glyph, onMouseMove]);

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      version="1.1"
      width="100%"
      viewBox="-10 -10 120 120"
    >
      <rect x="0" y="0" width="100" height="100" fill="#eee" />
      {glyph.map((stroke, strokeIndex) => {
        const start = stroke.start;
        let current: Point = [start[0], start[1]];
        return (
          <g key={strokeIndex}>
            <path
              d={processPath(stroke)}
              stroke="red"
              strokeWidth="0.5"
              fill="none"
            />
            {setGlyph && (
              <>
                <Circle
                  center={start}
                  index={{ strokeIndex, curveIndex: -1, controlIndex: -1 }}
                  setIndex={setIndex}
                />
                {stroke.curveList.map((curve, curveIndex) => {
                  if (curve.command === "h" || curve.command === "v") {
                    const previous: Point = [...current];
                    if (curve.command === "h")
                      previous[0] += curve.parameterList[0];
                    if (curve.command === "v")
                      previous[1] += curve.parameterList[0];
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
                  } else {
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
                  }
                })}
              </>
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
    xmlns="http://www.w3.org/2000/svg"
    version="1.1"
    width="100%"
    viewBox="0 0 1000 1000"
  >
    <path d={reference} stroke="grey" transform="matrix(1,0,0,-1,0,850)" />
  </svg>
);

export { Box, FontView, StrokesView };
