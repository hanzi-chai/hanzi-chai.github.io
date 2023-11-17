import { useEffect, useState } from "react";
import { formDefault, length, preprocessForm, unicodeBlock } from "~/lib/utils";
import { loadForm, useAppDispatch } from "~/redux/store";
import { Layout } from "antd";
import { listForm } from "~/lib/api";
import FormTable from "~/components/FormTable";

const AdminLayout = () => {
  const dispatch = useAppDispatch();
  useEffect(() => {
    listForm().then((data) => {
      dispatch(loadForm(preprocessForm(data)));
    });
  }, []);

  return (
    <Layout style={{ height: "100%" }}>
      <FormTable />
    </Layout>
  );
};

export default AdminLayout;
