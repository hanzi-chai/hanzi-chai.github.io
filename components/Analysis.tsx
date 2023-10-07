import styled from "styled-components";
import StrokeSearch from "./StrokeSearch";
import {
  Button,
  Col,
  Dropdown,
  Empty,
  Input,
  Menu,
  Pagination,
  Row,
  Select,
  Space,
  Spin,
  Steps,
  Table,
  Typography,
} from "antd";
import { BorderOutlined, AppstoreOutlined } from "@ant-design/icons";

export const Toolbar = styled.div`
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
import { useContext, useEffect, useState } from "react";
import { ArrowRightOutlined } from "@ant-design/icons";
import {
  ConfigContext,
  DispatchContext,
  WenContext,
  WriteContext,
  YinContext,
  ZiContext,
  useElement,
  useIndex,
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
import {
  Classifier,
  Config,
  ElementResult,
  PhoneticConfig,
  PhoneticElement,
  RootConfig,
  SieveName,
} from "../lib/config";
import { intersection, isEmpty } from "underscore";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import ConfigItem from "./ConfigItem";
import { Wen, Yin, Zi } from "../lib/data";
import analyzers from "../lib/pinyin";
import { ColumnsType } from "antd/es/table";
import { sieveMap } from "../lib/selector";

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

export const getRoot = (wen: Wen, zi: Zi, yin: Yin, root: RootConfig) => {
  const componentResults = disassembleComponents(wen, root);
  const compoundResults = disassembleCompounds(zi, root, componentResults);
  const value = {} as Record<string, Record<string, string>>;
  const semy = (l: string[]) =>
    l.length <= 3 ? l : l.slice(0, 2).concat(l[l.length - 1]);
  for (const char in yin) {
    let list;
    if (componentResults[char]) {
      const c = componentResults[char];
      list = semy(c.best);
    } else if (compoundResults[char]) {
      const c = compoundResults[char];
      list = semy(c.sequence);
    } else {
      list = ["1"];
    }
    value[char] = {
      "字根 1": list[0],
      "字根 2": list[1],
      "字根 3": list[2],
    };
  }
  return value;
  // write({ index, value });
};

const RootAnalysis = () => {
  const [sequence, setSequence] = useState("");
  const [step, setStep] = useState(0 as 0 | 1);
  const [componentResults, setComponentResult] = useState(
    {} as Record<string, ComponentResult>,
  );
  const [compoundResults, setCompoundResult] = useState(
    {} as Record<string, CompoundResult>,
  );
  const wen = useWenCustomized();
  const zi = useContext(ZiContext);
  const yin = useContext(YinContext);
  const rootConfig = useRoot();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const index = useIndex();
  const dispatch = useContext(DispatchContext);

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
    analysis: { classifier, selector },
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
    <Row>
      <Col span={8}>
        <Typography.Title level={2}>字形分析</Typography.Title>
        {selector.map((element) => {
          return (
            <SelectWithDelete key={element}>
              <Select
                value={element}
                style={{ width: "120px" }}
                options={[...sieveMap.keys()].map((x) => ({
                  value: x,
                  label: x,
                }))}
              />
              <Button
                onClick={() => {
                  dispatch({
                    type: "selector",
                    element: index,
                    subtype: "remove",
                    name: element,
                  });
                }}
              >
                删除
              </Button>
            </SelectWithDelete>
          );
        })}
        <Dropdown
          menu={{
            items: ([...sieveMap.keys()] as SieveName[])
              .filter((x) => !selector.includes(x))
              .map((x) => ({
                key: x,
                label: x,
                onClick: () => {
                  dispatch({
                    type: "selector",
                    element: index,
                    subtype: "add",
                    name: x,
                  });
                },
              })),
          }}
        >
          <Button
            type="primary"
            style={{ display: "block", margin: "0 auto" }}
            disabled={selector.length === [...sieveMap.keys()].length}
          >
            添加
          </Button>
        </Dropdown>
      </Col>
      <Col span={16}>
        <Typography.Title level={2}>分析结果</Typography.Title>
        <Toolbar>
          <StrokeSearch sequence={sequence} setSequence={setSequence} />
          <Button
            type="primary"
            onClick={() => {
              const s1 = disassembleComponents(wen, rootConfig);
              const s2 = disassembleCompounds(zi, rootConfig, s1);
              setComponentResult(s1);
              setCompoundResult(s2);
            }}
          >
            计算
          </Button>
          <Button onClick={() => setComponentResult({})}>清空</Button>
          <Button onClick={() => exportResult(componentResults)}>导出</Button>
        </Toolbar>
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
      </Col>
    </Row>
  );
};

const Wrapper = styled(Row)``;

export const getPhonetic = (yin: Yin, config: PhoneticConfig) => {
  const value = {} as Record<string, ElementResult>;
  for (const [char, pinyins] of Object.entries(yin)) {
    value[char] = {};
    const onepinyin = pinyins[0]; // todo: support 多音字
    for (const node of config.nodes) {
      value[char][node] = analyzers[node](onepinyin);
    }
  }
  return value;
};

const SelectWithDelete = styled.div`
  display: flex;
  justify-content: space-around;
  margin: 16px;
`;

const PhoneticAnalysis = () => {
  const phonetic = usePhonetic();
  const index = useIndex();
  const write = useContext(WriteContext);
  const yin = useContext(YinContext);
  const dispatch = useContext(DispatchContext);
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
    <Wrapper>
      <Col span={8}>
        <Typography.Title level={2}>字音分析</Typography.Title>
        {phonetic.nodes.map((element) => {
          return (
            <SelectWithDelete key={element}>
              <Select
                value={element}
                style={{ width: "120px" }}
                options={Object.keys(analyzers).map((x) => ({
                  value: x,
                  label: x,
                }))}
              />
              <Button
                onClick={() => {
                  dispatch({
                    type: "phonetic",
                    element: index,
                    subtype: "remove",
                    name: element,
                  });
                }}
              >
                删除
              </Button>
            </SelectWithDelete>
          );
        })}
        <Dropdown
          menu={{
            items: (Object.keys(analyzers) as PhoneticElement[])
              .filter((x) => !phonetic.nodes.includes(x))
              .map((x) => ({
                key: x,
                label: x,
                onClick: () => {
                  dispatch({
                    type: "phonetic",
                    element: index,
                    subtype: "add",
                    name: x,
                  });
                },
              })),
          }}
        >
          <Button
            type="primary"
            style={{ display: "block", margin: "0 auto" }}
            disabled={phonetic.nodes.length === Object.keys(analyzers).length}
          >
            添加
          </Button>
        </Dropdown>
      </Col>
      {/* {type === "custom" && (
        <ConfigItem label="正则表达式">
          <Input style={{ width: "120px" }} />
        </ConfigItem>
      )} */}
      <Col span={16}>
        <Typography.Title level={2}>分析结果</Typography.Title>
        <Toolbar>
          <Button
            type="primary"
            onClick={() => {
              const value = getPhonetic(yin, phonetic);
              setResult(value);
              // write({ index, value });
            }}
          >
            计算
          </Button>
        </Toolbar>
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
      </Col>
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
