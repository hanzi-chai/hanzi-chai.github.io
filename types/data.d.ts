
type Page = "home" | "info" | "data" | "rule" | "root" | "result";


interface Config {
  info: {
    id: string,
    name: string,
    author: string,
    version: string,
    description: string,
  },
}


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
