import React, { useState, useRef, useEffect } from "react";
import styled from "styled-components";

// Define the SVGStroke interface
export interface SVGStroke {
  start: number[];
  curveList: {
    command: string;
    parameterList: number[];
  }[];
}

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
  setGlyph: (glyph: SVGStroke[]) => void;
}

const StrokesView: React.FC<StrokesViewProps> = ({ glyph, setGlyph }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draggingPoint, setDraggingPoint] = useState<[number, number] | null>(
    null,
  );

  const onMouseMove = (e: MouseEvent) => {
    if (draggingPoint !== null && svgRef.current) {
      const svg = svgRef.current;
      const point = svg.createSVGPoint();
      point.x = e.clientX;
      point.y = e.clientY;
      const { x, y } = point.matrixTransform(svg.getScreenCTM()!.inverse());
      const newGlyph = [...glyph];
      const [strokeIndex, pointIndex] = draggingPoint;
      const currentParams =
        newGlyph[strokeIndex]!.curveList[pointIndex]!.parameterList;
      newGlyph[strokeIndex]!.curveList[pointIndex]!.parameterList = [
        x,
        y,
        currentParams[2] !== undefined ? currentParams[2] : 0,
        currentParams[3] !== undefined ? currentParams[3] : 0,
        currentParams[4] !== undefined ? currentParams[4] : 0,
        currentParams[5] !== undefined ? currentParams[5] : 0,
      ];

      setGlyph(newGlyph);
      console.log(`Updated glyph: ${JSON.stringify(newGlyph)}`);
    }
  };

  const onMouseUp = () => {
    setDraggingPoint(null);
  };

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [draggingPoint, glyph]);

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      version="1.1"
      width="100%"
      viewBox="0 0 100 100"
    >
      {glyph.map((stroke, strokeIndex) => (
        <g key={strokeIndex}>
          <path
            d={processPath(stroke)}
            stroke="red"
            strokeWidth="0.5"
            fill="none"
          />
          {stroke.curveList.map((curve, pointIndex) => (
            <circle
              key={pointIndex}
              cx={curve.parameterList[0]}
              cy={curve.parameterList[1]}
              r="1"
              fill="blue"
              onMouseDown={() => setDraggingPoint([strokeIndex, pointIndex])}
            />
          ))}
        </g>
      ))}
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
