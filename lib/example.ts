import mswb from "../examples/mswb.yaml";
import yima from "../examples/yima.yaml";
import { Config } from "./config";

export const examples = Object.fromEntries(
  ([mswb, yima] as Config[]).map((config) => {
    return [
      config.source,
      {
        key: config.source,
        label: config.info.name,
        self: config,
      },
    ] as const;
  }),
);
