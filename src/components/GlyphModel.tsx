import {
  Button,
  Checkbox,
  Flex,
  Form,
  FormListFieldData,
  Input,
  InputNumber,
  Radio,
  Select as AntdSelect,
  Space,
  Typography,
  Switch,
  Dropdown,
  MenuProps,
} from "antd";
import {
  IndexEdit2,
  ItemSelect,
  NumberInput,
  Select,
  errorFeedback,
} from "./Utils";
import {
  PropsWithChildren,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  BasicComponent,
  Block,
  Component,
  ComponentGlyph,
  Compound,
  CompoundGlyph,
  Draw,
  Glyph,
  GlyphOptionalUnicode,
  Operator,
  Partition,
  SVGStroke,
  Stroke,
  operators,
} from "~/lib/data";
import classifier, { Feature, schema } from "~/lib/classifier";
import { formDefault, getDummyPartition, getDummyStroke } from "~/lib/utils";
import { FormInstance, useWatch } from "antd/es/form/Form";
import { useForm } from "./contants";

export const ModelContext = createContext({} as FormInstance<Glyph>);

const CurveForm = (field: any) => {
  const { name, ...rest } = field;
  return (
    <Flex gap="small">
      <Form.Item<SVGStroke["curveList"]> {...rest} name={[name, "command"]}>
        <AntdSelect style={{ width: "64px" }} disabled />
      </Form.Item>
      <Form.List name={[name, "parameterList"]}>
        {(fields) => (
          <>
            {fields.map((field) => {
              return (
                <Form.Item<Draw["parameterList"]> {...field} key={field.key}>
                  <NumberInput />
                </Form.Item>
              );
            })}
          </>
        )}
      </Form.List>
    </Flex>
  );
};

interface ListItemWithRemove {
  info: FormListFieldData;
  remove: () => void;
}

const StrokeForm = ({ info, remove }: ListItemWithRemove) => {
  const { key, name, ...rest } = info;
  const form = useContext(ModelContext);
  const formData = useForm();
  return (
    <Form.Item noStyle shouldUpdate={() => true}>
      {({ getFieldValue }) => {
        const source = getFieldValue(["component", "source"]);
        const length = formData[source]?.component?.strokes?.length;
        return typeof getFieldValue(["component", "strokes", name]) ===
          "object" ? (
          <>
            <Flex gap="middle" justify="space-between">
              <Form.Item<BasicComponent["strokes"]>
                {...rest}
                name={[name, "feature"]}
              >
                <Select<Feature>
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
                    const newStroke = getDummyStroke(value, oldStroke.start);
                    form.setFieldValue(
                      ["component", "strokes", name],
                      newStroke,
                    );
                  }}
                />
              </Form.Item>
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
                <Button onClick={remove}>删除笔画</Button>
              </Form.Item>
            </Flex>
            <Form.List name={[name, "curveList"]}>
              {(fields) => (
                <>
                  {fields.map((field) => (
                    <CurveForm {...field} key={field.key} />
                  ))}
                </>
              )}
            </Form.List>
          </>
        ) : (
          <Flex gap="middle" justify="space-between">
            <Form.Item name={[name]}>
              <Select<number>
                options={[...Array(length).keys()].map((x) => ({
                  label: x,
                  value: x,
                }))}
              />
            </Form.Item>
            <Form.Item>
              <Button
                onClick={() => {
                  form.setFieldValue(
                    ["component", "strokes", name],
                    getDummyStroke("横"),
                  );
                }}
              >
                更改为 SVG 笔画
              </Button>
            </Form.Item>
            <Form.Item>
              <Button onClick={remove}>删除笔画</Button>
            </Form.Item>
          </Flex>
        );
      }}
    </Form.Item>
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
  const strokes = Form.useWatch(["component", "strokes"], form) as Stroke[];
  const source = Form.useWatch(["component", "source"], form) as
    | string
    | undefined;
  const formData = useForm();
  const parent = source !== undefined ? formData[source] : undefined;
  const parentLength = parent?.component!.strokes.length ?? 0;
  return (
    <>
      <Flex gap="middle">
        <Form.Item
          name={["component", "source"]}
          label="源字"
          shouldUpdate={() => true}
        >
          <ItemSelect />
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
};

const BlockModel = ({ info, remove }: ListItemWithRemove) => {
  const { key, name, ...rest } = info;
  return (
    <Space>
      <Form.Item<Block["index"]>
        name={[name, "index"]}
        label="部分"
        colon={false}
      >
        <Select
          options={[0, 1, 2].map((x) => ({
            value: x,
            label: x + 1,
          }))}
        />
      </Form.Item>
      <Form.Item<Block["strokes"]> name={[name, "strokes"]}>
        <Select
          options={[...Array(10).keys()].map((x) => ({
            value: x,
            label: x || "全取",
          }))}
        />
      </Form.Item>
      <Form.Item>
        <a onClick={remove}>删除</a>
      </Form.Item>
    </Space>
  );
};

const PartitionModel = ({ info, remove }: ListItemWithRemove) => {
  const { key, name, ...rest } = info;
  const form = useContext(ModelContext);
  return (
    <>
      <Typography.Title level={3}>分部方式 {name + 1}</Typography.Title>
      <Flex gap="middle">
        <Form.Item<Compound> label="结构" name={[info.name, "operator"]}>
          <Select<Operator>
            options={operators.map((x) => ({ value: x, label: x }))}
            onChange={(value) => {
              const list = form.getFieldValue([
                "compound",
                info.name,
                "operandList",
              ]);
              const newLength = value === "⿲" || value === "⿳" ? 3 : 2;
              const newList = list.concat("一").slice(0, newLength);
              form.setFieldValue(
                ["compound", info.name, "operandList"],
                newList,
              );
            }}
          />
        </Form.Item>
        <Form.List name={[info.name, "operandList"]}>
          {(fields) => (
            <>
              {fields.map((info, i) => (
                <Form.Item<Partition["operandList"]>
                  {...info}
                  key={info.key}
                  label={`第 ${i + 1} 部`}
                  name={info.name}
                >
                  <ItemSelect />
                </Form.Item>
              ))}
            </>
          )}
        </Form.List>
        <Form.Item>
          <Button onClick={remove}>删除分部方式</Button>
        </Form.Item>
      </Flex>
      <Flex align="center" gap="small" wrap="wrap">
        <Form.Item label="标签" />
        <Form.List name={[info.name, "tags"]}>
          {(fields, { add, remove }) => (
            <>
              {fields.map((info, i) => (
                <Space key={info.key}>
                  <Form.Item<Partition["tags"]> {...info} name={info.name}>
                    <Input style={{ width: "96px" }} />
                  </Form.Item>
                  <Form.Item>
                    <a onClick={() => remove(i)}>删除</a>
                  </Form.Item>
                </Space>
              ))}
              <Form.Item>
                <Button onClick={() => add("形声")}>添加标签</Button>
              </Form.Item>
            </>
          )}
        </Form.List>
      </Flex>
      <Flex align="center" gap="small" wrap="wrap">
        <Form.Item label="笔顺" />
        <Form.List name={[info.name, "order"]}>
          {(fields, { add, remove }) => (
            <>
              {fields.map((info, i) => (
                <BlockModel
                  key={info.key}
                  info={info}
                  remove={() => remove(i)}
                />
              ))}
              <Form.Item>
                <Button onClick={() => add({ index: 0, strokes: 0 })}>
                  添加笔画块
                </Button>
              </Form.Item>
            </>
          )}
        </Form.List>
      </Flex>
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
      <Flex gap="middle">
        <Form.Item<Glyph> label="Unicode" name="unicode">
          <InputNumber disabled />
        </Form.Item>
        <Form.Item<Glyph> label="名称" name="name">
          <Input />
        </Form.Item>
      </Flex>
      <Flex gap="middle">
        <Form.Item<Glyph> label="类型" name="default_type">
          <Radio.Group optionType="button" options={options} />
        </Form.Item>
        <Form.Item<Glyph> label="歧义" name="ambiguous" valuePropName="checked">
          <Checkbox />
        </Form.Item>
        <Form.Item<Glyph>
          label="GF0014 序号"
          name="gf0014_id"
          rules={[{ type: "integer", min: 1, max: 514 }]}
        >
          <InputNumber />
        </Form.Item>
      </Flex>
    </>
  );
};

interface SwitcherProps {
  name: string;
  formName: "component" | "compound";
  onChange: (b: boolean) => void;
}

const Switcher = ({ name, formName, onChange }: SwitcherProps) => {
  const form = useContext(ModelContext);
  const thisStatus = Form.useWatch(formName, form) !== undefined;
  const hasComponent = useWatch("component", form) !== undefined;
  const hasCompound = useWatch("compound", form) !== undefined;
  const last = +hasComponent + +hasCompound === 1;
  return (
    <Flex justify="space-between" align="baseline">
      <Typography.Title level={2}>{name}数据</Typography.Title>
      <Switch
        checked={thisStatus}
        disabled={last && thisStatus}
        onChange={(value) => {
          if (value === false) {
            form.setFieldValue(formName, undefined);
          } else {
            const initial = formDefault[formName];
            form.setFieldValue(formName, initial);
          }
          onChange(!thisStatus);
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
  char,
  setChar,
  form,
  children,
}: PropsWithChildren<IndexEdit2 & { form: FormInstance<Glyph> }>) => {
  const [hasComponent, setHasComponent] = useState(false);
  const [hasCompound, setHasCompound] = useState(false);
  const formData = useForm();
  useEffect(() => {
    if (char === undefined) return;
    const data = formData[char];
    if (data === undefined) return;
    setHasComponent(data.component !== undefined);
    setHasCompound(data.compound !== undefined);
    form.resetFields();
    form.setFieldsValue(data);
  }, [char]);
  return (
    <Form<Glyph> form={form}>
      {children}
      <BasicForm />
      <Switcher name="部件" formName="component" onChange={setHasComponent} />
      {hasComponent && <ComponentForm />}
      <Switcher name="复合体" formName="compound" onChange={setHasCompound} />
      {hasCompound && <CompoundForm />}
    </Form>
  );
};

export {
  GlyphModel,
  BasicForm,
  CurveForm,
  StrokeForm,
  ComponentForm,
  CompoundForm,
};
