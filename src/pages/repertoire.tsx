import { Flex, Layout, Skeleton, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { Suspense } from "react";
import { useAtomValue, 原始字库数据原子 } from "~/atoms";
import { type 区块, 区块列表 } from "~/lib";

export default function Repertoire() {
  const repertoire = useAtomValue(原始字库数据原子);
  const unicodes = Object.keys(repertoire).map((key) => key.codePointAt(0)!);
  for (const unicode of unicodes) {
    let identified = false;
    for (const block of 区块列表) {
      if (unicode >= block.begin && unicode <= block.end) {
        identified = true;
      }
    }
    if (!identified) {
      console.log(`${unicode.toString(16).toUpperCase()} is not identified`);
    }
  }

  const columns: ColumnsType<区块> = [
    {
      title: "名称",
      dataIndex: "label",
      key: "label",
    },
    {
      title: "码位起始",
      dataIndex: "begin",
      key: "begin",
      render: (x) => x.toString(16).toUpperCase(),
    },
    {
      title: "码位终止",
      dataIndex: "end",
      key: "end",
      render: (x) => x.toString(16).toUpperCase(),
    },
    {
      title: "总数",
      dataIndex: "count",
      key: "count",
    },
    {
      title: "收录数量",
      render: (_, record) => {
        const { begin, end } = record;
        const count = unicodes.filter(
          (code) => code >= begin && code <= end,
        ).length;
        const emoji = count === record.count ? "✅" : "";
        return `${count} ${emoji}`;
      },
    },
  ];

  return (
    <Layout>
      <Flex vertical justify="center" align="center">
        <Suspense fallback={<Skeleton />}>
          <Typography.Title>自动拆分系统收字情况</Typography.Title>
          <Table
            columns={columns}
            dataSource={区块列表}
            rowKey="name"
            pagination={{ pageSize: 50 }}
          />
        </Suspense>
      </Flex>
    </Layout>
  );
}
