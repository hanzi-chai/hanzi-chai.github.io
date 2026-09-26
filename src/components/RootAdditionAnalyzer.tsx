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
  如带归并组装结果原子,
  如字库原子,
  全部合法元素原子,
  汉字集合原子,
  拼音分析结果原子,
  决策原子,
  决策空间原子,
  最大码长原子,
  字母表原子,
  字形分析配置原子,
  组装配置原子,
} from "~/atoms";
import CharacterSelect from "~/components/CharacterSelect";

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

const 数字标签 = (n: number) => "零一二三四五六七八九十"[n] ?? String(n);

export const 模式名称 = (空位: number[]) =>
  空位.length === 0 ? "全保留" : `空${空位.map((x) => 数字标签(x + 1)).join("")}码`;

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
  /** 空位模式，序列化为 JSON 字符串数组 */
  模式: string[];
  top: number;
  权重: number;
}

interface 候选根 {
  名: string;
  键位: string;
}

let 表序号 = 0;

/** 按模式分组：保留非空位码位的元素序列（布局无关），返回 键→词列表 */
const 分组按模式 = (条目列表: 组装条目[], 空位: number[], top: number) => {
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
  const 决策 = useAtomValue(决策原子);
  const 决策空间 = useAtomValue(决策空间原子);

  const [当前根, 设当前根] = useState<string>("");
  const [当前键位, 设当前键位] = useState<string>("");
  const [加根列表, 设加根列表] = useState<候选根[]>([]);
  const [运行中, 设运行中] = useState(false);
  const [错误, 设错误] = useState("");
  const [已完成根, 设已完成根] = useState("");
  const [候选, 设候选] = useState<组装条目[] | null>(null);
  const [表列表, 设表列表] = useState<表配置[]>([
    { id: 表序号++, 模式: [], top: 0, 权重: 1 },
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
  const 全部模式 = useMemo(
    () => range(maxLength + 1).flatMap((阶) => combinations(maxLength, 阶)),
    [maxLength],
  );

  const 添加根 = () => {
    设错误("");
    if (!当前根 || !当前键位) {
      设错误("请先选择根并输入键位");
      return;
    }
    if (!名称映射.has(当前根)) {
      设错误(`「${当前根}」不是字库中的合法元素`);
      return;
    }
    if (决策[当前根] !== undefined) {
      设错误(`「${当前根}」已在方案的键位映射中`);
      return;
    }
    if (加根列表.some((x) => x.名 === 当前根)) {
      设错误(`「${当前根}」已在候选列表中`);
      return;
    }
    for (const c of 当前键位) {
      if (!alphabet.includes(c)) {
        设错误(`键位「${c}」不在字母表 ${alphabet} 中`);
        return;
      }
    }
    设加根列表([...加根列表, { 名: 当前根, 键位: 当前键位 }]);
    设当前根("");
    设当前键位("");
  };

  const 分析 = async () => {
    设错误("");
    if (加根列表.length === 0) {
      设错误("请先添加至少一个候选根");
      return;
    }
    for (const { 名, 键位: k } of 加根列表) {
      if (!名称映射.has(名) || 决策[名] !== undefined) {
        设错误(`「${名}」不可用`);
        return;
      }
      for (const c of k) {
        if (!alphabet.includes(c)) {
          设错误(`「${名}」的键位「${c}」不在字母表中`);
          return;
        }
      }
    }
    设运行中(true);
    try {
      // 1. 候选决策（加入全部候选根；键位不影响阶重估计）
      const 候选决策Record = {
        ...决策,
        ...Object.fromEntries(加根列表.map((x) => [x.名, x.键位])),
      };
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
      设候选(带归并处理(组装结果.value, 强.决策));
      设已完成根(加根列表.map((x) => `${x.名}→${x.键位}`).join("、"));
    } catch (e: any) {
      设错误(String(e?.message ?? e));
      设候选(null);
    } finally {
      设运行中(false);
    }
  };

  /** 单个阶重模式的降低量与降低的字（top 为统计范围前 N 字，0 为全部） */
  const 阶重降低 = (空位: number[], top: number) => {
    const 基线分组 = 分组按模式(基线 ?? [], 空位, top);
    const 候选分组 = 分组按模式(候选!, 空位, top);
    const 基线值 = 估计选重(基线分组, 空位, alphabet.length);
    const 候选值 = 估计选重(候选分组, 空位, alphabet.length);
    const 减少组: string[][] = [];
    const 增加组: string[][] = [];
    基线分组.forEach((items, 键) => {
      const 候选词 = 候选分组.get(键);
      if (候选词 && 候选词.length < items.length) {
        减少组.push(items);
      }
    });
    候选分组.forEach((items, 键) => {
      const 基线词 = 基线分组.get(键);
      if (!基线词 || 基线词.length < items.length) {
        增加组.push(items);
      }
    });
    return {
      基线: 基线值,
      候选: 候选值,
      降低: 基线值 - 候选值,
      减少组,
      增加组,
    };
  };

  const 表模式 = (表: 表配置) =>
    表.模式.length > 0 ? 表.模式.map((v) => JSON.parse(v) as number[]) : 全部模式;

  const 表总降低 = (表: 表配置): number =>
    sumBy(表模式(表), (空位) => 阶重降低(空位, 表.top).降低);

  const 渲染表 = (表: 表配置) => {
    const 模式 = 表模式(表);
    const 行 = 模式.map((空位) => {
      const r = 候选 ? 阶重降低(空位, 表.top) : null;
      return {
        key: JSON.stringify(空位),
        模式: 模式名称(空位),
        阶: 空位.length,
        基线: r ? Math.round(r.基线) : "—",
        加根后: r ? Math.round(r.候选) : "—",
        降低: r ? Math.round(r.降低 * 100) / 100 : "—",
        减少组: r?.减少组 ?? [],
        增加组: r?.增加组 ?? [],
      };
    });
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
                  {(() => {
                    const 渲染组列表 = (组列表: string[][]) => {
                      if (组列表.length === 0) return "";
                      const 文本 = 组列表.map((组: string[]) => 组.join("、")).join("；");
                      return 文本.length <= 400
                        ? 文本
                        : `${文本.slice(0, 400)}……（共 ${组列表.length} 组）`;
                    };
                    const 减 = 渲染组列表(record.减少组);
                    const 增 = 渲染组列表(record.增加组);
                    return (
                      <>
                        {减 ? (
                          <div className="text-green-700">减少：{减}</div>
                        ) : (
                          <div>无字的重减少</div>
                        )}
                        {增 && (
                          <div className="mt-1 text-red-600">增加：{增}</div>
                        )}
                      </>
                    );
                  })()}
                </div>
              }
            >
              <span
                className={v > 0 ? "text-green-600" : v < 0 ? "text-red-500" : ""}
              >
                {v > 0 ? `−${v}` : String(v)}
              </span>
            </Popover>
          ) : (
            "—"
          ),
      },
    ];
    return (
      <Table
        dataSource={行}
        columns={columns}
        size="small"
        pagination={false}
      />
    );
  };

  const 表的值 = (表: 表配置): number => {
    if (!候选) return 0;
    return 表总降低(表);
  };

  const 总预期值 = sumBy(表列表, (表) => 表的值(表) * 表.权重);

  return (
    <>
      <Typography.Title level={2}>加根分析</Typography.Title>
      <Typography.Paragraph type="secondary">
        选择一个或多个候选字根（支持笔画 12345 检索、汉字、别名检索），为其指定键位安排（双编码方案输两位，如 qj；键位不影响阶重估计），系统将一次性加入全部候选根重新拆分，对比各阶重的变化。每张表可自定义空位模式、统计前 N 字与权重。
      </Typography.Paragraph>
      <Flex gap="small" align="center" wrap="wrap">
        <CharacterSelect
          className="w-40"
          placeholder="输入笔画（12345）、汉字或别名搜索"
          value={当前根 || undefined}
          onChange={(v) => 设当前根(v ?? "")}
        />
        <Input
          className="w-28"
          placeholder="键位（如 qj）"
          value={当前键位}
          onChange={(e) => 设当前键位(e.target.value)}
        />
        <Button onClick={添加根}>添加</Button>
        <Button type="primary" onClick={分析} loading={运行中}>
          分析
        </Button>
        {错误 && <Typography.Text type="danger">{错误}</Typography.Text>}
      </Flex>
      {加根列表.length > 0 && (
        <Flex gap="small" align="center" wrap="wrap">
          <Typography.Text type="secondary">候选根：</Typography.Text>
          {加根列表.map((x) => (
            <Tag
              key={x.名}
              closable
              onClose={() =>
                设加根列表(加根列表.filter((y) => y.名 !== x.名))
              }
            >
              {x.名} → {x.键位}
            </Tag>
          ))}
          {已完成根 && !运行中 && 候选 && (
            <Tag color="green">已分析：{已完成根}</Tag>
          )}
        </Flex>
      )}
      {运行中 && <Spin tip="正在重新拆分……" />}
      {候选 && (
        <Typography.Title level={3} className="mt-2!">
          总预期值：{Math.round(总预期值 * 10000) / 10000}
        </Typography.Title>
      )}
      {候选 && (
        <Flex vertical gap="middle">
          {表列表.map((表) => {
            const 本表降低 = Math.round(表的值(表) * 100) / 100;
            const 本表贡献 = Math.round(表的值(表) * 表.权重 * 10000) / 10000;
            return (
              <div key={表.id} className="border rounded p-2">
                <Flex gap="small" align="center" wrap="wrap" className="mb-2">
                  <Tag>阶重</Tag>
                  <Typography.Text strong>总降低 {本表降低}</Typography.Text>
                  <Typography.Text type="secondary">
                    加权贡献 {本表降低} × {表.权重} = {本表贡献}
                  </Typography.Text>
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
                    onChange={(vs) =>
                      设表列表(
                        表列表.map((t) =>
                          t.id === 表.id ? { ...t, 模式: vs as string[] } : t,
                        ),
                      )
                    }
                  />
                  <Flex gap="small" align="center">
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
                  </Flex>
                  <Flex gap="small" align="center">
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
                  </Flex>
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
              </div>
            );
          })}
          <Button
            onClick={() =>
              设表列表([...表列表, { id: 表序号++, 模式: [], top: 0, 权重: 1 }])
            }
          >
            新建阶重表
          </Button>
        </Flex>
      )}
    </>
  );
}
