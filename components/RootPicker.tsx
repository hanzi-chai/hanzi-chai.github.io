import { Button, Tabs, Typography } from "antd";
import { useContext } from "react";
import styled from "styled-components";
import { DataContext } from "./Context";
import Pool from "./Pool";
import StrokeSearch from "./StrokeSearch";

const Wrapper = styled.div``;

const ButtonGroup = styled.div`
  display: flex;
  gap: 16px;
  justify-content: center;
`

const RootPicker = () => {
  return (
    <Wrapper>
      <Typography.Title level={2}>来源</Typography.Title>
      <StrokeSearch />
      <Tabs
        defaultActiveKey="1"
        centered
        items={[
          { label: "部件", key: "1" },
          { label: "复合体", key: "2" },
        ]}
      />
      <Pool />
      <ButtonGroup>
        <Button>切片</Button>
        <Button>添加</Button>
      </ButtonGroup>
    </Wrapper>
  );
};

export default RootPicker;
