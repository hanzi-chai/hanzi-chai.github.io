import { useContext, useState } from "react";
import styled from "styled-components";
import { useRoot, useWenCustomized, useZiCustomized } from "./Context";
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
  name?: string;
  setName: (s: string | undefined) => void;
  content: string[];
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

const Pool = ({ name, setName, content }: Omit<PoolProps, "sequence">) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const range = content
    .sort((a, b) => a.length - b.length)
    .slice((page - 1) * pageSize, page * pageSize);
  return (
    <>
      <Content>
        {range.map((x) => (
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

const ComponentPool = ({
  name,
  setName,
  sequence,
}: Omit<PoolProps, "content">) => {
  const wen = useWenCustomized();
  const content = Object.entries(wen)
    .filter(makeSequenceFilter(defaultClassifier, sequence))
    .map(([x, v]) => x);
  return <Pool name={name} setName={setName} content={content} />;
};

const SlicePool = ({ name, setName, sequence }: Omit<PoolProps, "content">) => {
  const wen = useWenCustomized();
  const { aliaser } = useRoot();
  const wenlike = Object.entries(aliaser).map(([x, v]) => {
    const parent = wen[v.source];
    const g = v.indices.map((x) => parent[x]);
    return [x, g] as [string, Glyph];
  });
  const content = wenlike
    .filter(makeSequenceFilter(defaultClassifier, sequence))
    .map(([x, v]) => x);
  return <Pool name={name} setName={setName} content={content} />;
};

const CompoundPool = ({
  name,
  setName,
  sequence,
}: Omit<PoolProps, "content">) => {
  const zi = useZiCustomized();
  const content = Object.entries(zi)
    .filter(([x, v]) => x === sequence)
    .map(([x, v]) => x);
  return <Pool name={name} setName={setName} content={content} />;
};

export { ComponentPool, SlicePool, CompoundPool };

export default Pool;
