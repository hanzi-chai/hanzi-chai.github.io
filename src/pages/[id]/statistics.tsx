import {
  ProForm,
  ProFormDependency,
  ProFormDigit,
  ProFormGroup,
  ProFormSelect,
} from "@ant-design/pro-components";
import {
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
import { useAtomValue } from "jotai";
import { isEqual, range, sumBy } from "lodash-es";
import { Suspense, useState } from "react";
import {
  useAtomValueUnwrapped,
  如组装结果原子,
  字母表原子,
  最大码长原子,
} from "~/atoms";
import { InlineRender } from "~/components/ComponentForm";
import KeySelect from "~/components/KeySelect";
import { MyProFormList } from "~/components/ResultSummary";
import { DisplayOptionalSuperscript } from "~/components/SequenceTable";
import type { 码位, 组装条目 } from "~/lib";
import { 反序列化, 序列化 } from "~/lib";
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
  合并组列表: 码位[][] = [],
) => {
  const 反向映射 = new Map<string, string[]>();
  const 相关结果 = filterRelevant(result, 分析配置);
  for (const assembly of 相关结果) {
    const { 词: name, 元素序列: sequence } = assembly;
    const sliced = range(maxLength).map((i) =>
      分析配置.position.includes(i) ? sequence[i] : "*",
    );
    const summary = JSON.stringify(
      sliced.map((x) => {
        const index = 合并组列表.findIndex((group) =>
          group.some((y) => isEqual(y, x)),
        );
        return index !== -1 ? String.fromCodePoint(0x100000 + index) : x;
      }),
    );
    反向映射.set(summary, (反向映射.get(summary) || []).concat(name));
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
  const assemblyResult = useAtomValueUnwrapped(如组装结果原子);
  const reverseMap = 分析原始重码(analyzer, assemblyResult, maxLength);
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
        const elements: (码位 | undefined)[] = JSON.parse(name);
        return (
          <Space>
            {elements.map((element, i) => (
              <DisplayOptionalSuperscript key={i} element={element ?? "ε"} />
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
  const assemblyResult = useAtomValueUnwrapped(如组装结果原子);
  const reverseMap = new Map<string, Set<string>[]>();
  const relevant = filterRelevant(assemblyResult, analyzer);
  for (const assembly of relevant) {
    const { 词, 元素序列 } = assembly;
    元素序列.forEach((x, i) => {
      const key = 序列化(x);
      if (!reverseMap.has(key))
        reverseMap.set(
          key,
          range(maxLength).map(() => new Set()),
        );
      reverseMap.get(key)?.[i]?.add(词);
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
        const element = 反序列化(record.name)!;
        if (!element.ok) return record.name;
        return <DisplayOptionalSuperscript element={element.value!} />;
      },
      width: 192,
    },
    ...range(maxLength).map((i) => ({
      title: `第${数字(i + 1)}码`,
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
        pagination={{ pageSize: 20 }}
      />
    </>
  );
};

const MarginalFirstOrderDuplication = () => {
  const assemblyResult = useAtomValueUnwrapped(如组装结果原子);
  const maxLength = useAtomValue(最大码长原子);
  const [合并组列表, 设置合并组列表] = useState([] as 码位[][]);
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
  return (
    <>
      <Typography.Title level={3}>边际一阶重码计算</Typography.Title>
      <AnalyzerConfig analyzer={analyzer} setAnalyzer={setAnalyzer} />
      <ProForm<{ content: { content: 码位[] }[] }>
        layout="horizontal"
        submitter={false}
        initialValues={{ content: 合并组列表.map((x) => ({ content: x })) }}
        onValuesChange={async (_, { content }) =>
          设置合并组列表(content.map((x) => x.content))
        }
      >
        <MyProFormList
          name="content"
          creatorButtonProps={{
            creatorButtonText: "添加一组合并",
            icon: false,
          }}
          creatorRecord={() => ({
            content: [{ element: "1", index: 0 } satisfies 码位],
          })}
        >
          <MyProFormList
            name="content"
            creatorButtonProps={{
              creatorButtonText: "添加",
              icon: false,
              style: { width: "unset" },
            }}
            itemRender={InlineRender}
            creatorRecord={() => ({ element: "1", index: 0 }) satisfies 码位}
            copyIconProps={false}
          >
            {(meta) => (
              <Form.Item noStyle {...meta}>
                {/* @ts-ignore */}
                <KeySelect allowElements />
              </Form.Item>
            )}
          </MyProFormList>
        </MyProFormList>
      </ProForm>
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
