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

interface Stroke {
  feature: Feature;
  start: Point;
  curveList: Draw[];
}

type Component = Stroke[];

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
  operandList: [number, number];
  mix?: number;
}

interface Character {
  pinyin: string[];
  tygf: boolean;
  gb2312: boolean;
}

type Glyph = {
  name: string | null;
  gf0014_id: string | null;
} & (
  | {
      default_type: 0;
      component: Component;
      compound: Compound | null;
      slice: Alias | null;
    }
  | {
      default_type: 1;
      component: Component | null;
      compound: Compound;
      slice: Alias | null;
    }
  | {
      default_type: 2;
      component: Component | null;
      compound: Compound | null;
      slice: Alias;
    }
);

type Form = Record<string, Glyph>;
type Repertoire = Record<string, Character>;
type Slices = Record<string, Alias>;

type Alias = { source: number; indices: number[] };

export type { N1, N2, N3, N6 };
export type {
  SVGCommand,
  Point,
  Draw,
  Stroke,
  Glyph,
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
  Slices,
};
