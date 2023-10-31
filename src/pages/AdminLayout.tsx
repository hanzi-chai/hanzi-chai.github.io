import {
  Button,
  Flex,
  Form,
  FormInstance,
  FormListFieldData,
  Input,
  InputNumber,
  Layout,
  Radio,
  Space,
  Select as AntdSelect,
  Switch,
  Typography,
  notification,
  Empty,
  SelectProps,
  Popconfirm,
  Checkbox,
} from "antd";
import { createContext, useContext, useEffect, useState } from "react";
import { Err, delet, get, patch, post, put } from "../lib/api";
import {
  Component,
  Draw,
  Glyph,
  GlyphOptionalUnicode,
  Stroke,
} from "../lib/data";
import {
  EditorColumn,
  EditorRow,
  IndexEdit2,
  NumberInput,
  Select,
} from "../components/Utils";
import classifier, { Feature, schema } from "../lib/classifier";
import {
  deepcopy,
  displayName,
  getDummyStroke,
  length,
  preprocessForm,
  validUnicode,
} from "../lib/utils";
import styled from "styled-components";
import { StrokesView } from "../components/GlyphView";
import {
  load,
  mutate,
  remove,
  selectForm,
  selectLoading,
  update,
  useAppDispatch,
  useAppSelector,
} from "../components/store";
import { getSequence } from "../lib/form";
import { ideos } from "../components/CompoundModel";
import { useWatch } from "antd/es/form/Form";

interface SwitcherProps {
  name: string;
  formName: string;
  last: boolean;
  onChange: (b: boolean) => void;
}

const partDefault: Record<string, any> = {
  component: [],
  compound: { operator: ideos[0], operandList: ["一", "一"] },
  slice: { source: "一", indices: [0] },
};

const Switcher = ({ name, formName, last, onChange }: SwitcherProps) => {
  const form = useContext(FormContext);
  const thisStatus = Form.useWatch(formName, form) !== undefined;
  return (
    <Flex justify="space-between" align="baseline">
      <Typography.Title level={2}>{name}数据</Typography.Title>
      <Switch
        checked={thisStatus}
        disabled={last && thisStatus}
        onChange={(value) => {
          if (value === false) {
            form.setFieldValue(formName, null);
          } else {
            form.setFieldValue(formName, partDefault[formName]);
          }
          onChange(!thisStatus);
        }}
      />
    </Flex>
  );
};

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

const StrokeForm = ({
  info,
  index,
  remove,
}: {
  info: FormListFieldData;
  index: number;
  remove: (n: number) => void;
}) => {
  const { key, name, ...rest } = info;
  const form = useContext(FormContext);
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
              const newStroke = getDummyStroke(value, schema[value]);
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
          <Button onClick={() => remove(index)}>删除笔画</Button>
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
  return (
    <Form.List name="component">
      {(fields, { add, remove }) => (
        <>
          {fields.map((info, i) => (
            <StrokeForm info={info} index={i} remove={remove} key={info.key} />
          ))}
          <Form.Item>
            <Button
              block
              type="dashed"
              onClick={() =>
                add({
                  feature: "横",
                  start: [6, 48],
                  curveList: [{ command: "h", parameterList: [88] }],
                })
              }
            >
              添加笔画
            </Button>
          </Form.Item>
        </>
      )}
    </Form.List>
  );
};

const CompoundForm = () => {
  return (
    <Space>
      <Form.Item<Glyph> label="结构" name={["compound", "operator"]}>
        <Select options={ideos.map((x) => ({ value: x, label: x }))} />
      </Form.Item>
      <Form.Item<Glyph> label="第 1 部" name={["compound", "operandList", 0]}>
        <ItemSelect />
      </Form.Item>
      <Form.Item<Glyph> label="第 2 部" name={["compound", "operandList", 1]}>
        <ItemSelect />
      </Form.Item>
    </Space>
  );
};

const SliceForm = () => {
  const form = useContext(FormContext);
  const source = useWatch(["slice", "source"], form);
  const formData = useAppSelector(selectForm);
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

const BasicForm = ({ options }: any) => {
  const form = useContext(FormContext);
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

const Overlay = styled.div`
  border: 1px solid black;
  aspect-ratio: 1;
  display: grid;

  & svg {
    grid-area: 1 / 1 / 1 / 1;
  }
`;

const errorFeedback = function <T extends number | boolean>(
  res: T | Err,
): res is Err {
  if (typeof res === "object") {
    notification.error({
      message: "无法完成该操作",
      description: JSON.stringify(res),
    });
    return true;
  } else {
    notification.success({
      message: "操作成功",
    });
    return false;
  }
};

const FormContext = createContext<FormInstance<Glyph>>({} as any);

export const ItemSelect = (props: SelectProps) => {
  const form = useAppSelector(selectForm);
  const initial = props.value
    ? [{ value: props.value, label: form[props.value]?.name || props.value }]
    : [];
  const [data, setData] = useState<SelectProps["options"]>(initial);
  const onSearch = (input: string) => {
    if (input.length === 0) {
      setData([]);
      return;
    }
    const allResults = Object.entries(form)
      .map(([x, v]) => ({
        value: x,
        label: displayName(x, v),
      }))
      .filter(({ value }) => {
        return getSequence(form, classifier, value).startsWith(input);
      })
      .sort((a, b) => {
        return (
          getSequence(form, classifier, a.value).length -
          getSequence(form, classifier, b.value).length
        );
      });
    const minResults = allResults.filter(
      ({ value }) =>
        getSequence(form, classifier, value).length === input.length,
    );
    setData(allResults.slice(0, Math.max(5, minResults.length)));
  };
  const commonProps: SelectProps = {
    showSearch: true,
    placeholder: "输入笔画搜索",
    options: data,
    filterOption: false,
    onSearch,
  };
  return <Select style={{ width: "96px" }} {...props} {...commonProps} />;
};

export const FeatureSelect = (props: SelectProps) => {
  const form = useAppSelector(selectForm);
  const initial = props.value
    ? [{ value: props.value, label: form[props.value]?.name || props.value }]
    : [];
  const [data, setData] = useState<SelectProps["options"]>(initial);
  const onSearch = (input: string) => {
    if (input.length === 0) {
      setData([]);
      return;
    }
    const allResults = Object.entries(form)
      .filter(
        ([, v]) =>
          v.component !== undefined &&
          v.component.map((x) => x.feature).includes(input as any),
      )
      .map(([x, v]) => ({
        value: x,
        label: displayName(x, v),
      }))
      .sort((a, b) => {
        return (
          getSequence(form, classifier, a.value).length -
          getSequence(form, classifier, b.value).length
        );
      });
    setData(allResults);
  };
  const commonProps: SelectProps = {
    showSearch: true,
    placeholder: "输入笔画搜索",
    options: data,
    filterOption: false,
    onSearch,
  };
  return <Select {...props} {...commonProps} />;
};

export const ReferenceSelect = (props: SelectProps) => {
  const form = useAppSelector(selectForm);
  const initial = props.value
    ? [{ value: props.value, label: form[props.value]?.name || props.value }]
    : [];
  const [data, setData] = useState<SelectProps["options"]>(initial);
  const onSearch = (input: string) => {
    if (input.length === 0) {
      setData([]);
      return;
    }
    const char = String.fromCodePoint(Number(input));
    const allResults = Object.entries(form)
      .map(([x, v]) => ({
        value: x,
        label: displayName(x, v),
      }))
      .filter(({ value }) => {
        if (value === char) return true;
        const glyph = form[value];
        if (glyph.default_type === 1) {
          return glyph.slice.source === char;
        } else if (glyph.default_type === 2) {
          return glyph.compound.operandList.includes(char);
        }
        return false;
      })
      .sort((a, b) => {
        return (
          getSequence(form, classifier, a.value).length -
          getSequence(form, classifier, b.value).length
        );
      });
    setData(allResults.slice(0, 30));
  };
  const commonProps: SelectProps = {
    showSearch: true,
    placeholder: "输入 Unicode 搜索",
    options: data,
    filterOption: false,
    onSearch,
  };
  return <Select {...props} {...commonProps} />;
};

const verifyNewName = (newName: string) => {
  if (!Array.from(newName).every(validUnicode)) {
    notification.error({
      message: "名称含有非法字符",
      description: "合法字符的范围：0x4e00 - 0x9fff，或 0x3400 - 0x4dbf",
    });
    return false;
  }
  return true;
};

type Slicer = { slice: boolean };

const getValue = function (
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

const RemoteDuplicate = ({ char, setChar, slice }: IndexEdit2 & Slicer) => {
  const formData = useAppSelector(selectForm);
  const form = useContext(FormContext);
  const dispatch = useAppDispatch();
  const [newName, setNewName] = useState("");
  return (
    <Popconfirm
      title="新字形名称"
      description={
        <Input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
        />
      }
      onConfirm={async () => {
        const valid = verifyNewName(newName);
        if (!valid) return;
        const value = getValue(slice, newName, char, formData[char]);
        console.log(value);
        const slug =
          value.unicode === undefined ? "form" : `form/${value.unicode}`;
        const res = await post<number, any>(slug, value);
        if (!errorFeedback(res)) {
          const newChar = String.fromCodePoint(res);
          const finish = { ...value, unicode: res } as Glyph;
          console.log(res, String.fromCodePoint(res), finish);
          dispatch(update([newChar, finish]));
          setChar(newChar);
          form.setFieldsValue(finish);
        }
      }}
    >
      <Button>新建（{slice ? "切片" : "复制"}）</Button>
    </Popconfirm>
  );
};

const RemoteMutate = ({ char, setChar }: IndexEdit2) => {
  const formData = useAppSelector(selectForm);
  const form = useContext(FormContext);
  const dispatch = useAppDispatch();
  const [newName, setNewName] = useState("");
  return (
    <Popconfirm
      title="新字形名称"
      description={
        <Input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
        />
      }
      onConfirm={async () => {
        const valid = verifyNewName(newName);
        const data = formData[char];
        if (!valid || newName.length > 1) return;
        const res = await patch<boolean, number>(
          `form/${char.codePointAt(0)!}`,
          newName.codePointAt(0)!,
        );
        console.log(char, char.codePointAt(0), newName, newName.codePointAt(0));
        if (!errorFeedback(res)) {
          dispatch(mutate([char, newName]));
          setChar(newName);
          form.setFieldsValue({ ...data, unicode: newName.codePointAt(0) });
        }
      }}
    >
      <Button>Unicode 替换</Button>
    </Popconfirm>
  );
};

const Toolbar = ({
  char,
  setChar,
}: {
  char: string;
  setChar: (s: string | undefined) => void;
}) => {
  const dispatch = useAppDispatch();
  return (
    <Space>
      <Button type="primary" form="glyph" key="submit" htmlType="submit">
        更新
      </Button>
      <RemoteDuplicate char={char!} setChar={setChar} slice={false} />
      <RemoteDuplicate char={char!} setChar={setChar} slice={true} />
      <RemoteMutate char={char} setChar={setChar} />
      <Button
        onClick={async () => {
          const res = await delet<boolean, undefined>(
            `form/${char!.codePointAt(0)}`,
          );
          if (!errorFeedback(res)) {
            dispatch(remove(char!));
            setChar(undefined);
          }
        }}
      >
        删除
      </Button>
    </Space>
  );
};

const AdminForm = () => {
  const [char, setChar] = useState<string | undefined>(undefined);
  const [form] = Form.useForm<Glyph>();
  const [hasComponent, setHasComponent] = useState(false);
  const [hasCompound, setHasCompound] = useState(false);
  const [hasSlice, setHasSlice] = useState(false);
  const options = [
    { label: "部件", value: 0, disabled: !hasComponent },
    { label: "切片", value: 1, disabled: !hasSlice },
    { label: "复合体", value: 2, disabled: !hasCompound },
  ];
  const component = Form.useWatch("component", form);
  const formData = useAppSelector(selectForm);
  const dispatch = useAppDispatch();
  const last = +hasComponent + +hasCompound + +hasSlice === 1;
  const choose = (value: string) => {
    const data = formData[value];
    setHasComponent(data.component !== undefined);
    setHasCompound(data.compound !== undefined);
    setHasSlice(data.slice !== undefined);
    setChar(value);
    form.setFieldsValue(data);
  };
  return (
    <Flex
      component={Layout.Content}
      style={{ padding: "32px" }}
      vertical
      justify="center"
      gap="large"
    >
      <Flex
        justify="center"
        align="center"
        style={{ alignSelf: "center" }}
        gap="middle"
      >
        Unicode 搜索
        <ReferenceSelect value={char} onChange={choose} />
        笔画搜索
        <ItemSelect value={char} onChange={choose} />
        笔画搜索
        <FeatureSelect value={char} onChange={choose} />
      </Flex>
      <EditorRow>
        <EditorColumn span={12}>
          <Typography.Title level={2}>预览</Typography.Title>
          <Overlay>
            {component ? <StrokesView glyph={component} /> : <Empty />}
          </Overlay>
        </EditorColumn>
        <EditorColumn span={12}>
          {char !== undefined && (
            <Form<Glyph>
              form={form}
              name="glyph"
              onFinish={async (values: Glyph) => {
                console.log(values);
                const res = await put<boolean, typeof values>(
                  `form/${values.unicode}`,
                  values,
                );
                if (!errorFeedback(res)) {
                  dispatch(update([char!, values]));
                }
              }}
            >
              <FormContext.Provider value={form}>
                <Toolbar char={char} setChar={setChar} />
                <BasicForm options={options} />
                <Switcher
                  name="部件"
                  formName="component"
                  last={last}
                  onChange={setHasComponent}
                />
                {hasComponent && <ComponentForm />}
                <Switcher
                  name="切片"
                  formName="slice"
                  last={last}
                  onChange={setHasSlice}
                />
                {hasSlice && <SliceForm />}
                <Switcher
                  name="复合体"
                  formName="compound"
                  last={last}
                  onChange={setHasCompound}
                />
                {hasCompound && <CompoundForm />}
              </FormContext.Provider>
            </Form>
          )}
        </EditorColumn>
      </EditorRow>
    </Flex>
  );
};

const AdminLayout = () => {
  const loading = useAppSelector(selectLoading);
  const dispatch = useAppDispatch();

  useEffect(() => {
    get<any, undefined>("form/all").then((data) => {
      dispatch(load(preprocessForm(data)));
    });
  }, []);

  return loading ? (
    <h1>loading...</h1>
  ) : (
    <Layout style={{ height: "100%" }}>
      <AdminForm />
    </Layout>
  );
};

export default AdminLayout;
