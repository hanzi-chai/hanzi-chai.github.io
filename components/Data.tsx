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
} from "antd";
import {
  BorderOutlined,
  AppstoreOutlined,
  InfoCircleOutlined,
  MenuOutlined,
  NumberOutlined,
} from "@ant-design/icons";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import CharacterTable from "./CharacterTable";
import SliceModel from "./SliceModel";
import { EditorColumn, EditorRow, Select } from "./Utils";
import {
  useClassifier,
  useForm,
  useData,
  useDelete,
  useModify,
  useFormByChar,
} from "./context";
import {
  getSequence,
  makeSequenceFilter,
  recursiveGetSequence,
} from "../lib/form";
import styled from "styled-components";
import { Component, Glyph } from "../lib/data";
import CompoundModel from "./CompoundModel";

const items: MenuProps["items"] = [
  {
    label: "字形",
    key: "form",
    icon: <BorderOutlined />,
  },
  {
    label: "字音及字集",
    key: "repertoire",
    icon: <InfoCircleOutlined />,
  },
  {
    label: "笔画分类",
    key: "classifier",
    icon: <NumberOutlined />,
  },
];

export default function Data() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const mode = pathname.split("/")[3];
  return (
    <Layout style={{ flex: 1 }}>
      <Layout.Sider theme="light">
        <Menu
          items={items}
          selectedKeys={[mode]}
          onClick={(e) => {
            navigate(e.key);
          }}
        />
      </Layout.Sider>
      <div style={{ padding: "32px", height: "100%", flex: 1 }}>
        <Outlet />
      </div>
    </Layout>
  );
}

const ItemSelect = ({
  name,
  setName,
}: {
  name?: string;
  setName: (s: string) => void;
}) => {
  const form = useForm();
  const classifier = useClassifier();
  return (
    <Select
      showSearch
      placeholder="输入笔画搜索"
      options={Object.entries(form).map(([x, v]) => ({
        value: x,
        label: v.name || x,
      }))}
      value={name}
      onChange={(value) => setName(value)}
      filterOption={(input, option) =>
        getSequence(form, classifier, option!.value).startsWith(input)
      }
      filterSort={(a, b) => {
        return (
          getSequence(form, classifier, a.value).length -
          getSequence(form, classifier, b.value).length
        );
      }}
    />
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

const Toolbar = ({
  name,
  setName,
}: {
  name?: string;
  setName: (s?: string) => void;
}) => {
  const c1 = useData().form;
  const c2 = useForm();
  const del = useDelete();
  const modify = useModify();
  const [newname, setNewname] = useState("");
  return (
    <Flex justify="center" align="center" gap="small">
      选择
      <ItemSelect name={name} setName={setName} />
      <Popconfirm
        title="新组件名称"
        description={
          <Input
            value={newname}
            onChange={(event) => setNewname(event.target.value)}
          />
        }
        onConfirm={() => {
          if (!c2[newname]) {
            modify(newname, c2[name!]);
            setName(newname);
          }
        }}
        okText="确认"
        cancelText="取消"
      >
        <Button disabled={name === undefined}>复制</Button>
      </Popconfirm>
      <Button
        disabled={name === undefined || !c1[name]}
        onClick={() => {
          del(name!);
          setName(undefined);
        }}
      >
        删除
      </Button>
    </Flex>
  );
};

const ModelDispatch = ({ name }: { name: string }) => {
  const form = useForm();
  const models = [ComponentModel, CompoundModel, SliceModel];
  const Model = models[form[name].default_type];
  return <Model name={name} />;
};

const ViewDispatch = ({ name }: { name: string }) => {
  const { default_type } = useFormByChar(name);
  const views = [ComponentView, CompoundView, SliceView];
  const View = views[default_type];
  return <View name={name} />;
};

const FormData = () => {
  const [name, setName] = useState(undefined as string | undefined);
  const form = useForm();
  const options = [
    { label: "部件", value: 0 },
    { label: "复合体", value: 1 },
    { label: "切片", value: 2 },
  ];
  return (
    <Flex vertical gap="middle" style={{ height: "100%" }}>
      <Toolbar name={name} setName={setName} />
      <EditorRow style={{ flex: 1 }}>
        <EditorColumn span={12}>
          <Typography.Title level={2}>查看字形</Typography.Title>
          <Overlay>{name ? <ViewDispatch name={name} /> : <Empty />}</Overlay>
        </EditorColumn>
        <EditorColumn span={12}>
          <Typography.Title level={2}>调整数据</Typography.Title>
          {name ? (
            <>
              <Form.Item label="类型">
                <Radio.Group
                  options={options}
                  optionType="button"
                  value={form[name].default_type}
                />
              </Form.Item>
              <ModelDispatch name={name} />
            </>
          ) : (
            <Empty />
          )}
        </EditorColumn>
      </EditorRow>
    </Flex>
  );
};

export { FormData };
