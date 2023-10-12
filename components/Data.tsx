import ComponentModel from "./ComponentModel";
import { ComponentView, SliceView } from "./SVGView";
import { useState } from "react";
import styled from "styled-components";
import { Empty, Menu, MenuProps, Typography } from "antd";
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
import EditableTable from "./EditableTable";
import SVGView from "./SVGView";
import SliceModel from "./SliceModel";
import { EditorColumn, EditorRow, Switcher } from "./Utils";

const items: MenuProps["items"] = [
  {
    label: "部件",
    key: "component",
    icon: <BorderOutlined />,
  },
  {
    label: "复合体",
    key: "compound",
    icon: <AppstoreOutlined />,
  },
  {
    label: "字音",
    key: "character",
    icon: <InfoCircleOutlined />,
  },
  {
    label: "切片",
    key: "slice",
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
    <>
      <Switcher
        items={items}
        mode="horizontal"
        selectedKeys={[mode]}
        onClick={(e) => {
          navigate(e.key);
        }}
      />
      <Outlet />
    </>
  );
}

const ComponentData = () => {
  const [name, setName] = useState(undefined as string | undefined);
  const [sequence, setSequence] = useState("");
  return (
    <EditorRow>
      <EditorColumn span={8}>
        <Typography.Title level={2}>选择部件</Typography.Title>
        <StrokeSearch sequence={sequence} setSequence={setSequence} />
        <ComponentPool name={name} setName={setName} sequence={sequence} />
      </EditorColumn>
      <EditorColumn span={8}>
        <SVGView>{name ? <ComponentView name={name} /> : <Empty />}</SVGView>
      </EditorColumn>
      <EditorColumn span={8}>
        <ComponentModel name={name} />
      </EditorColumn>
    </EditorRow>
  );
};

const SliceData = () => {
  const [name, setName] = useState(undefined as string | undefined);
  const [sequence, setSequence] = useState("");
  return (
    <EditorRow>
      <EditorColumn span={8}>
        <Typography.Title level={2}>选择切片</Typography.Title>
        <StrokeSearch sequence={sequence} setSequence={setSequence} />
        <SlicePool name={name} setName={setName} sequence={sequence} />
      </EditorColumn>
      <EditorColumn span={8}>
        <SVGView>{name ? <SliceView name={name} /> : <Empty />}</SVGView>
      </EditorColumn>
      <EditorColumn span={8}>
        <Typography.Title level={2}>选择笔画</Typography.Title>
        {name ? <SliceModel name={name} /> : <Empty />}
      </EditorColumn>
    </EditorRow>
  );
};

const CompoundData = () => {
  const [name, setName] = useState(undefined as string | undefined);
  const [sequence, setSequence] = useState("");
  return (
    <EditorRow>
      <EditorColumn span={16}>
        <Typography.Title level={2}>选择复合体</Typography.Title>
        <StrokeSearch sequence={sequence} setSequence={setSequence} />
        <CompoundPool name={name} setName={setName} sequence={sequence} />
      </EditorColumn>
      <EditorColumn span={8}>
        <CompoundModel name={name} />
      </EditorColumn>
    </EditorRow>
  );
};

const CharacterData = EditableTable;

export { ComponentData, CompoundData, CharacterData, SliceData };
