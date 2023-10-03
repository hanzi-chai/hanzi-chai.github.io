import {
  Dispatch,
  ReducerAction,
  SetStateAction,
  createContext,
  useContext,
} from "react";
import {
  Config,
  ElementCache,
  ElementConfig,
  PhoneticConfig,
  RootConfig,
} from "../lib/config";
import wen from "../data/wen.json";
import zi from "../data/zi.json";
import yin from "../data/yin.json";
import font from "../data/pingfang.json";
import { Compound, Glyph, Wen, Zi, Yin } from "../lib/data";
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
    ))
  | ({
      type: "data";
    } & (
      | { subtype: "component"; key: string; value: Glyph }
      | { subtype: "compound"; key: string; value: Compound }
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
      break;
    case "data":
      const { subtype, key, value } = action;
      const data = JSON.parse(JSON.stringify(config.data)) as Config["data"];
      data[subtype][key] = value;
      newconfig = { ...config, data };
  }

  localStorage.setItem(id, JSON.stringify(newconfig));
  return newconfig;
};

export const WenContext = createContext(wen as unknown as Wen);
export const ZiContext = createContext(zi as unknown as Zi);
export const YinContext = createContext(yin as unknown as Yin);
export const FontContext = createContext(font as Record<string, string>);
export const ConfigContext = createContext(defaultConfig as Config);
export const DispatchContext = createContext<Dispatch<Action>>(() => {});

export const CacheContext = createContext([] as ElementCache[]);
export const WriteContext = createContext<(e: ElementCache[]) => void>(
  () => {},
);

const useIndex = () => {
  const { pathname } = useLocation();
  return parseInt(pathname.split("/")[3] || "-1");
};

const useElement = () => {
  const index = useIndex();
  const { elements } = useContext(ConfigContext);
  return elements[index] as ElementConfig | undefined;
};

const useRoot = () => useElement() as RootConfig;
const usePhonetic = () => useElement() as PhoneticConfig;

const useWenCustomized = () => {
  const wen = useContext(WenContext);
  const {
    data: { component },
  } = useContext(ConfigContext);
  return Object.assign({}, wen, component);
};

export { useIndex, useElement, useRoot, usePhonetic, useWenCustomized };
