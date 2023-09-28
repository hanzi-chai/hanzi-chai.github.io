import wen from "../data/wen.json";
import zi from "../data/zi.json";
import { Component, Wen, Zi } from "./data";
import findTopology from "./topology";
import xingyin from "../templates/xingyin.yaml";
import { Config, RootConfig } from "./config";

export const useWen = () => {
  return wen as unknown as Wen;
};

export const useWenSimp = () => {
  const w = wen as unknown as Wen;
  return Object.fromEntries(
    Object.entries(w).map(([x, v]) => {
      return [x, v.shape[0].glyph];
    }),
  );
};

export const useZi = () => {
  return zi as unknown as Zi;
};

export const buildCache = (name: string) => {
  const component = useWen()[name];
  const glyph = component.shape[0].glyph;
  return { name, glyph, topology: findTopology(glyph) };
};

export const useXingyin = () => {
  return (xingyin as Config).elements[0] as RootConfig;
};
