import init, { Web } from "libchai";
import { analysis } from "./lib/repertoire";
import { assemble } from "./lib/assembly";
import { Config } from "./lib";
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

self.onmessage = async (event: MessageEvent<WorkerInput>) => {
  const port = event.ports[0]!;
  const data = event.data.data;
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
        webInterface.sync(data[0]);
        result = webInterface.encode_evaluate(data[1]);
        port.postMessage({ type: "success", result });
        break;
      case "optimize":
        webInterface.sync(data[0]);
        webInterface.optimize();
        port.postMessage({ type: "success" });
        break;
    }
  } catch (error) {
    port.postMessage({ type: "error", error });
  }
};
