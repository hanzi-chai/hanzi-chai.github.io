import { describe, expect, it } from "vitest";
import {
  classifier,
  createConfig,
  generateSchemes,
  getComponentScheme,
  makeIntervalSum,
  recursiveRenderComponent,
  renderRootList,
} from "~/lib";
import type { DerivedComponent } from "~/lib";
import {
  primitiveRepertoire,
  repertoire,
  computedComponents,
  focusAnalysis,
} from "./mock";

describe("pruning", () => {
  const strokes = 4;
  const roots = [8, 4, 2, 1, 12, 6, 3, 14, 9].sort((a, b) => a - b);
  const rootsSet = new Set(roots);

  it("generate the correct set for 中", () => {
    const set = makeIntervalSum(strokes, rootsSet);
    const array = [...set].sort((a, b) => a - b);
    expect(array).toEqual([3, 6, 12, 14]);
  });

  it("generate the correct schemes for 中", () => {
    const schemes = generateSchemes(strokes, roots, new Set(roots));
    expect(schemes).toHaveLength(3);
  });
});

describe("recursive render component", () => {
  it("has nong", () => {
    const 农 = primitiveRepertoire.农!.glyphs[0]! as DerivedComponent;
    expect(recursiveRenderComponent(农, primitiveRepertoire)).toBeInstanceOf(
      Array,
    );
  });
});

describe("get component scheme", () => {
  const config = createConfig({
    name: "",
    data: "国标五分类",
    keyboard: "米十五笔",
    encoder: "形音码（米十五笔）",
  });
  const analysisConfig = focusAnalysis(config, repertoire);
  const rootList = renderRootList(repertoire, [...analysisConfig.roots.keys()]);
  it("can get component scheme", () => {
    const 天 = computedComponents.天!;
    const scheme = getComponentScheme(
      天,
      [...rootList.values()],
      analysisConfig,
      classifier,
    );
    expect(scheme).toHaveProperty("sequence");
  });
});
