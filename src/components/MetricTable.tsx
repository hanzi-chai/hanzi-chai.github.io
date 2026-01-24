import "@antv/s2-react/dist/s2-react.min.css";
import { useAtomValue } from "jotai";
import {
  如编码结果原子,
  默认目标类型原子,
  部分目标类型名称映射,
  useAtomValueUnwrapped,
} from "~/atoms";
import { 指法标签列表, type 部分目标类型 } from "~/lib";
import { Flex } from "antd";
import { Select } from "./Utils";
import { useState } from "react";

interface LevelMetric {
  length: number;
  frequency: number;
}

interface TierMetric {
  top?: number;
  duplication?: number;
  levels?: LevelMetric[];
  fingering?: (number | undefined)[];
}

export interface PartialMetric {
  tiers?: TierMetric[];
  duplication?: number;
  key_distribution?: number;
  pair_equivalence?: number;
  extended_pair_equivalence?: number;
  fingering?: (number | undefined)[];
  levels?: LevelMetric[];
}

export interface Metric {
  characters_full?: PartialMetric;
  characters_short?: PartialMetric;
  words_full?: PartialMetric;
  words_short?: PartialMetric;
}

const { SheetComponent } = await import("~/components/export/s2react");

const preprocess = (partialMetric: PartialMetric) => {
  const result = [];
  for (const { top, duplication, levels, fingering } of partialMetric.tiers!) {
    const tier = top === undefined ? "全部" : `前 ${top}`;
    for (const { length, frequency: value } of levels!) {
      result.push({
        tier,
        type: "效率",
        subtype: `${length} 键`,
        value,
      });
    }
    result.push({
      tier,
      type: "离散",
      subtype: "重码",
      value: duplication,
    });
    // TODO
    result.push({
      tier,
      type: "手感",
      subtype: "当量",
      value: undefined,
    });

    if (fingering === undefined) continue;
    for (const [index, value] of fingering!.entries()) {
      if (value === undefined) continue;
      result.push({
        tier,
        type: "手感",
        subtype: 指法标签列表[index],
        value,
      });
    }
  }
  for (const { length, frequency: value } of partialMetric.levels!) {
    result.push({ tier: "加权", type: "效率", subtype: `${length} 键`, value });
  }
  const { duplication, pair_equivalence } = partialMetric;
  result.push({
    tier: "加权",
    type: "离散",
    subtype: "重码",
    value: duplication,
  });
  result.push({
    tier: "加权",
    type: "手感",
    subtype: "当量",
    value: pair_equivalence,
  });
  if (partialMetric.fingering === undefined) return result;
  for (const [index, value] of partialMetric.fingering!.entries()) {
    if (value === undefined) continue;
    result.push({
      tier: "加权",
      type: "手感",
      subtype: 指法标签列表[index],
      value,
    });
  }
  return result;
};

export default function MetricTable() {
  const [_, evaluateResult] = useAtomValueUnwrapped(如编码结果原子);
  const types = useAtomValue(默认目标类型原子);
  const [type, setType] = useState<部分目标类型>(types[0]!);
  const data = preprocess(evaluateResult[type]!);
  return (
    <>
      <Flex>
        <Select
          value={type}
          onChange={setType}
          options={types.map((x) => ({
            label: 部分目标类型名称映射[x],
            value: x,
          }))}
        />
      </Flex>
      <SheetComponent
        adaptive
        dataCfg={{
          data,
          fields: {
            rows: ["tier"],
            columns: ["type", "subtype"],
            values: ["value"],
          },
          meta: [
            {
              field: "value",
              name: "值",
              formatter: (value) => {
                if (typeof value === "number") {
                  if (value === 0) {
                    return "0";
                  }
                  if (value < 1) {
                    return `${(value * 100).toFixed(2)}%`;
                  }
                  return Number.isInteger(value)
                    ? value.toString()
                    : value.toFixed(3);
                }
                return "-";
              },
            },
            { field: "tier", name: "层级" },
            { field: "type", name: "类型" },
            { field: "subtype", name: "子类型" },
          ],
        }}
        options={{
          hierarchyType: "grid",
          frozen: {
            rowHeader: false,
          },
        }}
      />
    </>
  );
}
