import type { ColumnConfig, HeatmapConfig } from "@ant-design/charts";
import { blue } from "@ant-design/colors";
import {
  ProForm,
  ProFormCascader,
  ProFormGroup,
  ProFormSelect,
  ProFormSwitch,
} from "@ant-design/pro-components";
import { Flex, Form, Skeleton, Switch, Table, Typography } from "antd";
import { useAtomValue } from "jotai";
import { range, sum, sumBy } from "lodash-es";
import { Suspense, useState } from "react";
import type { 联合条目 } from "~/atoms";
import {
  useAtomValueUnwrapped,
  字母表原子,
  最大码长原子,
  联合结果原子,
  部分目标类型名称映射,
  默认当量原子,
  默认目标类型原子,
} from "~/atoms";
import {
  反序列化,
  字数,
  序列化,
  type 码表条目,
  type 部分目标类型,
} from "~/lib";
import "~/components/charts.css";
import type { ColumnsType } from "antd/es/table";
import { DisplayOptionalSuperscript } from "~/components/SequenceTable";
import { useChaifenTitle, 数字, 标准键盘, 颜色插值 } from "~/utils";

const { Column, Heatmap } = await import("~/components/export/charts");

interface 带频码表条目 extends 码表条目 {
  频率: number;
}

const 按部分目标类型过滤 = (type: 部分目标类型, combined: 联合条目[]) => {
  const result: 带频码表条目[] = [];
  for (const 条目 of combined) {
    if (type.includes("character") !== (字数(条目.词) === 1)) continue;
    const code = type.includes("full") ? 条目.全码 : 条目.简码;
    result.push({
      词: 条目.词,
      编码: code,
      频率: 条目.频率,
    });
  }
  return result;
};

interface 分布统计范围 {
  类型: 部分目标类型;
  码位: number[];
  加权: boolean;
}

type 分布结果 = Map<string, { count: number; items: string[] }>;

const 构建分布 = (
  data: 带频码表条目[],
  alphabet: string,
  config: 分布统计范围,
  多重?: boolean,
) => {
  const result: 分布结果 = new Map();
  if (多重) {
    [...alphabet].forEach((x) => {
      result.set(x, { count: 0, items: [] });
    });
  } else {
    [...alphabet].forEach((x) => {
      [...alphabet].forEach((y) => {
        result.set(x + y, { count: 0, items: [] });
      });
    });
  }
  for (const item of data) {
    const keys = config.码位.map((i) => item.编码[i]);
    const value = config.加权 ? item.频率 : 1;
    if (多重) {
      keys.forEach((k) => {
        if (!k) return;
        const previous = result.get(k) ?? { count: 0, items: [] };
        previous.count += value;
        previous.items.push(item.词);
        result.set(k, previous);
      });
    } else {
      if (!keys.every((k) => k !== undefined)) continue;
      const key = keys.join("");
      const previous = result.get(key) ?? { count: 0, items: [] };
      previous.count += value;
      previous.items.push(item.词);
      result.set(key, previous);
    }
  }
  const total = sum([...result.values()].map((x) => x.count));
  if (config.加权) {
    for (const key of result.keys()) {
      result.get(key)!.count /= total;
    }
  }
  return result;
};

const countFingering = (
  data: 带频码表条目[],
  alphabet: string,
  config: 分布统计范围,
) => {
  const result: 分布结果 = new Map();
  [...alphabet].forEach((x) => {
    [...alphabet].forEach((y) => {
      result.set(x + y, { count: 0, items: [] });
    });
  });
  for (const item of data) {
    for (const i of config.码位) {
      const string = item.编码.slice(i, i + 2);
      if (string.length < 2) continue;
      const value = config.加权 ? item.频率 : 1;
      const previous = result.get(string) ?? { count: 0, items: [] };
      previous.count += value;
      previous.items.push(item.词);
      result.set(string, previous);
    }
  }
  const total = sum([...result.values()].map((x) => x.count));
  if (config.加权) {
    for (const key of result.keys()) {
      result.get(key)!.count /= total;
    }
  }
  return result;
};

const KeyboardItem = ({
  name,
  value,
  maximum,
  dynamic,
}: {
  name: string;
  value: number;
  maximum: number;
  dynamic: boolean;
}) => {
  const formatted = dynamic ? `${(value * 100).toFixed(2)}` : value.toFixed(0);
  const color = 颜色插值("#f5f5f5", blue[4]!, value / maximum);
  return (
    <Flex
      vertical
      style={{
        width: 48,
        height: 48,
        borderRadius: 4,
        padding: "4px 8px",
        backgroundColor: color,
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <span style={{ alignSelf: "flex-start" }}>{name}</span>
      <span style={{ alignSelf: "flex-end" }}>{formatted}</span>
    </Flex>
  );
};

const format = (value: number, dynamic: boolean) =>
  dynamic ? `${(value * 100).toFixed(2)}` : value.toFixed(0);

const Keyboard = ({
  result,
  alphabet,
  dynamic,
}: {
  result: 分布结果;
  alphabet: string;
  dynamic: boolean;
}) => {
  const 实际使用的行 = 标准键盘.filter((row) =>
    row.some((key) => alphabet.includes(key)),
  );
  const maximum = Math.max(...[...result.values()].map((x) => x.count));

  return (
    <Flex vertical gap="small">
      {实际使用的行.map((row, index) => (
        <Flex key={index} gap="small" align="center">
          {row.map((key) => (
            <KeyboardItem
              key={key}
              name={key}
              value={result.get(key)?.count ?? 0}
              maximum={maximum}
              dynamic={dynamic}
            />
          ))}
          <div> </div>
          <div>
            行小计&nbsp;
            {format(
              sum(row.map((key) => result.get(key)?.count ?? 0)),
              dynamic,
            )}
          </div>
        </Flex>
      ))}
    </Flex>
  );
};

const DistributionForm = ({
  multiple,
  combination,
  config,
  setConfig,
}: {
  multiple?: boolean;
  combination?: boolean;
  config: 分布统计范围;
  setConfig: (s: 分布统计范围) => void;
}) => {
  const types = useAtomValue(默认目标类型原子);
  const maxLength = useAtomValue(最大码长原子);
  const options1d = range(maxLength).map((d) => ({
    label: `第${数字(d + 1)}码`,
    value: d,
  }));
  const options1dcomb = range(maxLength - 1).map((d) => ({
    label: `第${数字(d + 1)}／${数字(d + 2)}码`,
    value: d,
  }));
  const options = combination ? options1dcomb : options1d;
  const options2d = options1d.slice(0, maxLength - 1).map((x) => ({
    ...x,
    children: options1d.filter((y) => y.value > x.value),
  }));
  return (
    <ProForm<分布统计范围>
      layout="horizontal"
      submitter={false}
      initialValues={config}
      onValuesChange={(_, values) => setConfig(values)}
      autoFocusFirstInput={false}
    >
      <ProFormGroup>
        <ProFormSelect
          name="类型"
          label="类型"
          options={types.map((x) => ({
            label: 部分目标类型名称映射[x],
            value: x,
          }))}
        />
        {multiple ? (
          <ProFormSelect
            name="码位"
            label="维度"
            mode="multiple"
            options={options}
            allowClear={false}
          />
        ) : (
          <ProFormCascader
            name="码位"
            label="维度"
            allowClear={false}
            fieldProps={{ options: options2d }}
          />
        )}
        <ProFormSwitch name="加权" label="加权" />
      </ProFormGroup>
    </ProForm>
  );
};

const UnaryDistribution = () => {
  const maxLength = useAtomValue(最大码长原子);
  const combined = useAtomValueUnwrapped(联合结果原子);
  const alphabet = useAtomValue(字母表原子);
  const types = useAtomValue(默认目标类型原子);
  const init: 分布统计范围 = {
    类型: types[0]!,
    码位: range(0, maxLength),
    加权: false,
  };
  const [config, setConfig] = useState(init);
  const data = 按部分目标类型过滤(config.类型, combined);
  const result = 构建分布(data, alphabet, config, true);

  return (
    <>
      <Flex align="baseline" gap="large">
        <Typography.Title level={3}>一元分布</Typography.Title>
        <DistributionForm config={config} setConfig={setConfig} multiple />
      </Flex>
      <Suspense fallback={<Skeleton active />}>
        <Keyboard result={result} dynamic={config.加权} alphabet={alphabet} />
      </Suspense>
    </>
  );
};

const MatrixHeatMap = ({
  result,
  dynamic,
  isFingering,
}: {
  result: 分布结果;
  dynamic: boolean;
  isFingering?: boolean;
}) => {
  const pairEquivalence = useAtomValue(默认当量原子);
  const sequence: string[] = [];
  for (const column of range(标准键盘[0]!.length)) {
    for (const row of 标准键盘) {
      sequence.push(row[column]!);
    }
  }
  const order = sequence.join("");
  const data = [...result]
    .sort(([a], [b]) => order.indexOf(a[0]!) - order.indexOf(b[0]!))
    .sort(([a], [b]) => order.indexOf(a[1]!) - order.indexOf(b[1]!))
    .map(([key, value]) => {
      const [x, y] = [...key];
      return {
        first: x!,
        second: y!,
        equivalence: pairEquivalence.get(key) ?? 0,
        ...value,
      };
    });
  const config: HeatmapConfig = {
    data,
    xField: "second",
    yField: "first",
    axis: {
      x: {
        title: "第二码",
      },
      y: {
        title: "第一码",
      },
    },
    mark: "cell",
    colorField: isFingering ? "equivalence" : "count",
    width: 800,
    height: 800,
    tooltip: {
      title: (d: any) => `${d.first}${d.second}`,
      items: [
        {
          field: "items",
          name: "对象",
          color: false,
          valueFormatter: (items: string[]) => items.join(""),
        },
        {
          field: "count",
          name: dynamic ? "百分比" : "数量",
          color: false,
          valueFormatter: (value: number) =>
            dynamic ? (value * 100).toFixed(2) : value,
        },
        {
          field: "equivalence",
          name: "当量",
          color: false,
        },
      ],
    },
    label: {
      text: (d: any) => (dynamic ? (d.count * 100).toFixed(2) : d.count),
    },
    scale: {
      color: { range: ["#f5f5f5", blue[4]] },
    },
  };
  return <Heatmap {...config} />;
};

const BinaryDistribution = () => {
  const combined = useAtomValueUnwrapped(联合结果原子);
  const types = useAtomValue(默认目标类型原子);
  const alphabet = useAtomValue(字母表原子);
  const init: 分布统计范围 = {
    类型: types[0]!,
    码位: [0, 1],
    加权: false,
  };
  const [config, setConfig] = useState(init);
  const data = 按部分目标类型过滤(config.类型, combined);
  const result = 构建分布(data, alphabet, config);

  return (
    <>
      <Flex align="baseline" gap="large">
        <Typography.Title level={3}>二元分布</Typography.Title>
        <DistributionForm config={config} setConfig={setConfig} />
      </Flex>
      <Suspense fallback={<Skeleton active />}>
        <MatrixHeatMap result={result} dynamic={config.加权} />
      </Suspense>
    </>
  );
};

const EquivalenceColumns = ({
  result,
  dynamic,
}: {
  result: 分布结果;
  dynamic: boolean;
}) => {
  const pairEquivalence = useAtomValue(默认当量原子);
  const eqMap = new Map<number, number>();
  [...result].forEach(([key, { count }]) => {
    const equivalence = pairEquivalence.get(key) ?? 0;
    eqMap.set(equivalence, (eqMap.get(equivalence) ?? 0) + count);
  });
  const data = [...eqMap]
    .map(([key, value]) => ({
      equivalence: key,
      count: value,
    }))
    .sort((a, b) => a.equivalence - b.equivalence);
  const config: ColumnConfig = {
    data,
    title: "当量分布",
    xField: "equivalence",
    yField: "count",
    label: {
      style: {
        fill: "#f5f5f5",
      },
    },
    axis: {
      x: {
        title: "当量",
      },
      y: {
        title: dynamic ? "百分比" : "数量",
      },
    },
    meta: {
      count: {
        alias: dynamic ? "百分比" : "数量",
      },
    },
    tooltip: {
      title: "equivalence",
      items: [
        {
          field: "count",
          name: dynamic ? "百分比" : "数量",
          color: false,
          valueFormatter: (value: number) =>
            dynamic ? (value * 100).toFixed(2) : value,
        },
      ],
    },
    color: "#5B8FF9",
    width: 600,
  };
  return <Column {...config} />;
};

const FingeringDistribution = () => {
  const combined = useAtomValueUnwrapped(联合结果原子);
  const types = useAtomValue(默认目标类型原子);
  const maxLength = useAtomValue(最大码长原子);
  const init: 分布统计范围 = {
    类型: types[0]!,
    码位: range(0, maxLength - 1),
    加权: false,
  };
  const [config, setConfig] = useState(init);
  const alphabet = useAtomValue(字母表原子);
  const data = 按部分目标类型过滤(config.类型, combined);
  const result = countFingering(data, alphabet, config);
  return (
    <>
      <Flex align="baseline" gap="large">
        <Typography.Title level={3}>指法分布</Typography.Title>
        <DistributionForm
          config={config}
          setConfig={setConfig}
          multiple
          combination
        />
      </Flex>
      <Suspense fallback={<Skeleton active />}>
        <MatrixHeatMap result={result} dynamic={config.加权} isFingering />
        <EquivalenceColumns result={result} dynamic={config.加权} />
      </Suspense>
    </>
  );
};

interface DuplicationDistributionEntry {
  key: string;
  count: number;
  items: [string, string][];
}

const DuplicationDistribution = () => {
  const combined = useAtomValueUnwrapped(联合结果原子);
  const duplicationMap = new Map<string, 联合条目[]>();
  const pairMap = new Map<string, [string, string][]>();
  const [仅一字词, set仅一字词] = useState(true);

  for (const item of combined) {
    if (仅一字词 && 字数(item.词) !== 1) continue;
    const key = item.全码;
    const previous = duplicationMap.get(key) ?? [];
    previous.push(item);
    duplicationMap.set(key, previous);
  }

  for (const value of duplicationMap.values()) {
    if (value.length < 2) continue;
    for (const [iFirst, first] of value.entries()) {
      for (const [iSecond, second] of value.entries()) {
        if (iFirst >= iSecond) continue;
        const pair: [string, string] = [first.词, second.词];
        const length = Math.max(first.元素序列.length, second.元素序列.length);
        for (let i = 0; i < length; i++) {
          const k1 = 序列化(first.元素序列[i]);
          const k2 = 序列化(second.元素序列[i]);
          if (k1 === k2) continue;
          const key = `${k1} ${k2}`;
          const previous = pairMap.get(key) ?? [];
          previous.push(pair);
          pairMap.set(key, previous);
        }
      }
    }
  }

  const dataSource = [...pairMap]
    .map(([key, value]) => ({
      key,
      count: value.length,
      items: value,
    }))
    .sort((a, b) => b.count - a.count);

  const columns: ColumnsType<DuplicationDistributionEntry> = [
    {
      title: "键",
      dataIndex: "key",
      key: "key",
      width: 128,
      render: (key: string) => {
        const [first, second] = key.split(" ").map(反序列化);
        if (!first?.ok || !second?.ok) return key;
        return (
          <span>
            <DisplayOptionalSuperscript element={first.value!} />・
            <DisplayOptionalSuperscript element={second.value!} />
          </span>
        );
      },
    },
    {
      title: "数量",
      dataIndex: "count",
      key: "count",
      width: 64,
    },
    {
      title: "对象",
      dataIndex: "items",
      key: "items",
      render: (items: [string, string][]) => (
        <span>
          {items.map(([first, second]) => `${first} / ${second}`).join(", ")}
        </span>
      ),
    },
  ];
  return (
    <>
      <Flex align="baseline" gap="large">
        <Typography.Title level={3}>重码分布</Typography.Title>
        <Form.Item
          label="仅一字词"
          valuePropName="checked"
          style={{ marginBottom: 0 }}
        >
          <Switch checked={仅一字词} onChange={set仅一字词} />
        </Form.Item>
      </Flex>
      <Typography.Paragraph>
        重码总数：{sumBy([...duplicationMap.values()], (x) => x.length - 1)}
      </Typography.Paragraph>
      <Table dataSource={dataSource} columns={columns} size="small" />
    </>
  );
};

export default function Statistics() {
  useChaifenTitle("统计");
  return (
    <Flex vertical gap="middle">
      <Suspense fallback={<Skeleton active />}>
        <UnaryDistribution />
        <BinaryDistribution />
        <FingeringDistribution />
        <DuplicationDistribution />
      </Suspense>
    </Flex>
  );
}
