import { Button, Flex, Input, Space, Typography, Upload } from "antd";
import {
  type Atom,
  type SetStateAction,
  type WritableAtom,
  默认词典原子,
  基本信息原子,
  默认键位分布目标原子,
  默认当量原子,
  useAtom,
  useAtomValue,
} from "~/atoms";
import {
  type 词典,
  type 键位分布目标,
  type 当量映射,
  解析词典,
  解析键位分布目标,
  基本信息,
  读取表格,
  解析自定义元素,
  解析当量映射,
} from "~/lib";
import ConfigManager from "~/components/ConfigManager";
import {
  ProForm,
  ProFormText,
  ProFormTextArea,
} from "@ant-design/pro-components";
import { EditorColumn, EditorRow, Uploader } from "~/components/Utils";
import {
  用户键位分布原子,
  用户双键当量原子,
  用户词典原子,
  自定义元素集合原子,
} from "~/atoms";
import { useEffect, useState } from "react";
import { exportTSV, useChaifenTitle } from "~/utils";

const getTSVFromRecord = (record: 当量映射) =>
  Object.entries(record).map(([k, v]) => [k, v.toString()]);

const getTSVFromDict = (dict: 词典) => {
  return dict.map(({ 词, 拼音, 频率 }) => [
    词,
    拼音.join(" "),
    频率.toString(),
  ]);
};

const getTSVFromDistribution = (distribution: 键位分布目标) => {
  return Object.entries(distribution).map(([k, v]) => {
    const { ideal, lt_penalty, gt_penalty } = v;
    return [k, ideal.toString(), lt_penalty.toString(), gt_penalty.toString()];
  });
};

function AssetUploader<V extends 当量映射 | 键位分布目标 | 词典 | string[]>({
  atom,
  defaultAtom,
  title,
  description,
  parser,
  dumper,
}: {
  atom: WritableAtom<V | undefined, [SetStateAction<V | undefined>], void>;
  defaultAtom: Atom<Promise<V>> | Atom<V>;
  title: string;
  description: string;
  parser: (tsv: string[][]) => V;
  dumper?: (value: V) => string[][];
}) {
  const [value, setValue] = useAtom(atom);
  const defaultValue = useAtomValue(defaultAtom);
  return (
    <>
      <Flex align="baseline" gap="middle">
        <Typography.Title level={3}>{title}</Typography.Title>
        <div style={{ flex: 1 }} />
        {defaultValue && dumper && (
          <Button
            onClick={() => exportTSV(dumper(defaultValue), `${title}.txt`)}
          >
            下载预置
          </Button>
        )}
        <Uploader
          type="txt"
          action={(text) => {
            const tsv = 读取表格(text);
            setValue(parser(tsv));
          }}
        />
        <Button
          disabled={value === undefined}
          onClick={() => setValue(undefined)}
        >
          清空
        </Button>
      </Flex>
      <Typography.Paragraph>{description}</Typography.Paragraph>
      {value !== undefined && (
        <Typography.Paragraph>
          已加载用户自定义文件，条目数量：{Object.entries(value).length}。
        </Typography.Paragraph>
      )}
    </>
  );
}

const CustomElementUploader = () => {
  const [customElements, setCustomElements] = useAtom(自定义元素集合原子);
  const [name, setName] = useState("");
  return (
    <Flex vertical gap="middle">
      {Object.entries(customElements).map(([name, map]) => {
        return (
          <Flex key={name} align="baseline" gap="middle">
            <Typography.Text>
              {name}（条目数量：{Object.entries(map).length}）
            </Typography.Text>
            <div style={{ flex: 1 }} />
            <Button
              onClick={() =>
                exportTSV(
                  Object.entries(map).map(([k, v]) => [k, v.join(" ")]),
                  `${name}.txt`,
                )
              }
            >
              下载
            </Button>
            <Button
              onClick={() => {
                const { [name]: _, ...rest } = customElements;
                setCustomElements(rest);
              }}
            >
              清空
            </Button>
          </Flex>
        );
      })}
      <Flex gap="large">
        <Input
          value={name}
          placeholder="自定义元素名称"
          onChange={(e) => setName(e.target.value)}
        />
        <Uploader
          type="txt"
          disabled={name === ""}
          action={(text) => {
            const tsv = 读取表格(text);
            const 自定义元素 = 解析自定义元素(tsv);
            setCustomElements({ ...customElements, [name]: 自定义元素 });
          }}
        />
      </Flex>
    </Flex>
  );
};

const ConfigInfo = () => {
  const [info, setInfo] = useAtom(基本信息原子);
  const [form] = ProForm.useForm<基本信息>();
  useEffect(() => {
    form.setFieldsValue(info);
  }, [info]);
  return (
    <>
      <Typography.Title level={3}>基本信息</Typography.Title>
      <ProForm<基本信息>
        form={form}
        layout="horizontal"
        labelCol={{ span: 6 }}
        wrapperCol={{ span: 16 }}
        initialValues={info}
        onValuesChange={(_, values) => setInfo(values)}
        submitter={false}
        autoFocusFirstInput={false}
      >
        <ProFormText label="方案名称" name="name" />
        <ProFormText label="作者" name="author" />
        <ProFormText label="版本" name="version" />
        <ProFormTextArea label="描述" name="description" />
      </ProForm>
    </>
  );
};

export default function Index() {
  useChaifenTitle("基本信息");
  return (
    <EditorRow>
      <EditorColumn span={12}>
        <Typography.Title level={2}>方案</Typography.Title>
        <Typography.Title level={3}>管理配置</Typography.Title>
        <ConfigManager />
        <ConfigInfo />
        <Flex align="baseline" justify="space-between">
          <Typography.Title level={3}>字集</Typography.Title>
        </Flex>
        <Typography.Paragraph>
          字集是系统所处理的字符集合，您可以选择通用、基本或扩展三者之一。字集越大，您的方案能输入的字符就越多，但是在拆分时要考虑的字形种类也就更多。建议您从通用字集开始，根据实际需要逐步扩展。
        </Typography.Paragraph>
        <ul>
          <li>
            极简（6638 个字符）即 GB2312
            和《通用规范汉字表》的交集中的所有字符；
          </li>
          <li>GB2312（6763 个字符）即 GB2312 中的所有字符；</li>
          <li>通用（8105 个字符）即《通用规范汉字表》中的所有字符；</li>
          <li>
            基本（21265
            个字符）是在通用字集的基础上增加了所有中日韩统一表意文字基本区的字符；
          </li>
          <li>
            扩展（97668
            个字符）是在基本字集的基础上增加了所有中日韩统一表意文字扩展区 A-I
            的字符；
          </li>
          <li>
            补充（98000+
            个字符）是在扩展字集的基础上增加了中日韩笔画、康熙部首、中日韩部首补充、中日韩兼容表意文字、中日韩兼容表意文字补充、以及中日韩符号和标点中的「〇」；
          </li>
          <li>
            全部（100000+
            个字符）是在补充字集的基础上增加了西夏文、西夏文构件、西夏文补充、契丹小字；
          </li>
          <li>自定义即用户自定义的字符集合，可以是上述全部字符的任意子集。</li>
        </ul>
      </EditorColumn>
      <EditorColumn span={12}>
        <Typography.Title level={2}>资料</Typography.Title>
        <Typography.Paragraph>
          以下是系统在测评方案时使用的一些资料。您可以使用自己的资料来替换系统默认的资料，格式为以
          Tab
          分隔的值（TSV）。您也可以先下载系统内置的这些资料，在此基础上编辑后上传。
        </Typography.Paragraph>
        <AssetUploader
          title="词库"
          description="系统默认采用的多字词为「冰雪拼音」输入方案词库中词频前六万的多字词，并给每个词加注了带调拼音，能够推导出各种不同的输入方案的词编码。您可以在此处自定义词库，词库需要包含带调拼音。"
          atom={用户词典原子 as any}
          defaultAtom={默认词典原子}
          parser={解析词典}
          dumper={getTSVFromDict}
        />
        <AssetUploader
          title="当量"
          description="系统默认采用的双键速度当量来自陈一凡的论文。您可以在此处自定义当量。"
          atom={用户双键当量原子}
          defaultAtom={默认当量原子}
          parser={解析当量映射}
          dumper={getTSVFromRecord}
        />
        <AssetUploader
          title="用指分布"
          description="系统默认采用的理想用指分布是我拍脑袋想出来的。您可以在此处自定义用指分布。"
          atom={用户键位分布原子}
          defaultAtom={默认键位分布目标原子}
          parser={解析键位分布目标}
          dumper={getTSVFromDistribution}
        />
        <Typography.Title level={2}>自定义元素</Typography.Title>
        <Typography.Paragraph>
          您可以自定义新的元素类型，例如字根、部首、结构等等，自行分析之后导入系统使用。自定义元素的格式为每行一条记录，第一个字段为字，第二个字段为空格分隔的元素列表（即使只有一个元素，也看成是列表）。上传时，您需要指定自定义元素的名称。
        </Typography.Paragraph>
        <CustomElementUploader />
      </EditorColumn>
    </EditorRow>
  );
}
