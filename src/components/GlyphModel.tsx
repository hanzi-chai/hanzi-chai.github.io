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
  Component,
  Compound,
  Draw,
  Glyph,
  GlyphOptionalUnicode,
  Operator,
  Partition,
  Stroke,
  operators,
} from "~/lib/data";
import classifier, { Feature, schema } from "~/lib/classifier";
import {
  deepcopy,
  getDummyPartition,
  getDummyStroke,
  length,
} from "~/lib/utils";
import { FormInstance, useWatch } from "antd/es/form/Form";
import { selectForm, useAppSelector } from "./store";
import { useForm } from "./contants";

export const ModelContext = createContext<FormInstance<Glyph>>({} as any);

const CurveForm = (field: any) => {
  const { name, ...rest } = field;
  return (
    <Flex gap="small">
      <Form.Item<Stroke["curveList"]> {...rest} name={[name, "command"]}>
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
  return (
    <>
      <Flex gap="middle" justify="space-between">
        <Form.Item<Component> {...rest} name={[name, "feature"]}>
          <Select<Feature>
            options={Object.keys(classifier).map((x) => ({
              label: x,
              value: x,
            }))}
            onChange={(value) => {
              const newStroke = getDummyStroke(value);
              form.setFieldValue(["component", name], newStroke);
            }}
          />
        </Form.Item>
        <Space>
          <Form.Item<Component>
            {...rest}
            name={[name, "start", 0]}
            label="起点"
          >
            <NumberInput />
          </Form.Item>
          <Form.Item<Component> {...rest} name={[name, "start", 1]}>
            <NumberInput />
          </Form.Item>
        </Space>
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
  );
};

const ComponentForm = () => {
  const rawitems = Object.keys(schema).map((x) => ({
    key: x,
    label: x,
  }));
  const items: MenuProps["items"] = [
    { key: 0, label: "基本", children: rawitems.slice(0, 7) },
    { key: 1, label: "折类 I", children: rawitems.slice(7, 13) },
    { key: 2, label: "折类 II", children: rawitems.slice(13, 20) },
    { key: 3, label: "折类 III", children: rawitems.slice(20, 27) },
    { key: 4, label: "折类 IV", children: rawitems.slice(27) },
  ];
  return (
    <Form.List name="component">
      {(fields, { add, remove }) => (
        <>
          {fields.map((info, index) => (
            <StrokeForm
              info={info}
              remove={() => remove(index)}
              key={info.key}
            />
          ))}
          <Form.Item>
            <Dropdown
              menu={{
                items,
                onClick: (info) => {
                  add(getDummyStroke(info.key as Feature));
                },
              }}
            >
              <Button type="dashed">添加笔画</Button>
            </Dropdown>
          </Form.Item>
        </>
      )}
    </Form.List>
  );
};

const PartitionModel = ({ info, remove }: ListItemWithRemove) => {
  const { key, name, ...rest } = info;
  const form = useContext(ModelContext);
  return (
    <Flex gap="middle">
      <Form.Item<Compound> label="结构" name={[info.name, "operator"]}>
        <Select<Operator>
          options={operators.map((x) => ({ value: x, label: x }))}
          onChange={(value) => {
            const list = form.getFieldValue(["compound", "operandList"]);
            const newLength = value === "⿲" || value === "⿳" ? 3 : 2;
            const newList = list.concat("一").slice(0, newLength);
            form.setFieldValue(["compound", "operandList"], newList);
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
  );
};

const CompoundForm = () => {
  const form = useContext(ModelContext);
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

const SliceForm = () => {
  const form = useContext(ModelContext);
  const source = useWatch(["slice", "source"], form);
  const formData = useForm();
  const options = formData[source]?.component?.map((x, i) => ({
    label: x.feature,
    value: i,
  }));
  return (
    <Flex vertical>
      <Form.Item<Glyph> label="源字" name={["slice", "source"]}>
        <ItemSelect />
      </Form.Item>
      <Form.Item<Glyph> label="笔画" name={["slice", "indices"]}>
        <Checkbox.Group options={options} />
      </Form.Item>
    </Flex>
  );
};

const BasicForm = () => {
  const form = useContext(ModelContext);
  const hasComponent = useWatch("component", form) !== undefined;
  const hasSlice = useWatch("slice", form) !== undefined;
  const hasCompound = useWatch("compound", form) !== undefined;
  const options = [
    { label: "部件", value: 0, disabled: !hasComponent },
    { label: "切片", value: 1, disabled: !hasSlice },
    { label: "复合体", value: 2, disabled: !hasCompound },
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
  formName: string;
  onChange: (b: boolean) => void;
}

const partDefault: Record<string, any> = {
  component: [],
  compound: { operator: operators[0], operandList: ["一", "一"] },
  slice: { source: "一", indices: [0] },
};

const Switcher = ({ name, formName, onChange }: SwitcherProps) => {
  const form = useContext(ModelContext);
  const thisStatus = Form.useWatch(formName, form) !== undefined;
  const hasComponent = useWatch("component", form) !== undefined;
  const hasSlice = useWatch("slice", form) !== undefined;
  const hasCompound = useWatch("compound", form) !== undefined;
  const last = +hasComponent + +hasCompound + +hasSlice === 1;
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
            form.setFieldValue(formName, partDefault[formName]);
          }
          onChange(!thisStatus);
        }}
      />
    </Flex>
  );
};

const GlyphModel = ({
  char,
  setChar,
  form,
  children,
}: PropsWithChildren<IndexEdit2 & { form: FormInstance<Glyph> }>) => {
  const [hasComponent, setHasComponent] = useState(false);
  const [hasCompound, setHasCompound] = useState(false);
  const [hasSlice, setHasSlice] = useState(false);
  const formData = useForm();
  useEffect(() => {
    const data = formData[char];
    setHasComponent(data.component !== undefined);
    setHasCompound(data.compound !== undefined);
    setHasSlice(data.slice !== undefined);
    form.setFieldsValue(data);
  }, [char]);
  return (
    <Form<Glyph> form={form}>
      <ModelContext.Provider value={form}>
        {children}
        <BasicForm />
        <Switcher name="部件" formName="component" onChange={setHasComponent} />
        {hasComponent && <ComponentForm />}
        <Switcher name="切片" formName="slice" onChange={setHasSlice} />
        {hasSlice && <SliceForm />}
        <Switcher name="复合体" formName="compound" onChange={setHasCompound} />
        {hasCompound && <CompoundForm />}
      </ModelContext.Provider>
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
  SliceForm,
};

export const getValue = function (
  slice: boolean,
  newName: string,
  char: string,
  glyph: Glyph,
): GlyphOptionalUnicode {
  const unicode = length(newName) === 1 ? newName.codePointAt(0)! : undefined;
  if (slice) {
    return {
      unicode,
      name: newName,
      default_type: 1,
      gf0014_id: null,
      slice: { source: char, indices: glyph.component!.map((_, i) => i) },
    };
  } else {
    const value: GlyphOptionalUnicode = deepcopy(glyph);
    value.unicode = unicode;
    value.name = length(newName) === 1 ? null : newName;
    value.gf0014_id = null;
    return value;
  }
};
