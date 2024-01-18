import { Alert, Button, Flex, Form, List, Popover, Space } from "antd";
import { useState, useMemo } from "react";
import {
  atom,
  useAtomValue,
  useSetAtom,
  keyboardAtom,
  groupingAtom,
  repertoireAtom,
  displayAtom,
  alphabetAtom,
  mappingTypeAtom,
  mappingAtom,
  useAddAtom,
  useRemoveAtom,
} from "~/atoms";

import Root from "./Element";
import Char from "./Character";
import type { MappedInfo } from "~/lib";
import { isPUA, reverse } from "~/lib";
import {
  DeleteButton,
  Select,
  Uploader,
  joinKeys,
  renderMapped,
} from "./Utils";
import { range } from "lodash-es";
import DeleteOutlined from "@ant-design/icons/DeleteOutlined";
import ElementSelect from "./ElementSelect";
import KeySelect from "./KeySelect";
import { Key } from "~/lib";

const useAffiliates = (name: string) => {
  const mapping = useAtomValue(mappingAtom);
  const grouping = useAtomValue(groupingAtom);
  const fullAffiliates = useMemo(
    () =>
      Object.entries(grouping)
        .filter(([, to]) => to === name)
        .map(([x]) => x),
    [grouping],
  );
  const partialAffiliates = useMemo(
    () =>
      Object.entries(mapping).filter(([, mapped]) => {
        if (typeof mapped === "string") return false;
        const key = mapped[0];
        if (typeof key !== "object") return false;
        return key.element === name;
      }) as [string, Key[]][],
    [mapping],
  );
  return [fullAffiliates, partialAffiliates] as const;
};

const KeysEditor = ({
  name,
  keys,
  onDelete,
}: {
  name: string;
  keys: Key[];
  onDelete?: () => void;
}) => {
  const addMapping = useAddAtom(mappingAtom);
  const addGrouping = useAddAtom(groupingAtom);
  const removeMapping = useRemoveAtom(mappingAtom);
  const removeGrouping = useRemoveAtom(groupingAtom);
  const display = useAtomValue(displayAtom);
  return (
    <Flex justify="space-between" gap="large">
      <Root>{display(name)}</Root>
      <Space>
        {keys.map((key, index) => {
          return (
            <KeySelect
              key={index}
              value={key}
              onChange={(event) => {
                keys[index] = event;
                addMapping(name, joinKeys(keys));
              }}
              allowEmpty={index !== 0}
            />
          );
        })}
        <DeleteButton
          onClick={() => {
            removeMapping(name);
            if (onDelete) {
              onDelete();
            }
          }}
        />
      </Space>
    </Flex>
  );
};

interface AdjustableRootPopoverContentProps {
  keys: Key[];
  name: string;
  main: string;
  setMain: Function;
}
const AdjustableRootPopoverContent = ({
  keys,
  name,
  main,
  setMain,
}: AdjustableRootPopoverContentProps) => {
  const addMapping = useAddAtom(mappingAtom);
  const addGrouping = useAddAtom(groupingAtom);
  const removeMapping = useRemoveAtom(mappingAtom);
  const removeGrouping = useRemoveAtom(groupingAtom);
  const [affiliates, partialAffiliates] = useAffiliates(name);
  const display = useAtomValue(displayAtom);
  return (
    <Flex vertical gap="middle">
      <KeysEditor
        name={name}
        keys={keys}
        onDelete={() => affiliates?.map((x) => removeGrouping(x))}
      />
      {affiliates.length > 0 && (
        <Flex vertical gap="small">
          <span>归并元素</span>
          {affiliates.map((x) => (
            <Flex key={x} justify="space-between">
              <Root>{display(x)}</Root>
              <Button
                onClick={() => {
                  addMapping(x, joinKeys(keys));
                  removeGrouping(x);
                }}
              >
                取消归并
              </Button>
            </Flex>
          ))}
        </Flex>
      )}
      {partialAffiliates.length > 0 && (
        <Flex vertical gap="small">
          <span>部分归并元素</span>
          {partialAffiliates.map(([x, keys]) => (
            <KeysEditor name={x} keys={keys} />
          ))}
        </Flex>
      )}
      {affiliates.length === 0 && partialAffiliates.length === 0 && (
        <Space>
          或归并至
          <ElementSelect
            excludeGrouped
            char={undefined}
            onChange={(event) => setMain(event)}
            customFilter={(s) => s !== name}
          />
          <Button
            onClick={() => {
              addGrouping(name, main!);
              removeMapping(name);
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
  const { mapping_type, mapping } = useAtomValue(keyboardAtom);

  const [affiliates, partialAffiliates] = useAffiliates(name);
  const padding = Math.max((mapping_type ?? 1) - code.length, 0);
  const keys = Array.from(code).concat(Array(padding).fill(""));

  const [main, setMain] = useState(Object.keys(mapping)[0]);
  const display = useAtomValue(displayAtom);
  return (
    <Popover
      trigger={["click"]}
      content={
        <AdjustableRootPopoverContent
          keys={keys}
          name={name}
          main={main!}
          setMain={setMain}
        />
      }
    >
      <Root
        style={{ color: display(name) === "丢失的元素" ? "red" : "initial" }}
      >
        <Space size={4}>
          {display(name)}
          {affiliates.length >= 1 && (
            <span style={{ fontSize: "0.8em" }}>
              ({affiliates.map(display).join(",")})
            </span>
          )}
          {code.length > 1 && (
            <span style={{ fontSize: "0.8em" }}>
              {renderMapped(code.slice(1))}
            </span>
          )}
          {partialAffiliates.length >= 1 &&
            partialAffiliates.map(([element, mapped], index) => (
              <span style={{ fontSize: "0.8em" }} key={index}>
                [{display(element)}
                &nbsp;
                {renderMapped(mapped.slice(1))}]
              </span>
            ))}
        </Space>
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
  const { alphabet, mapping_type, mapping } = useAtomValue(keyboardAtom);
  const repertoire = useAtomValue(repertoireAtom);
  const reversed = reverse(alphabet, mapping!);
  const keyboard = Array.from(
    "QWERTYUIOPASDFGHJKL:ZXCVBNM<>?" + "qwertyuiopasdfghjkl;zxcvbnm,./",
  );
  const printable_ascii = range(32, 127).map((x) => String.fromCodePoint(x));
  const [char, setChar] = useState<string | undefined>(undefined);
  const mapping_type_default = mapping_type ?? 1;
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const setMappingType = useSetAtom(mappingTypeAtom);
  const setAlphabet = useSetAtom(alphabetAtom);
  const setMapping = useSetAtom(mappingAtom);
  return (
    <>
      <Form.Item label="编码类型">
        <Select
          value={mapping_type_default}
          onChange={(event) => setMappingType(event)}
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
          onClick={() => setAlphabet(Array.from(alphabet).sort().join(""))}
        >
          按字典序排序
        </Button>
        <Button
          onClick={() =>
            setAlphabet(
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
              const glyph = repertoire[key]?.glyph;
              if (glyph === undefined || isPUA(key)) {
                unknownKeys.push(key);
                continue;
              }
              if ("strokes" in glyph && glyph.strokes.length == 1) {
                unknownKeys.push(key);
                continue;
              }
              if (Array.from(value).some((x) => !alphabet.includes(x))) {
                unknownValues.push(key);
                continue;
              }
              record[key] = value.slice(0, mapping_type_default);
            }
            setMapping((mapping) => ({ ...mapping, ...record }));
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
                  setAlphabet(
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
          onClick={() => setAlphabet(alphabet + char)}
        >
          添加
        </Button>
      </Flex>
    </>
  );
};

export default Mapping;
