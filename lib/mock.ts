import wen from "../data/wen.json";
import zi from "../data/zi.json";
import { Wen, Zi } from "./data";
import findTopology from "./topology";
import xingyin from "../templates/xingyin.yaml";
import { Config, RootConfig } from "./config";

export const useWen = () => {
  const w = wen as unknown as Wen;
  const x = xingyin as Config;
  return Object.assign({}, w, x.data.component);
};

export const useZi = () => {
  return zi as unknown as Zi;
};

export const buildCache = (name: string) => {
  const component = useWen()[name];
  return { name, glyph: component, topology: findTopology(component) };
};

export const useXingyin = () => {
  return (xingyin as Config).elements[0] as RootConfig;
};
