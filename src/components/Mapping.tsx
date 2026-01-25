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
  决策空间原子,
  键盘原子,
  type 首码分组,
  useAtomValueUnwrapped,
  按首码分组决策原子,
  当前元素原子,
  平铺决策原子,
  别名显示原子,
} from "~/atoms";
import Char from "./Character";
import MappingSpace, { RulesForm } from "./MappingSpace";
import { hex, 决策, 可打印字符列表, 安排, 是归并, 非空安排 } from "~/lib";
import {
  DeleteButton,
  Display,
  DisplayWithSuperScript,
  Uploader,
} from "./Utils";
import DeleteOutlined from "@ant-design/icons/DeleteOutlined";
import styled from "styled-components";
import { blue } from "@ant-design/colors";
import { ElementWithTooltip } from "./ElementPool";
import { sortBy } from "lodash-es";
import ValueEditor from "./Value";
import { 是私用区 } from "~/lib";
import { exportTSV } from "~/utils";

const visit = (parent: string, name: string, output: any[], mapping: 决策) => {
  output.push({ from: name, to: parent });
  const children = Object.entries(mapping)
    .filter(([, to]) => 是归并(to) && to.element === name)
    .map(([x]) => x);
  children.map((child) => visit(name, child, output, mapping));
};

export const getAffiliates = (name: string, mapping: 决策) => {
  const result: { from: string; to: string }[] = [];
  // use pre-dfs to get all affiliates
  Object.entries(mapping).forEach(([key, value]) => {
    if (是归并(value) && value.element === name) {
      visit(name, key, result, mapping);
    }
  });
  return result;
};

const ElementDetail = ({ keys, name }: { keys: 非空安排; name: string }) => {
  const addMapping = useAddAtom(决策原子);
  const removeMapping = useRemoveAtom(决策原子);
  const mapping = useAtomValue(决策原子);
  const affiliates = getAffiliates(name, mapping);
  const alphabet = useAtomValue(字母表原子);

  const [otherWay, setOtherWay] = useState<非空安排>(
    是归并(keys) ? alphabet[0]! : { element: "1" },
  );
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
              addMapping(name, newValue as 非空安排);
            }
          }}
          isCurrent
        />
        <DeleteButton
          onClick={() => removeMapping(name)}
          disabled={affiliates.length > 0}
        />
      </Flex>
      <Flex align="center" gap="small">
        或改为：
        <ValueEditor
          value={otherWay}
          onChange={(newValue) => {
            setOtherWay(newValue as 非空安排);
          }}
          isCurrent
        />
        <Button onClick={() => addMapping(name, otherWay)}>确定</Button>
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
  名称: name,
  安排: code,
  displayMode,
}: 首码分组 & { displayMode?: boolean }) => {
  const mapping = useAtomValue(决策原子);
  const affiliates = getAffiliates(name, mapping);
  const normalize = (s: string) => (displayMode ? s.split("-").at(-1)! : s);
  const currentElement = useAtomValue(当前元素原子);
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
              : rest.map((x, i) => {
                  return typeof x === "string" ? (
                    x
                  ) : (
                    <DisplayWithSuperScript
                      key={i}
                      name={x.element}
                      index={x.index}
                    />
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
  const repertoire = useAtomValueUnwrapped(如字库原子);
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
          const glyph = repertoire.查询字形(key);
          if (glyph === undefined || 是私用区(key)) {
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

const MappingExporter = () => {
  const flatMapping = useAtomValueUnwrapped(平铺决策原子);
  return (
    <Button onClick={() => exportTSV([...flatMapping], "键盘映射.txt")}>
      导出键盘映射
    </Button>
  );
};

const PUAExporter = () => {
  const mapping = useAtomValue(决策原子);
  const display = useAtomValue(别名显示原子);
  return (
    <Button
      onClick={() => {
        const output: string[][] = [];
        for (const key of Object.keys(mapping)) {
          if (是私用区(key)) {
            output.push([key, `U+${hex(key)}`, display(key)]);
          }
        }
        const sorted = sortBy(output, (x) => x[0]!.codePointAt(0));
        exportTSV(sorted, "PUA 映射.txt");
      }}
    >
      导出 PUA 映射
    </Button>
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
        编码类型：
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
        添加按键：
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
      </Flex>
      <Flex justify="center" align="baseline" gap="small">
        <MappingUploader setImportResult={setImportResult} />
        <MappingExporter />
        <PUAExporter />
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
          {elements.map(({ 名称: name, 安排: code }) => (
            <AdjustableElementGroup key={name} 名称={name} 安排={code} />
          ))}
        </Flex>
      </Flex>
    );
  },
);

export default function MappingComponent() {
  const reversedMapping = useAtomValueUnwrapped(按首码分组决策原子);

  return (
    <Flex vertical gap="small">
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
