import { useEffect } from "react";
import { listToObject } from "~/lib/utils";
import { loadForm, useAppDispatch } from "~/components/store";
import { Layout } from "antd";
import { listForm } from "~/lib/api";
import FormTable from "~/components/FormTable";

const AdminLayout = () => {
  const dispatch = useAppDispatch();
  useEffect(() => {
    listForm().then((data) => {
      dispatch(loadForm(listToObject(data)));
    });
  }, []);

  return (
    <Layout style={{ height: "100%" }}>
      <FormTable />
    </Layout>
  );
};

export default AdminLayout;
