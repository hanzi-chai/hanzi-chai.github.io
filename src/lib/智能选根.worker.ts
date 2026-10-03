/**
 * 智能选根 Worker：在后台线程跑增量评分与贪心搜索，主线程不卡顿。
 * 协议：
 *  入: {type:"start", 配置, 内置字库数据, 原始词典, mapping, 参数}
 *      {type:"mine", 配置, 内置字库数据, 原始词典}   —— 切片挖掘（后台线程，带进度）
 *      {type:"组挖掘", 配置, 内置字库数据, 原始词典, mapping, 表列表, 组起, 组止, 根起, 根止}
 *      {type:"stop"}
 *  出: {type:"阶段",文本} | {type:"轮进度",已评,总数,最优,最优分} | {type:"轮",轮结果}
 *      | {type:"日志",文本} | {type:"完成",结果} | {type:"已停止"} | {type:"错误",错误}
 */
import { 智能选根核心, type 搜索参数, type 轮结果 } from "./智能选根核心";

let 停止 = false;

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data;
  if (msg.type === "stop") {
    停止 = true;
    return;
  }
  const post = (m: any) => (self as any).postMessage(m);
  if (msg.type === "mine") {
    try {
      post({ type: "阶段", 文本: "构建字库（约数秒）……" });
      const 核心 = new 智能选根核心(msg.配置, msg.原始词典, msg.内置字库数据);
      post({ type: "阶段", 文本: "字内部件挖掘中……" });
      const 结果 = 核心.挖掘切片候选(
        {
          on进度: (已完成: number, 总数: number) =>
            post({ type: "阶段", 文本: `字内部件挖掘中…… ${已完成}/${总数} 位置` }),
        },
        msg.允许复合体 !== false,
      );
      post({ type: "挖掘完成", 结果 });
    } catch (err: any) {
      post({ type: "错误", 错误: String(err?.message ?? err) + (err?.stack ? "\n" + String(err.stack).split("\n").slice(0,4).join("\n") : "") });
    }
    return;
  }
  if (msg.type === "组挖掘") {
    try {
      post({ type: "阶段", 文本: "构建字库与分析器（约数秒）……" });
      const 核心 = new 智能选根核心(msg.配置, msg.原始词典, msg.内置字库数据);
      核心.设置基态(msg.mapping);
      post({ type: "阶段", 文本: "组伤害排名 + 切片挖掘 + 分离收益计分……" });
      const 结果 = 核心.重码组挖掘(msg.表列表, msg.根起, msg.根止, undefined, msg.允许复合体 !== false);
      post({ type: "组挖掘完成", 结果 });
    } catch (err: any) {
      post({ type: "错误", 错误: String(err?.message ?? err) + (err?.stack ? "\n" + String(err.stack).split("\n").slice(0,4).join("\n") : "") });
    }
    return;
  }
  if (msg.type !== "start") return;
  停止 = false;
  try {
    post({ type: "阶段", 文本: "构建字库与分析器（约数秒）……" });
    const 核心 = new 智能选根核心(msg.配置, msg.原始词典, msg.内置字库数据);
    const 回调 = {
      on阶段: (文本: string) => post({ type: "阶段", 文本 }),
      on轮进度: (已评: number, 总数: number, 最优: string, 最优分: number) =>
        post({ type: "轮进度", 已评, 总数, 最优, 最优分 }),
      on轮: (r: 轮结果) => post({ type: "轮", 轮结果: r }),
      on日志: (文本: string) => post({ type: "日志", 文本 }),
      应停止: () => 停止,
    };
    const 结果 = 核心.搜索(msg.mapping, msg.参数 as 搜索参数, 回调);
    if (结果.已停止) post({ type: "已停止", 结果 });
    else post({ type: "完成", 结果 });
  } catch (err: any) {
    post({ type: "错误", 错误: String(err?.message ?? err) + (err?.stack ? "\n" + String(err.stack).split("\n").slice(0,4).join("\n") : "") });
  }
};
