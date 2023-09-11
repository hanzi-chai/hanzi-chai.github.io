interface Curve {
  command: string;
  parameterList: number[];
}

interface Stroke {
  feature: string;
  start: number[];
  curveList: Curve[];
}

interface Component {
  shape: {
    glyph: Stroke[];
    reference: string;
  }[];
}

interface Character {
  shape: Component[];
}

export type { Curve, Stroke, Component, Character }
