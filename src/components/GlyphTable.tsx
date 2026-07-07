import { Flex, Space } from "antd";
import type { ColumnsType } from "antd/es/table";
import Table from "antd/es/table";
import type { 基本字形数据, 字形数据 } from "hanzi-chai";
import { 是用户字形 } from "hanzi-chai";
import { useAtom, useAtomValue } from "jotai";
import { useState } from "react";
import { createGlyph, removeGlyph } from "~/api";
import {
  下一个用户字形ID原子,
  原始字库原子,
  可编辑字形列表原子,
  字库原子,
  用户字形列表原子,
  统一字形列表原子,
  远程原子,
} from "~/atoms";
import { errorFeedback, 字符字形过滤器, type 过滤器参数 } from "~/utils";
import BorderItem from "./BorderItem";
import CharacterGlyphSwitcher from "./CharacterGlyphSwitcher";
import FilterForm from "./FilterForm";
import GlyphForm from "./GlyphForm";
import { StrokesView } from "./GlyphView";
import { DeleteButton } from "./Utils";

const CreateGlyph = () => {
  const 远程 = useAtomValue(远程原子);
  const [用户字形列表, set用户字形列表] = useAtom(用户字形列表原子);
  const [可编辑字形列表, set可编辑字形列表] = useAtom(可编辑字形列表原子);
  const 下一个字形ID = useAtomValue(下一个用户字形ID原子);
  return (
    <GlyphForm
      title="新建"
      initialValues={{ id: 0, type: "component", strokes: [] }}
      onFinish={async (record) => {
        if (远程) {
          const res = await createGlyph(record);
          if (!errorFeedback(res)) {
            set可编辑字形列表([...可编辑字形列表, record]);
          }
        } else {
          const recordWithID = { ...record, id: 下一个字形ID };
          set用户字形列表([...用户字形列表, recordWithID as 基本字形数据]);
        }
        return true;
      }}
    />
  );
};

const DeleteGlyph = ({ id }: { id: number }) => {
  const 远程 = useAtomValue(远程原子);
  const [用户字形列表, set用户字形列表] = useAtom(用户字形列表原子);
  const [可编辑字形列表, set可编辑字形列表] = useAtom(可编辑字形列表原子);
  return (
    <DeleteButton
      disabled={!远程 && !是用户字形(id)}
      onClick={async () => {
        if (!confirm(`确定删除字形 ${id} 吗？`)) return;
        if (远程) {
          const res = await removeGlyph(id);
          if (!errorFeedback(res)) {
            set可编辑字形列表(可编辑字形列表.filter((x) => x.id !== id));
          }
        } else {
          set用户字形列表(用户字形列表.filter((x) => x.id !== id));
        }
      }}
    />
  );
};

const EditOrRedrawGraph = ({ record }: { record: 字形数据 }) => {
  const 远程 = useAtomValue(远程原子);
  const [可编辑字形列表, set可编辑字形列表] = useAtom(可编辑字形列表原子);
  const [用户字形列表, set用户字形列表] = useAtom(用户字形列表原子);
  return (
    <GlyphForm
      title="编辑"
      initialValues={record}
      onFinish={async (values) => {
        if (远程) {
          const res = await createGlyph(values);
          if (!errorFeedback(res)) {
            set可编辑字形列表(
              可编辑字形列表.map((x) => (x.id === values.id ? values : x)),
            );
          }
        } else {
          set用户字形列表(
            用户字形列表.map((x) =>
              x.id === values.id ? (values as 基本字形数据) : x,
            ),
          );
        }
        return true;
      }}
    />
  );
};

export default function GlyphTable() {
  const 原始字库 = useAtomValue(原始字库原子);
  const 用户字形列表 = useAtomValue(用户字形列表原子);
  const 字库 = useAtomValue(字库原子);
  const [filter, setFilter] = useState<过滤器参数>({});
  const 过滤器 = new 字符字形过滤器(filter);

  const dataSource: 字形数据[] = [];
  for (const 字形 of 原始字库.字形迭代器()) {
    const 真字形 = 字库.获取字形(字形.id);
    if (!真字形) continue;
    if (过滤器.过滤字形(真字形)) {
      dataSource.push(字形);
    }
  }

  const columns: ColumnsType<字形数据 | 基本字形数据> = [
    {
      title: "ID",
      dataIndex: "id",
      sorter: (a, b) => a.id - b.id,
      sortDirections: ["ascend", "descend"],
      render: (_, record) => (
        <Flex className="flex-nowrap items-center gap-2">
          <BorderItem>
            <StrokesView glyph={字库.获取字形(record.id)!.图形盒子} />
          </BorderItem>
          {record.id}
        </Flex>
      ),
      width: 80,
    },
    {
      title: "类型",
      dataIndex: "type",
      render: (_, record) => (record.type === "component" ? "部件" : "复合体"),
      filters: [
        { text: "部件", value: "component" },
        { text: "复合体", value: "compound" },
      ],
      onFilter: (value, record) => record.type === value,
      width: 96,
    },
    {
      title: "结构",
      dataIndex: "operator",
      filters: [
        { text: "只看有结构描述字符", value: 1 },
        { text: "只看无结构描述字符", value: 0 },
      ],
      onFilter: (value, record) =>
        value === 1 ? !!record.operator : !record.operator,
      width: 64,
    },
    {
      title: "引用",
      render: (_, record) =>
        (record.references ?? []).map((x) => x.id).join(", "),
      sorter: (a, b) =>
        (a.references?.length ?? 0) - (b.references?.length ?? 0),
      width: 80,
    },
    {
      title: "笔画",
      dataIndex: "strokes",
      render: (_, record) => {
        const summaries: string[] = [];
        for (const stroke of record.strokes ?? []) {
          if ("feature" in stroke) {
            summaries.push(stroke.feature);
          } else {
            summaries.push(
              `${stroke.index}[${stroke.from ?? ""}-${stroke.to ?? ""}]`,
            );
          }
        }
        return summaries.join(", ");
      },
      sorter: (a, b) => (a.strokes?.length ?? 0) - (b.strokes?.length ?? 0),
      width: 128,
    },
    {
      title: "GF0014",
      dataIndex: "gf0014_id",
      filters: [{ text: "只看非空", value: 1 }],
      onFilter: (_, record) => record.gf0014_id !== undefined,
      sorter: (a, b) => (a.gf0014_id ?? 0) - (b.gf0014_id ?? 0),
      width: 96,
    },
    {
      title: "GF3001",
      dataIndex: "gf3001_id",
      filters: [{ text: "只看非空", value: 1 }],
      onFilter: (_, record) => record.gf3001_id !== undefined,
      sorter: (a, b) => (a.gf3001_id ?? 0) - (b.gf3001_id ?? 0),
      width: 96,
    },
    {
      title: "操作",
      render: (_, record) => (
        <Space>
          <EditOrRedrawGraph record={record} />
          <DeleteGlyph id={record.id} />
        </Space>
      ),
      filters: [
        { text: "已编辑", value: 1 },
        { text: "未编辑", value: 0 },
      ],
      width: 128,
      onFilter: (value, record) => {
        const customized = 用户字形列表.some((x) => x.id === record.id);
        return value === 1 ? customized : !customized;
      },
    },
  ];

  return (
    <Flex className="overflow-y-scroll" vertical align="center" gap="small">
      <FilterForm setFilter={setFilter} />
      <Flex gap="large">
        <CharacterGlyphSwitcher />
        <CreateGlyph />
      </Flex>
      <Table<字形数据>
        dataSource={dataSource}
        columns={columns}
        size="small"
        rowKey="id"
        pagination={{ defaultPageSize: 50 }}
        className="max-w-480"
      />
    </Flex>
  );
}
