import type { 目标配置 } from "./config.js";
import type { 编码结果, 编码输入, 评估指标 } from "./scheme.js";

/** 浏览器 Worker 与本地运行器共用的 libchai 调用约定。 */
export interface 编码引擎 {
  sync(input: 编码输入): void;
  encode_evaluate(objective: 目标配置): unknown;
}

export function 编码评估(
  引擎: 编码引擎,
  输入: 编码输入,
  目标: 目标配置,
): [编码结果, 评估指标] {
  引擎.sync(输入);
  return 引擎.encode_evaluate(目标) as [编码结果, 评估指标];
}
