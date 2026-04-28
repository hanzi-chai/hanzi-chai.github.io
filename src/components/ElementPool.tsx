import { Button, Flex, Modal, Pagination, Tooltip, Typography } from "antd";
import type { FC } from "react";
import { useState } from "react";
import styled from "styled-components";
import {
  useAtomValue,
  useAtomValueUnwrapped,
  别名显示原子,
  原始字库原子,
  原始字库数据原子,
  如笔顺映射原子,
  键盘原子,
} from "~/atoms";
import type { 字符 } from "~/lib";
import { 字符过滤器 } from "~/utils";
import Element from "./BorderItem";
import StrokeSearch from "./CharacterSearch";
import Classifier from "./Classifier";
import Item from "./Item";
import { Display } from "./Utils";

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

interface ElementProps {
  element: string | 字符;
  setElement?: (s: string | 字符 | undefined) => void;
  currentElement?: string | 字符;
}

export const ElementWithTooltip = ({ element }: { element: 字符 | string }) => {
  const display = useAtomValue(别名显示原子);
  const core = (
    <Element onClick={() => navigator.clipboard.writeText(element.toString())}>
      {typeof element === "string" ? element : <Display name={element} />}
    </Element>
  );
  if (typeof element === "string" || !element.是私用区()) return core;
  return <Tooltip title={display(element)}>{core}</Tooltip>;
};

export const CharWithTooltip: FC<ElementProps> = ({
  element,
  setElement,
  currentElement,
}) => {
  const keyboard = useAtomValue(键盘原子);
  const { mapping } = keyboard;
  const type =
    element === currentElement
      ? "primary"
      : mapping[element.toString()]
        ? "link"
        : "default";
  const display = useAtomValue(别名显示原子);
  if (typeof element === "string") return element;
  const core = (
    <Item
      onClick={() =>
        setElement?.(element === currentElement ? undefined : element)
      }
      type={type}
    >
      {<Display name={element} />}
    </Item>
  );
  const title = element.是私用区()
    ? `${display(element)} ${element.toNumber().toString(16)}`
    : element.toNumber().toString(16);
  return <Tooltip title={title}>{core}</Tooltip>;
};

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
          <CharWithTooltip
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
