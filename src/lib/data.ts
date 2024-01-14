import type { Feature } from "./classifier";

export type N1 = [number];
export type N2 = [number, number];
export type N3 = [number, number, number];
export type N6 = [number, number, number, number, number, number];

export type Draw =
  | {
      command: "h" | "v";
      parameterList: N1;
    }
  | {
      command: "c" | "z";
      parameterList: N6;
    };

export type SVGCommand = Draw["command"];

export type Point = N2;

export interface SVGStroke {
  feature: Feature;
  start: Point;
  curveList: Draw[];
}

export interface ReferenceStroke {
  feature: "reference";
  index: number;
}

export type SVGGlyph = SVGStroke[];
export type Stroke = SVGStroke | ReferenceStroke;

export interface DerivedComponent {
  type: "derived_component";
  tags?: string[];
  source: string;
  strokes: Stroke[];
}

export interface BasicComponent {
  type: "basic_component";
  tags?: string[];
  strokes: SVGStroke[];
}

export type Component = BasicComponent | DerivedComponent;

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
] as const;

export type Operator = (typeof operators)[number];

export interface Block {
  index: number;
  strokes: number;
}

export interface Compound {
  type: "compound";
  operator: Operator;
  operandList: string[];
  tags?: string[];
  order?: Block[];
}

export interface PrimitveCharacter {
  unicode: number;
  tygf: 0 | 1 | 2 | 3;
  gb2312: boolean;
  name: string | null;
  gf0014_id: number | null;
  readings: string[];
  glyphs: (BasicComponent | DerivedComponent | Compound)[];
  ambiguous: boolean;
}

export interface Character
  extends Omit<PrimitveCharacter, "glyphs" | "ambiguous"> {
  glyph: BasicComponent | Compound | undefined;
}

export type PrimitiveRepertoire = Record<string, PrimitveCharacter>;

export type Repertoire = Record<string, Character>;
