import Mapping from "~/components/Mapping";
import ElementPicker from "~/components/ElementPicker";
import { Flex } from "antd";
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
