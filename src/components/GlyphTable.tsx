import { Button, Flex, Popconfirm, Space, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import Table from "antd/es/table";
import type { 基本字形数据, 基本部件数据, 复合体数据, 字形 } from "hanzi-chai";
import {
  isVectorStroke,
  复合体,
  是用户字形,
  结构描述字符列表,
  部件,
} from "hanzi-chai";
import { useAtom, useAtomValue } from "jotai";
import { type ReactElement, useMemo, useState } from "react";
import { createGlyph, removeGlyph, replaceGlyph, updateGlyph } from "~/api";
import {
  下一个用户字形ID原子,
  可编辑字形列表原子,
  可编辑字符列表原子,
  字库原子,
  字形字符映射原子,
  用户字形列表原子,
  统一字形列表原子,
  远程原子,
} from "~/atoms";
import { errorFeedback, 字符字形过滤器, type 过滤器参数 } from "~/utils";
import BorderItem from "./BorderItem";
import CharacterGlyphSwitcher from "./CharacterGlyphSwitcher";
import FilterForm from "./FilterForm";
import GlyphAlgebraForm from "./GlyphAlgebraForm";
import GlyphForm from "./GlyphForm";
import GlyphSelect from "./GlyphSelect";
import GlyphView from "./GlyphView";
import { CharacterDisplay, DeleteButton } from "./Utils";

const CreateGlyph = ({ type }: { type: "component" | "compound" }) => {
  const 远程 = useAtomValue(远程原子);
  const [用户字形列表, set用户字形列表] = useAtom(用户字形列表原子);
  const [可编辑字形列表, set可编辑字形列表] = useAtom(可编辑字形列表原子);
  const 下一个字形ID = useAtomValue(下一个用户字形ID原子);
  const 统一字形列表 = useAtomValue(统一字形列表原子);
  const dummyComponent: 基本部件数据 = {
    id: 0,
    type: "component",
    strokes: [],
    operator: undefined,
    references: undefined,
  };
  const dummyCompound: 复合体数据 = {
    id: 0,
    type: "compound",
    operator: "⿰",
    references: [{ id: 1 }, { id: 1 }],
  };
  const initialValues = type === "component" ? dummyComponent : dummyCompound;
  const hashset = new Set<string>();
  for (const glyph of 统一字形列表) {
    const { id, name, gf0014_id, gf3001_id, ...rest } = glyph;
    const key = JSON.stringify(rest);
    hashset.add(key);
  }
  return (
    <GlyphForm
      trigger={<Button>新建{type === "component" ? "部件" : "复合体"}</Button>}
      initialValues={initialValues}
      onFinish={async (record) => {
        const { id, name, gf0014_id, gf3001_id, ...rest } = record;
        const key = JSON.stringify(rest);
        if (hashset.has(key)) {
          alert("已存在相同的字形，请修改后再提交。");
          return false;
        }
        if (远程) {
          const res = await createGlyph(record);
          if (!errorFeedback(res)) {
            const recordWithID = { ...record, id: res };
            set可编辑字形列表([...可编辑字形列表, recordWithID]);
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

const ReplaceGlyph = ({ id }: { id: number }) => {
  const 远程 = useAtomValue(远程原子);
  const [可编辑字形列表, set可编辑字形列表] = useAtom(可编辑字形列表原子);
  const [可编辑字符列表, set可编辑字符列表] = useAtom(可编辑字符列表原子);
  const [newId, setNewId] = useState<number>();

  return (
    <Popconfirm
      title={`将所有对字形 ${id} 的引用替换为：`}
      description={
        <GlyphSelect value={newId} onChange={setNewId} style={{ width: 160 }} />
      }
      onConfirm={async () => {
        if (newId === undefined || newId === id) return;
        if (远程) {
          const res = await replaceGlyph({ oldId: id, newId });
          if (errorFeedback(res)) return;
        }
        set可编辑字符列表(
          可编辑字符列表.map((c) => ({
            ...c,
            glyphs: c.glyphs.map((g) =>
              g.id === id ? { ...g, id: newId } : g,
            ),
          })),
        );
        set可编辑字形列表(
          可编辑字形列表.map((g) =>
            g.references
              ? {
                  ...g,
                  references: g.references.map((r) =>
                    r.id === id ? { ...r, id: newId } : r,
                  ),
                }
              : g,
          ),
        );
      }}
      onCancel={() => setNewId(undefined)}
      okButtonProps={{ disabled: newId === undefined || newId === id }}
    >
      <Button>替换</Button>
    </Popconfirm>
  );
};

export const EditOrRedrawGraph = ({
  id,
  trigger,
  initialChar,
}: {
  id: number;
  trigger: ReactElement;
  initialChar?: string;
}) => {
  const 远程 = useAtomValue(远程原子);
  const 统一字形列表 = useAtomValue(统一字形列表原子);
  const [可编辑字形列表, set可编辑字形列表] = useAtom(可编辑字形列表原子);
  const [用户字形列表, set用户字形列表] = useAtom(用户字形列表原子);
  const record = 统一字形列表.find((x) => x.id === id);
  if (!record) return null;
  return (
    <GlyphForm
      trigger={trigger}
      initialValues={record}
      onFinish={async (values) => {
        if (远程) {
          const res = await updateGlyph(values);
          if (!errorFeedback(res)) {
            set可编辑字形列表(
              可编辑字形列表.map((x) => (x.id === values.id ? values : x)),
            );
          }
        } else {
          if (用户字形列表.some((x) => x.id === values.id)) {
            set用户字形列表(
              用户字形列表.map((x) => (x.id === values.id ? values : x)),
            );
          } else {
            set用户字形列表([...用户字形列表, values]);
          }
        }
        return true;
      }}
      initialChar={initialChar}
    />
  );
};

export default function GlyphTable() {
  const 统一字形列表 = useAtomValue(统一字形列表原子);
  const 用户字形列表 = useAtomValue(用户字形列表原子);
  const 字库 = useAtomValue(字库原子);
  const [filter, setFilter] = useState<过滤器参数>({});
  const 字形字符映射 = useAtomValue(字形字符映射原子);
  const 远程 = useAtomValue(远程原子);

  const gf0014set = new Set(
    Array(514)
      .keys()
      .map((x) => x + 1),
  );
  const gf3001set = new Set(
    Array(560)
      .keys()
      .map((x) => x + 1),
  );
  for (const 字形 of 统一字形列表) {
    if (字形.gf0014_id) {
      gf0014set.delete(字形.gf0014_id);
    }
    if (字形.gf3001_id) {
      gf3001set.delete(字形.gf3001_id);
    }
  }

  const dataSource = useMemo(() => {
    const 过滤器 = new 字符字形过滤器(filter);
    const result: 字形[] = [];
    for (const [_, 字形] of 字库.字形迭代器()) {
      if (过滤器.过滤字形(字形, 字库)) {
        result.push(字形);
      }
    }
    return result.sort((a, b) => a.标准笔顺.length - b.标准笔顺.length);
  }, [统一字形列表, 字库, filter]);

  let columns: ColumnsType<字形> = [
    {
      title: "ID",
      dataIndex: "id",
      sorter: (a, b) => a.id - b.id,
      sortDirections: ["ascend", "descend"],
      render: (_, record) => (
        <Flex className="flex-nowrap items-center gap-2">
          <Tooltip title={record.name}>
            <BorderItem>
              <GlyphView glyph={record.图形盒子} />
            </BorderItem>
          </Tooltip>
          {record.id}
        </Flex>
      ),
      width: 80,
    },
    {
      title: "类型",
      render: (_, record) => (record instanceof 部件 ? "部件" : "复合体"),
      filters: [
        { text: "部件", value: "component" },
        { text: "复合体", value: "compound" },
      ],
      onFilter: (value, record) =>
        (record instanceof 部件 ? "部件" : "复合体") === value,
      width: 96,
    },
    {
      title: "结构",
      render: (_, record) =>
        record instanceof 部件 ? "" : record.结构描述字符,
      filters: [
        { text: "无", value: "" },
        ...结构描述字符列表.map((x) => ({ text: x, value: x })),
      ],
      onFilter: (value, record) =>
        value === ""
          ? record instanceof 部件
          : record instanceof 复合体 && record.结构描述字符 === value,
      width: 64,
    },
    {
      title: "引用",
      render: (_, record) => {
        if (record instanceof 部件) return null;
        return (
          <Flex>
            {record.部分列表.map((字形) => {
              if (!字形) return null;
              return (
                <Tooltip key={字形.id} title={`ID: ${字形.id}`}>
                  <BorderItem>
                    <GlyphView glyph={字形.图形盒子} />
                  </BorderItem>
                </Tooltip>
              );
            })}
          </Flex>
        );
      },
      width: 80,
    },
    {
      title: "笔画",
      render: (_, record) => {
        const summaries: string[] = [];
        const list = record instanceof 部件 ? record.矢量图形 : record.笔画列表;
        for (const stroke of list) {
          if (isVectorStroke(stroke)) {
            summaries.push(stroke.feature);
          } else {
            const from =
              stroke.from !== undefined ? stroke.from + 1 : undefined;
            const to = stroke.to !== undefined ? stroke.to + 1 : undefined;
            summaries.push(`${stroke.index}[${from ?? ""}-${to ?? ""}]`);
          }
        }
        return summaries.join(", ");
      },
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
      title: "涉及到字符",
      render: (_, record) => {
        const 字符列表 = 字形字符映射.get(record.id) ?? new Set();
        return (
          <span>
            {Array.from(字符列表).map((x) => (
              <Tooltip key={x.toNumber()} title={x.十六进制()}>
                <BorderItem
                  onClick={() => navigator.clipboard.writeText(x.获取名称())}
                >
                  <CharacterDisplay character={x} />
                </BorderItem>
              </Tooltip>
            ))}
          </span>
        );
      },
    },
    {
      title: "操作",
      render: (_, record) => (
        <Space>
          <EditOrRedrawGraph id={record.id} trigger={<Button>编辑</Button>} />
          <ReplaceGlyph id={record.id} />
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

  if (!远程) {
    columns = columns.filter(
      (col) => col.title !== "GF0014" && col.title !== "GF3001",
    );
  }

  return (
    <Flex className="overflow-y-scroll" vertical align="center" gap="small">
      <FilterForm setFilter={setFilter} isGlyph />
      <Flex gap="large">
        <CharacterGlyphSwitcher />
        <GlyphAlgebraForm />
        <CreateGlyph type="component" />
        <CreateGlyph type="compound" />
        <CreateGlyph type="compound" />
      </Flex>
      <Table<字形>
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
