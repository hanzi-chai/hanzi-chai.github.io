import { useState } from "react";
import styled from "styled-components";
import { useClassifier, useForm } from "./context";
import Char from "./Char";
import { ConfigProvider, Flex, Pagination } from "antd";
import { Component, Glyph } from "../lib/data";
import { makeSequenceFilter } from "../lib/form";

const Content = styled(Flex)`
  padding: 8px;
  border: 1px solid black;
`;

interface PoolProps {
  name?: string;
  setName: (s: string | undefined) => void;
  sequence: string;
}

const MyPagination = styled(Pagination)`
  margin: 16px 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
`;

const Pool = ({ name, setName, sequence }: PoolProps) => {
  const form = useForm();
  const classifier = useClassifier();
  const content = Object.entries(form)
    .filter(makeSequenceFilter(classifier, sequence))
    .map(([x]) => x);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const range = content
    .sort((a, b) => a.length - b.length)
    .slice((page - 1) * pageSize, page * pageSize);
  return (
    <>
      <Content wrap="wrap">
        {range.map((x) => (
          <Char
            key={x}
            onClick={() => {
              x === name ? setName(undefined) : setName(x);
            }}
            type={x === name ? "primary" : "default"}
          >
            {x}
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
