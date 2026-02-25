import { Button, Flex, Space, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useAddAtom, 自定义拆分原子 } from "~/atoms";
import type { 拆分方式与评价 } from "~/lib";
import Element from "./Element";
import { Display } from "./Utils";

export default function ResultDetail({
  char,
  data,
  map,
}: {
  char: string;
  data: 拆分方式与评价[];
  map: Map<string, number[][]>;
}) {
  const addCustomization = useAddAtom(自定义拆分原子);

  const columns: ColumnsType<拆分方式与评价> = [
    {
      title: "拆分方式",
      dataIndex: "sequence",
      key: "sequence",
      render: (_, { 拆分方式, 可用 }) => (
        <Space>
          {拆分方式.map(({ 名称 }, index) => (
            <Element key={index}>
              <Display name={名称} />
            </Element>
          ))}
          {可用 && <span>［备选］</span>}
        </Space>
      ),
    },
  ];

  const keys: string[] = [];
  for (const { 评价 } of data) {
    for (const key of 评价.keys()) {
      if (!keys.includes(key)) {
        keys.push(key);
      }
    }
  }
  for (const key of keys) {
    columns.push({
      title: key,
      key,
      render: (_, { 评价 }) => {
        return <span>{评价.get(key)?.join(", ")}</span>;
      },
    });
  }

  columns.push({
    title: "操作",
    key: "operations",
    render: (_, { 拆分方式 }) => (
      <Button
        onClick={() =>
          addCustomization(
            char,
            拆分方式.map((x) => x.名称),
          )
        }
      >
        采用
      </Button>
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
