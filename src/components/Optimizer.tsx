import {
  Button,
  Col,
  Flex,
  Progress,
  Row,
  Statistic,
  Typography,
  notification,
} from "antd";
import { useAtomValue } from "jotai";
import { useState } from "react";
import type { DictEntry } from "~/atoms";
import { configAtom, assetsAtom, makeEncodeCallback } from "~/atoms";
import {
  exportTSV,
  exportYAML,
  makeWasmWorker,
  stringifySequence,
} from "~/lib";
import type { LibchaiOutputEvent } from "~/worker";
import { load } from "js-yaml";
import type { Solver } from "~/lib";
import { assemblyResultAtom } from "~/atoms/cache";

const Schedule = ({
  params,
  progress,
}: {
  params: Partial<Solver["parameters"]>;
  progress?: { temperature: number; steps: number };
}) => {
  return (
    <>
      <Typography.Title level={4}>参数</Typography.Title>
      <Row style={{ width: "100%" }}>
        <Col span={5}>
          <Statistic
            title="最高温"
            value={params?.t_max?.toExponential(2) ?? "寻找中"}
          />
        </Col>
        <Col span={5}>
          <Statistic
            title="最低温"
            value={params?.t_min?.toExponential(2) ?? "寻找中"}
          />
        </Col>
        <Col span={5}>
          <Statistic
            title="当前温"
            value={progress?.temperature.toExponential(2) ?? "N/A"}
          />
        </Col>
        <Col span={4}>
          <Statistic title="总步数" value={params?.steps ?? "寻找中"} />
        </Col>
        <Col span={4}>
          <Statistic title="当前步数" value={progress?.steps ?? "N/A"} />
        </Col>
      </Row>
      {progress ? (
        <Progress
          percent={Math.round(
            (progress.steps / (params?.steps ?? Infinity)) * 100,
          )}
        />
      ) : null}
    </>
  );
};

export default function Optimizer() {
  const assets = useAtomValue(assetsAtom);
  const config = useAtomValue(configAtom);
  const assemblyResult = useAtomValue(assemblyResultAtom);
  const [out1, setOut1] = useState("");
  const [result, setResult] = useState<[Date, string][]>([]);
  const [bestResult, setBestResult] = useState<string | undefined>(undefined);
  const [bestMetric, setBestMetric] = useState("");
  const [optimizing, setOptimizing] = useState(false);
  const [progress, setProgress] = useState<
    { steps: number; temperature: number } | undefined
  >(undefined);
  const [autoParams, setAutoParams] =
    useState<Partial<Solver["parameters"]>>(undefined);
  const params = config.optimization?.metaheuristic.parameters ?? autoParams;
  const prepareInput = () => {
    return {
      config,
      info: stringifySequence(assemblyResult, config),
      assets,
    };
  };
  return (
    <>
      <Typography.Title level={3}>方案评测</Typography.Title>
      <Button
        type="primary"
        onClick={async () => {
          const worker = makeWasmWorker();
          worker.onmessage = (event: MessageEvent<LibchaiOutputEvent>) => {
            const { data } = event;
            switch (data.type) {
              case "metric":
                setOut1(data.metric);
                notification.success({
                  message: "评测成功!",
                });
                break;
              case "error":
                notification.error({
                  message: "评测过程中 libchai 出现错误",
                  description: data.error.message,
                });
                break;
            }
          };
          worker.postMessage({ type: "evaluate", data: prepareInput() });
        }}
      >
        开始评测
      </Button>
      {out1 ? (
        <Typography.Text>
          <pre>{out1}</pre>
        </Typography.Text>
      ) : null}
      <Typography.Title level={3}>方案优化</Typography.Title>
      <Button
        type="primary"
        onClick={() => {
          setResult([]);
          setBestResult(undefined);
          setBestMetric("");
          setAutoParams(undefined);
          setProgress(undefined);
          setOptimizing(true);
          const worker = makeWasmWorker();
          worker.onmessage = (event: MessageEvent<LibchaiOutputEvent>) => {
            const { data } = event;
            switch (data.type) {
              case "better_solution":
                setBestResult(data.config);
                setBestMetric(data.metric);
                if (data.save) {
                  setResult((result) =>
                    [[new Date(), data.config] as [Date, string]].concat(
                      result,
                    ),
                  );
                }
                break;
              case "progress":
                setProgress(data);
                break;
              case "parameters":
                setAutoParams((params) => ({
                  t_max: data.t_max ?? params?.t_max,
                  t_min: data.t_min ?? params?.t_min,
                  steps: data.steps ?? params?.steps,
                }));
                break;
              case "finish":
                notification.success({
                  message: "优化已完成，请下载结果!",
                });
                break;
              case "error":
                notification.error({
                  message: "优化过程中 libchai 出现错误",
                  description: data.error.message,
                });
                break;
            }
          };
          worker.postMessage({ type: "optimize", data: prepareInput() });
        }}
      >
        开始优化
      </Button>
      {optimizing ? <Schedule params={params} progress={progress} /> : null}
      <Typography.Title level={4}>当前最佳方案</Typography.Title>
      {bestMetric && bestResult ? (
        <>
          <Typography.Text>
            <pre>{bestMetric}</pre>
          </Typography.Text>
          <Flex justify="center" gap="middle">
            <Button
              onClick={() =>
                exportYAML(load(bestResult) as object, "optimized")
              }
            >
              下载方案
            </Button>
            <Button
              onClick={() => {
                const worker = makeWasmWorker();
                const flatten = (x: DictEntry) => [x.name, x.full, x.short];
                worker.onmessage = makeEncodeCallback((code) => {
                  exportTSV(code.map(flatten), "code.txt");
                });
                worker.postMessage({
                  type: "encode",
                  data: { ...prepareInput(), config: load(bestResult) },
                });
              }}
            >
              下载码表
            </Button>
          </Flex>
        </>
      ) : null}
      <Typography.Title level={4}>全部方案</Typography.Title>
      <div>
        <Flex
          vertical
          gap="small"
          style={{
            maxHeight: "200px",
            overflowY: "scroll",
            padding: "8px",
            border: "1px solid black",
            borderRadius: "8px",
          }}
        >
          {result.map(([time, content], index) => (
            <Flex align="center" justify="space-between" key={index}>
              <span>{time.toISOString()}</span>
              <Button
                onClick={() =>
                  exportYAML(load(content) as object, time.toISOString())
                }
              >
                下载
              </Button>
            </Flex>
          ))}
        </Flex>
      </div>
    </>
  );
}
