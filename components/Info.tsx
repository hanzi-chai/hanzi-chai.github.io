import React, { useContext } from "react";
import { Form, Input, Typography } from "antd";
import { ConfigContext, DispatchContext } from "./Context";
import styled from "styled-components";

const Wrapper = styled.section`
  align-self: center;
`;

const InfoInput = ({ field }: { field: string }) => {
  const config = useContext(ConfigContext);
  const dispatch = useContext(DispatchContext);
  return (
    <Input
      value={config.info[field as "name"]}
      style={{ width: "200px" }}
      onChange={(e) =>
        dispatch({ type: "info", value: { [field]: e.target.value } })
      }
    />
  );
};

const Info: React.FC = () => {
  return (
    <Wrapper>
      <Typography.Title level={2}>基本信息</Typography.Title>
      <Form labelCol={{ span: 6 }}>
        <Form.Item label="方案名称">
          <InfoInput field="name" />
        </Form.Item>
        <Form.Item label="作者">
          <InfoInput field="author" />
        </Form.Item>
        <Form.Item label="版本">
          <InfoInput field="version" />
        </Form.Item>
        <Form.Item label="描述">
          <InfoInput field="description" />
        </Form.Item>
      </Form>
    </Wrapper>
  );
};

export default Info;
