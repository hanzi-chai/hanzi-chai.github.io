import { Flex, Select, Table } from "antd";
import {
  alphabetAtom,
  displayAtom,
  frequencyAtom,
  repertoireAtom,
  sequenceAtom,
  useChaifenTitle,
} from "~/atoms";
import {
  ProForm,
  ProFormDependency,
  ProFormDigit,
  ProFormGroup,
  ProFormSelect,
} from "@ant-design/pro-components";
import { Form, Space, Typography } from "antd";
import { useAtomValue } from "jotai";
import { maxLengthAtom } from "~/atoms";
import type { AnalyzerForm, AssemblyResult, Frequency } from "~/lib";
import { renderIndexed } from "~/lib";
import { useState } from "react";
import { assemblyResultAtom } from "~/atoms/cache";
import type { ColumnsType } from "antd/es/table";
import { range, sumBy } from "lodash-es";

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

const analyzePrimitiveDuplication = (
  analyzer: AnalyzerForm,
  frequency: Frequency,
  result: AssemblyResult,
  display: (d: string) => string,
  maxLength: number,
  replacer: (d: string) => string = (d) => d,
) => {
  const reverseMap = new Map<string, string[]>();
  let relevant = result;
  if (analyzer.type === "single")
    relevant = relevant.filter((x) => [...x.name].length === 1);
  if (analyzer.type === "multi")
    relevant = relevant.filter((x) => [...x.name].length > 1);
  if (analyzer.top > 0) {
    relevant.sort((a, b) => {
      return (frequency[b.name] ?? 0) - (frequency[a.name] ?? 0);
    });
    relevant = relevant.slice(0, analyzer.top);
  }
  for (const assembly of relevant) {
    const { name, sequence } = assembly;
    const sliced = range(maxLength).map((i) =>
      analyzer.position.includes(i) ? sequence[i] : "*",
    );
    const summary = `(${sliced.map((x) => replacer(renderIndexed(x, display))).join(", ")})`;
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
  const maxLength = useAtomValue(maxLengthAtom);
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

const SubStatistics = ({ init }: { init: AnalyzerForm }) => {
  const maxLength = useAtomValue(maxLengthAtom);
  const [analyzer, setAnalyzer] = useState(init);
  const assemblyResult = useAtomValue(assemblyResultAtom);
  const frequency = useAtomValue(frequencyAtom);
  const display = useAtomValue(displayAtom);
  const reverseMap = analyzePrimitiveDuplication(
    analyzer,
    frequency,
    assemblyResult,
    display,
    maxLength,
  );
  const alphabet = useAtomValue(alphabetAtom);
  const dataSource = [...reverseMap]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([name, items]) => ({ name, items }));
  const lengths = dataSource.map((x) => x.items.length);
  const columns: ColumnsType<Density> = [
    {
      title: "元素序列",
      dataIndex: "name",
      key: "name",
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

  const order = render(analyzer.position.length);
  const coorder = render(maxLength - analyzer.position.length);
  const space = Math.pow(alphabet.length, maxLength - analyzer.position.length);
  const estimation = sumBy(lengths, (x) =>
    analyzer.position.length === maxLength ? x - 1 : (x * x) / 2 / space,
  );
  return (
    <>
      <Typography.Title level={3}>
        {order}元分布（{coorder}阶重码估计：{Math.round(estimation)}）
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

const MarginalFirstOrderDuplication = () => {
  const assemblyResult = useAtomValue(assemblyResultAtom);
  const frequency = useAtomValue(frequencyAtom);
  const maxLength = useAtomValue(maxLengthAtom);
  const display = useAtomValue(displayAtom);
  const sequenceMap = useAtomValue(sequenceAtom);
  const repertoire = useAtomValue(repertoireAtom);
  const hashedElements = new Set<string>();
  for (const { sequence } of assemblyResult) {
    sequence.forEach((x) => {
      hashedElements.add(renderIndexed(x, display));
    });
  }
  const allElements = [...hashedElements].sort();

  const [elements, setElements] = useState(allElements.slice(0, 2));
  const [analyzer, setAnalyzer] = useState<AnalyzerForm>({
    type: "single",
    position: range(0, maxLength),
    top: 0,
  });

  const rmBefore = analyzePrimitiveDuplication(
    analyzer,
    frequency,
    assemblyResult,
    display,
    maxLength,
  );
  const szBefore = new Set<string>();
  rmBefore.forEach((items) => {
    if (items.length > 1) items.forEach((x) => szBefore.add(x));
  });
  const rmAfter = analyzePrimitiveDuplication(
    analyzer,
    frequency,
    assemblyResult,
    display,
    maxLength,
    (d) => (elements.includes(d) ? "^" : d),
  );
  const szAfter = new Set<string>();
  rmAfter.forEach((items) => {
    if (items.length > 1) items.forEach((x) => szAfter.add(x));
  });
  return (
    <>
      <Typography.Title level={3}>边际一阶重码计算</Typography.Title>
      <AnalyzerConfig analyzer={analyzer} setAnalyzer={setAnalyzer} />
      <Flex gap="middle" align="baseline">
        <Form.Item label="合并">
          <Select
            value={elements}
            onChange={setElements}
            style={{ minWidth: 128 }}
            mode="multiple"
            options={allElements.map((x) => ({ label: x, value: x }))}
            filterOption={(input, option) => {
              if (option === undefined) return false;
              const value = option.value.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, "");
              if (repertoire[value] !== undefined) {
                return sequenceMap.get(value)!.startsWith(input);
              } else {
                return value.includes(input);
              }
            }}
            filterSort={(a, b) => {
              return (
                (sequenceMap.get(a.value.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, "")) ?? "")
                  .length -
                (sequenceMap.get(b.value.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, "")) ?? "")
                  .length
              );
            }}
          />
        </Form.Item>
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
  const maxLength = useAtomValue(maxLengthAtom);
  return (
    <Flex vertical gap="middle">
      <Typography.Title level={2}>离散性分析</Typography.Title>
      <MarginalFirstOrderDuplication />
      {range(maxLength, 0).map((x) => {
        const type = "single";
        return (
          <SubStatistics
            key={x}
            init={{ type, position: range(0, x), top: 0 }}
          />
        );
      })}
    </Flex>
  );
}
