import { useEffect } from "react";
import type { PrimitiveCharacter } from "~/lib";
import { listToObject } from "~/lib";
import { Layout } from "antd";
import { list } from "~/api";
import CharacterTable from "~/components/CharacterTable";
import { primitiveRepertoireAtom, useChaifenTitle, useSetAtom } from "~/atoms";

const checkIDsInData = (data: PrimitiveCharacter[]) => {
  const reverseGF3001Map = new Map<
    number,
    { unicode: number; name: string | null }[]
  >();
  const reverseGF0014Map = new Map<
    number,
    { unicode: number; name: string | null }[]
  >();
  data.forEach(({ gf3001_id, gf0014_id, unicode, name }) => {
    if (gf3001_id) {
      if (!reverseGF3001Map.has(gf3001_id)) reverseGF3001Map.set(gf3001_id, []);
      reverseGF3001Map.get(gf3001_id)!.push({ unicode, name });
    }
    if (gf0014_id) {
      if (!reverseGF0014Map.has(gf0014_id)) reverseGF0014Map.set(gf0014_id, []);
      reverseGF0014Map.get(gf0014_id)!.push({ unicode, name });
    }
  });
  for (let i = 1; i <= 560; ++i) {
    const list = reverseGF3001Map.get(i);
    if (list?.length !== 1)
      console.log(`gf3001_id=${i} has ${list?.length ?? 0} items`, list);
  }
  for (let i = 1; i <= 514; ++i) {
    const list = reverseGF0014Map.get(i);
    if (list?.length !== 1)
      console.log(`gf0014_id=${i} has ${list?.length ?? 0} items`, list);
  }
};

export default function AdminLayout() {
  useChaifenTitle("管理");
  const load = useSetAtom(primitiveRepertoireAtom);
  useEffect(() => {
    list().then((data) => {
      if ("err" in data) return;
      checkIDsInData(data);
      load(listToObject(data));
    });
  }, [load]);

  return (
    <Layout style={{ height: "100%" }}>
      <CharacterTable />
    </Layout>
  );
}
