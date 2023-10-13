import {
  Button,
  Dropdown,
  Flex,
  Layout,
  List,
  MenuProps,
  Typography,
} from "antd";
import styled from "styled-components";
import { Config } from "../lib/config";
import { useEffect, useState } from "react";
import defaultConfig from "../templates/default.yaml";
import xingyin from "../templates/xingyin.yaml";
import { Link } from "react-router-dom";
import { v4 as uuid } from "uuid";

const Sider = styled(Layout.Sider)`
  background: white !important;

  & .ant-layout-sider-children {
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
`;

const Content = styled(Layout.Content)`
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 64px;
`;

const File = styled(List.Item)`
  padding: 8px 32px !important;
`;

const FileList = styled(List)`
  margin: 32px 0;
` as typeof List;

const items: MenuProps["items"] = [
  {
    label: "默认模板",
    key: "default",
  },
  {
    label: "形音码模板",
    key: "xingyin",
  },
  {
    label: "形码模板",
    key: "xingma",
    disabled: true,
  },
  {
    label: "二笔模板",
    key: "erbi",
    disabled: true,
  },
];

const configMap = new Map<string, Config>([
  ["default", defaultConfig as Config],
  ["xingyin", xingyin as Config],
]);

const HomeLayout = () => {
  const [configs, setConfigs] = useState({} as Record<string, Config>);
  const handleRemove = (id: string) => {
    const newConfigs = { ...configs };
    delete newConfigs[id];
    localStorage.removeItem(id);
    setConfigs(newConfigs);
  };
  const handleAdd: MenuProps["onClick"] = (e) => {
    const config = configMap.get(e.key)!;
    const id = uuid();
    localStorage.setItem(id, JSON.stringify(config));
    setConfigs(Object.assign({}, configs, { [id]: config }));
  };

  // read previous data
  useEffect(() => {
    const previousConfigs = {} as Record<string, Config>;
    for (let i = 0; i != localStorage.length; ++i) {
      const key = localStorage.key(i)!;
      const data = JSON.parse(localStorage.getItem(key)!);
      previousConfigs[key] = data;
    }
    setConfigs(previousConfigs);
  }, []);

  return (
    <Layout>
      <Sider width={320}>
        <FileList
          itemLayout="horizontal"
          dataSource={Object.entries(configs)}
          renderItem={([id, { info }]) => {
            return (
              <File
                actions={[
                  <Link to={id}>编辑</Link>,
                  <a onClick={() => handleRemove(id)}>删除</a>,
                ]}
              >
                <List.Item.Meta
                  title={info.name}
                  description={info.description}
                />
              </File>
            );
          }}
        />
        <Flex justify="center">
          <Dropdown
            placement="bottom"
            menu={{
              items,
              onClick: handleAdd,
            }}
          >
            <Button type="primary">新建</Button>
          </Dropdown>
        </Flex>
      </Sider>
      <Content>
        <img alt="favicon" src="/favicon.ico" />
        <Typography.Title>汉字自动拆分系统</Typography.Title>
      </Content>
    </Layout>
  );
};

export default HomeLayout;
