import { Button, Flex, notification, Popover, Typography } from "antd";
import { isEqual } from "lodash-es";
import {
  alphabetAtom,
  currentElementAtom,
  displayAtom,
  mappingAtom,
  mappingGeneratorAtom,
  mappingSpaceAtom,
  useAddAtom,
  useAtom,
  useAtomValue,
  useRemoveAtom,
} from "~/atoms";
import ElementSelect from "~/components/ElementSelect";
import { ElementLabelWrapper, KeysEditor } from "~/components/Mapping";
import { DeleteButton, Display, NumberInput } from "~/components/Utils";
import { exportYAML, MappingGeneratorRule, MappingSpace } from "~/lib";
import Element from "./Element";
import {
  ModalForm,
  ProFormDigit,
  ProFormGroup,
  ProFormItem,
  ProFormList,
  ProFormSelect,
} from "@ant-design/pro-components";
import CharacterSelect from "./CharacterSelect";
import { useState } from "react";

export const RulesForm = ({ name }: { name: string }) => {
  const alphabet = useAtomValue(alphabetAtom);
  const mappingSpace = useAtomValue(mappingSpaceAtom);
  const addMappingSpace = useAddAtom(mappingSpaceAtom);
  const removeMappingSpace = useRemoveAtom(mappingSpaceAtom);
  const values = mappingSpace[name] ?? [];
  const creators = {
    禁用: () => ({ value: null, score: 0 }),
    键位: () => ({ value: alphabet[0]!, score: 0 }),
    归并: () => ({ value: { element: "1" }, score: 0 }),
  };
  const update = (index: number, key: string, value: any) => {
    addMappingSpace(
      name,
      values.map((v, i) => (i === index ? { ...v, [key]: value } : v)),
    );
  };
  return (
    <Flex vertical gap="middle">
      {values.map(({ value, score }, index) => {
        return (
          <Flex gap="small" key={index} align="center">
            {value === null || value === undefined ? (
              "禁用"
            ) : typeof value === "string" || Array.isArray(value) ? (
              <>
                备选键位
                <KeysEditor
                  value={value}
                  onChange={(newValue) => update(index, "value", newValue)}
                />
              </>
            ) : (
              <>
                备选归并
                <ElementSelect
                  value={value.element}
                  onChange={(newValue) =>
                    update(index, "value", { element: newValue })
                  }
                  style={{ width: 96 }}
                  allowClear={false}
                  includeOptional
                />
              </>
            )}
            打分
            <NumberInput value={score} width={96} />
            <DeleteButton
              onClick={() => {
                if (values.length === 1) {
                  removeMappingSpace(name);
                } else {
                  addMappingSpace(
                    name,
                    values.filter((_, i) => i !== index),
                  );
                }
              }}
            />
          </Flex>
        );
      })}
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

class NegativeDegreeError extends Error {
  element: string;
  neighbor: string;

  constructor(message: string, element: string, neighbor: string) {
    super(message);
    this.element = element;
    this.neighbor = neighbor;
    this.name = "NegativeDegreeError";
  }
}

class IncompleteError extends Error {
  missing: Set<string>;

  constructor(message: string, missing: Set<string>) {
    super(message);
    this.missing = missing;
    this.name = "IncompleteError";
  }
}

function topologicalSort(
  mappingSpace: MappingSpace,
): string[] | NegativeDegreeError | IncompleteError {
  const elements = Object.keys(mappingSpace);
  const graph: Map<string, Set<string>> = new Map(
    elements.map((key) => [key, new Set<string>()]),
  );
  const in_degree: Map<string, number> = new Map(
    elements.map((key) => [key, 0]),
  );
  for (const [key, values] of Object.entries(mappingSpace)) {
    const ins = new Set<string>();
    for (const { value, score } of values) {
      if (value === null) continue;
      if (typeof value === "string") continue;
      if ("element" in value) {
        if (!graph.has(value.element)) {
          console.warn(
            `Root ${value.element} not found in graph, skipping rule for ${key}.`,
          );
          continue;
        }
        graph.get(value.element)!.add(key);
        ins.add(value.element);
      } else {
        for (const item of value) {
          if (typeof item === "string") continue;
          graph.get(item.element)!.add(key);
          ins.add(item.element);
        }
      }
    }
    in_degree.set(key, ins.size);
  }

  const queue: string[] = [];
  for (const [key, degree] of in_degree.entries()) {
    if (degree === 0) {
      queue.push(key);
    }
  }
  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);
    for (const neighbor of graph.get(current)!) {
      const degree = in_degree.get(neighbor)! - 1;
      if (degree < 0) {
        return new NegativeDegreeError(
          `Negative in-degree for ${neighbor} after processing ${current}`,
          current,
          neighbor,
        );
      }
      in_degree.set(neighbor, degree);
      if (degree === 0) {
        queue.push(neighbor);
      }
    }
  }
  if (sorted.length !== elements.length) {
    const missing = new Set(elements);
    for (const item of sorted) {
      missing.delete(item);
    }
    return new IncompleteError(
      `Topological sort incomplete, missing elements: ${Array.from(
        missing,
      ).join(", ")}`,
      missing,
    );
  }
  return sorted;
}

const RulesGenerator = () => {
  const alphabet = useAtomValue(alphabetAtom);
  const [mappingGenerator, setMappingGenerator] = useAtom(mappingGeneratorAtom);
  return (
    <ModalForm
      title="生成规则"
      trigger={<Button>生成规则</Button>}
      layout="horizontal"
      initialValues={{ rules: mappingGenerator }}
      onFinish={async (values) => {
        const rules = values.rules as MappingGeneratorRule[];
        setMappingGenerator(rules);
        return true;
      }}
    >
      <ProFormList name="rules" alwaysShowItemLabel>
        <ProFormGroup>
          <ProFormDigit name="score" label="打分" width="xs" />
          <ProFormDigit name="position" label="码位" width="xs" />
          <ProFormItem name="elements" label="元素">
            <ElementSelect
              includeOptional
              mode="multiple"
              allowClear
              style={{ minWidth: 96 }}
            />
          </ProFormItem>
          <ProFormSelect
            mode="multiple"
            name="keys"
            label="按键范围"
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

export default function Rules() {
  const display = useAtomValue(displayAtom);
  const mapping = useAtomValue(mappingAtom);
  const mappingSpace = useAtomValue(mappingSpaceAtom);
  const addMappingSpace = useAddAtom(mappingSpaceAtom);
  const [character, setCharacter] = useState<string | undefined>(undefined);
  const alphabet = useAtomValue(alphabetAtom);
  const currentElement = useAtomValue(currentElementAtom);
  return (
    <Flex vertical gap="middle">
      <Typography.Title level={4}>决策空间</Typography.Title>
      <Flex justify="middle" gap="middle">
        <RulesGenerator />
        <Button
          type="primary"
          onClick={() => {
            const maybeSorted = topologicalSort(mappingSpace);
            if (Array.isArray(maybeSorted)) {
              const sorted = maybeSorted.map((x) => ({
                element: x,
                space: mappingSpace[x],
              }));
              exportYAML(sorted, "rules", 2);
            } else if (maybeSorted instanceof NegativeDegreeError) {
              notification.error({
                message: "负入度错误",
                description: `元素 ${display(
                  maybeSorted.element,
                )} 的邻居 ${display(
                  maybeSorted.neighbor,
                )} 具有负入度。请检查规则设置。`,
              });
            } else if (maybeSorted instanceof IncompleteError) {
              notification.error({
                message: "拓扑排序无法进行",
                description: `以下元素中可能存在循环引用：${Array.from(
                  maybeSorted.missing,
                )
                  .map(display)
                  .join(", ")}`,
              });
            }
          }}
        >
          导出
        </Button>
        <CharacterSelect value={character} onChange={setCharacter} />
        <Button
          onClick={() =>
            addMappingSpace(character!, [{ value: alphabet[0]!, score: 0 }])
          }
          disabled={character === undefined}
        >
          添加备选字根
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
