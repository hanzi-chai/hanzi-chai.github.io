import type { FormListFieldData, MenuProps } from "antd";
import {
  Button,
  Flex,
  Form,
  Input,
  Typography,
  Switch,
  Dropdown,
  notification,
} from "antd";
import {
  DeleteButton,
  EditorColumn,
  EditorRow,
  NumberInput,
  Select,
  errorFeedback,
} from "./Utils";
import { ReactNode, createContext, useContext } from "react";
import type {
  Component,
  CompoundGlyph,
  Glyph,
  Operator,
  SVGGlyph,
  SVGStroke,
  Stroke,
} from "~/lib/data";
import { operators } from "~/lib/data";
import type { Feature } from "~/lib/classifier";
import classifier, { schema } from "~/lib/classifier";
import { formDefault, getDummyPartition, getDummyStroke } from "~/lib/utils";
import type { FormInstance } from "antd/es/form/Form";
import { useWatch } from "antd/es/form/Form";
import {
  customFormAtom,
  formCustomizationAtom,
  updateFormAtom,
  useAddAtom,
  useAtomValue,
  useSetAtom,
} from "~/atoms";
import { recursiveRenderGlyph } from "~/lib/component";
import { GlyphSelect } from "./GlyphSelect";
import {
  ModalForm,
  ProFormCheckbox,
  ProFormDependency,
  ProFormDigit,
  ProFormGroup,
  ProFormList,
  ProFormListProps,
  ProFormRadio,
  ProFormSelect,
  ProFormText,
} from "@ant-design/pro-components";
import { RemoteContext } from "./Action";
import GlyphView from "./GlyphView";
import { remoteUpdate } from "~/lib/api";
import styled from "styled-components";

export const ModelContext = createContext({} as FormInstance<Glyph>);

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

interface ListItemWithRemove {
  info: FormListFieldData;
  remove: () => void;
}

const StrokeForm = ({ info, remove }: ListItemWithRemove) => {
  const { key, name, ...rest } = info;
  const form = useContext(ModelContext);
  const formData = useAtomValue(customFormAtom);
  return (
    <ProFormDependency name={["component"]}>
      {(props) => {
        const component = props.component as Component;
        const source = component.source!;
        const length = formData[source]?.component?.strokes.length;
        const value = component.strokes[name]!;
        return typeof value === "object" ? (
          <>
            <Flex gap="middle">
              <ProFormSelect<Feature>
                {...rest}
                name={[name, "feature"]}
                style={{ width: "96px" }}
                options={Object.keys(classifier).map((x) => ({
                  label: x,
                  value: x,
                }))}
                onChange={(value) => {
                  const oldStroke = form.getFieldValue([
                    "component",
                    "strokes",
                    name,
                  ]) as SVGStroke;
                  const newStroke = getDummyStroke(
                    value,
                    oldStroke.start,
                    oldStroke.curveList,
                  );
                  form.setFieldValue(["component", "strokes", name], newStroke);
                }}
              />
              <Flex gap="small">
                <Form.List name={[name, "start"]}>
                  {(fields) => (
                    <>
                      {fields.map((field) => (
                        <Form.Item {...field} key={field.key}>
                          <NumberInput />
                        </Form.Item>
                      ))}
                    </>
                  )}
                </Form.List>
              </Flex>
              <div style={{ flex: 1 }}></div>
              <Form.Item>
                <Button
                  onClick={() => {
                    form.setFieldValue(["component", "strokes", name], 0);
                  }}
                  disabled={source === undefined}
                >
                  更改为引用
                </Button>
              </Form.Item>
              <Form.Item>
                <DeleteButton onClick={remove} />
              </Form.Item>
            </Flex>
            <StaticList name={[name, "curveList"]}>
              <ProFormGroup key="group">
                <ProFormSelect {...rest} name="command" disabled />
                <StaticList name="parameterList" itemRender={InlineRender}>
                  {(meta) => (
                    <Form.Item noStyle {...meta}>
                      <NumberInput />
                    </Form.Item>
                  )}
                </StaticList>
              </ProFormGroup>
            </StaticList>
          </>
        ) : (
          <Flex gap="middle" justify="space-between">
            <ProFormSelect
              name={[name]}
              options={[...Array(length).keys()].map((x) => ({
                label: x,
                value: x,
              }))}
            />
            <div style={{ flex: 1 }}></div>
            <Form.Item>
              <Button
                onClick={() => {
                  let sourceGlyph: SVGGlyph | Error;
                  try {
                    sourceGlyph = recursiveRenderGlyph(source, formData);
                  } catch {
                    sourceGlyph = new Error();
                  }
                  if (sourceGlyph instanceof Error) {
                    notification.error({
                      message: "无法渲染 SVG 笔画，请检查输入",
                    });
                    return;
                  }
                  form.setFieldValue(
                    ["component", "strokes", name],
                    sourceGlyph[value]!,
                  );
                }}
              >
                更改为 SVG 笔画
              </Button>
            </Form.Item>
            <Form.Item>
              <DeleteButton onClick={remove} />
            </Form.Item>
          </Flex>
        );
      }}
    </ProFormDependency>
  );
};

const strokeOptions = Object.keys(schema).map((x) => ({
  key: x,
  value: x,
  label: x,
}));
const classifiedStrokeOptions = [
  { key: 0, label: "基本", children: strokeOptions.slice(0, 7) },
  { key: 1, label: "折类 I", children: strokeOptions.slice(7, 13) },
  { key: 2, label: "折类 II", children: strokeOptions.slice(13, 20) },
  { key: 3, label: "折类 III", children: strokeOptions.slice(20, 27) },
  { key: 4, label: "折类 IV", children: strokeOptions.slice(27) },
];

const ComponentForm = () => {
  const form = useContext(ModelContext);
  const current = String.fromCodePoint(form.getFieldValue(["unicode"]) ?? 0x20);
  const strokes = Form.useWatch(["component", "strokes"], form) as Stroke[];
  const source = Form.useWatch(["component", "source"], form) as
    | string
    | undefined;
  const formData = useAtomValue(customFormAtom);
  const parent = source !== undefined ? formData[source] : undefined;
  const parentLength = parent?.component?.strokes.length ?? 0;
  return (
    <ProFormDependency<Glyph> name={["component"]}>
      {({ component }) => {
        if (component === undefined) {
          return null;
        }
        return (
          <>
            <Flex gap="middle">
              <Form.Item
                name={["component", "source"]}
                label="源字"
                shouldUpdate
              >
                <GlyphSelect
                  customFilter={([char, glyph]) => {
                    if (glyph.component === undefined) return false;
                    let pointer: string | undefined = char;
                    while (pointer != undefined) {
                      if (pointer === current) return false;
                      let component: Component | undefined =
                        formData[pointer]?.component;
                      if (component === undefined) break;
                      pointer = component.source;
                    }
                    return true;
                  }}
                />
              </Form.Item>
              <Form.Item shouldUpdate>
                <Button
                  onClick={() =>
                    form.setFieldValue(["component", "source"], undefined)
                  }
                  disabled={strokes?.some((x) => typeof x === "number")}
                >
                  清除
                </Button>
              </Form.Item>
            </Flex>
            <Form.List name={["component", "strokes"]}>
              {(fields, { add, remove }) => (
                <>
                  {fields.map((info, index) => (
                    <StrokeForm
                      info={info}
                      remove={() => remove(index)}
                      key={info.key}
                    />
                  ))}
                  <Flex gap="middle" justify="center">
                    <Form.Item>
                      <Dropdown
                        menu={{
                          items: classifiedStrokeOptions,
                          onClick: (info) => {
                            add(getDummyStroke(info.key as Feature));
                          },
                        }}
                      >
                        <Button type="dashed">添加笔画</Button>
                      </Dropdown>
                    </Form.Item>
                    <Form.Item>
                      <Dropdown
                        disabled={parent === undefined}
                        menu={{
                          items: [...Array(parentLength).keys()].map((x) => ({
                            key: x.toString(),
                            label: x.toString(),
                          })),
                          onClick: (info) => {
                            add(Number(info.key));
                          },
                        }}
                      >
                        <Button type="dashed">添加笔画引用</Button>
                      </Dropdown>
                    </Form.Item>
                  </Flex>
                </>
              )}
            </Form.List>
          </>
        );
      }}
    </ProFormDependency>
  );
};

const PartitionModel = ({ info, remove }: ListItemWithRemove) => {
  const { key, name, ...rest } = info;
  const form = useContext(ModelContext);
  const list = useWatch(["compound", info.name, "operandList"], form);
  const parts = list?.length as 2 | 3;
  return (
    <>
      <Typography.Title level={3}>分部方式 {name + 1}</Typography.Title>
      <Flex gap="0px 8px" wrap="wrap">
        <ProFormSelect
          label="结构"
          name={[info.name, "operator"]}
          onChange={(value) => {
            const newLength = value === "⿲" || value === "⿳" ? 3 : 2;
            const newList = list.concat("一").slice(0, newLength);
            form.setFieldValue(["compound", info.name, "operandList"], newList);
          }}
          options={operators.map((x) => ({ value: x, label: x }))}
          style={{ width: "96px" }}
        ></ProFormSelect>
        <StaticList name={[info.name, "operandList"]} itemRender={InlineRender}>
          {(meta, i) => (
            <Form.Item noStyle {...meta}>
              <GlyphSelect style={{ width: "96px" }} />
            </Form.Item>
          )}
        </StaticList>
        <Form.Item>
          <DeleteButton onClick={remove} />
        </Form.Item>
      </Flex>
      <ProFormList
        label="标签"
        name={[info.name, "tags"]}
        itemRender={InlineRender}
        copyIconProps={false}
        creatorRecord={() => ({ toString: () => "形声" })}
      >
        {(meta) => (
          <Form.Item noStyle {...meta}>
            <Input style={{ width: "96px" }} />
          </Form.Item>
        )}
      </ProFormList>
      <ProFormList
        label="笔顺"
        name={[info.name, "order"]}
        copyIconProps={false}
        creatorRecord={{ index: 0, strokes: 0 }}
      >
        <ProFormGroup>
          <ProFormSelect
            name="index"
            options={[...Array(parts).keys()].map((x) => ({
              value: x,
              label: `第 ${x + 1} 部`,
            }))}
          />
          <ProFormSelect
            name="strokes"
            options={[...Array(10).keys()].map((x) => ({
              value: x,
              label: x === 0 ? "取剩余全部" : `取 ${x} 笔`,
            }))}
          />
        </ProFormGroup>
      </ProFormList>
    </>
  );
};

const CompoundForm = () => {
  const items: MenuProps["items"] = operators.map((x) => ({
    label: x,
    key: x,
  }));
  return (
    <Form.List name="compound">
      {(fields, { add, remove }) => (
        <>
          {fields.map((info, index) => (
            <PartitionModel
              key={info.key}
              info={info}
              remove={() => remove(index)}
            />
          ))}
          <Form.Item>
            <Dropdown
              menu={{
                items,
                onClick: (info) => {
                  add(getDummyPartition(info.key as Operator));
                },
              }}
            >
              <Button type="dashed">添加分部方式</Button>
            </Dropdown>
          </Form.Item>
        </>
      )}
    </Form.List>
  );
};

const BasicForm = () => {
  const form = useContext(ModelContext);
  const hasComponent = useWatch("component", form) !== undefined;
  const hasCompound = useWatch("compound", form) !== undefined;
  const options = [
    { label: "部件", value: "component", disabled: !hasComponent },
    { label: "复合体", value: "compound", disabled: !hasCompound },
  ];
  return (
    <>
      <Typography.Title level={2}>基本信息</Typography.Title>
      <ProFormGroup>
        <ProFormDigit label="Unicode" name="unicode" disabled width="xs" />
        <ProFormText label="名称" name="name" width="xs" />
        <ProFormCheckbox label="歧义" name="ambiguous" disabled />
        <ProFormDigit
          label="GF0014 序号"
          name="gf0014_id"
          disabled
          rules={[{ type: "integer", min: 1, max: 514 }]}
          width="xs"
        />
        <ProFormRadio.Group
          label="类型"
          name="default_type"
          options={options}
        />
      </ProFormGroup>
    </>
  );
};

interface SwitcherProps {
  name: string;
  formName: "component" | "compound";
}

const Switcher = ({ name, formName }: SwitcherProps) => {
  const form = useContext(ModelContext);
  const thisStatus = useWatch(formName, form) !== undefined;
  const hasComponent = useWatch("component", form) !== undefined;
  const hasCompound = useWatch("compound", form) !== undefined;
  const last = Number(hasComponent) + Number(hasCompound) === 1;
  return (
    <Flex justify="space-between" align="baseline">
      <Typography.Title level={2}>{name}数据</Typography.Title>
      <Switch
        checked={thisStatus}
        disabled={last && thisStatus}
        onChange={(value) => {
          form.setFieldValue(
            formName,
            value ? formDefault[formName] : undefined,
          );
        }}
      />
    </Flex>
  );
};

export const defaultGlyph: CompoundGlyph = {
  unicode: 0,
  name: null,
  gf0014_id: null,
  default_type: "compound",
  component: undefined,
  compound: [],
  ambiguous: false,
};

const GlyphModel = ({
  open,
  setOpen,
  form,
}: {
  open: boolean;
  setOpen: (o: boolean) => void;
  form: FormInstance<Glyph>;
}) => {
  const remote = useContext(RemoteContext);
  const add = useAddAtom(formCustomizationAtom);
  const updateForm = useSetAtom(updateFormAtom);
  return (
    <ModalForm<Glyph>
      form={form}
      layout="horizontal"
      open={open}
      onOpenChange={setOpen}
      onFinish={async (values) => {
        if (remote) {
          // 管理模式
          const res = await remoteUpdate(values);
          if (!errorFeedback(res)) {
            updateForm(values);
          }
        } else {
          // 用户模式
          add(String.fromCodePoint(values.unicode), values);
        }
      }}
      width="90%"
    >
      <ModelContext.Provider value={form}>
        <EditorRow>
          <EditorColumn span={8}>
            <BasicForm />
            <Typography.Title level={2}>预览</Typography.Title>
            <GlyphView form={form} />
          </EditorColumn>
          <EditorColumn span={16}>
            <Switcher name="部件" formName="component" />
            <ComponentForm />
            <Switcher name="复合体" formName="compound" />
            <CompoundForm />
          </EditorColumn>
        </EditorRow>
      </ModelContext.Provider>
    </ModalForm>
  );
};

export { GlyphModel, BasicForm, StrokeForm, ComponentForm, CompoundForm };
