import { useState } from "react";
import styled from "styled-components";
import Char from "./Character";
import { Button, Flex, Modal, Pagination, Popover, Typography } from "antd";
import {
  useAtomValue,
  repertoireAtom,
  sequenceAtom,
  displayAtom,
  keyboardAtom,
  glyphAtom,
} from "~/atoms";
import { isPUA, makeFilter } from "~/lib";
import { StrokesView } from "./GlyphView";
import StrokeSearch from "./CharacterSearch";
import type { ShapeElementTypes } from "./ElementPicker";
import type { PronunciationElementTypes } from "~/lib";
import Classifier from "./Classifier";

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

const Element = ({
  element: x,
  setElement,
  currentElement,
}: {
  element: string;
  setElement: (s: string | undefined) => void;
  currentElement?: string;
}) => {
  const keyboard = useAtomValue(keyboardAtom);
  const { mapping, grouping } = keyboard;
  const glyphMap = useAtomValue(glyphAtom);
  const type =
    x === currentElement
      ? "primary"
      : mapping[x] || grouping?.[x]
        ? "link"
        : "default";
  const display = useAtomValue(displayAtom);
  const core = (
    <Char
      onClick={() => setElement(x === currentElement ? undefined : x)}
      type={type}
    >
      {display(x)}
    </Char>
  );
  if (!isPUA(x)) return core;
  const glyph = glyphMap.get(x);
  if (glyph === undefined) return core;
  return (
    <Popover
      content={
        <div style={{ width: "200px" }}>
          <StrokesView glyph={glyph} />
        </div>
      }
    >
      {core}
    </Popover>
  );
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
          <Element
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
