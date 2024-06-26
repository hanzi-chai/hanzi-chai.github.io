import { Flex, Layout, Space, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useState } from "react";
import Element from "~/components/Element";
import { repertoireAtom, displayAtom, primitiveRepertoireAtom } from "~/atoms";
import { list } from "~/api";
import {
  binaryToIndices,
  defaultDegenerator,
  generateSliceBinaries,
} from "~/lib";
import { computeComponent, type ComputedComponent } from "~/lib";
import { defaultConfig } from "~/lib";
import { listToObject } from "~/lib";
import { useSetAtom, useAtomValue } from "~/atoms";
import { isEmpty } from "lodash-es";

const DegeneratorTable = () => {
  const repertoire = useAtomValue(repertoireAtom);
  const loading = isEmpty(repertoire);
  const components: ComputedComponent[] = [];
  for (const [name, character] of Object.entries(repertoire)) {
    if (character.glyph?.type !== "basic_component") continue;
    const glyph = character.glyph.strokes;
    const cache = computeComponent(name, glyph);
    components.push(cache);
  }
  components.sort((a, b) => a.glyph.length - b.glyph.length);
  const dataSource = components.filter((cache) => cache.glyph.length >= 3);
  const toCompare = components.filter((cache) => cache.glyph.length >= 2);
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
            defaultDegenerator,
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
                  <Element>{display(name)}</Element>
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
      loading={loading}
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

export default function Algorithm() {
  const setForm = useSetAtom(primitiveRepertoireAtom);

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
}
