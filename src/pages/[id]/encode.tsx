import {
  Button,
  Flex,
  Form,
  Radio,
  Table,
  Typography,
  notification,
} from "antd";
import EncoderRules from "~/components/EncoderRules";
import { EditorColumn, EditorRow, exportTSV } from "~/components/Utils";
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
import { Suspense, useState } from "react";
import { ColumnsType } from "antd/es/table";
import { LibchaiOutputEvent } from "~/worker";
import { analysis } from "~/lib/repertoire";
import { assemble, getTSV } from "~/lib/assembly";
import CustomSpin from "~/components/CustomSpin";
import { LoadAssets } from "~/lib/utils";

const filterOptions = ["成字部件", "非成字部件", "所有汉字"] as const;
type FilterOption = (typeof filterOptions)[number];

interface CharacterCodeTable {
  key: string;
  full: string;
  short: string;
}

interface WordCodeTable {
  key: string;
  full: string;
}

interface EncodeOutput {
  characters: string[];
  characters_full: string[];
  characters_short?: string[];
  words?: string[];
  words_full?: string[];
}

const getCharacterDataSource = (code: EncodeOutput) => {
  const { characters, characters_full, characters_short } = code;
  const data: CharacterCodeTable[] = [];
  for (const [i, char] of characters.entries()) {
    data.push({
      key: char,
      full: characters_full[i] ?? "",
      short: characters_short?.[i] ?? "",
    });
  }
  return data;
};

const getWordDataSource = (code: EncodeOutput) => {
  const { words, words_full } = code;
  const data: WordCodeTable[] = [];
  for (const [i, word] of (words ?? []).entries()) {
    data.push({
      key: word,
      full: words_full?.[i] ?? "",
    });
  }
  return data;
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
        ? getCharacterDataSource(code)
        : getWordDataSource(code);
  const characterColumns: ColumnsType<CharacterCodeTable> = [
    {
      title: "汉字",
      dataIndex: "key",
    },
    {
      title: "全码",
      dataIndex: "full",
    },
    {
      title: "简码",
      dataIndex: "short",
    },
  ];

  const wordColumns: ColumnsType<WordCodeTable> = [
    {
      title: "词语",
      dataIndex: "key",
    },
    {
      title: "全码",
      dataIndex: "full",
    },
  ];
  const columns = mode === "character" ? characterColumns : wordColumns;
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
        <Suspense fallback={<CustomSpin tip="加载数据" />}>
          <LoadAssets />
          <Flex justify="center" gap="middle" style={{ marginBottom: "2rem" }}>
            <Radio.Group
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              style={{ minWidth: "200px" }}
            >
              <Radio.Button value="character">单字</Radio.Button>
              <Radio.Button value="word" disabled={encoder.rules === undefined}>
                词语
              </Radio.Button>
            </Radio.Group>
            <Button
              type="primary"
              onClick={async () => {
                const worker = new Worker(
                  new URL("../../worker.ts", import.meta.url),
                  { type: "module" },
                );
                worker.onmessage = (
                  event: MessageEvent<LibchaiOutputEvent>,
                ) => {
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
                      });
                      break;
                  }
                };
                worker.postMessage({ type: "encode", data: prepareInput() });
              }}
            >
              生成
            </Button>
            <Button
              disabled={code === undefined}
              onClick={() => {
                const { characters, characters_full, characters_short } = code!;
                const charactersTSV = characters.map((c, i) => {
                  return characters_short
                    ? [c, characters_full[i]!, characters_short[i]!]
                    : [c, characters_full[i]!];
                });
                exportTSV(charactersTSV, "单字编码.txt");
              }}
            >
              导出单字码表
            </Button>
            <Button
              disabled={code?.words === undefined}
              onClick={() => {
                const { words, words_full } = code!;
                const wordsTSV = words!.map((c, i) => [c, words_full![i]!]);
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
          />
        </Suspense>
      </EditorColumn>
    </EditorRow>
  );
};

export default Encode;
