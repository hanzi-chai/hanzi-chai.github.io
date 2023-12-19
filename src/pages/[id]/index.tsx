import React, { useContext, useEffect } from "react";
import { useChaifenTitle } from "~/lib/hooks";
import { Button, Col, Form, Input, Row, Space, Typography } from "antd";
import { useAtomValue, configInfoAtom, useSetAtom, setInfoAtom } from "~/atoms";
import { Config } from "~/lib/config";
import { useForm } from "antd/es/form/Form";
import ExportButtons from "~/components/ExportButtons";

type IInfo = Config["info"];

const Info: React.FC = () => {
  const info = useAtomValue(configInfoAtom);
  const [antdForm] = useForm();
  const setInfo = useSetAtom(setInfoAtom);
  useChaifenTitle("基本信息");
  useEffect(() => {
    antdForm.setFieldsValue(info);
  }, [info]);
  return (
    <Space direction="vertical">
      <Typography.Title level={3}>导出配置</Typography.Title>
      <ExportButtons />

      <Typography.Title level={3}>基本信息</Typography.Title>
      <Form<IInfo>
        style={{
          minWidth: "28rem",
        }}
        form={antdForm}
        labelCol={{ span: 6 }}
        wrapperCol={{ span: 16 }}
        initialValues={info}
        onFinish={(values) => setInfo(values)}
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
    </Space>
  );
};

export default Info;
