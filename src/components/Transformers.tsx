import { Button, Flex, Select } from "antd";
import { useAtom } from "jotai";
import { transformersAtom } from "~/atoms";
import { isVariable, 变换器, 模式, 节点类型 } from "~/lib/transformer";
import { DeleteButton, MinusButton, PlusButton } from "./Utils";
import CharacterSelect from "./CharacterSelect";
import { operators } from "~/lib";
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

const PatternEditor: React.FC<{
  value: 节点类型;
  onChange: (newValue: 节点类型) => void;
}> = ({ value, onChange }) => {
  const selectValue = isVariable(value) ? `变量 ${value.id}` : value;
  return typeof value === "string" || isVariable(value) ? (
    <Flex vertical align="center">
      <CharacterSelect
        style={{ width: 80 }}
        value={selectValue}
        onChange={(v: string) =>
          /^变量 \d+$/.test(v)
            ? onChange({ id: parseInt(v.split(" ")[1]!, 10) })
            : onChange(v as 节点类型)
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
          options={operators.map((op) => ({ label: op, value: op }))}
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
  const [transformers, setTransformers] = useAtom(transformersAtom);

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
        <ProFormItem label="从" name="from">
          {/* @ts-ignore */}
          <PatternEditor />
        </ProFormItem>
        <ProFormItem label="到" name="to">
          {/* @ts-ignore */}
          <PatternEditor />
        </ProFormItem>
      </ProFormList>
    </ModalForm>
  );
};

export default TransformersForm;
