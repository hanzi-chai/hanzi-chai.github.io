import React, { useState } from "react";
import { Button, Dropdown, Flex, Input, MenuProps, Space, Table } from "antd";
import { useCharacters, useModify } from "./context";
import { SearchOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { EditorColumn, EditorRow } from "./Utils";

interface DataType {
  key: string;
  pinyin: string[];
}

const EditablePinyin = ({
  pinyin,
  setPinyin,
  deletePinyin,
}: {
  pinyin: string;
  setPinyin: (s: string) => void;
  deletePinyin: () => void;
}) => {
  const items: MenuProps["items"] = [
    {
      key: "delete",
      label: "删除",
      onClick: deletePinyin,
    },
  ];
  return (
    <Dropdown trigger={["contextMenu"]} menu={{ items }}>
      <Input
        style={{ width: "96px" }}
        value={pinyin}
        onChange={(event) => {
          setPinyin(event.target.value);
        }}
      />
    </Dropdown>
  );
};

const CharacterTable: React.FC = () => {
  const characters = useCharacters();
  const modify = useModify();
  const [character, setCharacter] = useState<string>("");
  const rawdata = Object.entries(characters).map(([k, v]) => ({
    key: k,
    pinyin: v,
  }));
  const dataSource = character
    ? rawdata.filter((x) => x.key === character)
    : rawdata;

  const columns: ColumnsType<DataType> = [
    {
      title: "汉字",
      dataIndex: "key",
      width: "30%",
    },
    {
      title: "字音",
      dataIndex: "pinyin",
      render: (_, record) => {
        return (
          <Space>
            {record.pinyin.map((x, i, a) => (
              <EditablePinyin
                pinyin={x}
                setPinyin={(pinyin) => {
                  modify(
                    record.key,
                    a.map((y, j) => (j === i ? pinyin : y)),
                  );
                }}
                deletePinyin={() =>
                  modify(
                    record.key,
                    a.filter((y, j) => j !== i),
                  )
                }
              />
            ))}
            <Button
              onClick={() => {
                modify(record.key, record.pinyin.concat(""));
              }}
            >
              添加
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <EditorRow>
      <EditorColumn span={24}>
        <Flex vertical gap="middle">
          <Input
            placeholder="搜索汉字"
            prefix={<SearchOutlined />}
            value={character}
            onChange={(event) => {
              setCharacter(event.target.value);
            }}
          />
          <Table
            dataSource={dataSource}
            columns={columns}
            pagination={{
              total: dataSource.length,
              pageSize: 10,
            }}
          />
        </Flex>
      </EditorColumn>
    </EditorRow>
  );
};

export default CharacterTable;
