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
  AutoComplete,
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
  Character,
  Component,
  Operator,
  RenderedComponent,
  SVGGlyph,
  SVGStroke,
  Stroke,
} from "~/lib/data";
import { operators } from "~/lib/data";
import type { Feature } from "~/lib/classifier";
import classifier, { schema } from "~/lib/classifier";
import {
  getDummyComponent,
  getDummyPartition,
  getDummyStroke,
} from "~/lib/utils";
import type { FormInstance } from "antd/es/form/Form";
import { useWatch } from "antd/es/form/Form";
import {
  allRepertoireAtom,
  determinedRepertoireAtom,
  repertoireAtom,
  tagsAtom,
  useAddAtom,
  useAtomValue,
  useSetAtom,
  userRepertoireAtom,
} from "~/atoms";
import { recursiveRenderGlyph } from "~/lib/component";
import { GlyphSelect } from "./CharacterSelect";
import {
  ModalForm,
  ProFormCheckbox,
  ProFormDependency,
  ProFormDigit,
  ProFormGroup,
  ProFormItem,
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

export const ModelContext = createContext({} as FormInstance<Character>);

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

const StrokeForm = ({
  info,
  remove,
  glyphIndex,
}: ListItemWithRemove & { glyphIndex: number }) => {
  const { name } = info;
  const form = useContext(ModelContext);
  const repertoire = useAtomValue(allRepertoireAtom);
  return (
    <ProFormDependency name={[["glyphs", glyphIndex]]}>
      {({ glyphs }) => {
        const component = glyphs[glyphIndex] as Component;
        const source = component.source;
        let length: number | undefined = undefined;
        if (component.source) {
          const sourceCharacter = repertoire[component.source];
          if (sourceCharacter !== undefined) {
            const sourceComponent = sourceCharacter.glyphs.find(
              (x) => x.type === "component",
            ) as Component | undefined;
            length = sourceComponent?.strokes.length ?? 0;
          } else {
            length = 0;
          }
        }
        const value = component.strokes[name]!;
        return typeof value === "object" ? (
          <>
            <Flex gap="middle">
              <ProFormSelect<Feature>
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
                    form.setFieldValue(
                      ["glyphs", glyphIndex, "strokes", name],
                      0,
                    );
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
                <ProFormSelect name="command" disabled />
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
                  // let sourceGlyph: SVGGlyph | Error;
                  // try {
                  //   sourceGlyph = recursiveRenderGlyph(source, formData);
                  // } catch {
                  //   sourceGlyph = new Error();
                  // }
                  // if (sourceGlyph instanceof Error) {
                  //   notification.error({
                  //     message: "无法渲染 SVG 笔画，请检查输入",
                  //   });
                  //   return;
                  // }
                  // form.setFieldValue(
                  //   ["component", "strokes", name],
                  //   sourceGlyph[value]!
                  // );
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

const ComponentForm = ({ glyphIndex }: { glyphIndex: number }) => {
  const model = useContext(ModelContext);
  const current = String.fromCodePoint(
    model.getFieldValue(["unicode"]) ?? 0x20,
  );
  const strokes = Form.useWatch(
    ["glyphs", glyphIndex, "strokes"],
    model,
  ) as Stroke[];
  const source = Form.useWatch(["glyphs", glyphIndex, "source"], model) as
    | string
    | undefined;
  const repertoire = useAtomValue(determinedRepertoireAtom);
  const parent = source !== undefined ? repertoire[source] : undefined;
  const parentLength =
    (parent?.glyph as RenderedComponent)?.strokes.length ?? 0;
  return (
    <Form.List name={[glyphIndex, "strokes"]}>
      {(fields, { add, remove }) => (
        <>
          <Flex gap="middle">
            <Form.Item name={[glyphIndex, "source"]} label="源字" shouldUpdate>
              <GlyphSelect
                customFilter={([name, character]) => {
                  if (character.glyph?.type !== "component") return false;
                  let pointer: string | undefined = name;
                  while (pointer != undefined) {
                    if (pointer === current) return false;
                    let component = repertoire[pointer]?.glyph as
                      | Component
                      | undefined;
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
                  model.setFieldValue(
                    ["glyphs", glyphIndex, "source"],
                    undefined,
                  )
                }
                disabled={strokes?.some((x) => typeof x === "number")}
              >
                清除
              </Button>
            </Form.Item>
            <div style={{ flex: 1 }}></div>
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
          {fields.map((info, index) => (
            <StrokeForm
              info={info}
              remove={() => remove(index)}
              key={info.key}
              glyphIndex={glyphIndex}
            />
          ))}
        </>
      )}
    </Form.List>
  );
};

const CompoundForm = ({ glyphIndex }: { glyphIndex: number }) => {
  const form = useContext(ModelContext);
  const list: string[] = form.getFieldValue([
    "glyphs",
    glyphIndex,
    "operandList",
  ]);
  return (
    <>
      <Flex gap="0px 8px" wrap="wrap">
        <ProFormSelect
          label="结构"
          name={[glyphIndex, "operator"]}
          onChange={(value) => {
            const newLength = value === "⿲" || value === "⿳" ? 3 : 2;
            const newList = list.concat("一").slice(0, newLength);
            form.setFieldValue(["glyphs", glyphIndex, "operandList"], newList);
          }}
          options={operators.map((x) => ({ value: x, label: x }))}
          style={{ width: "96px" }}
        ></ProFormSelect>
        <StaticList
          name={[glyphIndex, "operandList"]}
          itemRender={InlineRender}
        >
          {(meta, i) => (
            <Form.Item noStyle {...meta}>
              <GlyphSelect style={{ width: "96px" }} />
            </Form.Item>
          )}
        </StaticList>
      </Flex>
      <ProFormList
        label="笔顺"
        name={[glyphIndex, "order"]}
        copyIconProps={false}
        creatorRecord={{ index: 0, strokes: 0 }}
      >
        <ProFormGroup>
          <ProFormSelect
            name="index"
            options={list.map((_, x) => ({
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

const GlyphForm = ({ info, remove }: ListItemWithRemove) => {
  const { name: glyphIndex } = info;
  const tags = useAtomValue(tagsAtom);
  return (
    <>
      <Flex align="flex-start" gap="large">
        <Typography.Title level={3} style={{ marginTop: 0 }}>
          表示 {glyphIndex + 1}
        </Typography.Title>
        <ProFormSelect
          label="类型"
          name={[glyphIndex, "type"]}
          options={[
            { label: "部件", value: "component" },
            { label: "复合体", value: "compound" },
          ]}
          disabled
        />
        <ProFormList
          label="标签"
          name={[glyphIndex, "tags"]}
          itemRender={InlineRender}
          copyIconProps={false}
          creatorRecord={() => ({ toString: () => "形声" })}
        >
          {(meta) => (
            <Form.Item noStyle {...meta}>
              <AutoComplete
                style={{ width: "96px" }}
                options={tags.map((x) => ({ label: x, value: x }))}
              />
            </Form.Item>
          )}
        </ProFormList>
        <div style={{ flex: 1 }} />
        <DeleteButton onClick={remove} />
      </Flex>
      <ProFormDependency name={[["glyphs", glyphIndex, "type"]]}>
        {({ glyphs }) => {
          const { type } = glyphs[glyphIndex];
          return type === "component" ? (
            <ComponentForm glyphIndex={glyphIndex} />
          ) : (
            <CompoundForm glyphIndex={glyphIndex} />
          );
        }}
      </ProFormDependency>
    </>
  );
};

const GlyphsForm = () => {
  const items: MenuProps["items"] = operators.map((x) => ({
    label: x,
    key: x,
  }));
  return (
    <Form.List name="glyphs">
      {(fields, { add, remove }) => (
        <>
          {fields.map((info, index) => (
            <GlyphForm
              key={info.key}
              info={info}
              remove={() => remove(index)}
            />
          ))}
          <Flex align="center" justify="center" gap="large">
            <Button onClick={() => add(getDummyComponent())}>
              添加部件表示
            </Button>
            <Dropdown
              menu={{
                items,
                onClick: (info) => {
                  add(getDummyPartition(info.key as Operator));
                },
              }}
            >
              <Button>添加复合体表示</Button>
            </Dropdown>
          </Flex>
        </>
      )}
    </Form.List>
  );
};

export default function ({
  open,
  setOpen,
  form,
}: {
  open: boolean;
  setOpen: (o: boolean) => void;
  form: FormInstance<Character>;
}) {
  const remote = useContext(RemoteContext);
  const userUpdate = useAddAtom(userRepertoireAtom);
  const update = useAddAtom(repertoireAtom);
  return (
    <ModalForm<Character>
      form={form}
      layout="horizontal"
      open={open}
      onOpenChange={setOpen}
      omitNil={false}
      onFinish={async (values) => {
        console.log(values);
        if (remote) {
          // 管理模式
          const res = await remoteUpdate(values);
          if (!errorFeedback(res)) {
            update(String.fromCodePoint(values.unicode), values);
            setOpen(false);
          }
        } else {
          // 用户模式
          userUpdate(String.fromCodePoint(values.unicode), values);
        }
      }}
      width="90%"
    >
      <ModelContext.Provider value={form}>
        <EditorRow>
          <EditorColumn span={8}>
            <Typography.Title level={2}>基本信息</Typography.Title>
            <ProFormGroup>
              <ProFormDigit
                label="Unicode"
                name="unicode"
                disabled
                width="xs"
              />
              <ProFormDigit label="通用规范" name="tygf" disabled width="xs" />
              <ProFormCheckbox label="GB/T 2312" name="gb2312" disabled />
              <ProFormText label="名称" name="name" width="xs" />
              <ProFormCheckbox label="歧义" name="ambiguous" disabled />
              <ProFormDigit
                label="GF0014 序号"
                name="gf0014_id"
                disabled
                rules={[{ type: "integer", min: 1, max: 514 }]}
                width="xs"
              />
            </ProFormGroup>
            <Typography.Title level={2}>预览</Typography.Title>
            <GlyphView form={form} />
          </EditorColumn>
          <EditorColumn span={16}>
            <Typography.Title level={2}>字形</Typography.Title>
            <GlyphsForm />
            <Typography.Title level={2}>字音</Typography.Title>
            <ProFormList
              label="拼音"
              name="readings"
              itemRender={InlineRender}
              copyIconProps={false}
              creatorRecord={() => ({ toString: () => "" })}
            >
              {(meta) => (
                <Form.Item noStyle {...meta}>
                  <Input style={{ width: "128px" }} />
                </Form.Item>
              )}
            </ProFormList>
          </EditorColumn>
        </EditorRow>
      </ModelContext.Provider>
    </ModalForm>
  );
}
