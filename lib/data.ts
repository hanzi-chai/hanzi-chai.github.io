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

interface Wen {
  [key: string]: Glyph;
}

interface Zi {
  [key: string]: Compound;
}

interface Yin {
  [key: string]: string[];
}

export type { N1, N2, N3, N6 };
export type { Point, Draw, Stroke, Glyph, Compound, Operand, Wen, Zi, Yin };
export type { LinearCurve, CubicCurve, Curve, RenderedStroke, RenderedGlyph };
