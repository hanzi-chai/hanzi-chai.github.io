import { Feature } from "./classifier";

type N1 = [number];
type N2 = [number, number];
type N3 = [number, number, number];
type N6 = [number, number, number, number, number, number];

type Draw =
  | {
      command: "h";
      parameterList: N1;
    }
  | {
      command: "v";
      parameterList: N1;
    }
  | {
      command: "l";
      parameterList: N2;
    }
  | {
      command: "c";
      parameterList: N6;
    };

type SVGCommand = Draw["command"];

type Point = N2;

type LinearCurve = {
  type: "linear";
  controls: [Point, Point];
};

type CubicCurve = {
  type: "cubic";
  controls: [Point, Point, Point, Point];
};

type Curve = LinearCurve | CubicCurve;

interface SVGStroke {
  feature: Feature;
  start: Point;
  curveList: Draw[];
}

type Component = SVGStroke[];

type Operator =
  | "⿰"
  | "⿱"
  | "⿲"
  | "⿳"
  | "⿴"
  | "⿵"
  | "⿶"
  | "⿷"
  | "⿸"
  | "⿹"
  | "⿺"
  | "⿻"
  | "〾";

interface Compound {
  operator: Operator;
  operandList: [string, string];
  mix?: number;
}

interface Character {
  pinyin: string[];
  tygf: boolean;
  gb2312: boolean;
}

type GlyphBase = {
  name: string | null;
  gf0014_id: string | null;
  component: Component | null;
  compound: Compound | null;
  slice: Alias | null;
};

interface ComponentGlyph extends GlyphBase {
  default_type: 0;
  component: Component;
}

interface SliceGlyph extends GlyphBase {
  default_type: 1;
  slice: Alias;
}

interface CompoundGlyph extends GlyphBase {
  default_type: 2;
  compound: Compound;
}

type Glyph = ComponentGlyph | CompoundGlyph | SliceGlyph;

type Form = Record<string, Glyph>;
type Repertoire = Record<string, Character>;

type Alias = { source: string; indices: number[] };

export type { N1, N2, N3, N6 };
export type {
  SVGCommand,
  Point,
  Draw,
  SVGStroke as Stroke,
  Glyph,
  ComponentGlyph,
  CompoundGlyph,
  SliceGlyph,
  Component,
  Compound,
  Operator,
  Alias,
  Character,
  LinearCurve,
  CubicCurve,
  Curve,
  Form,
  Repertoire,
};
