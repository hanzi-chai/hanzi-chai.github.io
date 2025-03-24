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
import styled from "styled-components";
import {
  alphabetAtom,
  infoAtom,
  mappingAtom,
  diagramAtom,
  useAtom,
  useAtomValue,
  useChaifenTitle,
} from "~/atoms";
import { ElementLabel } from "~/components/Mapping";
import { getReversedMapping, type BoxConfig, type DiagramConfig } from "~/lib";

const PrintArea = styled.div`
  width: 297mm;
  height: 210mm;
  float: left;

  padding: 20mm 10mm;
  border: 1px #d3d3d3 solid;
  border-radius: 5px;
  background: white;
  box-shadow: 0 0 8px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  justify-content: space-between;

  @media print {
    position: fixed;
    top: 0;
    left: 0;
    border: none;
    border-radius: 0;
  }
`;

const KeyboardArea = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2mm;
`;

const Keyboard = () => {
  const diagram = useAtomValue(diagramAtom);
  const mapping = useAtomValue(mappingAtom);
  const alphabet = useAtomValue(alphabetAtom);
  const { contents, layout } = diagram;
  const reversedMapping = getReversedMapping(mapping, alphabet);
  const processedConents = contents.map((content) => {
    if (content.type === "element") {
      let match: RegExp | undefined;
      if (content.match) {
        try {
          match = new RegExp(content.match);
        } catch {}
      }
      return { ...content, match };
    } else if (content.type === "custom") {
      const mapping: Map<string, string> = new Map();
      content.mapping
        ?.trim()
        .split("\n")
        .forEach((line) => {
          const [key, value] = line.split("\t");
          if (!key || !value) return;
          mapping.set(key, value);
        });
      return { ...content, mapping };
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
                    // 还没有处理双编码的情况
                    for (const { name, code } of mapped) {
                      if (value.match && !value.match.test(name)) {
                        continue;
                      }
                      boxes.push(
                        <ElementLabel name={name} code={code} useProperName />,
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

const Secondary = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 1rem;
`;

const SidebarWrapper = styled.aside`
  padding: 16px;
  float: left;

  @media print {
    display: none;
  }
`;

const withDefaultStyles = (diagram: DiagramConfig): DiagramConfig => {
  const { row_style, cell_style } = diagram;
  return {
    ...diagram,
    row_style: row_style ?? default_row_style,
    cell_style: cell_style ?? default_cell_style,
  };
};

const Sidebar = () => {
  const [diagram, setSchematic] = useAtom(diagramAtom);
  const alphabet = useAtomValue(alphabetAtom);
  const debounced = debounce(setSchematic, 500);
  return (
    <SidebarWrapper>
      <div style={{ textAlign: "center", marginBottom: "1rem" }}>
        <Button type="primary" onClick={() => window.print()}>
          打印图示
        </Button>
      </div>
      <ProForm<DiagramConfig>
        initialValues={withDefaultStyles(diagram)}
        layout="horizontal"
        onValuesChange={async (_, values) => {
          debounced(values);
          return true;
        }}
        submitter={false}
      >
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
            <ProFormSelect<BoxConfig["type"]>
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
                } else if (type === "custom") {
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
      </ProForm>
    </SidebarWrapper>
  );
};

const default_row_style = "display: flex;\njustify-content: center;\ngap: 2mm;";
const default_cell_style =
  "position: relative;\nwidth: 25mm;\nheight: 45mm;\nborder: 0.3mm #d3d3d3 solid;\nborder-radius: 1mm;";

export default function Schematic() {
  useChaifenTitle("图示");
  const diagram = useAtomValue(diagramAtom);
  const { row_style, cell_style, contents } = diagram;
  const { name, author, version, description } = useAtomValue(infoAtom);
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
          <Typography.Title style={{ margin: 0 }}>{name}</Typography.Title>
          <Secondary>
            <Space>
              <Tag color="blue">作者：{author}</Tag>
              <Tag color="cyan">版本：{version}</Tag>
            </Space>
          </Secondary>
        </Flex>
        <Keyboard />
        <div style={{ textAlign: "center" }}>
          &copy; {new Date().getFullYear()} 汉字自动拆分系统
        </div>
      </PrintArea>
      <Sidebar />
    </div>
  );
}
