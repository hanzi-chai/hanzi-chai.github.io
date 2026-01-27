import type { FC } from "react";
import { useState } from "react";
import styled from "styled-components";
import Char from "./Character";
import { Button, Flex, Modal, Pagination, Tooltip, Typography } from "antd";
import {
  useAtomValue,
  如字库原子,
  如笔顺映射原子,
  别名显示原子,
  键盘原子,
  useAtomValueUnwrapped,
} from "~/atoms";
import StrokeSearch from "./CharacterSearch";
import type { ShapeElementTypes } from "./ElementPicker";
import Classifier from "./Classifier";
import { Display } from "./Utils";
import Element from "./Element";
import { 是私用区 } from "~/lib";
import { 字符过滤器 } from "~/utils";

const Content = styled(Flex)`
  padding: 8px;
  border: 1px solid black;
  width: 100%;
`;

interface PoolProps {
  element?: string;
  setElement: (s: string | undefined) => void;
  content: string[];
  name: ShapeElementTypes | string;
}

interface ElementProps {
  element: string;
  setElement?: (s: string | undefined) => void;
  currentElement?: string;
}

export const ElementWithTooltip = ({ element }: { element: string }) => {
  const display = useAtomValue(别名显示原子);
  const core = (
    <Element onClick={() => navigator.clipboard.writeText(element)}>
      <Display name={element} />
    </Element>
  );
  if (!是私用区(element)) return core;
  return <Tooltip title={display(element)}>{core}</Tooltip>;
};

export const CharWithTooltip: FC<ElementProps> = ({
  element: x,
  setElement,
  currentElement,
}) => {
  const keyboard = useAtomValue(键盘原子);
  const { mapping } = keyboard;
  const type =
    x === currentElement ? "primary" : mapping[x] ? "link" : "default";
  const display = useAtomValue(别名显示原子);
  const core = (
    <Char
      onClick={() => setElement?.(x === currentElement ? undefined : x)}
      type={type}
    >
      <Display name={x} />
    </Char>
  );
  const codepoint = x.codePointAt(0)!.toString(16);
  const title = 是私用区(x) ? `${display(x)} ${codepoint}` : codepoint;
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
  const determinedRepertoire = useAtomValueUnwrapped(如字库原子);
  const [isOpen, setOpen] = useState(false);
  const 笔顺过滤 = new 字符过滤器({ sequence: input });
  const 直接过滤 = new 字符过滤器({ name: input });
  const filtered =
    name === "字根"
      ? content.filter((char) => {
          const seq = sequenceMap.get(char);
          const data = determinedRepertoire._get()[char];
          if (!seq || !data) return false;
          return (
            笔顺过滤.过滤(char, data, seq) || 直接过滤.过滤(char, data, seq)
          );
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
            key={x}
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
