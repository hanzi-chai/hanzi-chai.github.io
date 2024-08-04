import type { Config } from "~/lib";
import { isValidCJKChar, stringifySequence } from "~/lib";
import useTitle from "ahooks/es/useTitle";
import init, { validate } from "libchai";
import { notification } from "antd";
import type { Err } from "~/api";
import { createContext } from "react";
import { isEqual } from "lodash-es";
import { diff } from "deep-object-diff";
import { load } from "js-yaml";
import type { WorkerOutput } from "~/worker";
import { atomEffect } from "jotai-effect";
import { configAtom } from "./config";
import { assetsAtom } from "./assets";
import { assemblyResultAtom } from "./cache";

export const syncConfig = atomEffect((get) => {
  const value = get(configAtom);
  thread.spawn("sync", ["config", value]);
});

export const syncAssets = atomEffect((get) => {
  get(assetsAtom).then(async (value) => {
    await thread.spawn("sync", ["assets", value]);
  });
});

export const syncInfo = atomEffect((get) => {
  get(assemblyResultAtom).then(async (value) => {
    await thread.spawn("sync", ["info", stringifySequence(value)]);
  });
});

export const RemoteContext = createContext(true);

export async function validateConfig(config: Config) {
  await init();
  try {
    validate(config);
    notification.success({
      message: "配置校验成功",
      description: "该配置可以被正常使用。",
    });
    return true;
  } catch (e) {
    notification.error({
      message: "配置校验失败，原因是：",
      description: (e as Error).message,
    });
    return false;
  }
}

export async function roundTestConfig(config: Config) {
  await init();
  try {
    const rustConfig = load(validate(config)) as object;
    if (isEqual(config, rustConfig)) {
      notification.success({
        message: "配置环行成功",
        description: "该配置在 libchai 中具有同样语义。",
      });
      return true;
    } else {
      notification.warning({
        message: "配置环行失败",
        description:
          "该配置在 libchai 中具有不同语义。以下是两者的差异：\n" +
          JSON.stringify(diff(config, rustConfig)),
      });
      return false;
    }
  } catch (e) {
    notification.error({
      message: "配置校验失败，原因是：",
      description: (e as Error).message,
    });
    return false;
  }
}

export const errorFeedback = function <T extends number | boolean>(
  res: T | Err,
): res is Err {
  if (typeof res === "object") {
    notification.error({
      message: "无法完成该操作",
      description: JSON.stringify(res),
    });
    return true;
  } else {
    notification.success({
      message: "操作成功",
    });
    return false;
  }
};

export const verifyNewName = (newName: string) => {
  if (!Array.from(newName).every(isValidCJKChar)) {
    notification.error({
      message: "名称含有非法字符",
      description: "只有 CJK 基本集或扩展集 A 中的才是合法字符",
    });
    return false;
  }
  return true;
};

export function useChaifenTitle(title: string) {
  // eslint-disable-next-line
  useTitle(`${title} · 汉字自动拆分系统 ${APP_VERSION}`, {
    restoreOnUnmount: true,
  });
}

export class Thread {
  public worker: Worker;
  public constructor() {
    this.worker = new Worker(new URL("../worker.ts", import.meta.url), {
      type: "module",
    });
  }

  public async spawn<R>(type: string, data: any[]): Promise<R> {
    return await new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = ({ data }: { data: WorkerOutput }) => {
        channel.port1.close();
        if (data.type === "success") {
          resolve(data.result);
        } else if (data.type === "error") {
          reject(data.error);
        } else {
          throw new Error(`Unexpected message: ${data}`);
        }
      };
      this.worker.postMessage({ type, data }, [channel.port2]);
    });
  }
}

export const thread = new Thread();
