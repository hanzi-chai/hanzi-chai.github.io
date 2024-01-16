import { Button, Flex, Radio, Table, Typography, notification } from "antd";
import EncoderRules from "~/components/EncoderRules";
import {
  EditorColumn,
  EditorRow,
  exportTSV,
  makeWorker,
} from "~/components/Utils";
import {
  assetsAtom,
  configAtom,
  encoderAtom,
  repertoireAtom,
  useAtom,
  useAtomValue,
  wordsAtom,
} from "~/atoms";
import { analysisResultAtom, assemblyResultAtom } from "~/atoms/cache";
import { useState } from "react";
import { ColumnsType } from "antd/es/table";
import { LibchaiOutputEvent } from "~/worker";
import { analysis } from "~/lib/repertoire";
import { assemble, getTSV } from "~/lib/assembly";

interface DictEntry {
  item: string;
  full: string;
  short?: string;
}

interface EncodeOutput {
  characters: DictEntry[];
  words?: DictEntry[];
}

export const makeEncodeCallback = (setCode: (e: EncodeOutput) => void) => {
  return (event: MessageEvent<LibchaiOutputEvent>) => {
    const { data } = event;
    switch (data.type) {
      case "code":
        setCode(data.code);
        notification.success({
          message: "生成成功!",
        });
        break;
      case "error":
        notification.error({
          message: "生成过程中 libchai 出现错误",
          description: data.error.message,
        });
        break;
    }
  };
};

const Encode = () => {
  const assets = useAtomValue(assetsAtom);
  const words = useAtomValue(wordsAtom);
  const encoder = useAtomValue(encoderAtom);
  const [analysisResult, setAnalysisResult] = useAtom(analysisResultAtom);
  const [assemblyResult, setAssemblyResult] = useAtom(assemblyResultAtom);
  const repertoire = useAtomValue(repertoireAtom);
  const config = useAtomValue(configAtom);
  const [mode, setMode] = useState<"character" | "word">("character");
  const [code, setCode] = useState<EncodeOutput | undefined>(undefined);
  const list = Object.entries(repertoire)
    .filter(([_, v]) => v.gb2312 && v.tygf > 0)
    .map(([x]) => x);
  const dataSource =
    code === undefined
      ? []
      : mode === "character"
        ? code.characters
        : code.words;
  const columns: ColumnsType<DictEntry> = [
    {
      title: "字词",
      dataIndex: "item",
      width: 128,
    },
    {
      title: "全码",
      dataIndex: "full",
      width: 128,
    },
    {
      title: "简码",
      dataIndex: "short",
      width: 128,
    },
  ];
  const prepareInput = () => {
    let v1 = analysisResult;
    if (v1 === null) {
      v1 = analysis(repertoire, config);
      setAnalysisResult(v1);
    }
    let v2 = assemblyResult;
    if (v2 === null) {
      v2 = assemble(repertoire, config, list, v1);
      setAssemblyResult(v2);
    }
    const characters = getTSV(v2);
    return {
      config,
      characters,
      words,
      assets,
    };
  };

  return (
    <EditorRow>
      <EditorColumn span={12}>
        <Typography.Title level={2}>编码规则</Typography.Title>
        <EncoderRules />
      </EditorColumn>
      <EditorColumn span={12}>
        <Typography.Title level={2}>生成编码</Typography.Title>
        <Flex justify="center" gap="middle" style={{ marginBottom: "2rem" }}>
          <Radio.Group value={mode} onChange={(e) => setMode(e.target.value)}>
            <Radio.Button value="character">单字</Radio.Button>
            <Radio.Button value="word" disabled={encoder.rules === undefined}>
              词语
            </Radio.Button>
          </Radio.Group>
          <Button
            type="primary"
            onClick={async () => {
              const worker = makeWorker();
              worker.onmessage = makeEncodeCallback(setCode);
              worker.postMessage({ type: "encode", data: prepareInput() });
            }}
          >
            生成
          </Button>
          <Button
            disabled={code === undefined}
            onClick={() => {
              const charactersTSV = code!.characters.map(
                ({ item, full, short }, i) => {
                  return short ? [item, full, short] : [item, full];
                },
              );
              exportTSV(charactersTSV, "单字编码.txt");
            }}
          >
            导出单字码表
          </Button>
          <Button
            disabled={code?.words === undefined}
            onClick={() => {
              const wordsTSV = code!.words!.map(({ item, full, short }, i) => {
                return short ? [item, full, short] : [item, full];
              });
              exportTSV(wordsTSV, "词语编码.txt");
            }}
          >
            导出词语码表
          </Button>
        </Flex>
        <Table
          columns={columns as any}
          dataSource={dataSource as any}
          size="small"
          pagination={{ pageSize: 50, hideOnSinglePage: true }}
          rowKey="item"
        />
      </EditorColumn>
    </EditorRow>
  );
};

export default Encode;
