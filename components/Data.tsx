import ComponentModel from "./ComponentModel";
import { ComponentView, SliceView } from "./SVGView";
import { useState } from "react";
import {
  Button,
  Empty,
  Flex,
  Input,
  Layout,
  Menu,
  MenuProps,
  Popconfirm,
  Popover,
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
} from "./context";
import { makeSequenceFilter } from "../lib/form";
import styled from "styled-components";
import { Component, Glyph } from "../lib/data";

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
  const content = useForm();
  const classifier = useClassifier();

  // content = Object.fromEntries(
  //   Object.entries(slices).map(([x, v]) => {
  //     const parent = form[v.source];
  //     const g = v.indices.map((x) => parent[x]);
  //     return [x, g] as [string, Component];
  //   })
  // );
  return (
    <Select
      showSearch
      placeholder="输入笔画搜索"
      options={Object.keys(content).map((x) => ({
        value: x,
        label: x,
      }))}
      value={name}
      onChange={(value) => setName(value)}
      filterOption={(input, option) =>
        makeSequenceFilter(
          classifier,
          input,
        )([option!.value, content[option!.value]])
      }
      // filterSort={(a, b) => {
      //   return content[a.value].component!.length - content[b.value].component!.length;
      // }}
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
      选择部件
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

const FormData = () => {
  const [name, setName] = useState(undefined as string | undefined);
  return (
    <Flex vertical gap="middle" style={{ height: "100%" }}>
      <Toolbar name={name} setName={setName} />
      <EditorRow style={{ flex: 1 }}>
        <EditorColumn span={12}>
          <Typography.Title level={2}>查看 SVG</Typography.Title>
          <Overlay>{name ? <ComponentView name={name} /> : <Empty />}</Overlay>
        </EditorColumn>
        <EditorColumn span={12}>
          <Typography.Title level={2}>调整数据</Typography.Title>
          {name ? <ComponentModel name={name} /> : <Empty />}
        </EditorColumn>
      </EditorRow>
    </Flex>
  );
};

const SliceData = () => {
  const [name, setName] = useState(undefined as string | undefined);
  return (
    <Flex vertical gap="middle" style={{ height: "100%" }}>
      <Toolbar name={name} setName={setName} />
      <EditorRow>
        <EditorColumn span={12}>
          <Typography.Title level={2}>查看 SVG</Typography.Title>
          <Overlay>{name ? <SliceView name={name} /> : <Empty />}</Overlay>
        </EditorColumn>
        <EditorColumn span={12}>
          <Typography.Title level={2}>选择笔画</Typography.Title>
          {name ? <SliceModel name={name} /> : <Empty />}
        </EditorColumn>
      </EditorRow>
    </Flex>
  );
};

export { FormData, SliceData };
