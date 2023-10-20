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
import { useClassifier, useRoot, useComponents, useAll } from "./context";
import {
  ComponentResult,
  CompoundResult,
  disassembleComponents,
  disassembleCompounds,
} from "../lib/form";
import { Classifier } from "../lib/config";
import { EditorColumn, EditorRow, Select } from "./Utils";
import Selector from "./Selector";

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

const Analysis = () => {
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

  const filter = makeSequenceFilter(classifier, sequence);
  const displays = [
    Object.entries(componentResults)
      .filter(([x]) => filter(x))
      .map(([key, res]) => {
        return {
          key,
          label: (
            <ResultSummary componentName={key} rootSeries={res.sequence} />
          ),
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
        <Selector />
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

export default Analysis;
