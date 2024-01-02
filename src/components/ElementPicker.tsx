import { Button, Flex, Tabs } from "antd";
import { useState } from "react";
import ElementAdder from "./ElementAdder";
import ElementPool from "./ElementPool";
import styled from "styled-components";
import {
  algebraAtom,
  customClassifierAtom,
  customRepertoireAtom,
  sortedCustomFormAtom,
  useAtomValue,
  useRemoveAtom,
} from "~/atoms";
import Algebra from "./Algebra";
import {
  PronunciationElementTypes,
  applyRules,
  defaultAlgebra,
} from "~/lib/element";
import { operators } from "~/lib/data";

interface ElementPickerProps<T extends string> {
  content: Map<T, string[]>;
  editable?: boolean;
}

const Wrapper = styled(Tabs)`
  & .ant-tabs-nav-wrap {
    transform: none !important;
  }
`;

const AlgebraEditor = function ({
  type,
  defaultType,
  setType,
}: {
  type: PronunciationElementTypes;
  defaultType: PronunciationElementTypes;
  setType: (s: PronunciationElementTypes) => void;
}) {
  const algebra = useAtomValue(algebraAtom);
  const removeAlgebra = useRemoveAtom(algebraAtom);
  return (
    <Flex justify="center" gap="middle">
      <Algebra title="新建元素类型" />
      <Algebra
        title="修改元素类型"
        disabled={algebra[type] === undefined}
        initialValues={{ name: type, rules: algebra[type]! }}
      />
      <Button
        disabled={algebra[type] === undefined}
        onClick={() => {
          setType(defaultType);
          removeAlgebra(type);
        }}
      >
        删除元素类型
      </Button>
    </Flex>
  );
};

const formElementTypes = ["字根", "笔画", "二笔", "结构"] as const;
type FormElementTypes = (typeof formElementTypes)[number];

export const FormElementPicker = function () {
  const customizedClassifier = useAtomValue(customClassifierAtom);
  const sortedForm = useAtomValue(sortedCustomFormAtom);
  const allStrokes = Array.from(new Set(Object.values(customizedClassifier)))
    .sort()
    .map(String);
  const allErbi = allStrokes
    .map((x) => ["0"].concat(allStrokes).map((y) => x + y))
    .flat();
  const allGlyph = sortedForm.map(([x]) => x);
  const content: Map<FormElementTypes, string[]> = new Map([
    ["字根", allGlyph],
    ["笔画", allStrokes],
    ["二笔", allErbi],
    ["结构", [...operators]],
  ]);
  const [element, setElement] = useState<string | undefined>(undefined);
  const [type, setType] = useState<FormElementTypes>("字根");
  return (
    <Flex vertical gap="small">
      <Wrapper
        activeKey={type}
        items={[...content].map(([name, elements]) => {
          return {
            label: name,
            key: name,
            children: (
              <ElementPool
                element={element}
                setElement={setElement}
                content={elements}
                strokeFilter={name === "字根"}
              />
            ),
          };
        })}
        onChange={(e) => {
          setType(e as FormElementTypes);
        }}
      />
      <ElementAdder element={element} />
    </Flex>
  );
};

export const PronElementPicker = function () {
  const characters = useAtomValue(customRepertoireAtom);
  const algebra = useAtomValue(algebraAtom);
  const [element, setElement] = useState<string | undefined>(undefined);
  const [type, setType] = useState<PronunciationElementTypes>("声母");
  const syllables = [
    ...new Set(
      Object.values(characters)
        .map((x) => x.pinyin)
        .flat(),
    ),
  ];
  const mergedAlgebras = [
    ...Object.entries(defaultAlgebra),
    ...Object.entries(algebra),
  ];
  const content: Map<PronunciationElementTypes, string[]> = new Map(
    mergedAlgebras.map(([name, rules]) => {
      const list = [
        ...new Set(syllables.map((s) => applyRules(name, rules, s))),
      ].sort();
      return [name as PronunciationElementTypes, list];
    }),
  );
  return (
    <Flex vertical gap="small">
      <AlgebraEditor type={type} defaultType="声母" setType={setType} />
      <Wrapper
        activeKey={type}
        items={[...content].map(([name, elements]) => {
          return {
            label: name,
            key: name,
            children: (
              <ElementPool
                element={element}
                setElement={setElement}
                content={elements}
              />
            ),
          };
        })}
        onChange={(e) => {
          setType(e as PronunciationElementTypes);
        }}
      />
      <ElementAdder element={element} />
    </Flex>
  );
};
