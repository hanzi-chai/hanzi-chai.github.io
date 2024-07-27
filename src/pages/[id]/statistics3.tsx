import { Flex, Popover, Select, Skeleton, Table } from "antd";
import {
  displayAtom,
  repertoireAtom,
  sequenceAtom,
  useChaifenTitle,
} from "~/atoms";
import { Form, Space, Typography } from "antd";
import { useAtomValue } from "jotai";
import { maxLengthAtom } from "~/atoms";
import { renderIndexed } from "~/lib";
import { Suspense, useState } from "react";
import { assemblyResultAtom } from "~/atoms";
import { range, sumBy } from "lodash-es";
import type { HeatmapConfig } from "@ant-design/charts";
import { Heatmap } from "@ant-design/charts";
import { blue } from "@ant-design/colors";
import "~/components/charts.css";

const DuplicationMatrix = () => {
  const assemblyResult = useAtomValue(assemblyResultAtom);
  const sequenceMap = useAtomValue(sequenceAtom);
  const repertoire = useAtomValue(repertoireAtom);
  const display = useAtomValue(displayAtom);
  const processed = assemblyResult.map((x) => {
    const sequence = x.sequence.map((y) => renderIndexed(y, display));
    return { sequence, name: x.name };
  });
  const hashedElements = new Set<string>();
  for (const { sequence } of assemblyResult) {
    sequence.forEach((x) => {
      hashedElements.add(renderIndexed(x, display));
    });
  }
  const allElements = [...hashedElements].sort();
  const [elements, setElements] = useState<string[]>([
    ..."氵艹口扌木亻钅土讠纟月虫忄竹女辶疒石王日足山礻火宀犭鱼卩禾广目尸酉车门马饣米贝彳雨穴舟囗匚立牛耳歹羊田弓革气白1234二三",
  ]);

  const data: { x: string; y: string; count: number; items: string[] }[] = [];

  for (const [i, x] of elements.entries()) {
    for (const [j, y] of elements.entries()) {
      if (i >= j) continue;
      if (i < 15 && j < 15) continue;
      const res: Map<string, { flag: number; items: string[] }> = new Map();
      for (const { name, sequence } of processed) {
        const key = sequence.slice(1).join("-");
        if (sequence[0] === x) {
          if (!res.has(key)) {
            res.set(key, { flag: 1, items: [] });
          }
          res.get(key)!.flag *= 2;
          res.get(key)!.items.push(name);
        } else if (sequence[0] === y) {
          if (!res.has(key)) {
            res.set(key, { flag: 1, items: [] });
          }
          res.get(key)!.flag *= 3;
          res.get(key)!.items.push(name);
        }
      }
      const count = sumBy([...res.values()], (x) => (x.flag % 6 === 0 ? 1 : 0));
      const items = [...res.values()]
        .filter((x) => x.flag % 6 === 0)
        .map((x) => x.items.join("/"));
      data.push({ x, y, count, items });
    }
  }

  const config: HeatmapConfig = {
    data,
    xField: "y",
    yField: "x",
    axis: {
      x: {
        title: "第二码",
      },
      y: {
        title: "第一码",
      },
    },
    mark: "cell",
    colorField: "count",
    width: 1100,
    height: 1000,
    label: {
      text: (d: any) => d.count,
    },
    tooltip: {
      title: "重码",
      items: [
        {
          field: "items",
          name: "重码",
          color: false,
          valueFormatter: (v: string[]) => v.join(" "),
        },
      ],
    },
    scale: {
      color: { range: [blue[4], "#f5f5f5"], domain: [0, 10] },
    },
  };
  return (
    <>
      <Typography.Title level={3}>重码矩阵</Typography.Title>
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
      </Flex>
      <Heatmap {...config} />;
    </>
  );
};

export default function Statistics3() {
  useChaifenTitle("统计");
  const maxLength = useAtomValue(maxLengthAtom);
  return (
    <Flex vertical gap="middle">
      <Typography.Title level={2}>离散性分析</Typography.Title>
      <Suspense fallback={<Skeleton active />}>
        <DuplicationMatrix />
      </Suspense>
    </Flex>
  );
}
