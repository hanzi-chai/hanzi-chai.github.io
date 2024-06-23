import { Button, Flex, Modal } from "antd";
import { useChaifenTitle } from "~/atoms";
import Debugger from "~/components/Debugger";

export default function Assembly() {
  useChaifenTitle("编码");
  return (
    <Flex vertical gap="middle">
      <Debugger />
    </Flex>
  );
}
