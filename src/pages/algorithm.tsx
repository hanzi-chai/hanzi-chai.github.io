import { Flex, Layout, Space, Table } from "antd";
import { ColumnsType } from "antd/es/table";
import { useEffect, useState } from "react";
import Root from "~/components/Root";
import { useAll, useDisplay, useForm } from "~/components/contants";
import {
  loadForm,
  selectFormLoading,
  useAppDispatch,
  useAppSelector,
} from "~/components/store";
import { listForm } from "~/lib/api";
import { binaryToIndices, generateSliceBinaries } from "~/lib/degenerator";
import { Cache, renderComponentForm } from "~/lib/form";
import { listToObject } from "~/lib/utils";

const DegeneratorTable = () => {
  const formLoading = useAppSelector(selectFormLoading);
  const data = useAll();
  const componentForm = renderComponentForm(data);
  const dataSource = [...componentForm.values()]
    .filter((cache) => cache.glyph.length >= 3)
    .sort((a, b) => a.glyph.length - b.glyph.length);
  const toCompare = [...componentForm.values()].filter(
    (cache) => cache.glyph.length >= 2,
  );
  const display = useDisplay();
  const [page, setPage] = useState(1);
  const columns: ColumnsType<Cache> = [
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
          const slices = generateSliceBinaries(record, another);
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
                <Space>
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
  const dispatch = useAppDispatch();
  useEffect(() => {
    listForm().then((data) => {
      dispatch(loadForm(listToObject(data)));
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
