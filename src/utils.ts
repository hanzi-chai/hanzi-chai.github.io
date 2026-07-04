import { 字库, 字符, 字形, 字符数据, type 结构描述字符, type 配置, 复合体 } from "hanzi-chai";
import useTitle from "ahooks/es/useTitle";
import init, { validate } from "libchai";
import { notification } from "antd";
import type { 后端错误 } from "~/api";
import { isEqual, range } from "lodash-es";
import { diff } from "deep-object-diff";
import { dump } from "js-yaml";
import type { WorkerOutput } from "~/worker";
import { APP_VERSION } from "./version";

export const useHashRouter = import.meta.env.MODE !== "CF";

export function getCurrentId(): string {
  const pathSegments = useHashRouter
    ? location.hash.split("/")
    : location.pathname.split("/");
  return pathSegments[1] ?? "";
}

export const basePath = useHashRouter ? "/#/" : "/";

export async function validateConfig(config: 配置) {
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

export async function roundTestConfig(config: 配置) {
  await init();
  try {
    const rustConfig = validate(config) as object;
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
    exportYAML(rustConfig, "round-tested-config");
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
    this.worker = new Worker(new URL("worker.ts", import.meta.url), {
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
) => {
  const unsafeContent = dump(config, { flowLevel, noRefs: true });
  processExport(unsafeContent, `${filename}.yaml`);
};

export const exportJSON = (data: object, filename: string) => {
  const unsafeContent = JSON.stringify(data);
  processExport(unsafeContent, filename);
};

export const exportTSV = (data: string[][], filename: string) => {
  const fileContent = data.map((x) => x.join("\t")).join("\n");
  processExport(fileContent, filename);
};

export class 字符字形过滤器 {
  private sequenceRegex: RegExp | undefined;
  constructor(private 过滤条件: 过滤器参数) {
    if (过滤条件.sequence) {
      try {
        this.sequenceRegex = new RegExp(过滤条件.sequence, "u");
      } catch { }
    }
  }

  过滤字符(汉字: 字符, 数据: 字符数据, 字库: 字库) {
    let result = true;
    const { name, unicode, source } = this.过滤条件;
    if (name) {
      result &&= (数据.name ?? "").includes(name) || 汉字.获取名称().includes(name);
    }
    if (unicode) {
      let hex_str = 汉字.toNumber().toString(16);
      let dec_str = 汉字.toNumber().toString(10);
      result &&= unicode.toLowerCase() === hex_str || unicode === dec_str;
    }
    if (source) result &&= 数据.glyphs.some((glyph) => glyph.sources.includes(source));
    const 字形列表 = 字库.查询字形(汉字) ?? [];
    result &&= 字形列表.some((glyph) => this.过滤字形(glyph));
    return result;
  }

  过滤字形(glyph: 字形) {
    const { operator, part } = this.过滤条件;
    let result = true;
    if (this.sequenceRegex !== undefined) {
      result &&=this.sequenceRegex!.test(glyph.标准笔顺);
    }
    if (operator) {
      result &&= glyph instanceof 复合体 && glyph.结构描述字符 === operator;
    }
    if (part) {
      result &&= glyph instanceof 复合体 && glyph.部分列表.some((p) => p.id === Number(part));
    }
    return result;
  };
}

export interface 过滤器参数 {
  name?: string;
  sequence?: string;
  unicode?: string;
  source?: string;
  part?: string;
  operator?: 结构描述字符;
}

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

export interface 编码条目 {
  词: string;
  全码: string;
  全码排名: number;
  简码: string;
  简码排名: number;
}

export type 编码结果 = 编码条目[];

export const 数字 = (n: number) => {
  const absn = n >= 0 ? n : -n;
  const 汉字数字 = "零一二三四五六七八九十";
  const 绝对值 = 汉字数字[absn] || absn.toString();
  return n >= 0 ? 绝对值 : `负${绝对值}`;
}

export const 颜色插值 = (color1: string, color2: string, percent: number) => {
  // Convert the hex colors to RGB values
  const r1 = Number.parseInt(color1.substring(1, 3), 16);
  const g1 = Number.parseInt(color1.substring(3, 5), 16);
  const b1 = Number.parseInt(color1.substring(5, 7), 16);

  const r2 = Number.parseInt(color2.substring(1, 3), 16);
  const g2 = Number.parseInt(color2.substring(3, 5), 16);
  const b2 = Number.parseInt(color2.substring(5, 7), 16);

  // Interpolate the RGB values
  const r = Math.round(r1 + (r2 - r1) * percent);
  const g = Math.round(g1 + (g2 - g1) * percent);
  const b = Math.round(b1 + (b2 - b1) * percent);

  // Convert the interpolated RGB values back to a hex color
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export const 标准键盘 = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";"],
  ["z", "x", "c", "v", "b", "n", "m", ",", ".", "/"],
  ['_', '\'', '-', '=', '[', ']', '\\', '`', ' ', ' '],
];
