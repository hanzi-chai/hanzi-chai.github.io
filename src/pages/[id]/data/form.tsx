import ComponentModel from "~/components/ComponentModel";
import { ComponentView, CompoundView, SliceView } from "~/components/GlyphView";
import { useState } from "react";
import {
  Button,
  Empty,
  Flex,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Popover,
  Radio,
  Typography,
  notification,
} from "antd";
import SliceModel from "~/components/SliceModel";
import {
  EditorColumn,
  EditorRow,
  Index,
  IndexEdit,
  IndexEdit2,
  ItemSelect,
  ReferenceSelect,
  Select,
} from "~/components/Utils";
import { useData, useRemove, useAdd } from "~/components/context";
import { useClassifier, useForm, useGlyph } from "~/components/contants";
import styled from "styled-components";
import CompoundModel from "~/components/CompoundModel";
import { deepcopy, length, validUnicode } from "~/lib/utils";
import { Err, delet, post, put } from "~/lib/api";
import { Glyph } from "~/lib/data";

const Overlay = styled.div`
  border: 1px solid black;
  aspect-ratio: 1;
  display: grid;

  & svg {
    grid-area: 1 / 1 / 1 / 1;
  }
`;

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

const getValue = (
  slice: boolean,
  newName: string,
  char: string,
  glyph: Glyph,
) => {
  if (slice) {
    return {
      name: newName,
      default_type: 1,
      gf0014_id: null,
      slice: { source: char, indices: glyph.component!.map((_, i) => i) },
    } as Glyph;
  } else {
    const value = deepcopy(glyph);
    value.name = length(newName) === 1 ? null : newName;
    value.gf0014_id = null;
    return value;
  }
};

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
        const newKey = length(newName) === 1 ? newName : newChar;
        modify(newKey, value);
        setChar(newKey);
      }}
      okText="确认"
      cancelText="取消"
    >
      <Button>{slice ? "切片" : "复制"}</Button>
    </Popconfirm>
  );
};

const Toolbar = ({ char, setChar }: IndexEdit) => {
  const formCustomizations = useData().form;
  const glyph = useGlyph(char!);
  const del = useRemove();
  const modified = char !== undefined && formCustomizations[char];
  return (
    <Flex justify="center" align="center" gap="small">
      按笔画搜索
      <ItemSelect char={char} onChange={setChar} />
      按构件或源搜索
      <ReferenceSelect char={char} onChange={setChar} />
      {char && <Duplicate char={char} setChar={setChar} slice={false} />}
      {char && glyph.default_type == 0 && (
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

const ModelDispatch = ({ char }: Index) => {
  const form = useForm();
  const models = [ComponentModel, SliceModel, CompoundModel];
  const Model = models[form[char].default_type];
  return <Model char={char} />;
};

const ViewDispatch = ({ char }: Index) => {
  const { default_type } = useGlyph(char);
  const views = [ComponentView, SliceView, CompoundView];
  const View = views[default_type];
  return <View char={char} />;
};

const GeneralModel = ({ char }: Index) => {
  const glyph = useGlyph(char);
  const options = [
    { label: "部件", value: 0 },
    { label: "切片", value: 1 },
    { label: "复合体", value: 2 },
  ];
  const modify = useAdd();
  return (
    <>
      <Form.Item label="序号">{char.codePointAt(0)!}</Form.Item>
      <Form.Item label="类型">
        <Radio.Group
          options={options}
          optionType="button"
          value={glyph.default_type}
        />
      </Form.Item>
      <Form.Item label="名称">
        <Input
          value={glyph.name || ""}
          onChange={(event) => {
            modify(char, { ...glyph, name: event.target.value });
          }}
        />
      </Form.Item>
      <Form.Item label="GF0014-2009 序号">{glyph.gf0014_id}</Form.Item>
      <ModelDispatch char={char} />
    </>
  );
};

const FormData = () => {
  const [char, setChar] = useState<string | undefined>(undefined);
  return (
    <Flex vertical gap="middle" style={{ height: "100%" }}>
      <Toolbar char={char} setChar={setChar} />
      <EditorRow style={{ flex: 1 }}>
        <EditorColumn span={12}>
          <Typography.Title level={2}>查看字形</Typography.Title>
          <Overlay>{char ? <ViewDispatch char={char} /> : <Empty />}</Overlay>
        </EditorColumn>
        <EditorColumn span={12}>
          <Typography.Title level={2}>调整数据</Typography.Title>
          {char ? <GeneralModel char={char} /> : <Empty />}
        </EditorColumn>
      </EditorRow>
    </Flex>
  );
};

export default FormData;
