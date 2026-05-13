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
import type { CollapseProps } from "antd/lib";
import {
  优先表,
  type 冰雪飞花复合体分析,
  type 动态字形分析结果,
  type 基本部件分析,
  type 字形分析结果,
  type 字根,
  type 字符,
  笔画,
  获取注册表,
  部件,
  默认分类器,
  type 默认部件分析,
} from "hanzi-chai";
import { Suspense, useState } from "react";
import {
  useAtom,
  useAtomValue,
  useAtomValueUnwrapped,
  决策原子,
  决策空间原子,
  分析配置原子,
  别名显示原子,
  动态分析原子,
  动态自定义拆分原子,
  原始字库原子,
  复合体分析器原子,
  如动态字形分析结果原子,
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
  exportTSV,
  useChaifenTitle,
  字符过滤器,
  type 字符过滤器参数,
} from "~/utils";

const 导出字形分析结果 = (
  characters: Set<字符>,
  a: 字形分析结果 | 动态字形分析结果,
  display: (s: 字符) => string,
) => {
  const { 分析结果 } = a;
  const tsv: string[][] = [];
  const 序列化 = (l: 字根[]) =>
    l
      .map((z) => (z instanceof 部件 ? display(z.字符) : z.获取名称()))
      .join(" ");
  for (const char of characters) {
    const analysis = 分析结果.get(char) ?? [];
    const head = [char.获取名称()];
    for (const 字形分析 of analysis) {
      if (字形分析 instanceof 优先表) {
        tsv.push([
          ...head,
          // 动态分析以全角空格隔开
          [...字形分析].map((x) => 序列化(x.字根序列)).join("　"),
        ]);
      } else {
        tsv.push([...head, 序列化(字形分析.字根序列)]);
      }
    }
  }
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

const ExportDynamicAnalysis = () => {
  const 汉字集合 = useAtomValue(汉字集合原子);
  const display = useAtomValue(别名显示原子);
  const 动态分析结果 = useAtomValueUnwrapped(如动态字形分析结果原子);
  return (
    <Button onClick={() => 导出字形分析结果(汉字集合, 动态分析结果, display)}>
      导出动态拆分
    </Button>
  );
};

const AnalysisResults = ({ filter }: { filter: 字符过滤器参数 }) => {
  const [step, setStep] = useState(0 as 0 | 1);
  const 分析配置 = useAtomValue(分析配置原子);
  const 原始字库 = useAtomValue(原始字库原子);
  const 笔顺映射 = useAtomValueUnwrapped(如笔顺映射原子);
  const 字形分析结果 = useAtomValueUnwrapped(如字形分析结果原子);
  const { 分析结果 } = 字形分析结果;
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
  const [过滤必要字根, 设置过滤必要字根] = useState(true);
  const 过滤器 = new 字符过滤器(filter, 笔顺映射);
  const 决策空间 = useAtomValue(决策空间原子);
  const [只显示自定义, 设置只显示自定义] = useState(false);
  const 是必要字根 = (k: string) =>
    决策[k] && (决策空间[k] ?? []).every((x) => x.value !== null);
  const 部件分析内容: (NonNullable<CollapseProps["items"]>[number] & {
    sequence: number[];
  })[] = [];
  const 复合体分析内容: NonNullable<CollapseProps["items"]> = [];
  for (const [字, 分析列表] of 分析结果) {
    const 字符串 = 字.获取名称();
    if (只显示自定义 && !自定义拆分[字符串] && !动态自定义拆分[字符串])
      continue;
    if (!过滤器.过滤(字, 原始字库.查询(字)!)) continue;
    if (过滤必要字根 && 是必要字根(字符串)) continue;
    for (const [i, 分析] of 分析列表.entries()) {
      if (分析.类型 === "部件") {
        const r = 分析 as 默认部件分析 | 基本部件分析;
        if (分析.字根序列.length === 1 && 分析.字根序列[0] instanceof 笔画)
          continue;
        部件分析内容.push({
          key: `${字符串}-${分析.部件.字形序号}`,
          label: <ResultSummary glyph={分析.部件} analysis={分析} />,
          children:
            "全部拆分方式" in r ? (
              <ResultDetail
                glyph={分析.部件}
                data={r.全部拆分方式}
                map={r.字根笔画映射}
              />
            ) : undefined,
          sequence: r.字根序列.flatMap((x) => x.获取笔画序列(默认分类器)),
        });
      } else {
        复合体分析内容.push({
          key: `${字符串}-${i}`,
          label: <ResultSummary glyph={分析.复合体} analysis={分析} />,
        });
      }
    }
  }
  部件分析内容.sort(
    (a, b) =>
      a.sequence.length - b.sequence.length ||
      a.sequence.join("").localeCompare(b.sequence.join("")),
  );

  const displays = [部件分析内容, 复合体分析内容] as const;
  return (
    <>
      <Flex gap="middle">
        <Radio.Group
          value={step}
          onChange={(e) => setStep(e.target.value as 0)}
          className="min-w-50"
        >
          <Radio.Button value={0}>部件拆分</Radio.Button>
          <Radio.Button value={1}>复合体拆分</Radio.Button>
        </Radio.Group>
        <Button
          onClick={() => 导出字形分析结果(汉字集合, 字形分析结果, display)}
        >
          导出拆分
        </Button>
        {分析配置.component_analyzer === "冰雪飞花" && (
          <Button
            onClick={() => {
              const tsv: string[][] = [];
              const map: Record<string, string> = {
                1: "一",
                2: "丨",
                3: "丿",
                4: "丶",
                5: "乙",
              };
              for (const [char, result] of 字形分析结果.分析结果) {
                const 部首 = (result[0] as 冰雪飞花复合体分析).部首;
                let 部首字符串 = "〇";
                if (部首) {
                  部首字符串 =
                    部首 instanceof 部件
                      ? display(部首.字符)
                      : map[部首.获取名称()]!;
                }
                tsv.push([char.获取名称(), 部首字符串]);
              }
              exportTSV(tsv, "部首.txt");
            }}
          >
            导出部首
          </Button>
        )}
        {动态分析 && <ExportDynamicAnalysis />}
        <Button
          onClick={() => {
            const 全部自定义拆分 = { ...动态自定义拆分 };
            for (const [k, v] of Object.entries(自定义拆分)) {
              if (全部自定义拆分[k] === undefined) {
                全部自定义拆分[k] = [v];
              }
            }
            for (const [部件, 字根序列列表] of Object.entries(全部自定义拆分)) {
              const last = 字根序列列表[字根序列列表.length - 1];
              if (!last) continue;
              if (last.some((x) => !是必要字根(x))) {
                notification.warning({
                  message: "存在不合法的自定义拆分",
                  description: `部件 ${display(原始字库.校验(部件)!.character)} 的自定义拆分中包含非必要字根 ${last
                    .filter((x) => !是必要字根(x))
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
        <Space>
          <span>过滤必要字根</span>
          <Switch
            checked={过滤必要字根}
            onChange={() => 设置过滤必要字根((x) => !x)}
          />
        </Space>
      </Flex>
      <Row className="w-4/5 items-center">
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
        className="self-stretch"
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
    <Flex vertical align="center" gap="middle" className="px-8">
      <Flex gap="middle" justify="center" className="mb-4">
        <ConfigureRules />
      </Flex>
      <CharacterQuery setFilter={setFilter} />
      <Suspense fallback={<Skeleton active />}>
        <AnalysisResults filter={filter} />
      </Suspense>
    </Flex>
  );
}
