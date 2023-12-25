import * as libchai from "libchai";

export interface LibchaiInputEvent {
  type: "evaluate" | "optimize";
  data: any;
}

export type LibchaiOutputEvent =
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
  } catch {
    self.postMessage({ type: "error" } as LibchaiOutputEvent);
  }
};

export {};
