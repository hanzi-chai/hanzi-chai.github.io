import { blue } from "@ant-design/colors";
import DeleteOutlined from "@ant-design/icons/DeleteOutlined";
import {
  Alert,
  Button,
  Divider,
  Flex,
  Input,
  List,
  notification,
  Popconfirm,
  Popover,
  Select,
  Typography,
} from "antd";
import { sortBy } from "lodash-es";
import { memo, useState } from "react";
import styled from "styled-components";
import {
  useAddAtom,
  useAtom,
  useAtomValue,
  useAtomValueUnwrapped,
  useRemoveAtom,
  useSetAtom,
  决策原子,
  决策空间原子,
  别名显示原子,
  type 名称与安排,
  如字库原子,
  字母表原子,
  平铺决策原子,
  当前元素原子,
  按首码分组决策原子,
  编码类型原子,
  键盘原子,
} from "~/atoms";
import {
  码,
  type 决策,
  可打印字符列表,
  是归并,
  是私用区,
  读取表格,
  type 非空安排,
} from "~/lib";
import { exportTSV } from "~/utils";
import Char from "./Character";
import { ElementWithTooltip } from "./ElementPool";
import MappingSpace, { RulesForm } from "./MappingSpace";
import {
  DeleteButton,
  Display,
  DisplayWithSuperScript,
  Uploader,
} from "./Utils";
import ValueEditor from "./Value";

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

export const ElementDetail = ({
  keys,
  name,
  onClose,
}: {
  keys: 非空安排;
  name: string;
  onClose: () => void;
}) => {
  const addMapping = useAddAtom(决策原子);
  const removeMapping = useRemoveAtom(决策原子);
  const mapping = useAtomValue(决策原子);
  const affiliates = getAffiliates(name, mapping);
  const alphabet = useAtomValue(字母表原子);

  // 将修改先保存在本地，而非立即触发 addMapping。
  // 如此，用户可以调整多个编码而不会每次都刷新字根表
  const [currentValue, setCurrentValue] = useState<非空安排>(keys);
  const [otherValue, setOtherValue] = useState<非空安排>(
    是归并(keys) ? alphabet[0]! : { element: "1" },
  );

  // 只有在用户点击「确定」时才更新字根表
  const handleConfirm = () => {
    if (currentValue === null) {
      if (affiliates.length === 0) {
        removeMapping(name);
        onClose();
      } else {
        notification.error({ message: "无法删除有归并关系的元素" });
      }
    } else {
      addMapping(name, currentValue);
      onClose();
    }
  };

  const handleDelete = () => {
    const referenced: string[] = [];
    for (const [k, v] of Object.entries(mapping)) {
      if (是归并(v)) {
        if (v.element === name) referenced.push(k);
      } else if (Array.isArray(v)) {
        if (v.some((x) => typeof x === "object" && x.element === name))
          referenced.push(k);
      }
    }
    if (referenced.length === 0) {
      removeMapping(name);
      onClose();
    } else {
      notification.error({
        message: (
          <span>
            无法删除元素，因为元素被其他元素引用：
            {referenced.map((x) => (
              <Display name={x} key={x} />
            ))}
          </span>
        ),
      });
    }
  };

  return (
    <Flex vertical gap="middle">
      <Flex gap="small" align="center">
        <ElementWithTooltip element={name} />
        <ValueEditor
          value={currentValue}
          onChange={(newValue) => {
            setCurrentValue(newValue as 非空安排);
          }}
          isCurrent
        />
        <Button onClick={handleConfirm}>确定</Button>
        <DeleteButton onClick={handleDelete} disabled={affiliates.length > 0} />
      </Flex>
      <Flex align="center" gap="small">
        或改为：
        <ValueEditor
          value={otherValue}
          onChange={(newValue) => {
            setOtherValue(newValue as 非空安排);
          }}
          isCurrent
        />
        <Button
          onClick={() => {
            addMapping(name, otherValue);
            onClose();
          }}
        >
          确定
        </Button>
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

const ResidualCodeWrapper = styled.span`
  font-size: 0.85em;
  padding-left: 2px;
`;

export const AdjustableElementGroup = ({
  名称: name,
  安排: code,
  displayMode,
}: 名称与安排 & { displayMode?: boolean }) => {
  const mapping = useAtomValue(决策原子);
  const affiliates = getAffiliates(name, mapping);
  const normalize = (s: string) => (displayMode ? s.split("-").at(-1)! : s);
  const currentElement = useAtomValue(当前元素原子);
  const mappingSpace = useAtomValue(决策空间原子);
  const isOptional = (name: string) =>
    mappingSpace[name]?.some((x) => x.value === null) ?? false;
  const rest = code.slice(1);
  const [openPopover, setOpenPopover] = useState(false);
  const [openAffiliatePopover, setOpenAffiliatePopover] = useState<
    Record<string, boolean>
  >({});

  return (
    <span>
      <Popover
        title="编辑决策"
        trigger="click"
        open={openPopover}
        onOpenChange={setOpenPopover}
        content={
          <ElementDetail
            keys={code}
            name={name}
            onClose={() => setOpenPopover(false)}
          />
        }
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
          trigger="click"
          open={openAffiliatePopover[from] ?? false}
          onOpenChange={(open) =>
            setOpenAffiliatePopover({ ...openAffiliatePopover, [from]: open })
          }
          content={
            <ElementDetail
              keys={{ element: to }}
              name={from}
              onClose={() =>
                setOpenAffiliatePopover({
                  ...openAffiliatePopover,
                  [from]: false,
                })
              }
            />
          }
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
          <ResidualCodeWrapper>
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
          </ResidualCodeWrapper>
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
        const tsv = 读取表格(result);
        const unknownKeys: string[] = [];
        const unknownValues: string[] = [];
        for (const line of tsv) {
          const [key, value] = line;
          if (key === undefined || value === undefined) continue;
          const glyphs = repertoire.查询字形(key);
          if (glyphs === undefined || 是私用区(key)) {
            unknownKeys.push(key);
            continue;
          }
          let isSingleStroke = false;
          for (const glyph of glyphs) {
            if ("strokes" in glyph && glyph.strokes.length === 1) {
              unknownKeys.push(key);
              isSingleStroke = true;
              break;
            }
          }
          if (isSingleStroke) continue;
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
      type=".txt"
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
            output.push([key, `U+${码(key)}`, display(key)]);
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
  ({ symbol, elements }: { symbol: string; elements: 名称与安排[] }) => {
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
        renderItem={([key, roots]: [string, 名称与安排[]]) => (
          <MappingRow key={key} symbol={key} elements={roots} />
        )}
      />
      <MappingSpace />
    </Flex>
  );
}
