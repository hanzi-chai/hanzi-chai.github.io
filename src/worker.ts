import init, { Web } from "libchai";
import { analysis } from "./lib/repertoire";
import { assemble } from "./lib/assembly";
import { Metric } from "./lib";
export interface WorkerInput {
  type: "sync" | "encode" | "evaluate" | "optimize" | "analysis" | "assembly";
  data: any;
}

export type WorkerOutput =
  | { type: "success"; result: any }
  | { type: "error"; error: Error }
  | { type: "better_solution"; config: string; metric: Metric; save: boolean }
  | { type: "progress"; steps: number; temperature: number; metric: Metric }
  | { type: "parameters"; t_max?: number; t_min?: number; steps?: number };

await init();

self.onmessage = async (event: MessageEvent<WorkerInput>) => {
  const channel = event.ports[0]!;
  const data = event.data.data;
  const webInterface = Web.new(self.postMessage);
  let result: any;
  try {
    switch (event.data.type) {
      case "analysis":
        result = analysis(data[0], data[1], data[2]);
        channel.postMessage({ type: "success", result });
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
        channel.postMessage({ type: "success", result });
        break;
      case "encode":
        webInterface.sync(data[0]);
        result = webInterface.encode_evaluate(data[1]);
        channel.postMessage({ type: "success", result });
        break;
      case "optimize":
        webInterface.sync(data[0]);
        webInterface.optimize();
        channel.postMessage({ type: "success" } as WorkerOutput);
        break;
    }
  } catch (error) {
    channel.postMessage({ type: "error", error } as WorkerOutput);
  }
};

export {};
