import { Flex, Table } from "antd";
import {
  alphabetAtom,
  displayAtom,
  frequencyAtom,
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
import type { Frequency } from "~/atoms";
import { maxLengthAtom } from "~/atoms";
import type { AnalyzerForm, AssemblyResult } from "~/lib";
import { renderIndexed } from "~/lib";
import { Select } from "~/components/Utils";
import { useState } from "react";
import { assemblyResultAtom } from "~/atoms/cache";
import type { ColumnsType } from "antd/es/table";
import { range, sum, sumBy } from "lodash-es";

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
    const { name, sequence: elements } = assembly;
    const sliced = range(maxLength).map((i) =>
      analyzer.position.includes(i) ? elements[i] : "*",
    );
    const summary = `(${sliced.map((x) => renderIndexed(x, display)).join(", ")})`;
    reverseMap.set(summary, (reverseMap.get(summary) || []).concat(name));
  }

  return reverseMap;
};

interface Density {
  name: string;
  items: string[];
}

const SubStatistics = ({ init }: { init: AnalyzerForm }) => {
  const maxLength = useAtomValue(maxLengthAtom);
  const [analyzer, setAnalyzer] = useState(init);
  const [form] = Form.useForm<AnalyzerForm>();
  const assemblyResult = useAtomValue(assemblyResultAtom) ?? [];
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
      <Table
        dataSource={dataSource}
        columns={columns}
        size="small"
        rowKey="name"
      />
    </>
  );
};

export default function Statistics() {
  useChaifenTitle("统计");
  const maxLength = useAtomValue(maxLengthAtom);
  return (
    <Flex vertical gap="middle">
      <Typography.Title level={2}>离散性</Typography.Title>
      {range(maxLength, 0).map((x) => {
        const type = "single";
        return <SubStatistics init={{ type, position: range(0, x), top: 0 }} />;
      })}
    </Flex>
  );
}
