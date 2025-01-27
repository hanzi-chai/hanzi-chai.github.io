import {
  Alert,
  Button,
  Flex,
  Form,
  List,
  Popover,
  Select,
  Space,
  Typography,
} from "antd";
import { useState, useMemo, memo } from "react";
import {
  useAtomValue,
  useSetAtom,
  keyboardAtom,
  groupingAtom,
  repertoireAtom,
  alphabetAtom,
  mappingTypeAtom,
  mappingAtom,
  useAddAtom,
  useRemoveAtom,
  useAtom,
  currentElementAtom,
} from "~/atoms";

import Char from "./Character";
import {
  getReversedMapping,
  isPUA,
  joinKeys,
  printableAscii,
  renderMapped,
} from "~/lib";
import { DeleteButton, Display, Uploader } from "./Utils";
import DeleteOutlined from "@ant-design/icons/DeleteOutlined";
import ElementSelect from "./ElementSelect";
import KeySelect from "./KeySelect";
import type { Key, MappedInfo, Mapping } from "~/lib";
import styled from "styled-components";
import { blue } from "@ant-design/colors";
import { ElementWithTooltip } from "./ElementPool";

const useAffiliates = (name: string) => {
  const mapping = useAtomValue(mappingAtom);
  const grouping = useAtomValue(groupingAtom);
  const fullAffiliates = useMemo(
    () =>
      Object.entries(grouping)
        .filter(([, to]) => to === name)
        .map(([x]) => x),
    [grouping, name],
  );
  const partialAffiliates = useMemo(
    () =>
      Object.entries(mapping).filter(([, mapped]) => {
        if (typeof mapped === "string") return false;
        const key = mapped[0];
        if (typeof key !== "object") return false;
        return key.element === name;
      }) as [string, Key[]][],
    [mapping, name],
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
  const removeMapping = useRemoveAtom(mappingAtom);
  return (
    <Flex justify="space-between" gap="large">
      <ElementWithTooltip element={name} />
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
            onDelete?.();
          }}
        />
      </Space>
    </Flex>
  );
};

interface ElementDetailProps {
  keys: Key[];
  name: string;
  main: string;
  setMain: Function;
}
const ElementDetail = ({ keys, name, main, setMain }: ElementDetailProps) => {
  const addMapping = useAddAtom(mappingAtom);
  const addGrouping = useAddAtom(groupingAtom);
  const removeMapping = useRemoveAtom(mappingAtom);
  const removeGrouping = useRemoveAtom(groupingAtom);
  const [affiliates, partialAffiliates] = useAffiliates(name);
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
              <ElementWithTooltip element={x} />
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
            <KeysEditor key={x} name={x} keys={keys} />
          ))}
        </Flex>
      )}
      {affiliates.length === 0 && partialAffiliates.length === 0 && (
        <Space>
          或归并至
          <ElementSelect
            excludeGrouped
            value={undefined}
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

const ElementLabelWrapper = styled.span<{ $shouldHighlight: boolean }>`
  display: inline-flex;
  align-items: end;
  cursor: pointer;
  line-height: 1;
  background: ${({ $shouldHighlight }) =>
    $shouldHighlight ? blue[2] : "transparent"};
  outline: ${({ $shouldHighlight }) =>
    $shouldHighlight ? `3px solid ${blue.primary}` : "none"};

  &:hover {
    background-color: #ddd;
  }
`;

export const ElementLabel = ({
  name,
  code,
  useProperName,
  ...rest
}: MappedInfo & { useProperName?: boolean }) => {
  const [affiliates, partialAffiliates] = useAffiliates(name);
  const properName =
    name.includes("-") && useProperName
      ? name.split("-").slice(1).join("-")
      : name;
  const currentElement = useAtomValue(currentElementAtom);
  const shouldHighlight =
    currentElement !== undefined &&
    (name === currentElement ||
      affiliates.includes(currentElement) ||
      partialAffiliates.map(([x]) => x).includes(currentElement));
  return (
    <ElementLabelWrapper {...rest} $shouldHighlight={shouldHighlight}>
      {/* 主要字根 */ <Display name={properName} />}
      {
        /* 归并字根 */ affiliates.length >= 1 && (
          <span style={{ fontSize: "0.7em", display: "inline-flex" }}>
            {affiliates.map((x) => (
              <Display key={x} name={x} />
            ))}
          </span>
        )
      }
      {
        /* 第二码及之后的编码 */ code.length > 1 && (
          <span style={{ fontSize: "0.8em" }}>
            {renderMapped(code.slice(1))}
          </span>
        )
      }
      {
        /* 部分归并字根 */ partialAffiliates.length >= 1 &&
          partialAffiliates.map(([element, mapped], index) => (
            <span style={{ fontSize: "0.7em" }} key={index}>
              [<Display name={element} />
              &nbsp;
              {renderMapped(mapped.slice(1))}]
            </span>
          ))
      }
    </ElementLabelWrapper>
  );
};

const AdjustableElement = ({ name, code }: MappedInfo) => {
  const { mapping, mapping_type } = useAtomValue(keyboardAtom);
  const keys = Array.from(code);
  while (keys.length < (mapping_type ?? 1)) {
    keys.push("");
  }
  const [main, setMain] = useState(Object.keys(mapping)[0]);
  return (
    <Popover
      trigger={["hover", "click"]}
      mouseLeaveDelay={0.3}
      content={
        <ElementDetail keys={keys} name={name} main={main!} setMain={setMain} />
      }
    >
      <ElementLabel name={name} code={code} />
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

const MappingUploader = ({
  setImportResult,
}: {
  setImportResult: (a: any) => void;
}) => {
  const repertoire = useAtomValue(repertoireAtom);
  const setMapping = useSetAtom(mappingAtom);
  const mappingType = useAtomValue(mappingTypeAtom);
  const alphabet = useAtomValue(alphabetAtom);
  return (
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
          if ("strokes" in glyph && glyph.strokes.length === 1) {
            unknownKeys.push(key);
            continue;
          }
          if (Array.from(value).some((x) => !alphabet.includes(x))) {
            unknownValues.push(key);
            continue;
          }
          record[key] = value.slice(0, mappingType);
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
  );
};

const MappingHeader = () => {
  const keyboard = Array.from(
    "QWERTYUIOPASDFGHJKL:ZXCVBNM<>?qwertyuiopasdfghjkl;zxcvbnm,./",
  );
  const keyboardSort = (a: string, b: string) =>
    keyboard.findIndex((x) => x === a) - keyboard.findIndex((x) => x === b);
  const [char, setChar] = useState<string | undefined>(undefined);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [mappingType, setMappingType] = useAtom(mappingTypeAtom);
  const [alphabet, setAlphabet] = useAtom(alphabetAtom);
  return (
    <>
      <Typography.Title level={3}>键盘映射</Typography.Title>
      <Flex justify="center" align="baseline" gap="small">
        <Form.Item label="编码类型">
          <Select
            value={mappingType}
            onChange={(event) => setMappingType(event)}
            options={[
              { label: "单编码", value: 1 },
              { label: "双编码", value: 2 },
              { label: "三编码", value: 3 },
              { label: "四编码", value: 4 },
            ]}
          />
        </Form.Item>
        <Form.Item label="添加按键">
          <Select
            style={{ width: 64 }}
            value={char}
            onChange={setChar}
            options={printableAscii
              .filter((x) => !alphabet.includes(x))
              .map((v) => ({
                label: v,
                value: v,
              }))}
          />
        </Form.Item>
        <Button
          type="primary"
          disabled={char === undefined}
          onClick={() => setAlphabet(alphabet + char)}
        >
          添加
        </Button>
        <Button
          onClick={() => setAlphabet(Array.from(alphabet).sort().join(""))}
        >
          排列为字典序
        </Button>
        <Button
          onClick={() =>
            setAlphabet(Array.from(alphabet).sort(keyboardSort).join(""))
          }
        >
          排列为键盘序
        </Button>
        <MappingUploader setImportResult={setImportResult} />
      </Flex>
      {importResult && <ImportResultAlert {...importResult} />}
    </>
  );
};

const MappingRow = memo(
  ({ symbol, elements }: { symbol: string; elements: MappedInfo[] }) => {
    const [alphabet, setAlphabet] = useAtom(alphabetAtom);
    return (
      <Flex style={{ borderTop: "1px solid #aaa" }}>
        <Button
          shape="circle"
          type="text"
          danger
          disabled={elements.length > 0}
          onClick={() =>
            setAlphabet(
              Array.from(alphabet)
                .filter((x) => x !== symbol)
                .join(""),
            )
          }
          icon={<DeleteOutlined />}
        />
        <Char>{symbol}</Char>
        <Flex gap="small" align="center" wrap="wrap">
          {elements.map(({ name, code }) => (
            <AdjustableElement key={name} name={name} code={code} />
          ))}
        </Flex>
      </Flex>
    );
  },
);

export default function Mapping() {
  const { mapping } = useAtomValue(keyboardAtom);
  const alphabet = useAtomValue(alphabetAtom);
  const reversedMapping = getReversedMapping(mapping, alphabet);

  return (
    <Flex vertical>
      <MappingHeader />
      <List
        dataSource={[...reversedMapping]}
        renderItem={([key, roots]: [string, MappedInfo[]]) => (
          <MappingRow key={key} symbol={key} elements={roots} />
        )}
      />
    </Flex>
  );
}
