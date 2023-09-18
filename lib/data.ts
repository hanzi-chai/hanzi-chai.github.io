interface Curve {
  command: string;
  parameterList: number[];
}

interface Stroke {
  feature: string;
  start: number[];
  curveList: Curve[];
}

type Glyph = Stroke[];

interface Component {
  shape: {
    glyph: Glyph;
    reference: string;
  }[];
}

interface Character {
  shape: Component[];
}

interface Database {
  [key: string]: Component;
}

export type { Curve, Stroke, Glyph, Component, Character, Database };
