import styled from "styled-components";
import { Stroke } from "../lib/data";
import { PropsWithChildren, useContext } from "react";
import { FontContext, useForm, useFormByChar } from "./context";
import { Empty, Typography } from "antd";

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
  const glyph = useFormByChar(name);
  return (
    <>
      <StrokesView glyph={glyph.component!} />
    </>
  );
};

export const CompoundView = ({ name }: { name: string }) => {
  const glyph = useFormByChar(name);
  return <Empty description="暂不支持复合体的预览" />;
};

export const SliceView = ({ name }: { name: string }) => {
  const glyph = useFormByChar(name);
  const { source, indices } = glyph.slice!;
  const sourceGlyph = useFormByChar(String.fromCodePoint(source));
  const component = sourceGlyph.component!;
  const subglyph = indices.map((x) => component[x]);
  return (
    <>
      <StrokesView glyph={subglyph} />
    </>
  );
};
