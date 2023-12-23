import { Button, Typography, notification } from "antd";
import { useAtomValue } from "jotai";
import { useState } from "react";
import {
  characterFrequencyAtom,
  configAtom,
  keyEquivalenceAtom,
  pairEquivalenceAtom,
  useAll,
  wordFrequencyAtom,
} from "~/atoms";
import * as libchai from "libchai";
import { autoSplit, collect } from "~/lib/encoder";

const _ = await libchai.default();

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
  const [handle, setHandle] = useState<libchai.Interface | undefined>(
    undefined,
  );
  const data = useAll();
  const list = Object.entries(data.repertoire)
    .filter(([_, v]) => v.gb2312)
    .filter(([_, v]) => v.tygf > 0)
    .map(([x]) => x);
  const [value, setValue] = useState<string | undefined>(undefined);
  return (
    <>
      <Button
        onClick={() => {
          const characters = new Map(autoSplit(collect(config, list, data)));
          const handle = libchai.Interface.new(
            config,
            characters,
            words,
            assets,
          );
          setHandle(handle);
          notification.success({
            message: "libchai 初始化成功!",
          });
        }}
      >
        初始化 libchai
      </Button>
      <Typography.Title level={3}>方案评估</Typography.Title>
      <Button
        disabled={handle === undefined}
        onClick={() => {
          const value = handle?.evaluate();
          setValue(value);
        }}
      >
        计算
      </Button>
      <Typography.Text>{value}</Typography.Text>
      <Typography.Title level={3}>方案优化</Typography.Title>
      <Button disabled={handle === undefined}>计算</Button>
    </>
  );
};

export default Evaluator;
