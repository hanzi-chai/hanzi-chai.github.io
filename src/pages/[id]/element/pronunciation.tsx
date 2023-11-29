import Mapping from "~/components/Mapping";
import { Typography } from "antd";
import { useRepertoire } from "~/components/contants";
import { EditorColumn, EditorRow } from "~/components/Utils";
import ElementPicker from "~/components/ElementPicker";
import type { AName } from "~/lib/element";
import { analyzerNames, pinyinAnalyzers } from "~/lib/element";
import { useChaifenTitle } from "~/lib/hooks";

export default function PhoneticElementConfig() {
  useChaifenTitle("字音元素");
  const characters = useRepertoire();
  const syllables = [
    ...new Set(
      Object.values(characters)
        .map((x) => x.pinyin)
        .flat(),
    ),
  ];
  const contentMap = Object.fromEntries(
    Object.entries(pinyinAnalyzers).map(([p, fn]) => {
      return [p, [...new Set(syllables.map(fn))].sort()];
    }),
  ) as Record<AName, string[]>;
  return (
    <EditorRow>
      <EditorColumn span={8}>
        <Typography.Title level={2}>来源</Typography.Title>
        <ElementPicker<AName>
          types={analyzerNames}
          defaultType="声"
          contentMap={contentMap}
        />
      </EditorColumn>
      <EditorColumn span={16}>
        <Typography.Title level={2}>键盘映射</Typography.Title>
        <Mapping />
      </EditorColumn>
    </EditorRow>
  );
}
