import { useState } from "react";
import styled from "styled-components";
import Char from "./Char";
import { Flex, Pagination, Popover } from "antd";
import { useAtomValue, configFormAtom, useDisplay, useForm } from "~/atoms";
import { isPUA } from "~/lib/utils";
import { ComponentView } from "./GlyphView";

const Content = styled(Flex)`
  padding: 8px;
  border: 1px solid black;
`;

interface PoolProps {
  element?: string;
  setElement: (s: string | undefined) => void;
  content: string[];
}

const MyPagination = styled(Pagination)`
  margin: 16px 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
`;

const PUADisplay = () => {};

const ElementPool = ({ element, setElement, content }: PoolProps) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const range = content.slice((page - 1) * pageSize, page * pageSize);
  const configForm = useAtomValue(configFormAtom);
  const { mapping, grouping } = configForm;
  const type = (x: string) =>
    x === element ? "primary" : mapping[x] || grouping[x] ? "link" : "default";
  const display = useDisplay();
  const form = useForm();
  return (
    <>
      <Content wrap="wrap">
        {range.map((x) => {
          const core = (
            <Char
              key={x}
              onClick={() => {
                x === element ? setElement(undefined) : setElement(x);
              }}
              type={type(x)}
            >
              {display(x)}
            </Char>
          );
          const maybeGlyph = form[x];
          if (isPUA(x) && maybeGlyph !== undefined) {
            const { component } = maybeGlyph;
            if (component) {
              return (
                <Popover
                  key={x}
                  content={
                    <div style={{ width: "200px" }}>
                      <ComponentView component={component} />
                    </div>
                  }
                >
                  {core}
                </Popover>
              );
            }
          }
          return core;
        })}
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
