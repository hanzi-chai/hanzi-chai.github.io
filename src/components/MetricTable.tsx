import { SheetComponent } from "@antv/s2-react";
import "@antv/s2-react/dist/style.min.css";
import { useAtomValue } from "jotai";
import { encodeResultAtom, meaningfulObjectiveAtom } from "~/atoms";
import type { Objective } from "~/lib";
import { fingeringLabels, type PartialMetric } from "~/lib";
import { isInteger } from "mathjs";
import { Flex, Form } from "antd";
import { Select } from "./Utils";
import { useState } from "react";

const preprocess = (partialMetric: PartialMetric) => {
  const result = [];
  for (const { top, duplication, levels } of partialMetric.tiers!) {
    const tier = top === undefined ? "静态全部" : `前 ${top}`;
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
  }
  for (const { length, frequency: value } of partialMetric.levels!) {
    result.push({ tier: "全部", type: "效率", subtype: `${length} 键`, value });
  }
  const { duplication, pair_equivalence } = partialMetric;
  result.push({
    tier: "全部",
    type: "离散",
    subtype: "重码",
    value: duplication,
  });
  result.push({
    tier: "全部",
    type: "手感",
    subtype: "当量",
    value: pair_equivalence,
  });
  for (const [index, value] of partialMetric.fingering!.entries()) {
    if (value === undefined) continue;
    result.push({
      tier: "全部",
      type: "手感",
      subtype: fingeringLabels[index],
      value,
    });
  }
  return result;
};

export default function MetricTable() {
  const [_, evaluateResult] = useAtomValue(encodeResultAtom);
  const meaningfulObjective = useAtomValue(meaningfulObjectiveAtom);
  const types: (keyof Objective)[] = [];
  for (const key of Object.keys(meaningfulObjective)) {
    types.push(key as keyof Objective);
  }
  const [type, setType] = useState<keyof Objective>(types[0]!);
  const data = preprocess(evaluateResult[type]!);
  const labels: Record<keyof Objective, string> = {
    characters_full: "一字全码",
    characters_short: "一字简码",
    words_full: "多字全码",
    words_short: "多字简码",
  };
  return (
    <>
      <Flex>
        <Form.Item label="指标表">
          <Select
            value={type}
            onChange={setType}
            options={types.map((x) => ({ label: labels[x], value: x }))}
          />
        </Form.Item>
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
                  } else if (value < 1) {
                    return `${(value * 100).toFixed(2)}%`;
                  } else {
                    return isInteger(value)
                      ? value.toString()
                      : value.toFixed(3);
                  }
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
