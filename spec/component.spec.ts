import { describe, expect, it } from "vitest";
import {
  classifier,
  createConfig,
  defaultConfig,
  getComponentScheme,
  listToObject,
  recursiveRenderComponent,
  renderRootList,
} from "~/lib";
import type { DerivedComponent, PrimitiveRepertoire } from "~/lib";
import { primitiveRepertoire, repertoire, computedComponents } from "./mock";

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
    keyboard: "米十五笔字根",
    encoder: "形音码",
  });

  const rootList = renderRootList(repertoire, config);
  it("can get component scheme", () => {
    const 天 = computedComponents.天!;
    const scheme = getComponentScheme(天, rootList, config, classifier);
    expect(scheme).toHaveProperty("sequence");
  });
});
