import { useContext, useState } from "react";
import styled from "styled-components";
import { ConfigContext, WenContext, ZiContext } from "./Context";
import Char from "./Char";
import { Component } from "../lib/data";
import { reverseClassifier } from "../lib/utils";
import { Config } from "../lib/config";
import { Pagination } from "antd";

const Content = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  border: 1px solid black;
  padding: 8px;
  margin: 16px 0;
`;

interface PoolProps {
  type: "component" | "compound";
  name?: string;
  setName: (s: string | undefined) => void;
  sequence: string;
}

export const makeSequenceFilter = (
  classifier: Config["classifier"],
  sequence: string,
) => {
  const reversedClassifier = reverseClassifier(classifier);
  return ([x, v]: [string, Component]) => {
    const fullSequence = v.shape[0].glyph
      .map((s) => s.feature)
      .map((x) => reversedClassifier.get(x)!)
      .join("");
    return fullSequence.search(sequence) !== -1;
  };
};

const Pool = ({ type, name, setName, sequence }: PoolProps) => {
  const wen = useContext(WenContext);
  const zi = useContext(ZiContext);
  const { classifier } = useContext(ConfigContext);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(200);
  const content =
    type === "component"
      ? Object.entries(wen).filter(makeSequenceFilter(classifier, sequence))
      : Object.entries(zi);
  const range = content
    .sort((a, b) => a[0].length - b[0].length)
    .slice((page - 1) * pageSize, page * pageSize);
  return (
    <>
      <Content>
        {range.map(([x, v]) => (
          <Char key={x} name={x} current={x === name} change={setName} />
        ))}
      </Content>
      <Pagination
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
