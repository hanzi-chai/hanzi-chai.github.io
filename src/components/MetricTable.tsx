import "@antv/s2-react/dist/s2-react.min.css";
import { useAtomValue } from "jotai";
import { encodeResultAtom, meaningfulTypesAtom, typeLabels } from "~/atoms";
import type { Objective, PartialWeightTypes } from "~/lib";
import { fingeringLabels, type PartialMetric } from "~/lib";
import { Flex } from "antd";
import { Select } from "./Utils";
import { useState } from "react";

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
    for (const [index, value] of fingering?.entries()) {
      if (value === undefined) continue;
      result.push({
        tier,
        type: "手感",
        subtype: fingeringLabels[index],
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
  for (const [index, value] of partialMetric.fingering?.entries()) {
    if (value === undefined) continue;
    result.push({
      tier: "加权",
      type: "手感",
      subtype: fingeringLabels[index],
      value,
    });
  }
  return result;
};

export default function MetricTable() {
  const [_, evaluateResult] = useAtomValue(encodeResultAtom);
  const types = useAtomValue(meaningfulTypesAtom);
  const [type, setType] = useState<PartialWeightTypes>(types[0]!);
  const data = preprocess(evaluateResult[type]!);
  return (
    <>
      <Flex>
        <Select
          value={type}
          onChange={setType}
          options={types.map((x) => ({ label: typeLabels[x], value: x }))}
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
