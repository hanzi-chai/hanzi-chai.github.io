import { Suspense, useState } from "react";
import { Alert, Button, Flex, Form, Tabs, TabsProps, Typography } from "antd";
import {
  useAtomValue,
  configAtom,
  displayAtom,
  repertoireAtom,
  sequenceAtom,
  useAtom,
  assetsAtom,
} from "~/atoms";
import type { AssemblyResult, IndexedElement } from "~/lib/assembly";
import { getTSV, assemble } from "~/lib/assembly";
import type { ColumnsType } from "antd/es/table";
import Table from "antd/es/table";
import {
  EditorColumn,
  EditorRow,
  exportTSV,
  renderSuperScript,
} from "~/components/Utils";
import EncoderGraph from "~/components/EncoderGraph";
import { ReactFlowProvider } from "reactflow";
import { useChaifenTitle } from "~/lib/hooks";
import CharacterQuery, {
  CharacterFilter,
  makeCharacterFilter,
} from "~/components/CharacterQuery";
import { analysisResultAtom, assemblyResultAtom } from "~/atoms/cache";
import { analysis } from "~/lib/repertoire";
import PrimitiveDuplicationAnalyzer, {
  analyzePrimitiveDuplication,
  defaultAnalyzer,
} from "~/components/PrimitiveDuplicationAnalyzer";

interface EncodeResultEntry {
  name: string;
  [n: number]: IndexedElement;
}

export const renderIndexed = (
  element: IndexedElement,
  display: (s: string) => string,
) => {
  if (typeof element === "string") {
    return display(element);
  } else {
    return renderSuperScript(display(element.element), element.index);
  }
};

export default function () {
  useChaifenTitle("编码");
  const repertoire = useAtomValue(repertoireAtom);
  const sequence = useAtomValue(sequenceAtom);
  const config = useAtomValue(configAtom);
  const display = useAtomValue(displayAtom);
  const [filter, setFilter] = useState<CharacterFilter>({});
  const filterFn = makeCharacterFilter(filter, repertoire, sequence);
  const characters = Object.entries(repertoire)
    .filter(([, v]) => v.gb2312 && v.tygf > 0)
    .map(([x]) => x);
  const [analysisResult, setAnalysisResult] = useAtom(analysisResultAtom);
  const [assemblyResult, setAssemblyResult] = useAtom(assemblyResultAtom);
  const result: AssemblyResult = assemblyResult ?? new Map();
  const lost = [...result].filter(([, v]) => v.length === 0).map(([x]) => x);
  const max_length = config.encoder.max_length;
  const characterFrequency = useAtomValue(assetsAtom).character_frequency;

  const [analyzer, setAnalyzer] = useState(defaultAnalyzer);
  const [selections, involved] = analyzePrimitiveDuplication(
    analyzer,
    characterFrequency,
    result,
  );

  const dataSource = [...result]
    .filter(([, v]) => v.length > 0)
    .filter(([x]) => filterFn(x))
    .filter(([x]) => analyzer.filter === false || involved.has(x))
    .map(([name, sequence]) => {
      const object = { key: name, name } as EncodeResultEntry;
      for (const [i, element] of sequence[0]!.entries()) {
        object[i] = element;
      }
      return object;
    });

  const hash = (record: EncodeResultEntry) => {
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

  const columns: ColumnsType<EncodeResultEntry> = [
    {
      title: "汉字",
      dataIndex: "name",
      sorter: (a, b) => a.name.codePointAt(0)! - b.name.codePointAt(0)!,
      sortDirections: ["ascend", "descend"],
      width: 64,
    },
    {
      title: "全拆",
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
    columns.push({
      title: `${i + 1} 码`,
      key: i,
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
    });
  }
  const items: TabsProps["items"] = [
    {
      key: "1",
      label: "单字全码",
    },
    {
      key: "2",
      label: "构词码",
      disabled: true,
    },
  ];

  return (
    <EditorRow>
      <EditorColumn span={12}>
        <Typography.Title level={2}>取码规则</Typography.Title>
        <Tabs defaultActiveKey="1" items={items} onChange={() => {}} />
        <ReactFlowProvider>
          <EncoderGraph />
        </ReactFlowProvider>
      </EditorColumn>
      <EditorColumn span={12}>
        <Typography.Title level={2}>取码结果</Typography.Title>
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
        <CharacterQuery setFilter={setFilter} />
        <Flex justify="center" gap="small">
          <Button
            type="primary"
            onClick={() => {
              let result = analysisResult;
              if (result === null) {
                result = analysis(repertoire, config);
                setAnalysisResult(result);
              }
              setAssemblyResult(
                assemble(repertoire, config, characters, result),
              );
            }}
          >
            计算
          </Button>
          <Button
            onClick={() => {
              const tsv = getTSV(result);
              exportTSV(tsv, "elements.txt");
            }}
          >
            导出拆分表
          </Button>
        </Flex>
        {result.size > 0 && (
          <PrimitiveDuplicationAnalyzer
            selections={selections}
            setAnalyzer={setAnalyzer}
          />
        )}
        <Table
          columns={columns}
          dataSource={dataSource}
          pagination={{ pageSize: 50, hideOnSinglePage: true }}
          size="small"
        />
      </EditorColumn>
    </EditorRow>
  );
}
