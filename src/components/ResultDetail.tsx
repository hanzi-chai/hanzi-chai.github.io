import { Button, Flex, Space, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import Element from "./Element";
import { customizeAtom, selectorAtom, useAddAtom, useAtomValue } from "~/atoms";
import { sieveMap } from "~/lib";
import type { SchemeWithData } from "~/lib";
import { Display } from "./Utils";

export default function ResultDetail({
  char,
  data,
  map,
}: {
  char: string;
  data: SchemeWithData[];
  map: Map<string, number[][]>;
}) {
  const selector = useAtomValue(selectorAtom);
  const addCustomization = useAddAtom(customizeAtom);

  const columns: ColumnsType<SchemeWithData> = [
    {
      title: "拆分方式",
      dataIndex: "sequence",
      key: "sequence",
      render: (_, { roots, optional }) => (
        <Space>
          {roots.map((root, index) => (
            <Element key={index}>
              <Display name={root} />
            </Element>
          ))}
          {optional && <span>［备选］</span>}
        </Space>
      ),
    },
  ];

  for (const sieve of selector) {
    const { display } = sieveMap.get(sieve)!;
    columns.push({
      title: sieve,
      key: sieve,
      render: (_, { evaluation }) => {
        const value = evaluation.get(sieve);
        return (
          <span>
            {display && value ? display(value as number & number[]) : value}
          </span>
        );
      },
    });
  }

  columns.push({
    title: "操作",
    key: "operations",
    render: (_, { roots }) => (
      <Button onClick={() => addCustomization(char, roots)}>采用</Button>
    ),
  });

  return data.length ? (
    <Flex vertical gap="middle">
      <Flex wrap="wrap" gap="middle" align="center">
        <span>包含字根</span>
        {[...map].map(([s, v]) => (
          <Space key={s}>
            <Element>
              <Display name={s} />
            </Element>
            <span>{v.map((ar) => `(${ar.join(", ")})`).join(" ")}</span>
          </Space>
        ))}
      </Flex>
      <Table
        columns={columns}
        rowKey="scheme"
        dataSource={data}
        pagination={{ hideOnSinglePage: true, defaultPageSize: 10 }}
        size="small"
      />
    </Flex>
  ) : (
    <div />
  );
}
