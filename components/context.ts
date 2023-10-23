import { Dispatch, createContext, useContext } from "react";
import { Classifier, Config, Mapping, SieveName } from "../lib/config";
import {
  Compound,
  Glyph,
  Form,
  Repertoire,
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
  | { subtype: "form"; key: string; value: Glyph }
  | { subtype: "repertoire"; key: string; value: Character }
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
  const element = index === "form" ? config.form : config.pronunciation!;
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

export const FormContext = createContext({} as unknown as Form);
export const RepertoireContext = createContext({} as unknown as Repertoire);
export const FontContext = createContext({} as Record<string, string>);
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

const useForm = () => {
  const form = useContext(FormContext);
  return Object.assign({}, form, useData().form);
};

const useRepertoire = () => {
  const repertoire = useContext(RepertoireContext);
  return Object.assign({}, repertoire, useData().repertoire);
};

const useAll = () => {
  return {
    form: useForm(),
    repertoire: useRepertoire(),
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
  const subtype = useDataType() as "form";
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
  const subtype = useDataType() as "form";
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
  useForm,
  useRepertoire,
  useClassifier,
  useAll,
  useModify,
  useDelete,
};
