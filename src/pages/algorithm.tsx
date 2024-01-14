import { Flex, Layout, Space, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useState } from "react";
import Root from "~/components/Element";
import { determinedRepertoireAtom, displayAtom } from "~/atoms";
import { list } from "~/lib/api";
import { binaryToIndices, generateSliceBinaries } from "~/lib/degenerator";
import { type ComputedComponent } from "~/lib/component";
import { defaultKeyboard } from "~/lib/templates";
import { listToObject } from "~/lib/utils";
import { useSetAtom, useAtomValue } from "~/atoms";
import { isEmpty } from "lodash-es";

const DegeneratorTable = () => {
  const repertoire = useAtomValue(determinedRepertoireAtom);
  const formLoading = isEmpty(repertoire);
  const dataSource = Object.values(repertoire)
    .filter((value) => value.glyph?.type === "component")
    .filter((cache) => cache.glyph.length >= 5)
    .sort((a, b) => a.glyph.length - b.glyph.length);
  const toCompare = Object.values(componentForm).filter(
    (cache) => cache.glyph.length >= 2,
  );
  const display = useAtomValue(displayAtom);
  const [page, setPage] = useState(1);
  const columns: ColumnsType<ComputedComponent> = [
    {
      title: "部件",
      dataIndex: "name",
      render: (_, { name }) => {
        return display(name);
      },
      width: 128,
    },
    {
      title: "含有",
      dataIndex: "glyph",
      render: (_, record) => {
        const rootMap = new Map<string, number[]>();
        for (const another of toCompare) {
          if (another.name === record.name) continue;
          const slices = generateSliceBinaries(
            defaultKeyboard,
            record,
            another,
          );
          if (slices.length) {
            rootMap.set(another.name, slices);
          }
        }
        const rootList = [...rootMap].sort((a, b) => {
          const [, aslices] = a;
          const [, bslices] = b;
          return bslices[0]! - aslices[0]!;
        });
        const convert = binaryToIndices(record.glyph.length);
        return (
          <Flex gap="middle" wrap="wrap">
            {rootList.map(([name, slices]) => {
              return (
                <Space key={name}>
                  <Root>{display(name)}</Root>
                  {slices.map((x) => `(${convert(x).join(", ")})`).join(", ")}
                </Space>
              );
            })}
          </Flex>
        );
      },
      width: 960,
    },
  ];
  return (
    <Table
      dataSource={dataSource}
      columns={columns}
      size="small"
      rowKey="name"
      loading={formLoading}
      pagination={{
        pageSize: 50,
        current: page,
      }}
      onChange={(pagination) => {
        setPage(pagination.current!);
      }}
      style={{
        maxWidth: "1920px",
      }}
    />
  );
};

const Algorithm = () => {
  const setForm = useSetAtom(formAtom);

  useEffect(() => {
    list().then((data) => {
      setForm(listToObject(data));
    });
  }, []);

  return (
    <Layout style={{ height: "100%" }}>
      <Flex
        component={Layout.Content}
        style={{ padding: "32px", overflowY: "auto" }}
        vertical
        gap="large"
        align="center"
      >
        <DegeneratorTable />
      </Flex>
    </Layout>
  );
};

export default Algorithm;
