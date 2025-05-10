import { Button, Flex, Input, Space } from "antd";
import {
  useAtomValue,
  displayAtom,
  priorityShortCodesAtom,
  maxLengthAtom,
  combinedResultAtom,
  adaptedFrequencyAtom,
} from "~/atoms";
import type { DictEntry, IndexedElement } from "~/lib";
import { getPriorityMap, summarize } from "~/lib";
import { exportTSV, renderIndexed, renderSuperScript } from "~/lib";
import { assemblyResultAtom, encodeResultAtom } from "~/atoms";
import type { ProColumns } from "@ant-design/pro-components";
import { ProTable } from "@ant-design/pro-components";
import ProrityShortCodeSelector from "./ProrityShortCodeSelector";

interface MainEntry {
  key: string;
  name: string;
  pinyin_list: string[];
  frequency: number;
  full: string;
  full_rank: number;
  short: string;
  short_rank: number;
  [n: number]: IndexedElement;
}

const ExportAssembly = () => {
  const assemblyResult = useAtomValue(assemblyResultAtom);
  const priorityShortCodes = useAtomValue(priorityShortCodesAtom);
  const priorityMap = getPriorityMap(priorityShortCodes);
  return (
    <Button
      onClick={() => {
        const tsv: string[][] = [];
        for (const {
          name,
          sequence,
          frequency: importance,
          pinyin_list,
        } of assemblyResult) {
          const summary = summarize(sequence);
          const hash = `${name}-${pinyin_list.join(",")}`;
          const level = priorityMap.get(hash);
          if (level !== undefined) {
            tsv.push([name, summary, String(importance), String(level)]);
          } else {
            tsv.push([name, summary, String(importance)]);
          }
        }
        exportTSV(tsv, "elements.txt");
      }}
    >
      导出元素序列表
    </Button>
  );
};

const ExportCode = () => {
  const [code] = useAtomValue(encodeResultAtom);
  const flatten = (x: DictEntry) => [
    x.name,
    x.full,
    x.full_rank.toString(),
    x.short,
    x.short_rank.toString(),
  ];
  return (
    <Button
      disabled={code === null}
      onClick={() => {
        exportTSV(code?.map(flatten), "code.txt");
      }}
    >
      导出码表
    </Button>
  );
};

type DataIndex = "name" | "full" | "short";

const getColumnSearchProps = (dataIndex: DataIndex): ProColumns<MainEntry> => ({
  filterDropdown: ({
    setSelectedKeys,
    selectedKeys,
    confirm,
    clearFilters,
  }) => (
    <Flex vertical align="flex-end" gap="middle" style={{ padding: "1rem" }}>
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
  onFilter: (value, record) =>
    new RegExp(value as string).test(record[dataIndex]),
});

export default function SequenceTable() {
  const display = useAtomValue(displayAtom);
  const max_length = useAtomValue(maxLengthAtom);
  const combinedResult = useAtomValue(combinedResultAtom);

  const dataSource = combinedResult.map(
    ({ name, sequence, frequency, ...rest }) => {
      const key = `${name}-${summarize(sequence)}`;
      const entry: MainEntry = {
        key,
        frequency,
        name,
        ...rest,
      };
      for (const [i, element] of sequence.entries()) {
        entry[i] = element;
      }
      return entry;
    },
  );

  dataSource.sort((a, b) => b.frequency - a.frequency);

  const hash = (record: MainEntry) => {
    const list: IndexedElement[] = [];
    for (const i of Array(max_length).keys()) {
      const element = record[i];
      if (element === undefined) {
        break;
      }
      list.push(element);
    }
    return list.map((x) => renderIndexed(x, display)).join(" ");
  };

  const columns: ProColumns<MainEntry>[] = [
    {
      title: "名称",
      dataIndex: "name",
      sorter: (a, b) => a.name.codePointAt(0)! - b.name.codePointAt(0)!,
      sortDirections: ["ascend", "descend"],
      width: 96,
      ...getColumnSearchProps("name"),
    },
    {
      title: "频率",
      dataIndex: "frequency",
      sorter: (a, b) => a.frequency - b.frequency,
      sortDirections: ["ascend", "descend"],
      width: 96,
    },
    {
      title: "拼音",
      dataIndex: "pinyin_list",
      render: (_, record) => record.pinyin_list.join(", "),
      width: 128,
    },
    {
      title: "全部元素",
      key: "all",
      render: (_, record) => hash(record),
      sorter: (a, b) => {
        const ahash = hash(a);
        const bhash = hash(b);
        return ahash.localeCompare(bhash);
      },
      width: 128,
      ellipsis: true,
    },
  ];

  for (const i of Array(max_length).keys()) {
    const allValues: Record<string, { text: string }> = {};
    for (const { [i]: element } of dataSource) {
      if (element !== undefined) {
        const text = renderIndexed(element, display);
        allValues[text] = { text };
      }
    }
    columns.push({
      title: `元素 ${i + 1}`,
      dataIndex: i,
      render: (_, record) => {
        const element = record[i];
        if (element === undefined) {
          return null;
        }
        return renderIndexed(element, display);
      },
      sorter: (a, b) => {
        const ahash = renderIndexed(a[i] ?? "", display);
        const bhash = renderIndexed(b[i] ?? "", display);
        return ahash.localeCompare(bhash);
      },
      sortDirections: ["ascend", "descend"],
      width: 96,
      filters: true,
      onFilter: (value, record) => {
        const element = record[i];
        if (element === undefined) {
          return false;
        }
        return renderIndexed(element, display) === value;
      },
      valueEnum: allValues,
      ellipsis: true,
    });
  }

  columns.push(
    {
      title: "简码级数",
      key: "action",
      width: 128,
      render: (_, record) => {
        const hash = `${record.name}-${record.pinyin_list.join(",")}`;
        return <ProrityShortCodeSelector hash={hash} />;
      },
    },
    {
      title: "全码",
      width: 96,
      render: (_, record) => {
        const { full, full_rank } = record;
        const rank = Math.abs(full_rank);
        return (
          <span style={{ color: full_rank > 0 ? "red" : "inherit" }}>
            {renderSuperScript(full, rank)}
          </span>
        );
      },
      ...getColumnSearchProps("full"),
    },
    {
      title: "简码",
      width: 96,
      render: (_, record) => {
        const { short, short_rank } = record;
        const rank = Math.abs(short_rank);
        return (
          <span style={{ color: short_rank > 0 ? "red" : "inherit" }}>
            {renderSuperScript(short, rank)}
          </span>
        );
      },
      ...getColumnSearchProps("short"),
    },
  );

  const toolbar = [<ExportAssembly key={1} />, <ExportCode key={3} />];

  return (
    <ProTable<MainEntry>
      virtual
      scroll={{ y: 1080 }}
      columns={columns}
      dataSource={dataSource}
      pagination={false}
      search={false}
      defaultSize="small"
      toolBarRender={() => toolbar}
    />
  );
}
