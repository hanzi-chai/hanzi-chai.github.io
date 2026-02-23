import { Button, Dropdown, Flex, Select } from "antd";
import { useAtom } from "jotai";
import { 变换器列表原子 } from "~/atoms";
import { type 变换器, type 结构变量, 结构表示符列表, type 节点 } from "~/lib";
import { Display, MinusButton, PlusButton } from "./Utils";
import CharacterSelect from "./CharacterSelect";
import {
  ModalForm,
  type ProFormInstance,
  ProFormItem,
  ProFormList,
} from "@ant-design/pro-components";
import { type ReactNode, useRef } from "react";

function serialize(模式: 节点): ReactNode {
  if (typeof 模式 === "string") return <Display name={模式} />;
  if ("id" in 模式) return "①②③④⑤⑥⑦⑧⑨⑩"[模式.id - 1] || `{${模式.id}}`;
  return (
    <span>
      {模式.operator}
      {模式.operandList.map(serialize)}
    </span>
  );
}

const 示例列表: 变换器[] = [
  {
    from: {
      operator: "⿱",
      operandList: ["艹", { operator: "⿰", operandList: ["氵", { id: 1 }] }],
    },
    to: { operator: "⿸", operandList: ["\uE820", { id: 1 }] },
  },
  {
    from: {
      operator: "⿰",
      operandList: ["月", { operator: "⿱", operandList: ["龹", { id: 1 }] }],
    },
    to: { operator: "⿸", operandList: ["\uEBE1", { id: 1 }] },
  },
  {
    from: {
      operator: "⿰",
      operandList: [
        "方",
        { operator: "⿱", operandList: ["\uE078", { id: 1 }] },
      ],
    },
    to: { operator: "⿸", operandList: ["\uE823", { id: 1 }] },
  },
  {
    from: {
      operator: "⿰",
      operandList: [{ operator: "⿱", operandList: ["匕", { id: 1 }] }, "页"],
    },
    to: { operator: "⿹", operandList: ["\uE874", { id: 1 }] },
  },
  {
    from: {
      operator: "⿰",
      operandList: [
        { operator: "⿱", operandList: ["\uE032", { id: 1 }] },
        "殳",
      ],
    },
    to: { operator: "⿹", operandList: ["\uE873", { id: 1 }] },
  }, // 字框无一
  {
    from: {
      operator: "⿰",
      operandList: [
        { operator: "⿱", operandList: ["\uE04B", { id: 1 }] },
        "殳",
      ],
    },
    to: { operator: "⿹", operandList: ["\uE872", { id: 1 }] },
  }, // 字框
  {
    from: {
      operator: "⿱",
      operandList: [
        "吂",
        { operator: "⿲", operandList: ["月", { id: 1 }, "凡"] },
      ],
    },
    to: { operator: "⿵", operandList: ["\uE834", { id: 1 }] },
  },
  {
    from: {
      operator: "⿲",
      operandList: [
        "彳",
        { operator: "⿱", operandList: ["\uE990", { id: 1 }] },
        "攵",
      ],
    },
    to: { operator: "⿵", operandList: ["\uE824", { id: 1 }] },
  }, // 微字框
  {
    from: {
      operator: "⿲",
      operandList: [
        "彳",
        { operator: "⿱", operandList: ["山", { id: 1 }] },
        "攵",
      ],
    },
    to: { operator: "⿵", operandList: ["\uEBC2", { id: 1 }] },
  }, // 微字框无一
  {
    from: { operator: "⿲", operandList: ["王", { id: 1 }, "王"] },
    to: { operator: "⿴", operandList: ["玨", { id: 1 }] },
  },
  {
    from: { operator: "⿲", operandList: ["弓", { id: 1 }, "弓"] },
    to: { operator: "⿴", operandList: ["弜", { id: 1 }] },
  },
  {
    from: { operator: "⿲", operandList: ["\uE0C9", { id: 1 }, "辛"] },
    to: { operator: "⿴", operandList: ["辡", { id: 1 }] },
  },
  {
    from: { operator: "⿲", operandList: ["彳", { id: 1 }, "亍"] },
    to: { operator: "⿴", operandList: ["行", { id: 1 }] },
  },
  {
    from: { operator: "⿳", operandList: ["亠", { id: 1 }, "\uE0B7"] },
    to: { operator: "⿴", operandList: ["\uE80A", { id: 1 }] },
  },
];

const getDummyTransformer = (): 变换器 => {
  return {
    from: { operator: "⿰", operandList: ["一", "一"] },
    to: { operator: "⿱", operandList: ["一", "一"] },
  };
};

const isVariable = (node: 节点): node is 结构变量 => {
  return typeof node === "object" && node !== null && "id" in node;
};

const PatternEditor: React.FC<{
  value: 节点;
  onChange: (newValue: 节点) => void;
}> = ({ value, onChange }) => {
  const selectValue = isVariable(value) ? JSON.stringify(value) : value;
  return typeof value === "string" || isVariable(value) ? (
    <Flex vertical align="center">
      <CharacterSelect
        style={{ width: 88 }}
        value={selectValue}
        onChange={(v: string) =>
          onChange(v.startsWith("{") ? (JSON.parse(v) as 结构变量) : v)
        }
        includeVariables
      />
      <PlusButton onClick={() => onChange(getDummyTransformer().from)} />
    </Flex>
  ) : (
    <Flex wrap="wrap">
      <Flex vertical align="center">
        <Select
          style={{ width: 64 }}
          options={结构表示符列表.map((op) => ({ label: op, value: op }))}
          value={value.operator}
          onChange={(newOp) =>
            onChange({
              ...value,
              operator: newOp as typeof value.operator,
              operandList: value.operandList
                .concat(["一"])
                .slice(
                  0,
                  newOp === "⿲" || newOp === "⿳"
                    ? 3
                    : newOp === "⿾" || newOp === "⿿"
                      ? 1
                      : 2,
                ),
            })
          }
        />
        <MinusButton onClick={() => onChange("一")} />
      </Flex>
      <Flex align="center">
        {value.operandList.map((operand, index) => (
          <PatternEditor
            key={index}
            value={operand}
            onChange={(newOperand) => {
              const newList = [...value.operandList];
              newList[index] = newOperand;
              onChange({ ...value, operandList: newList });
            }}
          />
        ))}
      </Flex>
    </Flex>
  );
};

const TransformersForm = () => {
  const [transformers, setTransformers] = useAtom(变换器列表原子);
  const formRef = useRef<ProFormInstance>(undefined);

  return (
    <ModalForm
      title="变换器设置"
      layout="horizontal"
      width={600}
      trigger={<Button>编辑变换器</Button>}
      initialValues={{ content: transformers }}
      onFinish={async (v) => {
        setTransformers(v.content as 变换器[]);
        return true;
      }}
      formRef={formRef}
    >
      <ProFormList
        name="content"
        creatorRecord={getDummyTransformer}
        alwaysShowItemLabel
      >
        <ProFormItem label="查找" name="from" style={{ marginBottom: 0 }}>
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
                // biome-ignore lint/a11y/noStaticElementInteractions: reason
                // biome-ignore lint/a11y/useKeyWithClickEvents: reason
                <span
                  onClick={() => {
                    const form = formRef.current;
                    if (!form) return;
                    const list: 变换器[] = form.getFieldValue("content") || [];
                    form.setFieldValue("content", [...list, 示例]);
                  }}
                >
                  {serialize(示例.from)} → {serialize(示例.to)}
                </span>
              ),
            })),
          }}
        >
          <Button type="primary">插入示例变换器</Button>
        </Dropdown>
      </Flex>
    </ModalForm>
  );
};

export default TransformersForm;
