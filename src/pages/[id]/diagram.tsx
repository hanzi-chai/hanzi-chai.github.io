import {
  ProForm,
  ProFormDependency,
  ProFormGroup,
  ProFormList,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from "@ant-design/pro-components";
import { Button, Flex, Space, Tag, Typography } from "antd";
import { debounce } from "lodash-es";
import type { ReactNode } from "react";
import {
  useAtom,
  useAtomValue,
  useAtomValueUnwrapped,
  图示配置原子,
  基本信息原子,
  字母表原子,
  按首码分组决策原子,
} from "~/atoms";
import { AdjustableElementGroup } from "~/components/Mapping";
import { type 区块配置, type 图示配置, 读取表格 } from "hanzi-chai";
import { useChaifenTitle } from "~/utils";

const PrintArea = ({ children }: { children?: ReactNode }) => (
  <div className="w-[297mm] h-[210mm] float-left pt-[20mm] pb-[20mm] px-[10mm] border border-[#d3d3d3] rounded-[5px] bg-white shadow-[0_0_8px_8px_rgba(0,0,0,0.1)] flex flex-col justify-between print:fixed print:top-0 print:left-0 print:border-none print:rounded-none">
    {children}
  </div>
);

const KeyboardArea = ({ children }: { children?: ReactNode }) => (
  <div className="flex flex-col gap-[2mm]">{children}</div>
);

const Keyboard = () => {
  const diagram = useAtomValue(图示配置原子);
  const { contents, layout } = diagram;
  const reversedMapping = useAtomValueUnwrapped(按首码分组决策原子);
  const processedConents = contents.map((content) => {
    if (content.type === "element") {
      let match: RegExp | undefined;
      if (content.match) {
        try {
          match = new RegExp(content.match);
        } catch {}
      }
      return { ...content, match };
    }
    if (content.type === "custom") {
      const customMap: Map<string, string> = new Map();
      const tsv = 读取表格(content.mapping ?? "");
      for (const [key, value] of tsv) {
        if (!key || !value) continue;
        customMap.set(key, value);
      }
      return { ...content, mapping: customMap };
    }
    return content;
  });
  return (
    <KeyboardArea>
      {layout.map((row, i) => (
        <div className="row" key={i}>
          {row.keys.map((key, j) => (
            <div className="cell" key={j}>
              {processedConents.map((value, k) => {
                const { type } = value;
                const boxes: ReactNode[] = [];
                if (type === "key") {
                  boxes.push(key);
                } else if (type === "uppercase") {
                  boxes.push(key.toUpperCase());
                } else if (type === "element") {
                  const mapped = reversedMapping.get(key);
                  if (mapped) {
                    for (const { 名称, 安排 } of mapped) {
                      if (value.match && !value.match.test(名称)) {
                        continue;
                      }
                      boxes.push(
                        <AdjustableElementGroup
                          名称={名称}
                          安排={安排}
                          displayMode
                        />,
                      );
                    }
                  }
                } else if (type === "custom") {
                  const mapped = value.mapping.get(key);
                  if (mapped) boxes.push(mapped);
                }
                if (boxes.length === 0) return null;
                return (
                  <div className={`box box-${k}`} key={key}>
                    {boxes}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ))}
    </KeyboardArea>
  );
};

const Secondary = ({ children }: { children?: ReactNode }) => (
  <div className="flex-1 flex flex-col justify-center items-center gap-4">
    {children}
  </div>
);

const SidebarWrapper = ({ children }: { children?: ReactNode }) => (
  <aside className="p-[16px] float-left print:hidden">{children}</aside>
);

const withDefaultStyles = (diagram: 图示配置) => {
  const { row_style, cell_style } = diagram;
  return {
    ...diagram,
    row_style: row_style ?? default_row_style,
    cell_style: cell_style ?? default_cell_style,
  };
};

const Sidebar = () => {
  const [diagram, setSchematic] = useAtom(图示配置原子);
  const alphabet = useAtomValue(字母表原子);
  const debounced = debounce(setSchematic, 500);
  return (
    <SidebarWrapper>
      <Flex justify="center">
        <Button type="primary" onClick={() => window.print()}>
          打印图示
        </Button>
      </Flex>
      <ProForm<图示配置>
        initialValues={withDefaultStyles(diagram)}
        layout="horizontal"
        onValuesChange={async (_, values) => {
          debounced(values);
          return true;
        }}
        submitter={false}
      >
        <Typography.Title level={4}>布局</Typography.Title>
        <ProFormList
          name="layout"
          creatorRecord={{
            keys: [],
          }}
          copyIconProps={false}
          alwaysShowItemLabel
        >
          <ProFormSelect
            mode="tags"
            name="keys"
            label="字符"
            options={[...alphabet].map((x) => ({ label: x, value: x }))}
          />
        </ProFormList>
        <Typography.Title level={4}>共享样式</Typography.Title>
        <ProFormTextArea name="row_style" label="行样式" />
        <ProFormTextArea name="cell_style" label="格样式" />
        <Typography.Title level={4}>格内容</Typography.Title>
        <ProFormList
          name="contents"
          alwaysShowItemLabel
          creatorRecord={{
            type: "uppercase",
          }}
          copyIconProps={false}
        >
          <ProFormGroup>
            <ProFormSelect<区块配置["type"]>
              name="type"
              label="类型"
              options={[
                { label: "编码", value: "key" },
                { label: "编码（小写字母转大写）", value: "uppercase" },
                { label: "元素", value: "element" },
                { label: "自定义", value: "custom" },
              ]}
              allowClear={false}
            />
            <ProFormDependency name={["type"]}>
              {({ type }) => {
                if (type === "element") {
                  return <ProFormText name="match" label="匹配" />;
                }
                if (type === "custom") {
                  return (
                    <ProFormTextArea
                      name="mapping"
                      label="映射"
                      placeholder="格式为编码\\t内容\\n"
                    />
                  );
                }
                return null;
              }}
            </ProFormDependency>
          </ProFormGroup>
          <ProFormTextArea name="style" label="样式" />
        </ProFormList>
      </ProForm>
    </SidebarWrapper>
  );
};

const default_row_style = "display: flex;\njustify-content: center;\ngap: 2mm;";
const default_cell_style =
  "position: relative;\nwidth: 25mm;\nheight: 45mm;\nborder: 0.3mm #d3d3d3 solid;\nborder-radius: 1mm;";

export default function Schematic() {
  useChaifenTitle("图示");
  const diagram = useAtomValue(图示配置原子);
  const { row_style, cell_style, contents } = diagram;
  const { name, author, version, description } = useAtomValue(基本信息原子);
  const final_row_style = row_style ?? default_row_style;
  const final_cell_style = cell_style ?? default_cell_style;
  return (
    <div>
      <PrintArea>
        <style>
          {`.row { ${final_row_style} }`}
          {`.cell { ${final_cell_style} }`}
          {contents.map((box, i) => {
            const style = box.style ?? "";
            return `.box-${i} { ${style} }`;
          })}
        </style>
        <Flex justify="center">
          <Secondary>
            <Typography.Text>{description}</Typography.Text>
          </Secondary>
          <Typography.Title className="!m-0">{name}</Typography.Title>
          <Secondary>
            <Space>
              <Tag color="blue">作者：{author}</Tag>
              <Tag color="cyan">版本：{version}</Tag>
            </Space>
          </Secondary>
        </Flex>
        <Keyboard />
        <div className="text-center">
          &copy; {new Date().getFullYear()} 汉字自动拆分系统
        </div>
      </PrintArea>
      <Sidebar />
    </div>
  );
}
