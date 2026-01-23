import { Button, Flex, Select } from "antd";
import { useAtom } from "jotai";
import { 变换器列表原子 } from "~/atoms";
import { 变换器, 结构变量, 结构表示符列表, 节点 } from "~/lib";
import { MinusButton, PlusButton } from "./Utils";
import CharacterSelect from "./CharacterSelect";
import {
  ModalForm,
  ProFormItem,
  ProFormList,
} from "@ant-design/pro-components";

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
    </ModalForm>
  );
};

export default TransformersForm;
