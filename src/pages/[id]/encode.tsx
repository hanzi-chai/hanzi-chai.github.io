import { useContext, useEffect, useState } from "react";
import { Alert, Button, Flex, Space, Switch, Typography } from "antd";
import { ConfigContext } from "~/components/context";
import { useAll } from "~/components/contants";

import type { EncoderResult } from "~/lib/encoder";
import encode, { getCache } from "~/lib/encoder";
import type { ColumnsType } from "antd/es/table";
import Table from "antd/es/table";
import { EditorColumn, EditorRow, Select, Uploader } from "~/components/Utils";
import EncoderGraph from "~/components/EncoderGraph";
import { ReactFlowProvider } from "reactflow";
import type { Character } from "~/lib/data";
import { getSupplemental } from "~/lib/utils";
import { useChaifenTitle } from "~/lib/hooks";

interface EncodeResultTable {
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
      !!c[s],
  否:
    (s) =>
    ([, c]) =>
      !c[s],
  未定义: () => () => true,
};

const exportTable = (result: EncoderResult) => {
  const blob = new Blob([JSON.stringify([...result])], { type: "text/plain" });
  const a = document.createElement("a");
  a.download = `码表.json`;
  a.href = window.URL.createObjectURL(blob);
  a.click();
};

const filterOptions = ["成字部件", "非成字部件", "所有汉字"] as const;
type FilterOption = (typeof filterOptions)[number];

const Encoder = () => {
  useChaifenTitle("编码");
  const data = useAll();
  const config = useContext(ConfigContext);
  const [gb2312, setGB2312] = useState<CharsetFilter>("未定义");
  const [tygf, setTYGF] = useState<CharsetFilter>("未定义");
  const [result, setResult] = useState<EncoderResult>(new Map());
  const [dev, setDev] = useState(false);
  const [filterOption, setFilterOption] = useState<FilterOption>("所有汉字");
  const [reference, setReference] = useState<EncoderResult>(() => {
    const content = localStorage.getItem(config.info.name);
    if (content === null) return new Map();
    return new Map(Object.entries(JSON.parse(content)));
  });
  const list = Object.entries(data.repertoire)
    .filter(filtermap[gb2312]("gb2312"))
    .filter(filtermap[tygf]("tygf"))
    .map(([x]) => x);
  const supplemental = getSupplemental(data.form, list);
  const filterMap: Record<FilterOption, (p: [string, string[]]) => boolean> = {
    成字部件: ([char]) => data.form[char]?.default_type === "component",
    非成字部件: ([char]) => supplemental.includes(char),
    所有汉字: () => true,
  };

  useEffect(() => {
    localStorage.setItem(
      config.info.name,
      JSON.stringify(Object.fromEntries([...reference])),
    );
  }, [reference]);

  const lost = [...result].filter(([, v]) => v.length === 0).map(([x]) => x);

  let correct = 0;
  let incorrect = 0;
  let unknown = 0;

  let dataSource = [...result]
    .filter(([, v]) => v.length > 0)
    .filter(filterMap[filterOption])
    .map(([char, code]) => {
      const refcode = reference.get(char) || [];
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

  const columns: ColumnsType<EncodeResultTable> = [
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
        ) : null}
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
              const ref: EncoderResult = new Map(
                Object.entries(JSON.parse(content)),
              );
              setReference(ref);
            }}
          />
          {reference !== undefined && `已加载码表，条数：${reference.size}`}
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
          <Button
            type="primary"
            onClick={() => {
              const rawresult = encode(config, list, data);
              setResult(rawresult);
            }}
          >
            计算
          </Button>
          <Button
            onClick={() => {
              setResult(new Map());
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
      </EditorColumn>
    </EditorRow>
  );
};

export default Encoder;
