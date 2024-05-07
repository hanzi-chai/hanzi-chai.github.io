import { Suspense, useState } from "react";
import {
  Alert,
  Button,
  Flex,
  Form,
  Modal,
  Switch,
  Tabs,
  TabsProps,
  Typography,
} from "antd";
import {
  useAtomValue,
  configAtom,
  displayAtom,
  repertoireAtom,
  sequenceAtom,
  useAtom,
  assetsAtom,
  dictionaryAtom,
} from "~/atoms";
import type { AssemblyResult, IndexedElement } from "~/lib";
import { assemble, summarize } from "~/lib";
import type { ColumnsType } from "antd/es/table";
import Table from "antd/es/table";
import { exportTSV, renderSuperScript } from "~/components/Utils";
import EncoderGraph from "~/components/EncoderGraph";
import { ReactFlowProvider } from "reactflow";
import { useChaifenTitle } from "~/components/Utils";
import { analysisResultAtom, assemblyResultAtom } from "~/atoms/cache";
import { analysis } from "~/lib";
import PrimitiveDuplicationAnalyzer, {
  analyzePrimitiveDuplication,
  defaultAnalyzer,
} from "~/components/PrimitiveDuplicationAnalyzer";
import WordRules from "~/components/WordRules";
import { ProColumns, ProTable } from "@ant-design/pro-components";

interface AssembleResultEntry {
  key: string;
  name: string;
  frequency: number;
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
  const config = useAtomValue(configAtom);
  const display = useAtomValue(displayAtom);
  const characters = Object.entries(repertoire)
    .filter(([, v]) => v.tygf > 0)
    .map(([x]) => x);
  const [analysisResult, setAnalysisResult] = useAtom(analysisResultAtom);
  const [assemblyResult, setAssemblyResult] = useAtom(assemblyResultAtom);
  const result: AssemblyResult = assemblyResult ?? [];
  const lost: string[] = [];
  const max_length = config.encoder.max_length;
  const frequency = useAtomValue(assetsAtom).frequency;
  const dictionary = useAtomValue(dictionaryAtom);

  const [analyzer, setAnalyzer] = useState(defaultAnalyzer);
  const [selections, filtered] = analyzePrimitiveDuplication(
    analyzer,
    frequency,
    result,
  );

  const toShow = analyzer.filter ? filtered : result;
  const dataSource = toShow.map(({ name, sequence, importance }) => {
    const freq = Math.round(
      ((frequency[name] ?? 0) * (importance ?? 100)) / 100,
    );
    const entry: AssembleResultEntry = {
      key: `${name}-${summarize(sequence)}`,
      frequency: freq,
      name,
    };
    for (const [i, element] of sequence.entries()) {
      entry[i] = element;
    }
    return entry;
  });

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
    },
    {
      title: "频率",
      dataIndex: "frequency",
      sorter: (a, b) => a.frequency - b.frequency,
      sortDirections: ["ascend", "descend"],
      width: 64,
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
  const [modal, setModal] = useState(0);

  const toolbar = [
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
        console.log("Finish");
        setAssemblyResult(assembled);
      }}
    >
      计算
    </Button>,
    <Button
      onClick={() => {
        const tsv: string[][] = [];
        for (const { name: object, sequence: elements, importance } of result) {
          const summary = summarize(elements);
          tsv.push([object, summary, String(importance ?? 100)]);
        }
        exportTSV(tsv, "elements.txt");
      }}
    >
      导出拆分表
    </Button>,
  ];

  return (
    <Flex vertical gap="middle" style={{ height: "100%" }}>
      <Flex gap="middle" justify="center">
        <Button onClick={() => setModal(1)}>配置一字词规则</Button>
        <Button onClick={() => setModal(2)}>配置多字词规则</Button>
      </Flex>
      <Modal
        title="一字词全码"
        open={modal === 1}
        footer={null}
        onCancel={() => setModal(0)}
        width={1080}
      >
        <div style={{ height: "70vh" }}>
          <ReactFlowProvider>
            <EncoderGraph />
          </ReactFlowProvider>
        </div>
      </Modal>
      <Modal
        title="多字词全码"
        open={modal === 2}
        footer={null}
        onCancel={() => setModal(0)}
      >
        <WordRules />
      </Modal>
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
      {result.length > 0 && (
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
    </Flex>
  );
}
