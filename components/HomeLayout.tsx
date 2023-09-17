import { Button, Layout, List, Typography } from "antd";
import styled from "styled-components";
import { Config } from "../lib/chai";
import { useEffect, useState } from "react";
import defaultConfig from "../default.yaml";
import { Link, useNavigate } from "react-router-dom";
import { v4 as uuid } from "uuid";

const Wrapper = styled(Layout)`
  height: 100%;
`;

const Sider = styled(Layout.Sider)`
  background: white !important;

  & .ant-layout-sider-children {
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
`;

const ActionGroup = styled.div`
  text-align: center;
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

const HomeLayout = () => {
  const [configs, setConfigs] = useState({} as Record<string, Config>);
  const handleRemove = (id: string) => {
    const newConfigs = { ...configs };
    delete newConfigs[id];
    localStorage.removeItem(id);
    setConfigs(newConfigs);
  };
  const handleAdd = () => {
    const id = uuid();
    localStorage.setItem(id, JSON.stringify(defaultConfig));
    setConfigs(Object.assign({}, configs, { [id]: defaultConfig }));
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
    <Wrapper>
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
        <ActionGroup>
          <Button type="primary" onClick={handleAdd}>
            新建
          </Button>
        </ActionGroup>
      </Sider>
      <Content>
        <img alt="favicon" src="/favicon.ico" />
        <Typography.Title>汉字自动拆分系统</Typography.Title>
      </Content>
    </Wrapper>
  );
};

export default HomeLayout;
