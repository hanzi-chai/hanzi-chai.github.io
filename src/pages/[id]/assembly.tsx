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

interface EncodeResultEntry {
  key: string;
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
  const dataSource = toShow.map(({ name, sequence: elements }) => {
    const entry: EncodeResultEntry = {
      key: `${name}-${summarize(elements)}`,
      name,
    };
    for (const [i, element] of elements.entries()) {
      entry[i] = element;
    }
    return entry;
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
      title: "名称",
      dataIndex: "name",
      sorter: (a, b) => a.name.codePointAt(0)! - b.name.codePointAt(0)!,
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
    columns.push({
      title: `元素 ${i + 1}`,
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
  const [modal, setModal] = useState(0);

  return (
    <Flex vertical gap="middle" style={{ height: "100%" }}>
      <Typography.Title level={2}>取码规则</Typography.Title>
      <Flex gap="middle">
        <Button onClick={() => setModal(1)}>一字词全码</Button>
        <Button onClick={() => setModal(2)}>多字词全码</Button>
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
              assemble(repertoire, config, characters, dictionary, result),
            );
          }}
        >
          计算
        </Button>
        <Button
          onClick={() => {
            const tsv: string[][] = [];
            for (const {
              name: object,
              sequence: elements,
              importance,
            } of result) {
              const summary = summarize(elements);
              tsv.push([object, summary, String(importance ?? 100)]);
            }
            exportTSV(tsv, "elements.txt");
          }}
        >
          导出拆分表
        </Button>
      </Flex>
      {result.length > 0 && (
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
    </Flex>
  );
}
