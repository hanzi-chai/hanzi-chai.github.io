import React, { useState } from "react";
import { Button, Flex, Form, FormInstance, Input, Space, Table } from "antd";
import {
  customRepertoireAtom,
  repertoireCustomizationAtom,
  useAddAtom,
  useAtomValue,
} from "~/atoms";
import SearchOutlined from "@ant-design/icons/SearchOutlined";
import type { ColumnsType } from "antd/es/table";
import { EditorColumn, EditorRow } from "~/components/Utils";
import { unicodeBlock } from "~/lib/utils";
import { useChaifenTitle } from "~/lib/hooks";
import { Character } from "~/lib/data";
import {
  ModalForm,
  ProFormCheckbox,
  ProFormDigit,
  ProFormGroup,
  ProFormList,
  ProFormText,
} from "@ant-design/pro-components";
import { InlineRender } from "~/components/GlyphModel";

const Repertoire: React.FC = () => {
  useChaifenTitle("字音字集数据");
  const characters = useAtomValue(customRepertoireAtom);
  const repertoireCustomization = useAtomValue(repertoireCustomizationAtom);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const rawdata = Object.values(characters);
  const [formInstance] = Form.useForm<Character>();
  const dataSource = input
    ? rawdata.filter((x) => String.fromCodePoint(x.unicode) === input)
    : rawdata;

  const columns: ColumnsType<Character> = [
    {
      title: "Unicode",
      dataIndex: "unicode",
      render: (_, { unicode }) => {
        const hex = unicode.toString(16).toUpperCase();
        const valid = ["cjk", "cjk-a"].includes(unicodeBlock(unicode));
        return valid ? String.fromCodePoint(unicode) + ` (${hex})` : hex;
      },
      width: 128,
    },
    {
      title: "通用规范",
      dataIndex: "tygf",
      render: (_, record) => {
        return <span>{record.tygf ? "是" : "否"}</span>;
      },
      width: 128,
    },
    {
      title: "GB/T 2312",
      dataIndex: "gb2312",
      render: (_, record) => {
        return <span>{record.gb2312 ? "是" : "否"}</span>;
      },
      width: 128,
    },
    {
      title: "字音",
      dataIndex: "pinyin",
      render: (_, record) => {
        return record.pinyin.join(", ");
      },
      width: 256,
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
        </Space>
      ),
      filters: [
        { text: "已编辑", value: 1 },
        { text: "未编辑", value: 0 },
      ],
      onFilter: (value, record) => {
        const char = String.fromCodePoint(record.unicode);
        const customized = repertoireCustomization[char] !== undefined;
        return value === 1 ? customized : !customized;
      },
    },
  ];

  return (
    <EditorRow>
      <EditorColumn span={24}>
        <Flex vertical gap="middle" align="center">
          <Input
            placeholder="搜索汉字"
            prefix={<SearchOutlined />}
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
            }}
          />
          <CharacterModel open={open} setOpen={setOpen} form={formInstance} />
          <Table
            dataSource={dataSource}
            columns={columns}
            size="small"
            rowKey="unicode"
            pagination={{
              total: dataSource.length,
              pageSize: 50,
            }}
            style={{
              maxWidth: "1920px",
            }}
          />
        </Flex>
      </EditorColumn>
    </EditorRow>
  );
};

const CharacterModel = ({
  open,
  setOpen,
  form,
}: {
  open: boolean;
  setOpen: (o: boolean) => void;
  form: FormInstance<Character>;
}) => {
  const add = useAddAtom(repertoireCustomizationAtom);
  return (
    <ModalForm<Character>
      form={form}
      layout="horizontal"
      open={open}
      onOpenChange={setOpen}
      onFinish={async (values) => {
        add(String.fromCodePoint(values.unicode), values);
      }}
    >
      <ProFormGroup>
        <ProFormDigit label="Unicode" name="unicode" disabled width="xs" />
        <ProFormDigit label="通用规范" name="tygf" disabled width="xs" />
        <ProFormCheckbox label="GB/T 2312" name="gb2312" disabled />
        <ProFormList
          label="拼音"
          name="pinyin"
          itemRender={InlineRender}
          copyIconProps={false}
          creatorRecord={() => ({ toString: () => "" })}
        >
          {(meta) => (
            <Form.Item noStyle {...meta}>
              <Input style={{ width: "128px" }} />
            </Form.Item>
          )}
        </ProFormList>
      </ProFormGroup>
    </ModalForm>
  );
};

export default Repertoire;
