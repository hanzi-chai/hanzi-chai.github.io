import { Button, Flex, Input, Space, Table } from "antd";
import {
  useAtomValue,
  useAtomValueUnwrapped,
  如组装结果与优先简码原子,
  如组装结果原子,
  最大码长原子,
} from "~/atoms";
import { 序列化, 总序列化, 识别符, type 码位, type 组装条目 } from "~/lib";
import { 如编码结果原子 } from "~/atoms";
import type { ProColumns } from "@ant-design/pro-components";
import ProrityShortCodeSelector from "./ProrityShortCodeSelector";
import { Display, DisplayWithSuperScript } from "./Utils";
import type { ReactNode } from "react";
import { exportTSV } from "~/utils";
import { 编码渲染 } from "./ProrityShortCodeSelector";
import type { ColumnsType } from "antd/es/table";

const ExportAssembly = () => {
  const 组装结果 = useAtomValueUnwrapped(如组装结果与优先简码原子);
  return (
    <Button
      onClick={() => {
        const tsv: string[][] = [];
        for (const { 词, 元素序列, 频率, 简码长度 } of 组装结果) {
          const 元素序列字符串 = 总序列化(元素序列);
          if (简码长度 !== undefined) {
            tsv.push([
              词,
              元素序列字符串,
              频率.toString(),
              简码长度.toString(),
            ]);
          } else {
            tsv.push([词, 元素序列字符串, 频率.toString()]);
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

const getColumnSearchProps = (dataIndex: "词"): ProColumns<组装条目> => ({
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

export const DisplayOptionalSuperscript = ({ element }: { element: 码位 }) => {
  if (typeof element === "string") {
    return <Display name={element} />;
  } else {
    return (
      <DisplayWithSuperScript name={element.element} index={element.index} />
    );
  }
};

export default function SequenceTable() {
  const 最大码长 = useAtomValue(最大码长原子);
  const 组装结果 = useAtomValueUnwrapped(如组装结果原子);

  const dataSource = 组装结果.map((x, i) => ({
    ...x,
    key: 识别符(x.词, x.拼音来源列表),
    originalIndex: i,
  }));

  dataSource.sort((a, b) => b.频率 - a.频率);

  const columns: ColumnsType<组装条目> = [
    {
      title: "名称",
      dataIndex: "词",
      sortDirections: ["ascend", "descend"],
      width: 96,
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
            {record.元素序列.map((element, index) => (
              <DisplayOptionalSuperscript key={index} element={element} />
            ))}
          </Space>
        );
      },
      sorter: (a, b) => {
        const ahash = 总序列化(a.元素序列);
        const bhash = 总序列化(b.元素序列);
        return ahash.localeCompare(bhash);
      },
      width: 128,
      ellipsis: true,
    },
  ];

  for (const i of Array(最大码长).keys()) {
    const allValues: Record<string, ReactNode> = {};
    for (const { 元素序列 } of dataSource) {
      const element = 元素序列[i];
      if (element !== undefined) {
        const text = 序列化(element);
        allValues[text] = <DisplayOptionalSuperscript element={element} />;
      }
    }
    columns.push({
      title: `元素 ${i + 1}`,
      render: (_, record) => {
        const element = record.元素序列[i];
        return element ? (
          <DisplayOptionalSuperscript element={element} />
        ) : null;
      },
      sorter: (a, b) => {
        const ahash = 序列化(a.元素序列[i] ?? "");
        const bhash = 序列化(b.元素序列[i] ?? "");
        return ahash.localeCompare(bhash);
      },
      sortDirections: ["ascend", "descend"],
      width: 96,
      onFilter: (value, record) => {
        const element = record.元素序列[i];
        if (element === undefined) {
          return false;
        }
        return 序列化(element) === value;
      },
      ellipsis: true,
    });
  }

  columns.push(
    {
      title: "简码级数",
      key: "action",
      width: 128,
      render: (_, record) => {
        return (
          <ProrityShortCodeSelector
            词={record.词}
            拼音来源列表={record.拼音来源列表}
          />
        );
      },
    },
    {
      title: "全码",
      width: 96,
      render: (_, record) => (
        <编码渲染 index={record.originalIndex} type="全码" />
      ),
      // ...getColumnSearchProps("全码"),
    },
    {
      title: "简码",
      width: 96,
      render: (_, record) => (
        <编码渲染 index={record.originalIndex} type="简码" />
      ),
      // ...getColumnSearchProps("简码"),
    },
  );

  return (
    <>
      <Flex justify="end" gap="small">
        <ExportAssembly />
        <ExportCode />
      </Flex>
      <Table<组装条目>
        scroll={{ y: 1080 }}
        columns={columns}
        dataSource={dataSource}
        size="small"
        pagination={{ pageSize: 100 }}
      />
    </>
  );
}
