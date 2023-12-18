import { useContext, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Cascader,
  Checkbox,
  Flex,
  Form,
  Input,
  Space,
  Switch,
  Typography,
} from "antd";
import { ConfigContext, DispatchContext } from "~/components/context";
import { useAll, useDisplay } from "~/components/contants";
import DeleteOutlined from "@ant-design/icons/DeleteOutlined";

import type { EncoderResult, IndexedElement } from "~/lib/encoder";
import encode, { collect, getCache, uniquify } from "~/lib/encoder";
import type { ColumnsType } from "antd/es/table";
import Table from "antd/es/table";
import {
  EditorColumn,
  EditorRow,
  ItemSelect,
  RootSelect,
  Select,
  Uploader,
  exportTSV,
} from "~/components/Utils";
import EncoderGraph from "~/components/EncoderGraph";
import { ReactFlowProvider } from "reactflow";
import type { Character } from "~/lib/data";
import { getSupplemental } from "~/lib/utils";
import { useChaifenTitle } from "~/lib/hooks";
import { Config } from "~/lib/config";
import type { ColumnType } from "antd/es/table/interface";

interface EncodeResultTable {
  char: string;
  sequence: IndexedElement[][];
  code: string[];
  refcode: string[];
}

const defaultRules: NonNullable<Config["encoder"]["rules"]> = [
  { length_equal: 2, formula: "AaAbBaBb" },
  { length_equal: 3, formula: "AaBaCaCb" },
  { length_in_range: [4, 10], formula: "AaBaCaZa" },
];

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

const filterOptions = ["成字部件", "非成字部件", "所有汉字"] as const;
type FilterOption = (typeof filterOptions)[number];

type ElementFilter = {
  element: string;
  duplication: boolean;
};

const Encoder = () => {
  useChaifenTitle("编码");
  const data = useAll();
  const config = useContext(ConfigContext);
  const dispatch = useContext(DispatchContext);
  const display = useDisplay();
  const { encoder } = config;
  const [gb2312, setGB2312] = useState<CharsetFilter>("未定义");
  const [tygf, setTYGF] = useState<CharsetFilter>("未定义");
  const [result, setResult] = useState<EncoderResult>(new Map());
  const [dev, setDev] = useState(false);
  const [filterOption, setFilterOption] = useState<FilterOption>("所有汉字");
  const [reference, setReference] = useState<Map<string, string[]>>(() => {
    const content = localStorage.getItem("." + config.info?.name);
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
      "." + config.info?.name,
      JSON.stringify(Object.fromEntries([...reference])),
    );
  }, [reference]);

  const lost = [...result]
    .filter(([, v]) => v.code.length === 0)
    .map(([x]) => x);

  let correct = 0;
  let incorrect = 0;
  let unknown = 0;
  const superscripts = "⁰¹²³⁴⁵⁶⁷⁸⁹";

  const renderIndexed = (element: IndexedElement) => {
    if (typeof element === "string") {
      return display(element);
    } else {
      return display(element.element) + superscripts[element.index + 1];
    }
  };

  const duplicationMap = new Map<string, number>();
  for (const [_, data] of result.entries()) {
    for (const sequence of data.sequence.slice(0, 1)) {
      const hash = sequence.map(renderIndexed).join(", ");
      duplicationMap.set(hash, (duplicationMap.get(hash) || 0) + 1);
    }
  }
  console.log(duplicationMap);

  let dataSource = [...result]
    .filter(
      ([x, v]) => v.code.length > 0 && filterMap[filterOption]([x, v.code]),
    )
    .map(([char, code]) => {
      const refcode = reference.get(char) || [];
      if (refcode.length) {
        if (code.code.filter((v) => refcode.includes(v)).length) {
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
        sequence: code.sequence,
        code: code.code,
        refcode: refcode,
      };
    });

  if (dev) {
    dataSource = dataSource.filter(({ code, refcode }) => {
      return code.filter((v) => refcode.includes(v)).length === 0;
    });
  }

  const sequenceFilter: ColumnType<EncodeResultTable> = {
    filterDropdown: ({
      setSelectedKeys,
      selectedKeys,
      confirm,
      clearFilters,
    }) => {
      const f = JSON.parse(
        (selectedKeys[0] || "{}") as string,
      ) as ElementFilter;
      const { element, duplication } = f;
      const update = (field: keyof ElementFilter, value: string | boolean) =>
        setSelectedKeys([JSON.stringify({ ...f, [field]: value })]);
      return (
        <Flex vertical style={{ padding: 16 }}>
          <Form.Item label="查看原始重码">
            <Checkbox
              checked={duplication}
              onChange={(value) => update("duplication", value.target.checked)}
            />
          </Form.Item>
          <Form.Item label="包含字根">
            <RootSelect
              char={element}
              exclude=""
              onChange={(value) => update("element", value)}
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
      const { duplication, element } = JSON.parse(
        (value || "{}") as string,
      ) as ElementFilter;
      if (
        duplication === true &&
        record.sequence.every((seq) => {
          let hash = seq.map(renderIndexed).join(", ");
          return (duplicationMap.get(hash) ?? 0) <= 1;
        })
      )
        return false;
      if (
        element &&
        record.sequence.every((x) =>
          x.every((y) => y !== element && (y as any).element !== element),
        )
      )
        return false;
      return true;
    },
  };

  const columns: ColumnsType<EncodeResultTable> = [
    {
      title: "汉字",
      dataIndex: "char",
      key: "char",
      sorter: (a, b) => a.char.codePointAt(0)! - b.char.codePointAt(0)!,
      sortDirections: ["ascend", "descend"],
    },
    {
      title: "拆分",
      dataIndex: "sequence",
      ...sequenceFilter,
      key: "sequence",
      render: (_, record) => {
        return (
          <span>
            {uniquify(
              record.sequence.map((x) => {
                return x.map(renderIndexed).join(" ");
              }),
            ).join(", ")}
          </span>
        );
      },
      sorter: (a, b) => {
        const ahash = a.sequence[0]?.map(renderIndexed).join(", ");
        const bhash = b.sequence[0]?.map(renderIndexed).join(", ");
        if (ahash === undefined || bhash === undefined) {
          return 0;
        }
        return ahash.localeCompare(bhash);
      },
      sortDirections: ["ascend", "descend"],
    },
    {
      title: "编码",
      dataIndex: "code",
      key: "code",
      render: (_, record) => {
        return <span>{record.code.join(", ")}</span>;
      },
      sorter: (a, b) => a.code.join(", ").localeCompare(b.code.join(", ")),
      sortDirections: ["ascend", "descend"],
      filters: [...config.form.alphabet]
        .sort()
        .map((x) => ({ text: x, value: x })),
      onFilter: (value, record) => {
        return record.code.some((s) => s.includes(value as string));
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

  const wordLengthArray = [...Array(9).keys()].map((x) => ({
    label: x + 2,
    value: x + 2,
  }));
  return (
    <EditorRow>
      <EditorColumn span={12}>
        <ReactFlowProvider>
          <EncoderGraph />
        </ReactFlowProvider>
      </EditorColumn>
      <EditorColumn span={12}>
        <Typography.Title level={2}>编码生成</Typography.Title>
        <Typography.Title level={3}>编码特性</Typography.Title>
        <Flex gap="middle" justify="center">
          <Form.Item label="最大码长">
            <Select
              value={encoder.max_length}
              options={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
                .map((x) => ({
                  label: x.toString(),
                  value: x as number | undefined,
                }))
                .concat([{ label: "不限制", value: undefined }])}
              onChange={(value) => {
                dispatch({
                  type: "encoder",
                  value: { ...encoder, max_length: value },
                });
              }}
            />
          </Form.Item>
          <Form.Item label="顶屏码长">
            <Select
              value={encoder.max_length}
              options={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
                .map((x) => ({
                  label: x.toString(),
                  value: x as number | undefined,
                }))
                .concat([{ label: "不自动顶屏", value: undefined }])}
              onChange={(value) => {
                dispatch({
                  type: "encoder",
                  value: { ...encoder, auto_select_length: value },
                });
              }}
            />
          </Form.Item>
        </Flex>
        <Flex vertical align="center">
          {(encoder.rules ?? defaultRules).map((rule, index) => {
            return (
              <Flex key={index} gap="middle" justify="center">
                {"length_equal" in rule ? (
                  <Form.Item label="词语长度为">
                    <Select
                      value={rule.length_equal}
                      options={wordLengthArray}
                    />
                  </Form.Item>
                ) : (
                  <Form.Item label="词语长度在范围内">
                    <Cascader
                      value={rule.length_in_range}
                      options={wordLengthArray.map((x) => ({
                        ...x,
                        children: wordLengthArray,
                      }))}
                    />
                  </Form.Item>
                )}
                <Form.Item label="规则">
                  <Input value={rule.formula} />
                </Form.Item>
                <Button
                  shape="circle"
                  type="text"
                  danger
                  onClick={() => {}}
                  icon={<DeleteOutlined />}
                />
              </Flex>
            );
          })}
          <Space>
            <Button>添加规则</Button>
            <Button>添加规则（范围）</Button>
          </Space>
        </Flex>
        <Typography.Title level={3}>字集</Typography.Title>
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
              const ref: Map<string, string[]> = new Map(
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
              const tsv = [...result]
                .filter(([, code]) => code.code.length >= 1)
                .map(([char, code]) => [char, code.code[0]!]);
              exportTSV(tsv, "codes.txt");
            }}
          >
            导出码表
          </Button>
          <Button
            onClick={() => {
              const collection = collect(config, list, data);
              const tsv = [...collection]
                .filter(([, code]) => code.length >= 1)
                .map(([char, elements_list]) => {
                  // 目前只支持一种拆分
                  const elements = elements_list[0]!;
                  const summary = elements
                    .map((x) => {
                      if (typeof x === "string") return x;
                      else {
                        return `${x.element}.${x.index}`;
                      }
                    })
                    .join(" ");
                  return [char, summary];
                });
              exportTSV(tsv, "elements.txt");
            }}
          >
            导出拆分表
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
