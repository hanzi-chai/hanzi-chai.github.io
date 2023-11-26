import React, { useState } from "react";
import { Button,  Flex, Input,  Space, Table } from "antd";
import { useAdd } from "~/components/context";
import { useRepertoire } from "~/components/contants";
import SearchOutlined from "@ant-design/icons/SearchOutlined"

import type { ColumnsType } from "antd/es/table";
import { EditorColumn, EditorRow } from "~/components/Utils";
import type { Character } from "~/lib/data";
import { deepcopy } from "~/lib/utils";
import { useChaifenTitle } from "~/lib/hooks";

interface DataType extends Character {
  key: string;
  self: Character;
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
  return (
    <Space>
      <Input
        style={{ width: "80px" }}
        value={pinyin}
        onChange={(event) => {
          setPinyin(event.target.value);
        }}
      />
      <a onClick={deletePinyin}>删除</a>
    </Space>
  );
};

const Repertoire: React.FC = () => {
  useChaifenTitle('字音字集数据')
  const characters = useRepertoire();
  const modify = useAdd();
  const [input, setInput] = useState("");
  const rawdata = Object.entries(characters).map(([k, v]) => ({
    key: k,
    self: v,
    ...v,
  }));
  const dataSource = input ? rawdata.filter((x) => x.key === input) : rawdata;

  const columns: ColumnsType<DataType> = [
    {
      title: "汉字",
      dataIndex: "key",
      render: (_, record) => {
        return <span>{record.key}</span>;
      },
    },
    {
      title: "通用规范",
      dataIndex: "tygf",
      render: (_, record) => {
        return <span>{record.tygf ? "是" : "否"}</span>;
      },
    },
    {
      title: "GB/T 2312",
      dataIndex: "gb2312",
      render: (_, record) => {
        return <span>{record.gb2312 ? "是" : "否"}</span>;
      },
    },
    {
      title: "字音",
      dataIndex: "pinyin",
      render: (_, record) => {
        return (
          <Flex justify="space-between">
            <Space size="middle">
              {record.pinyin.map((x, i) => (
                <EditablePinyin
                  key={i}
                  pinyin={x}
                  setPinyin={(pinyin) => {
                    const modified = deepcopy(record.self);
                    modified.pinyin[i] = pinyin;
                    modify(record.key, modified);
                  }}
                  deletePinyin={() => {
                    const modified = deepcopy(record.self);
                    modified.pinyin.splice(i, 1);
                    modify(record.key, modified);
                  }}
                />
              ))}
            </Space>
            <Button
              onClick={() => {
                const modified = deepcopy(record.self);
                modified.pinyin.push("");
                modify(record.key, modified);
              }}
            >
              添加
            </Button>
          </Flex>
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
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
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

export default Repertoire;
