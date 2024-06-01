import { Config, Key, isValidCJKChar } from "~/lib";
import useTitle from "ahooks/es/useTitle";
import init, { validate } from "libchai";
import { LibchaiOutputEvent } from "~/worker";
import { notification } from "antd";
import { Err } from "~/api";
import { createContext } from "react";

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

export interface DictEntry {
  name: string;
  full: string;
  full_rank: number;
  short: string;
  short_rank: number;
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

export type EncodeResult = DictEntry[];

export const makeEncodeCallback = (setCode: (e: EncodeResult) => void) => {
  return (event: MessageEvent<LibchaiOutputEvent>) => {
    const { data } = event;
    switch (data.type) {
      case "code":
        setCode(data.code);
        notification.success({
          message: "生成成功!",
        });
        break;
      case "error":
        notification.error({
          message: "生成过程中 libchai 出现错误",
          description: data.error.message,
        });
        break;
    }
  };
};

export function useChaifenTitle(title: string) {
  useTitle(`${title} · 汉字自动拆分系统 ${APP_VERSION}`, {
    restoreOnUnmount: true,
  });
}
