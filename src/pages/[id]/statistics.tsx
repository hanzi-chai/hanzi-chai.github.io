import { Flex, Popover, Select, Skeleton, Table } from "antd";
import { 字母表原子 } from "~/atoms";
import {
  ProForm,
  ProFormDependency,
  ProFormDigit,
  ProFormGroup,
  ProFormSelect,
} from "@ant-design/pro-components";
import { Form, Space, Typography } from "antd";
import { useAtomValue } from "jotai";
import { 最大码长原子 } from "~/atoms";
import type { 码位, 组装条目, 频率映射 } from "~/lib";
import { 反序列化, 序列化 } from "~/lib";
import { Suspense, useState } from "react";
import { 如组装结果原子 } from "~/atoms";
import type { ColumnsType } from "antd/es/table";
import { range, sumBy } from "lodash-es";
import { DisplayOptionalSuperscript } from "~/components/SequenceTable";
import { MinusButton, PlusButton } from "~/components/Utils";
import KeySelect from "~/components/KeySelect";
import { AnalyzerForm, useChaifenTitle } from "~/utils";

const numbers = [
  "零",
  "一",
  "二",
  "三",
  "四",
  "五",
  "六",
  "七",
  "八",
  "九",
  "十",
];
const render = (value: number) => numbers[value] || value.toString();

const filterRelevant = (result: 组装条目[], analyzer: AnalyzerForm) => {
  let relevant = result;
  if (analyzer.type === "single")
    relevant = relevant.filter((x) => [...x.词].length === 1);
  if (analyzer.type === "multi")
    relevant = relevant.filter((x) => [...x.词].length > 1);
  if (analyzer.top > 0) {
    relevant = relevant.slice(0, analyzer.top);
  }
  return relevant;
};

const analyzePrimitiveDuplication = (
  analyzer: AnalyzerForm,
  result: 组装条目[],
  maxLength: number,
  replacer: (d: string) => string = (d) => d,
) => {
  const reverseMap = new Map<string, string[]>();
  const relevant = filterRelevant(result, analyzer);
  for (const assembly of relevant) {
    const { 词: name, 元素序列: sequence } = assembly;
    const sliced = range(maxLength).map((i) =>
      analyzer.position.includes(i) ? sequence[i] : "*",
    );
    const summary = `(${sliced.map((x) => replacer(序列化(x))).join(", ")})`;
    reverseMap.set(summary, (reverseMap.get(summary) || []).concat(name));
  }
  return reverseMap;
};

interface Density {
  name: string;
  items: string[];
}

const AnalyzerConfig = ({
  analyzer,
  setAnalyzer,
}: {
  analyzer: AnalyzerForm;
  setAnalyzer: (a: AnalyzerForm) => void;
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
        <ProFormSelect
          mode="multiple"
          name="position"
          label="取码"
          options={range(maxLength).map((d) => ({
            label: `第 ${d + 1} 码`,
            value: d,
          }))}
          allowClear={false}
        />
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
                  style={{ width: 96 }}
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
  const assemblyResult = useAtomValue(如组装结果原子);
  const reverseMap = analyzePrimitiveDuplication(
    analyzer,
    assemblyResult,
    maxLength,
  );
  const alphabet = useAtomValue(字母表原子);
  const dataSource = [...reverseMap]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([name, items]) => ({ name, items }));
  const lengths = dataSource.map((x) => x.items.length);
  const columns: ColumnsType<Density> = [
    {
      title: "元素序列",
      dataIndex: "name",
      key: "name",
      render: (_, { name }) => {
        const elements: 码位[] = name
          .slice(1, -1)
          .split(", ")
          .map((x) => {
            if (x === "*") return x;
            if (x.includes(".")) {
              const [element, index] = x.split(".");
              return { element: element!, index: parseInt(index!, 10) };
            }
            return x;
          });
        return (
          <Space>
            {elements.map((element, i) => (
              <DisplayOptionalSuperscript key={i} element={element} />
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

  const coorder = render(maxLength - analyzer.position.length);
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
  const assemblyResult = useAtomValue(如组装结果原子);
  const reverseMap = new Map<string, Set<string>[]>();
  const relevant = filterRelevant(assemblyResult, analyzer);
  for (const assembly of relevant) {
    const { 词: name, 元素序列: sequence } = assembly;
    sequence.forEach((x, i) => {
      const key = 序列化(x);
      if (!reverseMap.has(key))
        reverseMap.set(
          key,
          range(maxLength).map(() => new Set()),
        );
      reverseMap.get(key)?.[i]?.add(name);
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
      title: "元素序列",
      dataIndex: "name",
      key: "name",
      render: (_, record) => {
        const element = 反序列化(record.name)!;
        if (!element.ok) return record.name;
        return <DisplayOptionalSuperscript element={element.value!} />;
      },
      width: 192,
    },
    ...range(maxLength).map((i) => ({
      title: `第 ${i + 1} 码`,
      dataIndex: "items",
      key: `density-${i}`,
      render: (items: Set<string>[]) => (
        <Popover
          content={
            <div style={{ maxWidth: "400px" }}>{[...items[i]!].join("、")}</div>
          }
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
      <AnalyzerConfig analyzer={analyzer} setAnalyzer={setAnalyzer} />
      <Table
        dataSource={dataSource}
        columns={columns}
        size="small"
        rowKey="name"
        pagination={{ pageSize: 20 }}
      />
    </>
  );
};

const MarginalFirstOrderDuplication = () => {
  const assemblyResult = useAtomValue(如组装结果原子);
  const maxLength = useAtomValue(最大码长原子);
  const [elements, setElements] = useState([] as 码位[]);
  const [analyzer, setAnalyzer] = useState<AnalyzerForm>({
    type: "single",
    position: range(0, maxLength),
    top: 0,
  });

  const rmBefore = analyzePrimitiveDuplication(
    analyzer,
    assemblyResult,
    maxLength,
  );
  const szBefore = new Set<string>();
  rmBefore.forEach((items) => {
    if (items.length > 1) items.map((x) => szBefore.add(x));
  });
  const rmAfter = analyzePrimitiveDuplication(
    analyzer,
    assemblyResult,
    maxLength,
    (d) => (elements.map(序列化).includes(d) ? "^" : d),
  );
  const szAfter = new Set<string>();
  rmAfter.forEach((items) => {
    if (items.length > 1) items.map((x) => szAfter.add(x));
  });
  return (
    <>
      <Typography.Title level={3}>边际一阶重码计算</Typography.Title>
      <AnalyzerConfig analyzer={analyzer} setAnalyzer={setAnalyzer} />
      <Flex gap="middle" align="baseline">
        <Form.Item label="合并">
          <Space>
            {elements.map((x, i) => (
              <KeySelect
                key={i}
                value={x}
                disableAlphabets
                onChange={(newKey) => {
                  const newElements = [...elements];
                  newElements[i]! = newKey as 码位;
                  setElements(newElements);
                }}
              />
            ))}
          </Space>
        </Form.Item>
        <PlusButton
          onClick={() => setElements([...elements, { element: "1", index: 0 }])}
        />
        <MinusButton onClick={() => setElements(elements.slice(0, -1))} />
        <Typography.Paragraph>
          将增加重码：
          {[...szAfter].filter((x) => !szBefore.has(x)).join("、")}
        </Typography.Paragraph>
      </Flex>
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
