import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CameraOutlined,
} from "@ant-design/icons";
import type {
  ProFormInstance,
  ProFormListProps,
} from "@ant-design/pro-components";
import {
  ModalForm as _ModalForm,
  ProFormDependency,
  ProFormDigit,
  ProFormGroup,
  ProFormList,
  ProFormSelect,
} from "@ant-design/pro-components";
import type { FormListFieldData, MenuProps } from "antd";
import { Button, Dropdown, Flex, Form } from "antd";
import type { BaseOptionType } from "antd/es/select";
import type {
  全等数据,
  基本部件数据,
  源标签,
  矢量笔画数据,
  笔画名称,
  笔画数据,
  衍生部件数据,
} from "hanzi-chai";
import {
  图形盒子,
  type 字符,
  是基本或衍生部件,
  是部件,
  模拟引用笔画,
  模拟矢量笔画,
  笔画表示方式,
} from "hanzi-chai";
import type { MutableRefObject, ReactNode } from "react";
import { useRef } from "react";
import {
  useAtomValue,
  useAtomValueUnwrapped,
  原始字库原子,
  如字库原子,
} from "~/atoms";
import BorderItem from "./BorderItem";
import CharacterSelect from "./CharacterSelect";
import { CommonForm } from "./CompoundForm";
import { Box, StrokesView } from "./GlyphView";
import { EditorColumn, EditorRow } from "./Utils";

const Digit = ({ name }: { name: (string | number)[] }) => (
  <ProFormDigit width={56} name={name} fieldProps={{ min: -100 }} />
);

export const InlineRender = ({
  listDom,
  action,
}: {
  listDom: ReactNode;
  action: ReactNode;
}) => (
  <div className="inline-flex mr-2">
    {listDom}
    {action}
  </div>
);

export function StaticList<T>(props: ProFormListProps<T>) {
  return (
    <ProFormList
      {...props}
      copyIconProps={false}
      deleteIconProps={false}
      creatorButtonProps={false}
    >
      {props.children}
    </ProFormList>
  );
}

const strokeOptions = Object.keys(笔画表示方式).map((x) => ({
  key: x,
  value: x,
  label: x,
}));
const classifiedStrokeOptions: BaseOptionType[] = [
  { key: 0, label: "横竖", children: strokeOptions.slice(0, 4) },
  { key: 1, label: "撇点", children: strokeOptions.slice(4, 11) },
  { key: 2, label: "折类 I", children: strokeOptions.slice(11, 24) },
  { key: 3, label: "折类 II", children: strokeOptions.slice(24, 31) },
  { key: 4, label: "折类 III", children: strokeOptions.slice(31) },
];
const referenceOption: BaseOptionType = {
  label: "引用笔画",
  value: "reference",
};

const StrokeForm = ({
  maxIndex,
  formRef,
  meta,
}: {
  maxIndex?: number;
  formRef: MutableRefObject<ProFormInstance | undefined>;
  meta: FormListFieldData;
}) => {
  return (
    <>
      <ProFormGroup size="small">
        <ProFormSelect<笔画名称 | "reference">
          name="feature"
          options={[referenceOption].concat(classifiedStrokeOptions)}
          disabled
          allowClear={false}
          onChange={(value) => {
            const newStroke =
              value === "reference" ? 模拟引用笔画() : 模拟矢量笔画(value);
            formRef.current?.setFieldValue(["strokes", meta.name], newStroke);
          }}
        />
        <ProFormDependency name={["feature"]}>
          {({ feature }) =>
            feature === "reference" ? (
              <Flex gap="middle" justify="space-between">
                <ProFormSelect
                  name="index"
                  options={[...Array(maxIndex).keys()].map((x) => ({
                    label: x,
                    value: x,
                  }))}
                  allowClear={false}
                />
              </Flex>
            ) : (
              <ProFormGroup size="small">
                <Digit name={["start", 0]} />
                <Digit name={["start", 1]} />
              </ProFormGroup>
            )
          }
        </ProFormDependency>
      </ProFormGroup>
      <ProFormDependency name={["feature"]}>
        {({ feature }) =>
          feature !== "reference" ? (
            <StaticList name="curveList">
              <ProFormGroup key="group" size="small" className="pl-9">
                <ProFormSelect name="command" disabled className="min-w-16" />
                <ProFormDependency name={["command"]}>
                  {({ command }) =>
                    command === "c" || command === "z" ? (
                      <ProFormGroup size="small">
                        <Digit name={["parameterList", 0]} />
                        <Digit name={["parameterList", 1]} />
                        <Digit name={["parameterList", 2]} />
                        <Digit name={["parameterList", 3]} />
                        <Digit name={["parameterList", 4]} />
                        <Digit name={["parameterList", 5]} />
                      </ProFormGroup>
                    ) : (
                      <ProFormGroup size="small">
                        <Digit name={["parameterList", 0]} />
                      </ProFormGroup>
                    )
                  }
                </ProFormDependency>
              </ProFormGroup>
            </StaticList>
          ) : null
        }
      </ProFormDependency>
    </>
  );
};

type 基本或衍生部件 = 基本部件数据 | 衍生部件数据;

export default function ComponentForm({
  title,
  initialValues,
  current,
  onFinish,
  noButton,
  primary,
  readonly,
}: {
  title: ReactNode;
  initialValues: 基本或衍生部件;
  current: 字符;
  onFinish: (c: 基本或衍生部件) => Promise<boolean>;
  noButton?: boolean;
  primary?: boolean;
  readonly?: boolean;
}) {
  const 原始字库 = useAtomValue(原始字库原子);
  const 字库 = useAtomValueUnwrapped(如字库原子);
  const trigger = noButton ? (
    <span>{title}</span>
  ) : (
    <BorderItem type={primary ? "default" : "text"}>{title}</BorderItem>
  );
  const isValidSource = ([name]: [string, any]) => {
    let component: 基本或衍生部件 | undefined = 原始字库
      .校验(name)
      ?.glyphs.find(是基本或衍生部件);
    if (component === undefined) return false;
    while (component?.type === "derived_component") {
      const source: string = component.source;
      if (source === current.获取名称()) return false;
      component = 原始字库.校验(source)?.glyphs.find(是基本或衍生部件);
    }
    return true;
  };
  const formRef = useRef<ProFormInstance>(undefined);
  return (
    <_ModalForm<基本或衍生部件>
      className="component-form-modal"
      title={title}
      layout="horizontal"
      omitNil={true}
      trigger={trigger}
      initialValues={initialValues}
      onFinish={onFinish}
      readonly={readonly}
      submitter={readonly ? false : undefined}
      modalProps={{
        width: 1080,
      }}
      formRef={formRef}
    >
      <EditorRow>
        <EditorColumn span={10} className="p-0!">
          <Box>
            <ProFormDependency name={["type", "source", "strokes"]}>
              {(props) => {
                const component = props as 基本或衍生部件;
                let glyph = new 图形盒子();
                const rendered = 原始字库.渲染字形(
                  current,
                  {
                    ...component,
                    tags: new Set(["G" as 源标签]),
                    compat: false,
                  },
                  字库,
                );
                if (rendered.ok) {
                  const maybecomponent = rendered.value[0]!;
                  if (是部件(maybecomponent))
                    glyph = 图形盒子.从笔画列表构建(maybecomponent.矢量图形);
                }
                return (
                  <StrokesView
                    displayMode
                    glyph={glyph}
                    setGlyph={(g: 矢量笔画数据[]) => {
                      const projection = component.strokes.map((x, index) =>
                        x.feature === "reference" ? x : g[index]!,
                      );
                      formRef.current?.setFieldsValue({
                        strokes: projection,
                      });
                    }}
                  />
                );
              }}
            </ProFormDependency>
          </Box>
        </EditorColumn>
        <EditorColumn span={14}>
          <CommonForm />
          <ProFormDependency name={["type"]}>
            {({ type }) =>
              type === "derived_component" ? (
                <ProFormGroup>
                  <Form.Item name="source" label="源字">
                    <CharacterSelect
                      className="w-24"
                      customFilter={isValidSource}
                    />
                  </Form.Item>
                </ProFormGroup>
              ) : null
            }
          </ProFormDependency>
          <ProFormDependency name={["source"]}>
            {({ source }) => {
              const maxIndex =
                typeof source === "string"
                  ? (原始字库
                      .校验(source)
                      ?.glyphs.find(
                        (x) =>
                          x.type === "basic_component" ||
                          x.type === "derived_component",
                      )?.strokes.length ?? 10)
                  : 0;
              return (
                <>
                  <ProFormList
                    name="strokes"
                    creatorButtonProps={false}
                    actionRender={(field, action, defaultActionDom, count) => {
                      return [
                        ...defaultActionDom,
                        <ArrowUpOutlined
                          key="up_arrow"
                          className="ml-1"
                          onClick={() => {
                            if (field.name === 0) {
                              action.move(field.name, count - 1);
                            } else {
                              action.move(field.name, field.name - 1);
                            }
                          }}
                        />,
                        <ArrowDownOutlined
                          key="down_arrow"
                          className="ml-1"
                          onClick={() => {
                            if (field.name === count - 1) {
                              action.move(field.name, 0);
                            } else {
                              action.move(field.name, field.name + 1);
                            }
                          }}
                        />,
                        <CameraOutlined
                          key="camera"
                          className="ml-1"
                          onClick={() => {
                            const component: 基本或衍生部件 =
                              formRef.current?.getFieldsValue();
                            const rendered = 原始字库.渲染字形(
                              current,
                              {
                                ...component,
                                tags: new Set(["G" as 源标签]),
                                compat: false,
                              },
                              字库,
                            );
                            if (!rendered.ok) return;
                            const maybecomponent = rendered.value[0]!;
                            if (!是部件(maybecomponent)) return;
                            const strokes: 笔画数据[] =
                              formRef.current?.getFieldValue("strokes") ?? [];
                            const vectorized = structuredClone(
                              maybecomponent.矢量图形[field.name],
                            );
                            if (!vectorized) return;
                            strokes[field.name] = vectorized;
                            formRef.current?.setFieldValue("strokes", strokes);
                          }}
                        />,
                      ];
                    }}
                  >
                    {(meta) => (
                      <StrokeForm
                        maxIndex={maxIndex}
                        formRef={formRef}
                        meta={meta}
                      />
                    )}
                  </ProFormList>
                  <Flex justify="center" gap="middle">
                    <Dropdown
                      menu={{
                        items: classifiedStrokeOptions as MenuProps["items"],
                        onClick: (item) => {
                          const newStroke = 模拟矢量笔画(item.key as 笔画名称);
                          formRef.current?.setFieldValue(
                            "strokes",
                            formRef.current
                              ?.getFieldValue("strokes")
                              ?.concat(newStroke),
                          );
                        },
                      }}
                    >
                      <Button>添加笔画</Button>
                    </Dropdown>
                    <Button
                      disabled={typeof source !== "string"}
                      onClick={() =>
                        formRef.current?.setFieldValue(
                          "strokes",
                          formRef.current
                            ?.getFieldValue("strokes")
                            ?.concat(模拟引用笔画()),
                        )
                      }
                    >
                      添加笔画引用
                    </Button>
                    <Button
                      disabled={typeof source !== "string"}
                      onClick={() => {
                        const component: 衍生部件数据 =
                          formRef.current?.getFieldsValue();
                        const notReady = component.strokes.some(
                          (x) => x.feature === "reference",
                        );
                        if (notReady) {
                          alert("请先删除笔画引用");
                          return;
                        }
                        const newComponent: 基本部件数据 = {
                          type: "basic_component",
                          tags: component.tags,
                          strokes: component.strokes as 矢量笔画数据[],
                        };
                        formRef.current?.setFieldsValue(newComponent);
                      }}
                    >
                      转化为基本部件
                    </Button>
                    <Button
                      disabled={typeof source === "string"}
                      onClick={() => {
                        const component: 衍生部件数据 =
                          formRef.current?.getFieldsValue();
                        const newComponent: 衍生部件数据 = {
                          type: "derived_component",
                          source: "一",
                          tags: component.tags,
                          strokes: component.strokes,
                        };
                        formRef.current?.setFieldsValue(newComponent);
                      }}
                    >
                      转化为衍生部件
                    </Button>
                  </Flex>
                </>
              );
            }}
          </ProFormDependency>
        </EditorColumn>
      </EditorRow>
    </_ModalForm>
  );
}

export function IdentityForm({
  title,
  initialValues,
  current,
  onFinish,
  noButton,
  primary,
  readonly,
}: {
  title: ReactNode;
  initialValues: 全等数据;
  current: 字符;
  onFinish: (c: 全等数据) => Promise<boolean>;
  noButton?: boolean;
  primary?: boolean;
  readonly?: boolean;
}) {
  const trigger = noButton ? (
    <span>{title}</span>
  ) : (
    <BorderItem type={primary ? "default" : "text"}>{title}</BorderItem>
  );
  return (
    <_ModalForm<全等数据>
      className="component-form-modal"
      title={title}
      layout="horizontal"
      omitNil={true}
      trigger={trigger}
      initialValues={initialValues}
      onFinish={onFinish}
      readonly={readonly}
      submitter={readonly ? false : undefined}
    >
      <CommonForm />
      <ProFormGroup>
        <Form.Item name="source" label="源字">
          <CharacterSelect
            className="w-24"
            customFilter={([x]) => x !== current.获取名称()}
          />
        </Form.Item>
      </ProFormGroup>
    </_ModalForm>
  );
}
