import styled from "styled-components";
import StrokeSearch from "./StrokeSearch";
import { Button, Table } from "antd";

const Toolbar = styled.div`
  display: flex;
  justify-content: center;
  gap: 32px;
  align-self: center;
  margin: 32px 0;
`;

import type { CollapseProps } from 'antd';
import { Collapse } from 'antd';
import { Char } from "./Pool";
import { Root } from "./RootsList";
import ResultDetail, { DataType } from "./ResultDetail";

const text = (
  <p style={{ paddingLeft: 24 }}>
    A dog is a type of domesticated animal. Known for its loyalty and faithfulness, it can be found
    as a welcome guest in many households across the world.
  </p>
);

const SummaryContainer = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`

const ResultSummary = ({ componentName, rootSeries }: { componentName: string, rootSeries: string[] }) => {
  return <SummaryContainer>
    <Char>{ componentName }</Char>
    <Char>⇒</Char>
    { rootSeries.map(x => <Root>{ x }</Root>)}
  </SummaryContainer>
}

const data: DataType[] = [
  {
    key: "1",
    roots: ["一", "大"],
  },
  {
    key: "2",
    roots: ["二", "人"],
  },
  {
    key: "3",
    roots: ["一", "一", "人"],
  },
];

const items: CollapseProps['items'] = [
  {
    key: '1',
    label: <ResultSummary componentName="天" rootSeries={["一", "大"]} />,
    children: <ResultDetail data={data}/>,
  },
  {
    key: '2',
    label: <ResultSummary componentName="夫" rootSeries={["二", "人"]} />,
    children: text,
  },
];

const Result = () => {
  return <>
    <Toolbar>
      <StrokeSearch />
      <Button>计算</Button>
      <Button>导出</Button>
    </Toolbar>
    <Collapse items={items} bordered={false} defaultActiveKey={['1']} />
  </>
}

export default Result;
