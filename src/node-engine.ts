import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { initSync, validate, Web } from "libchai";
import type { 目标配置, 配置 } from "./config.js";
import { 编码评估 } from "./evaluation.js";
import { 方案错误, type 编码输入 } from "./scheme.js";
import { 校验配置结构, 检查配置引用 } from "./validation.js";

let initialized = false;
function 初始化本地引擎() {
  if (initialized) return;
  const entry = createRequire(import.meta.url).resolve("libchai");
  initSync({
    module: readFileSync(new URL("./chai_bg.wasm", pathToFileURL(entry))),
  });
  initialized = true;
}

export function 校验方案配置(value: unknown): asserts value is 配置 {
  校验配置结构(value);
  初始化本地引擎();
  try {
    validate(value);
  } catch (error) {
    throw new 方案错误([
      { code: "INVALID_CONFIG", path: "/", message: String(error) },
    ]);
  }
  const diagnostics = 检查配置引用(value);
  if (diagnostics.length) throw new 方案错误(diagnostics);
}

export function 本地编码评估(输入: 编码输入, 目标: 目标配置) {
  初始化本地引擎();
  const engine = Web.new(() => {});
  try {
    return 编码评估(engine, 输入, 目标);
  } catch (error) {
    throw new 方案错误([
      { code: "ENCODE_ERROR", path: "/encoder", message: String(error) },
    ]);
  } finally {
    engine.free();
  }
}
