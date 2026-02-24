import {
  Flex,
  Form,
  Modal,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useAtom, useAtomValue } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { useState } from "react";
import {
  useAtomValueUnwrapped,
  决策原子,
  原始字库原子,
  如字库原子,
  汉字集合原子,
  码表数据库,
  type 联合条目,
  联合结果原子,
  配置原子,
} from "~/atoms";
import { ElementDetail } from "~/components/Mapping";
import { Uploader } from "~/components/Utils";
import {
  字数,
  type 字集指示,
  字集过滤查找表,
  字集过滤选项,
  type 码表条目,
} from "~/lib";

type 码表格式 =
  | "char_tab_code"
  | "char_space_code"
  | "code_tab_char"
  | "code_space_char";

const 码表格式选项: { label: string; value: 码表格式 }[] = [
  { label: "单字 ⇥ 编码", value: "char_tab_code" },
  { label: "单字 ␣ 编码", value: "char_space_code" },
  { label: "编码 ⇥ 单字", value: "code_tab_char" },
  { label: "编码 ␣ 单字", value: "code_space_char" },
];

function 按格式解析码表(content: string, format: 码表格式): 码表条目[] {
  const separator = format.includes("tab") ? "\t" : /\s+/;
  const charFirst = format.startsWith("char");
  const lines = content.trim().split("\n");
  const result: 码表条目[] = [];
  for (const line of lines) {
    const parts = line.split(separator);
    const [first, second] = parts;
    if (first === undefined || second === undefined) continue;
    const [词, 编码] = charFirst ? [first, second] : [second, first];
    result.push({ 词: 词!, 编码: 编码! });
  }
  return result;
}

import Element from "./Element";
import { DisplayOptionalSuperscript } from "./SequenceTable";

type 校对结果 = "correct" | "incorrect" | "unknown";

interface 校对条目 {
  词: string;
  编码: string;
  元素序列: 联合条目["元素序列"][];
  参考编码列表: string[];
  状态: 校对结果;
  标识符: string;
}

type 扩展字集指示 = 字集指示 | "components";
type 过滤 = (typeof 字集过滤查找表)[字集指示];

const 校对范围原子 = atomWithStorage(
  "debug-filter-option",
  "maximal" as 扩展字集指示,
);

const 校对方向原子 = atomWithStorage(
  "debug-direction",
  "forward" as "forward" | "reverse",
);

export default function Debugger() {
  const config = useAtomValue(配置原子) as any;
  const repertoire = useAtomValueUnwrapped(如字库原子);
  const 原始字库 = useAtomValue(原始字库原子);
  const characters = useAtomValue(汉字集合原子);
  const 联合结果 = useAtomValueUnwrapped(联合结果原子);
  const 决策 = useAtomValue(决策原子);
  const [外部码表, 设置外部码表] = useAtom(
    码表数据库.item(config.info?.name ?? "方案"),
  );
  const [只显示不正确, 设置只显示不正确] = useState(true);
  const [校对范围, 设置校对范围] = useAtom(校对范围原子);
  const [校对方向, 设置校对方向] = useAtom(校对方向原子);
  const [码表格式, 设置码表格式] = useState<码表格式>("char_tab_code");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedElement, setSelectedElement] = useState<{
    name: string;
    keys: any;
  } | null>(null);
  const 是部件: 过滤 = (c, _) =>
    characters.has(c) &&
    repertoire.查询字形(c)?.some((x) => x.type === "basic_component") === true;
  const 过滤函数 =
    校对范围 === "components" ? 是部件 : 字集过滤查找表[校对范围];
  const filterOptions = [
    {
      label: "成字部件",
      value: "components",
    },
  ].concat(字集过滤选项);

  const 外部编码映射 = new Map<string, string[]>();
  for (const { 词, 编码 } of 外部码表 || []) {
    if (!外部编码映射.has(词)) {
      外部编码映射.set(词, []);
    }
    外部编码映射.get(词)!.push(编码);
  }

  const 内部编码映射 = new Map<string, 联合条目[]>();
  for (const x of 联合结果) {
    if (!内部编码映射.has(x.词)) {
      内部编码映射.set(x.词, []);
    }
    内部编码映射.get(x.词)!.push(x);
  }

  // 处理点击元素的函数
  const handleElementClick = (elementName: string) => {
    const keys = 决策[elementName];
    if (keys) {
      setSelectedElement({ name: elementName, keys });
      setModalOpen(true);
    }
  };

  const 获取状态 = (编码列表: string[], 编码: string): 校对结果 => {
    if (编码列表.length === 0) return "unknown";
    if (!编码列表.includes(编码)) return "incorrect";
    return "correct";
  };

  const 状态统计: Record<校对结果, number> = {
    correct: 0,
    incorrect: 0,
    unknown: 0,
  };
  let dataSource: 校对条目[] = [];
  if (校对方向 === "forward") {
    for (const { 词, 全码, 元素序列 } of 联合结果) {
      const 参考编码列表 = 外部编码映射.get(词) ?? [];
      const 状态 = 获取状态(参考编码列表, 全码);
      状态统计[状态]++;
      dataSource.push({
        词,
        编码: 全码,
        元素序列: [元素序列],
        参考编码列表,
        状态,
        标识符: `${词}-${全码}`,
      });
    }
  } else {
    for (const { 词, 编码 } of 外部码表 || []) {
      const 内部列表 = 内部编码映射.get(词) ?? [];
      const 参考编码列表 = 内部列表.map((x) => x.全码);
      const 状态 = 获取状态(参考编码列表, 编码);
      状态统计[状态]++;
      dataSource.push({
        词,
        编码,
        元素序列: 内部列表.map((x) => x.元素序列),
        参考编码列表,
        状态,
        标识符: `${词}-${编码}`,
      });
    }
  }

  dataSource = dataSource.filter((x) => {
    if (字数(x.词) !== 1) return false;
    const data = 原始字库.查询(x.词);
    if (!data) return false;
    if (只显示不正确 && x.状态 !== "incorrect") return false;
    return 过滤函数(x.词, data);
  });

  const columns: ColumnsType<校对条目> = [
    {
      title: "词",
      key: "词",
      dataIndex: "词",
    },
    {
      title: "元素序列",
      key: "元素序列",
      render: (_, record) => {
        return (
          <Flex wrap gap="small">
            {record.元素序列.map((x, i) => {
              return (
                <Space size="small" wrap key={i}>
                  {x.map((element, index) => (
                    <Element
                      key={index}
                      onClick={
                        typeof element === "object"
                          ? () => handleElementClick(element.element)
                          : undefined
                      }
                    >
                      <DisplayOptionalSuperscript element={element} />
                    </Element>
                  ))}
                </Space>
              );
            })}
          </Flex>
        );
      },
    },
    {
      title: "编码",
      dataIndex: "编码",
      key: "编码",
    },
    {
      title: "参考编码列表",
      dataIndex: "参考编码列表",
      key: "参考编码列表",
      render: (参考编码列表) => 参考编码列表.join(", "),
    },
  ];

  return (
    <>
      <Flex justify="center" align="center" gap="middle">
        校对模式
        <Uploader
          type=".txt,.yaml"
          text="导入码表"
          action={(content) => {
            const 码表 = 按格式解析码表(content, 码表格式);
            设置外部码表(码表);
          }}
        />
        <Select
          value={码表格式}
          onChange={设置码表格式}
          options={码表格式选项}
          style={{ width: 160 }}
        />
        {外部码表 !== undefined && `已加载码表，条数：${外部码表.length}`}
      </Flex>
      <Typography.Text type="secondary">
        码表格式：每行一个条目，包含「单字」和「编码」两列，按所选格式分隔。文件可以为
        .txt 或 .yaml 后缀。
      </Typography.Text>
      <Flex
        justify="space-between"
        align="center"
        style={{ alignSelf: "stretch" }}
      >
        <Form.Item label="校对范围" style={{ margin: 0 }}>
          <Select
            value={校对范围}
            style={{ width: 96 }}
            options={filterOptions}
            onChange={设置校对范围}
          />
        </Form.Item>
        <Form.Item label="校对方向" style={{ margin: 0 }}>
          <Select
            value={校对方向}
            style={{ width: 96 }}
            options={[
              { label: "方案 → 码表", value: "forward" },
              { label: "码表 → 方案", value: "reverse" },
            ]}
            onChange={设置校对方向}
          />
        </Form.Item>
        <Form.Item label="仅显示错误" style={{ margin: 0 }}>
          <Switch checked={只显示不正确} onChange={设置只显示不正确} />
        </Form.Item>
        <Flex>
          <Statistic
            style={{ width: 80 }}
            title="正确"
            value={状态统计.correct}
          />
          <Statistic
            style={{ width: 80 }}
            title="错误"
            value={状态统计.incorrect}
          />
          <Statistic
            style={{ width: 80 }}
            title="未知"
            value={状态统计.unknown}
          />
          <Statistic
            style={{ width: 80 }}
            title="准确率"
            value={`${Math.round((状态统计.correct / (状态统计.correct + 状态统计.incorrect)) * 100)}%`}
          />
        </Flex>
      </Flex>
      <Table
        dataSource={dataSource}
        columns={columns}
        size="small"
        rowKey="标识符"
        pagination={{
          pageSize: 50,
        }}
      />
      <Modal
        title="编辑元素编码"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        {selectedElement && (
          <ElementDetail
            keys={selectedElement.keys}
            name={selectedElement.name}
            onClose={() => setModalOpen(false)}
          />
        )}
      </Modal>
    </>
  );
}
