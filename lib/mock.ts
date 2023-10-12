import components from "../data/components.json";
import compounds from "../data/compounds.json";
import { Components, Compounds } from "./data";
import findTopology from "./topology";
import xingyin from "../templates/xingyin.yaml";
import { Config, RootConfig } from "./config";

export const getComponents = () => {
  const w = components as unknown as Components;
  const x = xingyin as Config;
  return Object.assign({}, w, x.data.components);
};

export const getCompounds = () => {
  return compounds as unknown as Compounds;
};

export const useAll = () => {};

export const buildCache = (name: string) => {
  const component = getComponents()[name];
  return { name, glyph: component, topology: findTopology(component) };
};

export const useXingyin = () => {
  return (xingyin as Config).elements[0] as RootConfig;
};
