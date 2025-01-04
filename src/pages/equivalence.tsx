import type { PropsWithChildren } from "react";
import { useEffect, useState } from "react";
import {
  Button,
  Flex,
  Modal,
  notification,
  Progress,
  Select,
  Table,
  Typography,
} from "antd";
import { shuffle, range, random, mean } from "lodash-es";
import styled from "styled-components";
import User, { getUser } from "~/components/User";
import { get, post } from "~/api";
import type { EquivalenceData, Pair } from "~/lib/equivalence";
import type { ColumnsType } from "antd/es/table";

interface RankingData {
  user: string;
  count: number;
  speed: number;
}

function Ranking({ model }: { model: keyof typeof models }) {
  const columns: ColumnsType = [
    {
      title: "用户",
      dataIndex: "user",
      width: 128,
    },
    {
      title: "组合数",
      dataIndex: "count",
      sorter: (a, b) => a.count - b.count,
      sortDirections: ["descend", "ascend"],
    },
    {
      title: "平均时间 / ms",
      dataIndex: "speed",
      sorter: (a, b) => a.speed - b.speed,
      sortDirections: ["descend", "ascend"],
    },
  ];

  const [open, setOpen] = useState(false);
  const [dataSource, setDataSource] = useState<RankingData[]>([]);

  useEffect(() => {
    (async () => {
      const data = await get<EquivalenceData[], undefined>("equivalence");
      const modelData = data.filter((d) => d.model === model);
      const modelDataByUser = new Map<string, number[]>();
      for (const d of modelData) {
        if (!modelDataByUser.has(d.user)) {
          modelDataByUser.set(d.user, []);
        }
        modelDataByUser.get(d.user)!.push(...d.data.map((x) => x.time));
      }
      const dataSource = [...modelDataByUser].map(([user, data]) => {
        return {
          user,
          count: data.length,
          speed: Math.round(mean(data)),
        };
      });
      setDataSource(dataSource);
    })();
  }, [model]);
  return (
    <>
      <Button onClick={() => setOpen(true)}>排行榜</Button>
      <Modal
        open={open}
        closable={false}
        onCancel={() => setOpen(false)}
        onOk={() => setOpen(false)}
        title="排行榜"
        okText="好"
        cancelButtonProps={{ style: { display: "none" } }}
      >
        <Table<RankingData>
          columns={columns}
          dataSource={dataSource}
          size="small"
        />
      </Modal>
    </>
  );
}

function UserGuide({ children }: PropsWithChildren<{}>) {
  const [show, setShow] = useState(false);
  return (
    <>
      <Button onClick={() => setShow(true)}>使用指南</Button>
      <Modal
        open={show}
        onOk={() => setShow(false)}
        closable={false}
        title="使用指南"
        okText="好"
        cancelButtonProps={{ style: { display: "none" } }}
      >
        {children}
      </Modal>
    </>
  );
}

interface KeyProps {
  value: number;
  initial: number;
  final: number;
  initialPressed: boolean;
  finalPressed: boolean;
  handleClick: (v: number) => void;
}

type KeyboardProps = Omit<KeyProps, "value">;

const COLORS = {
  none: "#eee",
  both: "linear-gradient(90deg, #afa, #aef)",
  initial: "#afa",
  initialPressed: "#aaa",
  final: "#aef",
  finalPressed: "#aaa",
};

const KeyWrapper = styled.div<{ $type: keyof typeof COLORS }>`
  border: 1px solid #aaa;
  background-color: #eee;
  aspect-ratio: 1 / 1;
  place-content: center;
  text-align: center;
  background: ${({ $type }) => COLORS[$type]};
  transition: background-color 0.1s;
  touch-action: none;
`;

const Key = ({
  value,
  initial,
  initialPressed,
  final,
  finalPressed,
  handleClick,
}: KeyProps) => {
  let $type: keyof typeof COLORS = "none";
  const labels = [];
  if (value === initial) {
    labels.push("1");
    $type = initialPressed ? "initialPressed" : "initial";
  }
  if (value === final) {
    labels.push("2");
    if (initial === final && !initialPressed) {
      $type = "both";
    } else {
      $type = finalPressed ? "finalPressed" : "final";
    }
  }
  return (
    <KeyWrapper $type={$type} onTouchStart={() => handleClick(value)}>
      {labels.join(", ")}
    </KeyWrapper>
  );
};

const Keyboard = styled.div`
  position: fixed;
  bottom: 0;
  width: 100%;
  display: grid;
  grid-template-columns: repeat(7, 1fr);
`;

const defaultPair: Pair = { initial: -1, final: -1 };

const generatePairs = () => {
  const pairs: Pair[] = [];
  // 左手单手
  for (const initial of range(0, 15)) {
    for (const final of range(0, 15)) {
      pairs.push({ initial, final });
    }
  }
  // 右手单手
  for (const initial of range(20, 35)) {
    for (const final of range(20, 35)) {
      pairs.push({ initial, final });
    }
  }
  // 增加同指连击
  for (const key of range(0, 35)) {
    pairs.push({ initial: key, final: key });
  }
  // 异手连击
  for (let i = 0; i < 35; ++i) {
    pairs.push({ initial: random(0, 15 - 1), final: random(20, 35 - 1) });
    pairs.push({ initial: random(20, 35 - 1), final: random(0, 15 - 1) });
  }
  return shuffle(pairs);
};

const keyboard = ({
  initial,
  final,
  initialPressed,
  finalPressed,
  handleClick,
}: KeyboardProps) => {
  const rows = 5;
  const columns = 7;
  return (
    <Keyboard>
      {range(rows)
        .map((i) =>
          range(columns).map((j) => (
            <Key
              key={j * rows + i}
              value={j * rows + i}
              initial={initial}
              final={final}
              initialPressed={initialPressed}
              finalPressed={finalPressed}
              handleClick={handleClick}
            />
          )),
        )
        .flat()}
    </Keyboard>
  );
};

const models = {
  手机五行七列: {
    generatePairs,
    keyboard,
    description: (
      <>
        <Typography.Paragraph>
          本实验测量五行七列手机布局的双键时间当量，该当量将以 GPLv3
          协议开源，并用于研制冰雪四拼手机版布局。
        </Typography.Paragraph>
        <Typography.Paragraph>
          该布局下设定的指法为：左手大拇指可以控制左起一、二、三、四列，而右手大拇指可以控制右起一、二、三、四列。
          <strong>
            注意不要使用错误的手指按按键，这会导致当量计算不准确。
          </strong>
        </Typography.Paragraph>
        <Typography.Paragraph>
          实验开始后，您将被提示击打若干个双键组合，每个组合的起始键上标注 1
          并以绿色高亮，结束键上标注 2
          并以蓝色高亮。看到这两个按键之后，您需要以最快的速度按照既定指法依次击打绿色和蓝色键。
          <strong>
            如果看到一个同时标注 1, 2
            且蓝绿渐变的按键，说明起始键和结束键都是这个键，请双击。
          </strong>
          如果在击打双键组合中误触了其他按键，则需要重新击打这个组合。
        </Typography.Paragraph>
        <Typography.Paragraph>
          <strong>
            实验过程中，如果您觉得您击打某个组合的时候时间显著慢于它应有的时间，或者使用了错误的指法击打了某个组合，请点击撤销按钮并重新击打这个组合，以避免污染数据。
          </strong>
        </Typography.Paragraph>
      </>
    ),
  },
  测试: {
    description: "测试",
    generatePairs: () => generatePairs().slice(0, 10),
    keyboard,
  },
};

const Equivalence = () => {
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [results, setResults] = useState<number[]>([]);
  const [index, setIndex] = useState(0);
  const [initialPressed, setInitialPressed] = useState(false);
  const [initialTime, setInitialTime] = useState(0);
  const [finalPressed, setFinalPressed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState("手机五行七列" as keyof typeof models);
  const user = getUser();
  const { initial: lastInitial, final: lastFinal } =
    pairs[index - 1] ?? defaultPair;
  const { initial, final } = pairs[index] ?? defaultPair;

  const handleClick = (v: number) => {
    if (!pairs) return;
    if (initialPressed) {
      if (v === final) {
        const time = Math.round(performance.now() - initialTime);
        setResults([...results, time]);
        setFinalPressed(true);
        // 100ms 后进入下一组
        setTimeout(() => {
          setInitialPressed(false);
          setFinalPressed(false);
          setInitialTime(0);
          setIndex(index + 1);
        }, 100);
      } else {
        setInitialPressed(false);
      }
    } else {
      if (v === initial) {
        setInitialTime(performance.now());
        setInitialPressed(true);
      }
    }
  };

  const handleBackspace = () => {
    setResults(results.slice(0, -1));
    setIndex(index - 1);
    setInitialPressed(false);
    setFinalPressed(false);
    setInitialTime(0);
  };

  const reset = () => {
    setPairs([]);
    setResults([]);
    setIndex(0);
    setInitialPressed(false);
    setInitialTime(0);
    setFinalPressed(false);
  };
  return (
    <>
      <Typography.Title level={2} style={{ textAlign: "center" }}>
        当量实验
      </Typography.Title>
      <Flex vertical gap="small" style={{ padding: "0 1rem" }}>
        <Flex justify="center" gap="middle">
          <User />
          <Ranking model={model} />
        </Flex>
        {user && (
          <Flex justify="center" gap="middle">
            <Select
              value={model}
              options={Object.keys(models).map((key) => ({
                label: key,
                value: key,
              }))}
              onChange={(v) => {
                setModel(v);
                reset();
              }}
            />
            <UserGuide>{models[model].description}</UserGuide>
            <Button
              type="primary"
              onClick={() => {
                setPairs(models[model].generatePairs());
                setResults([]);
                setIndex(0);
                setInitialPressed(false);
              }}
            >
              开始
            </Button>
            <Button onClick={handleBackspace} disabled={results.length === 0}>
              撤销
            </Button>
          </Flex>
        )}
        {user && pairs.length > 0 && (
          <>
            {lastInitial !== -1 && (
              <div style={{ textAlign: "center" }}>
                完成组合：{lastInitial} - {lastFinal}，时间：
                {results.at(-1)} ms
              </div>
            )}
            <div style={{ textAlign: "center" }}>
              当前组合：{initial} - {final}，进度：{index} / {pairs.length}
            </div>
            <Progress percent={Math.floor((index / pairs.length) * 100)} />
          </>
        )}
      </Flex>
      {user &&
        pairs.length > 0 &&
        models[model].keyboard({
          initial,
          final,
          initialPressed,
          finalPressed,
          handleClick,
        })}
      <Modal
        open={results.length > 0 && results.length === pairs.length}
        closable={false}
        maskClosable={false}
        title="实验结束"
        okText="上传结果"
        okButtonProps={{ loading }}
        cancelText="放弃结果"
        onOk={async () => {
          const data = pairs.map((pair, i) => {
            return {
              ...pair,
              time: results[i]!,
            };
          });
          const payload: EquivalenceData = {
            user: user!.id,
            model,
            data,
          };
          setLoading(true);
          const result = await post<boolean, EquivalenceData>(
            "equivalence",
            payload,
          );
          setLoading(false);
          if (result) {
            notification.success({
              message: "上传成功",
              description: "感谢您的参与",
            });
          } else {
            notification.error({
              message: "上传失败",
              description: "请联系管理员",
            });
          }
          reset();
        }}
        onCancel={reset}
      >
        <Typography.Paragraph>
          实验结束，您共完成了 {results.length} 个组合。
        </Typography.Paragraph>
      </Modal>
    </>
  );
};

export default Equivalence;
