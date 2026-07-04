import {
  ModalForm,
  type ProFormInstance,
  ProFormItem,
  ProFormList,
} from "@ant-design/pro-components";
import { Button, Dropdown, Flex } from "antd";
import type {
  IDVariable,
  OperatorVariable,
  原始字库,
  字形拼写运算,
  模式,
} from "hanzi-chai";
import { useAtom, useAtomValue } from "jotai";
import { type ReactNode, useRef } from "react";
import { 原始字库原子, 字形拼写运算列表原子 } from "~/atoms";
import GlyphSelect from "./GlyphSelect";
import OperatorSelect from "./OperatorSelect";
import { MinusButton, PlusButton } from "./Utils";

function serialize(模式: 模式, 原始字库: 原始字库): ReactNode {
  if (typeof 模式 === "number") return <span>{模式}</span>;
  if ("variable" in 模式)
    return "①②③④⑤⑥⑦⑧⑨⑩"[模式.variable - 1] || `{${模式.variable}}`;
  return (
    <>
      {模式.operator}
      {模式.references.map((operand) => serialize(operand, 原始字库))}
    </>
  );
}

const 示例列表: 字形拼写运算[] = [
  // {
  //   type: "xform",
  //   from: {
  //     operator: "⿱",
  //     references: ["艹", { operator: "⿰", references: ["氵", { id: 1 }] }],
  //   },
  //   to: { operator: "⿸", references: ["\uE820", { id: 1 }] },
  // },
  // {
  //   from: {
  //     operator: "⿰",
  //     references: ["月", { operator: "⿱", references: ["龹", { id: 1 }] }],
  //   },
  //   to: { operator: "⿸", references: ["\uEBE1", { id: 1 }] },
  // },
  // {
  //   from: {
  //     operator: "⿰",
  //     references: ["方", { operator: "⿱", references: ["\uE078", { id: 1 }] }],
  //   },
  //   to: { operator: "⿸", references: ["\uE823", { id: 1 }] },
  // },
  // {
  //   from: {
  //     operator: "⿰",
  //     references: [{ operator: "⿱", references: ["匕", { id: 1 }] }, "页"],
  //   },
  //   to: { operator: "⿹", references: ["\uE874", { id: 1 }] },
  // },
  // {
  //   from: {
  //     operator: "⿰",
  //     references: [{ operator: "⿱", references: ["\uE032", { id: 1 }] }, "殳"],
  //   },
  //   to: { operator: "⿹", references: ["\uE873", { id: 1 }] },
  // }, // 字框无一
  // {
  //   from: {
  //     operator: "⿰",
  //     references: [{ operator: "⿱", references: ["\uE04B", { id: 1 }] }, "殳"],
  //   },
  //   to: { operator: "⿹", references: ["\uE872", { id: 1 }] },
  // }, // 字框
  // {
  //   from: {
  //     operator: "⿱",
  //     references: [
  //       "吂",
  //       { operator: "⿲", references: ["月", { id: 1 }, "凡"] },
  //     ],
  //   },
  //   to: { operator: "⿵", references: ["\uE834", { id: 1 }] },
  // },
  // {
  //   from: {
  //     operator: "⿲",
  //     references: [
  //       "彳",
  //       { operator: "⿳", references: ["山", "一", { id: 1 }] },
  //       "攵",
  //     ],
  //   },
  //   to: { operator: "⿵", references: ["\uE824", { id: 1 }] },
  // }, // 微字框
  // {
  //   from: {
  //     operator: "⿲",
  //     references: [
  //       "彳",
  //       { operator: "⿱", references: ["山", { id: 1 }] },
  //       "攵",
  //     ],
  //   },
  //   to: { operator: "⿵", references: ["\uEBC2", { id: 1 }] },
  // }, // 微字框无一
  // {
  //   from: { operator: "⿲", references: ["王", { id: 1 }, "王"] },
  //   to: { operator: "⿴", references: ["玨", { id: 1 }] },
  // },
  // {
  //   from: { operator: "⿲", references: ["弓", { id: 1 }, "弓"] },
  //   to: { operator: "⿴", references: ["弜", { id: 1 }] },
  // },
  // {
  //   from: { operator: "⿲", references: ["\uE0C9", { id: 1 }, "辛"] },
  //   to: { operator: "⿴", references: ["辡", { id: 1 }] },
  // },
  // {
  //   from: { operator: "⿲", references: ["彳", { id: 1 }, "亍"] },
  //   to: { operator: "⿴", references: ["行", { id: 1 }] },
  // },
  // {
  //   from: { operator: "⿳", references: ["亠", { id: 1 }, "\uE0B7"] },
  //   to: { operator: "⿴", references: ["\uE80A", { id: 1 }] },
  // },
];

const getDummyTransformer = (): 字形拼写运算 => {
  return {
    type: "xform",
    from: { operator: "⿰", references: [1, 1] },
    to: { operator: "⿱", references: [1, 1] },
  };
};

const isVariable = (node: 模式): node is IDVariable | OperatorVariable => {
  return typeof node === "object" && node !== null && "variable" in node;
};

const PatternEditor: React.FC<{
  value: 模式;
  onChange: (newValue: 模式) => void;
}> = ({ value, onChange }) => {
  if (typeof value === "number" || isVariable(value)) {
    return (
      <Flex vertical align="center">
        <GlyphSelect
          className="w-22"
          value={value}
          onChange={onChange}
          includeVariables
        />
        <PlusButton onClick={() => onChange(getDummyTransformer().from)} />
      </Flex>
    );
  } else
    return (
      <Flex wrap="wrap">
        <Flex vertical align="center">
          <OperatorSelect
            includeVariables
            value={value.operator}
            onChange={(newOp) => onChange({ ...value, operator: newOp })}
          />
          <MinusButton onClick={() => onChange(1)} />
        </Flex>
        <Flex align="center">
          {value.references.map((operand, index) => (
            <PatternEditor
              key={index}
              value={operand}
              onChange={(newOperand) => {
                const newList = [...value.references];
                newList[index] = newOperand;
                onChange({ ...value, references: newList });
              }}
            />
          ))}
        </Flex>
      </Flex>
    );
};

export default function GlyphAlgebraForm() {
  const [algebra, setAlgebra] = useAtom(字形拼写运算列表原子);
  const formRef = useRef<ProFormInstance>(undefined);
  const 原始字库 = useAtomValue(原始字库原子);

  return (
    <ModalForm
      title="变换器设置"
      layout="horizontal"
      width={600}
      trigger={<Button>编辑变换器</Button>}
      initialValues={{ content: algebra }}
      onFinish={async (v) => {
        setAlgebra(v.content as 字形拼写运算[]);
        return true;
      }}
      formRef={formRef}
    >
      <ProFormList
        name="content"
        creatorRecord={getDummyTransformer}
        alwaysShowItemLabel
      >
        <ProFormItem label="查找" name="from" className="mb-0!">
          {/* @ts-ignore */}
          <PatternEditor />
        </ProFormItem>
        <ProFormItem label="替换为" name="to">
          {/* @ts-ignore */}
          <PatternEditor />
        </ProFormItem>
      </ProFormList>
      <Flex justify="center">
        <Dropdown
          menu={{
            items: 示例列表.map((示例, index) => ({
              key: index,
              label: (
                <span className="flex flex-nowrap leading-none">
                  {示例.type}:{serialize(示例.from, 原始字库)} →{" "}
                  {"to" in 示例 ? serialize(示例.to, 原始字库) : ""}
                </span>
              ),
            })),
            onClick: ({ key }) => {
              const 示例 = 示例列表[Number(key)];
              formRef.current?.setFieldsValue({
                content: [...algebra, 示例],
              });
            },
          }}
        >
          <Button type="primary">插入示例变换器</Button>
        </Dropdown>
      </Flex>
    </ModalForm>
  );
}
