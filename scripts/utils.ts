import "dotenv/config";
import { createClient } from "../packages/api/src/client";

const { get, post, put, del } = createClient(() => {
  return process.env.JWT ?? null;
});

export { del, get, post, put };

import packageJson from "../package.json" with { type: "json" };

export const VERSION = packageJson.version;

/**
 * 获取数据文件的本地存储路径前缀
 */
export function getLocalDataPath(): string {
  return `public/data/${VERSION}`;
}
