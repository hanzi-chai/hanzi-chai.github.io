import {
  Alert,
  Button,
  Empty,
  Flex,
  Pagination,
  Radio,
  Space,
  Typography,
} from "antd";
import {
  useAtomValue,
  sequenceAtom,
  displayAtom,
  repertoireAtom,
  configAtom,
  useAtom,
} from "~/atoms";
import { Collapse } from "antd";
import Char from "~/components/Character";
import Root from "~/components/Element";
import ResultDetail from "~/components/ResultDetail";
import { useState } from "react";

import type { ComponentCache, ComponentResult } from "~/lib/component";
import type { CompoundCache, CompoundResult } from "~/lib/compound";
import { analysis } from "~/lib/repertoire";
import { EditorColumn, EditorRow, exportJSON } from "~/components/Utils";
import Selector from "~/components/Selector";
import AnalysisCustomizer from "~/components/AnalysisCustomizer";
import Degenerator from "~/components/Degenerator";
import { useChaifenTitle } from "~/lib/hooks";
import CharacterQuery, {
  CharacterFilter,
  makeCharacterFilter,
} from "~/components/CharacterQuery";
import { analysisResultAtom } from "~/atoms/cache";

const ResultSummary = ({
  char,
  rootSeries,
  overrideRootSeries,
}: {
  char: string;
  rootSeries: string[];
  overrideRootSeries?: string[];
}) => {
  const display = useAtomValue(displayAtom);
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
  useChaifenTitle("拆分");
  const [filter, setFilter] = useState<CharacterFilter>({});
  const [step, setStep] = useState(0 as 0 | 1);
  const repertoire = useAtomValue(repertoireAtom);
  const sequenceMap = useAtomValue(sequenceAtom);
  const [analysisResult, setAnalysisResult] = useAtom(analysisResultAtom);
  const componentCache: ComponentCache =
    analysisResult?.componentCache ?? new Map();
  const compoundCache: CompoundCache =
    analysisResult?.compoundCache ?? new Map();
  const componentCustomizations: ComponentCache =
    analysisResult?.customizations ?? new Map();
  const componentError = analysisResult?.componentError ?? [];
  const compoundError = analysisResult?.compoundError ?? [];

  const config = useAtomValue(configAtom);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const display = useAtomValue(displayAtom);
  const filterFn = makeCharacterFilter(filter, repertoire, sequenceMap);

  const displays = [
    [...componentCache]
      .filter(([x]) => filterFn(x))
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
      .filter(([x]) => filterFn(x))
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
        <Typography.Title level={2}>规则</Typography.Title>
        <Degenerator />
        <Selector />
        <Typography.Title level={3}>自定义部件拆分</Typography.Title>
        <Typography.Paragraph>
          此处只能自定义部件拆分，复合体的拆分无法自定义。如需改变复合体的拆分结果，请在字形数据中改变它的分部方式。
        </Typography.Paragraph>
        <AnalysisCustomizer />
      </EditorColumn>
      <EditorColumn span={16}>
        <Typography.Title level={2}>拆分结果</Typography.Title>
        {componentError.length + compoundError.length > 0 ? (
          <Alert
            message="有些部件或复合体拆分时出错，请检查"
            description={`部件：${componentError
              .map(display)
              .join("、")}\n复合体：${compoundError.map(display).join("、")}`}
            type="warning"
            showIcon
            closable
          />
        ) : null}
        <Flex gap="middle" justify="center" style={{ marginBottom: "16px" }}>
          <Radio.Group
            value={step}
            onChange={(e) => setStep(e.target.value as 0)}
            style={{ minWidth: "200px" }}
          >
            <Radio.Button value={0}>部件拆分</Radio.Button>
            <Radio.Button value={1}>复合体拆分</Radio.Button>
          </Radio.Group>
          <Button
            type="primary"
            onClick={() => setAnalysisResult(analysis(repertoire, config))}
          >
            计算
          </Button>
        </Flex>
        <CharacterQuery setFilter={setFilter} />
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
