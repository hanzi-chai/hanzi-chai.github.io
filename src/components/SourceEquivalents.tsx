import { Button, Flex, Input, Space } from "antd";
import { useAtom } from "jotai";
import { 同源部件组列表原子 } from "~/atoms";
import type { 同源部件组 } from "~/lib";
import { Display } from "./Utils";
import CharacterSelect from "./CharacterSelect";
import {
  ModalForm,
  type ProFormInstance,
  ProFormList,
  ProFormItem,
} from "@ant-design/pro-components";
import { useRef } from "react";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";

/** 地區源標籤選項 */
const 源标签列表 = ["G", "H", "T", "J", "K", "N", "V", "M", "S", "B", "U"];

/**
 * 將 Record<string, string> 格式轉爲列表格式
 * {G: "户", T: "戶"} → [{source: "G", char: "户"}, {source: "T", char: "戶"}]
 */
interface 源条目表单项 {
  source: string;
  char: string;
}

interface 组表单值 {
  entries: 源条目表单项[];
}

function 组到表单(组: 同源部件组): 组表单值 {
  return {
    entries: Object.entries(组).map(([source, char]) => ({ source, char })),
  };
}

function 表单到组(值: 组表单值): 同源部件组 {
  const 组: 同源部件组 = {};
  for (const { source, char } of 值.entries) {
    if (source && char) {
      组[source] = char;
    }
  }
  return 组;
}

/** 顯示一個同源部件組的摘要 */
function 组摘要({ 组 }: { 组: 同源部件组 }) {
  const 条目 = Object.entries(组);
  return (
    <Space size={4}>
      {条目.map(([源, 字], i) => (
        <span key={源}>
          {i > 0 && "＝"}
          <Display name={字} />
          <sub style={{ color: "#999", fontSize: "0.7em" }}>{源}</sub>
        </span>
      ))}
    </Space>
  );
}

/** 單個源條目的編輯器 */
function 源条目编辑器({
  value,
  onChange,
}: {
  value?: 源条目表单项;
  onChange?: (v: 源条目表单项) => void;
}) {
  const current = value ?? { source: "", char: "" };
  return (
    <Space>
      <Input
        style={{ width: 48 }}
        maxLength={1}
        value={current.source}
        placeholder="源"
        onChange={(e) => onChange?.({ ...current, source: e.target.value })}
      />
      <CharacterSelect
        style={{ width: 160 }}
        value={current.char}
        onChange={(v: string) => onChange?.({ ...current, char: v })}
      />
    </Space>
  );
}

const 空条目 = (): 源条目表单项 => ({ source: "", char: "" });

const SourceEquivalentsForm = () => {
  const [同源部件组列表, 设置同源部件组列表] = useAtom(同源部件组列表原子);
  const formRef = useRef<ProFormInstance>(undefined);

  const 表单初始值 = {
    groups: 同源部件组列表.map(组到表单),
  };

  return (
    <ModalForm
      title="同源部件组设置"
      layout="horizontal"
      width={520}
      trigger={
        <Button>
          编辑同源部件组
          {同源部件组列表.length > 0 && ` (${同源部件组列表.length})`}
        </Button>
      }
      initialValues={表单初始值}
      onFinish={async (v) => {
        const 组列表 = (v.groups as 组表单值[])
          .map(表单到组)
          .filter((g) => Object.keys(g).length >= 2);
        设置同源部件组列表(组列表);
        return true;
      }}
      formRef={formRef}
    >
      <ProFormList
        name="groups"
        creatorRecord={{ entries: [空条目(), 空条目()] }}
        creatorButtonProps={{ creatorButtonText: "添加同源部件组" }}
        alwaysShowItemLabel
        itemRender={({ listDom, action }, { index }) => {
          const values = formRef.current?.getFieldValue(["groups", index]) as
            | 组表单值
            | undefined;
          const 组 = values ? 表单到组(values) : {};
          const 有效 = Object.keys(组).length >= 2;
          return (
            <Flex
              key={index}
              style={{
                border: `1px solid ${有效 ? "#d9d9d9" : "#ff4d4f"}`,
                borderRadius: 6,
                padding: "8px 12px",
                marginBottom: 8,
              }}
              vertical
              gap={4}
            >
              <Flex justify="space-between" align="center">
                <span style={{ fontWeight: 500, fontSize: "0.85em" }}>
                  {有效 ? <组摘要 组={组} /> : "请填写至少两个源"}
                </span>
                {action}
              </Flex>
              {listDom}
            </Flex>
          );
        }}
      >
        <ProFormList
          name="entries"
          creatorRecord={空条目}
          creatorButtonProps={{
            creatorButtonText: "添加源",
            icon: <PlusOutlined />,
            size: "small",
            type: "dashed",
          }}
          deleteIconProps={{ Icon: DeleteOutlined }}
          alwaysShowItemLabel
          min={2}
        >
          <ProFormItem noStyle>
            {/* @ts-ignore */}
            <源条目编辑器 />
          </ProFormItem>
        </ProFormList>
      </ProFormList>

      {同源部件组列表.length > 0 && (
        <Flex vertical gap={4} style={{ marginTop: 8 }}>
          <span style={{ color: "#999", fontSize: "0.85em" }}>
            当前已配置 {同源部件组列表.length} 组：
          </span>
          {同源部件组列表.map((组, i) => (
            <span key={i} style={{ fontSize: "0.85em" }}>
              <组摘要 组={组} />
            </span>
          ))}
        </Flex>
      )}
    </ModalForm>
  );
};

export default SourceEquivalentsForm;
