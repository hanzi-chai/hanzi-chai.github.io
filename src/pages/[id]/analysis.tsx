import {
  Alert,
  Button,
  Col,
  Empty,
  Flex,
  Modal,
  Pagination,
  Radio,
  Row,
  Space,
  Statistic,
  Switch,
} from "antd";
import {
  useAtomValue,
  sequenceAtom,
  displayAtom,
  repertoireAtom,
  configAtom,
  useAtom,
  useChaifenTitle,
  customizeAtom,
} from "~/atoms";
import { Collapse } from "antd";
import ResultDetail from "~/components/ResultDetail";
import { useState } from "react";
import type { ComponentResults, AnalysisResult } from "~/lib";
import type { CompoundResults } from "~/lib";
import { analysis, exportTSV } from "~/lib";
import Selector from "~/components/Selector";
import Degenerator from "~/components/Degenerator";
import CharacterQuery, {
  CharacterFilter,
  makeCharacterFilter,
} from "~/components/CharacterQuery";
import { analysisResultAtom } from "~/atoms/cache";
import ResultSummary from "~/components/ResultSummary";

const dumpAnalysisResult = (
  characters: string[],
  a: AnalysisResult,
  display: (s: string) => string,
) => {
  const { customized, compoundResults } = a;
  const tsv = characters.map((char) => {
    const analysis = customized.get(char) ?? compoundResults.get(char);
    if (!analysis) {
      return [char, ""];
    } else {
      return [char, analysis.sequence.map(display).join(" ")];
    }
  });
  exportTSV(tsv, "拆分结果.txt");
};

const ConfigureRules = () => {
  const [modal, setModal] = useState(0);
  return (
    <Flex gap="middle" justify="center">
      <Button onClick={() => setModal(1)}>配置字根认同规则</Button>
      <Button onClick={() => setModal(2)}>配置拆分方式筛选规则</Button>
      <Modal
        title=""
        open={modal === 1}
        footer={null}
        onCancel={() => setModal(0)}
      >
        <Degenerator />
      </Modal>
      <Modal
        title=""
        open={modal === 2}
        footer={null}
        onCancel={() => setModal(0)}
      >
        <Selector />
      </Modal>
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
  const componentResults: ComponentResults =
    analysisResult?.componentResults ?? new Map();
  const compoundResults: CompoundResults =
    analysisResult?.compoundResults ?? new Map();
  const componentError = analysisResult?.componentError ?? [];
  const compoundError = analysisResult?.compoundError ?? [];
  const characters = Object.entries(repertoire)
    .filter(([, v]) => v.tygf > 0)
    .map(([x]) => x);

  const config = useAtomValue(configAtom);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const display = useAtomValue(displayAtom);
  const customize = useAtomValue(customizeAtom);
  const filterFn = makeCharacterFilter(filter, repertoire, sequenceMap);

  const [customizedOnly, setCustomizedOnly] = useState(false);
  const componentsNeedAnalysis = [...componentResults].filter(
    ([, v]) => v.sequence.length > 1,
  );
  const componentDisplay = componentsNeedAnalysis
    .filter(([x]) => !customizedOnly || customize[x])
    .filter(([x]) => filterFn(x))
    .map(([key, res]) => {
      return {
        key,
        label: <ResultSummary char={key} rootSeries={res.sequence} />,
        children:
          "schemes" in res ? (
            <ResultDetail
              char={key}
              data={res.schemes}
              map={res.map}
              strokes={res.strokes}
            />
          ) : null,
      };
    });
  const compoundDisplay = [...compoundResults]
    .filter(([x]) => filterFn(x))
    .map(([key, res]) => {
      return {
        key,
        label: (
          <ResultSummary
            char={key}
            rootSeries={res.sequence}
            disableCustomize
          />
        ),
      };
    });

  const displays = [componentDisplay, compoundDisplay] as const;

  return (
    <Flex vertical align="center" gap="middle" style={{ padding: "0 2rem" }}>
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
        <ConfigureRules />
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
        <Button
          disabled={!analysisResult}
          onClick={() =>
            dumpAnalysisResult(characters, analysisResult!, display)
          }
        >
          导出
        </Button>
      </Flex>
      <CharacterQuery setFilter={setFilter} />
      {step === 0 && (
        <Row style={{ width: "80%", alignItems: "center" }}>
          <Col span={5}>
            <Statistic title="总部件数" value={componentResults.size} />
          </Col>
          <Col span={5}>
            <Statistic
              title="需拆分部件数"
              value={componentsNeedAnalysis.length}
            />
          </Col>
          <Col span={5}>
            <Statistic
              title="自动拆分部件数"
              value={
                componentsNeedAnalysis.length &&
                componentsNeedAnalysis.length - Object.keys(customize).length
              }
            />
          </Col>
          <Col span={5}>
            <Statistic
              title="自定义部件数"
              value={Object.keys(customize).length}
            />
          </Col>
          <Col span={4}>
            <Space>
              <span>只显示自定义</span>
              <Switch
                checked={customizedOnly}
                onChange={() => setCustomizedOnly((x) => !x)}
              />
            </Space>
          </Col>
        </Row>
      )}
      {displays[step].length ? (
        <>
          <Collapse
            items={displays[step].slice((page - 1) * pageSize, page * pageSize)}
            accordion={true}
            size="small"
            style={{ alignSelf: "stretch", fontSize: "2em" }}
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
    </Flex>
  );
};

export default Analysis;
