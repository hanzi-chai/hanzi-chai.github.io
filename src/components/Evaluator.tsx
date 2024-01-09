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
import {
  characterFrequencyAtom,
  configAtom,
  determinedRepertoireAtom,
  keyEquivalenceAtom,
  pairEquivalenceAtom,
  wordFrequencyAtom,
} from "~/atoms";
import { autoSplit, collect } from "~/lib/encoder";
import MyWorker from "../worker?worker";
import { LibchaiOutputEvent } from "~/worker";
import { exportYAML } from "./Utils";
import { load } from "js-yaml";
import { Solver } from "~/lib/config";

export type Frequency = Record<string, number>;
export type Equivalence = Record<string, number>;

interface Assets {
  character_frequency: Frequency;
  word_frequency: Frequency;
  key_equivalence: Equivalence;
  pair_equivalence: Equivalence;
}

const Evaluator = () => {
  const character_frequency = useAtomValue(characterFrequencyAtom);
  const word_frequency = useAtomValue(wordFrequencyAtom);
  const key_equivalence = useAtomValue(keyEquivalenceAtom);
  const pair_equivalence = useAtomValue(pairEquivalenceAtom);
  const assets: Assets = {
    character_frequency,
    word_frequency,
    key_equivalence,
    pair_equivalence,
  };
  const words = Object.keys(word_frequency);
  const config = useAtomValue(configAtom);
  const [characters, setCharacters] = useState<Map<string, string> | undefined>(
    undefined,
  );
  const input = {
    config,
    characters,
    words,
    assets,
  };
  const data = useAtomValue(determinedRepertoireAtom);
  const list = Object.entries(data)
    .filter(([_, v]) => v.gb2312)
    .filter(([_, v]) => v.tygf > 0)
    .map(([x]) => x);
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
  return (
    <>
      <Button
        onClick={() => {
          const characters = new Map(autoSplit(collect(config, list, data)));
          setCharacters(characters);
          notification.success({
            message: "拆分表初始化成功!",
          });
        }}
      >
        初始化拆分表
      </Button>
      <Typography.Title level={3}>方案评测</Typography.Title>
      <Button
        type="primary"
        disabled={characters === undefined}
        onClick={async () => {
          const worker = new MyWorker();
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
                });
                break;
            }
          };
          worker.postMessage({ type: "evaluate", data: input });
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
        disabled={characters === undefined}
        onClick={() => {
          setResult([]);
          setBestResult(undefined);
          setBestMetric("");
          setAutoParams(undefined);
          setProgress(undefined);
          setOptimizing(true);
          const worker = new MyWorker();
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
                });
                break;
            }
          };
          worker.postMessage({ type: "optimize", data: input });
        }}
      >
        开始优化
      </Button>
      {optimizing ? (
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
      ) : null}
      <Typography.Title level={4}>当前最佳方案指标</Typography.Title>
      {bestMetric ? (
        <Typography.Text>
          <pre>{bestMetric}</pre>
        </Typography.Text>
      ) : null}
      <Typography.Title level={4}>当前最佳结果下载</Typography.Title>
      {bestResult ? (
        <Button
          onClick={() => exportYAML(load(bestResult) as object, "optimized")}
        >
          下载
        </Button>
      ) : null}
      <Typography.Title level={4}>全部结果下载</Typography.Title>
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

export default Evaluator;
