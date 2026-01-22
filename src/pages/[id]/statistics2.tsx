import { Flex, Skeleton, Table } from "antd";
import type { Combined } from "~/atoms";
import {
  字母表原子,
  combinedResultAtom,
  adaptedFrequencyAtom,
  默认目标类型原子,
  默认双键当量原子,
  typeLabels,
  useChaifenTitle,
} from "~/atoms";
import {
  ProForm,
  ProFormCascader,
  ProFormGroup,
  ProFormSelect,
  ProFormSwitch,
} from "@ant-design/pro-components";
import { Typography } from "antd";
import { useAtomValue } from "jotai";
import { 最大码长原子 } from "~/atoms";
import { type 部分目标类型, type 频率映射, 序列化, 反序列化 } from "~/lib";
import { Suspense, useState } from "react";
import { range, sum, sumBy } from "lodash-es";
import { blue } from "@ant-design/colors";
import type { ColumnConfig, HeatmapConfig } from "@ant-design/charts";
import "~/components/charts.css";
import type { ColumnsType } from "antd/es/table";
import { DisplayOptionalSuperscript } from "~/components/SequenceTable";

const { Column, Heatmap } = await import("~/components/export/charts");

function interpolate(color1: string, color2: string, percent: number) {
  // Convert the hex colors to RGB values
  const r1 = Number.parseInt(color1.substring(1, 3), 16);
  const g1 = Number.parseInt(color1.substring(3, 5), 16);
  const b1 = Number.parseInt(color1.substring(5, 7), 16);

  const r2 = Number.parseInt(color2.substring(1, 3), 16);
  const g2 = Number.parseInt(color2.substring(3, 5), 16);
  const b2 = Number.parseInt(color2.substring(5, 7), 16);

  // Interpolate the RGB values
  const r = Math.round(r1 + (r2 - r1) * percent);
  const g = Math.round(g1 + (g2 - g1) * percent);
  const b = Math.round(b1 + (b2 - b1) * percent);

  // Convert the interpolated RGB values back to a hex color
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
const filterType = (type: 部分目标类型, combined: Combined[]) => {
  const filtered = type.includes("character")
    ? combined.filter((item) => [...item.词].length === 1)
    : combined.filter((item) => [...item.词].length > 1);
  return type.includes("full")
    ? filtered.map((item) => ({
        name: item.词,
        code: item.full,
        importance: item.频率,
      }))
    : filtered.map((item) => ({
        name: item.词,
        code: item.short,
        importance: item.频率,
      }));
};

interface DistributionConfig {
  type: 部分目标类型;
  index: number[];
  dynamic: boolean;
}

type DistributionResult = Map<string, { count: number; items: string[] }>;

const count = (
  data: { name: string; code: string; importance: number }[],
  alphabet: string,
  frequency: 频率映射,
  config: DistributionConfig,
  multiple?: boolean,
) => {
  const result: DistributionResult = new Map();
  if (multiple) {
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
    const keys = config.index.map((i) => item.code[i]);
    const value = config.dynamic
      ? (frequency.get(item.name) ?? 0) * item.importance
      : 1;
    if (multiple) {
      keys.forEach((k) => {
        if (!k) return;
        const previous = result.get(k) ?? { count: 0, items: [] };
        previous.count += value;
        previous.items.push(item.name);
        result.set(k, previous);
      });
    } else {
      if (!keys.every((k) => k)) continue;
      const key = keys.join("");
      const previous = result.get(key) ?? { count: 0, items: [] };
      previous.count += value;
      previous.items.push(item.name);
      result.set(key, previous);
    }
  }
  const total = sum([...result.values()].map((x) => x.count));
  if (config.dynamic) {
    for (const key of result.keys()) {
      result.get(key)!.count /= total;
    }
  }
  return result;
};

const countFingering = (
  data: { name: string; code: string; importance: number }[],
  alphabet: string,
  frequency: 频率映射,
  config: DistributionConfig,
) => {
  const result: DistributionResult = new Map();
  [...alphabet].forEach((x) => {
    [...alphabet].forEach((y) => {
      result.set(x + y, { count: 0, items: [] });
    });
  });
  for (const item of data) {
    for (const i of config.index) {
      const string = item.code.slice(i, i + 2);
      if (string.length < 2) continue;
      const value = config.dynamic
        ? (frequency.get(item.name) ?? 0) * item.importance
        : 1;
      const previous = result.get(string) ?? { count: 0, items: [] };
      previous.count += value;
      previous.items.push(item.name);
      result.set(string, previous);
    }
  }
  const total = sum([...result.values()].map((x) => x.count));
  if (config.dynamic) {
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
  const color = interpolate("#f5f5f5", blue[4]!, value / maximum);
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
  result: DistributionResult;
  alphabet: string;
  dynamic: boolean;
}) => {
  const keys = [
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
    ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
    ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";"],
    ["z", "x", "c", "v", "b", "n", "m", ",", ".", "/"],
  ];
  if (keys[0]?.every((x) => !alphabet.includes(x))) {
    keys.shift();
  }
  const maximum = Math.max(...[...result.values()].map((x) => x.count));

  return (
    <Flex vertical gap="small">
      {keys.map((row, index) => (
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
  config: DistributionConfig;
  setConfig: (s: DistributionConfig) => void;
}) => {
  const types = useAtomValue(默认目标类型原子);
  const maxLength = useAtomValue(最大码长原子);
  const options1d = range(maxLength).map((d) => ({
    label: `第 ${d + 1} 码`,
    value: d,
  }));
  const options1dcomb = range(maxLength - 1).map((d) => ({
    label: `第 ${d} / ${d + 1} 码`,
    value: d,
  }));
  const options = combination ? options1dcomb : options1d;
  const options2d = options1d.slice(0, maxLength - 1).map((x) => ({
    ...x,
    children: options1d.filter((y) => y.value > x.value),
  }));
  return (
    <ProForm<DistributionConfig>
      layout="horizontal"
      submitter={false}
      initialValues={config}
      onValuesChange={(_, values) => setConfig(values)}
      autoFocusFirstInput={false}
    >
      <ProFormGroup>
        <ProFormSelect
          name="type"
          label="类型"
          options={types.map((x) => ({ label: typeLabels[x], value: x }))}
        />
        {multiple ? (
          <ProFormSelect
            name="index"
            label="维度"
            mode="multiple"
            options={options}
            allowClear={false}
          />
        ) : (
          <ProFormCascader
            name="index"
            label="维度"
            allowClear={false}
            fieldProps={{ options: options2d }}
          />
        )}
        <ProFormSwitch name="dynamic" label="加权" />
      </ProFormGroup>
    </ProForm>
  );
};

const UnaryDistribution = () => {
  const maxLength = useAtomValue(最大码长原子);
  const combined = useAtomValue(combinedResultAtom);
  const alphabet = useAtomValue(字母表原子);
  const types = useAtomValue(默认目标类型原子);
  const init: DistributionConfig = {
    type: types[0]!,
    index: range(0, maxLength),
    dynamic: true,
  };
  const [config, setConfig] = useState(init);
  const data = filterType(config.type, combined);
  const frequency = useAtomValue(adaptedFrequencyAtom);
  const result = count(data, alphabet, frequency, config, true);

  return (
    <>
      <Flex align="baseline" gap="large">
        <Typography.Title level={3}>一元分布</Typography.Title>
        <DistributionForm config={config} setConfig={setConfig} multiple />
      </Flex>
      <Suspense fallback={<Skeleton active />}>
        <Keyboard
          result={result}
          dynamic={config.dynamic}
          alphabet={alphabet}
        />
      </Suspense>
    </>
  );
};

const customCompare = (a: string, b: string) => {
  const order = "1qaz2wsx3edc4rfv5tgb6yhn7ujm8ik,9ol.0p;/";
  const a_value = order.indexOf(a[0]!) * 1000 + order.indexOf(a[1]!);
  const b_value = order.indexOf(b[0]!) * 1000 + order.indexOf(b[1]!);
  return a_value - b_value;
};

const MatrixHeatMap = ({
  result,
  dynamic,
  isFingering,
}: {
  result: DistributionResult;
  dynamic: boolean;
  isFingering?: boolean;
}) => {
  const pairEquivalence = useAtomValue(默认双键当量原子);
  const data = [...result]
    .sort((a, b) => customCompare(a[0], b[0]))
    .map(([key, value]) => {
      const [x, y] = [...key];
      return {
        first: x!,
        second: y!,
        equivalence: pairEquivalence[key] ?? 0,
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
  const combined = useAtomValue(combinedResultAtom);
  const types = useAtomValue(默认目标类型原子);
  const alphabet = useAtomValue(字母表原子);
  const init: DistributionConfig = {
    type: types[0]!,
    index: [0, 1],
    dynamic: false,
  };
  const [config, setConfig] = useState(init);
  const data = filterType(config.type, combined);
  const frequency = useAtomValue(adaptedFrequencyAtom);
  const result = count(data, alphabet, frequency, config);

  return (
    <>
      <Flex align="baseline" gap="large">
        <Typography.Title level={3}>二元分布</Typography.Title>
        <DistributionForm config={config} setConfig={setConfig} />
      </Flex>
      <Suspense fallback={<Skeleton active />}>
        <MatrixHeatMap result={result} dynamic={config.dynamic} />
      </Suspense>
    </>
  );
};

const EquivalenceColumns = ({
  result,
  dynamic,
}: {
  result: DistributionResult;
  dynamic: boolean;
}) => {
  const pairEquivalence = useAtomValue(默认双键当量原子);
  const eqMap = new Map<number, number>();
  [...result].forEach(([key, { count }]) => {
    const equivalence = pairEquivalence[key] ?? 0;
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
  const combined = useAtomValue(combinedResultAtom);
  const types = useAtomValue(默认目标类型原子);
  const maxLength = useAtomValue(最大码长原子);
  const init: DistributionConfig = {
    type: types[0]!,
    index: range(0, maxLength - 1),
    dynamic: false,
  };
  const [config, setConfig] = useState(init);
  const alphabet = useAtomValue(字母表原子);
  const data = filterType(config.type, combined);
  const frequency = useAtomValue(adaptedFrequencyAtom);
  const result = countFingering(data, alphabet, frequency, config);
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
        <MatrixHeatMap result={result} dynamic={config.dynamic} isFingering />
        <EquivalenceColumns result={result} dynamic={config.dynamic} />
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
  const combined = useAtomValue(combinedResultAtom);
  const duplicationMap = new Map<string, Combined[]>();
  const pairMap = new Map<string, [string, string][]>();

  for (const item of combined) {
    const key = item.full;
    const previous = duplicationMap.get(key) ?? [];
    previous.push(item);
    duplicationMap.set(key, previous);
  }

  for (const [key, value] of duplicationMap) {
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
        return (
          <span>
            <DisplayOptionalSuperscript element={first!} />・
            <DisplayOptionalSuperscript element={second!} />
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
      <Typography.Title level={3}>重码分布</Typography.Title>
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
