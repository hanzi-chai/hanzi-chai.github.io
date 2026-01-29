import {
  Button,
  Col,
  Flex,
  Modal,
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
  如笔顺映射原子,
  别名显示原子,
  如字库原子,
  自定义拆分原子,
  汉字集合原子,
  决策原子,
  动态自定义拆分原子,
  useAtom,
  部件分析器原子,
  复合体分析器原子,
  useAtomValueUnwrapped,
} from "~/atoms";
import { Collapse, Select } from "antd";
import ResultDetail from "~/components/ResultDetail";
import { Suspense, useState } from "react";
import {
  获取注册表,
  type 基本分析,
  type 默认部件分析,
  type 字形分析结果,
} from "~/lib";
import Selector from "~/components/Selector";
import Degenerator from "~/components/Degenerator";
import CharacterQuery from "~/components/CharacterQuery";
import { 如字形分析结果原子 } from "~/atoms";
import ResultSummary from "~/components/ResultSummary";
import {
  type 字符过滤器参数,
  exportTSV,
  useChaifenTitle,
  字符过滤器,
} from "~/utils";

const dumpAnalysisResult = (
  characters: Set<string>,
  a: 字形分析结果,
  display: (s: string) => string,
) => {
  const { 部件分析结果, 复合体分析结果 } = a;
  const tsv = [...characters].map((char) => {
    const analysis = 部件分析结果.get(char) ?? 复合体分析结果.get(char);
    if (!analysis) {
      return [char, ""];
    }
    return [char, analysis.字根序列.map(display).join(" ")];
  });
  exportTSV(tsv, "拆分结果.txt");
};

const ConfigureRules = () => {
  const [modal, setModal] = useState(0);
  const [部件分析器, 设置部件分析器] = useAtom(部件分析器原子);
  const [复合体分析器, 设置复合体分析器] = useAtom(复合体分析器原子);
  const 注册表 = 获取注册表();

  return (
    <Flex gap="middle" justify="center" align="center">
      部件分析器：
      <Select
        value={部件分析器}
        onChange={设置部件分析器}
        options={[...注册表.部件分析器映射.keys()].map((x) => ({
          label: x,
          value: x,
        }))}
      />
      复合体分析器：
      <Select
        value={复合体分析器}
        onChange={设置复合体分析器}
        options={[...注册表.复合体分析器映射.keys()].map((x) => ({
          label: x,
          value: x,
        }))}
      />
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

const AnalysisResults = ({ filter }: { filter: 字符过滤器参数 }) => {
  const [step, setStep] = useState(0 as 0 | 1);
  const repertoire = useAtomValueUnwrapped(如字库原子);
  const sequenceMap = useAtomValueUnwrapped(如笔顺映射原子);
  const analysisResult = useAtomValueUnwrapped(如字形分析结果原子);
  const { 原始部件分析结果, 部件分析结果, 复合体分析结果 } = analysisResult;
  const characters = useAtomValue(汉字集合原子);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const display = useAtomValue(别名显示原子);
  const customize = useAtomValue(自定义拆分原子);
  const dynamicCustomize = useAtomValue(动态自定义拆分原子);
  const allCustomizedKeys = new Set([
    ...Object.keys(customize),
    ...Object.keys(dynamicCustomize),
  ]);
  const mapping = useAtomValue(决策原子);
  const filterFn = new 字符过滤器(filter);

  const [customizedOnly, setCustomizedOnly] = useState(false);
  const componentsNeedAnalysis = [...原始部件分析结果].filter(([k, v]) => {
    if (mapping[k]) return false;
    if (v.字根序列.length === 1 && /\d+/.test(v.字根序列[0]!)) return false;
    return true;
  });
  const componentDisplay = componentsNeedAnalysis
    .filter(([x]) => !customizedOnly || customize[x] || dynamicCustomize[x])
    .filter(([x]) =>
      filterFn.过滤(x, repertoire._get()[x]!, sequenceMap.get(x) ?? ""),
    )
    .map(([key, res]) => {
      const r = res as 默认部件分析 | 基本分析;
      return {
        key,
        label: <ResultSummary char={key} analysis={res} />,
        children:
          "全部拆分方式" in r ? (
            <ResultDetail
              char={key}
              data={r.全部拆分方式}
              map={r.字根笔画映射}
            />
          ) : null,
      };
    });
  const compoundDisplay = [...复合体分析结果]
    .filter(([x]) =>
      filterFn.过滤(x, repertoire._get()[x]!, sequenceMap.get(x) ?? ""),
    )
    .map(([key, res]) => {
      return {
        key,
        label: <ResultSummary char={key} analysis={res} disableCustomize />,
      };
    });

  const displays = [componentDisplay, compoundDisplay] as const;
  return (
    <>
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
          导出拆分
        </Button>
      </Flex>
      <Row style={{ width: "80%", alignItems: "center" }}>
        <Col span={5}>
          <Statistic title="总部件数" value={部件分析结果.size} />
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
              componentsNeedAnalysis.length - allCustomizedKeys.size
            }
          />
        </Col>
        <Col span={5}>
          <Statistic title="自定义部件数" value={allCustomizedKeys.size} />
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
  const [filter, setFilter] = useState<字符过滤器参数>({});

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
