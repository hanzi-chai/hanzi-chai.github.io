import { Layout } from "antd";
import { useSetAtom } from "jotai";
import { useEffect } from "react";
import { listCharacters, listGlyphs } from "~/api";
import { 可编辑字形列表原子, 可编辑字符列表原子 } from "~/atoms";
import CharacterTable from "~/components/CharacterTable";
import GlyphTable from "~/components/GlyphTable";
import { EditorColumn, EditorRow } from "~/components/Utils";
import { useChaifenTitle } from "~/utils";

export default function AdminLayout() {
  useChaifenTitle("管理");
  const 设置字符列表 = useSetAtom(可编辑字符列表原子);
  const 设置字形列表 = useSetAtom(可编辑字形列表原子);

  useEffect(() => {
    Promise.all([listCharacters(), listGlyphs()]).then(
      ([字符数据, 字形数据]) => {
        if (!("err" in 字符数据)) 设置字符列表(字符数据);
        if (!("err" in 字形数据)) 设置字形列表(字形数据);
      },
    );
  }, []);

  return (
    <Layout className="h-screen">
      <Layout.Content className="h-full overflow-y-auto">
        <EditorRow>
          <EditorColumn span={10}>
            <CharacterTable />
          </EditorColumn>
          <EditorColumn span={14}>
            <GlyphTable />
          </EditorColumn>
        </EditorRow>
      </Layout.Content>
    </Layout>
  );
}
