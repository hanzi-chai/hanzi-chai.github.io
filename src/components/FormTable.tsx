import { useState } from "react";
import { unicodeBlock } from "~/lib/utils";
import { selectFormLoading, useAppSelector } from "~/redux/store";
import { Button, Flex, Form, Layout, Modal, Space, Typography } from "antd";
import Table, { ColumnsType } from "antd/es/table";
import {
  EditorColumn,
  EditorRow,
  ItemSelect,
  Select,
} from "~/components/Utils";
import { useForm } from "~/components/contants";
import { Glyph, Operator, operators } from "~/lib/data";
import { displayName } from "~/lib/utils";
import {
  GlyphModel,
  ModelContext,
  defaultGlyph,
} from "~/components/GlyphModel";
import GlyphView from "~/components/GlyphView";
import Root from "~/components/Root";
import {
  Create,
  Delete,
  Mutate,
  QuickPatchAmbiguous,
  Update,
} from "~/components/Action";
import StrokeSearch from "~/components/StrokeSearch";
import { getSequence } from "~/lib/form";
import classifier from "~/lib/classifier";
import { ColumnType } from "antd/es/table/interface";

interface CompoundFilter {
  operator?: string;
  operand?: string;
}

const FormTable = () => {
  const formLoading = useAppSelector(selectFormLoading);
  const form = useForm();
  const [thisForm] = Form.useForm<Glyph>();
  const [char, setChar] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [sequence, setSequence] = useState("");

  const dataSource = Object.values(form)
    .filter((x) =>
      getSequence(form, classifier, String.fromCodePoint(x.unicode)).startsWith(
        sequence,
      ),
    )
    .sort((a, b) => {
      return (
        getSequence(form, classifier, String.fromCodePoint(a.unicode)).length -
        getSequence(form, classifier, String.fromCodePoint(b.unicode)).length
      );
    });

  const compoundFilter: ColumnType<Glyph> = {
    filterDropdown: ({
      setSelectedKeys,
      selectedKeys,
      confirm,
      clearFilters,
    }) => {
      const f = JSON.parse(
        (selectedKeys[0] || "{}") as string,
      ) as CompoundFilter;
      const { operator, operand } = f;
      const update = (field: keyof CompoundFilter, value: string) =>
        setSelectedKeys([JSON.stringify({ ...f, [field]: value })]);
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
          <Form.Item label="包含部件">
            <ItemSelect
              value={operand}
              onChange={(value) => update("operand", value)}
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
    onFilter: (value, record) => {
      const { operator, operand } = JSON.parse(
        (value || "{}") as string,
      ) as CompoundFilter;
      if (!record.compound) return false;
      if (
        operator &&
        record.compound.every((x) => !x.operator.startsWith(operator))
      )
        return false;
      if (
        operand &&
        record.compound.every((x) => !x.operandList.includes(operand))
      )
        return false;
      return true;
    },
  };

  const columns: ColumnsType<Glyph> = [
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
      sorter: (a, b) => a.gf0014_id! - b.gf0014_id!,
    },
    {
      title: "部件表示",
      dataIndex: "component",
      render: (_, record) => {
        return record.component !== undefined ? "有" : "无";
      },
      filters: [{ text: "非空", value: "" }].concat(
        Object.keys(classifier).map((x) => ({ text: x, value: x })),
      ),
      onFilter: (value, record) => {
        if (!record.component) return false;
        if (value === "") return true;
        return record.component.strokes.some(
          (x) => typeof x === "object" && x.feature === (value as string),
        );
      },
      width: 128,
    },
    {
      title: "复合体表示",
      dataIndex: "compound",
      ...compoundFilter,
      render: (_, record) => {
        return (
          <Flex gap="small">
            {record.compound?.map((x, i) => (
              <Space key={i}>
                <span>{x.operator}</span>
                {x.operandList.map((y, j) => (
                  <Root key={j}>{displayName(y, form[y])}</Root>
                ))}
              </Space>
            ))}
          </Flex>
        );
      },
      width: 256,
      sorter: (a, b) => {
        const [as, bs] = [
          a.compound?.at(0)?.operandList.join() || "",
          b.compound?.at(0)?.operandList.join() || "",
        ];
        return as.localeCompare(bs);
      },
      sortDirections: ["ascend", "descend"],
    },
    {
      title: "分部歧义标记",
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
      onFilter: (value, record) => +record.ambiguous === value,
      width: 128,
    },
    {
      title: "操作",
      key: "option",
      render: (_, record) => (
        <Space>
          <Button onClick={() => setChar(String.fromCodePoint(record.unicode))}>
            编辑
          </Button>
          <Delete unicode={record.unicode} />
          <Mutate unicode={record.unicode} />
        </Space>
      ),
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
      <Flex style={{ maxWidth: "960px" }} gap="middle">
        <StrokeSearch sequence={sequence} setSequence={setSequence} />
        <Create setChar={setChar} />
      </Flex>
      <ModelContext.Provider value={thisForm}>
        <Modal
          open={char !== undefined}
          onCancel={() => {
            setChar(undefined);
          }}
          footer={<Update setChar={setChar} />}
          width="80%"
        >
          <EditorRow>
            <EditorColumn span={12}>
              <Typography.Title level={2}>预览</Typography.Title>
              <GlyphView form={thisForm} />
            </EditorColumn>
            <EditorColumn span={12}>
              <GlyphModel char={char!} setChar={setChar} form={thisForm} />
            </EditorColumn>
          </EditorRow>
        </Modal>
      </ModelContext.Provider>
      <Table<Glyph>
        dataSource={dataSource}
        columns={columns}
        size="small"
        rowKey="unicode"
        loading={formLoading}
        pagination={{
          pageSize: 50,
          current: page,
        }}
        onChange={(pagination) => {
          setPage(pagination.current!);
        }}
        style={{
          maxWidth: "1920px",
        }}
      />
    </Flex>
  );
};

export default FormTable;
