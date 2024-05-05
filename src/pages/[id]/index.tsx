import { useChaifenTitle } from "~/components/Utils";
import { Button, Flex, Space, Typography, Upload } from "antd";
import {
  Atom,
  SetStateAction,
  WritableAtom,
  defaultDictionaryAtom,
  frequencyAtom,
  infoAtom,
  keyDistributionAtom,
  pairEquivalenceAtom,
  useAtom,
  useAtomValue,
  dictionaryAtom,
} from "~/atoms";
import { Info } from "~/lib";
import ConfigManager from "~/components/ConfigManager";
import {
  ProForm,
  ProFormText,
  ProFormTextArea,
} from "@ant-design/pro-components";
import {
  EditorColumn,
  EditorRow,
  Uploader,
  exportTSV,
} from "~/components/Utils";
import {
  userFrequencyAtom,
  userKeyDistributionAtom,
  userPairEquivalenceAtom,
  userDictionaryAtom,
} from "~/atoms/assets";
import { parseTSV } from "~/lib";

function AssetUploader<V extends Record<string, number> | [string, string][]>({
  atom,
  defaultAtom,
  title,
  description,
}: {
  atom: WritableAtom<V | null, [SetStateAction<V | null>], void>;
  defaultAtom: Atom<V>;
  title: string;
  description: string;
}) {
  const [value, setValue] = useAtom(atom);
  const defaultValue = useAtomValue(defaultAtom);
  const tsv = Array.isArray(defaultValue)
    ? defaultValue
    : Object.entries(defaultValue).map(([s, n]) => [s, n.toString()]);
  return (
    <>
      <Flex align="baseline" gap="middle">
        <Typography.Title level={3}>{title}</Typography.Title>
        <div style={{ flex: 1 }} />
        <Button onClick={() => exportTSV(tsv, `${title}.txt`)}>下载预置</Button>
        <Uploader
          type="txt"
          action={(text) => {
            const value = Array.isArray(defaultValue)
              ? text
                  .trim()
                  .split("\n")
                  .map((x) => x.trim())
              : parseTSV(text);
            setValue(value as V);
          }}
        />
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
        <ConfigManager />
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
        <Typography.Paragraph>
          您也可以先下载系统内置的这些资料，在此基础上编辑后上传。
        </Typography.Paragraph>
        <AssetUploader
          title="词频"
          description="系统默认采用的词频来自 10 亿社交媒体语料的统计结果，包含了一字词和多字词。您可以在此处自定义词频。"
          atom={userFrequencyAtom}
          defaultAtom={frequencyAtom}
        />
        <AssetUploader
          title="词库"
          description="系统默认采用的词库包含了「冰雪拼音」输入方案词库中词频前六万的多字词，并给每个词加注了带调拼音，能够推导出各种不同的输入方案的词语编码。您可以在此处自定义词库，词库需要包含带调拼音。"
          atom={userDictionaryAtom}
          defaultAtom={defaultDictionaryAtom}
        />
        <AssetUploader
          title="当量"
          description="系统默认采用的双键速度当量来自陈一凡的论文。您可以在此处自定义当量。"
          atom={userPairEquivalenceAtom}
          defaultAtom={pairEquivalenceAtom}
        />
        <AssetUploader
          title="用指分布"
          description="系统默认采用的理想用指分布是我拍脑袋想出来的。您可以在此处自定义用指分布。"
          atom={userKeyDistributionAtom}
          defaultAtom={keyDistributionAtom}
        />
      </EditorColumn>
    </EditorRow>
  );
}
