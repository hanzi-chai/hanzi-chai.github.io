import { useState } from "react";
import styled from "styled-components";
import Char from "./Char";
import { ConfigProvider, Flex, Pagination } from "antd";
import { useGenericConfig } from "./context";

const Content = styled(Flex)`
  padding: 8px;
  border: 1px solid black;
`;

interface PoolProps {
  element?: string;
  setElement: (s: string | undefined) => void;
  content: string[];
  specialRendering?: (s: string) => string;
}

const MyPagination = styled(Pagination)`
  margin: 16px 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
`;

const ElementPool = ({
  element,
  setElement,
  content,
  specialRendering,
}: PoolProps) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const range = content.slice((page - 1) * pageSize, page * pageSize);
  const { mapping, grouping } = useGenericConfig();
  const type = (x: string) =>
    x === element ? "primary" : mapping[x] || grouping[x] ? "link" : "default";
  return (
    <>
      <Content wrap="wrap">
        {range.map((x) => (
          <Char
            key={x}
            onClick={() => {
              x === element ? setElement(undefined) : setElement(x);
            }}
            type={type(x)}
          >
            {specialRendering ? specialRendering(x) : x}
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

export default ElementPool;
