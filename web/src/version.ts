/**
 * 应用版本号和路径工具
 * 在构建时通过 Vite 注入
 */

export const APP_VERSION = import.meta.env.APP_VERSION;

/**
 * 获取允许热更新的固定数据资源路径
 */
export function getDataPath(filename: string): string {
  return `/data/${filename}`;
}
