import { atom } from "jotai";
import { atomWithLocation } from "jotai-location";
import { focusAtom } from "jotai-optics";
import { atomFamily, atomWithStorage } from "jotai/utils";
import {
  defaultOptimization,
  type 分析配置,
  type 图示配置,
  type 基本信息,
  type 拼写运算,
  type 数据配置,
  type 编码配置,
  type 配置,
  type 键盘配置,
} from "~/lib";
import { defaultConfig, examples, type Example } from "~/templates";

const locationAtom = atomWithLocation();

export const idAtom = atom((get) => {
  if (import.meta.env.MODE === "CF") {
    return get(locationAtom).pathname?.split("/")[1] ?? "";
  }
  return get(locationAtom).hash?.split("/")[1] ?? "";
});

const configStorage = atomFamily((id: string) =>
  atomWithStorage<配置>(id, examples[id as Example] ?? defaultConfig),
);

export const configAtom = atom(
  (get) => get(configStorage(get(idAtom))),
  (get, set, value: 配置) => set(configStorage(get(idAtom)), value),
);

export const 基本信息原子 = focusAtom(configAtom, (o) =>
  o.prop("info").valueOr({} as 基本信息),
);

export const 数据配置原子 = focusAtom(configAtom, (o) =>
  o.prop("data").valueOr({} as 数据配置),
);

export const 分析配置原子 = focusAtom(configAtom, (o) =>
  o.prop("analysis").valueOr({} as 分析配置),
);

export const 拼写运算自定义原子 = focusAtom(configAtom, (o) =>
  o.prop("algebra").valueOr({} as Record<string, 拼写运算>),
);

export const 键盘原子 = focusAtom(configAtom, (o) =>
  o.prop("form").valueOr({} as 键盘配置),
);

export const 编码配置原子 = focusAtom(configAtom, (o) =>
  o.prop("encoder").valueOr({} as 编码配置),
);

export const 优化配置原子 = focusAtom(configAtom, (o) =>
  o.prop("optimization").valueOr(defaultOptimization),
);

export const 图示配置原子 = focusAtom(configAtom, (o) =>
  o.prop("diagram").valueOr({ layout: [], contents: [] } as 图示配置),
);
