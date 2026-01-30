import { atom } from "jotai";
import { atomWithLocation } from "jotai-location";
import { focusAtom } from "jotai-optics";
import { withHistory } from "jotai-history";
import { atomWithStorage } from "jotai/utils";
import { atomFamily } from "jotai-family";
import {
  默认优化配置,
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

export const 位置原子 = atomWithLocation();

export const 方案序列号原子 = atom((get) => {
  if (import.meta.env.MODE === "CF") {
    return get(位置原子).pathname?.split("/")[1] ?? "";
  }
  return get(位置原子).hash?.split("/")[1] ?? "";
});

const 配置存储 = atomFamily((id: string) =>
  atomWithStorage<配置>(id, examples[id as Example] ?? defaultConfig),
);

export const 配置原子 = atom(
  (get) => get(配置存储(get(方案序列号原子))),
  (get, set, value: 配置) => set(配置存储(get(方案序列号原子)), value),
);

const 历史数量 = 10;
export const 配置历史原子 = withHistory(配置原子, 历史数量);

export const 基本信息原子 = focusAtom(配置原子, (o) =>
  o.prop("info").valueOr({} as 基本信息),
);

export const 数据配置原子 = focusAtom(配置原子, (o) =>
  o.prop("data").valueOr({} as 数据配置),
);

export const 分析配置原子 = focusAtom(配置原子, (o) =>
  o.prop("analysis").valueOr({} as 分析配置),
);

export const 拼写运算自定义原子 = focusAtom(配置原子, (o) =>
  o.prop("algebra").valueOr({} as Record<string, 拼写运算>),
);

export const 键盘原子 = focusAtom(配置原子, (o) =>
  o.prop("form").valueOr({} as 键盘配置),
);

export const 编码配置原子 = focusAtom(配置原子, (o) =>
  o.prop("encoder").valueOr({} as 编码配置),
);

export const 优化配置原子 = focusAtom(配置原子, (o) =>
  o.prop("optimization").valueOr(默认优化配置),
);

export const 图示配置原子 = focusAtom(配置原子, (o) =>
  o.prop("diagram").valueOr({ layout: [], contents: [] } as 图示配置),
);
