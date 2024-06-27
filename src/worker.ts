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
        self.postMessage({
          type: "code",
          code: libchai.encode(event.data.data),
        });
        break;
      case "evaluate":
        self.postMessage({
          type: "metric",
          metric: libchai.evaluate(event.data.data),
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
