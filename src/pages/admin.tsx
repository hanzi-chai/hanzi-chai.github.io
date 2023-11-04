import {
  Button,
  Flex,
  Form,
  Input,
  Layout,
  Space,
  Typography,
  Empty,
  Popconfirm,
} from "antd";
import { createContext, useContext, useEffect, useState } from "react";
import { Err, delet, get, patch, post, put } from "~/lib/api";
import { Glyph, GlyphOptionalUnicode } from "~/lib/data";
import {
  EditorColumn,
  EditorRow,
  IndexEdit2,
  errorFeedback,
  verifyNewName,
} from "~/components/Utils";
import { preprocessForm } from "~/lib/utils";
import {
  loadForm,
  mutate,
  remove,
  selectForm,
  selectFormLoading,
  update,
  useAppDispatch,
  useAppSelector,
} from "~/components/store";
import { GlyphModel, ModelContext, getValue } from "~/components/GlyphModel";
import Lookup from "~/components/Lookup";
import GlyphView from "~/components/GlyphView";

type Slicer = { slice: boolean };

const RemoteDuplicate = ({ char, setChar, slice }: IndexEdit2 & Slicer) => {
  const formData = useAppSelector(selectForm);
  const form = useContext(ModelContext);
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
  const form = useContext(ModelContext);
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
  const model = useContext(ModelContext);
  return (
    <Space>
      <Button
        type="primary"
        onClick={async () => {
          const values = model.getFieldsValue();
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
  return (
    <Flex
      component={Layout.Content}
      style={{ padding: "32px" }}
      vertical
      justify="center"
      gap="large"
    >
      <Lookup char={char!} setChar={setChar} />
      <EditorRow>
        <EditorColumn span={12}>
          <Typography.Title level={2}>预览</Typography.Title>
          {char !== undefined ? (
            <GlyphView char={char} form={form} />
          ) : (
            <Empty />
          )}
        </EditorColumn>
        <EditorColumn span={12}>
          {char !== undefined ? (
            <GlyphModel char={char} setChar={setChar} form={form}>
              <Toolbar char={char} setChar={setChar} />
            </GlyphModel>
          ) : (
            <Empty />
          )}
        </EditorColumn>
      </EditorRow>
    </Flex>
  );
};

const AdminLayout = () => {
  const loading = useAppSelector(selectFormLoading);
  const dispatch = useAppDispatch();

  useEffect(() => {
    get<any, undefined>("form/all").then((data) => {
      dispatch(loadForm(preprocessForm(data)));
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
