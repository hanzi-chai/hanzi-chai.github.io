import {
  Alert,
  Button,
  Col,
  Flex,
  Modal,
  notification,
  Pagination,
  Radio,
  Row,
  Skeleton,
  Space,
  Statistic,
  Switch,
} from "antd";
import {
  useAtomValue,
  sequenceAtom,
  displayAtom,
  repertoireAtom,
  useChaifenTitle,
  customizeAtom,
  charactersAtom,
  mappingAtom,
  groupingAtom,
  analysisConfigAtom,
  adaptedFrequencyAtom,
  dictionaryAtom,
  algebraAtom,
  mappingTypeAtom,
  mappingSpaceAtom,
} from "~/atoms";
import { Collapse } from "antd";
import ResultDetail from "~/components/ResultDetail";
import { Suspense, useState } from "react";
import type { AnalysisResult, CharacterFilter } from "~/lib";
import {
  dynamicAnalysis,
  exportTSV,
  exportYAML,
  makeCharacterFilter,
} from "~/lib";
import Selector from "~/components/Selector";
import Degenerator from "~/components/Degenerator";
import CharacterQuery from "~/components/CharacterQuery";
import { analysisResultAtom } from "~/atoms";
import ResultSummary from "~/components/ResultSummary";
import { Display } from "~/components/Utils";

const dumpAnalysisResult = (
  characters: string[],
  a: AnalysisResult,
  display: (s: string) => string,
) => {
  const { customized, compoundResults } = a;
  const stat = new Map<number, number>();
  const tsv = characters.map((char) => {
    const analysis = customized.get(char) ?? compoundResults.get(char);
    if (!analysis) {
      return [char, ""];
    }
    const length = Math.min(analysis.sequence.length, 5);
    stat.set(length, (stat.get(length) ?? 0) + 1);
    return [char, analysis.sequence.map(display).join(" ")];
  });
  console.log("拆分结果统计：", Object.fromEntries(stat));
  exportTSV(tsv, "拆分结果.txt");
};

const ConfigureRules = () => {
  const [modal, setModal] = useState(0);
  return (
    <Flex gap="middle" justify="center">
      <Degenerator />
      <Button onClick={() => setModal(2)}>配置拆分方式筛选规则</Button>
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

const AnalysisResults = ({ filter }: { filter: CharacterFilter }) => {
  const [step, setStep] = useState(0 as 0 | 1);
  const repertoire = useAtomValue(repertoireAtom);
  const sequenceMap = useAtomValue(sequenceAtom);
  const analysisResult = useAtomValue(analysisResultAtom);
  const { componentResults, compoundResults, componentError, compoundError } =
    analysisResult;
  const adaptedFrequency = useAtomValue(adaptedFrequencyAtom);
  const dictionary = useAtomValue(dictionaryAtom);
  const algebra = useAtomValue(algebraAtom);
  const characters = useAtomValue(charactersAtom);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const display = useAtomValue(displayAtom);
  const customize = useAtomValue(customizeAtom);
  const mapping = useAtomValue(mappingAtom);
  const grouping = useAtomValue(groupingAtom);
  const mappingSpace = useAtomValue(mappingSpaceAtom);
  const filterFn = makeCharacterFilter(filter, repertoire, sequenceMap);
  const analysisConfig = useAtomValue(analysisConfigAtom);

  const [customizedOnly, setCustomizedOnly] = useState(false);
  const componentsNeedAnalysis = [...componentResults].filter(([k, v]) => {
    if (mappingSpace[k]?.some((x) => x.value == null)) return true;
    if (mapping[k] || grouping[k]) return false;
    if (v.sequence.length === 1 && /\d+/.test(v.sequence[0]!)) return false;
    return true;
  });
  const componentDisplay = componentsNeedAnalysis
    .filter(([x]) => !customizedOnly || customize[x])
    .filter(([x]) => filterFn(x))
    .map(([key, res]) => {
      return {
        key,
        label: <ResultSummary char={key} analysis={res} />,
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
        label: <ResultSummary char={key} analysis={res} disableCustomize />,
      };
    });

  const displays = [componentDisplay, compoundDisplay] as const;
  return (
    <>
      {componentError.length + compoundError.length > 0 ? (
        <Alert
          message="有些部件或复合体拆分时出错，请检查"
          description={
            <>
              <p>
                部件：
                {componentError.map((x, i) => (
                  <Display key={i} name={x} />
                ))}
              </p>
              <p>
                复合体：
                {compoundError.map((x, i) => (
                  <Display key={i} name={x} />
                ))}
                `
              </p>
            </>
          }
          type="warning"
          showIcon
          closable
        />
      ) : null}
      <Flex>
        <Radio.Group
          value={step}
          onChange={(e) => setStep(e.target.value as 0)}
          style={{ minWidth: "200px" }}
        >
          <Radio.Button value={0}>部件拆分</Radio.Button>
          <Radio.Button value={1}>复合体拆分</Radio.Button>
        </Radio.Group>
        <Button
          onClick={() =>
            dumpAnalysisResult(characters, analysisResult, display)
          }
        >
          导出完整拆分
        </Button>
        <Button
          onClick={() => {
            const result = dynamicAnalysis(
              repertoire,
              analysisConfig,
              characters,
              adaptedFrequency,
              dictionary,
              algebra,
            );
            exportYAML(result, "dynamic_analysis", 2);
          }}
        >
          导出动态拆分
        </Button>
        <Button
          onClick={() => {
            const { dynamicCustomize } = analysisConfig.analysis;
            const { primaryRoots, secondaryRoots, optionalRoots } =
              analysisConfig;
            const illegal: string[] = [];
            for (const [char, customize] of Object.entries(
              dynamicCustomize ?? {},
            )) {
              for (const method of customize) {
                const valid = method.every(
                  (x) =>
                    /\d+/.test(x) ||
                    primaryRoots.has(x) ||
                    secondaryRoots.has(x) ||
                    optionalRoots.has(x),
                );
                if (!valid) {
                  illegal.push(char);
                  break;
                }
              }
              const last = customize[customize.length - 1]!;
              const valid = last.every(
                (x) =>
                  (/\d+/.test(x) ||
                    primaryRoots.has(x) ||
                    secondaryRoots.has(x)) &&
                  !optionalRoots.has(x),
              );
              if (!valid) {
                illegal.push(char);
              }
            }
            if (illegal.length > 0) {
              notification.error({
                message: "这些字的最后一个拆分并非全部由必要字根构成",
                description: (
                  <span>
                    {illegal.map((x) => (
                      <Display key={x} name={x} />
                    ))}
                  </span>
                ),
              });
            } else {
              notification.success({
                message: "自定义动态拆分检查通过",
              });
            }
          }}
        >
          检查自定义动态拆分
        </Button>
      </Flex>
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
      <Collapse
        items={displays[step].slice((page - 1) * pageSize, page * pageSize)}
        accordion={true}
        size="small"
        style={{ alignSelf: "stretch" }}
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
  );
};

export default function Analysis() {
  useChaifenTitle("拆分");
  const [filter, setFilter] = useState<CharacterFilter>({});

  return (
    <Flex vertical align="center" gap="middle" style={{ padding: "0 2rem" }}>
      <Flex gap="middle" justify="center" style={{ marginBottom: "16px" }}>
        <ConfigureRules />
      </Flex>
      <CharacterQuery setFilter={setFilter} />
      <Suspense fallback={<Skeleton active />}>
        <AnalysisResults filter={filter} />
      </Suspense>
    </Flex>
  );
}
