import init, { Web } from "libchai";
import { analysis } from "./lib/repertoire";
import { assemble } from "./lib/assembly";
import type { Config } from "./lib";
import axios from "axios";

export interface WorkerInput {
  type: "sync" | "encode" | "evaluate" | "optimize" | "analysis" | "assembly";
  data: any;
}

export type WorkerOutput =
  | { type: "success"; result: any }
  | { type: "error"; error: Error }
  | { type: "better_solution"; config: Config; metric: string; save: boolean }
  | { type: "progress"; steps: number; temperature: number; metric: string }
  | { type: "parameters"; t_max?: number; t_min?: number; steps?: number }
  | { type: "elapsed"; time: number }
  | { type: "trial_max"; temperature: number; accept_rate: number }
  | { type: "trial_min"; temperature: number; improve_rate: number };

await init();

// 修复WebSocket连接地址
const ADDRESS = "localhost:3200";
const API_URL = `http://${ADDRESS}/api`;
let currentPort: MessagePort | null = null;

// 优化状态
type StatusResponse = {
  is_running: boolean;
  progress?: any; // 根据实际进度数据类型调整
  error?: string; // 可选错误信息
};

// 轮询状态检查函数
async function pollStatus(onProgress?: (data: any) => void): Promise<any> {
  const maxAttempts = 1800; // 30分钟 (1800 * 1秒)
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const response = await axios.get(`${API_URL}/status`, {
        timeout: 5000,
        headers: {
          "Content-Type": "application/json",
        },
      });
      const data: StatusResponse = response.data;
      if (!data.is_running) return "优化已完成";
      if (data.progress) {
        // 如果有进度数据，调用回调函数
        onProgress?.(data.progress);
      }
    } catch (error) {
      console.warn(
        `⚠️ 状态轮询失败 (尝试 ${attempts + 1}/${maxAttempts}):`,
        error,
      );

      // 如果是网络错误，等待更长时间后重试
      if (
        axios.isAxiosError(error) &&
        (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND")
      ) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    // 等待200ms后继续轮询
    await new Promise((resolve) => setTimeout(resolve, 200));
    attempts++;
  }

  throw new Error("优化超时 - 已达到最大轮询次数");
}

self.onmessage = async (event: MessageEvent<WorkerInput>) => {
  const port = event.ports[0]!;
  const data = event.data.data;
  currentPort = port; // 保存当前端口引用
  const webInterface = Web.new(port.postMessage.bind(port));
  let result: any;
  try {
    switch (event.data.type) {
      case "analysis":
        result = analysis(data[0], data[1], data[2]);
        port.postMessage({ type: "success", result });
        break;
      case "assembly":
        result = assemble(
          data[0],
          data[1],
          data[2],
          data[3],
          data[4],
          data[5],
          data[6],
        );
        port.postMessage({ type: "success", result });
        break;
      case "encode":
        if (import.meta.env.MODE === "CLIENT") {
          await apiCall("sync", data[0]);
          result = await apiCall("encode", data[1]);
        } else {
          webInterface.sync(data[0]);
          result = webInterface.encode_evaluate(data[1]);
        }
        port.postMessage({ type: "success", result });
        break;
      case "optimize":
        if (import.meta.env.MODE === "CLIENT") {
          // 同步配置
          await apiCall("sync", data[0]);
          // 启动优化
          await apiCall("optimize", {});
          // 开始轮询状态，并转发进度消息到主线程
          result = await pollStatus((progressData) => {
            if (currentPort) {
              currentPort.postMessage(progressData);
            }
          });
        } else {
          webInterface.sync(data[0]);
          webInterface.optimize();
        }
        port.postMessage({ type: "success", result });
        break;
    }
  } catch (error) {
    console.error("Worker处理错误:", error);
    port.postMessage({ type: "error", error });
  } finally {
    currentPort = null; // 清理端口引用
  }
};

type ApiResponse = {
  type: "success" | "error";
  result: any;
  error?: string;
};

async function apiCall(endpoint: any, data: any) {
  // console.log(`📡 ${endpoint} 请求:`, data);
  let result = {};
  await axios
    .post(`${API_URL}/${endpoint}`, data, {
      timeout: 60000,
      headers: {
        "Content-Type": "application/json",
      },
    })
    .then((resp) => {
      const data: ApiResponse = resp.data;
      // console.log(`✅ ${endpoint} 响应:`, data);
      if (data.type === "success") {
        result = data.result;
      }
      if (data.type === "error") {
        console.error(`❌ ${endpoint}:`, data.error);
        throw new Error(data.error);
      }
    })
    .catch((error) => {
      console.error(`❌ ${endpoint}:`, error);
      throw error;
    });
  return result;
}
