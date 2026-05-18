import {
  ProForm,
  ProFormDependency,
  ProFormDigit,
  ProFormGroup,
  ProFormSelect,
} from "@ant-design/pro-components";
import {
  Button,
  Flex,
  Form,
  Popover,
  Select,
  Skeleton,
  Space,
  Table,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { 元素位或编码, 强类型元素位或编码, 组装条目 } from "hanzi-chai";
import { 下转换, 反序列化, 序列化 } from "hanzi-chai";
import { useAtomValue } from "jotai";
import { isEqual, range, sumBy } from "lodash-es";
import { Suspense, useState } from "react";
import {
  useAtomValueUnwrapped,
  全部合法元素原子,
  如带归并组装结果原子,
  字母表原子,
  最大码长原子,
} from "~/atoms";
import KeySelect from "~/components/KeySelect";
import {
  CodePositionDisplay,
  DeleteButton,
  PlusButton,
} from "~/components/Utils";
import { type AnalyzerForm, useChaifenTitle, 数字 } from "~/utils";

const filterRelevant = (result: 组装条目[], analyzer: AnalyzerForm) => {
  let relevant = result.sort((a, b) => b.频率 - a.频率);
  if (analyzer.type === "single")
    relevant = relevant.filter((x) => [...x.词].length === 1);
  if (analyzer.type === "multi")
    relevant = relevant.filter((x) => [...x.词].length > 1);
  if (analyzer.top > 0) {
    relevant = relevant.slice(0, analyzer.top);
  }
  return relevant;
};

const 分析原始重码 = (
  分析配置: AnalyzerForm,
  result: 组装条目[],
  maxLength: number,
  合并组列表: 强类型元素位或编码[][] = [],
) => {
  const 反向映射 = new Map<string, string[]>();
  const 相关结果 = filterRelevant(result, 分析配置);
  for (const 条目 of 相关结果) {
    const { 词, 元素序列 } = 条目;
    const 处理后元素序列: (强类型元素位或编码 | undefined)[] = [];
    for (const i of range(maxLength)) {
      if (分析配置.position.includes(i)) {
        const 码位 = 元素序列.元素序列[i];
        const index = 合并组列表.findIndex((group) =>
          group.some((y) => isEqual(y, 码位)),
        );
        处理后元素序列.push(
          index !== -1 ? String.fromCodePoint(0x100000 + index) : 码位,
        );
      } else {
        处理后元素序列.push("*");
      }
    }
    const summary = JSON.stringify(
      处理后元素序列.map((x) => (x !== undefined ? 下转换(x) : "ε")),
    );
    反向映射.set(
      summary,
      (反向映射.get(summary) || []).concat(
        词.map((c) => c.获取名称()).join(""),
      ),
    );
  }
  return 反向映射;
};

interface Density {
  name: string;
  items: string[];
}

const AnalyzerConfig = ({
  analyzer,
  setAnalyzer,
  disablePosition,
}: {
  analyzer: AnalyzerForm;
  setAnalyzer: (a: AnalyzerForm) => void;
  disablePosition?: boolean;
}) => {
  const [form] = Form.useForm<AnalyzerForm>();
  const maxLength = useAtomValue(最大码长原子);
  return (
    <ProForm<AnalyzerForm>
      form={form}
      layout="horizontal"
      submitter={false}
      initialValues={analyzer}
      onValuesChange={(_, values) => setAnalyzer(values)}
      autoFocusFirstInput={false}
    >
      <ProFormGroup>
        {!disablePosition && (
          <ProFormSelect
            mode="multiple"
            name="position"
            label="取码"
            options={range(maxLength).map((d) => ({
              label: `第${数字(d + 1)}码`,
              value: d,
            }))}
            allowClear={false}
          />
        )}
        <ProFormSelect
          name="type"
          label="类型"
          width="xs"
          options={[
            { label: "全部", value: "all" },
            { label: "一字词", value: "single" },
            { label: "多字词", value: "multi" },
          ]}
        />
        <ProFormDependency name={["top"]}>
          {({ top }) => (
            <Space>
              <Form.Item label="范围">
                <Select
                  value={top === 0 ? 0 : 1}
                  options={[
                    { label: "全部", value: 0 },
                    { label: "前", value: 1 },
                  ]}
                  onChange={(value) => {
                    const top = value === 0 ? 0 : 500;
                    form.setFieldValue("top", top);
                    setAnalyzer({ ...form.getFieldsValue(), top });
                  }}
                  className="w-24"
                />
              </Form.Item>
              <ProFormDigit name="top" width="xs" disabled={top === 0} />
            </Space>
          )}
        </ProFormDependency>
      </ProFormGroup>
    </ProForm>
  );
};

const MultiDistribution = ({ init }: { init: AnalyzerForm }) => {
  const maxLength = useAtomValue(最大码长原子);
  const [analyzer, setAnalyzer] = useState(init);
  const assemblyResult = useAtomValueUnwrapped(如带归并组装结果原子);
  const reverseMap = 分析原始重码(analyzer, assemblyResult, maxLength);
  const alphabet = useAtomValue(字母表原子);
  const dataSource = [...reverseMap]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([name, items]) => ({ name, items }));
  const lengths = dataSource.map((x) => x.items.length);
  const { 名称映射 } = useAtomValueUnwrapped(全部合法元素原子);
  const columns: ColumnsType<Density> = [
    {
      title: "元素序列",
      dataIndex: "name",
      key: "name",
      render: (_, { name }) => {
        const raw_elements: (元素位或编码 | undefined)[] = JSON.parse(name);
        const elements = raw_elements.map((x) =>
          typeof x === "object"
            ? { element: 名称映射.get(x.element)!, index: x.index }
            : x,
        );
        return (
          <Space>
            {elements.map((element, i) => (
              <CodePositionDisplay key={i} element={element ?? "ε"} />
            ))}
          </Space>
        );
      },
      width: 192,
    },
    {
      title: "数量",
      dataIndex: "items",
      key: "density",
      render: (items) => items.length,
      width: 64,
    },
    {
      title: "对象",
      dataIndex: "items",
      key: "items",
      render: (items) => items.join("、"),
    },
  ];

  const coorder = 数字(maxLength - analyzer.position.length);
  const space = alphabet.length ** (maxLength - analyzer.position.length);
  const estimation = sumBy(lengths, (x) =>
    analyzer.position.length === maxLength ? x - 1 : (x * x) / 2 / space,
  );
  return (
    <>
      <Typography.Title level={3}>
        多元分布（{coorder}阶重码估计：{Math.round(estimation)}）
      </Typography.Title>
      <AnalyzerConfig analyzer={analyzer} setAnalyzer={setAnalyzer} />
      <Table
        dataSource={dataSource}
        columns={columns}
        size="small"
        rowKey="name"
      />
    </>
  );
};

interface UnaryDensity {
  name: string;
  items: Set<string>[];
  total: number;
}

const UnaryDistribution = ({ init }: { init: AnalyzerForm }) => {
  const maxLength = useAtomValue(最大码长原子);
  const [analyzer, setAnalyzer] = useState(init);
  const assemblyResult = useAtomValueUnwrapped(如带归并组装结果原子);
  const reverseMap = new Map<string, Set<string>[]>();
  const relevant = filterRelevant(assemblyResult, analyzer);
  const { 名称映射 } = useAtomValueUnwrapped(全部合法元素原子);
  for (const assembly of relevant) {
    const { 词, 元素序列 } = assembly;
    元素序列.元素序列.forEach((x, i) => {
      const key = 序列化(x);
      if (!reverseMap.has(key))
        reverseMap.set(
          key,
          range(maxLength).map(() => new Set()),
        );
      reverseMap.get(key)?.[i]?.add(词.map((c) => c.获取名称()).join("")) ??
        null;
    });
  }
  const dataSource = [...reverseMap]
    .map(([name, items]) => ({
      name,
      items,
      total: sumBy(items, (x) => x.size),
    }))
    .sort((a, b) => b.total - a.total);
  const columns: ColumnsType<UnaryDensity> = [
    {
      title: "元素",
      dataIndex: "name",
      key: "name",
      render: (_, record) => {
        const element = 反序列化(record.name, 名称映射)!;
        if (!element.ok) return record.name;
        return <CodePositionDisplay element={element.value!} />;
      },
      width: 192,
    },
    ...range(maxLength).map((i) => ({
      title: `第${数字(i + 1)}码`,
      dataIndex: "items",
      key: `density-${i}`,
      render: (items: Set<string>[]) => (
        <Popover
          content={<div className="max-w-100">{[...items[i]!].join("、")}</div>}
        >
          <span>{items[i]?.size ?? 0}</span>
        </Popover>
      ),
      width: 64,
      sortDirections: ["descend", "ascend"] as ("descend" | "ascend")[],
      sorter: (a: UnaryDensity, b: UnaryDensity) =>
        (a.items[i]?.size ?? 0) - (b.items[i]?.size ?? 0),
    })),
    {
      title: "总数量",
      dataIndex: "total",
      key: "density",
      width: 64,
      sortDirections: ["descend", "ascend"],
      sorter: (a, b) => a.total - b.total,
    },
  ];
  return (
    <>
      <Typography.Title level={3}>一元分布</Typography.Title>
      <AnalyzerConfig
        analyzer={analyzer}
        setAnalyzer={setAnalyzer}
        disablePosition
      />
      <Table
        dataSource={dataSource}
        columns={columns}
        size="small"
        rowKey="name"
        pagination={{ defaultPageSize: 20 }}
      />
    </>
  );
};

const MarginalFirstOrderDuplication = () => {
  const assemblyResult = useAtomValueUnwrapped(如带归并组装结果原子);
  const maxLength = useAtomValue(最大码长原子);
  const [合并组列表, 设置合并组列表] = useState([] as 强类型元素位或编码[][]);
  const [analyzer, setAnalyzer] = useState<AnalyzerForm>({
    type: "single",
    position: range(0, maxLength),
    top: 0,
  });

  const rmBefore = 分析原始重码(analyzer, assemblyResult, maxLength);
  const szBefore = new Set<string>();
  rmBefore.forEach((items) => {
    if (items.length > 1) items.map((x) => szBefore.add(x));
  });
  const rmAfter = 分析原始重码(analyzer, assemblyResult, maxLength, 合并组列表);
  const szAfter = new Set<string>();
  rmAfter.forEach((items) => {
    if (items.length > 1) items.map((x) => szAfter.add(x));
  });
  const { 笔画列表 } = useAtomValueUnwrapped(全部合法元素原子);
  const defaultItem = (): 强类型元素位或编码 => ({
    element: 笔画列表[0]!,
    index: 0,
  });
  return (
    <>
      <Typography.Title level={3}>边际一阶重码计算</Typography.Title>
      <AnalyzerConfig analyzer={analyzer} setAnalyzer={setAnalyzer} />
      <Flex vertical gap="small">
        {合并组列表.map((group, i) => (
          <Flex key={i} gap="small" align="center" wrap="wrap">
            {group.map((item, j) => (
              <Flex key={j} align="center" gap="small">
                <KeySelect
                  allowElements
                  value={item}
                  onChange={(v) =>
                    设置合并组列表(
                      合并组列表.map((g, gi) =>
                        gi === i
                          ? g.map((c, ci) =>
                              ci === j ? (v as 强类型元素位或编码) : c,
                            )
                          : g,
                      ),
                    )
                  }
                />
                <DeleteButton
                  onClick={() =>
                    设置合并组列表(
                      合并组列表.map((g, gi) =>
                        gi === i ? g.filter((_, ci) => ci !== j) : g,
                      ),
                    )
                  }
                />
              </Flex>
            ))}
            <PlusButton
              onClick={() =>
                设置合并组列表(
                  合并组列表.map((g, gi) =>
                    gi === i ? [...g, defaultItem()] : g,
                  ),
                )
              }
            />
            <Button
              size="small"
              onClick={() =>
                设置合并组列表(合并组列表.filter((_, gi) => gi !== i))
              }
            >
              删除组
            </Button>
          </Flex>
        ))}
        <Button
          onClick={() => 设置合并组列表([...合并组列表, [defaultItem()]])}
        >
          添加一组合并
        </Button>
      </Flex>
      <Typography.Paragraph>
        将增加重码：
        {[...szAfter].filter((x) => !szBefore.has(x)).join("、")}
      </Typography.Paragraph>
    </>
  );
};

export default function Statistics() {
  useChaifenTitle("统计");
  const maxLength = useAtomValue(最大码长原子);
  return (
    <Flex vertical gap="middle">
      <Typography.Title level={2}>离散性分析</Typography.Title>
      <Suspense fallback={<Skeleton active />}>
        <MarginalFirstOrderDuplication />
        <MultiDistribution
          init={{ type: "single", position: range(0, maxLength), top: 0 }}
        />
        <UnaryDistribution
          init={{ type: "single", position: range(0, maxLength), top: 0 }}
        />
      </Suspense>
    </Flex>
  );
}
