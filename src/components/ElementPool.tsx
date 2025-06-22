import type { FC } from "react";
import { useState } from "react";
import styled from "styled-components";
import Char from "./Character";
import { Button, Flex, Modal, Pagination, Tooltip, Typography } from "antd";
import {
  useAtomValue,
  repertoireAtom,
  sequenceAtom,
  displayAtom,
  keyboardAtom,
} from "~/atoms";
import { isPUA, makeFilter } from "~/lib";
import StrokeSearch from "./CharacterSearch";
import type { ShapeElementTypes } from "./ElementPicker";
import type { PronunciationElementTypes } from "~/lib";
import Classifier from "./Classifier";
import { Display } from "./Utils";
import Element from "./Element";

const Content = styled(Flex)`
  padding: 8px;
  border: 1px solid black;
  width: 100%;
`;

interface PoolProps {
  element?: string;
  setElement: (s: string | undefined) => void;
  content: string[];
  name: ShapeElementTypes | PronunciationElementTypes | string;
}

interface ElementProps {
  element: string;
  setElement?: (s: string | undefined) => void;
  currentElement?: string;
}

export const ElementWithTooltip = ({ element }: { element: string }) => {
  const display = useAtomValue(displayAtom);
  const core = (
    <Element>
      <Display name={element} />
    </Element>
  );
  if (!isPUA(element)) return core;
  return <Tooltip title={display(element)}>{core}</Tooltip>;
};

export const CharWithTooltip: FC<ElementProps> = ({
  element: x,
  setElement,
  currentElement,
}) => {
  const keyboard = useAtomValue(keyboardAtom);
  const { mapping, grouping } = keyboard;
  const type =
    x === currentElement
      ? "primary"
      : mapping[x] || grouping?.[x]
        ? "link"
        : "default";
  const display = useAtomValue(displayAtom);
  const core = (
    <Char
      onClick={() => setElement?.(x === currentElement ? undefined : x)}
      type={type}
    >
      <Display name={x} />
    </Char>
  );
  if (!isPUA(x)) return core;
  return <Tooltip title={display(x)}>{core}</Tooltip>;
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
  const [sequence, setSequence] = useState("");
  const sequenceMap = useAtomValue(sequenceAtom);
  const determinedRepertoire = useAtomValue(repertoireAtom);
  const filter = makeFilter(sequence, determinedRepertoire, sequenceMap);
  const filtered = name === "字根" ? content.filter(filter) : content;
  const range = filtered.slice((page - 1) * pageSize, page * pageSize);
  const [isOpen, setOpen] = useState(false);
  return (
    <Flex vertical gap="middle" align="center">
      {name === "字根" && <StrokeSearch setSequence={setSequence} />}
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
      {content.length > pageSize && (
        <MyPagination
          current={page}
          onChange={(page) => {
            setPage(page);
          }}
          showSizeChanger={false}
          total={content.length}
          pageSize={pageSize}
        />
      )}
    </Flex>
  );
}
