import { GlobalProps, Page } from "./App";
import { Button, Layout, List, Typography } from "antd";
import styled from "styled-components";
import { Config } from "../lib/chai";
import { Dispatch, useContext } from "react";
import { Action, DispatchContext } from "./Context";
import defaultConfig from "../default.yaml";

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

const Content = styled(Layout.Content)`
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 64px;
`;

const File = styled(List.Item)`
  padding: 0 32px !important;
`;

const FileList = styled(List)`
  margin: 32px 0;
` as typeof List;

const HomeLayout = ({ setPage, configs, setConfigs }: GlobalProps) => {
  const dispatch = useContext(DispatchContext);
  return (
    <Wrapper>
      <Sider width={320}>
        <FileList
          itemLayout="horizontal"
          dataSource={configs}
          renderItem={(config) => {
            const { info } = config;
            return (
              <File
                actions={[
                  <a
                    onClick={() => {
                      dispatch({ type: "load", content: config });
                      setPage("info");
                    }}
                  >
                    编辑
                  </a>,
                  <a
                    onClick={() => {
                      setConfigs(configs.filter(x => x.info.id !== info.id));
                    }}
                  >
                    删除
                  </a>,
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
        <div style={{ textAlign: "center" }}>
          <Button type="primary" onClick={() => setConfigs(configs.concat(defaultConfig as Config))}>
            新建
          </Button>
        </div>
      </Sider>
      <Content>
        <img src="/favicon.ico" />
        <Typography.Title>汉字自动拆分系统</Typography.Title>
      </Content>
    </Wrapper>
  );
};

export default HomeLayout;
