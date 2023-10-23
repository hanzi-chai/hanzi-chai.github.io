import styled from "styled-components";
import { Stroke } from "../lib/data";
import { PropsWithChildren, useContext } from "react";
import { FontContext, useForm } from "./context";
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
  const components = useForm();
  const font = useContext(FontContext);
  return (
    <>
      {/* <FontView reference={font[name]} /> */}
      <StrokesView glyph={components[name].component!} />
    </>
  );
};

export const SliceView = ({ name }: { name: string }) => {
  const form = useForm();
  const font = useContext(FontContext);
  const { source, indices } = form[name].slice!;
  const glyph = form[source].component!;
  const subglyph = indices.map((x) => glyph[x]);
  return (
    <>
      <FontView reference={font[source]} />
      <StrokesView glyph={subglyph} />
    </>
  );
};
