import "@antv/s2-react/dist/s2-react.min.css";
import { Flex, Select } from "antd";
import { 指法标签列表, type 部分目标类型 } from "hanzi-chai";
import { useAtomValue } from "jotai";
import type { S2CellType } from "@antv/s2";
import { useMemo, useState } from "react";
import {
  useAtomValueUnwrapped,
  如编码结果原子,
  联合结果原子,
  部分目标类型名称映射,
  默认目标类型原子,
  type 联合条目,
} from "~/atoms";

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

const 格式化值 = (value: number) => {
  if (value === 0) {
    return "0";
  }
  if (value < 1) {
    return `${(value * 100).toFixed(2)}%`;
  }
  return Number.isInteger(value) ? value.toString() : value.toFixed(3);
};

// ===== 值格明细：点开数值单元格时显示对应的汉字（按字频排序） =====
// 口径与 libchai/src/objectives/cache.rs 逐条对齐：
// - 词列表按频率降序稳定排序，层级「前 N」= 该桶（一字/多字 × 全码/简码）内频率前 N 条
// - 效率·k键 = 码长为 k 的条目；离散·重码 = 排名 > 0（非首选）的条目
// - 手感·当量 = 层级内全部条目；手感·指法X = 编码含至少一个 X 标记相邻对的条目
// - 键对标记表与 metric.rs 的 指法标记::new 完全一致（同手/大跨/小跨/干扰/错手/三连）

const 指法位 = {
  同手: 1 << 0,
  大跨: 1 << 1,
  小跨: 1 << 2,
  干扰: 1 << 3,
  错手: 1 << 4,
  三连: 1 << 5,
};

const 构建键对标记表 = () => {
  const 左手 = [
    ["5", "4", "3", "2", "1"],
    ["t", "r", "e", "w", "q"],
    ["g", "f", "d", "s", "a"],
    ["b", "v", "c", "x", "z"],
  ];
  const 右手 = [
    ["6", "7", "8", "9", "0", "-", "="],
    ["y", "u", "i", "o", "p", "[", "]"],
    ["h", "j", "k", "l", ";", "'"],
    ["n", "m", ",", ".", "/"],
  ];
  // 每列对应的手指：0=食指 1=中指 2=无名指 3=小指
  const 列手指 = [0, 0, 1, 2, 3, 3, 3];
  const 是长手指 = (f: number) => f === 1 || f === 2;
  const table = new Map<string, number>();
  for (const 布局 of [左手, 右手]) {
    for (let 行一 = 0; 行一 < 布局.length; 行一++) {
      for (let 行二 = 0; 行二 < 布局.length; 行二++) {
        for (let 列一 = 0; 列一 < 布局[行一]!.length; 列一++) {
          for (let 列二 = 0; 列二 < 布局[行二]!.length; 列二++) {
            const 键一 = 布局[行一]![列一]!;
            const 键二 = 布局[行二]![列二]!;
            const 手指一 = 列手指[列一]!;
            const 手指二 = 列手指[列二]!;
            const 行差 = Math.abs(行一 - 行二);
            const 列差 = Math.abs(列一 - 列二);
            let bits = 指法位.同手;
            if (手指一 === 手指二) {
              if (行差 >= 2) {
                bits |= 指法位.大跨;
              } else if (行差 === 1 || 列差 === 1) {
                bits |= 指法位.小跨;
              }
            }
            if (
              (手指一 === 3 && 手指二 >= 1) ||
              (手指二 === 3 && 手指一 >= 1)
            ) {
              bits |= 指法位.干扰;
            }
            if (
              (是长手指(手指一) && 行一 > 行二 + 1) ||
              (是长手指(手指二) && 行二 > 行一 + 1)
            ) {
              bits |= 指法位.错手;
            }
            table.set(键一 + 键二, bits);
          }
        }
      }
    }
  }
  return table;
};

const 键对标记表 = 构建键对标记表();

const 计算编码标记 = (编码: string) => {
  let bits = 0;
  for (let i = 0; i + 1 < 编码.length; i++) {
    bits |= 键对标记表.get(编码.slice(i, i + 2)) ?? 0;
  }
  for (let i = 0; i + 2 < 编码.length; i++) {
    if (编码[i] === 编码[i + 1] && 编码[i + 1] === 编码[i + 2]) {
      bits |= 指法位.三连;
      break;
    }
  }
  return bits;
};

interface 明细条目 {
  词: string;
  频率: number;
}

const 构建明细映射 = (
  combined: 联合条目[],
  type: 部分目标类型,
  partialMetric: PartialMetric,
) => {
  const map = new Map<string, 明细条目[]>();
  const 是一字 = type.includes("character");
  const 用全码 = type.includes("full");
  const bucket = combined
    .filter((x) => (x.词.length === 1) === 是一字)
    .map((x) => ({
      词: x.词.map((c) => c.获取名称()).join(""),
      频率: x.频率,
      码长: (用全码 ? x.全码 : x.简码).length,
      重码: (用全码 ? x.全码排名 : x.简码排名) > 0,
      标记: 计算编码标记(用全码 ? x.全码 : x.简码),
    }))
    .sort((a, b) => b.频率 - a.频率);
  const 层级列表: { tier: string; top?: number; lengths: number[] }[] = [
    ...(partialMetric.tiers ?? []).map((t) => ({
      tier: t.top === undefined ? "全部" : `前 ${t.top}`,
      top: t.top,
      lengths: (t.levels ?? []).map((l) => l.length),
    })),
    {
      tier: "加权",
      lengths: (partialMetric.levels ?? []).map((l) => l.length),
    },
  ];
  for (const { tier, top, lengths } of 层级列表) {
    const scope =
      top === undefined ? bucket : bucket.slice(0, top);
    const 收录 = (kind: string, subtype: string, items: 明细条目[]) =>
      map.set(`${tier}|${kind}|${subtype}`, items);
    for (const length of lengths) {
      收录(
        "效率",
        `${length} 键`,
        scope.filter((x) => x.码长 === length),
      );
    }
    收录(
      "离散",
      "重码",
      scope.filter((x) => x.重码),
    );
    收录("手感", "当量", scope);
    for (const label of Object.keys(指法位) as (keyof typeof 指法位)[]) {
      const bit = 指法位[label];
      收录(
        "手感",
        label,
        scope.filter((x) => (x.标记 & bit) !== 0),
      );
    }
  }
  return map;
};

const 值格明细 = ({
  cell,
  明细映射,
}: {
  cell: S2CellType;
  明细映射: Map<string, 明细条目[]>;
}) => {
  const meta = cell.getMeta?.() as
    | {
        rowQuery?: { tier?: string };
        colQuery?: { type?: string; subtype?: string };
        fieldValue?: number;
      }
    | undefined;
  const tier = meta?.rowQuery?.tier;
  const type = meta?.colQuery?.type;
  const subtype = meta?.colQuery?.subtype;
  const value = meta?.fieldValue;
  const items = 明细映射.get(`${tier}|${type}|${subtype}`);
  return (
    <div style={{ maxWidth: 460 }}>
      <div>
        {tier} · {type} · {subtype}：{typeof value === "number" ? 格式化值(value) : "-"}
        {items !== undefined && `（共 ${items.length} 字）`}
      </div>
      <div
        style={{
          marginTop: 4,
          maxHeight: 300,
          overflowY: "auto",
          lineHeight: 1.8,
          wordBreak: "break-all",
        }}
      >
        {items === undefined || items.length === 0
          ? "无对应汉字"
          : items.map((x) => x.词).join(" ")}
      </div>
    </div>
  );
};

export default function MetricTable() {
  const [_, evaluateResult] = useAtomValueUnwrapped(如编码结果原子);
  const combined = useAtomValueUnwrapped(联合结果原子);
  const types = useAtomValue(默认目标类型原子);
  const [type, setType] = useState<部分目标类型>(types[0]!);
  const data = preprocess(evaluateResult[type]!);
  const 明细映射 = useMemo(
    () => 构建明细映射(combined, type, evaluateResult[type]!),
    [combined, type, evaluateResult],
  );
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
                  return 格式化值(value);
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
          tooltip: {
            dataCell: {
              content: (cell) => <值格明细 cell={cell} 明细映射={明细映射} />,
            },
          },
        }}
      />
    </>
  );
}
