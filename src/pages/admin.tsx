import { createContext, useContext, useEffect, useState } from "react";
import { preprocessForm } from "~/lib/utils";
import {
  loadForm,
  selectFormLoading,
  update,
  useAppDispatch,
  useAppSelector,
} from "~/components/store";
import { Checkbox, Flex, Layout, Space } from "antd";
import Table, { ColumnsType } from "antd/es/table";
import Char from "~/components/Char";
import Lookup from "~/components/Lookup";
import { errorFeedback } from "~/components/Utils";
import { useForm } from "~/components/contants";
import { get, put } from "~/lib/api";
import { Compound, Glyph } from "~/lib/data";
import { displayName } from "~/lib/utils";
import { ProColumns, ProTable } from "@ant-design/pro-components";

const FormTable = () => {
  const form = useForm();
  const dispatch = useAppDispatch();
  const columns: ProColumns<Glyph>[] = [
    {
      title: "汉字",
      dataIndex: "unicode",
      render: (_, record) => {
        const char = String.fromCodePoint(record.unicode);
        return displayName(char, form[char]);
      },
    },
    {
      title: "Unicode",
      dataIndex: "unicode",
    },
    {
      title: "GF0014-2009",
      dataIndex: "gf0014_id",
    },
    {
      title: "歧义",
      dataIndex: "ambiguous",
      render: (_, record) => {
        return <Checkbox checked={record.ambiguous === 1} />;
      },
    },
    {
      title: "部件",
      dataIndex: "component",
      render: (_, record) => {
        return (
          <Flex justify="space-between">
            <Space size="middle">
              {record.component?.map((x, i) => (
                <span key={i}>{x.feature}</span>
              ))}
            </Space>
          </Flex>
        );
      },
    },
    {
      title: "复合体",
      dataIndex: "compound",
      render: (_, record) => {
        return (
          <Flex justify="space-between">
            <Space size="middle">
              {record.compound?.map((x, i) => (
                <span key={i}>
                  <span>{x.operator}</span>
                  {x.operandList.map((y, j) => (
                    <Char key={j}>{displayName(y, form[y])}</Char>
                  ))}
                </span>
              ))}
            </Space>
          </Flex>
        );
      },
    },
  ];

  return (
    <>
      <Flex
        component={Layout.Content}
        style={{ padding: "32px" }}
        vertical
        gap="large"
      >
        <ProTable<Glyph>
          columns={columns}
          rowKey="unicode"
          request={async (param, sort, filter) => {
            const raw = Object.values(form).slice(0, 20);
            const data = {
              data: raw,
              total: Object.values(form).length,
              success: true,
            };
            return data;
          }}
        />
      </Flex>
    </>
  );
};

const AdminLayout = () => {
  const loading = useAppSelector(selectFormLoading);
  const dispatch = useAppDispatch();

  useEffect(() => {
    get<any, undefined>("form/all").then((data) => {
      dispatch(loadForm(preprocessForm(data)));
    });
  }, []);

  return loading ? (
    <h1>loading...</h1>
  ) : (
    <Layout style={{ height: "100%" }}>
      <FormTable />
    </Layout>
  );
};

export default AdminLayout;
