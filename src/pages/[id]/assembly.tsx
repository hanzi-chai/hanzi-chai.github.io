import { useContext, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Flex,
  Form,
  Space,
  Tabs,
  TabsProps,
  Typography,
} from "antd";
import { ConfigContext } from "~/components/context";
import { useAll, useDisplay } from "~/components/contants";
import type {
  CharsetFilter,
  EncoderResult,
  IndexedElement,
} from "~/lib/encoder";
import encode, {
  collect,
  filtermap,
  filtervalues,
  uniquify,
} from "~/lib/encoder";
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
import { useChaifenTitle } from "~/lib/hooks";
import type { ColumnType } from "antd/es/table/interface";

interface EncodeResultTable {
  char: string;
  sequence: IndexedElement[][];
  code: string[];
}

type ElementFilter = {
  element: string;
  duplication: boolean;
};

const Encoder = () => {
  useChaifenTitle("编码");
  const data = useAll();
  const config = useContext(ConfigContext);
  const display = useDisplay();
  const [gb2312, setGB2312] = useState<CharsetFilter>("未定义");
  const [tygf, setTYGF] = useState<CharsetFilter>("未定义");
  const [result, setResult] = useState<EncoderResult>(new Map());
  const list = Object.entries(data.repertoire)
    .filter(filtermap[gb2312]("gb2312"))
    .filter(filtermap[tygf]("tygf"))
    .map(([x]) => x);

  const lost = [...result]
    .filter(([, v]) => v.code.length === 0)
    .map(([x]) => x);

  const renderIndexed = (element: IndexedElement) => {
    const superscripts = "⁰¹²³⁴⁵⁶⁷⁸⁹";
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
  const groups = [...duplicationMap.values()];
  const selections = groups.reduce((p, c) => p + c, 0) - groups.length;

  let dataSource = [...result]
    .filter(([, v]) => v.code.length > 0)
    .map(([char, code]) => {
      return {
        key: char,
        char: char,
        sequence: code.sequence,
        code: code.code,
      };
    });

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
  const items: TabsProps["items"] = [
    {
      key: "1",
      label: "单字全码",
    },
    {
      key: "2",
      label: "构词码",
      disabled: true,
    },
  ];

  return (
    <EditorRow>
      <EditorColumn span={12}>
        <Typography.Title level={2}>取码规则</Typography.Title>
        <Tabs defaultActiveKey="1" items={items} onChange={() => {}} />
        <ReactFlowProvider>
          <EncoderGraph />
        </ReactFlowProvider>
      </EditorColumn>
      <EditorColumn span={12}>
        <Typography.Title level={2}>取码结果</Typography.Title>
        {lost.length ? (
          <Alert
            message="警告"
            description={`${lost.slice(0, 5).join("、")} 等 ${
              lost.length
            } 个字缺少取码所需的原始数据`}
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
        {result.size > 0 && <p>原始重码：{selections}</p>}
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
