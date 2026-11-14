import { Flex, Skeleton } from "antd";
import { Suspense } from "react";
import Debugger from "~/components/Debugger";
import { useChaifenTitle } from "~/utils";

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
