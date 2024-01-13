import type { FormListFieldData, MenuProps } from "antd";
import { Button, Flex, Form, Dropdown, notification } from "antd";
import { DeleteButton, EditorColumn, EditorRow, NumberInput } from "./Utils";
import { ReactNode, createContext, useContext } from "react";
import type {
  PrimitveCharacter,
  Component,
  RenderedComponent,
  SVGGlyph,
  SVGStroke,
} from "~/lib/data";
import type { Feature } from "~/lib/classifier";
import classifier, { schema } from "~/lib/classifier";
import { getDummyStroke } from "~/lib/utils";
import type { FormInstance } from "antd/es/form/Form";
import { useWatch } from "antd/es/form/Form";
import {
  allRepertoireAtom,
  determinedRepertoireAtom,
  useAtomValue,
} from "~/atoms";
import { GlyphSelect } from "./CharacterSelect";
import {
  ModalForm,
  ProFormDependency,
  ProFormGroup,
  ProFormList,
  ProFormListProps,
  ProFormSelect,
} from "@ant-design/pro-components";
import styled from "styled-components";
import { CommonForm } from "./CompoundForm";
import Root from "./Root";
import { recursiveRenderComponent } from "~/lib/component";
import { StrokesView } from "./GlyphView";

export const ModelContext = createContext(
  {} as FormInstance<PrimitveCharacter>,
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

interface ListItemWithRemove {
  info: FormListFieldData;
  remove: () => void;
}

const StrokeForm = ({
  info,
  remove,
  mutate,
  rendered,
}: ListItemWithRemove & { mutate: (s: any) => void; rendered: SVGStroke }) => {
  const { name } = info;
  const repertoire = useAtomValue(allRepertoireAtom);
  return (
    <ProFormDependency name={[["strokes", name], ["source"]]}>
      {({ strokes, source }) => {
        let length: number | undefined = undefined;
        if (source) {
          const sourceCharacter = repertoire[source];
          if (sourceCharacter !== undefined) {
            const sourceComponent = sourceCharacter.glyphs.find(
              (x) => x.type === "component",
            ) as Component | undefined;
            length = sourceComponent?.strokes.length ?? 0;
          } else {
            length = 0;
          }
        }
        const stroke = strokes[name]!;
        return typeof stroke === "object" ? (
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
                  const newStroke = getDummyStroke(
                    value,
                    stroke.start,
                    stroke.curveList,
                  );
                  mutate(newStroke);
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
                  onClick={() => mutate(0)}
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
                  mutate(rendered);
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

const ComponentForm = ({
  title,
  initialValues,
  current,
  onFinish,
  noButton,
}: {
  title: string;
  initialValues: Component;
  current: string;
  onFinish: (c: Component) => Promise<boolean>;
  noButton?: boolean;
}) => {
  const [form] = Form.useForm<Component>();
  const source = useWatch("source", form);
  const strokes = useWatch("strokes", form);
  const self = useWatch([], form);
  const repertoire = useAtomValue(allRepertoireAtom);
  const rendered = recursiveRenderComponent(self, repertoire);
  const parent = source !== undefined ? repertoire[source] : undefined;
  const parentLength = (
    parent?.glyphs.find((x) => x.type === "component") as Component | undefined
  )?.strokes.length;
  const trigger = noButton ? <span>{title}</span> : <Root>{title}</Root>;
  return (
    <ModalForm<Component>
      title={title}
      layout="horizontal"
      omitNil={false}
      trigger={trigger}
      initialValues={initialValues}
      onFinish={onFinish}
    >
      <EditorRow>
        <EditorColumn>
          <StrokesView glyph={rendered instanceof Error ? [] : rendered} />
        </EditorColumn>
        <EditorColumn>
          <CommonForm />
          <Form.List name={"strokes"}>
            {(fields, { add, remove }) => (
              <>
                <Flex gap="middle" align="center">
                  <Form.Item name={"source"} label="源字" shouldUpdate>
                    <GlyphSelect
                      customFilter={([name, character]) => {
                        const component = repertoire[name]?.glyphs.find(
                          (x) => x.type === "component",
                        );
                        if (component === undefined) return false;
                        let pointer: string | undefined = name;
                        while (pointer != undefined) {
                          if (pointer === current) return false;
                          let next = repertoire[pointer]?.glyphs.find(
                            (x) => x.type === "component",
                          ) as Component | undefined;
                          if (next === undefined) break;
                          pointer = next.source;
                        }
                        return true;
                      }}
                    />
                  </Form.Item>
                  <Form.Item shouldUpdate>
                    <Button
                      onClick={() => form.setFieldValue(["source"], undefined)}
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
                    mutate={(s) =>
                      form.setFieldValue(["strokes", info.name], s)
                    }
                    rendered={(rendered as SVGGlyph)[info.name]!}
                  />
                ))}
              </>
            )}
          </Form.List>
        </EditorColumn>
      </EditorRow>
    </ModalForm>
  );
};

export default ComponentForm;
