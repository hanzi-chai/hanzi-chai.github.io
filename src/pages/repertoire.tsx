import { Flex, Layout, Table, Typography } from "antd";
import { ColumnsType } from "antd/es/table";
import { Suspense, useEffect } from "react";
import { fromModel } from "~/api";
import { fetchAsset, primitiveRepertoireAtom, useAtom } from "~/atoms";
import CustomSpin from "~/components/CustomSpin";
import { listToObject, UnicodeBlock, unicodeBlocks } from "~/lib";

export default function Repertoire() {
  const [repertoire, setRepertoire] = useAtom(primitiveRepertoireAtom);
  const unicodes = Object.keys(repertoire).map((key) => key.codePointAt(0)!);
  for (const unicode of unicodes) {
    let identified = false;
    for (const block of unicodeBlocks) {
      if (unicode >= block.begin && unicode <= block.end) {
        identified = true;
      }
    }
    if (!identified) {
      console.log(`${unicode.toString(16).toUpperCase()} is not identified`);
    }
  }

  useEffect(() => {
    fetchAsset("repertoire.json.deflate").then((value) =>
      setRepertoire(listToObject(value.map(fromModel))),
    );
  }, [setRepertoire]);

  const columns: ColumnsType<UnicodeBlock> = [
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
        <Suspense fallback={<CustomSpin tip="加载JSON数据…" />}>
          <Typography.Title>自动拆分系统收字情况</Typography.Title>
          <Table
            columns={columns}
            dataSource={unicodeBlocks}
            rowKey="name"
            pagination={{ pageSize: 50 }}
          />
        </Suspense>
      </Flex>
    </Layout>
  );
}
