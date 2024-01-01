import React, { useState } from "react";
import { Button, Flex, Input, Space, Table } from "antd";
import {
  customRepertoireAtom,
  repertoireCustomizationAtom,
  useAddAtom,
  useAtomValue,
  useSetAtom,
} from "~/atoms";
import SearchOutlined from "@ant-design/icons/SearchOutlined";
import * as O from "optics-ts/standalone";

import type { ColumnsType } from "antd/es/table";
import { EditorColumn, EditorRow } from "~/components/Utils";
import { deepcopy } from "~/lib/utils";
import { useChaifenTitle } from "~/lib/hooks";
import { Character } from "~/lib/data";

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
  useChaifenTitle("字音字集数据");
  const characters = useAtomValue(customRepertoireAtom);
  const add = useAddAtom(repertoireCustomizationAtom);
  const [input, setInput] = useState("");
  const rawdata = Object.values(characters);
  const dataSource = input
    ? rawdata.filter((x) => String.fromCodePoint(x.unicode) === input)
    : rawdata;

  const columns: ColumnsType<Character> = [
    {
      title: "汉字",
      dataIndex: "key",
      render: (_, record) => {
        return <span>{String.fromCodePoint(record.unicode)}</span>;
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
        const key = String.fromCodePoint(record.unicode);
        return (
          <Flex justify="space-between">
            <Space size="middle">
              {record.pinyin.map((x, i) => (
                <EditablePinyin
                  key={i}
                  pinyin={x}
                  setPinyin={(pinyin) => {
                    const modified = deepcopy(record);
                    modified.pinyin[i] = pinyin;
                    add(key, modified);
                  }}
                  deletePinyin={() => {
                    const modified = deepcopy(record);
                    modified.pinyin.splice(i, 1);
                    add(key, modified);
                  }}
                />
              ))}
            </Space>
            <Button
              onClick={() => {
                const modified = deepcopy(record);
                modified.pinyin.push("");
                add(key, modified);
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
            rowKey={"unicode"}
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
