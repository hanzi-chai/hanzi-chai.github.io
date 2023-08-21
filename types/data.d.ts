interface Curve {
  command: string,
  parameterList: number[]
}

interface Stroke {
  feature: string,
  start: number[],
  curveList: Curve[]
}

interface Component {
  type: 'component',
  glyph: Stroke[],
  reference: string,
}

interface Character {
  shape: Component[]
}
