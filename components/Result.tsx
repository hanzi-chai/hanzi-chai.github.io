import styled from "styled-components";
import StrokeSearch from "./StrokeSearch";
import { Button, Empty, Pagination, Space, Spin, Steps, Table } from "antd";
import { BorderOutlined, AppstoreOutlined } from "@ant-design/icons";

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
import { ConfigContext, WenContext, ZiContext } from "./Context";
import componentDisassembly, {
  ComponentResult,
  CompoundResult,
  SchemeWithData,
  compoundDisassembly,
} from "../lib/chai";
import { Component, Wen } from "../lib/data";
import { Config } from "../lib/config";
import { reverseClassifier } from "../lib/utils";
import { isEmpty } from "underscore";

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

const ChaiSteps = styled(Steps)`
  width: 400px;
  margin: 32px auto;
`;

const Result = () => {
  const [sequence, setSequence] = useState("");
  const [step, setStep] = useState(0 as 0 | 1);
  const [componentResults, setComponentResult] = useState(
    {} as Record<string, ComponentResult>,
  );
  const [compoundResults, setCompoundResult] = useState(
    {} as Record<string, CompoundResult>,
  );
  const [loading, setLoading] = useState(false);
  const wen = useContext(WenContext);
  const zi = useContext(ZiContext);
  const config = useContext(ConfigContext);
  const steps = [
    () => setComponentResult(componentDisassembly(wen, config)),
    () => setCompoundResult(compoundDisassembly(zi, config, componentResults)),
  ];
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const makeSequenceFilter = (
    classifier: Config["classifier"],
    sequence: string,
  ) => {
    const reversedClassifier = reverseClassifier(classifier);
    return (x: string) => {
      const v = wen[x];
      const fullSequence = v.shape[0].glyph
        .map((s) => s.feature)
        .map((x) => reversedClassifier.get(x)!)
        .join("");
      return fullSequence.search(sequence) !== -1;
    };
  };

  const filter = makeSequenceFilter(config.classifier, sequence);
  const displays = [
    Object.entries(componentResults)
      .filter(([x, v]) => filter(x))
      .map(([key, res]) => {
        return {
          key,
          label: <ResultSummary componentName={key} rootSeries={res.best} />,
          children: <ResultDetail data={res.schemes} map={res.map} />,
        };
      }),
    Object.entries(compoundResults).map(([key, res]) => {
      return {
        key,
        label: <ResultSummary componentName={key} rootSeries={res.sequence} />,
      };
    }),
  ];

  return (
    <>
      <ChaiSteps
        current={step}
        onChange={(e) => setStep(e as 0)}
        items={[
          { title: "部件拆分", icon: <BorderOutlined /> },
          {
            title: "复合体拆分",
            disabled: isEmpty(componentResults),
            icon: <AppstoreOutlined />,
          },
        ]}
      />
      <Toolbar>
        <StrokeSearch sequence={sequence} setSequence={setSequence} />
        <Button type="primary" disabled={loading} onClick={steps[step]}>
          计算
        </Button>
        <Button onClick={() => setComponentResult({})}>清空</Button>
        <Button onClick={() => exportResult(componentResults)}>导出</Button>
      </Toolbar>
      {loading ? (
        <Space size="large">
          <Spin size="large" />
        </Space>
      ) : displays[step].length ? (
        <>
          <CollapseCustom
            items={displays[step].slice((page - 1) * pageSize, page * pageSize)}
            accordion={true}
            bordered={false}
            size={"small"}
            defaultActiveKey={["1"]}
          />
          <Pagination
            current={page}
            onChange={(page, pageSize) => {
              setPage(page);
              setPageSize(pageSize);
            }}
            total={displays[step].length}
            pageSize={pageSize}
          />
        </>
      ) : (
        <Empty />
      )}
    </>
  );
};

export default Result;
