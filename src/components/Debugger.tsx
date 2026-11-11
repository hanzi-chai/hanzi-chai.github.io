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
import {
  type 元素,
  字集过滤选项,
  按格式解析码表,
  type 校对方向,
  type 校对条目,
  type 校对范围,
  校对码表,
  type 码表格式,
} from "hanzi-chai";
import { useAtom, useAtomValue } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { useMemo, useState } from "react";
import {
  useAtomValueUnwrapped,
  字库原子,
  汉字集合原子,
  码表数据库,
  type 联合条目,
  联合结果原子,
  配置原子,
} from "~/atoms";
import { ElementDetail } from "~/components/Mapping";
import {
  BoxedElementWithTooltip,
  CodePositionDisplay,
  Uploader,
} from "~/components/Utils";
import BorderItem from "./BorderItem";

const 码表格式选项: { label: string; value: 码表格式 }[] = [
  { label: "单字 ⇥ 编码", value: "char_tab_code" },
  { label: "单字 ␣ 编码", value: "char_space_code" },
  { label: "编码 ⇥ 单字", value: "code_tab_char" },
  { label: "编码 ␣ 单字", value: "code_space_char" },
];

const 校对范围原子 = atomWithStorage<校对范围>(
  "debug-filter-option",
  "maximal",
);

const 校对方向原子 = atomWithStorage<校对方向>("debug-direction", "forward");

const filterOptions = [
  { label: "成字部件", value: "components" },
  ...字集过滤选项,
];

export default function Debugger() {
  const config = useAtomValue(配置原子) as any;
  const repertoire = useAtomValue(字库原子);
  const characters = useAtomValue(汉字集合原子);
  const 联合结果 = useAtomValueUnwrapped(联合结果原子);
  const [外部码表, 设置外部码表] = useAtom(
    码表数据库.item(config.info?.name ?? "方案"),
  );
  const [只显示不正确, 设置只显示不正确] = useState(true);
  const [校对范围, 设置校对范围] = useAtom(校对范围原子);
  const [校对方向, 设置校对方向] = useAtom(校对方向原子);
  const [码表格式, 设置码表格式] = useState<码表格式>("char_tab_code");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedElement, setSelectedElement] = useState<元素 | null>(null);
  const { 条目, 统计, 准确率 } = useMemo(
    () =>
      校对码表(
        联合结果.map(({ 词, 全码, 元素序列 }) => ({
          词: 词.map((x) => x.获取名称()).join(""),
          编码: 全码,
          元素序列: [元素序列],
        })),
        外部码表 ?? [],
        {
          字库: repertoire,
          汉字集合: characters,
          范围: 校对范围,
          方向: 校对方向,
        },
      ),
    [联合结果, 外部码表, repertoire, characters, 校对范围, 校对方向],
  );
  const dataSource = 只显示不正确
    ? 条目.filter((x) => x.状态 === "incorrect")
    : 条目;

  // 处理点击元素的函数
  const handleElementClick = (element: 元素) => {
    setSelectedElement(element);
    setModalOpen(true);
  };

  const columns: ColumnsType<校对条目<联合条目["元素序列"]>> = [
    {
      title: "词",
      key: "词",
      dataIndex: "词",
      render: (_, record) => {
        return [...record.词].map((char, index) => {
          const data = repertoire.校验字符(char);
          if (!data) return char;
          return (
            <BoxedElementWithTooltip key={index} element={data.character} />
          );
        });
      },
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
                  {x.元素序列.map((element, index) => (
                    <BorderItem
                      key={index}
                      onClick={
                        typeof element === "object"
                          ? () => handleElementClick(element.element)
                          : undefined
                      }
                    >
                      <CodePositionDisplay element={element} />
                    </BorderItem>
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
        />
        {外部码表 !== undefined && `已加载码表，条数：${外部码表.length}`}
      </Flex>
      <Typography.Text type="secondary">
        码表格式：每行一个条目，包含「单字」和「编码」两列，按所选格式分隔。文件可以为
        .txt 或 .yaml 后缀。
      </Typography.Text>
      <Flex justify="space-between" align="center" className="self-stretch">
        <Form.Item label="校对范围" className="m-0!">
          <Select
            value={校对范围}
            options={filterOptions}
            onChange={设置校对范围}
          />
        </Form.Item>
        <Form.Item label="校对方向" className="m-0!">
          <Select
            value={校对方向}
            options={[
              { label: "以系统码表为主体", value: "forward" },
              { label: "以外部码表为主体", value: "reverse" },
            ]}
            onChange={设置校对方向}
          />
        </Form.Item>
        <Form.Item label="仅显示错误" className="m-0!">
          <Switch checked={只显示不正确} onChange={设置只显示不正确} />
        </Form.Item>
        <Flex>
          <Statistic className="w-20" title="正确" value={统计.correct} />
          <Statistic className="w-20" title="错误" value={统计.incorrect} />
          <Statistic className="w-20" title="未知" value={统计.unknown} />
          <Statistic
            className="w-20"
            title="准确率"
            value={准确率 === null ? "—" : `${Math.round(准确率 * 100)}%`}
          />
        </Flex>
      </Flex>
      <Table
        dataSource={dataSource}
        columns={columns}
        size="small"
        rowKey={(x) => `${x.词}-${x.编码}`}
        pagination={{
          pageSize: 50,
        }}
      />
      <Modal
        title="编辑元素编码"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        destroyOnHidden
      >
        {selectedElement && (
          <ElementDetail
            element={selectedElement}
            onClose={() => setModalOpen(false)}
          />
        )}
      </Modal>
    </>
  );
}
