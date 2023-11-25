import styled from "styled-components";
import type {
  BasicComponent,
  Component,
  Glyph,
  SVGGlyph,
  Stroke,
} from "~/lib/data";
import { Empty } from "antd";
import { useForm } from "./contants";
import type { Index } from "./Utils";
import type { FormInstance } from "antd/es/form/Form";
import { useWatch } from "antd/es/form/Form";
import { recursiveRenderGlyph } from "~/lib/form";

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

const processPath = ({ start, curveList }: SVGStroke) =>
  "M" +
  start.join(" ") +
  curveList
    .map(
      ({ command, parameterList }) =>
        command.replace("z", "c") + parameterList.join(" "),
    )
    .join("");

export const StrokesView = ({ glyph }: { glyph: SVGStroke[] }) => (
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

export const ComponentView = ({ component }: { component: Component }) => {
  const form = useForm();
  let glyph: SVGGlyph;
  if (component.source !== undefined) {
    const sourceGlyph = recursiveRenderGlyph(component.source, form);
    glyph = component.strokes.map((x) => {
      if (typeof x === "number") return sourceGlyph[x]!;
      return x;
    });
  } else {
    glyph = (component as BasicComponent).strokes;
  }
  return <StrokesView glyph={glyph} />;
};

export const CompoundView = ({ char }: Index) => {
  return <Empty description="暂不支持复合体的预览" />;
};

const Overlay = styled.div`
  border: 1px solid black;
  aspect-ratio: 1;
  display: grid;

  & svg {
    grid-area: 1 / 1 / 1 / 1;
  }
`;

const GlyphView = ({ form }: { form: FormInstance<Glyph> }) => {
  const component = useWatch("component", form);
  return (
    <Overlay>
      {component?.strokes ? <ComponentView component={component} /> : <Empty />}
    </Overlay>
  );
};

export default GlyphView;
