import {
  Button,
  Col,
  Flex,
  List,
  notification,
  Progress,
  Row,
  Statistic,
  Typography,
} from "antd";
import { useAtomValue } from "jotai";
import { load } from "js-yaml";
import { nanoid } from "nanoid";
import { useState } from "react";
import { useAtomValueUnwrapped, 如前端输入原子, 求解器原子 } from "~/atoms";
import type { 求解器配置, 配置 } from "~/lib";
import { basePath, exportYAML, thread } from "~/utils";
import type { WorkerOutput } from "~/worker";

const Schedule = ({
  params,
  progress,
}: {
  params: Partial<求解器配置["parameters"]>;
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
            (progress.steps / (params?.steps ?? Number.POSITIVE_INFINITY)) *
              100,
          )}
        />
      ) : null}
    </>
  );
};

interface 优化结果 {
  配置文件: string;
  分数: number;
}

export default function Optimizer() {
  const metaheuristic = useAtomValue(求解器原子);
  const [result, setResult] = useState<{ date: Date; config: 配置 }[]>([]);
  const [bestResult, setBestResult] = useState<配置 | undefined>(undefined);
  const [bestScore, setBestScore] = useState<number | undefined>(undefined);
  const [bestMetric, setBestMetric] = useState("");
  const [optimizing, setOptimizing] = useState(false);
  const [progress, setProgress] = useState<
    { steps: number; temperature: number } | undefined
  >(undefined);
  const [autoParams, setAutoParams] =
    useState<Partial<求解器配置["parameters"]>>(undefined);
  const params = metaheuristic.parameters ?? autoParams;
  const input = useAtomValueUnwrapped(如前端输入原子);
  return (
    <>
      <Button
        type="primary"
        disabled={optimizing}
        onClick={async () => {
          setResult([]);
          setBestResult(undefined);
          setBestMetric("");
          setAutoParams(undefined);
          setProgress(undefined);
          setOptimizing(true);
          try {
            const finalResult = await thread.spawn<优化结果>(
              "optimize",
              [input],
              (data: WorkerOutput) => {
                const date = new Date();
                switch (data.type) {
                  case "better_solution": {
                    const config: 配置 = load(data.config) as any;
                    setBestResult(config);
                    setBestMetric(data.metric);
                    setBestScore(data.score);
                    if (data.index !== undefined) {
                      setResult((result) => [{ date, config }].concat(result));
                    }
                    break;
                  }
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
                  case "trial_max":
                    setAutoParams((params) => ({
                      ...params,
                      t_max: data.temperature,
                    }));
                    break;
                  case "trial_min":
                    setAutoParams((params) => ({
                      ...params,
                      t_min: data.temperature,
                    }));
                    break;
                }
              },
            );
            setBestResult(load(finalResult.配置文件) as 配置);
            setBestScore(finalResult.分数);
            notification.success({
              message: "优化已完成，请查看结果!",
            });
          } catch (error) {
            notification.error({
              message: "优化过程中 libchai 出现错误",
              description: (error as any).message,
            });
          }
          setOptimizing(false);
        }}
      >
        开始优化
      </Button>
      {optimizing ? <Schedule params={params} progress={progress} /> : null}
      <Typography.Title level={4}>当前最佳方案</Typography.Title>
      {bestMetric && bestResult ? (
        <>
          <Typography.Text>
            <pre>分数：{bestScore?.toExponential(4)}</pre>
            <pre>{bestMetric}</pre>
          </Typography.Text>
          <Flex justify="center" gap="middle">
            <Button
              onClick={() => {
                const id = nanoid(9);
                localStorage.setItem(id, JSON.stringify(bestResult));
                window.open(`${basePath}${id}`, "_blank");
              }}
            >
              在新标签页中打开方案
            </Button>
            <Button onClick={() => exportYAML(bestResult, "优化结果")}>
              下载方案
            </Button>
          </Flex>
        </>
      ) : null}
      <Typography.Title level={4}>全部方案</Typography.Title>
      <List
        size="small"
        dataSource={result}
        bordered
        style={{
          maxHeight: "300px",
          overflowY: "scroll",
        }}
        renderItem={({ date, config }, index) => (
          <List.Item
            key={index}
            actions={[
              <Button
                key={index}
                onClick={() => exportYAML(config, date.toISOString())}
              >
                下载
              </Button>,
            ]}
          >
            {date.toISOString()}
          </List.Item>
        )}
      />
    </>
  );
}
