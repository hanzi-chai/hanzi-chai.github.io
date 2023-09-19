import styled from "styled-components";
import StrokeSearch from "./StrokeSearch";
import { Button, Space, Spin, Table } from "antd";

const Toolbar = styled.div`
  display: flex;
  justify-content: center;
  gap: 32px;
  align-self: center;
  margin: 32px 0;
`;

import { Collapse } from "antd";
import Char from "./Char";
import Root from "./Root";
import ResultDetail from "./ResultDetail";
import { useContext, useState } from "react";
import { ArrowRightOutlined } from "@ant-design/icons";
import { ConfigContext, DataContext } from "./Context";
import chai, { ComponentResult, SchemeWithData } from "../lib/chai";
import { Component, Database } from "../lib/data";
import { Config } from "../lib/config";
import { reverseClassifier } from "../lib/utils";

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
`;

const ResultSummary = ({
  componentName,
  rootSeries,
}: {
  componentName: string;
  rootSeries: string[];
}) => {
  return (
    <SummaryContainer>
      <Char name={componentName} current={false} change={() => {}} />
      <Arrow>
        <ArrowRightOutlined />
      </Arrow>
      {rootSeries.map((x, index) => (
        <Root name={x} key={index} />
      ))}
    </SummaryContainer>
  );
};

const CollapseCustom = styled(Collapse)`
  margin: 32px 0;

  & .ant-collapse-header {
    align-items: center !important;
  }
  & .ant-collapse-content-box {
    padding: 0 32px !important;
  }
`;

const exportResult = (result: Record<string, ComponentResult>) => {
  const fileContent = JSON.stringify(result);
  const blob = new Blob([fileContent], { type: "text/plain" });
  const a = document.createElement("a");
  a.download = `result.json`;
  a.href = window.URL.createObjectURL(blob);
  a.click();
};

const Result = () => {
  const [sequence, setSequence] = useState("");
  const [result, setResult] = useState({} as Record<string, ComponentResult>);
  const [loading, setLoading] = useState(false);
  const data = useContext(DataContext);
  const config = useContext(ConfigContext);

  const makeSequenceFilter = (
    classifier: Config["classifier"],
    sequence: string,
  ) => {
    const reversedClassifier = reverseClassifier(classifier);
    return (x: string) => {
      const v = data[x];
      const fullSequence = v.shape[0].glyph
        .map((s) => s.feature)
        .map((x) => reversedClassifier.get(x)!)
        .join("");
      return fullSequence.search(sequence) !== -1;
    };
  };

  const filter = makeSequenceFilter(config.classifier, sequence);

  return (
    <>
      <Toolbar>
        <StrokeSearch sequence={sequence} setSequence={setSequence} />
        <Button
          type="primary"
          disabled={loading}
          onClick={() => {
            setLoading(true);
            const res = chai(data, config);
            setResult(res);
            setLoading(false);
          }}
        >
          计算
        </Button>
        <Button onClick={() => setResult({})}>清空</Button>
        <Button onClick={() => exportResult(result)}>导出</Button>
      </Toolbar>
      {loading ? (
        <Space size="large">
          <Spin size="large" />
        </Space>
      ) : (
        <CollapseCustom
          items={Object.entries(result)
            .filter(([x, v]) => filter(x))
            .map(([key, res]) => {
              return {
                key,
                label: (
                  <ResultSummary componentName={key} rootSeries={res.best} />
                ),
                children: <ResultDetail data={res.schemes} map={res.map} />,
              };
            })}
          accordion={true}
          bordered={false}
          size={"small"}
          defaultActiveKey={["1"]}
        />
      )}
    </>
  );
};

export default Result;
