/** 随包发布的只读示例；导出时由调用方选择单个 YAML 文件。 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { load } from "js-yaml";
import type { 配置 } from "./config.js";
import { 方案错误 } from "./scheme.js";
import { type Example, 创建方案模板 } from "./templates.js";
import { 校验配置结构 } from "./validation.js";

const packaged = new URL("./examples/", import.meta.url);
const directory = existsSync(packaged)
  ? packaged
  : new URL("../examples/", import.meta.url);

export function 获取示例方案路径(id: string): string {
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(id)) {
    throw new 方案错误([
      { code: "UNKNOWN_EXAMPLE", path: "/example", message: `未知示例：${id}` },
    ]);
  }
  const file = new URL(`${id}.yaml`, directory);
  if (!existsSync(file)) {
    throw new 方案错误([
      { code: "UNKNOWN_EXAMPLE", path: "/example", message: `未知示例：${id}` },
    ]);
  }
  return fileURLToPath(file);
}

export function 读取示例配置(id: string) {
  const config: unknown = load(readFileSync(获取示例方案路径(id), "utf8"));
  校验配置结构(config);
  return config;
}

export function 列出示例方案() {
  return readdirSync(directory)
    .filter((file) => file.endsWith(".yaml"))
    .sort()
    .map((file) => {
      const id = file.slice(0, -5);
      return { id, name: 读取示例配置(id).info?.name ?? id };
    });
}

/** 按需读取内置 YAML 并创建模板工厂。 */
export function 读取内置方案模板() {
  const examples = Object.fromEntries(
    列出示例方案().map(({ id }) => [id, 读取示例配置(id)]),
  );
  return 创建方案模板(examples as Record<Example, 配置>);
}
