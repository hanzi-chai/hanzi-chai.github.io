import { Flex, Skeleton } from "antd";
import { Suspense } from "react";
import { useChaifenTitle } from "~/atoms";
import Debugger from "~/components/Debugger";

export default function Assembly() {
  useChaifenTitle("编码");
  return (
    <Flex vertical gap="middle">
      <Suspense fallback={<Skeleton active />}>
        <Debugger />
      </Suspense>
    </Flex>
  );
}
