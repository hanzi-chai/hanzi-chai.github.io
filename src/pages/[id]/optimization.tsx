import {
  Button,
  Checkbox,
  Dropdown,
  Flex,
  Form,
  InputNumber,
  Space,
  Switch,
  Typography,
} from "antd";
import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { focusAtom } from "jotai-optics";
import { Suspense, useMemo, useState } from "react";
import {
  configFormAtom,
  loadCFAtom,
  loadKEAtom,
  loadPEAtom,
  loadWFAtom,
} from "~/atoms";
import {
  constraintsAtom,
  metaheuristicAtom,
  objectiveAtom,
  parametersAtom,
  searchMethodAtom,
} from "~/atoms/optimization";
import CustomSpin from "~/components/CustomSpin";
import Evaluator from "~/components/Evaluator";
import {
  DeleteButton,
  EditorColumn,
  EditorRow,
  KeyList,
  MinusButton,
  PlusButton,
  ElementSelect,
  Select,
} from "~/components/Utils";
import {
  AtomicConstraint,
  GroupConstraint,
  LevelWeights,
  Objective,
  PartialWeights,
  Solver,
  TierWeights,
} from "~/lib/config";

const Parameters = () => {
  const [parameters, setParameters] = useAtom(parametersAtom);
  const currentParameters = parameters as NonNullable<Solver["parameters"]>;
  const { t_max, t_min, steps } = currentParameters;
  return (
    <>
      <Form.Item label="最高温">
        <InputNumber
          value={t_max}
          onChange={(value) =>
            setParameters({ ...currentParameters, t_max: value ?? 0 })
          }
        />
      </Form.Item>
      <Form.Item label="最低温">
        <InputNumber
          value={t_min}
          onChange={(value) =>
            setParameters({ ...currentParameters, t_min: value ?? 0 })
          }
        />
      </Form.Item>
      <Form.Item label="步数">
        <InputNumber
          value={steps}
          onChange={(value) =>
            setParameters({ ...currentParameters, steps: value ?? 0 })
          }
        />
      </Form.Item>
    </>
  );
};

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
  const { duplication, key_equivalence, pair_equivalence } = currentPart;
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
              title="用指当量权重"
              value={key_equivalence}
              onChange={(value) => update("key_equivalence", value)}
            />
            <AtomicObjective
              title="速度当量权重"
              value={pair_equivalence}
              onChange={(value) => update("pair_equivalence", value)}
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

type ConstraintType = "elements" | "indices" | "element_indices";

const ConstraintList = ({
  title,
  type,
}: {
  title: string;
  type: ConstraintType;
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
          .prop(type),
      ),
    [type],
  );

  const [list, setList] = useAtom(listAtom);
  const { alphabet } = useAtomValue(configFormAtom);
  const defaultConstraints: Record<ConstraintType, AtomicConstraint> = {
    elements: { element: "1" },
    indices: { index: 1 },
    element_indices: { element: "1", index: 1 },
  };
  return (
    <>
      <Typography.Title level={3}>{title}</Typography.Title>
      {(list ?? []).map(({ element, index: idx, keys }, index) => {
        return (
          <Flex vertical gap="small" key={index}>
            <Flex key={index} align="center" gap="small">
              将
              {type !== "indices" ? (
                <ElementSelect
                  excludeGrouped
                  char={element}
                  onChange={(char) =>
                    setList(
                      list?.map((x, i) =>
                        i === index ? { ...x, element: char } : x,
                      ),
                    )
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
                    setList(
                      list?.map((x, i) =>
                        i === index ? { ...x, index: value } : x,
                      ),
                    )
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
                  setList(
                    list?.map((x, i) =>
                      i === index ? { ...x, keys: value ? undefined : [] } : x,
                    ),
                  )
                }
              />
              <DeleteButton
                onClick={() =>
                  setList((list ?? []).filter((_, i) => i !== index))
                }
              />
            </Flex>
            {keys && (
              <KeyList
                keys={keys}
                setKeys={(ks) =>
                  setList(
                    list?.map((x, i) => (i === index ? { ...x, keys: ks } : x)),
                  )
                }
                allKeys={[...alphabet]}
              />
            )}
          </Flex>
        );
      })}
      <Button
        onClick={() => setList((list ?? []).concat(defaultConstraints[type]))}
      >
        添加约束
      </Button>
    </>
  );
};

const GroupConstraintList = () => {
  const listAtom = useMemo(
    () =>
      focusAtom(constraintsAtom, (o) =>
        o
          .valueOr({
            grouping: undefined,
          })
          .prop("grouping")
          .valueOr([] as GroupConstraint[][]),
      ),
    [],
  );

  const defaultGroup: GroupConstraint[] = [
    { element: "土", index: 0 },
    { element: "士", index: 0 },
  ];

  const [list, setList] = useAtom(listAtom);
  const updateListAt = (index: number, group: GroupConstraint[]) => {
    setList(list.map((x, i) => (i === index ? group : x)));
  };
  return (
    <>
      <Typography.Title level={3}>绑定约束</Typography.Title>
      {list.map((group, index) => {
        return (
          <Flex vertical key={index}>
            <Flex align="center" gap="small">
              将以下元素的码位绑定在一起：
              <PlusButton
                onClick={() =>
                  updateListAt(index, group.concat({ element: "1", index: 0 }))
                }
              />
              <MinusButton
                onClick={() =>
                  updateListAt(index, group.slice(0, group.length - 1))
                }
              />
              <DeleteButton
                onClick={() => setList(list.filter((_, i) => i !== index))}
              />
            </Flex>
            {group.map(({ element, index: idx }, subindex) => (
              <Space key={subindex}>
                <ElementSelect
                  excludeGrouped
                  char={element}
                  onChange={(value) =>
                    updateListAt(
                      index,
                      group.map((x, i) =>
                        i === subindex ? { ...x, element: value } : x,
                      ),
                    )
                  }
                />
                的
                <Select
                  style={{ width: "96px" }}
                  value={idx}
                  options={[0, 1, 2, 3].map((x) => ({
                    label: `第 ${x + 1} 码`,
                    value: x,
                  }))}
                  onChange={(value) =>
                    updateListAt(
                      index,
                      group.map((x, i) =>
                        i === subindex ? { ...x, index: value } : x,
                      ),
                    )
                  }
                />
              </Space>
            ))}
          </Flex>
        );
      })}
      <Button onClick={() => setList(list.concat([defaultGroup]))}>
        添加约束
      </Button>
    </>
  );
};

function LoadAssets() {
  const loadCF = useSetAtom(loadCFAtom);
  loadCF();
  const loadWF = useSetAtom(loadWFAtom);
  loadWF();
  const loadKE = useSetAtom(loadKEAtom);
  loadKE();
  const loadPE = useSetAtom(loadPEAtom);
  loadPE();
  return null;
}

const Optimization = () => {
  const [metaheuristic, setMetaheuristic] = useAtom(metaheuristicAtom);
  const [searchMethod, setSearchMethod] = useAtom(searchMethodAtom);
  const { algorithm, parameters, report_after } = metaheuristic;
  const auto = parameters === undefined;

  return (
    <EditorRow>
      <EditorColumn span={12}>
        <Typography.Title level={2}>优化目标</Typography.Title>
        <PartialObjective title="单字全码" type="characters_full" />
        <PartialObjective title="单字简码" type="characters_short" />
        <PartialObjective title="词语全码" type="words_full" />
        <PartialObjective title="词语简码" type="words_short" />
        <Typography.Title level={2}>优化方法</Typography.Title>
        <Flex vertical align="center">
          <Flex gap="large">
            <Form.Item label="算法">
              <Select<Solver["algorithm"]>
                value={algorithm}
                options={[{ label: "退火算法", value: "SimulatedAnnealing" }]}
                onChange={(value) =>
                  setMetaheuristic({
                    algorithm: value,
                    runtime: 10,
                  })
                }
              />
            </Form.Item>
            <Form.Item label="自动调参">
              <Checkbox
                checked={auto}
                onChange={(e) => {
                  const meta = e.target.checked
                    ? { ...metaheuristic, runtime: 10, parameters: undefined }
                    : {
                        ...metaheuristic,
                        parameters: {
                          t_max: 1.0,
                          t_min: 1.0e-6,
                          steps: 10000,
                        },
                        runtime: undefined,
                      };
                  setMetaheuristic(meta);
                }}
              />
            </Form.Item>
            <Form.Item label="保存进度">
              <InputNumber
                value={report_after ?? 0.9}
                onChange={(value) => {
                  setMetaheuristic({
                    ...metaheuristic,
                    report_after: value ?? 0,
                  });
                }}
              />
            </Form.Item>
          </Flex>
          <Flex gap="large">
            <Form.Item label="随机移动">
              <InputNumber
                value={searchMethod.random_move}
                onChange={(value) =>
                  setSearchMethod({ ...searchMethod, random_move: value ?? 0 })
                }
              />
            </Form.Item>
            <Form.Item label="随机交换">
              <InputNumber
                value={searchMethod.random_swap}
                onChange={(value) =>
                  setSearchMethod({ ...searchMethod, random_swap: value ?? 0 })
                }
              />
            </Form.Item>
          </Flex>
          <Flex gap="large">
            {auto ? (
              <Form.Item label="运行时间">
                <InputNumber
                  value={metaheuristic.runtime ?? 10}
                  onChange={(value) => {
                    setMetaheuristic({
                      ...metaheuristic,
                      runtime: value ?? undefined,
                    });
                  }}
                />
                分钟
              </Form.Item>
            ) : (
              <Parameters />
            )}
          </Flex>
        </Flex>
        <Typography.Title level={2}>优化约束</Typography.Title>
        <ConstraintList title="元素约束" type="elements" />
        <ConstraintList title="码位约束" type="indices" />
        <ConstraintList title="元素 + 码位约束" type="element_indices" />
        <GroupConstraintList />
      </EditorColumn>
      <EditorColumn span={12}>
        <Typography.Title level={2}>优化</Typography.Title>
        <Suspense fallback={<CustomSpin tip="加载数据" />}>
          <LoadAssets />
          <Evaluator />
        </Suspense>
      </EditorColumn>
    </EditorRow>
  );
};

export default Optimization;
