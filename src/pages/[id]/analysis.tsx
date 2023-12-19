import StrokeSearch from "~/components/StrokeSearch";
import {
  Alert,
  Button,
  Dropdown,
  Empty,
  Flex,
  Pagination,
  Radio,
  Space,
  Typography,
  notification,
} from "antd";

import {
  useAtomValue,
  configFormAtom,
  useAll,
  useForm,
  useDisplay,
} from "~/atoms";
import { Collapse } from "antd";
import Char from "~/components/Char";
import Root from "~/components/Root";
import ResultDetail from "~/components/ResultDetail";
import { useState } from "react";

import type { ComponentCache, ComponentResult } from "~/lib/component";
import { getSequence } from "~/lib/component";
import type { CompoundCache, CompoundResult } from "~/lib/compound";
import { getFormCore } from "~/lib/form";
import { EditorColumn, EditorRow, exportJSON } from "~/components/Utils";
import Selector from "~/components/Selector";
import AnalysisCustomizer from "~/components/AnalysisCustomizer";
import type { MenuProps } from "rc-menu";
import Degenerator from "~/components/Degenerator";
import { useChaifenTitle } from "~/lib/hooks";
import classifier from "~/lib/classifier";

const ResultSummary = ({
  char,
  rootSeries,
  overrideRootSeries,
}: {
  char: string;
  rootSeries: string[];
  overrideRootSeries?: string[];
}) => {
  const display = useDisplay();
  return (
    <Flex gap="middle">
      <Space>
        <Char>{display(char)}</Char>
        {rootSeries.map((x, index) => (
          <Root key={index}>{display(x)}</Root>
        ))}
      </Space>
      {overrideRootSeries && (
        <Space>
          <span>（自定义：）</span>
          {overrideRootSeries.map((x, index) => (
            <Root key={index}>{display(x)}</Root>
          ))}
        </Space>
      )}
    </Flex>
  );
};

const Analysis = () => {
  useChaifenTitle("分析");
  const [sequence, setSequence] = useState("");
  const [step, setStep] = useState(0 as 0 | 1);
  const [componentCache, setComponentCache] = useState<ComponentCache>(
    new Map(),
  );
  const [componentCustomizations, setComponentCustomizations] =
    useState<ComponentCache>(new Map());
  const [compoundCache, setCompoundCache] = useState<CompoundCache>(new Map());
  const [error, setError] = useState({
    componentError: [] as string[],
    compoundError: [] as string[],
  });
  const data = useAll();
  const form = useForm();

  const formConfig = useAtomValue(configFormAtom);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const display = useDisplay();

  const displays = [
    [...componentCache]
      .filter(([x]) => getSequence(form, classifier, x).startsWith(sequence))
      .filter(([, v]) => v.sequence.length > 1)
      .map(([key, res]) => {
        return {
          key,
          label: (
            <ResultSummary
              char={key}
              rootSeries={res.sequence}
              overrideRootSeries={componentCustomizations.get(key)?.sequence}
            />
          ),
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
    [...compoundCache]
      .filter(([x]) => getSequence(form, classifier, x).startsWith(sequence))
      .map(([key, res]) => {
        return {
          key,
          label: <ResultSummary char={key} rootSeries={res.sequence} />,
        };
      }),
  ] as const;

  return (
    <EditorRow>
      <EditorColumn span={8}>
        <Typography.Title level={2}>分析</Typography.Title>
        <Degenerator />
        <Selector />
        <Typography.Title level={3}>自定义部件分析</Typography.Title>
        <AnalysisCustomizer />
      </EditorColumn>
      <EditorColumn span={16}>
        <Typography.Title level={2}>分析结果</Typography.Title>
        {error.componentError.length + error.compoundError.length > 0 ? (
          <Alert
            message="有些部件或复合体拆分时出错，请检查"
            description={`部件：${error.componentError
              .map(display)
              .join("、")}\n复合体：${error.compoundError
              .map(display)
              .join("、")}`}
            type="warning"
            showIcon
            closable
          />
        ) : null}
        <Flex gap="middle">
          <StrokeSearch sequence={sequence} setSequence={setSequence} />
          <Button
            type="primary"
            onClick={() => {
              const {
                componentCache,
                componentError,
                customizations,
                compoundCache,
                compoundError,
              } = getFormCore(data, formConfig);
              setComponentCache(componentCache);
              setComponentCustomizations(customizations);
              setCompoundCache(compoundCache);
              setError({
                componentError,
                compoundError,
              });
            }}
          >
            计算
          </Button>
          <Button
            onClick={() => {
              setComponentCache(new Map());
              setCompoundCache(new Map());
            }}
          >
            清空
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
  );
};

export default Analysis;
