import components from "../data/components.json";
import compounds from "../data/compounds.json";
import { Components, Compounds } from "../lib/data";
import findTopology from "../lib/topology";
import xingyin from "../templates/xingyin.yaml";
import { Config, FormConfig } from "../lib/config";

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
  return (xingyin as Config).form;
};
