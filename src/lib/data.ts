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

export const operators = [
  "⿰",
  "⿱",
  "⿲",
  "⿳",
  "⿴",
  "⿵",
  "⿶",
  "⿷",
  "⿸",
  "⿹",
  "⿺",
  "⿻",
];

type Operator = (typeof operators)[number];

interface Block {
  index: number;
  strokes: number;
}

interface Partition {
  operator: Operator;
  operandList: string[];
  tags?: string[];
  order?: Block[];
}

type Compound = Partition[];

interface Character {
  pinyin: string[];
  tygf: boolean;
  gb2312: boolean;
}

type GlyphBase = {
  unicode: number;
  name: string | null;
  gf0014_id: number | null;
  component?: Component;
  compound?: Compound;
  slice?: Alias;
  ambiguous: boolean;
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
type GlyphOptionalUnicode = Omit<Glyph, "unicode"> & { unicode?: number };

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
  GlyphOptionalUnicode,
  ComponentGlyph,
  CompoundGlyph,
  SliceGlyph,
  Partition,
  Block,
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
