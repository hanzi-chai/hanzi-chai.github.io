import type { FormListFieldData, MenuProps } from "antd";
import { Button, Dropdown, Flex, Form } from "antd";
import { EditorColumn, EditorRow } from "./Utils";
import type { MutableRefObject, ReactNode } from "react";
import { useRef } from "react";
import type {
  BasicComponent,
  Character,
  Component,
  DerivedComponent,
  SplicedComponent,
  Stroke,
  SVGGlyphWithBox,
  SVGStroke,
} from "~/lib";
import type { Feature } from "~/lib";
import { getDummySVGStroke, getGlyphBoundingBox, schema } from "~/lib";
import { getDummyReferenceStroke, isComponent } from "~/lib";
import { allRepertoireAtom, useAtomValue } from "~/atoms";
import { GlyphSelect } from "./CharacterSelect";
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
import styled from "styled-components";
import { CommonForm } from "./CompoundForm";
import Element from "./Element";
import { recursiveRenderComponent } from "~/lib";
import { Box, StrokesView } from "./GlyphView";
import type { BaseOptionType } from "antd/es/select";
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CameraOutlined,
} from "@ant-design/icons";

const Digit = ({ name }: { name: (string | number)[] }) => (
  <ProFormDigit width={56} name={name} fieldProps={{ min: -100 }} />
);

const InlineFlex = styled.div`
  display: inline-flex;
  margin-right: 8px;
`;

const ModalForm = styled(_ModalForm)`
  & .ant-pro-form-list-action {
    margin: 0;
  }

  & .ant-pro-form-list-item {
    justify-content: space-between !important;
    align-items: center !important;
  }

  & .ant-form-item {
    margin-bottom: 8px;
  }

  & .ant-pro-form-list > .ant-form-item {
    margin-bottom: 0;
  }
` as typeof _ModalForm;

export const InlineRender = ({
  listDom,
  action,
}: {
  listDom: ReactNode;
  action: ReactNode;
}) => (
  <InlineFlex>
    {listDom}
    {action}
  </InlineFlex>
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

const strokeOptions = Object.keys(schema).map((x) => ({
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
        <ProFormSelect<Feature | "reference">
          name="feature"
          options={[referenceOption].concat(classifiedStrokeOptions)}
          disabled
          allowClear={false}
          onChange={(value) => {
            const newStroke =
              value === "reference"
                ? getDummyReferenceStroke()
                : getDummySVGStroke(value);
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
              <ProFormGroup
                key="group"
                size="small"
                style={{ paddingLeft: 36 }}
              >
                <ProFormSelect
                  name="command"
                  disabled
                  style={{ minWidth: 64 }}
                />
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

type BasicOrDerivedComponent = Exclude<Component, SplicedComponent>;

export default function ComponentForm({
  title,
  initialValues,
  current,
  onFinish,
  noButton,
  primary,
  readonly,
}: {
  title: string;
  initialValues: BasicOrDerivedComponent;
  current: string;
  onFinish: (c: BasicOrDerivedComponent) => Promise<boolean>;
  noButton?: boolean;
  primary?: boolean;
  readonly?: boolean;
}) {
  const repertoire = useAtomValue(allRepertoireAtom);
  const trigger = noButton ? (
    <span>{title}</span>
  ) : (
    <Element type={primary ? "default" : "text"}>{title}</Element>
  );
  const isValidSource = ([name]: [string, Character]) => {
    let component: Component | undefined =
      repertoire[name]?.glyphs.find(isComponent);
    if (component === undefined) return false;
    while (component?.type === "derived_component") {
      const source: string = component.source;
      if (source === current) return false;
      component = repertoire[source]?.glyphs.find(isComponent);
    }
    return true;
  };
  const formRef = useRef<ProFormInstance>();
  return (
    <ModalForm<BasicOrDerivedComponent>
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
        <EditorColumn span={10} style={{ padding: 0 }}>
          <Box>
            <ProFormDependency name={["type", "source", "strokes"]}>
              {(props) => {
                const component = props as BasicOrDerivedComponent;
                const rendered =
                  component?.type !== undefined
                    ? recursiveRenderComponent(component, repertoire)
                    : new Error();
                const defaultGlyph: SVGGlyphWithBox = {
                  strokes: [],
                  box: { x: [0, 100], y: [0, 100] },
                };
                return (
                  <StrokesView
                    displayMode
                    glyph={
                      rendered instanceof Error
                        ? defaultGlyph
                        : {
                            strokes: rendered,
                            box: getGlyphBoundingBox(rendered),
                          }
                    }
                    setGlyph={(g: SVGStroke[]) => {
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
                    <GlyphSelect
                      style={{ width: "96px" }}
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
                  ? (repertoire[source]?.glyphs.find(
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
                          style={{ marginLeft: "5px" }}
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
                          style={{ marginLeft: "5px" }}
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
                          style={{ marginLeft: "5px" }}
                          onClick={() => {
                            const component = formRef.current?.getFieldsValue();
                            const rendered =
                              component?.type !== undefined
                                ? recursiveRenderComponent(
                                    component,
                                    repertoire,
                                  )
                                : new Error();
                            if (rendered instanceof Error) return;
                            const strokes: Stroke[] =
                              formRef.current?.getFieldValue("strokes") ?? [];
                            const vectorized = structuredClone(
                              rendered[field.name],
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
                          const newStroke = getDummySVGStroke(
                            item.key as Feature,
                          );
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
                            ?.concat(getDummyReferenceStroke()),
                        )
                      }
                    >
                      添加笔画引用
                    </Button>
                    <Button
                      disabled={typeof source !== "string"}
                      onClick={() => {
                        const component: DerivedComponent =
                          formRef.current?.getFieldsValue();
                        const notReady = component.strokes.some(
                          (x) => x.feature === "reference",
                        );
                        if (notReady) {
                          alert("请先删除笔画引用");
                          return;
                        }
                        const newComponent: BasicComponent = {
                          type: "basic_component",
                          tags: component.tags,
                          strokes: component.strokes as SVGStroke[],
                        };
                        formRef.current?.setFieldsValue(newComponent);
                      }}
                    >
                      转化为基本部件
                    </Button>
                    <Button
                      disabled={typeof source === "string"}
                      onClick={() => {
                        const component: BasicComponent =
                          formRef.current?.getFieldsValue();
                        const newComponent: DerivedComponent = {
                          type: "derived_component",
                          source: "一",
                          tags: component.tags,
                          strokes: component.strokes as SVGStroke[],
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
    </ModalForm>
  );
}
