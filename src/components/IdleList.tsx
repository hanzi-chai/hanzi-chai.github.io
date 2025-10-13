import { Button, Flex, notification, Popover, Select, Typography } from "antd";
import { isEqual, sortBy } from "lodash-es";
import {
  alphabetAtom,
  analysisConfigAtom,
  currentElementAtom,
  displayAtom,
  mappingAtom,
  mappingGeneratorAtom,
  mappingSpaceAtom,
  repertoireAtom,
  useAddAtom,
  useAtom,
  useAtomValue,
  useRemoveAtom,
  useSetAtom,
} from "~/atoms";
import ElementSelect from "~/components/ElementSelect";
import { ElementLabelWrapper } from "~/components/Mapping";
import { DeleteButton, Display, NumberInput } from "~/components/Utils";
import {
  chars,
  ElementWithIndex,
  exportYAML,
  MappingGeneratorRule,
  MappingSpace,
  Value,
  ValueDescription,
} from "~/lib";
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
import ValueEditor from "./Value";
import gf0014 from "./gf0014.yaml";

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
  const updateCondition = (
    index: number,
    conditionIndex: number,
    key: string,
    value: any,
  ) => {
    const currentCondition = values[index]!.condition ?? [];
    update(
      index,
      "condition",
      currentCondition.map((c, i) =>
        i === conditionIndex ? { ...c, [key]: value } : c,
      ),
    );
  };
  const repertoire = useAtomValue(repertoireAtom);
  const character = repertoire[name];
  return (
    <Flex vertical gap="middle">
      <Flex gap="middle">
        {character?.tygf !== undefined && character.tygf > 0 && (
          <span>
            通规音：{character.readings.map((x) => x.pinyin).join("、")}
          </span>
        )}
        {character?.gf0014_id && (
          <span>GF0014 音：{gf0014[character.gf0014_id - 1].join(" | ")}</span>
        )}
      </Flex>
      {values.map(({ value, score, condition }, index) => {
        const currentCondition = condition ?? [];
        return (
          <Flex vertical gap="small" key={index}>
            <Flex gap="small" key={index} align="center">
              <ValueEditor
                value={value}
                onChange={(newValue) => update(index, "value", newValue)}
              />
              打分
              <NumberInput
                value={score}
                width={96}
                onChange={(newValue) => update(index, "score", newValue)}
              />
              <Button
                onClick={() => {
                  update(
                    index,
                    "condition",
                    currentCondition.concat([
                      { element: name, op: "不是", value: null },
                    ]),
                  );
                }}
              >
                添加条件
              </Button>
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
                  onChange={(element) =>
                    updateCondition(index, i, "element", element)
                  }
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
                  onChange={(op) => updateCondition(index, i, "op", op)}
                />
                <ValueEditor
                  value={c.value}
                  onChange={(value) =>
                    updateCondition(index, i, "value", value)
                  }
                />
                <DeleteButton
                  onClick={() => {
                    update(
                      index,
                      "condition",
                      currentCondition.filter((_, j) => j !== i),
                    );
                  }}
                />
              </Flex>
            ))}
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
  mappingSpaceEntries: [string, ValueDescription[]][],
): string[] | NegativeDegreeError | IncompleteError {
  const elements = mappingSpaceEntries.map(([key]) => key);
  const graph: Map<string, Set<string>> = new Map(
    elements.map((key) => [key, new Set<string>()]),
  );
  const in_degree: Map<string, number> = new Map(
    elements.map((key) => [key, 0]),
  );
  for (const [key, values] of mappingSpaceEntries) {
    const ins = new Set<string>();
    for (const { value, condition } of values) {
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
      for (const c of condition ?? []) {
        ins.add(c.element);
        graph.get(c.element)!.add(key);
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
    const neighbors = sortBy(
      Array.from(graph.get(current)!),
      (x) => (chars(x) === 1 ? 1 : 0),
      (x) => x,
    );
    for (const neighbor of neighbors) {
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
  const setMappingSpace = useSetAtom(mappingSpaceAtom);
  const addMappingSpace = useAddAtom(mappingSpaceAtom);
  const [character, setCharacter] = useState<string | undefined>(undefined);
  const alphabet = useAtomValue(alphabetAtom);
  const currentElement = useAtomValue(currentElementAtom);
  const repertoire = useAtomValue(repertoireAtom);
  return (
    <Flex vertical gap="middle">
      <Typography.Title level={4}>决策空间</Typography.Title>
      <Flex justify="middle" gap="middle">
        <RulesGenerator />
        <Button
          onClick={() => {
            const message: string[] = [];
            const allkeys = new Set(
              Object.keys(mappingSpace)
                .concat(Object.keys(mapping))
                .filter((x) => /^[^\d]$/.test(x)),
            );
            const reverseMap = new Map<number, string>();
            for (const [key, value] of Object.entries(repertoire)) {
              if (value.gf0014_id) {
                reverseMap.set(value.gf0014_id, key);
              }
            }
            for (let i = 1; i <= 514; ++i) {
              if (!reverseMap.has(i)) {
                console.warn(`GF0014 ID ${i} not found in repertoire.`);
                continue;
              }
              const key = reverseMap.get(i)!;
              if (!allkeys.has(key)) {
                message.push(`${i}: ${display(key)}`);
              }
            }
            const getShengyun = (v: Value) => {
              if (v === null) return;
              if (typeof v === "string") return;
              if (Array.isArray(v)) {
                if (
                  typeof v[0] === "object" &&
                  v[0].element.startsWith("声") &&
                  typeof v[1] === "object" &&
                  v[1].element.startsWith("韵")
                ) {
                  let raw = v[0].element.slice(2) + v[1].element.slice(2);
                  raw = raw.replace("ir", "i");
                  raw = raw.replace("0", "");
                  raw = raw.replace(/yi(?=[aoe])/g, "y");
                  raw = raw.replace(/wu(?=[aoe])/g, "w");
                  raw = raw.replace(/yuü/g, "yu");
                  raw = raw.replace(/(?<=[jqx])ü/g, "u");
                  raw = raw.replace(/(?<=[nl])ü/g, "v");
                  raw = raw.replace(/ue(?=[in])/g, "u");
                  raw = raw.replace("iou", "iu");
                  return raw;
                }
              }
            };
            for (const key of allkeys) {
              const values = JSON.parse(
                JSON.stringify(mappingSpace[key] ?? []),
              );
              if (mapping[key] !== undefined) {
                values.push({ value: mapping[key]!, score: 0 });
              }
              if (repertoire[key]!.tygf) {
                const readings = repertoire[key]!.readings.map((r) =>
                  r.pinyin.slice(0, -1),
                );
                for (const value of values) {
                  const shengyun = getShengyun(value.value);
                  if (shengyun && !readings.includes(shengyun)) {
                    message.push(
                      `${display(key)} ${shengyun}：${readings.join(", ")}`,
                    );
                  } else if (
                    !shengyun &&
                    value.value !== null &&
                    !(
                      Array.isArray(value.value) &&
                      typeof value.value[0] === "string"
                    )
                  ) {
                    message.push(
                      `${display(key)} ${JSON.stringify(
                        value.value,
                      )}：${readings.join(", ")}`,
                    );
                  }
                }
              } else if (repertoire[key]!.gf0014_id) {
                const readings: string[] = [];
                for (const raw of gf0014[
                  repertoire[key]!.gf0014_id - 1
                ] as string[]) {
                  if (raw === "") continue;
                  const list = raw.split(" ");
                  for (const item of list) {
                    readings.push(item.slice(0, -1));
                  }
                }
                const allShengyun = new Set<string>();
                for (const value of values) {
                  const shengyun = getShengyun(value.value);
                  if (shengyun) allShengyun.add(shengyun);
                  if (shengyun && !readings.includes(shengyun)) {
                    message.push(
                      `${display(key)} ${shengyun}：${readings.join(", ")}`,
                    );
                  }
                }
                for (const reading of readings) {
                  if (!allShengyun.has(reading)) {
                    message.push(
                      `${display(key)} 缺少 ${reading}：${readings.join(", ")}`,
                    );
                  }
                }
              } else {
                for (const value of values) {
                  const shengyun = getShengyun(value.value);
                  if (shengyun) {
                    message.push(`${display(key)} 不合法 ${shengyun}`);
                  }
                }
              }
            }
            notification.info({
              message: `检查完毕，共 ${message.length} 处问题`,
              description: message.join("；"),
              duration: 0,
            });
          }}
        >
          检查
        </Button>
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
          整理
        </Button>
        <Button
          type="primary"
          onClick={() => {
            const completeSpace: MappingSpace = structuredClone(mappingSpace);
            for (const [name, value] of Object.entries(mapping)) {
              if (completeSpace[name] === undefined) {
                completeSpace[name] = [{ value, score: 0 }];
              } else {
                completeSpace[name].push({ value, score: 0 });
              }
            }
            const initialSorted = sortBy(
              Object.entries(completeSpace),
              ([name]) => (chars(name) === 1 ? 1 : 0),
              ([name]) => name,
            );
            const maybeSorted = topologicalSort(initialSorted);
            if (Array.isArray(maybeSorted)) {
              exportYAML(maybeSorted, "rules", 2);
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
