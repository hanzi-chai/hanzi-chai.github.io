import { Layout, Row } from "antd";
import { useSetAtom } from "jotai";
import { useEffect } from "react";
import { listCharacters, listGlyphs } from "~/api";
import { 可编辑字形列表原子, 可编辑字符列表原子 } from "~/atoms";
import CharacterTable from "~/components/CharacterTable";
import GlyphTable from "~/components/GlyphTable";
import { EditorColumn } from "~/components/Utils";
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
    <Layout>
      <Layout.Content>
        <Row>
          <EditorColumn span={12}>
            <CharacterTable />
          </EditorColumn>
          <EditorColumn span={12}>
            <GlyphTable />
          </EditorColumn>
        </Row>
      </Layout.Content>
    </Layout>
  );
}
