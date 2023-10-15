import StrokeSearch from "./StrokeSearch";
import {
  Button,
  Dropdown,
  Empty,
  Flex,
  Layout,
  Menu,
  Pagination,
  Radio,
  Space,
  Table,
  Typography,
} from "antd";

import { Collapse } from "antd";
import Char from "./Char";
import Root from "./Root";
import ResultDetail from "./ResultDetail";
import { useContext, useState } from "react";
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
  ElementCache,
  ElementResult,
  RootConfig,
  SieveName,
} from "../lib/config";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import analyzers, { getPhonetic } from "../lib/pinyin";
import { ColumnsType } from "antd/es/table";
import { sieveMap } from "../lib/selector";
import { EditorColumn, EditorRow, Select } from "./Utils";

const ResultSummary = ({
  componentName,
  rootSeries,
}: {
  componentName: string;
  rootSeries: string[];
}) => {
  return (
    <Space>
      <Char>{componentName}</Char>
      {rootSeries.map((x, index) => (
        <Root key={index}>{x}</Root>
      ))}
    </Space>
  );
};

const exportResult = (result: Record<string, ComponentResult>) => {
  const fileContent = JSON.stringify(result);
  const blob = new Blob([fileContent], { type: "text/plain" });
  const a = document.createElement("a");
  a.download = `result.json`;
  a.href = window.URL.createObjectURL(blob);
  a.click();
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
        <Flex vertical gap="small">
          {selector.map((sieve) => {
            return (
              <Flex key={sieve} justify="space-evenly">
                <Select
                  value={sieve}
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
              </Flex>
            );
          })}
          <Flex justify="center">
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
          </Flex>
        </Flex>
      </EditorColumn>
      <EditorColumn span={16}>
        <Typography.Title level={2}>分析结果</Typography.Title>
        <Flex gap="middle">
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
        </Flex>
        <Flex justify="center">
          <Radio.Group
            value={step}
            onChange={(e) => setStep(e.target.value as 0)}
          >
            <Radio.Button value={0}>部件拆分</Radio.Button>
            <Radio.Button value={1}>复合体拆分</Radio.Button>
          </Radio.Group>
        </Flex>
        {displays[step].length ? (
          <>
            <Collapse
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
  const [result, setResult] = useState<ElementCache>({});
  const columns: ColumnsType<{ char: string }> = [
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
          options={Object.keys(analyzers).map((x) => ({
            value: x,
            label: x,
          }))}
        />
      </EditorColumn>
      <EditorColumn span={16}>
        <Typography.Title level={2}>分析结果</Typography.Title>
        <Flex>
          <Button
            type="primary"
            onClick={() => {
              const value = getPhonetic(
                Object.keys(data.characters),
                data,
                phonetic,
              );
              setResult(value);
              // write({ index, value });
            }}
          >
            计算
          </Button>
        </Flex>
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
    <Layout style={{ flex: 1 }}>
      <Layout.Sider theme="light">
        <Menu
          items={elements.map(({ type }, index) => ({
            key: index.toString(),
            label: `元素 ${index}: ${type}`,
          }))}
          selectedKeys={[index.toString()]}
          onClick={(e) => {
            navigate(e.key);
          }}
        />
      </Layout.Sider>
      <div style={{ padding: "0 32px", height: "100%", flex: 1 }}>
        <Outlet />
      </div>
    </Layout>
  );
};

export default Analysis;
