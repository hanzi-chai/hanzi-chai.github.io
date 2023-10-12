import { useState } from "react";
import styled from "styled-components";
import {
  useClassifier,
  useComponents,
  useSlices,
  useCompounds,
} from "./context";
import Char from "./Char";
import { Pagination } from "antd";
import { Glyph } from "../lib/data";
import { makeSequenceFilter } from "../lib/root";
import { FlexContainer } from "./Utils";

const Content = styled(FlexContainer)`
  padding: 8px;
  gap: 0;
  border: 1px solid black;
`;

interface PoolProps {
  name?: string;
  setName: (s: string | undefined) => void;
  content: string[];
  sequence: string;
}

const MyPagination = styled(Pagination)`
  margin: 16px 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
`;

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

const ComponentPool = ({
  name,
  setName,
  sequence,
}: Omit<PoolProps, "content">) => {
  const components = useComponents();
  const classifier = useClassifier();
  const content = Object.entries(components)
    .filter(makeSequenceFilter(classifier, sequence))
    .map(([x]) => x);
  return <Pool name={name} setName={setName} content={content} />;
};

const SlicePool = ({ name, setName, sequence }: Omit<PoolProps, "content">) => {
  const components = useComponents();
  const classifier = useClassifier();
  const slices = useSlices();
  const componentslike = Object.entries(slices).map(([x, v]) => {
    const parent = components[v.source];
    const g = v.indices.map((x) => parent[x]);
    return [x, g] as [string, Glyph];
  });
  const content = componentslike
    .filter(makeSequenceFilter(classifier, sequence))
    .map(([x]) => x);
  return <Pool name={name} setName={setName} content={content} />;
};

const CompoundPool = ({
  name,
  setName,
  sequence,
}: Omit<PoolProps, "content">) => {
  const compounds = useCompounds();
  const content = Object.entries(compounds)
    .filter(([x]) => x === sequence)
    .map(([x]) => x);
  return <Pool name={name} setName={setName} content={content} />;
};

export { ComponentPool, SlicePool, CompoundPool };

export default Pool;
