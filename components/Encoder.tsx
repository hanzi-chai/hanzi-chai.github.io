import React, { useContext, useEffect, useMemo, useState } from "react";
import { Alert, Button, Flex, Space, Typography } from "antd";
import { ConfigContext, DispatchContext, useAll } from "./context";

import encode, { getCache } from "../lib/encoder";
import Table, { ColumnsType } from "antd/es/table";
import { EncoderResult } from "../lib/config";
import { EditorColumn, EditorRow, Select } from "./Utils";
import EncoderGraph from "./EncoderGraph";
import { ReactFlowProvider } from "reactflow";
import { Character } from "../lib/data";

interface DataType {
  char: string;
  code: string[];
}

const filtervalues = ["是", "否", "未定义"] as const;
type CharsetFilter = (typeof filtervalues)[number];
const filtermap: Record<
  CharsetFilter,
  (s: "gb2312" | "tygf") => (t: [string, Character]) => boolean
> = {
  是:
    (s) =>
    ([, c]) =>
      c[s],
  否:
    (s) =>
    ([, c]) =>
      !c[s],
  未定义: () => () => true,
};

const Encoder = () => {
  const data = useAll();
  const { form, pronunciation, encoder } = useContext(ConfigContext);
  const [gb2312, setGB2312] = useState<CharsetFilter>("未定义");
  const [tygf, setTYGF] = useState<CharsetFilter>("未定义");
  const [result, setResult] = useState<EncoderResult>({});
  const [lost, setLost] = useState<string[]>([]);
  const list = Object.entries(data.characters)
    .filter(filtermap[gb2312]("gb2312"))
    .filter(filtermap[tygf]("tygf"))
    .map(([x]) => x);

  const columns: ColumnsType<DataType> = [
    {
      title: "汉字",
      dataIndex: "char",
      key: "char",
    },
    {
      title: "编码",
      dataIndex: "code",
      key: "code",
      render: (_, record) => {
        return <span>{record.code.join(", ")}</span>;
      },
    },
  ];
  return (
    <EditorRow>
      <EditorColumn span={12}>
        <ReactFlowProvider>
          <EncoderGraph />
        </ReactFlowProvider>
      </EditorColumn>
      <EditorColumn span={12}>
        <Typography.Title level={2}>编码生成</Typography.Title>
        <Space direction="vertical" style={{ width: "100%" }} size="large">
          {lost.length ? (
            <Alert
              message="警告"
              description={`${lost.slice(0, 5).join("、")} 等 ${
                lost.length
              } 个字缺少编码所需的原始数据`}
              type="warning"
              showIcon
              closable
            />
          ) : (
            <></>
          )}
          <Flex justify="center" align="center" gap="large">
            字集过滤
            <Space>
              GB/T 2312
              <Select
                value={gb2312}
                options={filtervalues.map((x) => ({
                  value: x,
                  label: x,
                }))}
                onChange={(value) => setGB2312(value)}
              />
            </Space>
            <Space>
              通用规范
              <Select
                value={tygf}
                options={filtervalues.map((x) => ({
                  value: x,
                  label: x,
                }))}
                onChange={(value) => setTYGF(value)}
              />
            </Space>
          </Flex>
          <Flex justify="center" gap="small">
            {/* <StrokeSearch sequence={sequence} setSequence={setSequence} /> */}
            <Button
              type="primary"
              onClick={() => {
                const [cache, extra] = getCache(list, form, data);
                const rawresult = encode(
                  encoder,
                  form,
                  pronunciation,
                  list,
                  cache,
                  data,
                  extra,
                );
                const filtered = Object.fromEntries(
                  Object.entries(rawresult).filter(([x, v]) => v.length > 0),
                );
                const lost = list.filter((char) => cache[char].length === 0);
                setResult(filtered);
                setLost(lost);
              }}
            >
              计算
            </Button>
            <Button onClick={() => {}}>清空</Button>
            <Button onClick={() => {}}>导出</Button>
          </Flex>
          <Table
            columns={columns}
            dataSource={Object.entries(result).map(([k, v]) => ({
              key: k,
              char: k,
              code: v,
            }))}
            pagination={{ pageSize: 50, hideOnSinglePage: true }}
            size="small"
          />
        </Space>
      </EditorColumn>
    </EditorRow>
  );
};

export default Encoder;
