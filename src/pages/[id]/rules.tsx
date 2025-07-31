import {
  ModalForm,
  ProFormCheckbox,
  ProFormDependency,
  ProFormGroup,
  ProFormItem,
  ProFormList,
  ProFormSelect,
} from "@ant-design/pro-components";
import { Button, Flex, notification } from "antd";
import { atomWithStorage } from "jotai/utils";
import {
  alphabetAtom,
  displayAtom,
  mappingAtom,
  optionalAtom,
  useAtomValue,
  useChaifenTitle,
  useSetAtom,
} from "~/atoms";
import Element from "~/components/Element";
import ElementSelect from "~/components/ElementSelect";
import { Display } from "~/components/Utils";
import { exportYAML } from "~/lib";

interface 归并 {
  类型: "归并";
  字根: string;
}

interface 读音 {
  类型: "读音";
  声母: string;
  韵母: string;
}

interface 键位 {
  类型: "键位";
  键位: string;
}

interface 规则 {
  元素: string;
  规则: (归并 | 读音 | 键位)[];
  允许乱序?: boolean;
}

const rulesAtom = atomWithStorage<规则[]>("rules", []);

const RulesForm = ({ initialValues }: { initialValues: 规则 }) => {
  const addRule = useSetAtom(rulesAtom);
  const alphabet = useAtomValue(alphabetAtom);
  return (
    <ModalForm
      initialValues={initialValues}
      title="编辑规则"
      trigger={<Button>编辑规则</Button>}
      onFinish={async (values: 规则) => {
        addRule((prev) => {
          if (prev.some((x) => x.元素 === values.元素)) {
            return prev.map((rule) =>
              rule.元素 === values.元素 ? values : rule,
            );
          } else {
            return [...prev, values];
          }
        });
        return true;
      }}
      layout="horizontal"
    >
      <ProFormGroup>
        <ProFormItem name="元素" label="元素">
          <ElementSelect style={{ width: 96 }} allowClear={false} disabled />
        </ProFormItem>
        <ProFormCheckbox name="允许乱序" label="允许乱序" />
      </ProFormGroup>
      <ProFormList
        name="规则"
        creatorRecord={() => ({ type: "归并" })}
        alwaysShowItemLabel
      >
        <ProFormGroup>
          <ProFormSelect
            name="类型"
            label="规则类型"
            options={[
              { label: "归并", value: "归并" },
              { label: "读音", value: "读音" },
              { label: "键位", value: "键位" },
            ]}
            allowClear={false}
          />
          <ProFormDependency name={["类型"]}>
            {({ 类型 }) => {
              if (类型 === "归并") {
                return (
                  <ProFormItem name="字根" label="归并到">
                    <ElementSelect
                      style={{ width: 96 }}
                      allowClear={false}
                      includeOptional
                    />
                  </ProFormItem>
                );
              }
              if (类型 === "键位") {
                return (
                  <ProFormSelect
                    name="键位"
                    label="键位"
                    options={[...alphabet]}
                  />
                );
              }
              if (类型 === "读音") {
                return (
                  <ProFormGroup>
                    <ProFormItem name="声母" label="声母">
                      <ElementSelect style={{ width: 96 }} allowClear={false} />
                    </ProFormItem>
                    <ProFormItem name="韵母" label="韵母">
                      <ElementSelect style={{ width: 96 }} allowClear={false} />
                    </ProFormItem>
                  </ProFormGroup>
                );
              }
              return null;
            }}
          </ProFormDependency>
        </ProFormGroup>
      </ProFormList>
    </ModalForm>
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
  all: string[],
  rules: 规则[],
): string[] | NegativeDegreeError | IncompleteError {
  const graph: Map<string, Set<string>> = new Map(
    all.map((key) => [key, new Set<string>()]),
  );
  const in_degree: Map<string, number> = new Map(all.map((key) => [key, 0]));
  for (const 元素规则 of rules) {
    const { 元素: key, 规则: value } = 元素规则;
    const ins = new Set<string>();
    for (const rule of value) {
      if (rule.类型 === "归并") {
        graph.get(rule.字根)!.add(key);
        ins.add(rule.字根);
      } else if (rule.类型 === "键位") {
        graph.get(rule.键位)!.add(key);
        ins.add(rule.键位);
      } else if (rule.类型 === "读音") {
        graph.get(rule.声母)!.add(key);
        graph.get(rule.韵母)!.add(key);
        ins.add(rule.声母);
        ins.add(rule.韵母);
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
  if (sorted.length !== all.length) {
    const missing = new Set(all);
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

export default function Rules() {
  useChaifenTitle("规则");
  const mapping = useAtomValue(mappingAtom);
  const optionalMapping = useAtomValue(optionalAtom);
  const display = useAtomValue(displayAtom);
  const all = Array.from(
    new Set(Object.keys(mapping).concat(Object.keys(optionalMapping))),
  );
  const rules = useAtomValue(rulesAtom);
  return (
    <Flex vertical gap="middle">
      <Flex justify="middle" gap="middle">
        <Button
          type="primary"
          onClick={() => {
            const maybeSorted = topologicalSort(all, rules);
            if (Array.isArray(maybeSorted)) {
              const sorted = maybeSorted.map(
                (x) =>
                  rules.find((y) => y.元素 === x) ?? {
                    元素: x,
                    规则: [],
                    允许乱序: undefined,
                  },
              );
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
      </Flex>
      {all
        .filter((x) => /^.$/.test(x))
        .sort((a, b) => a.codePointAt(0)! - b.codePointAt(0)!)
        .map((name) => {
          const initialValues: 规则 = rules.find((x) => x.元素 === name) ?? {
            元素: name,
            规则: [],
            允许乱序: undefined,
          };
          return (
            <Flex gap="middle" key={name} align="center">
              <Element>
                <Display name={name} />
              </Element>
              {initialValues.允许乱序 ? "允许乱序" : ""}
              {initialValues.规则.map((rule, i) => {
                switch (rule.类型) {
                  case "归并":
                    return (
                      <Element key={i}>
                        <Display name={rule.字根} />
                      </Element>
                    );
                  case "键位":
                    return (
                      <Element key={i}>
                        <Display name={rule.键位} />
                      </Element>
                    );
                  case "读音":
                    return (
                      <Element key={i}>
                        <Display name={rule.声母} />
                        <Display name={rule.韵母} />
                      </Element>
                    );
                  default:
                    return null;
                }
              })}
              <RulesForm initialValues={initialValues} />
            </Flex>
          );
        })}
    </Flex>
  );
}
