import {
  Button,
  Dropdown,
  Flex,
  Form,
  InputNumber,
  Switch,
  Typography,
} from "antd";
import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { focusAtom } from "jotai-optics";
import { Suspense, useMemo, useState } from "react";
import { keyboardAtom, useListAtom } from "~/atoms";
import { constraintsAtom, objectiveAtom } from "~/atoms/optimization";
import ElementSelect from "~/components/ElementSelect";
import Optimizer from "~/components/Optimizer";
import SolverForm from "~/components/SolverForm";
import {
  DeleteButton,
  EditorColumn,
  EditorRow,
  KeyList,
  Select,
} from "~/components/Utils";
import type {
  AtomicConstraint,
  Constraints,
  LevelWeights,
  Objective,
  PartialWeights,
  TierWeights,
} from "~/lib";
import { Solver } from "~/lib";

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
          title="静态选重权重"
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
  type: keyof Objective;
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
    [type],
  );
  const levelsAtom = useMemo(
    () =>
      focusAtom(partialObjectiveAtom, (o) =>
        o
          .valueOr({ levels: undefined })
          .prop("levels")
          .valueOr([] as LevelWeights[]),
      ),
    [type],
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
              title="动态选重权重"
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
            <AtomicObjective
              title="词间速度当量权重"
              value={extended_pair_equivalence}
              onChange={(value) => update("extended_pair_equivalence", value)}
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

const ConstraintList = ({
  title,
  type,
}: {
  title: string;
  type: keyof Constraints;
}) => {
  const listAtom = useMemo(
    () =>
      focusAtom(constraintsAtom, (o) =>
        o
          .valueOr({
            elements: undefined,
            indices: undefined,
            element_indices: undefined,
          })
          .prop(type)
          .valueOr([] as AtomicConstraint[]),
      ),
    [type],
  );

  const [list, append, exclude, modify] = useListAtom(listAtom);
  const { alphabet } = useAtomValue(keyboardAtom);
  const defaultConstraints: Record<keyof Constraints, AtomicConstraint> = {
    elements: { element: "1" },
    indices: { index: 1 },
    element_indices: { element: "1", index: 1 },
  };
  return (
    <>
      <Typography.Title level={3}>{title}</Typography.Title>
      <Flex vertical gap="small">
        {list.map((constraint, index) => {
          const { element, index: idx, keys } = constraint;
          return (
            <Flex vertical gap="small" key={index}>
              <Flex key={index} align="center" gap="small">
                将
                {type !== "indices" ? (
                  <ElementSelect
                    excludeGrouped
                    char={element}
                    onChange={(char) =>
                      modify(index, { ...constraint, element: char })
                    }
                  />
                ) : (
                  "所有元素"
                )}
                的
                {type !== "elements" ? (
                  <Select
                    value={idx}
                    options={[0, 1, 2, 3].map((x) => ({
                      label: `第 ${x + 1} 码`,
                      value: x,
                    }))}
                    onChange={(value) =>
                      modify(index, { ...constraint, index: value })
                    }
                  />
                ) : (
                  "所有码"
                )}
                限制在
                <Select
                  value={keys === undefined}
                  options={[
                    { label: "当前按键", value: true },
                    { label: "指定按键", value: false },
                  ]}
                  onChange={(value) =>
                    modify(index, {
                      ...constraint,
                      keys: value ? undefined : [],
                    })
                  }
                />
                <DeleteButton onClick={() => exclude(index)} />
              </Flex>
              {keys && (
                <KeyList
                  keys={keys}
                  setKeys={(ks) => modify(index, { ...constraint, keys: ks })}
                  allKeys={[...alphabet]}
                />
              )}
            </Flex>
          );
        })}
        <Button onClick={() => append(defaultConstraints[type])}>
          添加约束
        </Button>
      </Flex>
    </>
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
        <Typography.Title level={2}>优化方法</Typography.Title>
        <SolverForm />
        <Typography.Title level={2}>优化约束</Typography.Title>
        <ConstraintList title="元素约束" type="elements" />
        <ConstraintList title="码位约束" type="indices" />
        <ConstraintList title="元素 + 码位约束" type="element_indices" />
      </EditorColumn>
      <EditorColumn span={12}>
        <Typography.Title level={2}>优化</Typography.Title>
        <Optimizer />
      </EditorColumn>
    </EditorRow>
  );
}
