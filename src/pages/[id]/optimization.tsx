import {
  ModalForm,
  ProForm,
  ProFormDependency,
  ProFormDigit,
  ProFormGroup,
  type ProFormInstance,
  ProFormList,
} from "@ant-design/pro-components";
import {
  Button,
  Dropdown,
  Flex,
  Form,
  InputNumber,
  Switch,
  Typography,
  Select as AntdSelect,
  Skeleton,
} from "antd";
import { useAtom, useAtomValue } from "jotai";
import { focusAtom } from "jotai-optics";
import { Suspense, useMemo, useRef } from "react";
import {
  constraintsAtom,
  objectiveAtom,
  alphabetAtom,
  regularizationAtom,
} from "~/atoms";
import ElementSelect from "~/components/ElementSelect";
import KeySelect from "~/components/KeySelect";
import Optimizer from "~/components/Optimizer";
import SolverForm from "~/components/SolverForm";
import {
  DeleteButton,
  EditorColumn,
  EditorRow,
  Select,
} from "~/components/Utils";
import type {
  AtomicConstraint,
  Constraints,
  LevelWeights,
  PartialWeights,
  Regularization,
  TierWeights,
} from "~/lib";

const AtomicObjective = ({
  title,
  value,
  onChange,
}: {
  title: string;
  value: number | undefined;
  onChange: (n: number | undefined) => void;
}) => {
  return (
    <Form.Item label={title} style={{ marginBottom: 0 }}>
      <Flex justify="space-between">
        <InputNumber
          style={{ width: "64px" }}
          value={value}
          disabled={value === undefined}
          onChange={(value) => onChange(value || undefined)}
        />
        <Switch
          checked={value !== undefined}
          onChange={(value) => onChange(value ? 1.0 : undefined)}
        />
      </Flex>
    </Form.Item>
  );
};

const defaultFingeringWeights = [
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
];

const weightTitles = [
  "同手",
  "大跨",
  "小跨",
  "干扰",
  "错手",
  "三连",
  "备用",
  "备用",
];

const ListObjective = ({
  title,
  value,
  onChange,
}: {
  title: string;
  value?: (number | null)[];
  onChange: (n?: (number | null)[]) => void;
}) => {
  return (
    <>
      <Flex justify="space-between">
        <span>{title}</span>
        <Switch
          checked={value !== undefined}
          onChange={(value) =>
            onChange(value ? defaultFingeringWeights : undefined)
          }
        />
      </Flex>
      <Flex gap="small">
        {value &&
          value.map((num, index) => (
            <Form.Item
              key={index}
              label={weightTitles[index]}
              style={{
                marginBottom: 0,
                display: weightTitles[index] === "备用" ? "none" : "initial",
              }}
            >
              <InputNumber
                style={{ width: "64px" }}
                value={num}
                onChange={(n) => {
                  const newValue = [...value];
                  newValue[index] = n;
                  onChange(newValue);
                }}
              />
            </Form.Item>
          ))}
      </Flex>
    </>
  );
};

const defaultTier: TierWeights = {
  duplication: 1,
};

const LevelObjective = ({
  level,
  update,
  remove,
}: {
  level: LevelWeights;
  update: (l: LevelWeights) => void;
  remove: () => void;
}) => {
  return (
    <Flex justify="space-between">
      <Flex gap="small">
        <Form.Item label="码长" style={{ marginBottom: 0 }}>
          <Select
            value={level.length}
            style={{ width: "80px" }}
            options={[1, 2, 3, 4, 5, 6].map((x) => ({
              label: `${x} 键`,
              value: x,
            }))}
            onChange={(value) => {
              update({ ...level, length: value });
            }}
          />
        </Form.Item>
        <Form.Item label="频率权重" style={{ marginBottom: 0 }}>
          <InputNumber
            style={{ width: "64px" }}
            value={level.frequency}
            onChange={(value) => {
              update({ ...level, frequency: value ?? 0 });
            }}
          />
        </Form.Item>
      </Flex>
      <DeleteButton onClick={remove} />
    </Flex>
  );
};

const TierObjective = ({
  tier,
  update,
  remove,
}: {
  tier: TierWeights;
  update: (t: TierWeights) => void;
  remove: () => void;
}) => {
  const levels = tier.levels ?? [];
  return (
    <Flex vertical gap="small">
      <Flex justify="space-between">
        <Form.Item style={{ marginBottom: 0 }}>
          <Select
            style={{ width: "80px" }}
            value={tier.top !== undefined}
            options={[
              { label: "全部", value: false },
              { label: "前", value: true },
            ]}
            onChange={(value) => {
              update({
                ...tier,
                top: value ? 1500 : undefined,
              });
            }}
          />
          {tier.top !== undefined && (
            <InputNumber
              style={{ width: "64px" }}
              value={tier.top}
              onChange={(value) => {
                update({ ...tier, top: value ?? 0 });
              }}
            />
          )}
        </Form.Item>
        <Flex gap="small">
          <Dropdown
            menu={{
              items: [1, 2, 3, 4, 5, 6].map((x) => ({
                label: `${x} 键`,
                key: x,
                onClick: () =>
                  update({
                    ...tier,
                    levels: (tier.levels ?? []).concat({
                      length: x,
                      frequency: x,
                    }),
                  }),
              })),
            }}
          >
            <Button>添加层级码长指标</Button>
          </Dropdown>
          <DeleteButton onClick={remove} />
        </Flex>
      </Flex>
      <Flex vertical style={{ marginLeft: "4rem" }} gap="small">
        <AtomicObjective
          title="选重权重"
          value={tier.duplication}
          onChange={(value) => {
            update({ ...tier, duplication: value });
          }}
        />
        {levels.map((l, subindex) => (
          <LevelObjective
            key={subindex}
            level={l}
            update={(l) =>
              update({
                ...tier,
                levels: levels.map((x, i) => (i === subindex ? l : x)),
              })
            }
            remove={() =>
              update({
                ...tier,
                levels: levels.filter((x, i) => i !== subindex),
              })
            }
          />
        ))}
      </Flex>
    </Flex>
  );
};

const PartialObjective = ({
  title,
  type,
}: {
  title: string;
  type: "characters_full" | "characters_short" | "words_full" | "words_short";
}) => {
  const partialObjectiveAtom = useMemo(
    () => focusAtom(objectiveAtom, (o) => o.prop(type)),
    [type],
  );
  const tiersAtom = useMemo(
    () =>
      focusAtom(partialObjectiveAtom, (o) =>
        o
          .valueOr({ tiers: undefined })
          .prop("tiers")
          .valueOr([] as TierWeights[]),
      ),
    [partialObjectiveAtom],
  );
  const levelsAtom = useMemo(
    () =>
      focusAtom(partialObjectiveAtom, (o) =>
        o
          .valueOr({ levels: undefined })
          .prop("levels")
          .valueOr([] as LevelWeights[]),
      ),
    [partialObjectiveAtom],
  );

  const [partialObjective, setPartialObjective] = useAtom(partialObjectiveAtom);
  const [tiers, setTiers] = useAtom(tiersAtom);
  const [levels, setLevels] = useAtom(levelsAtom);
  const currentPart = partialObjective ?? {};
  const {
    duplication,
    key_distribution,
    pair_equivalence,
    extended_pair_equivalence,
  } = currentPart;
  const update = (type: keyof PartialWeights, value: number | undefined) => {
    setPartialObjective({ ...currentPart, [type]: value });
  };
  const updateTiersAt = (index: number, value: TierWeights) => {
    setTiers(tiers.map((x, i) => (i === index ? value : x)));
  };
  const updateLevelsAt = (index: number, value: LevelWeights) => {
    setLevels(levels.map((x, i) => (i === index ? value : x)));
  };
  return (
    <Flex vertical>
      <Flex justify="space-between" align="baseline">
        <Typography.Title level={3}>{title}</Typography.Title>
        <Switch
          checked={partialObjective !== undefined}
          onChange={(checked) => {
            if (checked) {
              setPartialObjective({});
            } else {
              setPartialObjective(undefined);
            }
          }}
        />
      </Flex>
      {partialObjective && (
        <>
          <Typography.Title level={4}>整体</Typography.Title>
          <Flex vertical gap="small">
            <AtomicObjective
              title="加权选重权重"
              value={duplication}
              onChange={(value) => update("duplication", value)}
            />
            <AtomicObjective
              title="用指分布偏差权重"
              value={key_distribution}
              onChange={(value) => update("key_distribution", value)}
            />
            <AtomicObjective
              title="速度当量权重"
              value={pair_equivalence}
              onChange={(value) => update("pair_equivalence", value)}
            />
            <ListObjective
              title="指法"
              value={currentPart.fingering}
              onChange={(value) =>
                setPartialObjective({ ...currentPart, fingering: value })
              }
            />
          </Flex>
          <Typography.Title level={4}>码长</Typography.Title>
          <Flex vertical gap="small">
            {levels.map((level, index) => (
              <LevelObjective
                key={index}
                level={level}
                update={(l) => updateLevelsAt(index, l)}
                remove={() => setLevels(levels?.filter((_, i) => index !== i))}
              />
            ))}
            <Flex justify="center">
              <Dropdown
                menu={{
                  items: [1, 2, 3, 4, 5, 6].map((x) => ({
                    label: `${x} 键`,
                    key: x,
                    onClick: () =>
                      setLevels(
                        (levels ?? []).concat({ length: x, frequency: 1 }),
                      ),
                  })),
                }}
              >
                <Button>添加码长指标</Button>
              </Dropdown>
            </Flex>
          </Flex>
          <Typography.Title level={4}>层级</Typography.Title>
          <Flex vertical gap="small">
            {tiers.map((tier, index) => (
              <TierObjective
                key={index}
                tier={tier}
                update={(t) => updateTiersAt(index, t)}
                remove={() => setTiers(tiers?.filter((_, i) => index !== i))}
              />
            ))}
            <Flex justify="center">
              <Button
                onClick={() => setTiers((tiers ?? []).concat(defaultTier))}
              >
                添加层级指标
              </Button>
            </Flex>
          </Flex>
        </>
      )}
    </Flex>
  );
};

const Regularization = ({}) => {
  const [regularization, set] = useAtom(regularizationAtom);
  return (
    <>
      <ModalForm<Regularization>
        title="正则化"
        trigger={
          <Button type="primary" style={{ marginBottom: "1rem" }}>
            正则化
          </Button>
        }
        layout="horizontal"
        onFinish={async (values) => {
          set(values);
          return true;
        }}
        initialValues={regularization}
      >
        <ProFormDigit name="strength" label="强度" />
        <Typography.Title level={3}>元素亲和力</Typography.Title>
        <ProFormList name="element_affinities" alwaysShowItemLabel>
          <ProFormGroup>
            <ProForm.Item name="from" label="元素" vertical={false}>
              {/* @ts-ignore */}
              <KeySelect disableAlphabets />
            </ProForm.Item>
            <ProFormList name="to" label="目标" alwaysShowItemLabel>
              <ProFormGroup>
                <ProForm.Item name="element" label="元素">
                  {/* @ts-ignore */}
                  <KeySelect disableAlphabets />
                </ProForm.Item>
                <ProFormDigit name="affinity" label="亲和" />
              </ProFormGroup>
            </ProFormList>
          </ProFormGroup>
        </ProFormList>
        <Typography.Title level={3}>按键亲和力</Typography.Title>
        <ProFormList name="key_affinities">
          <ProFormGroup>
            <ProForm.Item name="from" label="元素" vertical={false}>
              {/* @ts-ignore */}
              <KeySelect disableAlphabets />
            </ProForm.Item>
            <ProForm.Item name="to" label="目标">
              {/* @ts-ignore */}
              <KeySelect disableElements />
            </ProForm.Item>
            <ProFormDigit name="affinity" label="亲和" width={64} />
          </ProFormGroup>
        </ProFormList>
      </ModalForm>
    </>
  );
};

const ConstraintsForm = ({
  label,
  type,
}: {
  label: string;
  type: "elements" | "indices" | "element_indices";
}) => {
  const alphabet = useAtomValue(alphabetAtom);
  const [constraints, set] = useAtom(constraintsAtom);
  const current = constraints?.[type] ?? [];
  const formRef = useRef<ProFormInstance>();
  return (
    <ModalForm<{ items: AtomicConstraint[] }>
      trigger={<Button>{label}</Button>}
      layout="horizontal"
      formRef={formRef}
      initialValues={{ items: current }}
      onFinish={async ({ items }) => {
        set((prev) => ({ ...prev, [type]: items }));
        return true;
      }}
    >
      <Typography.Title level={3}>元素约束</Typography.Title>
      <ProFormList name="items" alwaysShowItemLabel>
        {(_, index) => (
          <ProFormDependency name={["items"]}>
            {({ items }) => {
              const keys = items[index].keys;
              const negated = keys === undefined ? [] : undefined;
              return (
                <ProFormGroup>
                  {type !== "indices" && (
                    <ProForm.Item name="element" label="元素">
                      <ElementSelect excludeGrouped />
                    </ProForm.Item>
                  )}
                  {type !== "elements" && (
                    <ProForm.Item name="index" label="码位">
                      <Select
                        options={[0, 1, 2, 3].map((x) => ({
                          label: `第 ${x + 1} 码`,
                          value: x,
                        }))}
                      />
                    </ProForm.Item>
                  )}
                  <ProForm.Item label="限制在">
                    <Select
                      value={keys === undefined}
                      options={[
                        { label: "当前元素", value: true },
                        { label: "指定元素", value: false },
                      ]}
                      onChange={(value) =>
                        formRef.current?.setFieldValue(
                          ["elements", index, "keys"],
                          negated,
                        )
                      }
                    />
                  </ProForm.Item>
                  {keys !== undefined && (
                    <ProForm.Item name="keys" label="按键">
                      <AntdSelect
                        mode="multiple"
                        options={[...alphabet].map((x) => ({
                          label: x,
                          value: x,
                        }))}
                      />
                    </ProForm.Item>
                  )}
                </ProFormGroup>
              );
            }}
          </ProFormDependency>
        )}
      </ProFormList>
    </ModalForm>
  );
};

export default function Optimization() {
  return (
    <EditorRow>
      <EditorColumn span={12}>
        <Typography.Title level={2}>优化目标</Typography.Title>
        <PartialObjective title="一字词全码" type="characters_full" />
        <PartialObjective title="一字词简码" type="characters_short" />
        <PartialObjective title="多字词全码" type="words_full" />
        <PartialObjective title="多字词简码" type="words_short" />
        {/* <Regularization /> */}
        <Typography.Title level={2}>优化方法</Typography.Title>
        <SolverForm />
        <Typography.Title level={2}>优化约束</Typography.Title>
        <Flex gap="middle" justify="center">
          <ConstraintsForm label="元素约束" type="elements" />
          <ConstraintsForm label="码位约束" type="indices" />
          <ConstraintsForm label="元素码位约束" type="element_indices" />
        </Flex>
      </EditorColumn>
      <EditorColumn span={12}>
        <Typography.Title level={2}>优化</Typography.Title>
        <Suspense fallback={<Skeleton active />}>
          <Optimizer />
        </Suspense>
      </EditorColumn>
    </EditorRow>
  );
}
