import type {
  AnalysisConfig,
  BasicComponent,
} from "../src/main";
import { determine, 部件图形, getPrimitveRepertoire } from "../src/index";

export const primitiveRepertoire = getPrimitveRepertoire();
export const repertoire = determine(primitiveRepertoire);
export const computedComponents = Object.fromEntries(
  Object.entries(repertoire)
    .filter(([_, v]) => v.glyph?.type === "basic_component")
    .map(([k, v]) => {
      const glyph = (v.glyph as BasicComponent).strokes;
      return [k, new 部件图形(k, glyph)];
    }),
);

export const analysisConfig: AnalysisConfig = {
  analysis: {},
  roots: new Map(),
  optionalRoots: new Set(),
};
