import { Dispatch, createContext, useContext } from "react";
import { Classifier, Config, Mapping, SieveName } from "../lib/config";
import components from "../data/components.json";
import compounds from "../data/compounds.json";
import characters from "../data/characters.json";
import slices from "../data/slices.json";
import font from "../data/font.json";
import {
  Compound,
  Glyph,
  Components,
  Compounds,
  Characters,
  Alias,
  Slices,
  Character,
} from "../lib/data";
import defaultClassifier from "../templates/classifier.yaml";
import { useLocation } from "react-router-dom";
import { templates } from "../lib/template";

export type Action =
  | InfoAction
  | LoadAction
  | ElementAction
  | DataAction
  | DeleteAction
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
  index: "form" | "pronunciation";
} & ElementSubAction;

type ElementSubAction =
  | {
      subtype: "generic-alphabet";
      value: string;
    }
  | {
      subtype: "generic-maxcodelen";
      value: number;
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
      subtype: "root-selector";
      action: "replace";
      value: SieveName[];
    }
  | {
      subtype: "phonetic-automapping";
      value: Mapping;
    };
type DataAction = {
  type: "data";
} & (
  | { subtype: "components"; key: string; value: Glyph }
  | { subtype: "compounds"; key: string; value: Compound }
  | { subtype: "characters"; key: string; value: Character }
  | { subtype: "slices"; key: string; value: Alias }
  | { subtype: "classifier"; key: string; value: number }
);
type DeleteAction = {
  type: "data-delete";
  subtype: DataAction["subtype"];
  key: string;
  value: undefined;
};
type EncoderAction = { type: "encoder"; value: Config["encoder"] };

export const configReducer = (config: Config, action: Action) => {
  const { type, value } = action;
  const { index } = action as ElementAction;
  const element = index === "form" ? config.form : config.pronunciation;
  const root = config.form;
  switch (type) {
    case "load":
      config = action.value;
      break;
    case "info":
      config.info = { ...config.info, ...value };
      break;
    case "data":
      config.data[action.subtype][action.key] = value;
      break;
    case "data-delete":
      delete config.data[action.subtype][action.key];
      break;
    case "element":
      switch (action.subtype) {
        case "generic-alphabet":
          element.alphabet = action.value;
          break;
        case "generic-maxcodelen":
          element.maxcodelen = action.value;
          break;
        case "generic-mapping":
          switch (action.action) {
            case "add":
              element.mapping[action.key] = action.value!;
              break;
            case "remove":
              delete element.mapping[action.key];
              break;
          }
          break;
        case "root-selector":
          switch (action.action) {
            case "add":
              root.analysis.selector.push(action.value);
              break;
            case "remove":
              root.analysis.selector = root.analysis.selector.filter(
                (x) => x !== action.value,
              );
              break;
            case "replace":
              root.analysis.selector = action.value;
          }
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
  return config;
};

const ComponentsContext = createContext(components as unknown as Components);
const CompoundsContext = createContext(compounds as unknown as Compounds);
const CharactersContext = createContext(characters as unknown as Characters);
const SlicesContext = createContext(slices as unknown as Slices);
export const FontContext = createContext(font as Record<string, string>);
export const ConfigContext = createContext(templates.basic.self as Config);
export const DispatchContext = createContext<Dispatch<Action>>(() => {});

const useData = () => {
  const { data } = useContext(ConfigContext);
  return data;
};

const useIndex = () => {
  const { pathname } = useLocation();
  return pathname.split("/")[3];
};

const useRoot = () => {
  const { form } = useContext(ConfigContext);
  return form;
};

const usePhonetic = () => {
  const { pronunciation } = useContext(ConfigContext);
  return pronunciation;
};

const useGeneric = () => {
  const config = useContext(ConfigContext);
  return config[useIndex() as "form"];
};

const useComponents = () => {
  const components = useContext(ComponentsContext);
  return Object.assign({}, components, useData().components);
};

const useCompounds = () => {
  const compounds = useContext(CompoundsContext);
  return Object.assign({}, compounds, useData().compounds);
};

const useCharacters = () => {
  const characters = useContext(CharactersContext);
  return Object.assign({}, characters, useData().characters);
};

const useSlices = () => {
  const slices = useContext(SlicesContext);
  return Object.assign({}, slices, useData().slices);
};

const useAll = () => {
  return {
    components: useComponents(),
    compounds: useCompounds(),
    characters: useCharacters(),
    slices: useSlices(),
    classifier: useClassifier(),
  };
};

const useClassifier = () => {
  const { classifier } = useData();
  return Object.assign({}, defaultClassifier as Classifier, classifier);
};

const useDesign = () => {
  const dispatch = useContext(DispatchContext);
  const index = useIndex();
  return (action: ElementSubAction) =>
    dispatch({
      type: "element",
      index: index as "form" | "pronunciation",
      ...action,
    });
};

const useDataType = () => {
  const { pathname } = useLocation();
  return pathname.split("/")[3];
};

const useModify = () => {
  const dispatch = useContext(DispatchContext);
  const subtype = useDataType() as "components";
  return (key: string, value: DataAction["value"]) =>
    dispatch({
      type: "data",
      subtype,
      key,
      value: value as Glyph,
    });
};

const useDelete = () => {
  const dispatch = useContext(DispatchContext);
  const subtype = useDataType() as "components";
  return (key: string) =>
    dispatch({
      type: "data-delete",
      subtype,
      key,
      value: undefined,
    });
};

export {
  useIndex,
  useRoot,
  usePhonetic,
  useGeneric,
  useDesign,
  useData,
  useComponents,
  useCompounds,
  useCharacters,
  useSlices,
  useClassifier,
  useAll,
  useModify,
  useDelete,
};
