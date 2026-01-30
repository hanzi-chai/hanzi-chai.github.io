/**
 * 统一的版本号管理
 * 为 Node.js 脚本提供版本号和路径工具
 */

import packageJson from "../package.json" with { type: "json" };

export const VERSION = packageJson.version;

/**
 * 获取数据文件的本地存储路径前缀
 */
export function getLocalDataPath(): string {
  return `public/data/${VERSION}`;
}
