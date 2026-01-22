import { Button, Flex, Popover, Select, Typography } from "antd";
import { sortBy } from "lodash-es";
import {
  字母表原子,
  currentElementAtom,
  决策原子,
  决策生成器配置原子,
  决策空间原子,
  变量规则映射原子,
  useAddAtom,
  useAtom,
  useAtomValue,
  useRemoveAtom,
  useSetAtom,
} from "~/atoms";
import ElementSelect from "~/components/ElementSelect";
import { ElementLabelWrapper } from "~/components/Mapping";
import { DeleteButton, Display, NumberInput } from "~/components/Utils";
import { MappingGeneratorRule, ValueDescription } from "~/lib";
import Element from "./Element";
import {
  ModalForm,
  ProFormGroup,
  ProFormItem,
  ProFormList,
  ProFormSelect,
  ProFormText,
} from "@ant-design/pro-components";
import CharacterSelect from "./CharacterSelect";
import { useState } from "react";
import ValueEditor from "./Value";

const ValueDescriptionEditor = ({
  value,
  onChange,
}: {
  value: ValueDescription;
  onChange: (newValue: ValueDescription | undefined) => void;
}) => {
  const currentCondition = value.condition ?? [];
  const updateCondition = (index: number, key: string, update: any) => {
    onChange({
      ...value,
      condition: currentCondition.map((c, i) =>
        i === index ? { ...c, [key]: update } : c,
      ),
    });
  };
  return (
    <Flex vertical gap="small">
      <Flex gap="small" align="center">
        <ValueEditor
          value={value.value}
          onChange={(newValue) => onChange({ ...value, value: newValue })}
        />
        打分
        <NumberInput
          value={value.score}
          width={96}
          onChange={(newValue) =>
            onChange({ ...value, score: newValue as number })
          }
        />
        <Button
          onClick={() =>
            onChange({
              ...value,
              condition: currentCondition.concat([
                { element: "1", op: "不是", value: null },
              ]),
            })
          }
        >
          添加条件
        </Button>
        <DeleteButton onClick={() => onChange(undefined)} />
      </Flex>
      {currentCondition.map((c, i) => (
        <Flex
          key={i}
          gap="small"
          align="center"
          style={{ paddingLeft: "32px" }}
        >
          当
          <ElementSelect
            value={c.element}
            onChange={(element) => updateCondition(i, "element", element)}
            style={{ width: 96 }}
            allowClear={false}
            includeOptional
          />
          <Select
            value={c.op}
            options={[
              { label: "是", value: "是" },
              { label: "不是", value: "不是" },
            ]}
            onChange={(op) => updateCondition(i, "op", op)}
          />
          <ValueEditor
            value={c.value}
            onChange={(value) => updateCondition(i, "value", value)}
          />
          <DeleteButton
            onClick={() =>
              onChange({
                ...value,
                condition: currentCondition.filter((_, index) => index !== i),
              })
            }
          />
        </Flex>
      ))}
    </Flex>
  );
};

export const RulesForm = ({ name }: { name: string }) => {
  const alphabet = useAtomValue(字母表原子);
  const mappingSpace = useAtomValue(决策空间原子);
  const addMappingSpace = useAddAtom(决策空间原子);
  const removeMappingSpace = useRemoveAtom(决策空间原子);
  const values = mappingSpace[name] ?? [];
  const creators = {
    禁用: () => ({ value: null, score: 0 }),
    键位: () => ({ value: alphabet[0]!, score: 0 }),
    归并: () => ({ value: { element: "1" }, score: 0 }),
  };
  return (
    <Flex vertical gap="middle">
      {values.map((value, index) => (
        <ValueDescriptionEditor
          key={index}
          value={value}
          onChange={(newValue) => {
            if (newValue === undefined) {
              if (values.length === 1) {
                removeMappingSpace(name);
              } else {
                addMappingSpace(
                  name,
                  values.filter((_, i) => i !== index),
                );
              }
            } else {
              addMappingSpace(
                name,
                values.map((v, i) => (i === index ? newValue : v)),
              );
            }
          }}
        />
      ))}
      <Flex justify="center" gap="middle">
        {Object.entries(creators).map(([creatorType, creator]) => (
          <Button
            key={creatorType}
            onClick={() => addMappingSpace(name, values.concat(creator()))}
          >
            添加{creatorType}
          </Button>
        ))}
      </Flex>
    </Flex>
  );
};

const MappingVariablesForm = () => {
  const alphabet = useAtomValue(字母表原子);
  const [mappingVariables, setMappingVariables] = useAtom(变量规则映射原子);
  const variables = Object.entries(mappingVariables).map(([name, rule]) => ({
    name,
    keys: rule.keys,
  }));
  return (
    <ModalForm
      title="变量配置"
      trigger={<Button>变量</Button>}
      layout="horizontal"
      initialValues={{ variables }}
      onFinish={async ({ variables }) => {
        setMappingVariables(
          Object.fromEntries(
            variables.map((v: any) => [v.name, { keys: v.keys }]),
          ),
        );
        return true;
      }}
    >
      <ProFormList name="variables" alwaysShowItemLabel>
        <ProFormGroup>
          <ProFormText name="name" label="名称" />
          <ProFormSelect
            mode="multiple"
            name="keys"
            label="按键范围"
            width="md"
            options={[...alphabet].map((x) => ({
              label: x,
              value: x,
            }))}
          />
        </ProFormGroup>
      </ProFormList>
    </ModalForm>
  );
};

const MappingGeneratorsForm = () => {
  const alphabet = useAtomValue(字母表原子);
  const [mappingGenerators, setMappingGenerators] = useAtom(决策生成器配置原子);
  return (
    <ModalForm
      title="生成器配置"
      trigger={<Button>生成器</Button>}
      layout="horizontal"
      initialValues={{ mappingGenerators }}
      onFinish={async ({ mappingGenerators }) => {
        setMappingGenerators(mappingGenerators as MappingGeneratorRule[]);
        return true;
      }}
    >
      <ProFormList
        name="mappingGenerators"
        alwaysShowItemLabel
        creatorRecord={() => ({
          regex: "^.$",
          value: { value: alphabet[0]!, score: 0 },
        })}
      >
        <ProFormGroup>
          <ProFormText name="regex" label="匹配元素" />
          <ProFormItem name="value" label="添加元素安排">
            {/* @ts-ignore */}
            <ValueDescriptionEditor />
          </ProFormItem>
        </ProFormGroup>
      </ProFormList>
    </ModalForm>
  );
};

export default function MappingSpace() {
  const mapping = useAtomValue(决策原子);
  const mappingSpace = useAtomValue(决策空间原子);
  const setMappingSpace = useSetAtom(决策空间原子);
  const addMappingSpace = useAddAtom(决策空间原子);
  const [character, setCharacter] = useState<string | undefined>(undefined);
  const alphabet = useAtomValue(字母表原子);
  const currentElement = useAtomValue(currentElementAtom);
  return (
    <Flex vertical gap="middle">
      <Typography.Title level={3}>决策空间</Typography.Title>
      <Flex justify="middle" gap="middle">
        <MappingVariablesForm />
        <MappingGeneratorsForm />
        <Button
          onClick={() => {
            const idles = Object.entries(mappingSpace).filter(
              ([name]) => mapping[name] === undefined,
            );
            const ms = structuredClone(mappingSpace);
            for (const [name] of idles) {
              delete ms[name];
            }
            const sortedIdles = sortBy(idles, ([name]) => name.codePointAt(0)!);
            for (const [name, value] of sortedIdles) {
              ms[name] = value;
            }
            setMappingSpace(ms);
          }}
        >
          对未选取元素排序
        </Button>
        <CharacterSelect value={character} onChange={setCharacter} />
        <Button
          onClick={() =>
            addMappingSpace(character!, [{ value: alphabet[0]!, score: 0 }])
          }
          disabled={character === undefined}
        >
          添加备选元素
        </Button>
      </Flex>
      <Flex wrap="wrap" gap="small">
        {Object.entries(mappingSpace)
          .filter(([name]) => mapping[name] === undefined)
          .map(([name, values]) => {
            return (
              <Flex key={name} align="center">
                <Popover
                  title="编辑决策空间"
                  trigger={["hover", "click"]}
                  content={<RulesForm name={name} />}
                >
                  <Element>
                    <ElementLabelWrapper
                      $shouldHighlight={name === currentElement}
                    >
                      <Display name={name} />
                    </ElementLabelWrapper>
                  </Element>
                </Popover>
              </Flex>
            );
          })}
      </Flex>
    </Flex>
  );
}
