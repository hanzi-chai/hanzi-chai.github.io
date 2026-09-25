import {
  Button,
  Flex,
  Input,
  InputNumber,
  Popover,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  下转换,
  生成,
  是强类型归并,
  决策图,
  构建强类型决策与决策空间,
  组装,
  type 强类型决策,
  type 强类型元素位或编码,
  type 组装条目,
} from "hanzi-chai";
import { useAtom, useAtomValue } from "jotai";
import { range, sumBy } from "lodash-es";
import { useMemo, useState } from "react";
import {
  useAtomValueUnwrapped,
  如编码结果原子,
  如前端输入原子,
  如带归并组装结果原子,
  如字库原子,
  全部合法元素原子,
  汉字集合原子,
  拼音分析结果原子,
  默认目标原子,
  决策原子,
  决策空间原子,
  选择键原子,
  配置原子,
  最大码长原子,
  字母表原子,
  字形分析配置原子,
  组装配置原子,
} from "~/atoms";
import { thread, type 编码结果 } from "~/utils";

export const combinations = (n: number, k: number): number[][] => {
  const result: number[][] = [];
  const dfs = (start: number, current: number[]) => {
    if (current.length === k) {
      result.push([...current]);
      return;
    }
    for (let i = start; i < n; i++) {
      dfs(i + 1, [...current, i]);
    }
  };
  dfs(0, []);
  return result;
};

export const 模式名称 = (空位: number[]) =>
  空位.length === 0 ? "全保留" : `空${空位.map((x) => 数字标签(x + 1)).join("")}码`;

const 数字标签 = (n: number) => "零一二三四五六七八九十"[n] ?? String(n);

/** 与 如带归并组装结果原子 相同的归并展开后处理 */
const 带归并处理 = (组装结果: 组装条目[], 决策: 强类型决策): 组装条目[] => {
  const out: 组装条目[] = [];
  for (const 条目 of 组装结果) {
    const 新元素序列: 强类型元素位或编码[] = [];
    for (const 码位 of 条目.元素序列.元素序列) {
      if (typeof 码位 === "string") {
        新元素序列.push(码位);
        continue;
      }
      let 当前码位 = 码位;
      let i = 0;
      while (true) {
        i += 1;
        if (i > 100) break;
        const 安排 = 决策.get(当前码位.element);
        if (!安排) break;
        if (是强类型归并(安排)) {
          当前码位 = { ...当前码位, element: 安排.element };
        } else if (Array.isArray(安排)) {
          const 引用码位 = 安排[当前码位.index];
          if (引用码位 === undefined || typeof 引用码位 === "string") {
            break;
          } else {
            当前码位 = 引用码位;
          }
        } else {
          break;
        }
      }
      新元素序列.push(当前码位);
    }
    out.push({ ...条目, 元素序列: { 元素序列: 新元素序列 } });
  }
  return out;
};

interface 表配置 {
  id: number;
  类型: "阶重" | "四码率" | "二简率";
  模式: number[][];
  top: number;
  权重: number;
}

let 表序号 = 0;

/** 按模式分组：保留非空位码位的元素序列（布局无关），返回 键→词列表 */
const 分组按模式 = (
  条目列表: 组装条目[],
  空位: number[],
  maxLength: number,
  top: number,
) => {
  const relevant = [...条目列表]
    .sort((a, b) => b.频率 - a.频率)
    .filter((x) => [...x.词].length === 1);
  const scope = top > 0 ? relevant.slice(0, top) : relevant;
  const map = new Map<string, string[]>();
  for (const 条目 of scope) {
    const 键 = JSON.stringify(
      条目.元素序列.元素序列.map((码位, i) =>
        空位.includes(i) ? "*" : 下转换(码位 as any),
      ),
    );
    const 词 = 条目.词.map((c) => c.获取名称()).join("");
    map.set(键, [...(map.get(键) ?? []), 词]);
  }
  return map;
};

const 估计选重 = (
  分组: Map<string, string[]>,
  空位: number[],
  alphabetSize: number,
) => {
  const space = alphabetSize ** 空位.length;
  let total = 0;
  分组.forEach((items) => {
    total +=
      空位.length === 0
        ? Math.max(0, items.length - 1)
        : (items.length * items.length) / 2 / space;
  });
  return total;
};

/** 码长统计：从码表计算 [总频率, 四码频率, 二码频率]（按简码核心长度） */
const 码长统计 = (
  码表: 编码结果,
  频率表: Map<string, number>,
  选择键: string[],
  top: number,
) => {
  const 核心长度 = (简码: string) => {
    let s = 简码;
    while (s.length > 0 && 选择键.includes(s.at(-1)!)) {
      s = s.slice(0, -1);
    }
    return s.length;
  };
  const relevant = [...码表]
    .sort((a, b) => (频率表.get(b.词) ?? 0) - (频率表.get(a.词) ?? 0))
    .filter((x) => 频率表.has(x.词));
  const scope = top > 0 ? relevant.slice(0, top) : relevant;
  let 总 = 0;
  let 四码 = 0;
  let 二码 = 0;
  for (const 条目 of scope) {
    const f = 频率表.get(条目.词) ?? 0;
    总 += f;
    const len = 核心长度(条目.简码);
    if (len === 4) 四码 += f;
    if (len === 2) 二码 += f;
  }
  return { 总, 四码, 二码 };
};

export default function RootAdditionAnalyzer() {
  const maxLength = useAtomValue(最大码长原子);
  const alphabet = useAtomValue(字母表原子);
  const 基线 = useAtomValueUnwrapped(如带归并组装结果原子);
  const 字形分析配置 = useAtomValueUnwrapped(字形分析配置原子);
  const 组装配置基线 = useAtomValueUnwrapped(组装配置原子);
  const 拼音分析 = useAtomValue(拼音分析结果原子);
  const 汉字集合 = useAtomValue(汉字集合原子);
  const 字库 = useAtomValueUnwrapped(如字库原子);
  const { 名称映射 } = useAtomValueUnwrapped(全部合法元素原子);
  const 配置 = useAtomValue(配置原子);
  const 决策 = useAtomValue(决策原子);
  const 决策空间 = useAtomValue(决策空间原子);
  const 目标 = useAtomValue(默认目标原子);
  const 基线编码 = useAtomValueUnwrapped(如编码结果原子);
  const 基线输入 = useAtomValueUnwrapped(如前端输入原子);
  const [选择键] = useAtom(选择键原子);

  const [根名, 设根名] = useState("");
  const [键位, 设键位] = useState("");
  const [运行中, 设运行中] = useState(false);
  const [错误, 设错误] = useState("");
  const [已完成根, 设已完成根] = useState("");
  const [候选, 设候选] = useState<{
    组装: 组装条目[];
    码表: 编码结果;
  } | null>(null);
  const [表列表, 设表列表] = useState<表配置[]>([
    { id: 表序号++, 类型: "阶重", 模式: [], top: 0, 权重: 1 },
    { id: 表序号++, 类型: "四码率", 模式: [], top: 0, 权重: 1 },
    { id: 表序号++, 类型: "二简率", 模式: [], top: 0, 权重: 1 },
  ]);

  const 频率表 = useMemo(
    () =>
      new Map<string, number>(
        ((基线 ?? []) as 组装条目[]).map((x) => [
          x.词.map((c) => c.获取名称()).join(""),
          x.频率,
        ]),
      ),
    [基线],
  );
  const 总频率 = useMemo(
    () => sumBy([...频率表.values()], (x) => x),
    [频率表],
  );
  const 全部模式 = useMemo(
    () => range(maxLength + 1).flatMap((阶) => combinations(maxLength, 阶)),
    [maxLength],
  );

  const 分析 = async () => {
    设错误("");
    if (!根名 || !键位) {
      设错误("请输入根和键位");
      return;
    }
    if (!名称映射.has(根名)) {
      设错误(`「${根名}」不是字库中的合法元素`);
      return;
    }
    if (决策[根名] !== undefined) {
      设错误(`「${根名}」已在方案的键位映射中`);
      return;
    }
    for (const c of 键位) {
      if (!alphabet.includes(c)) {
        设错误(`键位「${c}」不在字母表 ${alphabet} 中`);
        return;
      }
    }
    设运行中(true);
    try {
      // 1. 候选决策（加入新根）
      const 候选决策Record = { ...决策, [根名]: 键位 };
      const 强 = 构建强类型决策与决策空间(
        候选决策Record,
        决策空间,
        名称映射,
      );
      const 如线性化 = new 决策图(强.决策).线性化();
      if (!如线性化.ok) throw 如线性化.error;
      // 2. 候选拆分
      const 字形分析 = (字库 as any).分析(
        {
          ...字形分析配置,
          决策: 强.决策,
          决策空间: 强.决策空间,
          线性化决策: 如线性化.value,
        },
        汉字集合,
      );
      if (!字形分析.ok) throw 字形分析.error;
      // 3. 候选组装
      const 组装结果 = 组装(
        {
          ...组装配置基线,
          决策: 强.决策,
          决策空间: 强.决策空间,
          线性化决策: 如线性化.value,
        },
        拼音分析,
        字形分析.value,
      );
      if (!组装结果.ok) throw 组装结果.error;
      const 候选带归并 = 带归并处理(组装结果.value, 强.决策);
      // 4. 候选码表（worker 模拟编码）
      const 候选生成配置 = 生成({
        ...配置,
        form: {
          ...配置.form,
          mapping: { ...配置.form.mapping, [根名]: 键位 },
        },
      } as any);
      const 候选词列表 = 组装结果.value.map((x) => ({
        词: x.词.map((v) => v.获取名称()).join(""),
        全部元素序列: [
          {
            元素序列: x.元素序列.元素序列.map((c: any) => 下转换(c)),
            条件列表: [],
          },
        ],
        频率: x.频率,
      }));
      const [候选码表] = await thread.spawn<[编码结果, unknown]>("encode", [
        {
          ...(基线输入 as any),
          配置: 候选生成配置,
          词列表: 候选词列表,
        },
        目标,
      ]);
      设候选({ 组装: 候选带归并, 码表: 候选码表 });
      设已完成根(`${根名}→${键位}`);
    } catch (e: any) {
      设错误(String(e?.message ?? e));
      设候选(null);
    } finally {
      设运行中(false);
    }
  };

  /** 单个阶重模式的降低量与降低的字 */
  const 阶重降低 = (空位: number[]) => {
    const 基线分组 = 分组按模式(基线 ?? [], 空位, maxLength, 0);
    const 候选分组 = 分组按模式(候选!.组装, 空位, maxLength, 0);
    const 基线值 = 估计选重(基线分组, 空位, alphabet.length);
    const 候选值 = 估计选重(候选分组, 空位, alphabet.length);
    const 减少字集合 = new Set<string>();
    基线分组.forEach((items, 键) => {
      const 候选词 = 候选分组.get(键);
      if (候选词 && 候选词.length < items.length) {
        for (const w of items) 减少字集合.add(w);
      }
    });
    return {
      基线: 基线值,
      候选: 候选值,
      降低: 基线值 - 候选值,
      减少字: [...减少字集合],
    };
  };

  const 率降低 = (类型: "四码率" | "二简率", top: number) => {
    if (!基线编码 || !候选) return null;
    const 基线统计 = 码长统计(基线编码[0], 频率表, 选择键, top);
    const 候选统计 = 码长统计(候选.码表, 频率表, 选择键, top);
    if (类型 === "四码率") {
      const 基线率 = 基线统计.总 > 0 ? 基线统计.四码 / 基线统计.总 : 0;
      const 候选率 = 候选统计.总 > 0 ? 候选统计.四码 / 候选统计.总 : 0;
      return { 基线: 基线率, 候选: 候选率, 降低: 基线率 - 候选率 };
    }
    const 基线率 = 基线统计.总 > 0 ? 基线统计.二码 / 基线统计.总 : 0;
    const 候选率 = 候选统计.总 > 0 ? 候选统计.二码 / 候选统计.总 : 0;
    return { 基线: 基线率, 候选: 候选率, 降低: 候选率 - 基线率 };
  };

  const 渲染表 = (表: 表配置) => {
    if (表.类型 === "阶重") {
      const 模式 = 表.模式.length > 0 ? 表.模式 : 全部模式;
      const 行 = 模式.map((空位) => {
        const r = 候选 ? 阶重降低(空位) : null;
        return {
          key: 空位.join("-"),
          模式: 模式名称(空位),
          阶: 空位.length,
          基线: r ? Math.round(r.基线) : "—",
          加根后: r ? Math.round(r.候选) : "—",
          降低: r
            ? Math.round(r.降低 * 100) / 100
            : "—",
          减少字: r?.减少字 ?? [],
        };
      });
      const 总降低 = sumBy(行, (x) => (typeof x.降低 === "number" ? x.降低 : 0));
      const columns: ColumnsType<(typeof 行)[number]> = [
        { title: "阶", dataIndex: "阶", key: "阶", width: 56 },
        { title: "模式", dataIndex: "模式", key: "模式", width: 110 },
        { title: "基线", dataIndex: "基线", key: "基线", width: 90 },
        { title: "加根后", dataIndex: "加根后", key: "加根后", width: 90 },
        {
          title: "降低",
          dataIndex: "降低",
          key: "降低",
          width: 90,
          render: (v, record) =>
            typeof v === "number" ? (
              <Popover
                content={
                  <div className="max-w-120">
                    减少了{" "}
                    {record.减少字.length <= 100
                      ? record.减少字.join("、")
                      : `${record.减少字.slice(0, 100).join("、")} 等共 ${record.减少字.length} 个字`}
                    的重
                  </div>
                }
              >
                <span className={v > 0 ? "text-green-600" : v < 0 ? "text-red-500" : ""}>
                  {v > 0 ? `−${v}` : String(v)}
                </span>
              </Popover>
            ) : (
              "—"
            ),
        },
      ];
      return (
        <>
          <Table
            dataSource={行}
            columns={columns}
            size="small"
            pagination={false}
            summary={() => (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={4}>
                  <Typography.Text strong>总降低（选重估计）</Typography.Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={4}>
                  <Typography.Text strong>
                    {Math.round(总降低 * 100) / 100}
                  </Typography.Text>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            )}
          />
        </>
      );
    }
    // 四码率 / 二简率
    const r = 候选 ? 率降低(表.类型, 表.top) : null;
    const 百分 = (x: number) => `${(x * 100).toFixed(2)}%`;
    const label = 表.类型 === "四码率" ? "四码率降低" : "二简率增加";
    return (
      <Table
        dataSource={[
          {
            key: 表.类型,
            基线: r ? 百分(r.基线) : "—",
            加根后: r ? 百分(r.候选) : "—",
            变化: r ? 百分(r.降低) : "—",
          },
        ]}
        columns={[
          { title: "基线", dataIndex: "基线", key: "基线" },
          { title: "加根后", dataIndex: "加根后", key: "加根后" },
          {
            title: label,
            dataIndex: "变化",
            key: "变化",
            render: (v: string) =>
              v.startsWith("-") ? (
                <span className="text-red-500">{v}</span>
              ) : (
                <span className="text-green-600">{v}</span>
              ),
          },
        ]}
        size="small"
        pagination={false}
      />
    );
  };

  const 表的值 = (表: 表配置): number | null => {
    if (!候选) return null;
    if (表.类型 === "阶重") {
      const 模式 = 表.模式.length > 0 ? 表.模式 : 全部模式;
      return sumBy(模式, (空位) => 阶重降低(空位).降低);
    }
    return 率降低(表.类型, 表.top)?.降低 ?? null;
  };

  const 总预期值 = sumBy(
    表列表,
    (表) => (表的值(表) ?? 0) * 表.权重,
  );

  return (
    <>
      <Typography.Title level={3}>加根分析器</Typography.Title>
      <Typography.Paragraph type="secondary">
        输入一个候选字根及其键位安排（双编码方案输两位，如 qj），系统将重新拆分并模拟编码，对比各阶重、四码率、二简率的变化。各表可增删、自定义范围与权重，底部为加权总预期值。
      </Typography.Paragraph>
      <Flex gap="small" align="center" wrap="wrap">
        <Input
          className="w-24"
          placeholder="根（如 亻）"
          value={根名}
          onChange={(e) => 设根名(e.target.value)}
        />
        <Input
          className="w-24"
          placeholder="键位（如 qj）"
          value={键位}
          onChange={(e) => 设键位(e.target.value)}
        />
        <Button type="primary" onClick={分析} loading={运行中}>
          分析
        </Button>
        {已完成根 && !运行中 && 候选 && (
          <Tag color="green">已分析：{已完成根}</Tag>
        )}
        {错误 && <Typography.Text type="danger">{错误}</Typography.Text>}
      </Flex>
      {运行中 && <Spin tip="正在重新拆分与模拟编码……" />}
      {候选 && (
        <Flex vertical gap="middle">
          {表列表.map((表) => (
            <div key={表.id} className="border rounded p-2">
              <Flex gap="small" align="center" wrap="wrap" className="mb-2">
                <Tag>{表.类型}</Tag>
                {表.类型 === "阶重" && (
                  <Select
                    mode="multiple"
                    allowClear
                    placeholder="选择空位模式（默认全部）"
                    value={表.模式}
                    className="min-w-72"
                    options={range(maxLength + 1).map((阶) => ({
                      label: `${数字标签(阶)}阶`,
                      options: combinations(maxLength, 阶).map((空位) => ({
                        label: 模式名称(空位),
                        value: JSON.stringify(空位),
                      })),
                    }))}
                    onChange={(vs: any) =>
                      设表列表(
                        表列表.map((t) =>
                          t.id === 表.id
                            ? {
                                ...t,
                                模式: (vs as string[]).map((v) =>
                                  JSON.parse(v) as number[],
                                ),
                              }
                            : t,
                        ),
                      )
                    }
                  />
                )}
                <Space>
                  范围前
                  <InputNumber
                    min={0}
                    value={表.top || undefined}
                    placeholder="全部"
                    onChange={(v) =>
                      设表列表(
                        表列表.map((t) =>
                          t.id === 表.id ? { ...t, top: v ?? 0 } : t,
                        ),
                      )
                    }
                  />
                  字
                </Space>
                <Space>
                  权重
                  <InputNumber
                    step={0.1}
                    value={表.权重}
                    onChange={(v) =>
                      设表列表(
                        表列表.map((t) =>
                          t.id === 表.id ? { ...t, 权重: v ?? 0 } : t,
                        ),
                      )
                    }
                  />
                </Space>
                <Button
                  size="small"
                  danger
                  onClick={() =>
                    设表列表(表列表.filter((t) => t.id !== 表.id))
                  }
                >
                  删除
                </Button>
              </Flex>
              {渲染表(表)}
              <Typography.Text type="secondary">
                本表贡献到总预期值：
                {(() => {
                  const v = 表的值(表);
                  return v === null ? "—" : Math.round(v * 10000) / 10000;
                })()}
                {" × "}
                {表.权重}
              </Typography.Text>
            </div>
          ))}
          <Flex gap="small">
            <Button
              onClick={() =>
                设表列表([
                  ...表列表,
                  { id: 表序号++, 类型: "阶重", 模式: [], top: 0, 权重: 1 },
                ])
              }
            >
              添加阶重分析表
            </Button>
          </Flex>
          <Typography.Title level={4}>
            总预期值：{Math.round(总预期值 * 10000) / 10000}
          </Typography.Title>
        </Flex>
      )}
    </>
  );
}
