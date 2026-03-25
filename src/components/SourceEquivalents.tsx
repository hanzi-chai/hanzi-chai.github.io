import { CloseOutlined, DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Flex, Modal, Select, Space } from "antd";
import { useAtom } from "jotai";
import { useState } from "react";
import { 同源部件组列表原子 } from "~/atoms";
import type { 同源部件组 } from "~/lib";
import CharacterSelect from "./CharacterSelect";
import { Display } from "./Utils";

/** 地區源標籤選項 */
const 源标签选项 = ["G", "H", "T", "J", "K", "N", "V", "M", "S", "B", "U"].map(
  (s) => ({ label: s, value: s }),
);

interface 源条目 {
  source: string;
  char: string;
}

/** 把 Record 轉成編輯用列表 */
function 组到条目列表(组: 同源部件组): 源条目[] {
  return Object.entries(组).map(([source, char]) => ({ source, char }));
}

/** 把列表轉回 Record，過濾掉不完整的條目 */
function 条目列表到组(条目列表: 源条目[]): 同源部件组 {
  const 组: 同源部件组 = {};
  for (const { source, char } of 条目列表) {
    if (source && char) 组[source] = char;
  }
  return 组;
}

/** 顯示一個同源部件組的摘要 */
function 组摘要({ 组 }: { 组: 同源部件组 }) {
  const 条目 = Object.entries(组);
  if (条目.length === 0) return <span style={{ color: "#999" }}>（空）</span>;
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

/** 單個源條目的行内編輯器 */
function 源条目行({
  条目,
  onChange,
  onDelete,
}: {
  条目: 源条目;
  onChange: (v: 源条目) => void;
  onDelete: () => void;
}) {
  return (
    <Flex gap="small" align="center">
      <Select
        style={{ width: 64 }}
        value={条目.source || undefined}
        placeholder="源"
        options={源标签选项}
        onChange={(v) => onChange({ ...条目, source: v })}
      />
      <CharacterSelect
        style={{ width: 180 }}
        value={条目.char || undefined}
        onChange={(v: string) => onChange({ ...条目, char: v })}
      />
      <Button
        type="text"
        danger
        size="small"
        icon={<CloseOutlined />}
        onClick={onDelete}
      />
    </Flex>
  );
}

/** 單個同源部件組的編輯卡片 */
function 组编辑卡片({
  条目列表,
  onChange,
  onDelete,
}: {
  条目列表: 源条目[];
  onChange: (v: 源条目[]) => void;
  onDelete: () => void;
}) {
  const 组 = 条目列表到组(条目列表);
  const 有效 = Object.keys(组).length >= 2;
  return (
    <Flex
      vertical
      gap={8}
      style={{
        border: `1px solid ${有效 ? "#d9d9d9" : "#ff4d4f"}`,
        borderRadius: 6,
        padding: "8px 12px",
      }}
    >
      <Flex justify="space-between" align="center">
        <span style={{ fontWeight: 500, fontSize: "0.85em" }}>
          {有效 ? <组摘要 组={组} /> : "请填写至少两个源"}
        </span>
        <Button
          type="text"
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={onDelete}
        />
      </Flex>
      {条目列表.map((条目, i) => (
        <源条目行
          key={i}
          条目={条目}
          onChange={(v) => {
            const 新列表 = [...条目列表];
            新列表[i] = v;
            onChange(新列表);
          }}
          onDelete={() => onChange(条目列表.filter((_, j) => j !== i))}
        />
      ))}
      <Button
        type="dashed"
        size="small"
        icon={<PlusOutlined />}
        onClick={() => onChange([...条目列表, { source: "", char: "" }])}
      >
        添加源
      </Button>
    </Flex>
  );
}

const SourceEquivalentsForm = () => {
  const [同源部件组列表, 设置同源部件组列表] = useAtom(同源部件组列表原子);
  const [open, setOpen] = useState(false);
  // 編輯態：打開 Modal 時從 atom 複製一份
  const [编辑态, 设置编辑态] = useState<源条目[][]>([]);

  const 打开 = () => {
    设置编辑态(同源部件组列表.map(组到条目列表));
    setOpen(true);
  };

  const 保存 = () => {
    const 组列表 = 编辑态
      .map(条目列表到组)
      .filter((g) => Object.keys(g).length >= 2);
    设置同源部件组列表(组列表);
    setOpen(false);
  };

  return (
    <>
      <Button onClick={打开}>
        编辑同源部件组
        {同源部件组列表.length > 0 && ` (${同源部件组列表.length})`}
      </Button>
      <Modal
        title="同源部件组设置"
        open={open}
        onOk={保存}
        onCancel={() => setOpen(false)}
        width={480}
        okText="保存"
        cancelText="取消"
      >
        <Flex vertical gap={12} style={{ maxHeight: 400, overflowY: "auto" }}>
          {编辑态.map((条目列表, i) => (
            <组编辑卡片
              key={i}
              条目列表={条目列表}
              onChange={(v) => {
                const 新 = [...编辑态];
                新[i] = v;
                设置编辑态(新);
              }}
              onDelete={() => 设置编辑态(编辑态.filter((_, j) => j !== i))}
            />
          ))}
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={() =>
              设置编辑态([
                ...编辑态,
                [
                  { source: "", char: "" },
                  { source: "", char: "" },
                ],
              ])
            }
          >
            添加同源部件组
          </Button>
        </Flex>
      </Modal>
    </>
  );
};

export default SourceEquivalentsForm;
