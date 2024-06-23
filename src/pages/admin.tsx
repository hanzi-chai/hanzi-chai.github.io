import { useEffect } from "react";
import { listToObject } from "~/lib";
import { Layout } from "antd";
import { list } from "~/api";
import CharacterTable from "~/components/CharacterTable";
import { primitiveRepertoireAtom, useChaifenTitle, useSetAtom } from "~/atoms";
import { DevTools } from "jotai-devtools";

export default function AdminLayout() {
  useChaifenTitle("管理");
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
}
