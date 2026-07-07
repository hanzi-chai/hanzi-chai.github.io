import {
  ModalForm,
  ProFormDependency,
  ProFormGroup,
  ProFormItem,
  ProFormList,
  ProFormSelect,
} from "@ant-design/pro-components";
import { Button } from "antd";
import type { 字符 } from "hanzi-chai";
import { useAtomValue } from "jotai";
import { useAddAtom, 字形自定义原子 } from "~/atoms";
import GlyphSelect from "./GlyphSelect";
import SourceSelect from "./SourceSelect";
import { CharacterDisplay } from "./Utils";

export default function PatchForm({ character }: { character: 字符 }) {
  const 字形自定义 = useAtomValue(字形自定义原子);
  const 设置字形自定义 = useAddAtom(字形自定义原子);
  const 字符串 = character.获取名称();
  const 补丁列表 = 字形自定义[字符串] ?? [];

  return (
    <ModalForm
      trigger={<Button>编辑</Button>}
      layout="horizontal"
      title={
        <span>
          编辑
          <CharacterDisplay character={character} />
          的补丁
        </span>
      }
      autoFocusFirstInput
      initialValues={{ patches: 补丁列表 }}
      onFinish={async (values) => {
        设置字形自定义(字符串, values.patches);
        return true;
      }}
    >
      <ProFormList
        name="patches"
        alwaysShowItemLabel
        creatorRecord={() => ({
          type: "update",
          glyph: 1,
          sources: ["G"],
        })}
      >
        <ProFormGroup>
          <ProFormSelect
            label="类型"
            name="type"
            options={[
              { label: "删除", value: "delete" },
              { label: "添加", value: "insert" },
              { label: "修改", value: "update" },
            ]}
          />
          <ProFormItem label="来源" name="sources">
            <SourceSelect />
          </ProFormItem>
          <ProFormDependency name={["type"]}>
            {({ type }) => {
              if (type === "delete") return null;
              return (
                <ProFormItem label="字形" name="glyph">
                  <GlyphSelect className="w-32!" />
                </ProFormItem>
              );
            }}
          </ProFormDependency>
        </ProFormGroup>
      </ProFormList>
    </ModalForm>
  );
}
