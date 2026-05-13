import { Button, Flex, Skeleton } from "antd";
import { useAtomValue } from "jotai";
import { Suspense } from "react";
import {
  useAtomValueUnwrapped,
  动态分析原子,
  如动态组装结果与优先简码原子,
  如组装结果与优先简码原子,
} from "~/atoms";
import { ErrorBoundary } from "~/components/Error";
import MetricTable from "~/components/MetricTable";
import MultipleRules from "~/components/MultipleRules";
import SelectRules from "~/components/SelectRules";
import SequenceTable from "~/components/SequenceTable";
import ShortCodeRules from "~/components/ShortCodeRules";
import SingleRules from "~/components/SingleRules";
import { exportYAML, useChaifenTitle } from "~/utils";

export const ExportAssembly = () => {
  const 组装结果 = useAtomValueUnwrapped(如组装结果与优先简码原子);
  return (
    <Button
      onClick={() => {
        const result = 组装结果.map(({ 词, 元素序列, 频率, 简码长度 }) => {
          return {
            词: 词.map((c) => c.获取名称()).join(""),
            元素序列: 元素序列.元素序列,
            频率,
            简码长度,
          };
        });
        exportYAML(result, "elements", 1);
      }}
    >
      导出元素序列表
    </Button>
  );
};

export const ExportDynamicAssembly = () => {
  const 组装结果 = useAtomValueUnwrapped(如动态组装结果与优先简码原子);
  return (
    <Button
      onClick={() => {
        const result = 组装结果.map(({ 词, 元素序列, 频率, 简码长度 }) => {
          return {
            词: 词.map((c) => c.获取名称()).join(""),
            全部元素序列: [...元素序列],
            频率,
            简码长度,
          };
        });
        exportYAML(result, "elements", 1);
      }}
    >
      导出动态元素序列表
    </Button>
  );
};

const ConfigureRules = () => {
  const 动态分析 = useAtomValue(动态分析原子);
  return (
    <Flex gap="middle" justify="center">
      <SingleRules />
      <MultipleRules />
      <SelectRules />
      <ShortCodeRules />
      <ExportAssembly key={1} />
      {动态分析 && <ExportDynamicAssembly key={2} />}
    </Flex>
  );
};

export default function Assembly() {
  useChaifenTitle("编码");
  return (
    <Flex vertical gap="middle">
      <ConfigureRules />
      <ErrorBoundary>
        <Suspense fallback={<Skeleton active />}>
          <MetricTable />
          <SequenceTable />
        </Suspense>
      </ErrorBoundary>
    </Flex>
  );
}
