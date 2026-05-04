import { Flex } from "antd";
import ElementPicker from "~/components/ElementPicker";
import Mapping from "~/components/Mapping";
import { useChaifenTitle } from "~/utils";

export default function Element() {
  useChaifenTitle("元素");
  return (
    <Flex gap="large">
      <ElementPicker />
      <Mapping />
    </Flex>
  );
}
