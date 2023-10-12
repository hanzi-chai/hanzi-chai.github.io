import styled from "styled-components";
import StrokeSearch from "./StrokeSearch";
import {
  Button,
  Dropdown,
  Empty,
  Menu,
  Pagination,
  Select,
  Steps,
  Table,
  Typography,
} from "antd";
import { BorderOutlined, AppstoreOutlined } from "@ant-design/icons";

import { Collapse } from "antd";
import Char from "./Char";
import Root from "./Root";
import ResultDetail from "./ResultDetail";
import { useContext, useState } from "react";
import { ArrowRightOutlined } from "@ant-design/icons";
import {
  ConfigContext,
  DispatchContext,
  useClassifier,
  useElement,
  useIndex,
  usePhonetic,
  useRoot,
  useComponents,
  useAll,
} from "./context";
import {
  ComponentResult,
  CompoundResult,
  disassembleComponents,
  disassembleCompounds,
} from "../lib/root";
import {
  Classifier,
  ElementResult,
  RootConfig,
  SieveName,
} from "../lib/config";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import analyzers, { getPhonetic } from "../lib/pinyin";
import { ColumnsType } from "antd/es/table";
import { sieveMap } from "../lib/selector";
import { FlexContainer, EditorColumn, EditorRow, Switcher } from "./Utils";

const ResultSummary = ({
  componentName,
  rootSeries,
}: {
  componentName: string;
  rootSeries: string[];
}) => {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <FlexContainer>
        <Char name={componentName} current={false} change={() => {}} />
        {rootSeries.map((x, index) => (
          <Root key={index}>{x}</Root>
        ))}
      </FlexContainer>
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
  const components = useComponents();
  const classifier = useClassifier();
  const data = useAll();
  const rootConfig = useRoot();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const index = useIndex();
  const dispatch = useContext(DispatchContext);

  const makeSequenceFilter = (classifier: Classifier, sequence: string) => {
    return (x: string) => {
      const v = components[x];
      const fullSequence = v
        .map((s) => s.feature)
        .map((x) => classifier[x])
        .join("");
      return fullSequence.search(sequence) !== -1;
    };
  };

  const {
    analysis: { selector },
  } = useElement() as RootConfig;
  const filter = makeSequenceFilter(classifier, sequence);
  const displays = [
    Object.entries(componentResults)
      .filter(([x]) => filter(x))
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
    <EditorRow>
      <EditorColumn span={8}>
        <Typography.Title level={2}>字形分析</Typography.Title>
        {selector.map((sieve) => {
          return (
            <FlexContainer key={sieve}>
              <Select
                value={sieve}
                style={{ width: "120px" }}
                options={[...sieveMap.keys()].map((x) => ({
                  value: x,
                  label: x,
                }))}
              />
              <Button
                onClick={() => {
                  dispatch({
                    type: "element",
                    index,
                    subtype: "root-selector",
                    action: "remove",
                    value: sieve,
                  });
                }}
              >
                删除
              </Button>
            </FlexContainer>
          );
        })}
        <FlexContainer>
          <Dropdown
            menu={{
              items: ([...sieveMap.keys()] as SieveName[])
                .filter((x) => !selector.includes(x))
                .map((sieve) => ({
                  key: sieve,
                  label: sieve,
                  onClick: () => {
                    dispatch({
                      type: "element",
                      index: index,
                      subtype: "root-selector",
                      action: "add",
                      value: sieve,
                    });
                  },
                })),
            }}
          >
            <Button
              type="primary"
              disabled={selector.length === [...sieveMap.keys()].length}
            >
              添加
            </Button>
          </Dropdown>
        </FlexContainer>
      </EditorColumn>
      <EditorColumn span={16}>
        <Typography.Title level={2}>分析结果</Typography.Title>
        <FlexContainer>
          <StrokeSearch sequence={sequence} setSequence={setSequence} />
          <Button
            type="primary"
            onClick={() => {
              const s1 = disassembleComponents(data, rootConfig);
              const s2 = disassembleCompounds(data, rootConfig, s1);
              setComponentResult(s1);
              setCompoundResult(s2);
            }}
          >
            计算
          </Button>
          <Button onClick={() => setComponentResult({})}>清空</Button>
          <Button onClick={() => exportResult(componentResults)}>导出</Button>
        </FlexContainer>
        <ChaiSteps
          current={step}
          onChange={(e) => setStep(e as 0)}
          items={[
            { title: "部件拆分", icon: <BorderOutlined />, status: "finish" },
            {
              title: "复合体拆分",
              icon: <AppstoreOutlined />,
              status: "finish",
            },
          ]}
        />
        {displays[step].length ? (
          <>
            <CollapseCustom
              items={displays[step].slice(
                (page - 1) * pageSize,
                page * pageSize,
              )}
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
      </EditorColumn>
    </EditorRow>
  );
};

const PhoneticAnalysis = () => {
  const phonetic = usePhonetic();
  const data = useAll();
  const [result, setResult] = useState({} as Record<string, ElementResult>);
  const columns: ColumnsType<Record<string, string>> = [
    {
      title: "汉字",
      dataIndex: "char",
      key: "char",
    },
  ].concat(
    phonetic.nodes.map((x) => ({
      title: x,
      dataIndex: x,
      key: x,
    })),
  );

  return (
    <EditorRow>
      <EditorColumn span={8}>
        <Typography.Title level={2}>字音分析</Typography.Title>
        <Select
          value={phonetic.nodes[0]}
          style={{ width: "120px" }}
          options={Object.keys(analyzers).map((x) => ({
            value: x,
            label: x,
          }))}
        />
      </EditorColumn>
      <EditorColumn span={16}>
        <Typography.Title level={2}>分析结果</Typography.Title>
        <FlexContainer>
          <Button
            type="primary"
            onClick={() => {
              const value = getPhonetic(data, phonetic);
              setResult(value);
              // write({ index, value });
            }}
          >
            计算
          </Button>
        </FlexContainer>
        <Table
          columns={columns}
          dataSource={Object.entries(result).map(([k, v]) => ({
            key: k,
            char: k,
            ...v,
          }))}
          pagination={{ pageSize: 50, hideOnSinglePage: true }}
          size="small"
        />
      </EditorColumn>
    </EditorRow>
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
