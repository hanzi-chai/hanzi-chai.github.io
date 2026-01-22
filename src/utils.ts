export const useHashRouter = import.meta.env.MODE !== "CF";

export function getCurrentId(): string {
  const pathSegments = useHashRouter
    ? location.hash.split("/")
    : location.pathname.split("/");
  return pathSegments[1] ?? "";
}

export const basePath = useHashRouter ? "/#/" : "/";

import type { Config } from "~/lib";
import useTitle from "ahooks/es/useTitle";
import init, { validate } from "libchai";
import { notification } from "antd";
import type { 后端错误 } from "~/api";
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
  res: T | 后端错误,
): res is 后端错误 => {
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


const processExport = (content: string, filename: string) => {
  const blob = new Blob([content], { type: "text/plain" });
  const a = document.createElement("a");
  a.download = filename;
  const url = window.URL.createObjectURL(blob);
  a.href = url;
  a.click();
  window.URL.revokeObjectURL(url); // 避免内存泄漏
};

export const exportYAML = (
  config: object,
  filename: string,
  flowLevel: number = 4,
  sanitize: boolean = true,
) => {
  const unsafeContent = dump(config, { flowLevel });
  if (!sanitize) {
    processExport(unsafeContent, `${filename}.yaml`);
  } else {
    const fileContent = unsafeContent.replace(/[\uE000-\uFFFF]/g, (c) => {
      return `"\\u${c.codePointAt(0)?.toString(16)}"`;
    });
    processExport(fileContent, `${filename}.yaml`);
  }
};

export const exportJSON = (data: object, filename: string) => {
  const unsafeContent = JSON.stringify(data);
  const fileContent = unsafeContent.replace(/[\uE000-\uFFFF]/g, (c) => {
    return `\\u${c.codePointAt(0)?.toString(16)}`;
  });
  processExport(fileContent, filename);
};

export const exportTSV = (data: string[][], filename: string) => {
  const fileContent = data.map((x) => x.join("\t")).join("\n");
  processExport(fileContent, filename);
};

const match = (character: 原始汉字数据 | 汉字数据, input: CharacterFilter) => {
  const { tag, operator, part } = input;
  if ("glyphs" in character) {
    const isTagMatched =
      tag === undefined || character.glyphs.some((x) => x.tags?.includes(tag));
    const isOperatorMatched =
      operator === undefined ||
      character.glyphs.some(
        (x) => "operator" in x && x.operator.includes(operator),
      );
    const isPartMatched =
      part === undefined ||
      character.glyphs.some(
        (x) => "operandList" in x && x.operandList.includes(part),
      );
    return isTagMatched && isOperatorMatched && isPartMatched;
  }
  const isTagMatched =
    tag === undefined || character.glyph?.tags?.includes(tag);
  const isOperatorMatched =
    operator === undefined ||
    (character.glyph?.type === "compound" &&
      character.glyph.operator.includes(operator));
  const isPartMatched =
    part === undefined ||
    (character.glyph?.type === "compound" &&
      character.glyph.operandList.includes(part));
  return isTagMatched && isOperatorMatched && isPartMatched;
};

export const makeCharacterFilter = (
  input: CharacterFilter,
  repertoire: 字库数据 | 原始字库数据,
  sequenceMap: Map<string, string>,
) => {
  let sequenceRegex: RegExp | undefined;
  try {
    if (input.sequence) {
      sequenceRegex = new RegExp(input.sequence);
    }
  } catch {}
  return (name: string) => {
    const character = repertoire[name];
    if (character === undefined) return false;
    const sequence = sequenceMap.get(name) ?? "";
    const isNameMatched = ((character.name ?? "") + name).includes(
      input.name ?? "",
    );
    const isSequenceMatched = sequenceRegex?.test(sequence) ?? true;
    const isUnicodeMatched =
      input.unicode === undefined || input.unicode === name.codePointAt(0);
    const isMatched = match(character, input);
    return isNameMatched && isSequenceMatched && isUnicodeMatched && isMatched;
  };
};

export interface CharacterFilter {
  name?: string;
  sequence?: string;
  unicode?: number;
  tag?: string;
  part?: string;
  operator?: 结构表示符;
}

export const makeFilter =
  (input: string, form: 字库数据, sequence: Map<string, string>) =>
  (char: string) => {
    if ((sequence.get(char)?.length ?? 0) <= 1) return false;
    const name = form[char]?.name ?? "";
    const seq = sequence.get(char) ?? "";
    return (
      name.includes(input) || char.includes(input) || seq.startsWith(input)
    );
  };

export interface AnalyzerForm {
  type: "single" | "multi" | "all";
  position: number[];
  top: number;
}

export const makeDefaultAnalyzer = (maxLength: number) => {
  const form: AnalyzerForm = {
    type: "all",
    position: range(0, maxLength),
    top: 0,
  };
  return form;
};

export interface DictEntry {
  name: string;
  full: string;
  full_rank: number;
  short: string;
  short_rank: number;
}

export type EncodeResult = DictEntry[];

export const formatDate = (date: Date) => {
  return `${
    date.getMonth() + 1
  }-${date.getDate()} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
};
