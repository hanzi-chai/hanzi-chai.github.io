import QuestionCircleOutlined from "@ant-design/icons/QuestionCircleOutlined";
import { Button, Cascader, Flex, Popover, Typography } from "antd";
import type { 元素 } from "hanzi-chai";
import { useState } from "react";
import {
  useAtomValue,
  useAtomValueUnwrapped,
  useRemoveAtom,
  全部合法元素原子,
  拼写运算自定义原子,
} from "~/atoms";
import Algebra from "./Algebra";
import ElementAdder from "./ElementAdder";
import ElementCounter from "./ElementCounter";
import ElementPool from "./ElementPool";

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
  <ul className="w-100">
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

type ElementTypes = "字形" | "字音" | "自定义";

export default function ElementPicker() {
  const [类型列表, 设置类型列表] = useState<[ElementTypes, string]>([
    "字形",
    "字根",
  ]);
  const elements = useAtomValueUnwrapped(全部合法元素原子);
  const {
    字符列表: 字根,
    二笔列表: 二笔,
    笔画列表: 笔画,
    结构符元素列表: 结构,
    拼音元素映射: 字音,
    自定义元素映射: 自定义,
  } = elements;
  const [一级类型, 二级类型] = 类型列表;
  let 当前元素列表: 元素[];
  if (一级类型 === "字形") {
    if (二级类型 === "字根") 当前元素列表 = 字根;
    else if (二级类型 === "二笔") 当前元素列表 = 二笔;
    else if (二级类型 === "笔画") 当前元素列表 = 笔画;
    else if (二级类型 === "结构") 当前元素列表 = 结构;
    else 当前元素列表 = [];
  } else if (一级类型 === "字音") {
    当前元素列表 = 字音.get(二级类型) ?? [];
  } else {
    当前元素列表 = 自定义.get(二级类型) ?? [];
  }
  const options: Option[] = [
    {
      value: "字形",
      label: "字形",
      children: ["字根", "二笔", "笔画", "结构"].map((v) => ({
        value: v,
        label: v,
      })),
    },
    {
      value: "字音",
      label: "字音",
      children: [...字音.keys()].map((v) => ({
        value: v,
        label: v,
      })),
    },
    {
      value: "自定义",
      label: "自定义",
      children: [...自定义.keys()].map((v) => ({
        value: v,
        label: v,
      })),
      disabled: 自定义.size === 0,
    },
  ];
  return (
    <Flex vertical gap="small" className="flex-none w-100">
      <Typography.Title level={3}>元素选择器</Typography.Title>
      <Flex gap="middle" align="baseline">
        <span>元素类型：</span>
        <Cascader
          value={类型列表}
          onChange={(x) => 设置类型列表(x as [ElementTypes, string])}
          options={options}
        />
        <Popover content={pronunciationElementsDescription}>
          <QuestionCircleOutlined />
        </Popover>
      </Flex>
      {一级类型 === "字音" && (
        <AlgebraEditor
          type={二级类型}
          defaultType="声母"
          setType={(s) => 设置类型列表(["字音", s])}
        />
      )}
      <ElementPool content={当前元素列表} type={二级类型} />
      <ElementAdder />
      <ElementCounter />
    </Flex>
  );
}
