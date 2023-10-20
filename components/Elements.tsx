import RootPicker from "./RootPicker";
import Mapping from "./Mapping";
import { Flex, Form, Layout, Menu, Typography } from "antd";
import { useContext, useState } from "react";
import {
  ConfigContext,
  useDesign,
  useIndex,
  usePhonetic,
  useCharacters,
} from "./context";
import { Outlet, useNavigate } from "react-router-dom";
import Root from "./Root";
import ElementAdder from "./ElementAdder";
import { EditorColumn, EditorRow, Select } from "./Utils";
import { isEmpty } from "underscore";
import PhoneticPicker from "./PhoneticPicker";

const Elements = () => {
  const navigate = useNavigate();
  const index = useIndex();
  return (
    <Layout style={{ flex: 1, display: "flex" }}>
      <Layout.Sider theme="light">
        <Menu
          items={[
            { key: "form", label: "字形" },
            { key: "pronunciation", label: "字音" },
          ]}
          selectedKeys={[index.toString()]}
          onClick={(e) => {
            navigate(e.key);
          }}
        />
      </Layout.Sider>
      <div style={{ padding: "0 32px", height: "100%", flexGrow: 1 }}>
        <Outlet />
      </div>
    </Layout>
  );
};

export const RootElementConfig = () => {
  return (
    <EditorRow>
      <EditorColumn span={8}>
        <Typography.Title level={2}>来源</Typography.Title>
        <RootPicker />
      </EditorColumn>
      <EditorColumn span={16}>
        <Typography.Title level={2}>键盘映射</Typography.Title>
        <Mapping />
      </EditorColumn>
    </EditorRow>
  );
};

export const PhoneticElementConfig = () => {
  return (
    <EditorRow>
      <EditorColumn span={8}>
        <Typography.Title level={2}>来源</Typography.Title>
        <PhoneticPicker />
      </EditorColumn>
      <EditorColumn span={16}>
        <Typography.Title level={2}>键盘映射</Typography.Title>
        <Mapping />
      </EditorColumn>
    </EditorRow>
  );
};

export default Elements;
