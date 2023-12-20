import { Alert, Button, Flex, Form, List, Popover, Space } from "antd";
import { useState, useMemo } from "react";
import {
  atom,
  useDisplay,
  useForm,
  useAtomValue,
  useSetAtom,
  configFormAtom,
  addGenericGroupingAtom,
  addGenericMappingAtom,
  removeGenericGroupingAtom,
  removeGenericMappingAtom,
  setGenericMaxCodeLenAtom,
  setGenericAlphabetAtom,
  batchGenericMappingAtom,
  configGroupingElementAtom,
} from "~/atoms";

import Root from "./Root";
import Char from "./Char";
import type { MappedInfo } from "~/lib/utils";
import { reverse } from "~/lib/utils";
import { RootSelect, Select, Uploader } from "./Utils";
import { Select as AntdSelect } from "antd";
import { range } from "lodash-es";
import DeleteOutlined from "@ant-design/icons/DeleteOutlined";
import { focusAtom } from "jotai-optics";

const alphabetAtom = focusAtom(configFormAtom, (o) => o.prop("alphabet"));
const mappingAtom = focusAtom(configFormAtom, (o) => o.prop("mapping"));
const mappingTypeAtom = focusAtom(configFormAtom, (o) =>
  o.prop("mapping_type"),
);
const alphabetOptionsAtom = atom((get) =>
  Array.from(get(alphabetAtom)).map((x) => ({
    label: x,
    value: x,
  })),
);
const allOptionsAtom = atom((get) =>
  [{ label: "无", value: "" }].concat(get(alphabetOptionsAtom)),
);

const useAffilia = (name: string) => {
  const grouping = useAtomValue(configGroupingElementAtom);
  const result = useMemo(
    () =>
      Object.entries(grouping)
        .filter(([from, to]) => {
          const main = typeof to === "string" ? to : to[0];
          return main === name;
        })
        .map(([x]) => x),
    [grouping],
  );
  return result;
};

interface AdjustableRootPopoverContentProps {
  keys: string[];
  name: string;
  main: string;
  setMain: Function;
  code: string;
}
const AdjustableRootPopoverContent = ({
  keys,
  name,
  main,
  code,
  setMain,
}: AdjustableRootPopoverContentProps) => {
  const addGenericGrouping = useSetAtom(addGenericGroupingAtom);
  const addGenericMapping = useSetAtom(addGenericMappingAtom);
  const removeGenericGrouping = useSetAtom(removeGenericGroupingAtom);
  const removeGenericMapping = useSetAtom(removeGenericMappingAtom);
  const allOptions = useAtomValue(allOptionsAtom);
  const alphabetOptions = useAtomValue(alphabetOptionsAtom);
  const affiliates = useAffilia(name);
  const display = useDisplay();
  return (
    <Flex vertical gap="middle">
      <Space>
        {keys.map((key, index) => {
          return (
            <AntdSelect
              key={index}
              value={key}
              onChange={(event) => {
                keys[index] = event;
                addGenericMapping(name, keys.join(""));
              }}
              options={index ? allOptions : alphabetOptions}
            />
          );
        })}
        <Button
          onClick={() => {
            removeGenericMapping(name);
            affiliates?.map((x) => removeGenericGrouping(x));
          }}
        >
          删除
        </Button>
      </Space>
      {affiliates.length ? (
        <Flex vertical>
          <span>已归并字根</span>
          {affiliates.map((x) => (
            <Flex key={x} justify="space-between">
              <Root>{display(x)}</Root>
              <Button
                onClick={() => {
                  addGenericMapping(x, code);
                  removeGenericGrouping(x);
                }}
              >
                取消归并
              </Button>
            </Flex>
          ))}
        </Flex>
      ) : (
        <Space>
          或归并至
          <RootSelect
            char={undefined}
            onChange={(event) => setMain(event)}
            exclude={name}
          />
          <Button
            onClick={() => {
              addGenericGrouping(name, main!);
              removeGenericMapping(name);
            }}
          >
            归并
          </Button>
        </Space>
      )}
    </Flex>
  );
};

const AdjustableRoot = ({ name, code }: MappedInfo) => {
  const mapping = useAtomValue(mappingAtom);
  const mapping_type = useAtomValue(mappingTypeAtom);

  const affiliates = useAffilia(name);
  const padding = Math.max((mapping_type ?? 1) - code.length, 0);
  const keys = Array.from(code).concat(Array(padding).fill(""));

  const [main, setMain] = useState(Object.keys(mapping)[0]);
  const display = useDisplay();
  return (
    <Popover
      trigger={["click"]}
      title="字根编码"
      content={
        <AdjustableRootPopoverContent
          keys={keys}
          name={name}
          main={main!}
          code={code}
          setMain={setMain}
        />
      }
    >
      <Root
        style={{ color: display(name) === "丢失的字根" ? "red" : "initial" }}
      >
        {display(name)}
        {affiliates.length >= 1 && (
          <span style={{ fontSize: "0.8em" }}>
            ({affiliates.map(display).join(",")})
          </span>
        )}
        {code.length > 1 && <span>&nbsp;{code.slice(1)}</span>}
      </Root>
    </Popover>
  );
};

interface ImportResult {
  success: number;
  unknownKeys: string[];
  unknownValues: string[];
}

const ImportResultAlert = ({
  success,
  unknownKeys,
  unknownValues,
}: ImportResult) => {
  const successFeedback = `${success} 个字根已导入。`;
  const unknownKeysFeedback = `${
    unknownKeys.length
  } 个字根无法被系统识别：${unknownKeys.join("、")}。`;
  const unknownValuesFeedback = `${
    unknownValues.length
  } 个字根的键位无法被系统识别：${unknownValues.join(", ")}。`;
  return (
    <Alert
      showIcon
      closable
      type="warning"
      message="导入完成"
      description={
        <>
          <p>{successFeedback}</p>
          {unknownKeys.length > 0 && <p>{unknownKeysFeedback}</p>}
          {unknownValues.length > 0 && <p>{unknownValuesFeedback}</p>}
        </>
      }
    />
  );
};

const Mapping = () => {
  const mapping = useAtomValue(mappingAtom);
  const alphabet = useAtomValue(alphabetAtom);
  const mapping_type = useAtomValue(mappingTypeAtom);

  const form = useForm();

  const reversed = reverse(alphabet, mapping!);
  const keyboard = Array.from(
    "QWERTYUIOPASDFGHJKL:ZXCVBNM<>?" + "qwertyuiopasdfghjkl;zxcvbnm,./",
  );
  const printable_ascii = range(32, 127).map((x) => String.fromCodePoint(x));
  const [char, setChar] = useState<string | undefined>(undefined);
  const mapping_type_default = mapping_type ?? 1;
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const setGenericMaxCodelen = useSetAtom(setGenericMaxCodeLenAtom);
  const setGenericAlphabet = useSetAtom(setGenericAlphabetAtom);
  const batchGenericMapping = useSetAtom(batchGenericMappingAtom);
  return (
    <>
      <Form.Item label="编码类型">
        <Select
          value={mapping_type_default}
          onChange={(event) => setGenericMaxCodelen(event)}
          options={[
            { label: "单编码", value: 1 },
            { label: "双编码", value: 2 },
            { label: "三编码", value: 3 },
            { label: "四编码", value: 4 },
          ]}
        />
      </Form.Item>
      {importResult && <ImportResultAlert {...importResult} />}
      <Flex justify="center" gap="large">
        <Button
          onClick={() =>
            setGenericAlphabet(Array.from(alphabet).sort().join(""))
          }
        >
          按字典序排序
        </Button>
        <Button
          onClick={() =>
            setGenericAlphabet(
              Array.from(alphabet)
                .sort(
                  (a, b) =>
                    keyboard.findIndex((x) => x === a) -
                    keyboard.findIndex((x) => x === b),
                )
                .join(""),
            )
          }
        >
          按键盘序排序
        </Button>
        <Uploader
          action={(result) => {
            const record: Record<string, string> = {};
            const tsv = result
              .trim()
              .split("\n")
              .map((x) => x.trim().split("\t"));
            const unknownKeys: string[] = [];
            const unknownValues: string[] = [];
            for (const line of tsv) {
              const [key, value] = line;
              if (key === undefined || value === undefined) continue;
              if (form[key] === undefined) {
                unknownKeys.push(key);
                continue;
              }
              if (Array.from(value).some((x) => !alphabet.includes(x))) {
                unknownValues.push(key);
                continue;
              }
              record[key] = value.slice(0, mapping_type_default);
            }
            batchGenericMapping(record);
            setImportResult({
              success: Object.keys(record).length,
              unknownKeys,
              unknownValues,
            });
          }}
          text="导入键盘映射"
          type="txt"
        />
      </Flex>
      <List
        dataSource={Object.entries(reversed)}
        renderItem={(item: [string, MappedInfo[]]) => {
          const [key, roots] = item;
          return (
            <Flex gap="small" style={{ margin: "8px 0" }}>
              <Button
                shape="circle"
                type="text"
                danger
                disabled={roots.length > 0}
                onClick={() =>
                  setGenericAlphabet(
                    Array.from(alphabet)
                      .filter((x) => x !== key)
                      .join(""),
                  )
                }
                icon={<DeleteOutlined />}
              />
              <Char>{key}</Char>
              <Flex gap="small" wrap="wrap">
                {roots.map(({ name, code }) => (
                  <AdjustableRoot key={name} name={name} code={code} />
                ))}
              </Flex>
            </Flex>
          );
        }}
      />
      <Flex justify="center" gap="large">
        <Select
          value={char}
          onChange={setChar}
          options={printable_ascii
            .filter((x) => !alphabet.includes(x))
            .map((v) => ({
              label: v === " " ? "空格" : v,
              value: v,
            }))}
        />
        <Button
          type="primary"
          disabled={char === undefined}
          onClick={() => setGenericAlphabet(alphabet + char)}
        >
          添加
        </Button>
      </Flex>
    </>
  );
};

export default Mapping;
