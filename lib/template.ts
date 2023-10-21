import basic from "../templates/basic.yaml";
import xingyin from "../templates/xingyin.yaml";
import xingma from "../templates/xingma.yaml";
import { Config } from "./config";

export const templates = Object.fromEntries(
  ([basic, xingyin, xingma] as Config[]).map((config) => {
    return [
      config.template,
      {
        key: config.template,
        label: config.info.name,
        self: config,
      },
    ] as const;
  }),
);
