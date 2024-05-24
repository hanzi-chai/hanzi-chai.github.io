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
import { useAtom, useAtomValue } from "jotai";
import { useState } from "react";
import {
  configAtom,
  repertoireAtom,
  assetsAtom,
  dictionaryAtom,
  DictEntry,
  makeEncodeCallback,
} from "~/atoms";
import {
  assemble,
  exportTSV,
  exportYAML,
  makeWorker,
  stringifySequence,
} from "~/lib";
import { LibchaiOutputEvent } from "~/worker";
import { load } from "js-yaml";
import { Solver } from "~/lib";
import { analysisResultAtom, assemblyResultAtom } from "~/atoms/cache";
import { analysis } from "~/lib";
import { customElementsAtom } from "~/atoms/assets";

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

const Optimizer = () => {
  const assets = useAtomValue(assetsAtom);
  const dictionary = useAtomValue(dictionaryAtom);
  const config = useAtomValue(configAtom);
  const [analysisResult, setAnalysisResult] = useAtom(analysisResultAtom);
  const [assemblyResult, setAssemblyResult] = useAtom(assemblyResultAtom);
  const repertoire = useAtomValue(repertoireAtom);
  const list = Object.entries(repertoire)
    .filter(([_, v]) => v.tygf > 0)
    .map(([x]) => x);
  const customElements = useAtomValue(customElementsAtom);
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
    let v1 = analysisResult;
    if (v1 === null) {
      v1 = analysis(repertoire, config);
      setAnalysisResult(v1);
    }
    let v2 = assemblyResult;
    if (v2 === null) {
      v2 = assemble(repertoire, config, list, dictionary, v1, customElements);
      setAssemblyResult(v2);
    }
    return {
      config,
      info: stringifySequence(v2, config),
      assets,
    };
  };
  return (
    <>
      <Typography.Title level={3}>方案评测</Typography.Title>
      <Button
        type="primary"
        onClick={async () => {
          const worker = makeWorker();
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
          const worker = makeWorker();
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
                const worker = makeWorker();
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
};

export default Optimizer;
