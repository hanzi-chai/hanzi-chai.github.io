import FileExplorer from "./FileExplorer";
import { Page } from "./App";
import { Layout, Typography } from "antd";
import styled from "styled-components";

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

const HomeLayout = ({
  page,
  setPage,
}: {
  page: Page;
  setPage: (a: Page) => void;
}) => {
  return (
    <Wrapper>
      <Sider width={320}>
        <FileExplorer page={page} setPage={setPage} />
      </Sider>
      <Content>
        <img src="/favicon.ico" />
        <Typography.Title>汉字自动拆分系统</Typography.Title>
      </Content>
    </Wrapper>
  );
};

export default HomeLayout;
