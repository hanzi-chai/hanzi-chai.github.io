import {
  ProForm,
  ProFormText,
  ProFormTextArea,
} from "@ant-design/pro-components";
import { Button, Flex, Input, Select, Typography } from "antd";
import { type ReactNode, useEffect, useState } from "react";
import {
  type Atom,
  useAtom,
  useAtomValue,
  useSetAtom,
  type WritableAtom,
  原始字库数据原子,
  基本信息原子,
  字集指示原子,
  用户当量映射原子,
  用户词典原子,
  用户键位分布目标原子,
  自定义分析数据库,
  默认当量原子,
  默认词典原子,
  默认键位分布目标原子,
} from "~/atoms";
import { EditorColumn, EditorRow, Uploader } from "~/components/Utils";
import {
  type 基本信息,
  type 字集指示,
  字集过滤查找表,
  字集过滤选项,
  序列化当量映射,
  序列化词典,
  序列化键位频率目标,
  type 当量映射,
  解析当量映射,
  解析自定义元素,
  解析词典,
  解析键位分布目标,
  type 词典,
  读取表格,
  type 键位分布目标,
} from "~/lib";
import { exportTSV, useChaifenTitle } from "~/utils";

function AssetUploader<V extends 当量映射 | 键位分布目标 | 词典 | string[]>({
  atom,
  defaultAtom,
  title,
  format,
  description,
  parser,
  dumper,
}: {
  atom: WritableAtom<V | undefined, any, any>;
  defaultAtom: Atom<Promise<V>> | Atom<V>;
  title: string;
  format: string;
  description: ReactNode;
  parser: (tsv: string[][]) => V;
  dumper?: (value: V) => string[][];
}) {
  const [value, setValue] = useAtom(atom);
  const defaultValue = useAtomValue(defaultAtom);
  return (
    <>
      <Flex align="baseline" justify="space-between">
        <Typography.Title level={3}>{title}</Typography.Title>
        <Flex gap="middle">
          {defaultValue && dumper && (
            <Button
              onClick={() => exportTSV(dumper(defaultValue), `${title}.txt`)}
            >
              下载预置
            </Button>
          )}
          <Uploader
            type=".txt"
            action={(text) => setValue(parser(读取表格(text)))}
          />
          <Button
            disabled={value === undefined}
            onClick={() => setValue(undefined)}
          >
            清空
          </Button>
        </Flex>
      </Flex>
      <Typography.Paragraph>
        格式：<code>{format}</code>
      </Typography.Paragraph>
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
  const entries = useAtomValue(自定义分析数据库.entries);
  const set = useSetAtom(自定义分析数据库.set);
  const del = useSetAtom(自定义分析数据库.delete);
  const [name, setName] = useState("");
  return (
    <Flex vertical gap="middle">
      {entries.map(([name, map]) => {
        return (
          <Flex key={name} align="baseline" justify="space-between">
            <Typography.Text>
              {name}（条目数量：{Object.entries(map).length}）
            </Typography.Text>
            <Flex gap="middle">
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
              <Button onClick={() => del(name)}>清空</Button>
            </Flex>
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
          type=".txt"
          disabled={name === ""}
          action={(text) => {
            const tsv = 读取表格(text);
            const 自定义元素 = 解析自定义元素(tsv);
            set(name, 自定义元素);
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
  const [字集指示, 设置字集指示] = useAtom(字集指示原子);
  const 原始字库数据 = useAtomValue(原始字库数据原子);
  const counter = Object.fromEntries(
    Object.keys(字集过滤查找表).map((key) => [key as 字集指示, 0]),
  ) as Record<字集指示, number>;
  for (const [name, data] of Object.entries(原始字库数据)) {
    for (const key of Object.keys(counter) as 字集指示[]) {
      const fn = 字集过滤查找表[key];
      if (fn(name, data)) counter[key]++;
    }
  }

  return (
    <EditorRow>
      <EditorColumn span={12}>
        <Typography.Title level={2}>方案</Typography.Title>
        <ConfigInfo />
        <Flex align="baseline" justify="space-between">
          <Typography.Title level={3}>字集</Typography.Title>
          <Select<字集指示>
            value={字集指示}
            onChange={(value) => 设置字集指示(value)}
            options={字集过滤选项}
          />
        </Flex>
        <Typography.Paragraph>字集将用于对词库进行过滤。</Typography.Paragraph>
        <ul>
          <li>
            极简（{counter.minimal} 个字符）即 GB2312
            和《通用规范汉字表》的交集中的所有字符；
          </li>
          <li>GB2312（{counter.gb2312} 个字符）即 GB2312 中的所有字符；</li>
          <li>
            通用（{counter.general} 个字符）即《通用规范汉字表》中的所有字符；
          </li>
          <li>
            基本（{counter.basic}
            个字符）是在通用字集的基础上增加了所有中日韩统一表意文字基本区的字符；
          </li>
          <li>
            扩展（{counter.extended}
            个字符）是在基本字集的基础上增加了所有中日韩统一表意文字扩展区 A-J
            的字符；
          </li>
          <li>
            补充（{counter.supplement}
            个字符）是在扩展字集的基础上增加了中日韩笔画、康熙部首、中日韩部首补充、中日韩兼容表意文字、中日韩兼容表意文字补充、以及中日韩符号和标点中的「〇」；
          </li>
          <li>
            全部（{counter.maximal}
            个字符）是在补充字集的基础上增加了西夏文、西夏文构件、西夏文补充、契丹小字；
          </li>
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
          format="词\t拼音（音节之间空格分隔）\t频率"
          description={
            <span>
              系统默认采用的一字词即全部字集，多字词来自「玲珑词库」（共 69429
              条）。一字词属通用规范汉字的采用《通用规范汉字字典》注音，其余采用&nbsp;
              <a
                href="https://github.com/mozillazg/pinyin-data"
                target="_blank"
                rel="noopener noreferrer"
              >
                pinyin-data
              </a>
              &nbsp;注音，未收录则标记为无音。
            </span>
          }
          atom={用户词典原子}
          defaultAtom={默认词典原子}
          parser={解析词典}
          dumper={序列化词典}
        />
        <AssetUploader
          title="当量"
          format="字符串\t速度当量"
          description="系统默认采用的速度当量来自陈一凡的论文。您可以在此处自定义当量。"
          atom={用户当量映射原子}
          defaultAtom={默认当量原子}
          parser={解析当量映射}
          dumper={序列化当量映射}
        />
        <AssetUploader
          title="键位分布目标"
          format="键位\t理想值\t小于理想值惩罚系数\t大于理想值惩罚系数"
          description="系统默认采用的键位分布目标是我拍脑袋想出来的。您可以在此处自定义键位分布目标。"
          atom={用户键位分布目标原子}
          defaultAtom={默认键位分布目标原子}
          parser={解析键位分布目标}
          dumper={序列化键位频率目标}
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
