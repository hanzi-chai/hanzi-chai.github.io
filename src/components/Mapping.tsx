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
import type { CSSProperties } from "react";
import { useState, useMemo, memo } from "react";
import {
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
  useAtom,
} from "~/atoms";

import Element from "./Element";
import Char from "./Character";
import { isPUA, joinKeys, printableAscii, renderMapped } from "~/lib";
import { DeleteButton, Uploader } from "./Utils";
import DeleteOutlined from "@ant-design/icons/DeleteOutlined";
import ElementSelect from "./ElementSelect";
import KeySelect from "./KeySelect";
import type { Key } from "~/lib";
import { useDraggable, useDroppable } from "@dnd-kit/core";

interface MappedInfo {
  name: string;
  code: string | Key[];
}

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
  const display = useAtomValue(displayAtom);
  return (
    <Flex justify="space-between" gap="large">
      <Element>{display(name)}</Element>
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
              <Element>{display(x)}</Element>
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

const AdjustableRoot = ({ name, code }: MappedInfo) => {
  const { mapping_type, mapping } = useAtomValue(keyboardAtom);

  const [affiliates, partialAffiliates] = useAffiliates(name);
  const padding = Math.max((mapping_type ?? 1) - code.length, 0);
  const keys = Array.from(code).concat(Array(padding).fill(""));

  const [main, setMain] = useState(Object.keys(mapping)[0]);
  const display = useAtomValue(displayAtom);
  // const { attributes, listeners, setNodeRef, transform } = useDraggable({
  //   id: `onsite-${name}`,
  // });
  // const style = transform
  //   ? {
  //       transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  //     }
  //   : undefined;
  return (
    <Popover
      trigger={["click"]}
      mouseLeaveDelay={0.3}
      content={
        <AdjustableRootPopoverContent
          keys={keys}
          name={name}
          main={main!}
          setMain={setMain}
        />
      }
    >
      <Element
        type="text"
        style={{ color: display(name) === "丢失的元素" ? "red" : "initial" }}
        // {...attributes} {...listeners} ref={setNodeRef}
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
      </Element>
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
  ({ symbol, roots }: { symbol: string; roots: MappedInfo[] }) => {
    const [alphabet, setAlphabet] = useAtom(alphabetAtom);
    const { isOver, setNodeRef } = useDroppable({
      id: symbol,
    });
    const style: CSSProperties = {
      backgroundColor: isOver ? "white" : undefined,
    };
    return (
      <Flex style={{ borderTop: "1px solid #aaa", ...style }} ref={setNodeRef}>
        <Button
          shape="circle"
          type="text"
          danger
          disabled={roots.length > 0}
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
        <Flex wrap="wrap">
          {roots.map(({ name, code }) => (
            <AdjustableRoot key={name} name={name} code={code} />
          ))}
        </Flex>
      </Flex>
    );
  },
);

export default function Mapping() {
  const { mapping } = useAtomValue(keyboardAtom);
  const alphabet = useAtomValue(alphabetAtom);

  const reversedMapping = new Map<string, MappedInfo[]>(
    Array.from(alphabet).map((key) => [key, []]),
  );
  for (const [name, code] of Object.entries(mapping)) {
    const main = code[0];
    if (typeof main === "string") {
      reversedMapping.get(main)?.push({ name, code });
    }
  }
  return (
    <Flex vertical>
      <MappingHeader />
      <List
        dataSource={[...reversedMapping]}
        renderItem={([key, roots]: [string, MappedInfo[]]) => (
          <MappingRow key={key} symbol={key} roots={roots} />
        )}
      />
    </Flex>
  );
}
