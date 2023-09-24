import { Dispatch, ReducerAction, createContext } from "react";
import { Config, ElementConfig, RootConfig } from "../lib/config";
import wen from "../data/wen.json";
import { Wen } from "../lib/data";
import yin from "../data/yin.json";
import { Yin } from "../lib/data";
import zi from "../data/zi.json";
import { Zi } from "../lib/data";
import defaultConfig from "../templates/default.yaml";
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
  | ({
      type: "root";
      element: number;
      name: string;
    } & (
      | {
          subtype: "add";
          key: string;
        }
      | {
          subtype: "remove";
        }
      | {
          subtype: "add-sliced";
          key: string;
          source: string;
          indices: number[];
        }
    ));

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
    case "root":
      const { name } = action;
      const elementConfig = config.elements[action.element] as RootConfig;
      const { mapping, aliaser } = elementConfig;
      let newMapping = { ...mapping };
      let newAliaser = { ...aliaser };
      switch (action.subtype) {
        case "add":
          newMapping = Object.assign({ [name]: action.key }, mapping);
          break;
        case "remove":
          delete newMapping[name];
          delete newAliaser[name];
          break;
        case "add-sliced":
          const { source, indices } = action;
          newMapping[name] = action.key;
          newAliaser[name] = { source, indices };
          break;
      }
      const newElementConfig = {
        ...elementConfig,
        mapping: newMapping,
        aliaser: newAliaser,
      };
      newconfig = {
        ...config,
        elements: config.elements.map((v, i) =>
          i === action.element ? newElementConfig : v,
        ),
      };
  }

  localStorage.setItem(id, JSON.stringify(newconfig));
  return newconfig;
};

export const WenContext = createContext(wen as unknown as Wen);
export const ZiContext = createContext(zi as unknown as Zi);
export const YinContext = createContext(yin as unknown as Yin);
export const ConfigContext = createContext(defaultConfig as Config);
export const DispatchContext = createContext<Dispatch<Action>>(() => {});
