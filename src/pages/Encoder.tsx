import React, { useContext, useEffect, useMemo, useState } from "react";
import { Alert, Button, Flex, Space, Switch, Typography } from "antd";
import {
  ConfigContext,
  DispatchContext,
  useAll,
  useForm,
} from "../components/context";

import encode, { EncoderResult, getCache } from "../lib/encoder";
import Table, { ColumnsType } from "antd/es/table";
import { EditorColumn, EditorRow, Select, Uploader } from "../components/Utils";
import EncoderGraph from "../components/EncoderGraph";
import { ReactFlowProvider } from "reactflow";
import { Character } from "../lib/data";
import { getSupplemental } from "../lib/utils";

interface DataType {
  char: string;
  code: string[];
  refcode: string[];
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

const exportTable = (result: EncoderResult) => {
  const blob = new Blob([JSON.stringify(result)], { type: "text/plain" });
  const a = document.createElement("a");
  a.download = `码表.json`;
  a.href = window.URL.createObjectURL(blob);
  a.click();
};

const filterOptions = ["成字部件", "非成字部件", "所有汉字"] as const;
type FilterOption = (typeof filterOptions)[number];

const Encoder = () => {
  const data = useAll();
  const { form, pronunciation, encoder, reference } = useContext(ConfigContext);
  const dispatch = useContext(DispatchContext);
  const [gb2312, setGB2312] = useState<CharsetFilter>("未定义");
  const [tygf, setTYGF] = useState<CharsetFilter>("未定义");
  const [result, setResult] = useState<EncoderResult>({});
  const [lost, setLost] = useState<string[]>([]);
  const [dev, setDev] = useState(false);
  const [filterOption, setFilterOption] = useState<FilterOption>("所有汉字");
  const list = Object.entries(data.repertoire)
    .filter(filtermap[gb2312]("gb2312"))
    .filter(filtermap[tygf]("tygf"))
    .map(([x]) => x);
  const supplemental = getSupplemental(data.form, list);
  const filterMap: Record<FilterOption, (p: [string, string[]]) => boolean> = {
    成字部件: ([char]) => data.form[char]?.default_type === 0,
    非成字部件: ([char]) => supplemental.includes(char),
    所有汉字: () => true,
  };

  const compute = () => {
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
      Object.entries(rawresult).filter(([, v]) => v.length > 0),
    );
    const lost = list.filter((char) => cache[char].length === 0);
    setResult(filtered);
    setLost(lost);
  };

  let correct = 0,
    incorrect = 0,
    unknown = 0;

  let dataSource = Object.entries(result)
    .filter(filterMap[filterOption])
    .map(([char, code]) => {
      const refcode = reference ? reference[char] || [] : [];
      if (refcode.length) {
        if (code.filter((v) => refcode.includes(v)).length) {
          correct += 1;
        } else {
          incorrect += 1;
        }
      } else {
        unknown += 1;
      }
      return {
        key: char,
        char: char,
        code: code,
        refcode: refcode,
      };
    });

  if (dev) {
    dataSource = dataSource.filter(({ code, refcode }) => {
      return code.filter((v) => refcode.includes(v)).length === 0;
    });
  }

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

  if (dev) {
    columns.push({
      title: "参考编码",
      dataIndex: "refcode",
      key: "refcode",
      render: (_, record) => {
        return <span>{record.refcode.join(", ")}</span>;
      },
    });
  }
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
          <Flex justify="center" align="center" gap="large">
            校对模式
            <Switch checked={dev} onChange={setDev} />
            <Uploader
              text="导入 JSON 码表"
              action={(content) => {
                dispatch({ type: "reference", value: JSON.parse(content) });
              }}
            />
            {reference !== undefined &&
              `已加载码表，条数：${Object.keys(reference).length}`}
          </Flex>
          {dev && (
            <Flex justify="center" align="center" gap="large">
              校对范围
              <Select
                value={filterOption}
                options={filterOptions.map((x) => ({ label: x, value: x }))}
                onChange={setFilterOption}
              />
              {`正确：${correct}, 错误：${incorrect}, 未知：${unknown}，正确率：${Math.round(
                (correct / (correct + incorrect + unknown)) * 100,
              )}%`}
            </Flex>
          )}
          <Flex justify="center" gap="small">
            <Button type="primary" onClick={compute}>
              计算
            </Button>
            <Button
              onClick={() => {
                setResult({});
                setLost([]);
              }}
            >
              清空
            </Button>
            <Button
              onClick={() => {
                exportTable(result);
              }}
            >
              导出
            </Button>
          </Flex>
          <Table
            columns={columns}
            dataSource={dataSource}
            pagination={{ pageSize: 50, hideOnSinglePage: true }}
            size="small"
          />
        </Space>
      </EditorColumn>
    </EditorRow>
  );
};

export default Encoder;
