import Mapping from "~/components/Mapping";
import { Button, Flex, Typography } from "antd";
import { useState } from "react";
import {
  algebraAtom,
  useAtomValue,
  useClassifier,
  useDisplay,
  useForm,
  useRepertoire,
} from "~/atoms";
import { EditorColumn, EditorRow } from "~/components/Utils";
import ElementPicker from "~/components/ElementPicker";
import { getSequence } from "~/lib/component";
import StrokeSearch from "~/components/StrokeSearch";
import { useChaifenTitle } from "~/lib/hooks";
import classifier from "~/lib/classifier";
import { operators } from "~/lib/data";
import {
  PronunciationElementTypes,
  applyRules,
  defaultAlgebra,
  pronunciationElementTypes,
} from "~/lib/element";

const formElementTypes = ["字根", "笔画", "二笔", "结构"] as const;
type FormElementTypes = (typeof formElementTypes)[number];

export default function RootElementConfig() {
  useChaifenTitle("元素");
  const [sequence, setSequence] = useState("");
  const customizedClassifier = useClassifier();
  const algebra = useAtomValue(algebraAtom);
  const allStrokes = Array.from(new Set(Object.values(customizedClassifier)))
    .sort()
    .map(String);
  const allErbi = allStrokes
    .map((x) => ["0"].concat(allStrokes).map((y) => x + y))
    .flat();
  const display = useDisplay();
  const form = useForm();
  const characters = useRepertoire();
  const syllables = [
    ...new Set(
      Object.values(characters)
        .map((x) => x.pinyin)
        .flat(),
    ),
  ];
  const content = Object.keys(form)
    .filter((x) => {
      const thisSequence = getSequence(form, classifier, x);
      return thisSequence.length > 1 && thisSequence.startsWith(sequence);
    })
    .sort(
      (x, y) =>
        getSequence(form, classifier, x).length -
        getSequence(form, classifier, y).length,
    );
  const formContentMap: Map<FormElementTypes, string[]> = new Map([
    ["字根", content],
    ["笔画", allStrokes],
    ["二笔", allErbi],
    ["结构", [...operators]],
  ]);
  const mergedAlgebras = [
    ...Object.entries(defaultAlgebra),
    ...Object.entries(algebra),
  ];
  const pronContentMap: Map<PronunciationElementTypes, string[]> = new Map(
    mergedAlgebras.map(([name, rules]) => {
      const list = [
        ...new Set(syllables.map((s) => applyRules(name, rules, s))),
      ].sort();
      return [name as PronunciationElementTypes, list];
    }),
  );
  return (
    <EditorRow>
      <EditorColumn span={8}>
        <Typography.Title level={3}>字形元素</Typography.Title>
        <StrokeSearch sequence={sequence} setSequence={setSequence} />
        <ElementPicker<FormElementTypes> content={formContentMap} />
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
        <ElementPicker<PronunciationElementTypes>
          content={pronContentMap}
          editable
        />
      </EditorColumn>
      <EditorColumn span={16}>
        <Typography.Title level={3}>键盘映射</Typography.Title>
        <Mapping />
      </EditorColumn>
    </EditorRow>
  );
}
