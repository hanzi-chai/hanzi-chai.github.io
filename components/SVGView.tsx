import styled from "styled-components";
import { Stroke } from "../lib/data";
import { PropsWithChildren, useContext } from "react";
import { FontContext, useComponents, useSlices } from "./context";
import { Typography } from "antd";

const FontView = ({ reference }: { reference: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    version="1.1"
    width="100%"
    viewBox="0 0 1000 1000"
  >
    <path d={reference} stroke="grey" transform="matrix(1,0,0,-1,0,850)" />
  </svg>
);

const processPath = ({ start, curveList }: Stroke) =>
  "M" +
  start.join(" ") +
  curveList
    .map(({ command, parameterList }) => command + parameterList.join(" "))
    .join("");

export const StrokesView = ({ glyph }: { glyph: Stroke[] }) => (
  <svg
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
  </svg>
);

export const ComponentView = ({ name }: { name: string }) => {
  const components = useComponents();
  const font = useContext(FontContext);
  return (
    <>
      <FontView reference={font[name]} />
      <StrokesView glyph={components[name]} />
    </>
  );
};

export const SliceView = ({ name }: { name: string }) => {
  const components = useComponents();
  const font = useContext(FontContext);
  const slices = useSlices();
  const { source, indices } = slices[name];
  const glyph = components[source];
  const subglyph = indices.map((x) => glyph[x]);
  return (
    <>
      <FontView reference={font[source]} />
      <StrokesView glyph={subglyph} />
    </>
  );
};

export default function SVGView({ children }: PropsWithChildren) {
  return (
    <>
      <Typography.Title level={2}>查看 SVG</Typography.Title>
      <Overlay>{children}</Overlay>
    </>
  );
}

const Overlay = styled.div`
  border: 1px solid black;
  aspect-ratio: 1;
  display: grid;

  & svg {
    grid-area: 1 / 1 / 1 / 1;
  }
`;
