import Mapping from "~/components/Mapping";
import { Typography } from "antd";
import { EditorColumn, EditorRow } from "~/components/Utils";
import ElementPicker from "~/components/ElementPicker";
import { useChaifenTitle } from "~/atoms";

export default function Element() {
  useChaifenTitle("元素");
  return (
    <EditorRow>
      <EditorColumn span={8}>
        <Typography.Title level={3}>元素选择器</Typography.Title>
        <ElementPicker />
      </EditorColumn>
      <EditorColumn span={16}>
        <Typography.Title level={3}>键盘映射</Typography.Title>
        <Mapping />
      </EditorColumn>
    </EditorRow>
  );
}
