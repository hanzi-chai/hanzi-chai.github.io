import { Dispatch, ReducerAction, createContext } from "react";
import { Config } from "../lib/config";
import wen from "../data/wen.json";
import { Wen } from "../lib/data";
// import yin from "../data/yin.json";
import { Yin } from "../lib/data";
import defaultConfig from "../default.yaml";
import { useLocation } from "react-router-dom";

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
    };

export const configReducer = (config: Config, action: Action) => {
  const { pathname } = location;
  const [_, id] = pathname.split("/");
  let newconfig;
  switch (action.type) {
    case "info":
      newconfig = { ...config, info: { ...config.info, ...action.content } };
      break;
    case "load":
      newconfig = action.content;
      break;
    case "add-root":
      newconfig = config.roots.includes(action.content)
        ? config
        : { ...config, roots: config.roots.concat(action.content) };
      break;
    case "remove-root":
      newconfig = {
        ...config,
        roots: config.roots.filter((root) => root !== action.content),
        aliaser: Object.fromEntries(
          Object.entries(config.aliaser).filter(
            ([x, v]) => x != action.content,
          ),
        ),
      };
      break;
    case "add-sliced-root":
      const { name, source, indices } = action;
      newconfig = {
        ...config,
        roots: config.roots.concat(name),
        aliaser: { ...config.aliaser, [name]: { source, indices } },
      };
      break;
  }

  localStorage.setItem(id, JSON.stringify(newconfig));
  return newconfig;
};

export const WenContext = createContext(wen as unknown as Wen);
// export const YinContext = createContext(yin as unknown as Yin);
export const ConfigContext = createContext(defaultConfig as Config);
export const DispatchContext = createContext<Dispatch<Action>>(() => {});
