import type {
  ProFormInstance,
  ProFormListProps,
} from "@ant-design/pro-components";
import {
  ModalForm,
  ProFormCheckbox,
  ProFormDependency,
  ProFormDigit,
  ProFormGroup,
  ProFormItem,
  ProFormList,
  ProFormSelect,
  ProFormText,
} from "@ant-design/pro-components";
import type { FormListFieldData, MenuProps } from "antd";
import { Button, Dropdown, Flex, Input, Typography } from "antd";
import type { BaseOptionType } from "antd/es/select";
import {
  isVectorStroke,
  仿射合并,
  切片,
  图形盒子,
  type 基本字形数据,
  type 字库,
  type 字形数据,
  type 引用数据,
  type 引用笔画块数据,
  模拟矢量笔画,
  type 矢量笔画数据,
  type 笔画名称,
  笔画表示方式,
} from "hanzi-chai";
import { useAtomValue } from "jotai";
import type { MutableRefObject, ReactElement } from "react";
import { useRef, useState } from "react";
import { 字库原子 } from "~/atoms";
import { 数字 } from "~/utils";
import GlyphSelect from "./GlyphSelect";
import GlyphView from "./GlyphView";
import OperatorSelect from "./OperatorSelect";
import ProFormListMovable from "./ProFormListMovable";
import { Box, EditorColumn, EditorRow } from "./Utils";

const Digit = ({ name }: { name: (string | number)[] }) => (
  <ProFormDigit width={56} name={name} fieldProps={{ min: -100, max: 100 }} />
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
  { key: 1, label: "撇点", children: strokeOptions.slice(4, 12) },
  { key: 2, label: "折类 I", children: strokeOptions.slice(12, 26) },
  { key: 3, label: "折类 II", children: strokeOptions.slice(26, 34) },
  { key: 4, label: "折类 III", children: strokeOptions.slice(34) },
];

const StrokeForm = ({
  references,
  formRef,
  meta,
}: {
  references?: 引用数据[];
  formRef: MutableRefObject<ProFormInstance | undefined>;
  meta: FormListFieldData;
}) => {
  const 字库 = useAtomValue(字库原子);
  const 引用列表 = references ?? [];
  const 笔画数列表 = 引用列表.map(
    (x) => 字库.获取字形(x.id)?.标准笔顺.length ?? 0,
  );
  const referenceOptions: BaseOptionType[] = 引用列表.map((_, i) => ({
    key: i,
    value: i,
    label: `第${数字(i + 1)}部`,
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
                // disabled
                allowClear={false}
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
            <ProFormDependency name={["index"]}>
              {({ index }) => {
                const 笔画数 = 笔画数列表[index ?? 0] ?? 0;
                return (
                  <>
                    <ProFormSelect
                      name="from"
                      label="从"
                      options={[...Array(笔画数).keys()].map((x) => ({
                        label: `第${数字(x + 1)}笔`,
                        value: x,
                      }))}
                      placeholder="第一笔"
                    />
                    <ProFormSelect
                      name="to"
                      label="到"
                      options={[...Array(笔画数).keys()].map((x) => ({
                        label: `第${数字(x + 1)}笔`,
                        value: x,
                      }))}
                      placeholder="最后一笔"
                    />
                  </>
                );
              }}
            </ProFormDependency>
            <Button
              onClick={() => {
                const form = formRef.current;
                if (!form) return;
                const glyph: 字形数据 = form.getFieldsValue();
                const strokes = glyph.strokes ?? [];
                const currentStroke = strokes[meta.name];
                if (
                  currentStroke === undefined ||
                  isVectorStroke(currentStroke)
                )
                  return;
                const references = glyph.references ?? [];
                const 图形 = 临时渲染(glyph, 字库).获取笔画列表();
                let startIndex = 0;
                for (const stroke of strokes.slice(0, meta.name)) {
                  if (isVectorStroke(stroke)) startIndex++;
                  else {
                    const ref = references[stroke.index];
                    if (!ref) continue;
                    const refShape = 字库.获取字形(ref.id);
                    if (!refShape) continue;
                    startIndex += 切片(
                      refShape.图形盒子.获取笔画列表(),
                      stroke,
                    ).length;
                  }
                }
                const currentRef = references[currentStroke.index];
                if (!currentRef) return;
                const currentShape = 字库.获取字形(currentRef.id);
                if (!currentShape) return;
                const currentStrokes = currentShape.图形盒子.获取笔画列表();
                const endIndex =
                  startIndex + 切片(currentStrokes, currentStroke).length;
                const newStrokes = structuredClone(strokes);
                newStrokes.splice(
                  meta.name,
                  1,
                  ...图形.slice(startIndex, endIndex),
                );
                formRef.current?.setFieldValue("strokes", newStrokes);
              }}
            >
              快照
            </Button>
          </Flex>
        )
      }
    </ProFormDependency>
  );
};

function 临时渲染(字形: 字形数据, 字库: 字库): 图形盒子 {
  const 引用列表 = 字形.references ?? [];
  const 部分列表 = 引用列表.map(
    (x) => 字库.获取字形(x.id)?.图形盒子 ?? new 图形盒子(),
  );
  return 仿射合并(部分列表, 引用列表, 字形.operator, 字形.strokes);
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
  onFinish: (c: 基本字形数据) => Promise<boolean>;
  readonly?: boolean;
  initialChar?: string;
}) {
  const formRef = useRef<ProFormInstance>(undefined);
  const [fontChar, setFontChar] = useState<string | undefined>(undefined);
  const 字库 = useAtomValue(字库原子);

  const setGlyph = (glyph: 矢量笔画数据[]) => {
    const prevStrokes: (矢量笔画数据 | 引用笔画块数据)[] =
      formRef.current?.getFieldValue("strokes") ?? [];
    const references: 引用数据[] =
      formRef.current?.getFieldValue("references") ?? [];
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
        const refStrokes = 字库.获取字形(ref.id)?.图形盒子.获取笔画列表();
        if (!refStrokes) continue;
        count += 切片(refStrokes, stroke).length;
      }
    }
    formRef.current?.setFieldValue("strokes", strokes);
  };
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
      onFinish={(glyph) => {
        if (glyph.type === "compound") return onFinish(glyph);
        const strokes = 临时渲染(glyph, 字库).获取笔画列表();
        return onFinish({
          ...glyph,
          type: "component",
          strokes,
          operator: undefined,
          references: undefined,
        });
      }}
      readonly={readonly}
      submitter={readonly ? false : undefined}
      modalProps={{
        width: 1080,
      }}
      formRef={formRef}
    >
      <EditorRow>
        <EditorColumn span={9} className="p-0!">
          <Box>
            {fontChar && (
              <div className="absolute top-0 left-0 right-0 bottom-0 text-[348px] leading-none text-blue-400 font-extralight -z-10 font-[Noto_Sans_SC]">
                {fontChar}
              </div>
            )}
            <ProFormDependency
              name={["type", "operator", "strokes", "references"]}
            >
              {(props) => {
                const 图形盒子 = 临时渲染(props as 字形数据, 字库);
                return (
                  <GlyphView glyph={图形盒子} setGlyph={setGlyph} displayMode />
                );
              }}
            </ProFormDependency>
          </Box>
        </EditorColumn>
        <EditorColumn span={15}>
          <Flex align="flex-start" gap="large">
            <ProFormDigit name="id" label="id" disabled width={64} />
            <ProFormDigit name="gf0014_id" label="GF0014" width={64} readonly />
            <ProFormDigit name="gf3001_id" label="GF3001" width={64} readonly />
            <ProFormText name="name" label="名称" width={128} readonly />
            <ProFormSelect
              label="类型"
              name="type"
              options={[
                { label: "部件", value: "component" },
                { label: "复合体", value: "compound" },
              ]}
              width={96}
              allowClear={false}
            />
            <ProFormItem label="结构" name="operator">
              <OperatorSelect className="w-16!" allowClear />
            </ProFormItem>
            <ProFormCheckbox label="歧义" name="ambiguous"/>
          </Flex>
          <Typography.Title level={5}>引用</Typography.Title>
          <ProFormListMovable name="references" alwaysShowItemLabel>
            <ProFormGroup size="small">
              <ProFormItem name="id">
                <GlyphSelect className="w-32!" />
              </ProFormItem>
              <ProFormDigit
                name="xbegin"
                label="x0"
                width={56}
                min={-100}
                max={200}
                placeholder=""
              />
              <ProFormDigit
                name="ybegin"
                label="y0"
                width={56}
                min={-100}
                max={200}
                placeholder=""
              />
              <ProFormDigit
                name="xend"
                label="x1"
                width={56}
                min={-100}
                max={200}
                placeholder=""
              />
              <ProFormDigit
                name="yend"
                label="y1"
                width={56}
                min={-100}
                max={200}
                placeholder=""
              />
            </ProFormGroup>
          </ProFormListMovable>
          <Typography.Title level={5}>笔画</Typography.Title>
          <ProFormDependency name={["references"]}>
            {({ references }) => (
              <ProFormListMovable
                name="strokes"
                creatorButtonProps={false}
                alwaysShowItemLabel
              >
                {(meta) => (
                  <StrokeForm
                    formRef={formRef}
                    meta={meta}
                    references={references}
                  />
                )}
              </ProFormListMovable>
            )}
          </ProFormDependency>
          <Flex justify="center" gap="middle">
            <Button
              onClick={() => formRef.current?.setFieldValue("strokes", [])}
            >
              清空笔画
            </Button>
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
            <ProFormDependency name={["references"]}>
              {({ references }) => {
                const 引用数据列表: 引用数据[] = references ?? [];
                return (
                  <Dropdown
                    menu={{
                      items: 引用数据列表.map((_, i) => ({
                        key: i.toString(),
                        label: `引用第${数字(i + 1)}部`,
                      })) as MenuProps["items"],
                      onClick: (item) => {
                        const strokes =
                          formRef.current?.getFieldValue("strokes") ?? [];
                        const 引用笔画: 引用笔画块数据 = {
                          index: Number(item.key),
                        };
                        formRef.current?.setFieldValue(
                          "strokes",
                          strokes.concat(引用笔画),
                        );
                      },
                    }}
                  >
                    <Button>添加笔画引用</Button>
                  </Dropdown>
                );
              }}
            </ProFormDependency>
          </Flex>
        </EditorColumn>
      </EditorRow>
    </ModalForm>
  );
}
