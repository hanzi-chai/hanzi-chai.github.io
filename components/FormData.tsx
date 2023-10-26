import ComponentModel from "./ComponentModel";
import { ComponentView, CompoundView, SliceView } from "./SVGView";
import { useState } from "react";
import {
  Button,
  Empty,
  Flex,
  Form,
  Input,
  Layout,
  Menu,
  MenuProps,
  Popconfirm,
  Popover,
  Radio,
  Typography,
  notification,
} from "antd";
import SliceModel from "./SliceModel";
import {
  EditorColumn,
  EditorRow,
  Index,
  IndexEdit,
  ItemSelect,
  Select,
} from "./Utils";
import {
  useClassifier,
  useForm,
  useData,
  useDelete,
  useModify,
  useGlyph,
} from "./context";
import {
  getSequence,
  makeSequenceFilter,
  recursiveGetSequence,
} from "../lib/form";
import styled from "styled-components";
import { Component, Glyph } from "../lib/data";
import CompoundModel from "./CompoundModel";
import { deepcopy, length, validUnicode } from "../lib/utils";

const Overlay = styled.div`
  border: 1px solid black;
  aspect-ratio: 1;
  display: grid;

  & svg {
    grid-area: 1 / 1 / 1 / 1;
  }
`;

const Toolbar = ({ char, setChar }: IndexEdit) => {
  const c1 = useData().form;
  const c2 = useForm();
  const del = useDelete();
  const modify = useModify();
  const [newName, setNewName] = useState("");
  const [api] = notification.useNotification();
  return (
    <Flex justify="center" align="center" gap="small">
      选择
      <ItemSelect char={char} onChange={setChar} />
      <Popconfirm
        title="新组件名称"
        description={
          <Input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
          />
        }
        onConfirm={() => {
          if (!Array.from(newName).every(validUnicode)) {
            api.error({
              message: "名称含有非法字符",
              description:
                "合法字符的范围：0x4e00 - 0x9fff，或 0x3400 - 0x4dbf",
            });
          }
          const value = deepcopy(c2[char!]);
          value.name = null;
          value.gf0014_id = null;
          if (length(newName) === 1) {
            modify(newName, value);
            setChar(newName);
          } else {
            const code =
              Math.max(0xf000 - 1, ...Object.keys(c1).map(Number)) + 1;
            value.name = newName;
            const char = String.fromCodePoint(code);
            modify(char, value);
            setChar(char);
          }
        }}
        okText="确认"
        cancelText="取消"
      >
        <Button disabled={char === undefined}>复制</Button>
      </Popconfirm>
      <Button
        disabled={char === undefined || !c1[char]}
        onClick={() => {
          del(char!);
          setChar(undefined);
        }}
      >
        删除
      </Button>
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

const FormData = () => {
  const [char, setChar] = useState<string | undefined>(undefined);
  const form = useForm();
  const options = [
    { label: "部件", value: 0 },
    { label: "切片", value: 1 },
    { label: "复合体", value: 2 },
  ];
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
          {char ? (
            <>
              <Form.Item label="类型">
                <Radio.Group
                  options={options}
                  optionType="button"
                  value={form[char].default_type}
                />
              </Form.Item>
              <ModelDispatch char={char} />
            </>
          ) : (
            <Empty />
          )}
        </EditorColumn>
      </EditorRow>
    </Flex>
  );
};

export default FormData;
