import mswb from "../examples/mswb.yaml";
import flypy from "../examples/flypy.yaml";
import yima from "../examples/yima.yaml";
import { ExampleConfig } from "./config";

export type Example = "mswb" | "flypy" | "yima";

export const examples: Record<Example, ExampleConfig> = {
  mswb: mswb as ExampleConfig,
  flypy: flypy as ExampleConfig,
  yima: yima as ExampleConfig,
};
