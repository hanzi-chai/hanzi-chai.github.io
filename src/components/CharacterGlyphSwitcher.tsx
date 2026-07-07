import { Radio } from "antd";
import { useAtom } from "jotai";
import { repertoireTypeAtom } from "~/atoms";

export default function CharacterGlyphSwitcher() {
  const [repertoireType, setRepertoireType] = useAtom(repertoireTypeAtom);
  return (
    <Radio.Group onChange={(e) => setRepertoireType(e.target.value)} value={repertoireType}>
      <Radio.Button value="character">字符表</Radio.Button>
      <Radio.Button value="glyph">字形表</Radio.Button>
    </Radio.Group>
  );
}
