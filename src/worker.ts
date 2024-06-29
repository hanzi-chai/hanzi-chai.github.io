import * as libchai from "libchai";
import { analysis } from "./lib/repertoire";
import { assemble } from "./lib/assembly";

export interface WorkerInput {
  type: "encode" | "evaluate" | "optimize" | "analysis" | "assembly";
  data: any;
}

export type WorkerOutput =
  | {
      type: "success";
      result: any;
    }
  | {
      type: "error";
      error: Error;
    }
  | {
      type: "better_solution";
      config: string;
      metric: string;
      save: boolean;
    }
  | {
      type: "progress";
      steps: number;
      temperature: number;
      metric: string;
    }
  | {
      type: "parameters";
      t_max?: number;
      t_min?: number;
      steps?: number;
    };

self.onmessage = async (event: MessageEvent<WorkerInput>) => {
  const channel = event.ports[0]!;
  const data = event.data.data;
  await libchai.default();
  let result: any;
  try {
    switch (event.data.type) {
      case "analysis":
        result = analysis(data[0], data[1], data[2]);
        channel.postMessage({ type: "success", result });
        break;
      case "assembly":
        result = assemble(data[0], data[1], data[2], data[3], data[4], data[5]);
        channel.postMessage({ type: "success", result });
        break;
      case "encode":
        result = [libchai.evaluate(data[0]), libchai.encode(data[0])];
        channel.postMessage({ type: "success", result });
        break;
      case "optimize":
        libchai.optimize(event.data.data, self.postMessage);
        self.postMessage({ type: "success" } as WorkerOutput);
        break;
    }
  } catch (error) {
    channel.postMessage({ type: "error", error } as WorkerOutput);
    self.postMessage({ type: "error", error } as WorkerOutput);
  }
};

export {};
