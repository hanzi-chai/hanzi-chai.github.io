/**
 * 智能选根 Worker：在后台线程跑增量评分与贪心搜索，主线程不卡顿。
 * 协议：
 *  入: {type:"start", 配置, 内置字库数据, 原始词典, mapping, 参数}
 *      {type:"mine", 配置, 内置字库数据, 原始词典}   —— 切片挖掘（后台线程，带进度）
 *      {type:"组挖掘", 配置, 内置字库数据, 原始词典, mapping, 表列表, 组起, 组止, 根起, 根止}
 *      {type:"stop"}
 *  出: {type:"阶段",文本} | {type:"轮进度",已评,总数,最优,最优分} | {type:"轮",轮结果}
 *      | {type:"日志",文本} | {type:"预置归并失败",文本,轮} | {type:"手动指定问题",文本}
 *      | {type:"完成",结果} | {type:"已停止"} | {type:"错误",错误}
 */
import {
  智能选根核心,
  取手动指定白名单,
  type 搜索参数,
  type 轮结果,
} from "./智能选根核心";

let 停止 = false;

/** 引擎抛的是英文 + 堆栈（`键盘映射长度计算失败: Error: 决策中不存在键: 㐄 at new 取码器…`），
 *  堆到界面上对用户全是噪音。这里只把两类「方案自身有悬空引用」翻成人话，其余给 message 原文；
 *  堆栈改走 console，开发者仍能在控制台看到完整调用链。 */
const 错误文本 = (err: any): string => {
  const 原文 = String(err?.message ?? err);
  const 缺键 = /决策中不存在键\s*[:：]\s*(\S+)/.exec(原文);
  if (缺键) {
    const 名 = 缺键[1]!;
    return `「${名}」不在方案的字根映射里，但别的根的归并／键位引用指着它——多半是删根时漏了随行的条目。请先补回「${名}」或删掉引用它的条目。`;
  }
  const 无安排 = /元素\s*(\S+)\s*在决策空间中没有非空安排/.exec(原文);
  if (无安排)
    return `「${无安排[1]}」既不在方案里，也没有任何可用安排（可能被标成「禁用」了）。`;
  return 原文;
};
const 报错误 = (post: (m: any) => void, err: any) => {
  console.error(err);
  post({ type: "错误", 错误: 错误文本(err) });
};

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
      // 这两个后台任务只挖榜、不调 搜索()，所以白名单要在这里自己设：
      // 否则用户点名的同形根会被同形兄弟合并成一个代表，界面上永远显示「挖不出」。
      // 提取逻辑与 搜索() 共用一个函数（取手动指定白名单），别在这里另写一遍。
      核心.设置强制独立根(取手动指定白名单(msg.字根表列表));
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
      报错误(post, err);
    }
    return;
  }
  if (msg.type === "组挖掘") {
    try {
      停止 = false;
      post({ type: "阶段", 文本: "构建字库与分析器（约数秒）……" });
      const 核心 = new 智能选根核心(msg.配置, msg.原始词典, msg.内置字库数据);
      核心.设置强制独立根(取手动指定白名单(msg.字根表列表));
      核心.设置基态(msg.mapping);
      post({ type: "阶段", 文本: "组伤害排名 + 切片挖掘 + 分离收益计分……" });
      const 结果 = 核心.重码组挖掘(
        msg.表列表,
        { on阶段: (文本) => post({ type: "阶段", 文本 }), 应停止: () => 停止 },
        msg.允许复合体 !== false,
      );
      post({ type: "组挖掘完成", 结果 });
    } catch (err: any) {
      报错误(post, err);
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
      on轮进度: (已评: number, 总数: number, 最优: string, 最优分: number, 变化: number | null) =>
        post({ type: "轮进度", 已评, 总数, 最优, 最优分, 变化 }),
      on轮: (r: 轮结果) => post({ type: "轮", 轮结果: r }),
      on预置归并失败: (文本: string, 轮?: number | null) => post({ type: "预置归并失败", 文本, 轮 }),
      on手动指定问题: (文本: string) => post({ type: "手动指定问题", 文本 }),
      应停止: () => 停止,
    };
    const 结果 = 核心.搜索(msg.mapping, msg.参数 as 搜索参数, 回调);
    if (结果.已停止) post({ type: "已停止", 结果 });
    else post({ type: "完成", 结果 });
  } catch (err: any) {
    报错误(post, err);
  }
};
