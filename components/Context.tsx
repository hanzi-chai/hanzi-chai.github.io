import { Dispatch, ReducerAction, createContext } from "react";
import { Config } from "../lib/chai";
import CHAI from "../data/CHAI.json";
import { Database } from "../lib/data";
import defaultConfig from "../default.yaml";

export type Action =
  | {
      type: "info";
      content: Record<string, string>;
    }
  | {
      type: "load";
      content: Config;
    }
  | {
      type: "add-root";
      content: string;
    }
  | {
      type: "remove-root";
      content: string;
    }
  | {
      type: "add-sliced-root";
      name: string;
      source: string;
      indices: number[];
  }

export const configReducer = (config: Config, action: Action) => {
  switch (action.type) {
    case "info":
      return { ...config, info: { ...config.info, ...action.content } };
    case "load":
      return action.content;
    case "add-root":
      return config.roots.includes(action.content)
        ? config
        : { ...config, roots: config.roots.concat(action.content) };
    case "remove-root":
      return {
        ...config,
        roots: config.roots.filter((root) => root !== action.content),
        aliaser: Object.fromEntries(Object.entries(config.aliaser).filter(([x, v]) => x != action.content))
      };
    case "add-sliced-root":
      const { name, source, indices } = action;
      return {
        ...config,
        roots: config.roots.concat(name),
        aliaser: { ...config.aliaser, [name]: { source, indices } }
      };
  }
};

export const DataContext = createContext(CHAI as Database);
export const ConfigContext = createContext(defaultConfig as Config);
export const DispatchContext = createContext<Dispatch<Action>>(() => {});
