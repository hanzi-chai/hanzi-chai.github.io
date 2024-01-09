import styled from "styled-components";
import type {
  Character,
  Component,
  Compound,
  SVGGlyph,
  SVGStroke,
  Stroke,
} from "~/lib/data";
import { Empty, Result } from "antd";
import {
  allRepertoireAtom,
  determinedRepertoireAtom,
  tagsAtom,
  useAtomValue,
} from "~/atoms";
import type { FormInstance } from "antd/es/form/Form";
import { useWatch } from "antd/es/form/Form";
import {
  recursiveRenderComponent,
  recursiveRenderCompound,
  recursiveRenderGlyph,
} from "~/lib/component";
import { findGlyph } from "~/lib/repertoire";

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
  const allRepertoire = useAtomValue(allRepertoireAtom);
  const glyph = recursiveRenderComponent(component, allRepertoire);
  return !(glyph instanceof Error) ? (
    <StrokesView glyph={glyph} />
  ) : (
    <Result status="500" title="无法渲染出 SVG 图形，请检查数据" />
  );
};

export const CompoundView = ({ compound }: { compound: Compound }) => {
  const allRepertoire = useAtomValue(allRepertoireAtom);
  const glyph = recursiveRenderCompound(compound, allRepertoire);
  return !(glyph instanceof Error) ? (
    <StrokesView glyph={glyph} />
  ) : (
    <Result status="500" title="无法渲染出 SVG 图形，请检查数据" />
  );
};

const Overlay = styled.div`
  border: 1px solid black;
  aspect-ratio: 1;
  display: grid;

  & svg {
    grid-area: 1 / 1 / 1 / 1;
  }
`;

const GlyphView = ({ form }: { form: FormInstance<Character> }) => {
  const glyphs = useWatch("glyphs", form);
  const tags = useAtomValue(tagsAtom);
  if (glyphs === undefined) {
    return null;
  }
  const glyph = findGlyph(glyphs, tags);
  return (
    <Overlay>
      {glyph === undefined ? null : glyph.type === "component" ? (
        <ComponentView component={glyph} />
      ) : (
        <CompoundView compound={glyph} />
      )}
    </Overlay>
  );
};

export default GlyphView;
