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
import {
  type 元素,
  可打印字符列表,
  字符,
  type 强类型非归并安排,
  type 强类型非空安排,
  是强类型归并,
  是部件,
  读取表格,
  默认分类器,
} from "hanzi-chai";
import { sortBy } from "lodash-es";
import { type ComponentProps, memo, useState } from "react";
import {
  GF0014映射原子,
  useAtom,
  useAtomValue,
  useAtomValueUnwrapped,
  useMapAddAtom,
  useMapRemoveAtom,
  useSetAtom,
  全部合法元素原子,
  决策图原子,
  别名显示原子,
  原始字库原子,
  基本信息原子,
  如字库原子,
  字母表原子,
  强类型决策原子,
  强类型决策空间原子,
  强类型线性化决策原子,
  强类型翻转决策原子,
  当前元素原子,
  编码类型原子,
} from "~/atoms";
import { exportTSV } from "~/utils";
import Item from "./Item";
import MappingSpace, { RulesForm } from "./MappingSpace";
import {
  BoxedElementWithTooltip,
  CodePositionDisplay,
  DeleteButton,
  ElementDisplay,
  Uploader,
} from "./Utils";
import ValueEditor from "./Value";

export const ElementDetail = ({
  element,
  onClose,
}: {
  element: 元素;
  onClose: () => void;
}) => {
  const addMapping = useMapAddAtom(强类型决策原子);
  const removeMapping = useMapRemoveAtom(强类型决策原子);
  const mapping = useAtomValueUnwrapped(强类型决策原子);
  const 决策图 = useAtomValueUnwrapped(决策图原子);
  const affiliates = 决策图.获取被归并元素(element);
  const alphabet = useAtomValue(字母表原子);
  const gf0014 = useAtomValue(GF0014映射原子);
  const { 笔画列表 } = useAtomValueUnwrapped(全部合法元素原子);
  const keys = mapping.get(element)!;
  const { name } = useAtomValue(基本信息原子);

  // 将修改先保存在本地，而非立即触发 addMapping。
  // 如此，用户可以调整多个编码而不会每次都刷新字根表
  const [currentValue, setCurrentValue] = useState<强类型非空安排>(keys);
  const [otherValue, setOtherValue] = useState<强类型非空安排>(
    是强类型归并(keys) ? alphabet[0]! : { element: 笔画列表[0]! },
  );

  // 只有在用户点击「确定」时才更新字根表
  const handleConfirm = () => {
    if (currentValue === null) {
      if (affiliates.length === 0) {
        removeMapping(element);
        onClose();
      } else {
        notification.error({ message: "无法删除有归并关系的元素" });
      }
    } else {
      addMapping(element, currentValue);
      onClose();
    }
  };

  const handleDelete = () => {
    const referenced: 元素[] = [];
    for (const [k, v] of mapping) {
      if (是强类型归并(v)) {
        if (v.element === element) referenced.push(k);
      } else if (Array.isArray(v)) {
        if (v.some((x) => typeof x === "object" && x.element === element))
          referenced.push(k);
      }
    }
    if (referenced.length === 0) {
      removeMapping(element);
      onClose();
    } else {
      notification.error({
        message: (
          <span>
            无法删除元素，因为元素被其他元素引用：
            {referenced.map((x) => (
              <ElementDisplay key={x.获取名称()} element={x} />
            ))}
          </span>
        ),
      });
    }
  };

  if (!element) return null;

  return (
    <Flex vertical gap="middle">
      <Flex gap="small" align="center">
        <BoxedElementWithTooltip element={element} />
        <ValueEditor
          value={currentValue}
          onChange={(newValue) => {
            setCurrentValue(newValue as 强类型非空安排);
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
            setOtherValue(newValue as 强类型非空安排);
          }}
          isCurrent
        />
        <Button
          onClick={() => {
            addMapping(element, otherValue);
            onClose();
          }}
        >
          确定
        </Button>
      </Flex>
      <Divider size="small" />
      {name === "冰雪飞花" && gf0014.has(element as 字符) && (
        <div>GF0014: {gf0014.get(element as 字符)!.pinyin.join(",")}</div>
      )}
      <RulesForm element={element} />
    </Flex>
  );
};

export const ElementLabelWrapper = ({
  $shouldHighlight,
  className,
  ...props
}: { $shouldHighlight: boolean } & ComponentProps<"span">) => (
  <span
    className={`items-baseline cursor-pointer leading-none py-2 px-0 rounded-sm hover:bg-[#ddd] ${
      $shouldHighlight
        ? "bg-[#91caff] [outline:3px_solid_#1677ff]!"
        : "bg-transparent outline-none"
    } ${className ?? ""}`}
    {...props}
  />
);

export const AdjustableElementGroup = ({
  element,
  value,
  displayMode,
}: {
  element: 元素;
  value: 强类型非归并安排;
  displayMode?: boolean;
}) => {
  const 决策图 = useAtomValueUnwrapped(决策图原子);
  const affiliates = 决策图.获取被归并元素(element);
  const currentElement = useAtomValue(当前元素原子);
  const mappingSpace = useAtomValueUnwrapped(强类型决策空间原子);
  const isOptional = (e: 元素) =>
    mappingSpace.get(e)?.some((x) => x.value === null) ?? false;
  const rest = value.slice(1);
  const [openPopover, setOpenPopover] = useState(false);
  const [openAffiliatePopover, setOpenAffiliatePopover] = useState<
    Map<元素, boolean>
  >(new Map());

  return (
    <Flex align="center">
      <Popover
        title="编辑决策"
        trigger="click"
        open={openPopover}
        onOpenChange={setOpenPopover}
        content={
          <ElementDetail
            element={element}
            onClose={() => setOpenPopover(false)}
          />
        }
      >
        <ElementLabelWrapper $shouldHighlight={element === currentElement}>
          <ElementDisplay
            element={element}
            hideTypeNames={displayMode}
            className={
              !displayMode && isOptional(element)
                ? "text-[#9d9d9d]"
                : "text-black"
            }
          />
        </ElementLabelWrapper>
      </Popover>
      {affiliates.map(({ from, to }) => (
        <Popover
          key={`${from.获取名称()}-${to.获取名称()}`}
          title="编辑决策"
          trigger="click"
          open={openAffiliatePopover.get(from) ?? false}
          onOpenChange={(open) =>
            setOpenAffiliatePopover(
              new Map([...openAffiliatePopover, [from, open]]),
            )
          }
          content={
            <ElementDetail
              element={from}
              onClose={() =>
                setOpenAffiliatePopover(
                  new Map([...openAffiliatePopover, [from, false]]),
                )
              }
            />
          }
        >
          <ElementLabelWrapper
            $shouldHighlight={from === currentElement}
            className="text-[0.85em]"
          >
            <ElementDisplay
              key={from.获取名称()}
              hideTypeNames={displayMode}
              element={from}
              className={
                !displayMode && isOptional(from)
                  ? "text-[#9d9d9d]"
                  : "text-black"
              }
            />
          </ElementLabelWrapper>
        </Popover>
      ))}
      {
        /* 第二码及之后的编码 */ rest.length > 0 && (
          <span className="text-[0.85em] pl-0.5 flex items-baseline">
            {typeof rest === "string"
              ? rest
              : rest.map((x, i) => {
                  return <CodePositionDisplay key={i} element={x} />;
                })}
          </span>
        )
      }
    </Flex>
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
  const 原始字库 = useAtomValue(原始字库原子);
  const mapping = useAtomValueUnwrapped(强类型决策原子);
  const setMapping = useSetAtom(强类型决策原子);
  const mappingType = useAtomValue(编码类型原子);
  const alphabet = useAtomValue(字母表原子);
  return (
    <Uploader
      action={(result) => {
        const record = new Map<元素, string>();
        const tsv = 读取表格(result);
        const unknownKeys: string[] = [];
        const unknownValues: string[] = [];
        for (const line of tsv) {
          const [key, value] = line;
          if (key === undefined || value === undefined) continue;
          const ch = 原始字库.校验(key)?.character;
          if (!ch) {
            unknownKeys.push(key);
            continue;
          }
          const glyphs = repertoire.查询字形(ch);
          if (glyphs === undefined || ch.是私用区()) {
            unknownKeys.push(key);
            continue;
          }
          let isSingleStroke = false;
          for (const glyph of glyphs) {
            if (是部件(glyph) && glyph.获取笔画序列(默认分类器).length === 1) {
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
          record.set(ch, value.slice(0, mappingType));
        }
        setMapping(new Map([...mapping, ...record]));
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
  const flatMapping = useAtomValueUnwrapped(强类型线性化决策原子);
  return (
    <Button
      onClick={() =>
        exportTSV(
          [...flatMapping].map(([k, v]) => [k.获取名称(), v]),
          "键盘映射.txt",
        )
      }
    >
      导出键盘映射
    </Button>
  );
};

const PUAExporter = () => {
  const mapping = useAtomValueUnwrapped(强类型决策原子);
  const display = useAtomValue(别名显示原子);
  return (
    <Button
      onClick={() => {
        const 私用区字符列表 = [...mapping.keys()].filter(
          (x) => x instanceof 字符 && x.是私用区(),
        ) as 字符[];
        私用区字符列表.sort((a, b) => a.toNumber() - b.toNumber());
        const tsv: string[][] = [];
        for (const 字符 of 私用区字符列表) {
          tsv.push([字符.获取名称(), 字符.十六进制(), display(字符)]);
        }
        exportTSV(tsv, "PUA 映射.txt");
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
          className="w-16"
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
    </>
  );
};

const MappingRow = memo(
  ({
    symbol,
    elements,
  }: {
    symbol: string;
    elements: { 元素: 元素; 安排: 强类型非归并安排 }[];
  }) => {
    const [alphabet, setAlphabet] = useAtom(字母表原子);
    return (
      <Flex className="border-t border-[#aaa]">
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
        <Item>{symbol}</Item>
        <Flex align="center" wrap="wrap" gap="small">
          {elements.map(({ 元素, 安排 }) => (
            <AdjustableElementGroup
              key={元素.获取名称()}
              element={元素}
              value={安排}
            />
          ))}
        </Flex>
      </Flex>
    );
  },
);

export default function MappingComponent() {
  const 翻转决策 = useAtomValueUnwrapped(强类型翻转决策原子);

  return (
    <Flex vertical gap="small">
      <MappingHeader />
      <List
        dataSource={[...翻转决策]}
        renderItem={([key, roots]) => (
          <MappingRow key={key} symbol={key} elements={roots} />
        )}
      />
      <MappingSpace />
    </Flex>
  );
}
