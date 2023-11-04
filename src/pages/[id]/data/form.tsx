import { useContext, useState } from "react";
import {
  Button,
  Empty,
  Flex,
  Form,
  Input,
  Popconfirm,
  Typography,
} from "antd";
import {
  EditorColumn,
  EditorRow,
  IndexEdit2,
  IndexEdit3,
  verifyNewName,
} from "~/components/Utils";
import { useData, useRemove, useAdd } from "~/components/context";
import { useGlyph } from "~/components/contants";
import { deepcopy, length, } from "~/lib/utils";
import { Glyph } from "~/lib/data";
import { GlyphModel, ModelContext, getValue } from "~/components/GlyphModel";
import GlyphView from "~/components/GlyphView";
import Lookup from "~/components/Lookup";

type Slicer = { slice: boolean };

const Duplicate = ({ char, setChar, slice }: IndexEdit2 & Slicer) => {
  const glyph = useGlyph(char);
  const formCustomizations = useData().form;
  const maxCode = Math.max(
    ...Object.keys(formCustomizations).map((x) => x.codePointAt(0)!),
  );
  const code = Math.max(maxCode + 1, 0xf000);
  const newChar = String.fromCodePoint(code);
  const modify = useAdd();
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
      onConfirm={() => {
        const valid = verifyNewName(newName);
        if (!valid) return;
        const value = getValue(slice, newName, char, glyph);
        if (length(newName) > 1) {
          value.unicode = code;
        }
        const newKey = length(newName) === 1 ? newName : newChar;
        modify(newKey, value as Glyph);
        setChar(newKey);
      }}
      okText="确认"
      cancelText="取消"
    >
      <Button>{slice ? "切片" : "复制"}</Button>
    </Popconfirm>
  );
};

const Toolbar = ({ char, setChar }: IndexEdit3) => {
  const formCustomizations = useData().form;
  const glyph = useGlyph(char!);
  const del = useRemove();
  const add = useAdd();
  const model = useContext(ModelContext);
  const modified = char !== undefined && formCustomizations[char];
  return (
    <Flex justify="center" align="center" gap="small">
    <Button
      type="primary"
      onClick={() => {
        const values = model.getFieldsValue();
        console.log(values);
        add(char, values);
      }}
    >
      更新
    </Button>
      <Duplicate char={char} setChar={setChar} slice={false} />
      {glyph.default_type == 0 && (
        <Duplicate char={char} setChar={setChar} slice={true} />
      )}
      {modified && (
        <Button
          onClick={() => {
            del(char!);
            setChar(undefined);
          }}
        >
          删除
        </Button>
      )}
    </Flex>
  );
};

const FormData = () => {
  const [char, setChar] = useState<string | undefined>(undefined);
  const [form] = Form.useForm<Glyph>();
  return (
    <Flex vertical gap="middle" style={{ height: "100%" }}>
      <Lookup char={char!} setChar={setChar} />
      <EditorRow style={{ flex: 1 }}>
        <EditorColumn span={12}>
          <Typography.Title level={2}>预览</Typography.Title>
          { char !== undefined ? <GlyphView char={char} form={form}/> : <Empty />}
        </EditorColumn>
        <EditorColumn span={12}>
          {char ? <GlyphModel char={char} setChar={setChar} form={form}>
             <Toolbar char={char} setChar={setChar} />
          </GlyphModel> : <Empty />}
        </EditorColumn>
      </EditorRow>
    </Flex>
  );
};

export default FormData;
