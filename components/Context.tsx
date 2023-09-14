import { Dispatch, ReducerAction, createContext } from "react";
import { Config } from "../lib/chai";
import CHAI from "../data/CHAI.json";
import { Database } from "../lib/data";
import defaultConfig from "../default.yaml";
export interface Action {
  type: "info" | "load",
  content: any
}

export const configReducer = (config: Config, action: Action) => {
  switch (action.type) {
    case "info":
      return { ...config, info: { ...config.info, ...action.content }}
    case "load":
      return action.content;
  }
}

export const DataContext = createContext(CHAI as Database);
export const ConfigContext = createContext(defaultConfig as Config);
export const DispatchContext = createContext<Dispatch<Action>>(() => {});
