import Mapping from "~/components/Mapping";
import { Typography } from "antd";
import { EditorColumn, EditorRow } from "~/components/Utils";
import {
  ShapeElementPicker,
  PronElementPicker,
} from "~/components/ElementPicker";
import { useChaifenTitle } from "~/atoms";

export default function Element() {
  useChaifenTitle("元素");
  return (
    <EditorRow>
      <EditorColumn span={8}>
        <Typography.Title level={3}>字形元素</Typography.Title>
        <ShapeElementPicker />
        <Typography.Title level={3}>字音元素</Typography.Title>
        <ul>
          <li>
            「声母」和「韵母」是按照《汉语拼音方案》中所规定的声母和韵母来切分一个音节，例如
            yan 分析为零声母 + ian；
          </li>
          <li>
            「双拼声母」和「双拼韵母」是按照自然码等双拼方案中的习惯来切分一个音节，例如
            yan 分析为 y + an；
          </li>
          <li>「首字母」和「末字母」是二笔和形音码等方案中采取的元素类型；</li>
          <li>您可利用拼写运算创造新的字音元素类型。</li>
        </ul>
        <PronElementPicker />
      </EditorColumn>
      <EditorColumn span={16}>
        <Typography.Title level={3}>键盘映射</Typography.Title>
        <Mapping />
      </EditorColumn>
    </EditorRow>
  );
}
