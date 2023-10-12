import React, { useState, useRef, useEffect, useContext } from "react";
import type { InputRef } from "antd";
import { Form, Input, Table } from "antd";
import type { FormInstance } from "antd/es/form";
import { useCharacters, useModify } from "./context";
import { SearchOutlined } from "@ant-design/icons";
import styled from "styled-components";

const EditableContext = React.createContext<FormInstance | null>(null);

interface Item {
  key: string;
  name: string;
  age: string;
  address: string;
}

interface EditableRowProps {
  index: number;
}

const EditableTr = styled.tr`
  &:hover .editable-cell-value-wrap {
    padding: 4px 11px;
    border: 1px solid #d9d9d9;
    border-radius: 2px;
  }
`;

const EditableRow: React.FC<EditableRowProps> = (props) => {
  const [form] = Form.useForm();
  const { index: _index, ...rest } = props;
  return (
    <Form form={form} component={false}>
      <EditableContext.Provider value={form}>
        <EditableTr {...rest} />
      </EditableContext.Provider>
    </Form>
  );
};

interface EditableCellProps {
  title: React.ReactNode;
  editable: boolean;
  children: React.ReactNode;
  dataIndex: keyof Item;
  record: Item;
  handleSave: (record: Item) => void;
}

const EditableCellValueWrap = styled.div`
  padding: 5px 12px;
  cursor: pointer;
  padding-right: 24;
`;

const EditableCell: React.FC<EditableCellProps> = ({
  title,
  editable,
  children,
  dataIndex,
  record,
  handleSave,
  ...restProps
}) => {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<InputRef>(null);
  const form = useContext(EditableContext)!;

  useEffect(() => {
    if (editing) {
      inputRef.current!.focus();
    }
  }, [editing]);

  const toggleEdit = () => {
    setEditing(!editing);
    form.setFieldsValue({ [dataIndex]: record[dataIndex] });
  };

  const save = async () => {
    const values = await form.validateFields();

    toggleEdit();
    handleSave({ ...record, ...values });
  };

  let childNode = children;

  if (editable) {
    childNode = editing ? (
      <Form.Item
        style={{ margin: 0 }}
        name={dataIndex}
        rules={[
          {
            required: true,
            message: `${title} is required.`,
          },
        ]}
      >
        <Input ref={inputRef} onPressEnter={save} onBlur={save} />
      </Form.Item>
    ) : (
      <EditableCellValueWrap onClick={toggleEdit}>
        {children}
      </EditableCellValueWrap>
    );
  }

  return (
    <td style={{ position: "relative" }} {...restProps}>
      {childNode}
    </td>
  );
};

type EditableTableProps = Parameters<typeof Table>[0];

interface DataType {
  key: string;
  pinyin: string[];
}

type ColumnTypes = Exclude<EditableTableProps["columns"], undefined>;

const EditableTable: React.FC = () => {
  const characters = useCharacters();
  const modify = useModify();
  const [character, setCharacter] = useState<string>("");
  const rawdata = Object.entries(characters).map(([k, v]) => ({
    key: k,
    pinyin: v,
  }));
  const dataSource = character
    ? rawdata.filter((x) => x.key === character)
    : rawdata;

  // const handleDelete = (key: React.Key) => {
  //   const newData = dataSource.filter((item) => item.key !== key);
  //   setDataSource(newData);
  // };

  const defaultColumns: (ColumnTypes[number] & {
    editable?: boolean;
    dataIndex: string;
  })[] = [
    {
      title: "汉字",
      dataIndex: "key",
      width: "30%",
    },
    {
      title: "字音",
      dataIndex: "pinyin",
      render: (_, record) => {
        return record.pinyin.join(",");
      },
      editable: true,
    },
  ];

  // const handleAdd = () => {
  //   const newData: DataType = {
  //     key: count,
  //     name: `Edward King ${count}`,
  //     age: '32',
  //     address: `London, Park Lane no. ${count}`,
  //   };
  //   setDataSource([...dataSource, newData]);
  //   setCount(count + 1);
  // };

  const handleSave = (row: DataType) => {
    modify(row.key, (row.pinyin as unknown as string).split(","));
  };

  const components = {
    body: {
      row: EditableRow,
      cell: EditableCell,
    },
  };

  const columns = defaultColumns.map((col) => {
    if (!col.editable) {
      return col;
    }
    return {
      ...col,
      onCell: (record: DataType) => ({
        record,
        editable: col.editable,
        dataIndex: col.dataIndex,
        title: col.title,
        handleSave,
      }),
    };
  });

  return (
    <Wrapper>
      <Input
        placeholder="搜索汉字"
        prefix={<SearchOutlined />}
        value={character}
        onChange={(event) => {
          setCharacter(event.target.value);
        }}
        style={{ maxWidth: "200px", margin: "0 auto" }}
      />
      <Table
        components={components}
        rowClassName={() => "editable-row"}
        bordered
        dataSource={dataSource}
        columns={columns as ColumnTypes}
        pagination={{
          total: dataSource.length,
          pageSize: 10,
        }}
      />
    </Wrapper>
  );
};

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow-y: scroll;
`;

export default EditableTable;
