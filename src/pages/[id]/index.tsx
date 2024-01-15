import { useChaifenTitle } from "~/lib/hooks";
import { Space, Typography } from "antd";
import { infoAtom, useAtom } from "~/atoms";
import { Info } from "~/lib/config";
import ExportButtons from "~/components/ExportButtons";
import {
  ProForm,
  ProFormText,
  ProFormTextArea,
} from "@ant-design/pro-components";

export default function () {
  const [info, setInfo] = useAtom(infoAtom);
  useChaifenTitle("基本信息");
  return (
    <Space direction="vertical">
      <Typography.Title level={3}>管理配置</Typography.Title>
      <ExportButtons />
      <Typography.Title level={3}>基本信息</Typography.Title>
      <ProForm<Info>
        style={{
          minWidth: "28rem",
        }}
        layout="horizontal"
        labelCol={{ span: 6 }}
        wrapperCol={{ span: 16 }}
        initialValues={info}
        onValuesChange={(_, values) => setInfo(values)}
        submitter={false}
      >
        <ProFormText label="方案名称" name="name" />
        <ProFormText label="作者" name="author" />
        <ProFormText label="版本" name="version" />
        <ProFormTextArea label="描述" name="description" />
      </ProForm>
    </Space>
  );
}
