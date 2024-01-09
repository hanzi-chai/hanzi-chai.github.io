import { useEffect } from "react";
import { listToObject } from "~/lib/utils";
import { Layout } from "antd";
import { list } from "~/lib/api";
import CharacterTable from "~/components/CharacterTable";
import { useChaifenTitle } from "~/lib/hooks";
import { repertoireAtom, useSetAtom } from "~/atoms";
import { DevTools } from "jotai-devtools";

const AdminLayout = () => {
  useChaifenTitle("部件检查");
  const load = useSetAtom(repertoireAtom);
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
