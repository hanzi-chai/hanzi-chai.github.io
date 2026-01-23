import { Button, Cascader, Flex, Popover, Typography } from "antd";
import { useState } from "react";
import ElementAdder from "./ElementAdder";
import ElementPool from "./ElementPool";
import {
  拼写运算自定义原子,
  分类器原子,
  processedCustomElementsAtom,
  如排序汉字原子,
  useAtom,
  useAtomValue,
  useRemoveAtom,
} from "~/atoms";
import Algebra from "./Algebra";
import { 拼音元素枚举原子, 当前元素原子 } from "~/atoms";
import QuestionCircleOutlined from "@ant-design/icons/QuestionCircleOutlined";
import ElementCounter from "./ElementCounter";
import { 结构表示符列表 } from "~/lib";

const AlgebraEditor = ({
  type,
  defaultType,
  setType,
}: {
  type: string;
  defaultType: string;
  setType: (s: string) => void;
}) => {
  const algebra = useAtomValue(拼写运算自定义原子);
  const removeAlgebra = useRemoveAtom(拼写运算自定义原子);
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

const shapeElementTypes = ["字根", "笔画", "二笔", "结构"] as const;
export type ShapeElementTypes = (typeof shapeElementTypes)[number];

interface Option {
  value: string | number;
  label: string;
  children?: Option[];
  disabled?: boolean;
}

const pronunciationElementsDescription = (
  <ul style={{ width: 400 }}>
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
);

type PrimaryTypes = "shape" | "pronunciation" | "custom";

const useAllElements = () => {
  const customizedClassifier = useAtomValue(分类器原子);
  const pronunciationElements = useAtomValue(拼音元素枚举原子);
  const customElements = useAtomValue(processedCustomElementsAtom);
  const sortedCharacters = useAtomValue(如排序汉字原子);
  const 排序汉字 = sortedCharacters.ok ? sortedCharacters.value : [];
  const allStrokes = Array.from(new Set(Object.values(customizedClassifier)))
    .sort()
    .map(String);
  const allErbi = allStrokes.flatMap((x) =>
    ["0"].concat(allStrokes).map((y) => x + y),
  );
  const shapeElements: Map<ShapeElementTypes, string[]> = new Map([
    ["字根", 排序汉字],
    ["笔画", allStrokes],
    ["二笔", allErbi],
    ["结构", [...结构表示符列表]],
  ]);
  const elements: Record<PrimaryTypes, Map<string, string[]>> = {
    shape: shapeElements,
    pronunciation: pronunciationElements,
    custom: customElements,
  };
  return elements;
};

export default function ElementPicker() {
  const [element, setElement] = useAtom(当前元素原子);
  const [types, setTypes] = useState<[string, string]>(["shape", "字根"]);
  const elements = useAllElements();
  const { shape, pronunciation, custom } = elements;
  const [primary, secondary] = types;
  const currentElements = elements[primary as PrimaryTypes].get(secondary)!;
  const options: Option[] = [
    {
      value: "shape",
      label: "字形",
      children: [...shape.keys()].map((v) => ({
        value: v,
        label: v,
      })),
    },
    {
      value: "pronunciation",
      label: "字音",
      children: [...pronunciation.keys()].map((v) => ({
        value: v,
        label: v,
      })),
    },
    {
      value: "custom",
      label: "自定义",
      children: [...custom.keys()].map((v) => ({
        value: v,
        label: v,
      })),
      disabled: custom.size === 0,
    },
  ];
  return (
    <Flex vertical gap="small" style={{ flex: "0 0 400px" }}>
      <Typography.Title level={3}>元素选择器</Typography.Title>
      <Flex gap="middle" align="baseline">
        <span>元素类型：</span>
        <Cascader
          value={types}
          onChange={(x) => setTypes(x as [string, string])}
          options={options}
        />
        <Popover content={pronunciationElementsDescription}>
          <QuestionCircleOutlined />
        </Popover>
      </Flex>
      {primary === "pronunciation" && (
        <AlgebraEditor
          type={secondary}
          defaultType="声母"
          setType={(s) => setTypes(["pronunciation", s])}
        />
      )}
      <ElementPool
        element={element}
        setElement={setElement}
        content={currentElements}
        name={secondary}
      />
      <ElementAdder element={element} />
      <ElementCounter />
    </Flex>
  );
}
