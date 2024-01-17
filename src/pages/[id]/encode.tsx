import {
  Button,
  Flex,
  Form,
  Radio,
  Space,
  Statistic,
  Switch,
  Table,
  Typography,
  notification,
} from "antd";
import EncoderRules from "~/components/EncoderRules";
import {
  EditorColumn,
  EditorRow,
  Select,
  Uploader,
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
import { useMemo, useState } from "react";
import { ColumnsType } from "antd/es/table";
import { LibchaiOutputEvent } from "~/worker";
import { analysis } from "~/lib/repertoire";
import { assemble, getTSV } from "~/lib/assembly";
import { atomWithStorage } from "jotai/utils";
import { getSupplemental } from "~/lib/utils";

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
  let dataSource =
    code === undefined
      ? []
      : mode === "character"
        ? code.characters
        : code.words;

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

  const referenceAtom = useMemo(
    () =>
      atomWithStorage<Record<string, string[]>>(
        "referece_" + config.info?.name ?? "",
        {},
      ),
    [config.info?.name],
  );

  const [reference, setReference] = useAtom(referenceAtom);
  const [debug, setDebug] = useState(false);
  const filterOptions = ["成字部件", "非成字部件", "所有汉字"] as const;
  const [filterOption, setFilterOption] = useState<FilterOption>("所有汉字");
  type FilterOption = (typeof filterOptions)[number];
  const supplemental = getSupplemental(repertoire, list);
  const filterMap: Record<FilterOption, (p: string) => boolean> = {
    成字部件: (char) => repertoire[char]?.glyph?.type === "basic_component",
    非成字部件: (char) => supplemental.includes(char),
    所有汉字: () => true,
  };
  const filterFn = filterMap[filterOption];

  let correct = 0;
  let incorrect = 0;
  let unknown = 0;
  if (debug && dataSource && mode === "character") {
    dataSource = dataSource.filter(({ item, full }) => {
      if (!filterFn(item)) return false;
      const codes = reference[item];
      if (codes === undefined) {
        unknown += 1;
        return false;
      } else if (!codes.includes(full)) {
        incorrect += 1;
        return true;
      } else {
        correct += 1;
        return false;
      }
    });
  }

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
      render: (_, { item, full }) => (
        <span>
          {full}{" "}
          {debug && reference[item]?.includes(full) === false && (
            <span style={{ color: "red" }}>
              [{reference[item]!.join(", ")}]
            </span>
          )}
        </span>
      ),
    },
    {
      title: "简码",
      dataIndex: "short",
      width: 128,
    },
  ];

  return (
    <EditorRow>
      <EditorColumn span={12}>
        <Typography.Title level={2}>编码规则</Typography.Title>
        <EncoderRules />
      </EditorColumn>
      <EditorColumn span={12} style={{ gap: "16px" }}>
        <Typography.Title level={2}>生成编码</Typography.Title>
        <Flex justify="center" gap="middle">
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
        <Flex justify="center" align="center" gap="middle">
          校对模式
          <Switch checked={debug} onChange={setDebug} />
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
                  ref[key] = [value];
                }
              }
              setReference(ref);
            }}
          />
          {reference !== undefined &&
            `已加载码表，条数：${Object.keys(reference).length}`}
        </Flex>
        {debug && (
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
            <Flex>
              <Statistic style={{ width: 80 }} title="正确" value={correct} />
              <Statistic style={{ width: 80 }} title="错误" value={incorrect} />
              <Statistic style={{ width: 80 }} title="未知" value={unknown} />
              <Statistic
                style={{ width: 80 }}
                title="准确率"
                value={
                  Math.round(
                    (correct / (correct + incorrect + unknown)) * 100,
                  ) + "%"
                }
              />
            </Flex>
          </Flex>
        )}
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
