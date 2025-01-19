import Mapping from "~/components/Mapping";
import ElementPicker from "~/components/ElementPicker";
import { useChaifenTitle } from "~/atoms";
import { Flex } from "antd";

export default function Element() {
  useChaifenTitle("元素");
  return (
    <Flex gap="large">
      <ElementPicker />
      <Mapping />
    </Flex>
  );
}
