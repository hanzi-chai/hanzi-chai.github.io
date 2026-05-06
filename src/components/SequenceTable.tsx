import { type ProColumns, ProTable } from "@ant-design/pro-components";
import { Button, Checkbox, Flex, Input, Space } from "antd";
import { 字符, 序列化, 总序列化, type 码位, 识别符 } from "hanzi-chai";
import { range } from "lodash-es";
import { type ReactNode, useState } from "react";
import {
  useAtom,
  useAtomValue,
  useAtomValueUnwrapped,
  优先简码原子,
  优先简码映射原子,
  动态分析原子,
  原始字库同步原子,
  如动态组装结果与优先简码原子,
  如笔顺映射原子,
  如组装结果与优先简码原子,
  如编码结果原子,
  强类型元素列表原子,
  最大码长原子,
  type 联合条目,
  联合结果原子,
} from "~/atoms";
import { exportTSV, exportYAML } from "~/utils";
import { CodePositionDisplay, Select } from "./Utils";

export function 编码渲染({ code, rank }: { code: string; rank: number }) {
  return (
    <span className={rank > 0 ? "text-red-500" : ""}>
      {code}
      {rank > 0 ? `[${rank}]` : ""}
    </span>
  );
}

export const ExportAssembly = () => {
  const 组装结果 = useAtomValueUnwrapped(如组装结果与优先简码原子);
  return (
    <Button
      onClick={() => {
        const result = 组装结果.map(({ 词, 元素序列, 频率, 简码长度 }) => {
          return {
            词: 词.map((c) => c.toString()).join(""),
            元素序列: 元素序列.元素序列,
            频率,
            简码长度,
          };
        });
        exportYAML(result, "elements", 1);
      }}
    >
      导出元素序列表
    </Button>
  );
};

export const ExportDynamicAssembly = () => {
  const 组装结果 = useAtomValueUnwrapped(如动态组装结果与优先简码原子);
  return (
    <Button
      onClick={() => {
        const result = 组装结果.map(({ 词, 元素序列, 频率, 简码长度 }) => {
          return {
            词: 词.map((c) => c.toString()).join(""),
            全部元素序列: [...元素序列],
            频率,
            简码长度,
          };
        });
        exportYAML(result, "elements", 1);
      }}
    >
      导出动态元素序列表
    </Button>
  );
};

const ExportCode = () => {
  const [code] = useAtomValueUnwrapped(如编码结果原子);
  return (
    <Button
      onClick={() => {
        const tsv: string[][] = [];
        for (const x of code) {
          tsv.push([
            x.词,
            x.全码,
            x.全码排名.toString(),
            x.简码,
            x.简码排名.toString(),
          ]);
        }
        exportTSV(tsv, "code.txt");
      }}
    >
      导出码表
    </Button>
  );
};

const getColumnSearchProps = (
  dataIndex: "词" | "全码" | "简码",
): ProColumns<联合条目> => ({
  filterDropdown: ({
    setSelectedKeys,
    selectedKeys,
    confirm,
    clearFilters,
  }) => (
    <Flex vertical align="flex-end" gap="middle" className="p-4">
      <Input
        value={selectedKeys[0]}
        onChange={(e) =>
          setSelectedKeys(e.target.value ? [e.target.value] : [])
        }
      />
      <Space>
        <Button onClick={() => clearFilters?.()}>重置</Button>
        <Button type="primary" onClick={() => confirm()}>
          搜索
        </Button>
      </Space>
    </Flex>
  ),
  onFilter: (value, record) => {
    const regex = new RegExp(value as string);
    const entry = record[dataIndex];
    const text = Array.isArray(entry)
      ? entry.map((x) => x.toString()).join("")
      : entry;
    return regex.test(text);
  },
});

const EnumFilterDropdown = ({
  allValues,
  setSelectedKeys,
  selectedKeys,
  confirm,
  clearFilters,
}: {
  allValues: Map<string, { element: 码位; node: ReactNode }>;
  setSelectedKeys: (keys: React.Key[]) => void;
  selectedKeys: React.Key[];
  confirm: () => void;
  clearFilters?: () => void;
}) => {
  const 笔顺映射 = useAtomValueUnwrapped(如笔顺映射原子);
  const 强类型元素列表 = useAtomValue(强类型元素列表原子);
  const [search, setSearch] = useState("");
  const filteredKeys = [...allValues]
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([key, { element }]) => {
      const 匹配元素 = key.includes(search);
      if (typeof element === "string") return 匹配元素;
      const 元素 = 强类型元素列表.get(element.element);
      if (!元素) return 匹配元素;
      const 匹配序列 =
        元素 instanceof 字符 &&
        笔顺映射.get(元素)?.some((s) => s.startsWith(search));
      return 匹配序列 || 匹配元素;
    });
  return (
    <div className="flex flex-col gap-2 p-3 w-48">
      <Input
        size="small"
        placeholder="搜索元素…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        allowClear
      />
      <div className="flex flex-col overflow-y-auto max-h-60">
        {filteredKeys.map(([key, { node }]) => (
          <div key={key} className="px-1 py-0.5 rounded hover:bg-gray-50">
            <Checkbox
              checked={selectedKeys.includes(key)}
              onChange={(e) =>
                setSelectedKeys(
                  e.target.checked
                    ? [...selectedKeys, key]
                    : selectedKeys.filter((k) => k !== key),
                )
              }
            >
              <span className="leading-tight">{node}</span>
            </Checkbox>
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2 pt-1 border-t border-gray-100">
        <Button size="small" onClick={() => clearFilters?.()}>
          重置
        </Button>
        <Button size="small" type="primary" onClick={() => confirm()}>
          确认
        </Button>
      </div>
    </div>
  );
};

const getColumnEnumFilterProps = (
  allValues: Map<string, { element: 码位; node: ReactNode }>,
): Pick<ProColumns<联合条目>, "filterDropdown"> => ({
  filterDropdown: ({
    setSelectedKeys,
    selectedKeys,
    confirm,
    clearFilters,
  }) => (
    <EnumFilterDropdown
      allValues={allValues}
      setSelectedKeys={setSelectedKeys}
      selectedKeys={selectedKeys}
      confirm={confirm}
      clearFilters={clearFilters}
    />
  ),
});

interface PendingChange {
  level: number;
  word: 字符[];
  sources: string[][];
}

function CommitShortCodeButton({
  pendingChanges,
  onCommit,
}: {
  pendingChanges: Map<string, PendingChange>;
  onCommit: () => void;
}) {
  const [优先简码列表, set优先简码] = useAtom(优先简码原子);
  const 原始字库 = useAtomValue(原始字库同步原子);

  const getEntryHash = (entry: { word: string; sources: string[][] }) => {
    if (!原始字库) return null;
    const chars: 字符[] = [];
    for (const c of entry.word) {
      const ch = 原始字库.校验(c);
      if (!ch) return null;
      chars.push(ch.character);
    }
    return 识别符(chars, entry.sources);
  };

  const commit = () => {
    if (!原始字库 || pendingChanges.size === 0) return;
    let newList = [...优先简码列表];
    for (const [hash, { level, word, sources }] of pendingChanges) {
      if (level === -1) {
        newList = newList.filter((entry) => getEntryHash(entry) !== hash);
      } else {
        const idx = newList.findIndex((entry) => getEntryHash(entry) === hash);
        if (idx >= 0) {
          newList = newList.map((entry, i) =>
            i === idx ? { ...entry, level } : entry,
          );
        } else {
          newList.push({
            word: word.map((c) => c.toString()).join(""),
            sources,
            level,
          });
        }
      }
    }
    set优先简码(newList);
    onCommit();
  };

  const count = pendingChanges.size;
  return (
    <Space>
      <Button disabled={count === 0} onClick={onCommit}>
        重置 ({count})
      </Button>
      <Button type="primary" disabled={count === 0} onClick={commit}>
        确认 ({count})
      </Button>
    </Space>
  );
}

export default function SequenceTable() {
  const 最大码长 = useAtomValue(最大码长原子);
  const 联合结果 = useAtomValueUnwrapped(联合结果原子);
  const 优先简码映射 = useAtomValue(优先简码映射原子);
  const 动态分析 = useAtomValue(动态分析原子);
  const [pendingChanges, setPendingChanges] = useState<
    Map<string, PendingChange>
  >(new Map());

  const dataSource = 联合结果.map((x, i) => ({
    ...x,
    key: 识别符(x.词, x.拼音来源列表),
    originalIndex: i,
  }));

  dataSource.sort((a, b) => b.频率 - a.频率);

  const columns: ProColumns<联合条目>[] = [
    {
      title: "名称",
      dataIndex: "词",
      sortDirections: ["ascend", "descend"],
      width: 96,
      ...getColumnSearchProps("词"),
      render: (_, record) => (
        <span>{record.词.map((c) => c.toString()).join("")}</span>
      ),
    },
    {
      title: "频率",
      dataIndex: "频率",
      sorter: (a, b) => a.频率 - b.频率,
      sortDirections: ["ascend", "descend"],
      width: 96,
    },
    {
      title: "拼音",
      dataIndex: "拼音来源列表",
      render: (_, record) =>
        record.拼音来源列表.map((x) => x.join(" ")).join(", "),
      width: 128,
    },
    {
      title: "全部元素",
      key: "all",
      render: (_, record) => {
        return (
          <Space>
            {record.元素序列.元素序列.map((element, index) => (
              <CodePositionDisplay key={index} element={element} />
            ))}
          </Space>
        );
      },
      sorter: (a, b) => {
        const ahash = 总序列化(a.元素序列.元素序列);
        const bhash = 总序列化(b.元素序列.元素序列);
        return ahash.localeCompare(bhash);
      },
      width: 128,
      ellipsis: true,
    },
  ];

  for (const i of Array(最大码长).keys()) {
    const allValues: Map<string, { element: 码位; node: ReactNode }> =
      new Map();
    for (const { 元素序列 } of dataSource) {
      const element = 元素序列.元素序列[i];
      if (element !== undefined) {
        const text = 序列化(element);
        allValues.set(text, {
          element,
          node: <CodePositionDisplay element={element} />,
        });
      }
    }
    columns.push({
      title: `元素 ${i + 1}`,
      render: (_, record) => {
        const element = record.元素序列.元素序列[i];
        return element ? <CodePositionDisplay element={element} /> : null;
      },
      sorter: (a, b) => {
        const ahash = 序列化(a.元素序列.元素序列[i] ?? "");
        const bhash = 序列化(b.元素序列.元素序列[i] ?? "");
        return ahash.localeCompare(bhash);
      },
      sortDirections: ["ascend", "descend"],
      width: 96,
      onFilter: (value, record) => {
        const element = record.元素序列.元素序列[i];
        if (element === undefined) {
          return false;
        }
        return 序列化(element) === value;
      },
      ...getColumnEnumFilterProps(allValues),
      ellipsis: true,
    });
  }

  columns.push(
    {
      title: "简码级数",
      key: "action",
      width: 128,
      render: (_, record) => {
        const hash = 识别符(record.词, record.拼音来源列表);
        const committedLevel = 优先简码映射.get(hash) ?? -1;
        const pending = pendingChanges.get(hash);
        const effectiveLevel =
          pending !== undefined ? pending.level : committedLevel;
        return (
          <Select
            size="small"
            value={effectiveLevel}
            className={
              pending !== undefined ? "outline outline-orange-400 rounded" : ""
            }
            options={[-1, ...Array(最大码长 + 1).keys()].map((x) => ({
              label: x === -1 ? "默认" : x.toString(),
              value: x,
            }))}
            onChange={(value) => {
              const newMap = new Map(pendingChanges);
              newMap.set(hash, {
                level: value,
                word: record.词,
                sources: record.拼音来源列表,
              });
              setPendingChanges(newMap);
            }}
          />
        );
      },
      filters: true,
      onFilter: (value, record) => {
        const hash = 识别符(record.词, record.拼音来源列表);
        const level = 优先简码映射.get(hash) ?? -1;
        return level.toString() === value;
      },
      valueEnum: Object.fromEntries(
        [...range(0, 最大码长 + 1), -1].map((x) => [
          x,
          x === -1 ? "默认" : `${x} 级简码`,
        ]),
      ),
    },
    {
      title: "全码",
      width: 96,
      render: (_, record) => (
        <编码渲染 code={record.全码} rank={Math.abs(record.全码排名)} />
      ),
      ...getColumnSearchProps("全码"),
    },
    {
      title: "简码",
      width: 96,
      render: (_, record) => (
        <编码渲染 code={record.简码} rank={Math.abs(record.简码排名)} />
      ),
      ...getColumnSearchProps("简码"),
    },
  );

  return (
    <ProTable<联合条目>
      scroll={{ y: 1080 }}
      columns={columns}
      dataSource={dataSource}
      size="small"
      pagination={{ pageSize: 100 }}
      search={false}
      defaultSize="small"
      toolBarRender={() => [
        <ExportAssembly key={1} />,
        动态分析 && <ExportDynamicAssembly key={2} />,
        <ExportCode key={3} />,
        <CommitShortCodeButton
          key={4}
          pendingChanges={pendingChanges}
          onCommit={() => setPendingChanges(new Map())}
        />,
      ]}
    />
  );
}
