import init, { WebInterface } from "libchai";
import { analysis } from "./lib/repertoire";
import { assemble } from "./lib/assembly";
import { defaultConfig } from "./lib";
import type { Assets } from "./atoms";

export interface WorkerInput {
  type: "sync" | "encode" | "evaluate" | "optimize" | "analysis" | "assembly";
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

await init();
const webInterface = WebInterface.new(self.postMessage, defaultConfig, [], {
  frequency: {},
  key_distribution: {},
  pair_equivalence: {},
} satisfies Assets);

self.onmessage = async (event: MessageEvent<WorkerInput>) => {
  const channel = event.ports[0]!;
  const data = event.data.data;
  let result: any;
  try {
    switch (event.data.type) {
      case "sync":
        if (data[0] === "config") {
          webInterface.update_config(data[1]);
        } else if (data[0] === "info") {
          webInterface.update_info(data[1]);
        } else if (data[0] === "assets") {
          webInterface.update_assets(data[1]);
        }
        break;
      case "analysis":
        result = analysis(data[0], data[1], data[2]);
        channel.postMessage({ type: "success", result });
        break;
      case "assembly":
        result = assemble(data[0], data[1], data[2], data[3], data[4], data[5]);
        channel.postMessage({ type: "success", result });
        break;
      case "encode":
        result = webInterface.encode_evaluate(data[0]);
        channel.postMessage({ type: "success", result });
        break;
      case "optimize":
        webInterface.optimize();
        self.postMessage({ type: "success" } as WorkerOutput);
        break;
    }
  } catch (error) {
    channel.postMessage({ type: "error", error } as WorkerOutput);
    self.postMessage({ type: "error", error } as WorkerOutput);
  }
};

export {};
