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
    listCharacters().then((data) => !("err" in data) && 设置字符列表(data));
    listGlyphs().then((data) => !("err" in data) && 设置字形列表(data));
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
