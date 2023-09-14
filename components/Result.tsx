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
import Char from "./Char";
import Root from "./Root";
import ResultDetail, { DataType } from "./ResultDetail";
import { useState } from "react";
import { ArrowRightOutlined } from "@ant-design/icons"

const SummaryContainer = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const Arrow = styled.div`
  height: 32px;
  width: 32px;
  line-height: 32px;
  text-align: center;
`

const ResultSummary = ({ componentName, rootSeries }: { componentName: string, rootSeries: string[] }) => {
  return <SummaryContainer>
    <Char name={componentName} current={false} change={() => {}}/>
    <Arrow>
      <ArrowRightOutlined />
    </Arrow>
    { rootSeries.map(x => <Root name={x} key={x}/>)}
  </SummaryContainer>
}

const data: DataType[] = [
  {
    key: "1",
    roots: ["一", "大"],
    order: [1, 2, 3, 4],
    numberOfCrosses: 0,
    numberOfAttaches: 1,
    sizes: [1, 3]
  },
  {
    key: "2",
    roots: ["二", "人"],
    order: [1, 2, 3, 4],
    numberOfCrosses: 1,
    numberOfAttaches: 0,
    sizes: [2, 2]
  },
  {
    key: "3",
    roots: ["一", "一", "人"],
    order: [1, 2, 3, 4],
    numberOfCrosses: 1,
    numberOfAttaches: 1,
    sizes: [1, 1, 2]
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
    children: <ResultDetail data={data}/>,
  },
];

const CollapseCustom = styled(Collapse)`
  & .ant-collapse-header {
    align-items: center !important;
  }
  & .ant-collapse-content-box {
    padding: 0 32px !important;
  }
`

const Result = () => {
  const [sequence, setSequence] = useState("");
  return <>
    <Toolbar>
      <StrokeSearch sequence={sequence} setSequence={setSequence}/>
      <Button type="primary">计算</Button>
      <Button>导出</Button>
    </Toolbar>
    <CollapseCustom items={items} accordion={true} bordered={false} size={"small"} defaultActiveKey={['1']} />
  </>
}

export default Result;
