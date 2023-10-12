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
  feature: string;
  start: Point;
  curveList: Draw[];
}

interface RenderedStroke {
  feature: string;
  curveList: Curve[];
}

type Glyph = Stroke[];
type RenderedGlyph = RenderedStroke[];

type Operand =
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
  operator: Operand;
  operandList: [string, string];
  mix?: number;
}

type Components = Record<string, Glyph>;
type Compounds = Record<string, Compound>;
type Characters = Record<string, string[]>;
type Slices = Record<string, Alias>;

type Alias = { source: string; indices: number[] };

export type { N1, N2, N3, N6 };
export type { Point, Draw, Stroke, Glyph, Compound, Operand, Alias };
export type { Components, Compounds, Characters, Slices };
export type { LinearCurve, CubicCurve, Curve, RenderedStroke, RenderedGlyph };
