import React, { useInsertionEffect, useMemo, useState } from "react";
import { unicodeBlock } from "~/lib/utils";
import {
  AutoComplete,
  Button,
  Checkbox,
  Flex,
  Form,
  Layout,
  Space,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import Table from "antd/es/table";
import { Select } from "~/components/Utils";
import {
  allRepertoireAtom,
  determinedRepertoireAtom,
  displayAtom,
  sequenceAtom,
  sortedCustomFormAtom,
  tagsAtom,
  useAtomValue,
  userRepertoireAtom,
} from "~/atoms";
import type { Character, Component, Operator } from "~/lib/data";
import { operators } from "~/lib/data";
import CharacterModel, { ModelContext } from "~/components/CharacterModel";
import Root from "~/components/Root";
import {
  Create,
  Delete,
  Mutate,
  QuickPatchAmbiguous,
} from "~/components/Action";
import StrokeSearch, { makeFilter } from "~/components/GlyphSearch";
import classifier from "~/lib/classifier";
import type { ColumnType } from "antd/es/table/interface";
import { GlyphSelect } from "./CharacterSelect";

interface CompoundFilter {
  operator?: Operator;
  operand?: string;
  tag?: string;
}

const parseFilter = (key: React.Key) => {
  return JSON.parse((key || "{}") as string) as CompoundFilter;
};

const CharacterTable = () => {
  const allRepertoire = useAtomValue(allRepertoireAtom);
  const userRepertoire = useAtomValue(userRepertoireAtom);
  const sequenceMap = useAtomValue(sequenceAtom);
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const display = useAtomValue(displayAtom);
  const [formInstance] = Form.useForm<Character>();
  const tags = useAtomValue(tagsAtom);
  const getLength = (a: string) => sequenceMap.get(a)?.length ?? Infinity;

  const dataSource = Object.entries(allRepertoire)
    .sort(([a], [b]) => getLength(a) - getLength(b))
    .filter(([x]) => makeFilter(searchInput, allRepertoire, sequenceMap)(x))
    .map(([, glyph]) => glyph);

  const compoundFilter: ColumnType<Character> = {
    filterDropdown: ({
      setSelectedKeys,
      selectedKeys,
      confirm,
      clearFilters,
    }) => {
      const filter = parseFilter(selectedKeys[0]!);
      const { operator, operand, tag } = filter;
      const update = (field: keyof CompoundFilter, value: string) =>
        setSelectedKeys([JSON.stringify({ ...filter, [field]: value })]);
      return (
        <Flex vertical style={{ padding: 16 }}>
          <Form.Item label="结构">
            <Select<Operator>
              value={operator}
              onChange={(value) => update("operator", value)}
              options={[{ value: "", label: "任意" }].concat(
                operators.map((x) => ({ value: x, label: x })),
              )}
            />
          </Form.Item>
          <Form.Item label="部件">
            <GlyphSelect
              value={operand}
              onChange={(value) => update("operand", value)}
            />
          </Form.Item>
          <Form.Item label="标签">
            <Select
              value={tag}
              onChange={(value) => update("tag", value)}
              options={tags.map((x) => ({ label: x, value: x }))}
            />
          </Form.Item>
          <Flex justify="space-between">
            <Button
              type="link"
              onClick={() => clearFilters && clearFilters()}
              size="small"
            >
              Reset
            </Button>
            <Button type="primary" onClick={() => confirm()} size="small">
              OK
            </Button>
          </Flex>
        </Flex>
      );
    },
    onFilter: (value, { glyphs }) => {
      const { operator, operand, tag } = parseFilter(value as React.Key);
      // if (glyphs.length === 0) return false;
      // if (
      //   operator &&
      //   glyphs.every((x) => !x.operator.startsWith(operator))
      // )
      //   return false;
      // if (
      //   operand &&
      //   record.compound.every((x) => !x.operandList.includes(operand))
      // )
      //   return false;
      // if (tag && record.compound.every((x) => !x.tags?.includes(tag)))
      //   return false;
      return true;
    },
  };

  const columns: ColumnsType<Character> = [
    {
      title: "Unicode",
      dataIndex: "unicode",
      render: (_, { unicode }) => {
        const hex = unicode.toString(16).toUpperCase();
        const valid = ["cjk", "cjk-a"].includes(unicodeBlock(unicode));
        return valid ? String.fromCodePoint(unicode) + ` (${hex})` : hex;
      },
      filters: [
        { text: "CJK 基本集", value: "cjk" },
        { text: "CJK 扩展集 A", value: "cjk-a" },
        { text: "非成字", value: "pua" },
      ],
      onFilter: (value, record) => {
        return unicodeBlock(record.unicode) === value;
      },
      sorter: (a, b) => a.unicode - b.unicode,
      sortDirections: ["ascend", "descend"],
      width: 128,
    },
    {
      title: "通用规范",
      dataIndex: "tygf",
      width: 96,
      render: (_, record) => {
        return <Checkbox checked={record.tygf === 1} />;
      },
      filters: [
        { text: "是", value: 1 },
        { text: "否", value: 0 },
      ],
      onFilter: (value, record) => value === record.tygf,
    },
    {
      title: "GB 2312",
      dataIndex: "gb2312",
      render: (_, record) => {
        return <Checkbox checked={record.gb2312} />;
      },
      width: 96,
      filters: [
        { text: "是", value: true },
        { text: "否", value: false },
      ],
      onFilter: (value, record) => value === record.gb2312,
    },
    {
      title: "字音",
      dataIndex: "pinyin",
      render: (_, record) => {
        return record.readings.join(", ");
      },
      width: 128,
    },
    {
      title: "别名",
      dataIndex: "name",
      width: 128,
      filters: [
        { text: "有", value: true },
        { text: "无", value: false },
      ],
      onFilter: (value, record) => {
        return record.name !== null;
      },
    },
    {
      title: "GF0014 部件序号",
      dataIndex: "gf0014_id",
      width: 192,
      filters: [{ text: "只看非空", value: 1 }],
      onFilter: (value, record) => record.gf0014_id !== null,
      sorter: (a, b) => Number(a.gf0014_id) - Number(b.gf0014_id),
    },
    {
      title: "部件表示",
      dataIndex: "component",
      render: (_, { glyphs }) => {
        return glyphs.some((x) => x.type === "component") ? "有" : "无";
      },
      filters: [{ text: "非空", value: "" }].concat(
        Object.keys(classifier).map((x) => ({ text: x, value: x })),
      ),
      onFilter: (value, { glyphs }) => {
        if (!glyphs.some((x) => x.type === "component")) return false;
        if (value === "") return true;
        return (
          glyphs.filter((x) => x.type === "component")[0] as Component
        ).strokes.some(
          (x) => typeof x === "object" && x.feature === (value as string),
        );
      },
      width: 128,
    },
    {
      title: "复合体表示",
      dataIndex: "compound",
      ...compoundFilter,
      render: (_, { glyphs }) => {
        return (
          <Flex gap="small">
            {glyphs.map((x, i) =>
              x.type === "compound" ? (
                <Space key={i}>
                  <span>{x.operator}</span>
                  {x.operandList.map((y, j) => (
                    <Root key={j}>{display(y)}</Root>
                  ))}
                </Space>
              ) : null,
            )}
          </Flex>
        );
      },
      width: 256,
      sorter: (a, b) => {
        const [as, bs] = [JSON.stringify(a.glyphs), JSON.stringify(b.glyphs)];
        return as.localeCompare(bs);
      },
      sortDirections: ["ascend", "descend"],
    },
    {
      title: "分部歧义",
      dataIndex: "ambiguous",
      render: (_, record) => {
        return (
          <QuickPatchAmbiguous checked={record.ambiguous} record={record} />
        );
      },
      filters: [
        { text: "只看有歧义", value: 1 },
        { text: "只看无歧义", value: 0 },
      ],
      onFilter: (value, record) => Number(record.ambiguous) === value,
      width: 96,
    },
    {
      title: "操作",
      key: "option",
      render: (_, record) => (
        <Space>
          <Button
            onClick={() => {
              formInstance.resetFields();
              formInstance.setFieldsValue(record);
              setOpen(true);
            }}
          >
            编辑
          </Button>
          <Delete unicode={record.unicode} />
          <Mutate unicode={record.unicode} />
        </Space>
      ),
      filters: [
        { text: "已编辑", value: 1 },
        { text: "未编辑", value: 0 },
      ],
      onFilter: (value, record) => {
        const char = String.fromCodePoint(record.unicode);
        const customized = userRepertoire[char] !== undefined;
        return value === 1 ? customized : !customized;
      },
    },
  ];
  return (
    <Flex
      component={Layout.Content}
      style={{ padding: "32px", overflowY: "auto" }}
      vertical
      gap="large"
      align="center"
    >
      <Flex style={{ width: "720px" }} gap="middle" justify="center">
        <StrokeSearch setSequence={setSearchInput} />
        <Create
          onCreate={(char) => {
            const glyph = allRepertoire[char];
            if (glyph === undefined) {
              return;
            }
            formInstance.resetFields();
            formInstance.setFieldsValue(glyph);
            setOpen(true);
          }}
        />
      </Flex>
      <CharacterModel open={open} setOpen={setOpen} form={formInstance} />
      <Table<Character>
        dataSource={dataSource}
        columns={columns}
        size="small"
        rowKey="unicode"
        pagination={{
          pageSize: 50,
          current: page,
        }}
        onChange={(pagination) => {
          const current = pagination.current;
          current && setPage(current);
        }}
        style={{
          maxWidth: "1920px",
        }}
      />
    </Flex>
  );
};

export default CharacterTable;
