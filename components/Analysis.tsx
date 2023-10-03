import styled from "styled-components";
import StrokeSearch from "./StrokeSearch";
import {
  Button,
  Empty,
  Input,
  Menu,
  Pagination,
  Select,
  Space,
  Spin,
  Steps,
  Table,
} from "antd";
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
import {
  ConfigContext,
  WenContext,
  YinContext,
  ZiContext,
  useElement,
  usePhonetic,
  useRoot,
  useWenCustomized,
} from "./Context";
import {
  ComponentResult,
  CompoundResult,
  SchemeWithData,
  disassembleComponents,
  disassembleCompounds,
} from "../lib/root";
import { Classifier, Config, RootConfig } from "../lib/config";
import { intersection, isEmpty } from "underscore";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import ConfigItem from "./ConfigItem";

const ExtraContainer = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

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
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <SummaryContainer>
        <Char name={componentName} current={false} change={() => {}} />
        <Arrow>
          <ArrowRightOutlined />
        </Arrow>
        {rootSeries.map((x, index) => (
          <Root name={x} key={index} />
        ))}
      </SummaryContainer>
    </div>
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

const RootAnalysis = () => {
  const [sequence, setSequence] = useState("");
  const [step, setStep] = useState(0 as 0 | 1);
  const [componentResults, setComponentResult] = useState(
    {} as Record<string, ComponentResult>,
  );
  const [compoundResults, setCompoundResult] = useState(
    {} as Record<string, CompoundResult>,
  );
  const [loading, setLoading] = useState(false);
  const wen = useWenCustomized();
  const zi = useContext(ZiContext);
  const rootConfig = useRoot();
  const steps = [
    () => setComponentResult(disassembleComponents(wen, rootConfig)),
    () =>
      setCompoundResult(disassembleCompounds(zi, rootConfig, componentResults)),
  ];
  // const componentResults = disassembleComponents(wen, rootConfig);
  // const compoundResults = disassembleCompounds(
  //   zi,
  //   rootConfig,
  //   componentResults,
  // );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const makeSequenceFilter = (classifier: Classifier, sequence: string) => {
    return (x: string) => {
      const v = wen[x];
      const fullSequence = v
        .map((s) => s.feature)
        .map((x) => classifier[x])
        .join("");
      return fullSequence.search(sequence) !== -1;
    };
  };

  const {
    analysis: { classifier },
  } = useElement() as RootConfig;
  const filter = makeSequenceFilter(classifier, sequence);
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

const Wrapper = styled.div`
  width: 300px;
  align-self: center;
`;

const PhoneticAnalysis = () => {
  const {
    analysis: { type, regex },
  } = usePhonetic();
  const options = ["initial", "final", "sheng", "yun", "diao", "custom"];

  return (
    <Wrapper>
      <ConfigItem label="类型">
        <Select
          value={type}
          style={{ width: "120px" }}
          options={options.map((x) => ({ value: x, label: x }))}
        />
      </ConfigItem>
      {type === "custom" && (
        <ConfigItem label="正则表达式">
          <Input style={{ width: "120px" }} />
        </ConfigItem>
      )}
    </Wrapper>
  );
};

const AnalysisDispatch = () => {
  const element = useElement();
  if (element === undefined) return <></>;
  switch (element.type) {
    case "字根":
      return <RootAnalysis />;
    case "字音":
      return <PhoneticAnalysis />;
  }
};

export { AnalysisDispatch };

const Switcher = styled(Menu)`
  justify-content: center;
  margin: 32px;
`;

const Analysis = () => {
  const { elements } = useContext(ConfigContext);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const index = parseInt(pathname.split("/")[3] || "-1");
  return (
    <>
      <Switcher
        items={elements.map(({ type }, index) => ({
          key: index.toString(),
          label: `元素 ${index}: ${type}`,
        }))}
        mode="horizontal"
        selectedKeys={[index.toString()]}
        onClick={(e) => {
          navigate(e.key);
        }}
      />
      <Outlet />
    </>
  );
};

export default Analysis;
