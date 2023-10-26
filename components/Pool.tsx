import { useState } from "react";
import styled from "styled-components";
import { useClassifier, useForm } from "./context";
import Char from "./Char";
import { ConfigProvider, Flex, Pagination } from "antd";
import { Component, Glyph } from "../lib/data";
import { getSequence, makeSequenceFilter } from "../lib/form";

const Content = styled(Flex)`
  padding: 8px;
  border: 1px solid black;
`;

interface PoolProps {
  char?: string;
  setChar: (s: string | undefined) => void;
  sequence: string;
}

const MyPagination = styled(Pagination)`
  margin: 16px 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
`;

const Pool = ({ char, setChar, sequence }: PoolProps) => {
  const form = useForm();
  const classifier = useClassifier();
  const content = Object.keys(form)
    .filter((x) => {
      const thisSequence = getSequence(form, classifier, x);
      return thisSequence.length > 1 && thisSequence.startsWith(sequence);
    })
    .sort(
      (x, y) =>
        getSequence(form, classifier, x).length -
        getSequence(form, classifier, y).length,
    );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const range = content.slice((page - 1) * pageSize, page * pageSize);
  return (
    <>
      <Content wrap="wrap">
        {range.map((x) => (
          <Char
            key={x}
            onClick={() => {
              x === char ? setChar(undefined) : setChar(x);
            }}
            type={x === char ? "primary" : "default"}
          >
            {form[x].name || x}
          </Char>
        ))}
      </Content>
      <MyPagination
        current={page}
        onChange={(page, pageSize) => {
          setPage(page);
          setPageSize(pageSize);
        }}
        total={content.length}
        pageSize={pageSize}
        pageSizeOptions={[50, 100, 200, 300]}
      />
    </>
  );
};

export default Pool;
