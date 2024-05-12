import { useState } from "react";
import { Alert, Button, Flex } from "antd";
import {
  useAtomValue,
  configAtom,
  displayAtom,
  repertoireAtom,
  useAtom,
  assetsAtom,
  dictionaryAtom,
  priorityShortCodesAtom,
  maxLengthAtom,
} from "~/atoms";
import type { AssemblyResult, IndexedElement } from "~/lib";
import { assemble, summarize } from "~/lib";
import { Select, exportTSV, renderIndexed } from "~/components/Utils";
import { analysisResultAtom, assemblyResultAtom } from "~/atoms/cache";
import { analysis } from "~/lib";
import PrimitiveDuplicationAnalyzer, {
  analyzePrimitiveDuplication,
  defaultAnalyzer,
} from "~/components/PrimitiveDuplicationAnalyzer";
import { ProColumns, ProTable } from "@ant-design/pro-components";

interface AssembleResultEntry {
  key: string;
  name: string;
  pinyin_list: string[];
  frequency: number;
  [n: number]: IndexedElement;
}

const getPriorityMap = (priorityShortCodes: [string, string, number][]) => {
  return new Map<string, number>(
    priorityShortCodes.map(([word, pinyin_list, level]) => {
      const hash = `${word}-${pinyin_list}`;
      return [hash, level] as [string, number];
    }),
  );
};

const ProrityShortCodeSelector = ({ hash }: { hash: string }) => {
  const max_length = useAtomValue(maxLengthAtom);
  const [priorityShortCodes, setPriorityShortCodes] = useAtom(
    priorityShortCodesAtom,
  );
  const priorityMap = getPriorityMap(priorityShortCodes);
  const level = priorityMap.get(hash);
  return (
    <Select
      value={level ?? -1}
      options={[-1, ...Array(max_length + 1).keys()].map((x) => {
        return { label: x === -1 ? "默认" : x.toString(), value: x };
      })}
      onChange={(value) => {
        if (value === -1) {
          priorityMap.delete(hash);
        } else {
          priorityMap.set(hash, value);
        }
        setPriorityShortCodes(
          [...priorityMap.entries()].map(([hash, level]) => {
            const [word, pinyin_list] = hash.split("-");
            return [word, pinyin_list, level] as [string, string, number];
          }),
        );
      }}
    />
  );
};

const RecomputeButton = () => {
  const repertoire = useAtomValue(repertoireAtom);
  const config = useAtomValue(configAtom);
  const characters = Object.entries(repertoire)
    .filter(([, v]) => v.tygf > 0)
    .map(([x]) => x);
  const [analysisResult, setAnalysisResult] = useAtom(analysisResultAtom);
  const [assemblyResult, setAssemblyResult] = useAtom(assemblyResultAtom);
  const dictionary = useAtomValue(dictionaryAtom);
  return (
    <Button
      type="primary"
      onClick={() => {
        let result = analysisResult;
        if (result === null) {
          result = analysis(repertoire, config);
          setAnalysisResult(result);
        }
        let assembled = assemble(
          repertoire,
          config,
          characters,
          dictionary,
          result,
        );
        setAssemblyResult(assembled);
      }}
    >
      计算
    </Button>
  );
};

const ExportButton = () => {
  const assemblyResult = useAtomValue(assemblyResultAtom) ?? [];
  const priorityShortCodes = useAtomValue(priorityShortCodesAtom);
  const priorityMap = getPriorityMap(priorityShortCodes);
  return (
    <Button
      onClick={() => {
        const tsv: string[][] = [];
        for (const {
          name: object,
          sequence: elements,
          importance,
          pinyin_list,
        } of assemblyResult) {
          const summary = summarize(elements);
          const hash = `${object}-${pinyin_list.join(",")}`;
          const level = priorityMap.get(hash);
          if (level !== undefined) {
            tsv.push([
              object,
              summary,
              String(importance ?? 100),
              String(level),
            ]);
          } else {
            tsv.push([object, summary, String(importance ?? 100)]);
          }
        }
        exportTSV(tsv, "elements.txt");
      }}
    >
      导出拆分表
    </Button>
  );
};

export default function () {
  const display = useAtomValue(displayAtom);
  const assemblyResult = useAtomValue(assemblyResultAtom) ?? [];
  const lost: string[] = [];
  const max_length = useAtomValue(maxLengthAtom);
  const frequency = useAtomValue(assetsAtom).frequency;

  const [analyzer, setAnalyzer] = useState(defaultAnalyzer);
  const [selections, filtered] = analyzePrimitiveDuplication(
    analyzer,
    frequency,
    assemblyResult,
  );

  const toShow = analyzer.filter ? filtered : assemblyResult;
  const dataSource = toShow.map(
    ({ name, sequence, importance, pinyin_list }) => {
      const freq = Math.round(
        ((frequency[name] ?? 0) * (importance ?? 100)) / 100,
      );
      const entry: AssembleResultEntry = {
        key: `${name}-${summarize(sequence)}`,
        frequency: freq,
        pinyin_list,
        name,
      };
      for (const [i, element] of sequence.entries()) {
        entry[i] = element;
      }
      return entry;
    },
  );

  dataSource.sort((a, b) => b.frequency - a.frequency);

  const hash = (record: AssembleResultEntry) => {
    const list: IndexedElement[] = [];
    for (const i of Array(max_length).keys()) {
      const element = record[i];
      if (element === undefined) {
        break;
      }
      list.push(element);
    }
    return list.map((x) => renderIndexed(x, display)).join(" ");
  };

  const columns: ProColumns<AssembleResultEntry>[] = [
    {
      title: "名称",
      dataIndex: "name",
      sorter: (a, b) => a.name.codePointAt(0)! - b.name.codePointAt(0)!,
      sortDirections: ["ascend", "descend"],
      width: 64,
      filters: true,
      valueEnum: new Map<number, { text: string }>([
        [1, { text: "一字词" }],
        [2, { text: "二字词" }],
        [3, { text: "三字词" }],
        [4, { text: "四字词" }],
        [5, { text: "五字及以上词" }],
      ]),
      onFilter: (value, record) => {
        const length = [...record.name].length;
        return value === 5 ? length >= value : length === value;
      },
    },
    {
      title: "频率",
      dataIndex: "frequency",
      sorter: (a, b) => a.frequency - b.frequency,
      sortDirections: ["ascend", "descend"],
      width: 64,
    },
    {
      title: "拼音",
      dataIndex: "pinyin_list",
      render: (_, record) => record.pinyin_list.join(", "),
      width: 128,
    },
    {
      title: "全部元素",
      key: "full",
      render: (_, record) => hash(record),
      sorter: (a, b) => {
        const ahash = hash(a);
        const bhash = hash(b);
        return ahash.localeCompare(bhash);
      },
      width: 128,
    },
  ];

  for (const i of Array(max_length).keys()) {
    const allValues: Record<string, { text: string }> = {};
    for (const { [i]: element } of dataSource) {
      if (element !== undefined) {
        const text = renderIndexed(element, display);
        allValues[text] = { text };
      }
    }
    columns.push({
      title: `元素 ${i + 1}`,
      dataIndex: i,
      render: (_, record) => {
        const element = record[i];
        if (element === undefined) {
          return null;
        }
        return renderIndexed(element, display);
      },
      sorter: (a, b) => {
        const ahash = renderIndexed(a[i] ?? "", display);
        const bhash = renderIndexed(b[i] ?? "", display);
        return ahash.localeCompare(bhash);
      },
      sortDirections: ["ascend", "descend"],
      width: 96,
      filters: true,
      onFilter: (value, record) => {
        const element = record[i];
        if (element === undefined) {
          return false;
        }
        return renderIndexed(element, display) === value;
      },
      valueEnum: allValues,
    });
  }

  columns.push({
    title: "简码级数",
    key: "action",
    width: 64,
    render: (_, record) => {
      const hash = `${record.name}-${record.pinyin_list.join(",")}`;
      return <ProrityShortCodeSelector hash={hash} />;
    },
  });

  const toolbar = [<RecomputeButton />, <ExportButton />];

  return (
    <>
      {lost.length ? (
        <Alert
          message="警告"
          description={`${lost.slice(0, 5).join("、")} 等 ${
            lost.length
          } 个字缺少取码所需的原始数据`}
          type="warning"
          showIcon
          closable
        />
      ) : null}
      {assemblyResult.length > 0 && (
        <PrimitiveDuplicationAnalyzer
          selections={selections}
          setAnalyzer={setAnalyzer}
        />
      )}
      <ProTable<AssembleResultEntry>
        columns={columns}
        dataSource={dataSource}
        pagination={{ pageSize: 50, hideOnSinglePage: true }}
        search={false}
        defaultSize="small"
        toolBarRender={() => toolbar}
      />
    </>
  );
}
