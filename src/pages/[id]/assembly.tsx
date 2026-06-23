import { Button, Flex, Select, Skeleton } from "antd";
import { 获取注册表 } from "hanzi-chai";
import { useAtom, useAtomValue } from "jotai";
import { Suspense } from "react";
import {
  useAtomValueUnwrapped,
  动态分析原子,
  如导出动态组装结果原子,
  如导出组装结果原子,
  组装器原子,
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
  const 组装结果 = useAtomValueUnwrapped(如导出组装结果原子);
  return (
    <Button onClick={() => exportYAML(组装结果, "elements", 1)}>
      导出元素序列表
    </Button>
  );
};

export const ExportDynamicAssembly = () => {
  const 组装结果 = useAtomValueUnwrapped(如导出动态组装结果原子);
  return (
    <Button onClick={() => exportYAML(组装结果, "elements", 1)}>
      导出动态元素序列表
    </Button>
  );
};

const ConfigureRules = () => {
  const 动态分析 = useAtomValue(动态分析原子);
  const [组装器, 设置组装器] = useAtom(组装器原子);
  const 注册表 = 获取注册表();
  return (
    <Flex gap="middle" justify="center">
      <Flex align="center">
        组装器：
        <Select
          value={组装器}
          onChange={设置组装器}
          options={[...注册表.组装器映射.keys()].map((x) => ({
            label: x,
            value: x,
          }))}
        />
      </Flex>
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
