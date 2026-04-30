import QuestionCircleOutlined from "@ant-design/icons/QuestionCircleOutlined";
import { Button, Cascader, Flex, Popover, Typography } from "antd";
import { useState } from "react";
import {
  useAtom,
  useAtomValue,
  useAtomValueUnwrapped,
  useRemoveAtom,
  分类器原子,
  如排序字库数据原子,
  如笔顺映射原子,
  当前元素原子,
  拼写运算自定义原子,
  拼音元素枚举映射原子,
  自定义分析数据库,
} from "~/atoms";
import { 字符, 结构描述字符列表 } from "hanzi-chai";
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
  <ul className="w-[400px]">
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

const useAllElements = () => {
  const 分类器 = useAtomValue(分类器原子);
  const 拼音元素枚举映射 = useAtomValue(拼音元素枚举映射原子);
  const customElements = useAtomValue(自定义分析数据库.entries);
  const 字符列表 = useAtomValueUnwrapped(如排序字库数据原子);
  const 笔顺映射 = useAtomValueUnwrapped(如笔顺映射原子);
  const 排序汉字 = 字符列表
    .filter((k) => 笔顺映射.get(k)?.length !== 1)
    .filter((k) => k.区块() !== "kangxi");
  const 全部笔画列表 = Array.from(new Set(Object.values(分类器)))
    .sort()
    .map(String);
  const 全部二笔列表 = 全部笔画列表.flatMap((x) =>
    ["0"].concat(全部笔画列表).map((y) => x + y),
  );
  const 自定义元素映射: Map<string, string[]> = new Map();
  for (const [key, value] of customElements) {
    const s = new Set(Object.values(value).flat());
    自定义元素映射.set(key, Array.from(s).sort());
  }
  return {
    字根: 排序汉字,
    二笔: 全部二笔列表,
    笔画: 全部笔画列表,
    结构: [...结构描述字符列表],
    字音: 拼音元素枚举映射,
    自定义: 自定义元素映射,
  };
};

type ElementTypes = "字形" | "字音" | "自定义";

export default function ElementPicker() {
  const [element, setElement] = useAtom(当前元素原子);
  const [types, setTypes] = useState<[ElementTypes, string]>(["字形", "字根"]);
  const elements = useAllElements();
  const { 字根, 二笔, 笔画, 结构, 字音, 自定义 } = elements;
  const [primary, secondary] = types;
  let 当前元素列表: string[] | 字符[];
  if (primary === "字形") {
    if (secondary === "字根") 当前元素列表 = 字根;
    else if (secondary === "二笔") 当前元素列表 = 二笔;
    else if (secondary === "笔画") 当前元素列表 = 笔画;
    else if (secondary === "结构") 当前元素列表 = 结构;
    else 当前元素列表 = [];
  } else if (primary === "字音") {
    当前元素列表 = 字音.get(secondary) ?? [];
  } else {
    当前元素列表 = 自定义.get(secondary) ?? [];
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
    <Flex vertical gap="small" className="flex-none w-[400px]">
      <Typography.Title level={3}>元素选择器</Typography.Title>
      <Flex gap="middle" align="baseline">
        <span>元素类型：</span>
        <Cascader
          value={types}
          onChange={(x) => setTypes(x as [ElementTypes, string])}
          options={options}
        />
        <Popover content={pronunciationElementsDescription}>
          <QuestionCircleOutlined />
        </Popover>
      </Flex>
      {primary === "字音" && (
        <AlgebraEditor
          type={secondary}
          defaultType="声母"
          setType={(s) => setTypes(["字音", s])}
        />
      )}
      <ElementPool
        element={element}
        setElement={setElement}
        content={当前元素列表}
        name={secondary}
      />
      <ElementAdder
        element={element instanceof 字符 ? element.toString() : undefined}
      />
      <ElementCounter />
    </Flex>
  );
}
