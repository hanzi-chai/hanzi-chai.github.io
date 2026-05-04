import { Flex, Skeleton } from "antd";
import { Suspense } from "react";
import { ErrorBoundary } from "~/components/Error";
import MetricTable from "~/components/MetricTable";
import MultipleRules from "~/components/MultipleRules";
import SelectRules from "~/components/SelectRules";
import SequenceTable from "~/components/SequenceTable";
import ShortCodeRules from "~/components/ShortCodeRules";
import SingleRules from "~/components/SingleRules";
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
