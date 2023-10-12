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
  Mapping,
  PhoneticConfig,
  PhoneticElement,
  RootConfig,
  SieveName,
} from "../lib/config";
import wen from "../data/wen.json";
import zi from "../data/zi.json";
import yin from "../data/yin.json";
import font from "../data/pingfang.json";
import { Compound, Glyph, Wen, Zi, Yin } from "../lib/data";
import defaultConfig from "../templates/default.yaml";
import { useLocation } from "react-router-dom";

export type Action =
  | InfoAction
  | LoadAction
  | ElementAction
  | DataAction
  | EncoderAction;

type InfoAction = {
  type: "info";
  value: Record<string, string>;
};
type LoadAction = {
  type: "load";
  value: Config;
};
type ElementAction = {
  type: "element";
  index: number;
} & ElementSubAction;

type ElementSubAction =
  | {
      subtype: "generic-alphabet";
      value: string;
    }
  | {
      subtype: "generic-mapping";
      action: "add" | "remove";
      key: string;
      value?: string;
    }
  | {
      subtype: "root-selector";
      action: "add" | "remove";
      value: SieveName;
    }
  | {
      subtype: "root-aliaser";
      action: "add" | "remove";
      key: string;
      value?: RootConfig["aliaser"][string];
    }
  | {
      subtype: "phonetic-automapping";
      value: Mapping | undefined;
    };
type DataAction = {
  type: "data";
} & (
  | { subtype: "component"; key: string; value: Glyph }
  | { subtype: "compound"; key: string; value: Compound }
  | { subtype: "character"; key: string; value: string[] }
);
type EncoderAction = { type: "encoder"; value: Config["encoder"] };

export const configReducer = (config: Config, action: Action) => {
  const { pathname } = location;
  const [_, id] = pathname.split("/");
  const { type, value } = action;
  switch (type) {
    case "load":
      config = action.value;
      break;
    case "info":
      config.info = { ...config.info, ...value };
      break;
    case "data":
      const { subtype, key } = action;
      config.data[subtype][key] = value;
      break;
    case "element":
      const { index } = action;
      const element = config.elements[index];
      const mapping = element.mapping!;
      const root = element as RootConfig;
      switch (action.subtype) {
        case "generic-alphabet":
          element.alphabet = action.value;
          break;
        case "generic-mapping":
          switch (action.action) {
            case "add":
              mapping[action.key] = action.value!;
              break;
            case "remove":
              delete mapping[action.key];
              break;
          }
          break;
        case "root-selector":
          if (action.action === "add")
            root.analysis.selector.push(action.value);
          else
            root.analysis.selector = root.analysis.selector.filter(
              (x) => x !== action.value,
            );
          break;
        case "root-aliaser":
          if (action.action === "add") root.aliaser[action.key] = action.value!;
          else delete root.aliaser[action.key];
          break;
        case "phonetic-automapping":
          element.mapping = action.value;
          break;
      }
      break;
    case "encoder":
      config.encoder = action.value;
      break;
  }

  localStorage.setItem(id, JSON.stringify(config));
  return config;
};

interface CacheAction {
  index: number;
  value: ElementCache;
}

export const cacheReducer = (cache: ElementCache, action: CacheAction) => {
  return { ...cache, [action.index]: action.value };
};

export const WenContext = createContext(wen as unknown as Wen);
export const ZiContext = createContext(zi as unknown as Zi);
export const YinContext = createContext(yin as unknown as Yin);
export const FontContext = createContext(font as Record<string, string>);
export const ConfigContext = createContext(defaultConfig as Config);
export const DispatchContext = createContext<Dispatch<Action>>(() => {});

export const CacheContext = createContext({} as ElementCache);
export const WriteContext = createContext<Dispatch<CacheAction>>(() => {});

const useIndex = () => {
  const { pathname } = useLocation();
  return parseInt(pathname.split("/")[3] || "-1");
};

const useElement = () => {
  const index = useIndex();
  const { elements } = useContext(ConfigContext);
  return elements[index];
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

const useZiCustomized = () => {
  const zi = useContext(ZiContext);
  const {
    data: { compound },
  } = useContext(ConfigContext);
  return Object.assign({}, zi, compound);
};

const useYinCustomized = () => {
  const yin = useContext(YinContext);
  const {
    data: { character },
  } = useContext(ConfigContext);
  return Object.assign({}, yin, character);
};

const useDesign = () => {
  const dispatch = useContext(DispatchContext);
  const index = useIndex();
  return (action: ElementSubAction) =>
    dispatch({ type: "element", index, ...action });
};

export {
  useIndex,
  useElement,
  useRoot,
  usePhonetic,
  useDesign,
  useWenCustomized,
  useZiCustomized,
  useYinCustomized,
};
