import Mapping from "~/components/Mapping";
import { Typography } from "antd";
import { useState } from "react";
import { useClassifier, useDisplay, useForm, useRepertoire } from "~/atoms";
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
  pinyinAnalyzers,
  pronunciationElementTypes,
} from "~/lib/element";

const formElementTypes = ["字根", "笔画", "二笔", "结构"] as const;
type FormElementTypes = (typeof formElementTypes)[number];

export default function RootElementConfig() {
  useChaifenTitle("元素");
  const [sequence, setSequence] = useState("");
  const customizedClassifier = useClassifier();
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
  const pronContentMap: Map<PronunciationElementTypes, string[]> = new Map(
    Object.entries(pinyinAnalyzers).map(([name, rules]) => {
      const list = [
        ...new Set(syllables.map((s) => applyRules(rules, s))),
      ].sort();
      return [
        name as PronunciationElementTypes,
        list.map((x) => name + "-" + x),
      ];
    }),
  );
  return (
    <EditorRow>
      <EditorColumn span={8}>
        <Typography.Title level={3}>字形元素</Typography.Title>
        <StrokeSearch sequence={sequence} setSequence={setSequence} />
        <ElementPicker<FormElementTypes> content={formContentMap} />
        <Typography.Title level={3}>字音元素</Typography.Title>
        <ElementPicker<PronunciationElementTypes> content={pronContentMap} />
      </EditorColumn>
      <EditorColumn span={16}>
        <Typography.Title level={3}>键盘映射</Typography.Title>
        <Mapping />
      </EditorColumn>
    </EditorRow>
  );
}
