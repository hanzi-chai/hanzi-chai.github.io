import type { AnalysisResult, AssemblyResult } from "./lib";
import { analysis, assemble } from "./lib";

export interface JsInputEvent {
  func: "analysis" | "assembly";
  args: any[];
}

export type JsOutputEvent = AnalysisResult | AssemblyResult;

self.onmessage = async (event: MessageEvent<JsInputEvent>) => {
  const channel = event.ports[0]!;
  try {
    switch (event.data.func) {
      case "analysis":
        const [repertoire, config, characters] = event.data.args;
        channel.postMessage(analysis(repertoire, config, characters));
        break;
      case "assembly":
        const [arg1, arg2, arg3, arg4, arg5, arg6] = event.data.args;
        channel.postMessage(assemble(arg1, arg2, arg3, arg4, arg5, arg6));
        break;
    }
  } catch (error) {
    channel.postMessage({ error: error });
  }
};

export {};
