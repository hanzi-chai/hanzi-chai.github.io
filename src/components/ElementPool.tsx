import { Button, Flex, Modal, Pagination, Typography } from "antd";
import { useState } from "react";
import styled from "styled-components";
import {
  useAtomValue,
  useAtomValueUnwrapped,
  原始字库原子,
  如笔顺映射原子,
} from "~/atoms";
import type { 字符 } from "hanzi-chai";
import { 字符过滤器 } from "~/utils";
import StrokeSearch from "./CharacterSearch";
import Classifier from "./Classifier";
import { CharacterWithTooltip } from "./Utils";

const Content = styled(Flex)`
  padding: 8px;
  border: 1px solid black;
  width: 100%;
`;

interface PoolProps {
  element?: string | 字符;
  setElement: (s: string | 字符 | undefined) => void;
  content: string[] | 字符[];
  name: string;
}

const MyPagination = styled(Pagination)``;

export default function ElementPool({
  element,
  setElement,
  content,
  name,
}: PoolProps) {
  const [page, setPage] = useState(1);
  const pageSize = 100;
  const [input, setInput] = useState("");
  const sequenceMap = useAtomValueUnwrapped(如笔顺映射原子);
  const determinedRepertoire = useAtomValue(原始字库原子);
  const [isOpen, setOpen] = useState(false);
  const 笔顺过滤 = new 字符过滤器({ sequence: input });
  const 直接过滤 = new 字符过滤器({ name: input });
  const filtered =
    name === "字根"
      ? content.filter((char) => {
          const ch = char as 字符;
          const seq = sequenceMap.get(ch);
          const data = determinedRepertoire.查询(ch);
          if (!seq || !data) return false;
          return 笔顺过滤.过滤(ch, data, seq) || 直接过滤.过滤(ch, data, seq);
        })
      : content;
  const range = filtered.slice((page - 1) * pageSize, page * pageSize);
  return (
    <Flex vertical gap="middle" align="center">
      {name === "字根" && <StrokeSearch setSequence={setInput} />}
      {name === "笔画" && (
        <>
          <Typography.Text>
            您需要首先将笔画分为若干个类别，然后将代表类别的数字放到键盘上。
          </Typography.Text>
          <Button onClick={() => setOpen(true)}>配置笔画分类</Button>
          <Modal
            open={isOpen}
            title="笔画分类"
            footer={false}
            onCancel={() => setOpen(false)}
          >
            <Classifier />
          </Modal>
        </>
      )}
      <Content wrap="wrap">
        {range.map((x) => (
          <CharacterWithTooltip
            key={JSON.stringify(x)}
            element={x}
            currentElement={element}
            setElement={setElement}
          />
        ))}
      </Content>
      {filtered.length > pageSize && (
        <MyPagination
          current={page}
          onChange={(page) => {
            setPage(page);
          }}
          showSizeChanger={false}
          total={filtered.length}
          pageSize={pageSize}
        />
      )}
    </Flex>
  );
}
