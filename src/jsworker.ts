import type { AnalysisResult, AssemblyResult } from "./lib";
import { analysis } from "./lib/repertoire";
import { assemble } from "./lib/assembly";

export interface JsInputEvent {
  func: "analysis" | "assembly";
  args: any[];
}

export type JsOutputEvent = AnalysisResult | AssemblyResult;

self.onmessage = async (event: MessageEvent<JsInputEvent>) => {
  const channel = event.ports[0]!;
  const args = event.data.args;
  try {
    switch (event.data.func) {
      case "analysis":
        channel.postMessage(analysis(args[0], args[1], args[2]));
        break;
      case "assembly":
        channel.postMessage(
          assemble(args[0], args[1], args[2], args[3], args[4], args[5]),
        );
        break;
    }
  } catch (error) {
    channel.postMessage({ error: error });
  }
};

export {};
