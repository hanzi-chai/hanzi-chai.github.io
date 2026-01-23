import { Suspense } from "react";
import { Flex, Skeleton } from "antd";
import SingleRules from "~/components/SingleRules";
import MultipleRules from "~/components/MultipleRules";
import SequenceTable from "~/components/SequenceTable";
import ShortCodeRules from "~/components/ShortCodeRules";
import SelectRules from "~/components/SelectRules";
import MetricTable from "~/components/MetricTable";
import { ErrorBoundary } from "~/components/Error";
import { useChaifenTitle } from "~/utils";

const ConfigureRules = () => {
  return (
    <Flex gap="middle" justify="center">
      <SingleRules />
      <MultipleRules />
      <SelectRules />
      <ShortCodeRules />
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
