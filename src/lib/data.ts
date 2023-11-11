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

type SVGGlyph = SVGStroke[];

interface BasicComponent {
  strokes: SVGStroke[];
}

type Stroke = SVGStroke | number;

interface DerivedComponent {
  source: string;
  strokes: Stroke[];
}

type Component = BasicComponent | DerivedComponent;

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
  ambiguous: boolean;
};

interface ComponentGlyph extends GlyphBase {
  default_type: "component";
  component: Component;
}

interface CompoundGlyph extends GlyphBase {
  default_type: "compound";
  compound: Compound;
}

type Glyph = ComponentGlyph | CompoundGlyph;
type GlyphOptionalUnicode = Omit<Glyph, "unicode"> & { unicode?: number };

type Form = Record<string, Glyph>;
type Repertoire = Record<string, Character>;

export type { N1, N2, N3, N6 };
export type {
  SVGCommand,
  Point,
  Draw,
  SVGStroke as Stroke,
  Glyph,
  SVGGlyph,
  GlyphOptionalUnicode,
  ComponentGlyph,
  CompoundGlyph,
  Partition,
  Block,
  BasicComponent,
  DerivedComponent,
  Component,
  Compound,
  Operator,
  Character,
  LinearCurve,
  CubicCurve,
  Curve,
  Form,
  Repertoire,
};
