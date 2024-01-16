import { useChaifenTitle } from "~/lib/hooks";
import { Button, Flex, Space, Typography, Upload } from "antd";
import { WritableAtom, infoAtom, useAtom } from "~/atoms";
import { Info } from "~/lib/config";
import ExportButtons from "~/components/ExportButtons";
import {
  ProForm,
  ProFormText,
  ProFormTextArea,
} from "@ant-design/pro-components";
import { EditorColumn, EditorRow, Uploader } from "~/components/Utils";
import {
  userCharacterFrequencyAtom,
  userKeyDistributionAtom,
  userPairEquivalenceAtom,
  userWordFrequencyAtom,
} from "~/atoms/assets";
import { parseTSV } from "~/lib/utils";

function AssetUploader({
  atom,
  title,
  description,
}: {
  atom: typeof userCharacterFrequencyAtom;
  title: string;
  description: string;
}) {
  const [value, setValue] = useAtom(atom);
  return (
    <>
      <Flex align="baseline" gap="middle">
        <Typography.Title level={3}>{title}</Typography.Title>
        <div style={{ flex: 1 }} />
        <Uploader type="txt" action={(text) => setValue(parseTSV(text))} />
        <Button disabled={value === null} onClick={() => setValue(null)}>
          清空
        </Button>
      </Flex>
      <Typography.Paragraph>{description}</Typography.Paragraph>
      {value !== null && (
        <Typography.Paragraph>
          已加载用户自定义文件，条目数量：{Object.entries(value).length}。
        </Typography.Paragraph>
      )}
    </>
  );
}

export default function () {
  useChaifenTitle("基本信息");
  const [info, setInfo] = useAtom(infoAtom);
  return (
    <EditorRow>
      <EditorColumn span={12}>
        <Typography.Title level={2}>方案</Typography.Title>
        <Typography.Title level={3}>管理配置</Typography.Title>
        <ExportButtons />
        <Typography.Title level={3}>基本信息</Typography.Title>
        <ProForm<Info>
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
      </EditorColumn>
      <EditorColumn span={12}>
        <Typography.Title level={2}>资料</Typography.Title>
        <Typography.Paragraph>
          以下是系统在测评方案时使用的一些资料。您可以使用自己的资料来替换系统默认的资料，格式为以
          Tab 分隔的值（TSV），一栏为字词或编码，一栏为数值。
        </Typography.Paragraph>
        <AssetUploader
          title="字频"
          description="系统默认采用的字频来自形码测评系统。您可以在此处自定义字频。"
          atom={userCharacterFrequencyAtom}
        />
        <AssetUploader
          title="词频"
          description="系统默认采用的词频来自形码测评系统。您可以在此处自定义词频。"
          atom={userWordFrequencyAtom}
        />
        <AssetUploader
          title="当量"
          description="系统默认采用的双键速度当量来自陈一凡的论文。您可以在此处自定义当量。"
          atom={userPairEquivalenceAtom}
        />
        <AssetUploader
          title="用指分布"
          description="系统默认采用的理想用指分布是我拍脑袋想出来的。您可以在此处自定义用指分布。"
          atom={userKeyDistributionAtom}
        />
      </EditorColumn>
    </EditorRow>
  );
}
