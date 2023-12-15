import { Button, Form, Input, Modal, Select } from "antd";
import { useState } from "react";
import type { StarterType } from "~/lib/templates";
import {
  classifierTypes,
  createConfig,
  encoderTypes,
  formTypes,
} from "~/lib/templates";
import type { Updater } from "use-immer";
import type { Config } from "~/lib/config";
import { nanoid } from "@reduxjs/toolkit";

const Starter = ({
  setConfigs,
}: {
  setConfigs: Updater<Record<string, Config>>;
}) => {
  const [modal, setModal] = useState(false);
  const required = [{ required: true }];
  return (
    <>
      <Button type="primary" onClick={() => setModal(true)}>
        新建
      </Button>
      <Modal
        title="方案模板"
        open={modal}
        footer={
          <Button form="starter" key="submit" type="primary" htmlType="submit">
            确定
          </Button>
        }
        onCancel={() => setModal(false)}
      >
        <Form
          id="starter"
          labelCol={{ span: 8 }}
          wrapperCol={{ span: 16 }}
          onFinish={(values) => {
            const config = createConfig(values);
            setModal(false);
            setConfigs((configs) => {
              configs[nanoid(9)] = config;
              return undefined;
            });
          }}
        >
          <Form.Item<StarterType> name="name" label="方案名称" rules={required}>
            <Input />
          </Form.Item>
          <Form.Item<StarterType>
            name="data"
            label="笔画分类预设"
            rules={required}
          >
            <Select
              options={classifierTypes.map((x) => ({ value: x, label: x }))}
            />
          </Form.Item>
          <Form.Item<StarterType>
            name="form"
            label="形码布局预设"
            rules={required}
          >
            <Select options={formTypes.map((x) => ({ value: x, label: x }))} />
          </Form.Item>
          <Form.Item<StarterType>
            name="encoder"
            label="编码规则预设"
            rules={required}
          >
            <Select
              options={encoderTypes.map((x) => ({ value: x, label: x }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default Starter;
