import StrokeSearch from "~/components/StrokeSearch";
import {
  Button,
  Dropdown,
  Empty,
  Flex,
  Pagination,
  Radio,
  Space,
  Typography,
} from "antd";

import { Collapse } from "antd";
import Char from "~/components/Char";
import Root from "~/components/Root";
import ResultDetail from "~/components/ResultDetail";
import { useState } from "react";
import { useFormConfig } from "~/components/context";
import {
  useAll,
  useForm,
  useClassifier,
  useDisplay,
} from "~/components/contants";
import type {
  ComponentCache,
  ComponentResult,
  CompoundCache,
  CompoundResult,
} from "~/lib/form";
import { getFormCore, getSequence } from "~/lib/form";
import { EditorColumn, EditorRow, exportJSON } from "~/components/Utils";
import Selector from "~/components/Selector";
import AnalysisCustomizer from "~/components/AnalysisCustomizer";
import type { MenuProps } from "rc-menu";

const ResultSummary = ({
  char,
  rootSeries,
}: {
  char: string;
  rootSeries: string[];
}) => {
  const display = useDisplay();
  return (
    <Space>
      <Char>{display(char)}</Char>
      {rootSeries.map((x, index) => (
        <Root key={index}>{display(x)}</Root>
      ))}
    </Space>
  );
};

const AnalysisExporter = ({
  componentResults,
  compoundResults,
}: {
  componentResults: ComponentCache;
  compoundResults: CompoundCache;
}) => {
  const items: MenuProps["items"] = [
    { label: "不含结构数据", key: "sequence" },
    { label: "含结构数据", key: "all" },
  ];
  return (
    <Dropdown
      menu={{
        items,
        onClick: (info) => {
          const allResult = [...componentResults, ...compoundResults] as [
            string,
            ComponentResult & CompoundResult,
          ][];
          const output = Object.fromEntries(
            allResult.map(([x, v]) => [x, info.key === "all" ? v : v.sequence]),
          );
          exportJSON(output, "chai.json");
        },
      }}
    >
      <Button>导出拆分结果</Button>
    </Dropdown>
  );
};

const Analysis = () => {
  const [sequence, setSequence] = useState("");
  const [step, setStep] = useState(0 as 0 | 1);
  const [componentResults, setComponentResult] = useState<ComponentCache>(
    new Map(),
  );
  const [compoundResults, setCompoundResult] = useState<CompoundCache>(
    new Map(),
  );
  const classifier = useClassifier();
  const data = useAll();
  const form = useForm();
  const formConfig = useFormConfig();
  const display = useDisplay();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const roots = Object.keys(formConfig.mapping).concat(
    Object.keys(formConfig.grouping),
  );
  const rootsRef = Object.fromEntries(
    roots.map((x) => {
      return [x, display(x)];
    }),
  );

  const displays = [
    [...componentResults]
      .filter(([x]) => getSequence(form, classifier, x).startsWith(sequence))
      .map(([key, res]) => {
        return {
          key,
          label: <ResultSummary char={key} rootSeries={res.sequence} />,
          children:
            "schemes" in res ? (
              <ResultDetail
                data={res.schemes}
                map={res.map}
                strokes={res.strokes}
              />
            ) : null,
        };
      }),
    [...compoundResults]
      .filter(([x]) => getSequence(form, classifier, x).startsWith(sequence))
      .map(([key, res]) => {
        return {
          key,
          label: <ResultSummary char={key} rootSeries={res.sequence} />,
        };
      }),
  ] as const;

  return (
    <div style={{ padding: "16px", flex: "1", overflowY: "scroll" }}>
      <EditorRow>
        <EditorColumn span={8}>
          <Typography.Title level={2}>字形分析</Typography.Title>
          <Selector />
          <Typography.Title level={2}>自定义分析</Typography.Title>
          <Typography.Title level={3}>部件</Typography.Title>
          <AnalysisCustomizer />
        </EditorColumn>
        <EditorColumn span={16}>
          <Typography.Title level={2}>分析结果</Typography.Title>
          <Flex gap="middle">
            <StrokeSearch sequence={sequence} setSequence={setSequence} />
            <Button
              type="primary"
              onClick={() => {
                const [componentResults, compoundResults] = getFormCore(
                  data,
                  formConfig,
                );
                setComponentResult(componentResults);
                setCompoundResult(compoundResults);
              }}
            >
              计算
            </Button>
            <Button
              onClick={() => {
                setComponentResult(new Map());
                setCompoundResult(new Map());
              }}
            >
              清空
            </Button>
            <AnalysisExporter
              componentResults={componentResults}
              compoundResults={compoundResults}
            />
            <Button
              onClick={() => {
                exportJSON(rootsRef, "roots.json");
              }}
            >
              导出字根对照表
            </Button>
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
                size="small"
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
    </div>
  );
};

export default Analysis;
