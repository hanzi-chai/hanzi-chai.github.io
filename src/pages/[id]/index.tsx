import React, { useContext, useEffect } from "react";
import { Button, Col, Form, Input, Typography } from "antd";
import { DispatchContext, useInfo } from "~/components/context";
import { Config } from "~/lib/config";
import { useForm } from "antd/es/form/Form";

type IInfo = Config["info"];

const Info: React.FC = () => {
  const info = useInfo();
  const dispatch = useContext(DispatchContext);
  const [antdForm] = useForm();
  useEffect(() => {
    antdForm.setFieldsValue(info);
  }, [info]);
  return (
    <Col span={6}>
      <Typography.Title level={2}>基本信息</Typography.Title>
      <Form<IInfo>
        form={antdForm}
        labelCol={{ span: 8 }}
        wrapperCol={{ span: 16 }}
        initialValues={info}
        onFinish={(values) => {
          dispatch({ type: "info", value: values });
        }}
      >
        <Form.Item<IInfo> label="方案名称" name="name">
          <Input />
        </Form.Item>
        <Form.Item<IInfo> label="作者" name="author">
          <Input />
        </Form.Item>
        <Form.Item<IInfo> label="版本" name="version">
          <Input />
        </Form.Item>
        <Form.Item<IInfo> label="描述" name="description">
          <Input.TextArea />
        </Form.Item>
        <Form.Item>
          <Button type="primary" key="submit" htmlType="submit">
            更新
          </Button>
        </Form.Item>
      </Form>
    </Col>
  );
};

export default Info;
