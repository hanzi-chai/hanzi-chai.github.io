import { useState } from "react";
import { Button, Flex, Modal } from "antd";
import EncoderGraph from "~/components/EncoderGraph";
import { ReactFlowProvider } from "reactflow";
import { useChaifenTitle } from "~/components/Utils";
import WordRules from "~/components/WordRules";
import SequenceTable from "~/components/SequenceTable";

const ConfigureRules = () => {
  const [modal, setModal] = useState(0);
  return (
    <Flex gap="middle" justify="center">
      <Button onClick={() => setModal(1)}>配置一字词规则</Button>
      <Button onClick={() => setModal(2)}>配置多字词规则</Button>
      <Modal
        title="一字词全码"
        open={modal === 1}
        footer={null}
        onCancel={() => setModal(0)}
        width={1080}
      >
        <div style={{ height: "70vh" }}>
          <ReactFlowProvider>
            <EncoderGraph />
          </ReactFlowProvider>
        </div>
      </Modal>
      <Modal
        title="多字词全码"
        open={modal === 2}
        footer={null}
        onCancel={() => setModal(0)}
      >
        <WordRules />
      </Modal>
    </Flex>
  );
};

export default function () {
  useChaifenTitle("编码");
  return (
    <Flex vertical gap="middle">
      <ConfigureRules />
      <SequenceTable />
    </Flex>
  );
}
