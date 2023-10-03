import { useContext, useState } from "react";
import styled from "styled-components";
import { ConfigContext, WenContext, ZiContext } from "./Context";
import Char from "./Char";
import { Classifier, Config, RootConfig } from "../lib/config";
import { Pagination } from "antd";
import defaultClassifier from "../templates/classifier.yaml";
import { Glyph } from "../lib/data";

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
  classifier?: Classifier;
  name?: string;
  setName: (s: string | undefined) => void;
  sequence: string;
}

export const makeSequenceFilter = (
  classifier: Classifier,
  sequence: string,
) => {
  return ([x, v]: [string, Glyph]) => {
    const fullSequence = v
      .map((s) => s.feature)
      .map((x) => classifier[x])
      .join("");
    return fullSequence.search(sequence) !== -1;
  };
};

const Pool = ({ classifier, type, name, setName, sequence }: PoolProps) => {
  const wen = useContext(WenContext);
  const zi = useContext(ZiContext);
  let c = classifier || (defaultClassifier as Classifier);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(200);
  const content =
    type === "component"
      ? Object.entries(wen).filter(makeSequenceFilter(c, sequence))
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
