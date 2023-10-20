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
import StrokeSearch from "./StrokeSearch";
import CompoundModel from "./CompoundModel";
import { ComponentPool, CompoundPool, SlicePool } from "./Pool";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import CharacterTable from "./CharacterTable";
import SliceModel from "./SliceModel";
import { EditorColumn, EditorRow, Select } from "./Utils";
import {
  useAll,
  useClassifier,
  useComponents,
  useCompounds,
  useData,
  useDelete,
  useModify,
  useSlices,
} from "./context";
import { makeSequenceFilter, makeSequenceFilter2 } from "../lib/form";
import styled from "styled-components";
import { Glyph } from "../lib/data";

const items: MenuProps["items"] = [
  {
    label: "部件",
    key: "components",
    icon: <BorderOutlined />,
  },
  {
    label: "复合体",
    key: "compounds",
    icon: <AppstoreOutlined />,
  },
  {
    label: "汉字",
    key: "characters",
    icon: <InfoCircleOutlined />,
  },
  {
    label: "切片",
    key: "slices",
    icon: <MenuOutlined />,
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
  type,
}: {
  name?: string;
  setName: (s: string) => void;
  type: "components" | "slices" | "compounds";
}) => {
  const components = useComponents();
  const classifier = useClassifier();
  const slices = useSlices();
  const compounds = useCompounds();
  let content: Record<string, any>;
  switch (type) {
    case "components":
      content = components;
      break;
    case "compounds":
      content = compounds;
      break;
    case "slices":
      content = Object.fromEntries(
        Object.entries(slices).map(([x, v]) => {
          const parent = components[v.source];
          const g = v.indices.map((x) => parent[x]);
          return [x, g] as [string, Glyph];
        }),
      );
      break;
  }
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
      filterOption={
        type !== "compounds"
          ? (input, option) =>
              makeSequenceFilter2(classifier, input)(content[option!.value])
          : undefined
      }
      filterSort={
        type !== "compounds"
          ? (a, b) => {
              return content[a.value].length - content[b.value].length;
            }
          : undefined
      }
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
  type,
}: {
  name?: string;
  setName: (s?: string) => void;
  type: "components" | "compounds" | "slices";
}) => {
  const c1 = useData()[type];
  const c2 = useAll()[type];
  const del = useDelete();
  const modify = useModify();
  const [newname, setNewname] = useState("");
  return (
    <Flex justify="center" align="center" gap="small">
      选择部件
      <ItemSelect type={type} name={name} setName={setName} />
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

const ComponentData = () => {
  const [name, setName] = useState(undefined as string | undefined);
  return (
    <Flex vertical gap="middle" style={{ height: "100%" }}>
      <Toolbar type="components" name={name} setName={setName} />
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
      <Toolbar type="slices" name={name} setName={setName} />
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

const CompoundData = () => {
  const [name, setName] = useState(undefined as string | undefined);
  return (
    <Flex vertical gap="middle" style={{ height: "100%" }}>
      <Toolbar type="compounds" name={name} setName={setName} />
      <EditorRow>
        <EditorColumn span={12} offset={6}>
          <Typography.Title level={2}>调整数据</Typography.Title>
          {name ? <CompoundModel name={name} /> : <Empty />}
        </EditorColumn>
      </EditorRow>
    </Flex>
  );
};

const CharacterData = CharacterTable;

export { ComponentData, CompoundData, CharacterData, SliceData };
