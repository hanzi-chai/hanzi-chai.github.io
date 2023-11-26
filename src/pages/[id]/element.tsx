import Mapping from "~/components/Mapping";
import { Layout, Menu, Typography } from "antd";
import { useState } from "react";
import {
  useClassifier,
  useDisplay,
  useForm,
  useRepertoire,
} from "~/components/contants";
import { Outlet, useNavigate } from "react-router-dom";
import { EditorColumn, EditorRow } from "~/components/Utils";
import ElementPicker from "~/components/ElementPicker";
import type { AName } from "~/lib/element";
import { analyzerNames, pinyinAnalyzers } from "~/lib/element";
import { getSequence } from "~/lib/form";
import StrokeSearch from "~/components/StrokeSearch";
import { useConfigType } from "~/components/context";
import { useChaifenTitle } from "~/lib/hooks";

const Elements = () => {
  const navigate = useNavigate();
  const index = useConfigType();
  return (
    <Layout style={{ flex: 1, display: "flex" }}>
      <Layout.Sider theme="light">
        <Menu
          items={[
            { key: "form", label: "字形" },
            { key: "pronunciation", label: "字音" },
          ]}
          selectedKeys={[index.toString()]}
          onClick={(e) => {
            navigate(e.key);
          }}
        />
      </Layout.Sider>
      <div style={{ padding: "0 32px", height: "100%", flexGrow: 1 }}>
        <Outlet />
      </div>
    </Layout>
  );
};

const formElementTypes = ["字根", "笔画", "二笔"] as const;
type FormElementTypes = (typeof formElementTypes)[number];

export const RootElementConfig = () => {
  useChaifenTitle("字形元素");
  const [sequence, setSequence] = useState("");
  const classifier = useClassifier();
  const allStrokes = Array.from(new Set(Object.values(classifier)))
    .sort()
    .map(String);
  const allErbi = allStrokes.map((x) => allStrokes.map((y) => x + y)).flat();
  const display = useDisplay();

  const form = useForm();
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

  const contentMap = {
    字根: content,
    笔画: allStrokes,
    二笔: allErbi,
  } as Record<FormElementTypes, string[]>;
  return (
    <EditorRow>
      <EditorColumn span={8}>
        <Typography.Title level={2}>来源</Typography.Title>
        <StrokeSearch sequence={sequence} setSequence={setSequence} />
        <ElementPicker<FormElementTypes>
          types={formElementTypes}
          defaultType="字根"
          contentMap={contentMap}
          specialRendering={(x) => display(x)}
        />
      </EditorColumn>
      <EditorColumn span={16}>
        <Typography.Title level={2}>键盘映射</Typography.Title>
        <Mapping />
      </EditorColumn>
    </EditorRow>
  );
};

export const PhoneticElementConfig = () => {
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
};

export default Elements;
