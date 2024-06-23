import {
  Button,
  Flex,
  Form,
  Dropdown,
  notification,
  FormListFieldData,
} from "antd";
import { EditorColumn, EditorRow, NumberInput } from "./Utils";
import { MutableRefObject, ReactNode, useRef } from "react";
import type { PrimitiveCharacter, Component, Character } from "~/lib";
import type { Feature } from "~/lib";
import { getDummySVGStroke, schema } from "~/lib";
import { getDummyReferenceStroke, isComponent } from "~/lib";
import { allRepertoireAtom, useAtomValue } from "~/atoms";
import { GlyphSelect } from "./CharacterSelect";
import {
  ModalForm,
  ProFormDependency,
  ProFormDigit,
  ProFormGroup,
  ProFormInstance,
  ProFormList,
  ProFormListProps,
  ProFormSelect,
} from "@ant-design/pro-components";
import styled from "styled-components";
import { CommonForm } from "./CompoundForm";
import Root from "./Element";
import { recursiveRenderComponent } from "~/lib";
import { Box, StrokesView } from "./GlyphView";
import { BaseOptionType } from "antd/es/select";

const Digit = ({ name }: { name: (string | number)[] }) => (
  <ProFormDigit width={64} name={name} fieldProps={{ min: -100 }} />
);

const InlineFlex = styled.div`
  display: inline-flex;
  margin-right: 8px;
`;

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
  { key: 0, label: "基本", children: strokeOptions.slice(0, 10) },
  { key: 1, label: "折类 I", children: strokeOptions.slice(10, 23) },
  { key: 2, label: "折类 II", children: strokeOptions.slice(23, 30) },
  { key: 4, label: "折类 III", children: strokeOptions.slice(30) },
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
      <Flex gap="middle">
        <ProFormSelect<Feature | "reference">
          name="feature"
          style={{ width: "96px" }}
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
      </Flex>
      <ProFormDependency name={["feature"]}>
        {({ feature }) =>
          feature !== "reference" ? (
            <StaticList name="curveList">
              <ProFormGroup key="group">
                <ProFormSelect name="command" disabled />
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
  initialValues: Component;
  current: string;
  onFinish: (c: Component) => Promise<boolean>;
  noButton?: boolean;
  primary?: boolean;
  readonly?: boolean;
}) {
  const repertoire = useAtomValue(allRepertoireAtom);
  const trigger = noButton ? (
    <span>{title}</span>
  ) : (
    <Root type={primary ? "default" : "text"}>{title}</Root>
  );
  const isValidSource = ([name, _]: [string, Character]) => {
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
    <ModalForm<Component>
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
        <EditorColumn span={8}>
          <Box>
            <ProFormDependency name={["type", "source", "strokes"]}>
              {(props) => {
                const component = props as Component;
                const rendered =
                  component?.type !== undefined
                    ? recursiveRenderComponent(component, repertoire)
                    : new Error();
                return (
                  <StrokesView
                    glyph={rendered instanceof Error ? [] : rendered}
                  />
                );
              }}
            </ProFormDependency>
          </Box>
        </EditorColumn>
        <EditorColumn span={16}>
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
                  ? repertoire[source]?.glyphs.find(isComponent)?.strokes
                      .length ?? 0
                  : 0;
              return (
                <ProFormList
                  name="strokes"
                  creatorButtonProps={{ creatorButtonText: "添加笔画" }}
                  creatorRecord={
                    typeof source === "string"
                      ? getDummyReferenceStroke()
                      : getDummySVGStroke("横")
                  }
                >
                  {(meta, index) => {
                    return (
                      <StrokeForm
                        maxIndex={maxIndex}
                        formRef={formRef}
                        meta={meta}
                      />
                    );
                  }}
                </ProFormList>
              );
            }}
          </ProFormDependency>
        </EditorColumn>
      </EditorRow>
    </ModalForm>
  );
}
