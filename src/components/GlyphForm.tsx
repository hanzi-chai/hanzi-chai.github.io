import { CameraOutlined } from "@ant-design/icons";
import type {
  ProFormInstance,
  ProFormListProps,
} from "@ant-design/pro-components";
import {
  ModalForm,
  ProFormDependency,
  ProFormDigit,
  ProFormGroup,
  ProFormItem,
  ProFormList,
  ProFormSelect,
} from "@ant-design/pro-components";
import type { FormListFieldData, MenuProps } from "antd";
import { Button, Dropdown, Flex, Input, notification, Typography } from "antd";
import type { BaseOptionType } from "antd/es/select";
import {
  isVectorStroke,
  transformRefStrokes,
  合并笔画顺序,
  图形盒子,
  type 字形数据,
  type 引用数据,
  type 引用笔画块数据,
  模拟矢量笔画,
  type 矢量图形数据,
  type 矢量笔画数据,
  type 笔画名称,
  笔画表示方式,
} from "hanzi-chai";
import { useAtomValue } from "jotai";
import type { MutableRefObject, ReactElement, ReactNode } from "react";
import { useRef, useState } from "react";
import { 矢量缓存原子 } from "~/atoms";
import { 数字 } from "~/utils";
import GlyphSelect from "./GlyphSelect";
import { Box, StrokesView } from "./GlyphView";
import OperatorSelect from "./OperatorSelect";
import ProFormListMovable from "./ProFormListMovable";
import { EditorColumn, EditorRow } from "./Utils";

const Digit = ({ name }: { name: (string | number)[] }) => (
  <ProFormDigit width={56} name={name} fieldProps={{ min: -100, max: 100 }} />
);

export const InlineRender = ({
  listDom,
  action,
}: {
  listDom: ReactNode;
  action: ReactNode;
}) => (
  <div className="inline-flex mr-2">
    {listDom}
    {action}
  </div>
);

function StaticList<T>(props: ProFormListProps<T>) {
  return (
    <ProFormList
      {...props}
      copyIconProps={false}
      deleteIconProps={false}
      creatorButtonProps={false}
    >
      {props.children}
    </ProFormList>
  );
}

const strokeOptions = Object.keys(笔画表示方式).map((x) => ({
  key: x,
  value: x,
  label: x,
}));
const classifiedStrokeOptions: BaseOptionType[] = [
  { key: 0, label: "横竖", children: strokeOptions.slice(0, 4) },
  { key: 1, label: "撇点", children: strokeOptions.slice(4, 11) },
  { key: 2, label: "折类 I", children: strokeOptions.slice(11, 24) },
  { key: 3, label: "折类 II", children: strokeOptions.slice(24, 31) },
  { key: 4, label: "折类 III", children: strokeOptions.slice(31) },
];

const StrokeForm = ({
  references,
  maxIndex,
  formRef,
  meta,
}: {
  references?: 引用数据[];
  maxIndex?: number;
  formRef: MutableRefObject<ProFormInstance | undefined>;
  meta: FormListFieldData;
}) => {
  const referenceOptions: BaseOptionType[] = (references ?? []).map((x) => ({
    key: x.id,
    value: x.id,
    label: `引用第${数字(x.id + 1)}部`,
  }));
  return (
    <ProFormDependency name={["feature"]}>
      {({ feature }) =>
        feature !== undefined ? (
          <>
            <ProFormGroup size="small">
              <ProFormSelect<笔画名称>
                name="feature"
                options={classifiedStrokeOptions}
                disabled
                allowClear={false}
                onChange={(value) => {
                  const newStroke = 模拟矢量笔画(value);
                  formRef.current?.setFieldValue(
                    ["strokes", meta.name],
                    newStroke,
                  );
                }}
              />
              <Digit name={["start", 0]} />
              <Digit name={["start", 1]} />
            </ProFormGroup>
            <StaticList name="curveList">
              <ProFormGroup key="group" size="small" className="pl-9">
                <ProFormSelect name="command" disabled className="min-w-16" />
                <ProFormDependency name={["command"]}>
                  {({ command }) =>
                    command === "c" || command === "z" ? (
                      <ProFormGroup size="small">
                        <Digit name={["parameterList", 0]} />
                        <Digit name={["parameterList", 1]} />
                        <Digit name={["parameterList", 2]} />
                        <Digit name={["parameterList", 3]} />
                        <Digit name={["parameterList", 4]} />
                        <Digit name={["parameterList", 5]} />
                      </ProFormGroup>
                    ) : (
                      <ProFormGroup size="small">
                        <Digit name={["parameterList", 0]} />
                      </ProFormGroup>
                    )
                  }
                </ProFormDependency>
              </ProFormGroup>
            </StaticList>
          </>
        ) : (
          <Flex gap="middle" justify="space-between">
            <ProFormSelect
              name="index"
              label="引用"
              options={referenceOptions}
              allowClear={false}
            />
            <ProFormSelect
              name="from"
              label="从"
              options={[...Array(maxIndex).keys()].map((x) => ({
                label: `第${数字(x + 1)}笔`,
                value: x,
              }))}
              allowClear={false}
            />
            <ProFormSelect
              name="to"
              label="到"
              options={[...Array(maxIndex).keys()].map((x) => ({
                label: `第${数字(x + 1)}笔`,
                value: x,
              }))}
              allowClear={false}
            />
          </Flex>
        )
      }
    </ProFormDependency>
  );
};

function 临时渲染(
  glyph: 字形数据,
  矢量缓存: Map<number, 矢量笔画数据[]>,
): 图形盒子 {
  const refs = glyph.references ?? [];

  // 复合体或带结构描述字符的部件：按操作符对各部分做仿射变换后合并
  if (glyph.type === "compound" || glyph.operator) {
    const operator = glyph.operator ?? "⿰";
    const partsStrokes: 矢量图形数据[] = [];
    for (const [i, ref] of refs.entries()) {
      const strokes = 矢量缓存.get(ref.id);
      if (strokes) {
        partsStrokes.push(transformRefStrokes(strokes, ref, operator, i));
      }
    }

    // 提取笔顺信息（仅引用笔画块，过滤掉内联矢量笔画）
    let orderStrokes: 引用笔画块数据[] | undefined;
    if (glyph.strokes) {
      const filtered = glyph.strokes.filter(
        (s) => !isVectorStroke(s),
      ) as 引用笔画块数据[];
      if (filtered.length > 0) orderStrokes = filtered;
    }

    const merged = 合并笔画顺序(partsStrokes, orderStrokes);
    return 图形盒子.从笔画列表构建(merged);
  }

  // 普通部件：按 strokes 顺序逐条处理，内联笔画直接保留，引用块查缓存后切片
  const result: 矢量笔画数据[] = [];
  const strokes =
    glyph.strokes ??
    refs.map((_, i) => ({ index: i, from: undefined, to: undefined }));

  for (const stroke of strokes) {
    if (isVectorStroke(stroke)) {
      result.push(stroke);
    } else {
      const ref = refs[stroke.index];
      if (!ref) continue;
      const refStrokes = 矢量缓存.get(ref.id);
      if (!refStrokes) continue;
      const from = stroke.from ?? 0;
      const to = (stroke.to ?? refStrokes.length - 1) + 1;
      result.push(...refStrokes.slice(from, to));
    }
  }

  return 图形盒子.从笔画列表构建(result);
}

export default function GlyphForm({
  trigger,
  initialValues,
  onFinish,
  readonly,
  initialChar,
}: {
  trigger: ReactElement;
  initialValues: 字形数据;
  onFinish: (c: 字形数据) => Promise<boolean>;
  readonly?: boolean;
  initialChar?: string;
}) {
  const formRef = useRef<ProFormInstance>(undefined);
  const [fontChar, setFontChar] = useState<string | undefined>(undefined);
  const 矢量缓存 = useAtomValue(矢量缓存原子);
  return (
    <ModalForm<字形数据>
      className="glyph-form-modal"
      title={
        <span>
          编辑字形数据（参考：
          <Input
            className="inline! w-16!"
            value={fontChar}
            onChange={(e) => setFontChar(e.target.value)}
          />
          <Button size="small" onClick={() => setFontChar(initialChar)}>
            加载
          </Button>
          ）
        </span>
      }
      layout="horizontal"
      omitNil={true}
      trigger={trigger}
      initialValues={initialValues}
      onFinish={onFinish}
      readonly={readonly}
      submitter={readonly ? false : undefined}
      modalProps={{
        width: 1080,
      }}
      formRef={formRef}
    >
      <EditorRow>
        <EditorColumn span={10} className="p-0!">
          <Box>
            {fontChar && (
              <div className="absolute top-0 left-0 right-0 bottom-0 text-[348px] leading-none text-red-400 font-extralight -z-10 font-[Noto_Sans_SC]">
                {fontChar}
              </div>
            )}
            <ProFormDependency
              name={["type", "operator", "strokes", "references"]}
            >
              {(props) => {
                const 图形盒子 = 临时渲染(props as 字形数据, 矢量缓存);
                return (
                  <StrokesView
                    glyph={图形盒子}
                    setGlyph={(glyph) => {
                      const prevStrokes: (矢量笔画数据 | 引用笔画块数据)[] =
                        formRef.current?.getFieldValue("strokes") ?? [];
                      const references: 引用数据[] = formRef.current?.getFieldValue("references") ?? [];
                      const strokes = structuredClone(prevStrokes);
                      let count = 0;
                      for (let i = 0; i < strokes.length; i++) {
                        const stroke = strokes[i]!;
                        if (isVectorStroke(stroke)) {
                          strokes[i] = glyph[count] ?? stroke;
                          count++;
                        } else {
                          const ref = references[stroke.index];
                          if (!ref) continue;
                          const refStrokes = 矢量缓存.get(ref.id);
                          if (!refStrokes) continue;
                          const from = stroke.from ?? 0;
                          const to = (stroke.to ?? refStrokes.length - 1) + 1;
                          count += to - from;
                        }
                      }
                      formRef.current?.setFieldValue("strokes", strokes);
                    }}
                    displayMode
                  />
                );
              }}
            </ProFormDependency>
          </Box>
        </EditorColumn>
        <EditorColumn span={14}>
          <Flex align="flex-start" gap="large">
            <ProFormDigit name="id" label="id" readonly />
            <ProFormDigit name="gf0014_id" label="GF0014" readonly />
            <ProFormDigit name="gf3001_id" label="GF3001" readonly />
            <ProFormSelect
              label="类型"
              name="type"
              options={[
                { label: "部件", value: "component" },
                { label: "复合体", value: "compound" },
              ]}
              disabled
              className="w-16"
            />
            <ProFormItem label="结构" name="operator" className="w-24">
              <OperatorSelect />
            </ProFormItem>
          </Flex>
          <Typography.Title level={5}>引用</Typography.Title>
          <ProFormList name="references" alwaysShowItemLabel>
            <ProFormGroup size="small">
              <ProFormItem name="id">
                <GlyphSelect />
              </ProFormItem>
              <ProFormDigit name="xbegin" label="x0" width={56} />
              <ProFormDigit name="ybegin" label="y0" width={56} />
              <ProFormDigit name="xend" label="x1" width={56} />
              <ProFormDigit name="yend" label="y1" width={56} />
            </ProFormGroup>
          </ProFormList>
          <Typography.Title level={5}>笔画</Typography.Title>
          <ProFormListMovable
            name="strokes"
            creatorButtonProps={false}
            alwaysShowItemLabel
            extraActions={[
              <CameraOutlined
                key="camera"
                className="ml-1"
                onClick={() => {}}
              />,
            ]}
          >
            {(meta) => (
              <StrokeForm maxIndex={10} formRef={formRef} meta={meta} />
            )}
          </ProFormListMovable>
          <Flex justify="center" gap="middle">
            <Dropdown
              menu={{
                items: classifiedStrokeOptions as MenuProps["items"],
                onClick: (item) => {
                  const newStroke = 模拟矢量笔画(item.key as 笔画名称);
                  formRef.current?.setFieldValue(
                    "strokes",
                    formRef.current
                      ?.getFieldValue("strokes")
                      ?.concat(newStroke),
                  );
                },
              }}
            >
              <Button>添加笔画</Button>
            </Dropdown>
            <Dropdown
              menu={{
                items: (initialValues.references ?? []).map((x) => ({
                  key: x.id.toString(),
                  label: `引用 ${x.id}`,
                })) as MenuProps["items"],
                onClick: (item) => {
                  const 引用笔画: 引用笔画块数据 = {
                    index: Number(item.key),
                    from: 0,
                    to: 0,
                  };
                  formRef.current?.setFieldValue(
                    "strokes",
                    formRef.current?.getFieldValue("strokes")?.concat(引用笔画),
                  );
                },
              }}
            ></Dropdown>
            <Button>添加笔画引用</Button>
          </Flex>
        </EditorColumn>
      </EditorRow>
    </ModalForm>
  );
}
