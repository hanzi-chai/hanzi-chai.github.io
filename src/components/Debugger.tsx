import { Flex, Form, Statistic, Switch, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useAtom, useAtomValue } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { useMemo, useState } from "react";
import type { DictEntry } from "~/atoms";
import { charactersAtom, configAtom, repertoireAtom } from "~/atoms";
import { encodeResultAtom } from "~/atoms/cache";
import { Select, Uploader } from "~/components/Utils";
import { getSupplemental } from "~/lib";

export default function Debugger() {
  const config = useAtomValue(configAtom);
  const repertoire = useAtomValue(repertoireAtom);
  const characters = useAtomValue(charactersAtom);
  const code = useAtomValue(encodeResultAtom) ?? [];
  const referenceAtom = useMemo(
    () =>
      atomWithStorage<Record<string, string[]>>(
        "reference_" + config.info.name,
        {},
      ),
    [config.info?.name],
  );

  const [reference, setReference] = useAtom(referenceAtom);
  const [incorrectOnly, setIncorrectOnly] = useState(false);
  const filterOptions = ["成字部件", "非成字部件", "所有汉字"] as const;
  const [filterOption, setFilterOption] = useState<FilterOption>("所有汉字");
  type FilterOption = (typeof filterOptions)[number];
  const supplemental = getSupplemental(repertoire, characters);
  const filterMap: Record<FilterOption, (p: string) => boolean> = {
    成字部件: (char) => repertoire[char]?.glyph?.type === "basic_component",
    非成字部件: (char) => supplemental.includes(char),
    所有汉字: () => true,
  };
  const filterFn = filterMap[filterOption];

  let correct = 0;
  let incorrect = 0;
  let unknown = 0;
  let dataSource: (DictEntry & {
    reference: string[];
    status: "correct" | "incorrect" | "unknown";
  })[] = code
    .filter((x) => [...x.name].length === 1 && filterFn(x.name))
    .map((x) => {
      const codes = reference[x.name] ?? [];
      let status: "correct" | "incorrect" | "unknown" = "unknown";
      if (codes.length === 0) {
        unknown += 1;
      } else if (!codes.includes(x.full)) {
        incorrect += 1;
        status = "incorrect";
      } else {
        correct += 1;
        status = "correct";
      }
      return { ...x, reference: codes, status };
    });

  if (incorrectOnly) {
    dataSource = dataSource.filter((x) => x.status === "incorrect");
  }

  const columns: ColumnsType<DictEntry> = [
    {
      title: "字符",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "全码",
      dataIndex: "full",
      key: "full",
    },
    {
      title: "参考全码",
      dataIndex: "reference",
      key: "reference",
      render: (codes) => codes.join(", "),
    },
  ];

  return (
    <>
      <Flex justify="center" align="center" gap="middle">
        校对模式
        <Uploader
          type="txt"
          text="导入 TSV 码表"
          action={(content) => {
            const ref: Record<string, string[]> = {};
            const tsv = content
              .trim()
              .split("\n")
              .map((x) => x.split("\t"));
            for (const line of tsv) {
              const [key, value] = line;
              if (key !== undefined && value !== undefined) {
                ref[key] = (ref[key] ?? []).concat(value);
              }
            }
            setReference(ref);
          }}
        />
        {reference !== undefined &&
          `已加载码表，条数：${Object.keys(reference).length}`}
      </Flex>
      <Flex
        justify="space-between"
        align="center"
        style={{ alignSelf: "stretch" }}
      >
        <Form.Item label="校对范围" style={{ margin: 0 }}>
          <Select
            style={{ width: 128 }}
            value={filterOption}
            options={filterOptions.map((x) => ({ label: x, value: x }))}
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
            value={Math.round((correct / (correct + incorrect)) * 100) + "%"}
          />
        </Flex>
      </Flex>
      <Table
        dataSource={dataSource}
        columns={columns}
        size="small"
        rowKey="name"
        pagination={{
          pageSize: 50,
        }}
      />
    </>
  );
}
