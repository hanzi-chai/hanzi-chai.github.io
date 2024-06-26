import { Suspense, useState } from "react";
import { Button, Flex, Modal, Skeleton } from "antd";
import EncoderGraph from "~/components/EncoderGraph";
import { ReactFlowProvider } from "reactflow";
import WordRules from "~/components/WordRules";
import SequenceTable from "~/components/SequenceTable";
import ShortCodeRules from "~/components/ShortCodeRules";
import { useChaifenTitle } from "~/atoms";
import SelectRules from "~/components/SelectRules";

const ConfigureRules = () => {
  const [modal, setModal] = useState(0);
  return (
    <Flex gap="middle" justify="center">
      <Button onClick={() => setModal(1)}>配置一字词规则</Button>
      <Button onClick={() => setModal(2)}>配置多字词规则</Button>
      <Button onClick={() => setModal(3)}>配置选择规则</Button>
      <Button onClick={() => setModal(4)}>配置简码规则</Button>
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
      <Modal
        title="选择规则"
        open={modal === 3}
        footer={null}
        onCancel={() => setModal(0)}
      >
        <SelectRules />
      </Modal>
      <Modal
        title="简码规则"
        open={modal === 4}
        footer={null}
        onCancel={() => setModal(0)}
      >
        <ShortCodeRules />
      </Modal>
    </Flex>
  );
};

export default function Assembly() {
  useChaifenTitle("编码");
  return (
    <Flex vertical gap="middle">
      <ConfigureRules />
      <Suspense fallback={<Skeleton active />}>
        <SequenceTable />
      </Suspense>
    </Flex>
  );
}
