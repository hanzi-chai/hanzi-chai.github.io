import * as libchai from "libchai";

export interface LibchaiInputEvent {
  type: "encode" | "evaluate" | "optimize";
  data: any;
}

export type LibchaiOutputEvent =
  | {
      type: "code";
      code: any;
    }
  | {
      type: "better_solution";
      config: string;
      metric: string;
      save: boolean;
    }
  | {
      type: "metric";
      metric: string;
    }
  | {
      type: "finish";
    }
  | {
      type: "error";
      error: Error;
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

self.onmessage = async (event: MessageEvent<LibchaiInputEvent>) => {
  await libchai.default();
  try {
    switch (event.data.type) {
      case "encode":
        const code = libchai.encode(event.data.data);
        self.postMessage({
          type: "code",
          code: code,
        });
        break;
      case "evaluate":
        const result = libchai.evaluate(event.data.data);
        self.postMessage({
          type: "metric",
          metric: result,
        } as LibchaiOutputEvent);
        break;
      case "optimize":
        libchai.optimize(event.data.data, self.postMessage);
        self.postMessage({ type: "finish" } as LibchaiOutputEvent);
        break;
    }
  } catch (error) {
    self.postMessage({ type: "error", error } as LibchaiOutputEvent);
  }
};

export {};
