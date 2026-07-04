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
  ModalForm,
  ProFormDependency,
  ProFormDigit,
  ProFormGroup,
  ProFormItem,
  ProFormList,
  ProFormSelect,
} from "@ant-design/pro-components";
import type { FormListFieldData, MenuProps } from "antd";
import { Button, Dropdown, Flex, Form, Typography } from "antd";
import type { BaseOptionType } from "antd/es/select";
import type { 字形数据, 引用数据, 笔画名称 } from "hanzi-chai";
import { 模拟矢量笔画, 笔画表示方式 } from "hanzi-chai";
import type { MutableRefObject, ReactNode } from "react";
import { useRef } from "react";
import { 数字 } from "~/utils";
import GlyphSelect from "./GlyphSelect";
import { Box } from "./GlyphView";
import OperatorSelect from "./OperatorSelect";
import { EditorColumn, EditorRow } from "./Utils";

const Digit = ({ name }: { name: (string | number)[] }) => (
  <ProFormDigit width={56} name={name} fieldProps={{ min: -100, max: 100 }} />
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

function StaticList<T>(props: ProFormListProps<T>) {
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

const StrokeForm = ({
  references,
  maxIndex,
  formRef,
  meta,
}: {
  references?: 引用数据[];
  maxIndex?: number;
  formRef: MutableRefObject<ProFormInstance | undefined>;
  meta: FormListFieldData;
}) => {
  const referenceOptions: BaseOptionType[] = (references ?? []).map((x) => ({
    key: x.id,
    value: x.id,
    label: `引用第${数字(x.id + 1)}部`,
  }));
  return (
    <ProFormDependency name={["feature"]}>
      {({ feature }) =>
        feature !== undefined ? (
          <>
            <ProFormGroup size="small">
              <ProFormSelect<笔画名称>
                name="feature"
                options={classifiedStrokeOptions}
                disabled
                allowClear={false}
                onChange={(value) => {
                  const newStroke = 模拟矢量笔画(value);
                  formRef.current?.setFieldValue(
                    ["strokes", meta.name],
                    newStroke,
                  );
                }}
              />
              <Digit name={["start", 0]} />
              <Digit name={["start", 1]} />
            </ProFormGroup>
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
          </>
        ) : (
          <Flex gap="middle" justify="space-between">
            <ProFormSelect
              name="index"
              label="引用"
              options={referenceOptions}
              allowClear={false}
            />
            <ProFormSelect
              name="from"
              label="从"
              options={[...Array(maxIndex).keys()].map((x) => ({
                label: `第${数字(x + 1)}笔`,
                value: x,
              }))}
              allowClear={false}
            />
            <ProFormSelect
              name="to"
              label="到"
              options={[...Array(maxIndex).keys()].map((x) => ({
                label: `第${数字(x + 1)}笔`,
                value: x,
              }))}
              allowClear={false}
            />
          </Flex>
        )
      }
    </ProFormDependency>
  );
};

export default function GlyphForm({
  title,
  initialValues,
  onFinish,
  readonly,
}: {
  title: ReactNode;
  initialValues: 字形数据;
  onFinish: (c: 字形数据) => Promise<boolean>;
  readonly?: boolean;
}) {
  const trigger = <Button>{title}</Button>;
  const formRef = useRef<ProFormInstance>(undefined);
  const current: 字形数据 | undefined = formRef.current?.getFieldsValue();
  return (
    <ModalForm<字形数据>
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
          <Box>{JSON.stringify(current)}</Box>
        </EditorColumn>
        <EditorColumn span={14}>
          <Flex align="flex-start" gap="large">
            <ProFormDigit name="id" label="id" readonly />
            <ProFormDigit name="gf0014_id" label="GF0014" readonly />
            <ProFormDigit name="gf3001_id" label="GF3001" readonly />
            <ProFormSelect
              label="类型"
              name="type"
              options={[
                { label: "部件", value: "component" },
                { label: "复合体", value: "compound" },
              ]}
              disabled
              className="w-16"
            />
            <ProFormItem label="结构" name="operator" className="w-24">
              <OperatorSelect />
            </ProFormItem>
          </Flex>
          <Typography.Title level={5}>引用</Typography.Title>
          <ProFormList name="references" alwaysShowItemLabel>
            <ProFormGroup size="small">
              <ProFormItem name="id">
                <GlyphSelect />
              </ProFormItem>
              <ProFormDigit name="xbegin" label="x0" width={56} />
              <ProFormDigit name="ybegin" label="y0" width={56} />
              <ProFormDigit name="xend" label="x1" width={56} />
              <ProFormDigit name="yend" label="y1" width={56} />
            </ProFormGroup>
          </ProFormList>
          <Typography.Title level={5}>笔画</Typography.Title>
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
                  onClick={() => {}}
                />,
              ];
            }}
          >
            {(meta) => (
              <StrokeForm maxIndex={10} formRef={formRef} meta={meta} />
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
            <Dropdown
              menu={{
                items: (initialValues.references ?? []).map((x) => ({
                  key: x.id,
                  label: `引用 ${x.id}`,
                })) as MenuProps["items"],
                onClick: (item) => {
                  formRef.current?.setFieldValue(
                    "strokes",
                    formRef.current?.getFieldValue("strokes")?.concat(),
                  );
                },
              }}
            ></Dropdown>
            <Button>添加笔画引用</Button>
          </Flex>
        </EditorColumn>
      </EditorRow>
    </ModalForm>
  );
}
