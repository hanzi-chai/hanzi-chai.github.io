import { useEffect } from "react";
import { listToObject } from "~/lib/utils";
import { Layout } from "antd";
import { listForm } from "~/lib/api";
import FormTable from "~/components/FormTable";
import { useChaifenTitle } from "~/lib/hooks";
import { formAtom, useSetAtom } from "~/atoms";

const AdminLayout = () => {
  useChaifenTitle("部件检查");
  const setForm = useSetAtom(formAtom);
  useEffect(() => {
    listForm().then((data) => {
      setForm(listToObject(data));
    });
  }, []);

  return (
    <Layout style={{ height: "100%" }}>
      <FormTable />
    </Layout>
  );
};

export default AdminLayout;
