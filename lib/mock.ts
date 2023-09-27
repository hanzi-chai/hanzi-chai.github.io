import wen from "../data/wen.json";
import { Component, Wen } from "./data";
import findTopology from "./topology";

export const useWen = () => {
  return wen as unknown as Wen;
};

export const buildCache = (name: string) => {
  const component = useWen()[name];
  const glyph = component.shape[0].glyph;
  return { name, glyph, topology: findTopology(glyph) };
};
