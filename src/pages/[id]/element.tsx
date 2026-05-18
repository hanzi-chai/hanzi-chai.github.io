import { Flex, Skeleton } from "antd";
import { Suspense } from "react";
import ElementPicker from "~/components/ElementPicker";
import Mapping from "~/components/Mapping";
import { useChaifenTitle } from "~/utils";

export default function Element() {
  useChaifenTitle("元素");
  return (
    <Flex gap="large">
      <Suspense fallback={<Skeleton />}>
        <ElementPicker />
        <Mapping />
      </Suspense>
    </Flex>
  );
}
