import { Dispatch, ReducerAction, createContext } from "react";

interface Action {
  type: "info" | "load",
  content: any
}

export const defaultConfig: Config = {
  info: {
    id: "untitled",
    name: "未命名",
    author: "无名氏",
    version: "v0.1",
    description: ""
  }
}
export const configReducer = (config: Config, action: Action) => {
  switch (action.type) {
    case "info":
      return { ...config, info: { ...config.info, ...action.content }}
    case "load":
      return action.content;
  }
}

export const ConfigContext = createContext(defaultConfig);
export const DispatchContext = createContext<Dispatch<Action>>(() => {});
