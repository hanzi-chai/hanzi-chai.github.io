import {
  Button,
  Col,
  Collapse,
  Flex,
  Modal,
  notification,
  Pagination,
  Radio,
  Row,
  Select,
  Skeleton,
  Space,
  Statistic,
  Switch,
} from "antd";
import type { ItemType } from "rc-collapse/es/interface";
import { Suspense, useState } from "react";
import {
  useAtom,
  useAtomValue,
  useAtomValueUnwrapped,
  决策原子,
  决策空间原子,
  别名显示原子,
  动态分析原子,
  动态自定义拆分原子,
  复合体分析器原子,
  如动态字形分析结果原子,
  如字库原子,
  如字形分析结果原子,
  如笔顺映射原子,
  汉字集合原子,
  自定义拆分原子,
  部件分析器原子,
} from "~/atoms";
import CharacterQuery from "~/components/CharacterQuery";
import Degenerator from "~/components/Degenerator";
import ResultDetail from "~/components/ResultDetail";
import ResultSummary from "~/components/ResultSummary";
import Selector from "~/components/Selector";
import {
  type 动态字形分析结果,
  type 基本分析,
  type 字形分析结果,
  获取注册表,
  type 默认部件分析,
} from "~/lib";
import {
  exportTSV,
  useChaifenTitle,
  字符过滤器,
  type 字符过滤器参数,
} from "~/utils";

const 导出字形分析结果 = (
  characters: Set<string>,
  a: 字形分析结果 | 动态字形分析结果,
  display: (s: string) => string,
) => {
  const { 分析结果 } = a;
  const tsv = [...characters].map((char) => {
    const analysis = (分析结果.get(char) ?? []).flat();
    return [
      char,
      analysis.map((x) => x.字根序列.map(display).join(" ")).join("　"),
    ];
  });
  exportTSV(tsv, "拆分结果.txt");
};

const ConfigureRules = () => {
  const [modal, setModal] = useState(0);
  const [动态分析, 设置动态分析] = useAtom(动态分析原子);
  const [部件分析器, 设置部件分析器] = useAtom(部件分析器原子);
  const [复合体分析器, 设置复合体分析器] = useAtom(复合体分析器原子);
  const 注册表 = 获取注册表();

  return (
    <Flex gap="middle" justify="center" align="center">
      动态拆分：
      <Switch checked={动态分析} onChange={设置动态分析} />
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
  const 字库 = useAtomValueUnwrapped(如字库原子);
  const 笔顺映射 = useAtomValueUnwrapped(如笔顺映射原子);
  const 字形分析结果 = useAtomValueUnwrapped(如字形分析结果原子);
  const { 分析结果 } = 字形分析结果;
  const 动态字形分析结果 = useAtomValue(如动态字形分析结果原子);
  const 动态分析 = useAtomValue(动态分析原子);
  const 汉字集合 = useAtomValue(汉字集合原子);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const display = useAtomValue(别名显示原子);
  const 自定义拆分 = useAtomValue(自定义拆分原子);
  const 动态自定义拆分 = useAtomValue(动态自定义拆分原子);
  const 全部自定义字符 = new Set([
    ...Object.keys(自定义拆分),
    ...Object.keys(动态自定义拆分),
  ]);
  const 决策 = useAtomValue(决策原子);
  const 过滤器 = new 字符过滤器(filter);
  const 决策空间 = useAtomValue(决策空间原子);
  const [只显示自定义, 设置只显示自定义] = useState(false);
  const 是必要字根 = (k: string) =>
    决策[k] && (决策空间[k] ?? []).every((x) => x.value !== null);
  const 部件分析内容: ItemType[] = [];
  const 复合体分析内容: ItemType[] = [];
  for (const [字, 分析列表] of 分析结果) {
    if (只显示自定义 && !自定义拆分[字] && !动态自定义拆分[字]) continue;
    if (!过滤器.过滤(字, 字库._get()[字]!, 笔顺映射.get(字) ?? "")) continue;
    if (是必要字根(字)) continue;
    for (const 分析 of 分析列表) {
      if (分析.类型 === "部件") {
        const r = 分析 as 默认部件分析 | 基本分析;
        if (分析.字根序列.length === 1 && /\d+/.test(分析.字根序列[0]!))
          continue;
        部件分析内容.push({
          key: 字,
          label: <ResultSummary char={字} analysis={分析} />,
          children:
            "全部拆分方式" in r ? (
              <ResultDetail
                char={字}
                data={r.全部拆分方式}
                map={r.字根笔画映射}
              />
            ) : undefined,
        });
      } else {
        复合体分析内容.push({
          key: 字,
          label: <ResultSummary char={字} analysis={分析} disableCustomize />,
        });
      }
    }
  }

  const displays = [部件分析内容, 复合体分析内容] as const;
  return (
    <>
      <Flex gap="middle">
        <Radio.Group
          value={step}
          onChange={(e) => setStep(e.target.value as 0)}
          style={{ minWidth: "200px" }}
        >
          <Radio.Button value={0}>部件拆分</Radio.Button>
          <Radio.Button value={1}>复合体拆分</Radio.Button>
        </Radio.Group>
        <Button
          onClick={() => 导出字形分析结果(汉字集合, 字形分析结果, display)}
        >
          导出拆分
        </Button>
        {动态分析 && 动态字形分析结果.ok && (
          <Button
            onClick={() =>
              导出字形分析结果(汉字集合, 动态字形分析结果.value, display)
            }
          >
            导出动态拆分
          </Button>
        )}
        <Button
          onClick={() => {
            const 全部自定义拆分 = { ...动态自定义拆分 };
            for (const [k, v] of Object.entries(自定义拆分)) {
              if (全部自定义拆分[k] === undefined) {
                全部自定义拆分[k] = [v];
              }
            }
            for (const [部件, 字根序列列表] of Object.entries(动态自定义拆分)) {
              const last = 字根序列列表[字根序列列表.length - 1];
              if (!last) continue;
              if (last.some((x) => !是必要字根(x))) {
                notification.warning({
                  message: "存在不合法的自定义拆分",
                  description: `部件 ${display(部件)} 的自定义拆分中包含非必要字根 ${last
                    .filter((x) => !是必要字根(x))
                    .map(display)
                    .join("、")}，请修改后重试`,
                });
                return;
              }
            }
            notification.success({
              message: "检查通过",
              description: "所有自定义拆分均合法",
            });
          }}
        >
          检查自定义组
        </Button>
      </Flex>
      <Row style={{ width: "80%", alignItems: "center" }}>
        <Col span={5}>
          <Statistic
            title="总部件数"
            value={[...分析结果.values()].reduce(
              (acc, val) => acc + val.filter((x) => x.类型 === "部件").length,
              0,
            )}
          />
        </Col>
        <Col span={5}>
          <Statistic title="需拆分部件数" value={部件分析内容.length} />
        </Col>
        <Col span={5}>
          <Statistic
            title="自动拆分部件数"
            value={部件分析内容.length - 全部自定义字符.size}
          />
        </Col>
        <Col span={5}>
          <Statistic title="自定义部件数" value={全部自定义字符.size} />
        </Col>
        <Col span={4}>
          <Space>
            <span>只显示自定义</span>
            <Switch
              checked={只显示自定义}
              onChange={() => 设置只显示自定义((x) => !x)}
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
