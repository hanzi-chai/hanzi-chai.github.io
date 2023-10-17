import {
  Button,
  Col,
  ColProps,
  InputNumber,
  Row,
  RowProps,
  Upload,
  Select as _Select,
} from "antd";
import styled from "styled-components";

const ScrollableRow = styled(Row)`
  height: 100%;
  overflow-y: auto;
`;

export const EditorRow = (props: RowProps) => (
  <ScrollableRow {...props} gutter={32} />
);

const ScrollableColumn = styled(Col)`
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

export const EditorColumn = (props: ColProps) => (
  <ScrollableColumn className="gutter-row" {...props} />
);

export const NumberInput = styled(InputNumber)`
  width: 48px;
  & .ant-input-number-input {
    padding: 4px 8px;
  }
`;

export const Select = styled(_Select)`
  width: 128px;
` as typeof _Select;

export const Uploader = ({ action }: { action: (s: string) => void }) => {
  return (
    <Upload
      accept=".yaml"
      customRequest={({ file }) => {
        const reader = new FileReader();
        reader.addEventListener("load", () => action(reader.result as string));
        reader.readAsText(file as File);
      }}
      maxCount={1}
      showUploadList={false}
    >
      <Button>导入</Button>
    </Upload>
  );
};
