import { useState } from "react";
import styled from "styled-components";
import Char from "./Char";
import { Flex, Pagination, Popover } from "antd";
import {
  useAtomValue,
  configFormAtom,
  customFormAtom,
  sequenceAtom,
  displayAtom,
} from "~/atoms";
import { isPUA } from "~/lib/utils";
import { ComponentView, CompoundView } from "./GlyphView";
import StrokeSearch, { makeFilter } from "./GlyphSearch";

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
  const configForm = useAtomValue(configFormAtom);
  const { mapping, grouping } = configForm;
  const form = useAtomValue(customFormAtom);
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
  if (isPUA(x)) {
    const component = form[x]?.component;
    const compound = form[x]?.compound;
    const preview =
      component !== undefined ? (
        <ComponentView component={component} />
      ) : compound !== undefined ? (
        <CompoundView compound={compound} />
      ) : null;
    return (
      <Popover content={<div style={{ width: "200px" }}>{preview}</div>}>
        {core}
      </Popover>
    );
  }
  return core;
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
  const form = useAtomValue(customFormAtom);
  const filtered = strokeFilter
    ? content.filter(
        (x) =>
          makeFilter(sequence, form, sequenceMap)(x) &&
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
