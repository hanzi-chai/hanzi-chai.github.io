import init, { Web } from "libchai";
import { 组装, 字库, 动态组装 } from "./lib";
import axios from "axios";

export interface WorkerInput {
  type: "sync" | "encode" | "evaluate" | "optimize" | "analysis" | "dynamic_analysis" | "assembly" | "dynamic_assembly";
  data: any;
}

export type WorkerOutput =
  | { type: "success"; result: any }
  | { type: "error"; error: Error }
  | { type: "better_solution"; config: string; metric: string; score: number; index?: number }
  | { type: "progress"; config: string; metric: string; score: number; steps: number; temperature: number }
  | { type: "parameters"; t_max?: number; t_min?: number; steps?: number }
  | { type: "elapsed"; time: number }
  | { type: "trial_max"; temperature: number; accept_rate: number }
  | { type: "trial_min"; temperature: number; improve_rate: number };

await init();

let currentPort: MessagePort | null = null;

// 优化状态响应类型
type OptimizationStatus =
  | { status: "idle" }
  | { status: "running"; message: any }
  | { status: "completed"; final_message?: any }
  | { status: "failed"; error: string };

// 通过 SSE 监听优化进度
async function updateStatus(onProgress?: (data: any) => void): Promise<any> {
  return new Promise((resolve, reject) => {
    const sseUrl = `/sse/status`;
    let eventSource: EventSource;
    try {
      eventSource = new EventSource(sseUrl);

      eventSource.onopen = () => {
        console.log("✅ SSE 已连接:", sseUrl);
      };

      eventSource.onmessage = (event) => {
        try {
          const response: OptimizationStatus = JSON.parse(event.data);
          console.log("📩 SSE 消息:", response);
          switch (response.status) {
            case "idle":
              // 空闲状态，无需处理
              break;
            case "running":
              onProgress?.(response.message);
              break;
            case "completed":
              eventSource.close();
              resolve(response.final_message);
              break;
            case "failed":
              eventSource.close();
              reject(new Error(response.error));
              break;
          }
        } catch (error) {
          console.error("❌ SSE 消息解析失败:", error);
        }
      };

      eventSource.onerror = (event) => {
        console.error("❌ SSE 连接错误:", event);
      };
    } catch (error) {
      console.error("❌ SSE 连接失败:", error);
    }
  });
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
        result = new 字库(data[0]).分析(data[1], data[2]);
        port.postMessage({ type: "success", result });
        break;
      case "dynamic_analysis":
        result = new 字库(data[0]).动态分析(data[1], data[2]);
        port.postMessage({ type: "success", result });
        break;
      case "assembly":
        result = 组装(data[0], data[1], data[2]);
        port.postMessage({ type: "success", result });
        break;
      case "dynamic_assembly":
        result = 动态组装(data[0], data[1], data[2]);
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
          // 发送进度消息到主线程
          result = await updateStatus((progressData) => {
            if (currentPort) {
              currentPort.postMessage(progressData);
            }
          });
        } else {
          webInterface.sync(data[0]);
          result = webInterface.optimize();
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
    .post(`/api/${endpoint}`, data, {
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
