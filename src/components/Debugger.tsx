import { Flex, Form, Select, Statistic, Switch, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useAtom, useAtomValue } from "jotai";
import { useState } from "react";
import {
  汉字集合原子,
  原始字库数据原子,
  配置原子,
  如字库原子,
  useAtomValueUnwrapped,
  码表数据库,
} from "~/atoms";
import { 如编码结果原子 } from "~/atoms";
import { Uploader } from "~/components/Utils";
import {
  字数,
  type 字集指示,
  字集过滤查找表,
  字集过滤选项,
  解析码表,
  读取表格,
} from "~/lib";
import type { 编码条目 } from "~/utils";

interface 编码条目与参考 extends 编码条目 {
  参考全码: string[];
  状态: "correct" | "incorrect" | "unknown";
  标识符: string;
}

type 扩展字集指示 = 字集指示 | "components";
type 过滤 = (typeof 字集过滤查找表)[字集指示];

export default function Debugger() {
  const config = useAtomValue(配置原子) as any;
  const repertoire = useAtomValueUnwrapped(如字库原子);
  const allRepertoire = useAtomValue(原始字库数据原子);
  const characters = useAtomValue(汉字集合原子);
  const [code] = useAtomValueUnwrapped(如编码结果原子);
  const [reference, setReference] = useAtom(
    码表数据库.item(config.info?.name ?? "方案"),
  );
  const [incorrectOnly, setIncorrectOnly] = useState(true);
  const [filterOption, setFilterOption] = useState<扩展字集指示>("maximal");
  const { 部件列表 } = repertoire.获取待分析对象(characters);
  const 是部件: 过滤 = (c, _) => 部件列表.has(c) && characters.has(c);
  const 过滤函数 =
    filterOption === "components" ? 是部件 : 字集过滤查找表[filterOption];
  const filterOptions = [
    {
      label: "成字部件",
      value: "components",
    },
  ].concat(字集过滤选项);

  const 编码映射 = new Map<string, string[]>();
  for (const { 词, 编码 } of reference || []) {
    if (!编码映射.has(词)) {
      编码映射.set(词, []);
    }
    编码映射.get(词)!.push(编码);
  }

  let correct = 0;
  let incorrect = 0;
  let unknown = 0;
  let dataSource: 编码条目与参考[] = code
    .filter((x) => {
      if (字数(x.词) !== 1) return false;
      const data = allRepertoire[x.词];
      if (!data) return false;
      return 过滤函数(x.词, data);
    })
    .map((x) => {
      const codes = 编码映射.get(x.词) ?? [];
      const hash = `${x.词}-${x.全码}`;
      let status: "correct" | "incorrect" | "unknown" = "unknown";
      if (codes.length === 0) {
        unknown += 1;
      } else if (!codes.includes(x.全码)) {
        incorrect += 1;
        status = "incorrect";
      } else {
        correct += 1;
        status = "correct";
      }
      return { ...x, 参考全码: codes, 状态: status, 标识符: hash };
    });

  if (incorrectOnly) {
    dataSource = dataSource.filter((x) => x.状态 === "incorrect");
  }

  const columns: ColumnsType<编码条目> = [
    {
      title: "字符",
      dataIndex: "词",
      key: "词",
    },
    {
      title: "全码",
      dataIndex: "全码",
      key: "全码",
    },
    {
      title: "参考全码",
      dataIndex: "参考全码",
      key: "参考全码",
      render: (codes) => codes.join(", "),
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
            const tsv = 读取表格(content);
            const 码表 = 解析码表(tsv);
            setReference(码表);
          }}
        />
        {reference !== undefined && `已加载码表，条数：${reference.length}`}
      </Flex>
      <Typography.Text type="secondary">
        码表格式：每行一个条目，至少包含「单字」和「编码」两列，使用制表符分隔。文件可以为
        .txt 或 .yaml 后缀。
      </Typography.Text>
      <Flex
        justify="space-between"
        align="center"
        style={{ alignSelf: "stretch" }}
      >
        <Form.Item label="校对范围" style={{ margin: 0 }}>
          <Select
            value={filterOption}
            style={{ width: 96 }}
            options={filterOptions}
            onChange={setFilterOption}
          />
        </Form.Item>
        <Form.Item label="仅显示错误" style={{ margin: 0 }}>
          <Switch checked={incorrectOnly} onChange={setIncorrectOnly} />
        </Form.Item>
        <Flex>
          <Statistic style={{ width: 80 }} title="正确" value={correct} />
          <Statistic style={{ width: 80 }} title="错误" value={incorrect} />
          <Statistic style={{ width: 80 }} title="未知" value={unknown} />
          <Statistic
            style={{ width: 80 }}
            title="准确率"
            value={`${Math.round((correct / (correct + incorrect)) * 100)}%`}
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
    </>
  );
}
