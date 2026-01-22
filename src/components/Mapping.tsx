import {
  Alert,
  Button,
  Divider,
  Flex,
  Form,
  Input,
  List,
  notification,
  Popconfirm,
  Popover,
  Select,
  Typography,
} from "antd";
import { useState, memo } from "react";
import {
  useAtomValue,
  useSetAtom,
  如字库原子,
  字母表原子,
  编码类型原子,
  决策原子,
  useAddAtom,
  useRemoveAtom,
  useAtom,
  currentElementAtom,
  决策空间原子,
  键盘原子,
} from "~/atoms";
import Char from "./Character";
import MappingSpace, { RulesForm } from "./MappingSpace";
import { getReversedMapping, isMerge, isPUA, 可打印字符列表 } from "~/lib";
import {
  DeleteButton,
  Display,
  DisplayWithSuperScript,
  Uploader,
} from "./Utils";
import DeleteOutlined from "@ant-design/icons/DeleteOutlined";
import type { Key, 首码分组, Mapping, Value } from "~/lib";
import styled from "styled-components";
import { blue } from "@ant-design/colors";
import { ElementWithTooltip } from "./ElementPool";
import { sortBy } from "lodash-es";
import ValueEditor from "./Value";

const visit = (
  parent: string,
  name: string,
  output: any[],
  mapping: Mapping,
) => {
  output.push({ from: name, to: parent });
  const children = Object.entries(mapping)
    .filter(([, to]) => isMerge(to) && to.element === name)
    .map(([x]) => x);
  children.forEach((child) => visit(name, child, output, mapping));
};

export const getAffiliates = (name: string, mapping: Mapping) => {
  const result: { from: string; to: string }[] = [];
  // use pre-dfs to get all affiliates
  Object.entries(mapping).forEach(([key, value]) => {
    if (isMerge(value) && value.element === name) {
      visit(name, key, result, mapping);
    }
  });
  return result;
};

const ElementDetail = ({
  keys,
  name,
}: {
  keys: Exclude<Value, null>;
  name: string;
}) => {
  const addMapping = useAddAtom(决策原子);
  const removeMapping = useRemoveAtom(决策原子);
  const mapping = useAtomValue(决策原子);
  const affiliates = getAffiliates(name, mapping);
  return (
    <Flex vertical gap="middle">
      <Flex gap="small" align="center">
        <ElementWithTooltip element={name} />
        <ValueEditor
          value={keys}
          onChange={(newValue) => {
            if (newValue === null) {
              if (affiliates.length === 0) removeMapping(name);
              else notification.error({ message: "无法删除有归并关系的元素" });
            } else {
              addMapping(name, newValue as Exclude<Value, null>);
            }
          }}
          isCurrent
        />
        <DeleteButton
          onClick={() => removeMapping(name)}
          disabled={affiliates.length > 0}
        />
      </Flex>
      <Divider size="small" />
      <RulesForm name={name} />
    </Flex>
  );
};

export const ElementLabelWrapper = styled.span<{ $shouldHighlight: boolean }>`
  align-items: baseline;
  cursor: pointer;
  line-height: 1;
  padding: 8px 0px;
  border-radius: 4px;
  background: ${({ $shouldHighlight }) =>
    $shouldHighlight ? blue[2] : "transparent"};
  outline: ${({ $shouldHighlight }) =>
    $shouldHighlight ? `3px solid ${blue.primary}` : "none"};

  &:hover {
    background-color: #ddd;
  }
`;

const DisplayWrapper = styled(Display)<{ $optional: boolean }>`
  color: ${({ $optional }) => ($optional ? "#9d9d9d" : "black")};
`;

export const AdjustableElementGroup = ({
  name,
  code,
  displayMode,
}: 首码分组 & { displayMode?: boolean }) => {
  const mapping = useAtomValue(决策原子);
  const affiliates = getAffiliates(name, mapping);
  const normalize = (s: string) => (displayMode ? s.split("-").at(-1)! : s);
  const currentElement = useAtomValue(currentElementAtom);
  const mappingSpace = useAtomValue(决策空间原子);
  const isOptional = (name: string) =>
    mappingSpace[name]?.some((x) => x.value === null) ?? false;
  const rest = code.slice(1);
  return (
    <span>
      <Popover
        title="编辑决策"
        trigger={["hover", "click"]}
        mouseLeaveDelay={0.3}
        content={<ElementDetail keys={code} name={name} />}
      >
        <ElementLabelWrapper $shouldHighlight={name === currentElement}>
          <DisplayWrapper
            name={normalize(name)}
            $optional={!displayMode && isOptional(name)}
          />
        </ElementLabelWrapper>
      </Popover>
      {affiliates.map(({ from, to }) => (
        <Popover
          key={`${from}-${to}`}
          title="编辑决策"
          trigger={["hover", "click"]}
          mouseLeaveDelay={0.3}
          content={<ElementDetail keys={{ element: to }} name={from} />}
        >
          <ElementLabelWrapper
            $shouldHighlight={from === currentElement}
            style={{ fontSize: "0.85em" }}
          >
            <DisplayWrapper
              key={from}
              name={normalize(from)}
              $optional={!displayMode && isOptional(from)}
            />
          </ElementLabelWrapper>
        </Popover>
      ))}
      {
        /* 第二码及之后的编码 */ rest.length > 0 && (
          <span style={{ fontSize: "0.85em", paddingLeft: "2px" }}>
            {typeof rest === "string"
              ? rest
              : rest.map((x) => {
                  return typeof x === "string" ? (
                    x
                  ) : (
                    <DisplayWithSuperScript name={x.element} index={x.index} />
                  );
                })}
          </span>
        )
      }
    </span>
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
  const repertoire = useAtomValue(如字库原子);
  const setMapping = useSetAtom(决策原子);
  const mappingType = useAtomValue(编码类型原子);
  const alphabet = useAtomValue(字母表原子);
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
  const [order, setOrder] = useState("");
  const [char, setChar] = useState<string | undefined>(undefined);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [mappingType, setMappingType] = useAtom(编码类型原子);
  const mapping = useAtomValue(决策原子);
  const [keyboard, setKeyboard] = useAtom(键盘原子);
  const [alphabet, setAlphabet] = useAtom(字母表原子);
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
            options={可打印字符列表
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
        <Popconfirm
          title="请输入排列顺序"
          description={
            <Input
              value={order}
              onChange={(event) => setOrder(event.target.value)}
            />
          }
          onConfirm={() =>
            setAlphabet(
              sortBy(Array.from(alphabet), (x) => order.indexOf(x)).join(""),
            )
          }
        >
          <Button>自定义排列顺序</Button>
        </Popconfirm>
        <MappingUploader setImportResult={setImportResult} />
      </Flex>
      {importResult && <ImportResultAlert {...importResult} />}
      {Object.keys(keyboard.grouping ?? {}).length > 0 && (
        <Button
          type="primary"
          onClick={() => {
            const newMapping = { ...mapping };
            for (const [key, value] of Object.entries(
              keyboard.grouping ?? {},
            )) {
              newMapping[key] = { element: value };
            }
            const newKeyboard = { ...keyboard, mapping: newMapping };
            delete newKeyboard.grouping;
            setKeyboard(newKeyboard);
            notification.success({ message: "迁移完成" });
          }}
        >
          当前方案中存在旧版的归并元素配置，请点击此处一键迁移
        </Button>
      )}
    </>
  );
};

const MappingRow = memo(
  ({ symbol, elements }: { symbol: string; elements: 首码分组[] }) => {
    const [alphabet, setAlphabet] = useAtom(字母表原子);
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
        <Flex align="center" wrap="wrap" gap="small">
          {elements.map(({ name, code }) => (
            <AdjustableElementGroup key={name} name={name} code={code} />
          ))}
        </Flex>
      </Flex>
    );
  },
);

export default function MappingComponent() {
  const mapping = useAtomValue(决策原子);
  const alphabet = useAtomValue(字母表原子);
  const reversedMapping = getReversedMapping(mapping, alphabet);

  return (
    <Flex vertical>
      <MappingHeader />
      <List
        dataSource={[...reversedMapping]}
        renderItem={([key, roots]: [string, 首码分组[]]) => (
          <MappingRow key={key} symbol={key} elements={roots} />
        )}
      />
      <MappingSpace />
    </Flex>
  );
}
