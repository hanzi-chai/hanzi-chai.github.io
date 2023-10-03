import styled from "styled-components";
import { Stroke, Component } from "../lib/data";
import { useContext } from "react";
import { WenContext } from "./Context";
import { Empty, Typography } from "antd";

const FontView = ({ reference }: { reference: string }) => (
  <SVG
    id="fontsvg"
    xmlns="http://www.w3.org/2000/svg"
    version="1.1"
    width="100%"
    viewBox="0 0 1000 1000"
  >
    <path d={reference} transform="matrix(1,0,0,-1,0,850)" />
  </SVG>
);

const processPath = ({ start, curveList }: Stroke) =>
  "M" +
  start.join(" ") +
  curveList
    .map(({ command, parameterList }) => command + parameterList.join(" "))
    .join("");

export const StrokesView = ({ glyph }: { glyph: Stroke[] }) => (
  <SVG
    id="datasvg"
    xmlns="http://www.w3.org/2000/svg"
    version="1.1"
    width="100%"
    viewBox="0 0 100 100"
  >
    {glyph.map((stroke, index) => (
      <path
        key={index}
        d={processPath(stroke)}
        stroke="red"
        strokeWidth="0.5"
        fill="none"
      />
    ))}
  </SVG>
);

const SVG = styled.svg`
  grid-area: 1 / 1 / 1 / 1;
`;

export default function ComponentView({
  componentName,
}: {
  componentName?: string;
}) {
  const CHAI = useContext(WenContext);
  return (
    <Wrapper>
      <Typography.Title level={2}>查看 SVG</Typography.Title>
      <Overlay>
        {componentName ? (
          <>
            <FontView reference={CHAI[componentName].shape[0].reference} />
            <StrokesView glyph={CHAI[componentName].shape[0].glyph} />
          </>
        ) : (
          <Empty description={false} />
        )}
      </Overlay>
    </Wrapper>
  );
}

const Wrapper = styled.div`
  position: relative;
`;

const Overlay = styled.div`
  border: 1px solid black;
  aspect-ratio: 1;
  display: grid;
`;
