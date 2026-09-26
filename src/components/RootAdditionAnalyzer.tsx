import {
  Button,
  Flex,
  Input,
  InputNumber,
  Popover,
  Radio,
  Segmented,
  Select,
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
import { useEffect, useMemo, useState } from "react";
import {
  useAtomValueUnwrapped,
  如带归并组装结果原子,
  如字库原子,
  全部合法元素原子,
  汉字集合原子,
  拼音分析结果原子,
  决策原子,
  决策空间原子,
  编码类型原子,
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

/** 模式名：空位显示 *（每个 * 后带空格），保留位显示位数 */
export const 模式名称 = (空位: number[]) => {
  const tokens = range(4).map((i) => (空位.includes(i) ? "* " : 数字标签(i + 1)));
  return tokens.join("").trimEnd() || "****";
};

/** 红加绿减：良性（重码减少）绿显示 −，恶性（重码增加）红显示 ＋ */
const 变化显示 = (v: number) => {
  const x = Math.round(v * 10000) / 10000;
  if (x > 0) return { 文本: `−${Math.abs(x)}`, 类: "text-green-600" };
  if (x < 0) return { 文本: `＋${Math.abs(x)}`, 类: "text-red-500" };
  return { 文本: "0", 类: "" };
};

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

type 操作类型 = "加" | "减";

interface 根操作 {
  id: number;
  类型: 操作类型;
  名: string;
  /** 加根时的安排：键位字符串，或广义码位列表（字母键 / 归并引用混排） */
  安排?: string | (string | { element: string; index: number })[];
}

let 表序号 = 0;
let 操作序号 = 0;

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

  const [操作, 设操作] = useState<操作类型>("加");
  const 编码类型 = useAtomValue(编码类型原子);
  const [当前根, 设当前根] = useState<string>("");
  // 每一码独立安排：键位字母，或归并到某根的第几码
  const [码槽列表, 设码槽列表] = useState<
    { 类型: "键" | "归"; 键: string; 目标: string; 序号: number }[]
  >(() =>
    range(2).map(() => ({ 类型: "键", 键: "", 目标: "", 序号: 0 }) as const),
  );
  const [操作列表, 设操作列表] = useState<根操作[]>([]);
  const [运行中, 设运行中] = useState(false);
  const [错误, 设错误] = useState("");
  const [已完成, 设已完成] = useState("");
  const [候选, 设候选] = useState<组装条目[] | null>(null);
  const [表列表, 设表列表] = useState<表配置[]>([
    { id: 表序号++, 模式: [], top: 0, 权重: 1 },
  ]);

  const 已映射元素集 = useMemo(() => new Set(Object.keys(决策)), [决策]);
  useEffect(() => {
    设码槽列表(
      range(编码类型).map(() => ({ 类型: "键", 键: "", 目标: "", 序号: 0 })),
    );
  }, [编码类型]);
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

  const 添加操作 = () => {
    设错误("");
    if (!当前根) {
      设错误("请先选择字根");
      return;
    }
    if (!名称映射.has(当前根)) {
      设错误(`「${当前根}」不是字库中的合法元素`);
      return;
    }
    if (操作列表.some((x) => x.名 === 当前根)) {
      设错误(`「${当前根}」已在操作列表中（同一根先减后加即可表达改根）`);
      return;
    }
    if (操作 === "减") {
      if (!已映射元素集.has(当前根)) {
        设错误(`「${当前根}」不在当前方案的字根映射中，无法减去`);
        return;
      }
      设操作列表([...操作列表, { id: 操作序号++, 类型: "减", 名: 当前根 }]);
      设当前根("");
      return;
    }
    // 加根：逐码构造安排（全键位 → 键位串；含归并 → 广义码位列表）
    for (const 槽 of 码槽列表) {
      if (槽.类型 === "键") {
        if (!槽.键) {
          设错误(`第${数字标签(码槽列表.indexOf(槽) + 1)}码未设置键位`);
          return;
        }
        if (!alphabet.includes(槽.键)) {
          设错误(`键位「${槽.键}」不在字母表 ${alphabet} 中`);
          return;
        }
      } else {
        if (!槽.目标) {
          设错误(`第${数字标签(码槽列表.indexOf(槽) + 1)}码未选择归并目标`);
          return;
        }
        if (!已映射元素集.has(槽.目标)) {
          设错误(`归并目标「${槽.目标}」必须在当前方案的字根映射中`);
          return;
        }
        if (操作列表.some((x) => x.类型 === "减" && x.名 === 槽.目标)) {
          设错误(`归并目标「${槽.目标}」正在被减去，不能作为归并目标`);
          return;
        }
        if (槽.序号 >= 编码类型) {
          设错误(`归并目标的码序超出编码类型（${编码类型} 编码）`);
          return;
        }
      }
    }
    const 安排: string | (string | { element: string; index: number })[] =
      码槽列表.every((s) => s.类型 === "键")
        ? 码槽列表.map((s) => s.键).join("")
        : 码槽列表.map((s) =>
            s.类型 === "键" ? s.键 : { element: s.目标, index: s.序号 },
          );
    设操作列表([...操作列表, { id: 操作序号++, 类型: "加", 名: 当前根, 安排 }]);
    设当前根("");
    设码槽列表(码槽列表.map((s) => ({ ...s, 键: "", 目标: "", 序号: 0 })));
  };

  const 分析 = async () => {
    设错误("");
    if (操作列表.length === 0) {
      设错误("请先添加至少一条加/减根操作");
      return;
    }
    for (const op of 操作列表) {
      if (!名称映射.has(op.名)) {
        设错误(`「${op.名}」不是字库中的合法元素`);
        return;
      }
      if (op.类型 === "减" && !已映射元素集.has(op.名)) {
        设错误(`「${op.名}」不在当前方案的字根映射中，无法减去`);
        return;
      }
    }
    设运行中(true);
    try {
      // 1. 候选决策：先应用减根，再应用加根（同根先减后加即“改根”）
      const 候选决策Record: Record<string, any> = { ...决策 };
      for (const op of 操作列表) {
        if (op.类型 === "减") {
          delete 候选决策Record[op.名];
        }
      }
      for (const op of 操作列表) {
        if (op.类型 === "加") {
          候选决策Record[op.名] = op.安排;
        }
      }
      const 强 = 构建强类型决策与决策空间(候选决策Record, 决策空间, 名称映射);
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
      设已完成(
        操作列表
          .map((x) => {
            if (x.类型 === "减") return `−${x.名}`;
            const 安排文本 =
              typeof x.安排 === "string"
                ? x.安排
                : (x.安排 ?? [])
                    .map((c) =>
                      typeof c === "string"
                        ? c
                        : `${c.element}${c.index ? "'" + c.index : ""}`,
                    )
                    .join("");
            return `＋${x.名}→${安排文本}`;
          })
          .join("、"),
      );
    } catch (e: any) {
      设错误(String(e?.message ?? e));
      设候选(null);
    } finally {
      设运行中(false);
    }
  };

  /** 单个阶重模式的变化量与变化组（top 为统计范围前 N 字，0 为全部） */
  const 阶重变化 = (空位: number[], top: number) => {
    const 基线分组 = 分组按模式(基线 ?? [], 空位, top);
    const 候选分组 = 分组按模式(候选!, 空位, top);
    const 基线值 = 估计选重(基线分组, 空位, alphabet.length);
    const 候选值 = 估计选重(候选分组, 空位, alphabet.length);
    // 成员构成发生变化（人数或成员互换）的组
    const 变化组: {
      基线词: string[];
      候选词: string[];
      基线: number;
      候选: number;
    }[] = [];
    const 全部键 = new Set([...基线分组.keys(), ...候选分组.keys()]);
    全部键.forEach((键) => {
      const 基线词 = 基线分组.get(键);
      const 候选词 = 候选分组.get(键);
      const 基线数 = 基线词?.length ?? 0;
      const 候选数 = 候选词?.length ?? 0;
      if (基线数 < 2 && 候选数 < 2) return; // 两边都是单字组，无重码含义
      if (基线词 && 候选词) {
        const 候选集 = new Set(候选词);
        const 构成不变 =
          基线数 === 候选数 && 基线词.every((x) => 候选集.has(x));
        if (构成不变) return;
      }
      变化组.push({
        基线词: 基线词 ?? [],
        候选词: 候选词 ?? [],
        基线: 基线数,
        候选: 候选数,
      });
    });
    return {
      基线: 基线值,
      候选: 候选值,
      变化: 基线值 - 候选值,
      变化组,
    };
  };

  const 表模式 = (表: 表配置) =>
    表.模式.length > 0 ? 表.模式.map((v) => JSON.parse(v) as number[]) : 全部模式;

  const 表总变化 = (表: 表配置): number =>
    sumBy(表模式(表), (空位) => 阶重变化(空位, 表.top).变化);

  const 渲染表 = (表: 表配置) => {
    const 模式 = 表模式(表);
    const 行 = 模式.map((空位) => {
      const r = 候选 ? 阶重变化(空位, 表.top) : null;
      return {
        key: JSON.stringify(空位),
        模式: 模式名称(空位),
        阶: 空位.length,
        原始: r ? Math.round(r.基线) : "—",
        加减根后: r ? Math.round(r.候选) : "—",
        变化: r ? Math.round(r.变化 * 100) / 100 : "—",
        变化组: r?.变化组 ?? [],
      };
    });
    const columns: ColumnsType<(typeof 行)[number]> = [
      { title: "阶", dataIndex: "阶", key: "阶", width: 56 },
      { title: "模式", dataIndex: "模式", key: "模式", width: 110 },
      { title: "原始", dataIndex: "原始", key: "原始", width: 90 },
      { title: "加减根后", dataIndex: "加减根后", key: "加减根后", width: 100 },
      {
        title: "变化",
        dataIndex: "变化",
        key: "变化",
        width: 90,
        render: (v, record) =>
          typeof v === "number" ? (
            <Popover
              content={
                <div className="max-w-130">
                  {record.变化组.length === 0 ? (
                    <div>无组变化</div>
                  ) : (
                    record.变化组.map((组, gi) => {
                      const 基线集 = new Set(组.基线词);
                      const 候选集 = new Set(组.候选词);
                      const 不变 = 组.基线词.filter((x) => 候选集.has(x));
                      const 加入 = 组.候选词.filter((x) => !基线集.has(x));
                      const 离开 = 组.基线词.filter((x) => !候选集.has(x));
                      return (
                        <div key={gi} className="mb-1">
                          <div className="font-medium">
                            组（{组.基线}→{组.候选}）：
                          </div>
                          {加入.length > 0 && (
                            <div className="text-red-500">
                              ＋{加入.join("、")}
                            </div>
                          )}
                          {离开.length > 0 && (
                            <div className="text-green-600">
                              －{离开.join("、")}
                            </div>
                          )}
                          {不变.length > 0 &&
                            (不变.length <= 8 ? (
                              <div>＝{不变.join("、")}</div>
                            ) : (
                              <div className="text-gray-500">
                                ＝{不变.slice(0, 8).join("、")} 等 {不变.length}{" "}
                                字不变
                              </div>
                            ))}
                        </div>
                      );
                    })
                  )}
                </div>
              }
            >
              <span className={变化显示(v).类}>{变化显示(v).文本}</span>
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
    return 表总变化(表);
  };

  const 总预期值 = sumBy(表列表, (表) => 表的值(表) * 表.权重);

  return (
    <>
      <Typography.Title level={2}>加减根分析</Typography.Title>
      <Typography.Paragraph type="secondary">
        选择候选字根（支持笔画 12345、汉字、别名检索），以「加根」「减根」「先减后加（即改根）」任意组合；加根的安排可为键位或归并到已有字根（安排不影响阶重估计）。系统将按操作重拆分，对比各阶重变化。每张表可自定义空位模式、统计前 N 字与权重。
      </Typography.Paragraph>
      <Flex gap="small" align="center" wrap="wrap">
        <Radio.Group
          value={操作}
          onChange={(e) => 设操作(e.target.value)}
          optionType="button"
          buttonStyle="solid"
          options={[
            { label: "加根", value: "加" },
            { label: "减根", value: "减" },
          ]}
        />
        <CharacterSelect
          className="w-36"
          placeholder="字根"
          value={当前根 || undefined}
          onChange={(v) => 设当前根(v ?? "")}
        />
        {操作 === "加" && (
          <Flex gap="small" align="center" wrap="wrap">
            {码槽列表.map((槽, i) => {
              const 槽色 = i % 2 === 0 ? "bg-blue-50" : "bg-emerald-50";
              const 字色 =
                i % 2 === 0 ? "text-blue-700" : "text-emerald-700";
              return (
                <Flex
                  key={i}
                  gap={6}
                  align="center"
                  className={`${槽色} rounded-md px-3 py-3`}
                >
                  <span className={`${字色} text-xs font-medium whitespace-nowrap`}>
                    第{数字标签(i + 1)}码
                  </span>
                  <Segmented
                    value={槽.类型}
                    onChange={(v) =>
                      设码槽列表(
                        码槽列表.map((s, si) =>
                          si === i ? { ...s, 类型: v as "键" | "归" } : s,
                        ),
                      )
                    }
                    options={[
                      { label: "键", value: "键" },
                      { label: "归", value: "归" },
                    ]}
                  />
                  {槽.类型 === "键" ? (
                    <Input
                      className="w-10! text-center"
                      maxLength={1}
                      placeholder="键"
                      value={槽.键}
                      onChange={(e) =>
                        设码槽列表(
                          码槽列表.map((s, si) =>
                            si === i ? { ...s, 键: e.target.value } : s,
                          ),
                        )
                      }
                    />
                  ) : (
                    <>
                      <Select
                        className="w-28"
                        placeholder="归并到根"
                        value={槽.目标 || undefined}
                        onChange={(v) =>
                          设码槽列表(
                            码槽列表.map((s, si) =>
                              si === i ? { ...s, 目标: v ?? "" } : s,
                            ),
                          )
                        }
                        options={[...已映射元素集].map((x) => ({
                          label: x,
                          value: x,
                        }))}
                        showSearch
                      />
                      <Select
                        className="w-20"
                        value={槽.序号}
                        onChange={(v) =>
                          设码槽列表(
                            码槽列表.map((s, si) =>
                              si === i ? { ...s, 序号: v as number } : s,
                            ),
                          )
                        }
                        options={range(编码类型).map((j) => ({
                          label: `第${数字标签(j + 1)}码`,
                          value: j,
                        }))}
                      />
                    </>
                  )}
                </Flex>
              );
            })}
          </Flex>
        )}
        <Button onClick={添加操作}>添加</Button>
      </Flex>
      <Flex gap="small" align="center" wrap="wrap" className="mt-2">
        <Button type="primary" onClick={分析} loading={运行中}>
          分析
        </Button>
        {错误 && <Typography.Text type="danger">{错误}</Typography.Text>}
      </Flex>
      {操作列表.length > 0 && (
        <Flex gap="small" align="center" wrap="wrap" className="mt-2">
          <Typography.Text type="secondary">操作列表：</Typography.Text>
          {操作列表.map((x) => (
            <Tag
              key={x.id}
              closable
              color={x.类型 === "减" ? "red" : "green"}
              onClose={() => 设操作列表(操作列表.filter((y) => y.id !== x.id))}
            >
              {x.类型 === "减"
                ? `减 ${x.名}`
                : `加 ${x.名} → ${
                    typeof x.安排 === "string"
                      ? x.安排
                      : (x.安排 ?? [])
                          .map((c) =>
                            typeof c === "string"
                              ? c
                              : `${c.element}${c.index ? "'" + c.index : ""}`,
                          )
                          .join("")
                  }`}
            </Tag>
          ))}
          {已完成 && !运行中 && 候选 && <Tag color="green">已分析：{已完成}</Tag>}
        </Flex>
      )}
      {运行中 && <Spin tip="正在重新拆分……" />}
      {候选 && (
        <Typography.Title level={3} className="mt-2!">
          总预期值：
          <span className={变化显示(总预期值).类}>
            {变化显示(总预期值).文本}
          </span>
          <Typography.Text type="secondary" className="text-base! font-normal!">
            （绿减＝良性，红加＝恶性）
          </Typography.Text>
        </Typography.Title>
      )}
      {候选 && (
        <Flex vertical gap="middle">
          {表列表.map((表) => {
            const 本表变化 = 表的值(表);
            const 本表贡献 = 本表变化 * 表.权重;
            return (
              <div key={表.id} className="border rounded p-2">
                <Flex gap="small" align="center" wrap="wrap" className="mb-2">
                  <Tag>阶重</Tag>
                  <Typography.Text strong>
                    总变化{" "}
                    <span className={变化显示(本表变化).类}>
                      {变化显示(本表变化).文本}
                    </span>
                  </Typography.Text>
                  <Typography.Text type="secondary">
                    加权贡献{" "}
                    <span className={变化显示(本表贡献).类}>
                      {变化显示(本表贡献).文本}
                    </span>{" "}
                    （{变化显示(本表变化).文本} × {表.权重}）
                  </Typography.Text>
                  <Select
                    mode="multiple"
                    allowClear
                    placeholder="选择空位模式（默认全部）"
                    value={表.模式}
                    className="min-w-80"
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
