import { useState } from "react";
import {
  Button,
  Flex,
  Modal,
  notification,
  Progress,
  Spin,
  Typography,
} from "antd";
import { shuffle, range, random } from "lodash-es";
import styled from "styled-components";
import User, { getUser } from "~/components/User";
import { post } from "~/api";

const generatePairs = () => {
  const pairs: number[] = [];
  // 左手单手
  for (const initial of range(0, 12)) {
    for (const final of range(0, 12)) {
      pairs.push(initial * 100 + final);
    }
  }
  // 右手单手
  for (const initial of range(16, 28)) {
    for (const final of range(16, 28)) {
      pairs.push(initial * 100 + final);
    }
  }
  // 采样：先左后右
  for (let i = 0; i < 10; ++i) {
    pairs.push(random(0, 16) * 100 + random(12, 28));
    pairs.push(random(12, 28) * 100 + random(0, 16));
  }
  return shuffle(pairs).slice(0, 10);
};

function UserGuide() {
  const [show, setShow] = useState(false);
  return (
    <>
      <Button type="primary" onClick={() => setShow(true)}>
        使用指南
      </Button>
      <Modal open={show} onCancel={() => setShow(false)} title="使用指南">
        <Typography.Paragraph>
          本实验测量四行七列手机布局的双键时间当量，该当量将以 GPLv3
          协议开源，并用于研制冰雪四拼手机版布局。
        </Typography.Paragraph>
        <Typography.Paragraph>
          该布局下设定的指法为：左手大拇指控制 1 ~ 4 列，而右手大拇指控制 4 ~ 7
          列。注意中间一列由哪个手控制取决于上一个键，例如组合 8 - 13
          中由右手击打 13，而 22 - 13 中由左手击打 13，形成类似于飞键的效果。
        </Typography.Paragraph>
        <Typography.Paragraph>
          点击「开始」后，系统将生成 308
          个双键组合，起始键用绿色显示，结束键用蓝色显示。看到由绿色和蓝色高亮的按键之后，您需要以最快的速度依次击打绿色和蓝色键。如果在此过程中误触了其他按键，则需要重新击打这个组合。
        </Typography.Paragraph>
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

const COLORS = {
  none: "#eee",
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
  background-color: ${({ $type }) => COLORS[$type]};
  transition: background-color 0.1s;
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
  if (value === initial) {
    $type = initialPressed ? "initialPressed" : "initial";
  }
  if (value === final) {
    if (initial !== final || initialPressed)
      $type = finalPressed ? "finalPressed" : "final";
  }
  return (
    <KeyWrapper $type={$type} onClick={() => handleClick(value)}>
      {isNaN(value) ? "" : value}
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

interface EquivalenceData {
  user: string;
  model: string;
  data: { initial: number; final: number; time: number }[];
}

function from(pair: number | undefined): [number, number] {
  if (pair === undefined) return [-1, -1];
  return [Math.floor(pair / 100), pair % 100];
}

const Equivalence = () => {
  const [pairs, setPairs] = useState<number[]>([]);
  const [results, setResults] = useState<number[]>([]);
  const [index, setIndex] = useState(0);
  const [initialPressed, setInitialPressed] = useState(false);
  const [initialTime, setInitialTime] = useState(0);
  const [finalPressed, setFinalPressed] = useState(false);
  const [loading, setLoading] = useState(false);
  const user = getUser();
  const [lastInitial, lastFinal] = from(pairs[index - 1]);
  const [initial, final] = from(pairs[index]);

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

  const reset = () => {
    setPairs([]);
    setResults([]);
    setIndex(0);
    setInitialPressed(false);
    setInitialTime(0);
    setFinalPressed(false);
  };

  const rows = 4;
  const columns = 7;
  return (
    <>
      <Typography.Title level={2} style={{ textAlign: "center" }}>
        当量实验
      </Typography.Title>
      <Flex vertical gap="small" style={{ padding: "0 1rem" }}>
        <User />
        {user && (
          <Flex justify="center" gap="middle">
            <UserGuide />
            <Button
              onClick={() => {
                setPairs(generatePairs());
                setResults([]);
                setIndex(0);
                setInitialPressed(false);
              }}
            >
              开始实验
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
            <Progress percent={Math.round((index / pairs.length) * 100)} />
          </>
        )}
      </Flex>
      {user && pairs.length > 0 && (
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
            .flat()
            .concat(
              range(columns).map((j) => (
                <Key
                  value={NaN}
                  key={j}
                  initial={initial}
                  final={final}
                  initialPressed={initialPressed}
                  finalPressed={finalPressed}
                  handleClick={() => {}}
                />
              )),
            )}
        </Keyboard>
      )}
      <Modal
        open={results.length > 0 && results.length === pairs.length}
        title="实验结束"
        okText="上传结果"
        okButtonProps={{ loading }}
        cancelText="放弃结果"
        onOk={async () => {
          const data = pairs.map((pair, i) => {
            const [initial, final] = from(pair);
            return {
              initial,
              final,
              time: results[i]!,
            };
          });
          const payload: EquivalenceData = {
            user: user!.id,
            model: "47",
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
