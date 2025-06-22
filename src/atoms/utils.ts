import type { Config } from "~/lib";
import useTitle from "ahooks/es/useTitle";
import init, { validate } from "libchai";
import { notification } from "antd";
import type { Err } from "~/api";
import { createContext } from "react";
import { isEqual } from "lodash-es";
import { diff } from "deep-object-diff";
import { load } from "js-yaml";
import type { WorkerOutput } from "~/worker";
import { atom } from "jotai";

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
    }
    notification.warning({
      message: "配置环行失败",
      description: `该配置在 libchai 中具有不同语义。以下是两者的差异：\n${JSON.stringify(
        diff(config, rustConfig),
      )}`,
    });
    console.log("config", config);
    console.log("rustConfig", rustConfig);
    return false;
  } catch (e) {
    notification.error({
      message: "配置校验失败，原因是：",
      description: (e as Error).message,
    });
    return false;
  }
}

export const errorFeedback = <T extends number | boolean>(
  res: T | Err,
): res is Err => {
  if (typeof res === "object" && "err" in res && "msg" in res) {
    notification.error({ message: `错误 ${res.err}`, description: res.msg });
    return true;
  }
  notification.success({ message: "操作成功" });
  return false;
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

  public async spawn<R>(
    type: string,
    data: any[],
    updater?: (a: any) => void,
  ): Promise<R> {
    const channel = new MessageChannel();
    return await new Promise((resolve, reject) => {
      channel.port1.onmessage = ({ data }: { data: WorkerOutput }) => {
        if (data.type === "success") {
          resolve(data.result);
          channel.port1.close();
        } else if (data.type === "error") {
          reject(data.error);
          channel.port1.close();
        } else if (typeof data.type === "string" && updater) {
          updater(data);
        } else {
          console.log(data);
          throw new Error(`Unexpected message: ${data}`);
        }
      };
      this.worker.postMessage({ type, data }, [channel.port2]);
    });
  }
}

export const thread = new Thread();

export const currentElementAtom = atom<string | undefined>(undefined);
