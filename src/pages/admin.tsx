import { useEffect } from "react";
import { listToObject } from "~/lib";
import { Layout } from "antd";
import { list } from "~/api";
import CharacterTable from "~/components/CharacterTable";
import { useChaifenTitle } from "~/components/Utils";
import { primitiveRepertoireAtom, useSetAtom } from "~/atoms";
import { DevTools } from "jotai-devtools";

const AdminLayout = () => {
  useChaifenTitle("部件检查");
  const load = useSetAtom(primitiveRepertoireAtom);
  useEffect(() => {
    list().then((data) => {
      load(listToObject(data));
    });
  }, []);

  return (
    <Layout style={{ height: "100%" }}>
      <CharacterTable />
      <DevTools />
    </Layout>
  );
};

export default AdminLayout;
