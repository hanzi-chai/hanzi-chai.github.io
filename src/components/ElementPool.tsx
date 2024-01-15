import { useState } from "react";
import styled from "styled-components";
import Char from "./Character";
import { Flex, Pagination, Popover } from "antd";
import {
  useAtomValue,
  repertoireAtom,
  sequenceAtom,
  displayAtom,
  keyboardAtom,
  glyphAtom,
} from "~/atoms";
import { isPUA } from "~/lib/utils";
import { StrokesView } from "./GlyphView";
import StrokeSearch, { makeFilter } from "./CharacterSearch";

const Content = styled(Flex)`
  padding: 8px;
  border: 1px solid black;
  width: 100%;
`;

interface PoolProps {
  element?: string;
  setElement: (s: string | undefined) => void;
  content: string[];
  strokeFilter?: boolean;
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
  const determiedRepertoire = useAtomValue(repertoireAtom);
  const glyphMap = useAtomValue(glyphAtom);
  const type =
    x === currentElement
      ? "primary"
      : mapping[x] || grouping[x]
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
        <div style={{ width: "200px" }}>{<StrokesView glyph={glyph} />}</div>
      }
    >
      {core}
    </Popover>
  );
};

const MyPagination = styled(Pagination)``;

const ElementPool = ({
  element,
  setElement,
  content,
  strokeFilter,
}: PoolProps) => {
  const [page, setPage] = useState(1);
  const pageSize = 100;
  const [sequence, setSequence] = useState("");
  const sequenceMap = useAtomValue(sequenceAtom);
  const determinedRepertoire = useAtomValue(repertoireAtom);
  const filtered = strokeFilter
    ? content.filter(
        (x) =>
          makeFilter(sequence, determinedRepertoire, sequenceMap)(x) &&
          (sequenceMap.get(x)?.length ?? 0) > 1,
      )
    : content;
  const range = filtered.slice((page - 1) * pageSize, page * pageSize);
  return (
    <Flex vertical gap="middle" align="center">
      {strokeFilter && <StrokeSearch setSequence={setSequence} />}
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
};

export default ElementPool;
