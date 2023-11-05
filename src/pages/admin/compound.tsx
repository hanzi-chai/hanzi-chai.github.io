import { Checkbox, Flex, Layout, Space } from "antd";
import Table, { ColumnsType } from "antd/es/table";
import Char from "~/components/Char";
import Lookup from "~/components/Lookup";
import { errorFeedback } from "~/components/Utils";
import { useForm } from "~/components/contants";
import { update, useAppDispatch } from "~/components/store";
import { put } from "~/lib/api";
import { Compound, Glyph } from "~/lib/data";
import { displayName } from "~/lib/utils";

interface CompoundTableType {
  key: string;
  ambiguous: 0 | 1;
  compound: Compound;
}

const CompoundTable = () => {
  const form = useForm();
  const dispatch = useAppDispatch();

  const columns: ColumnsType<CompoundTableType> = [
    {
      title: "汉字",
      dataIndex: "key",
      render: (_, record) => {
        return displayName(record.key, form[record.key]);
      },
    },
    {
      title: "Unicode",
      dataIndex: "key",
      render: (_, record) => record.key.codePointAt(0)!,
    },
    {
      title: "歧义",
      dataIndex: "ambiguous",
      render: (_, record) => {
        const char = record.key;
        const glyph = form[record.key];
        return (
          <Checkbox
            checked={record.ambiguous === 1}
            onChange={async (event) => {
              const newGlyph: Glyph = {
                ...glyph,
                ambiguous: event.target.checked ? 1 : 0,
              };
              const result = await put<boolean, Glyph>(
                `form/${char.codePointAt(0)!}`,
                newGlyph,
              );
              console.log(result);
              if (!errorFeedback(result)) {
                console.log(char, newGlyph);
                dispatch(update([char, newGlyph]));
              }
            }}
          />
        );
      },
    },
    {
      title: "分部方式",
      dataIndex: "pinyin",
      render: (_, record) => {
        return (
          <Flex justify="space-between">
            <Space size="middle">
              {record.compound.map((x, i) => (
                <span key={i}>
                  <span>{x.operator}</span>
                  {x.operandList.map((y, j) => (
                    <Char key={j}>{displayName(y, form[y])}</Char>
                  ))}
                </span>
              ))}
            </Space>
          </Flex>
        );
      },
    },
  ];

  const dataSource = Object.entries(form)
    .filter(([x, v]) => v.compound !== undefined)
    .map(([x, v]) => {
      return {
        key: x,
        ambiguous: v.ambiguous!,
        compound: v.compound!,
      };
    })
    .sort((a, b) => {
      return (
        a.compound[0].operandList[0].codePointAt(0)! -
        b.compound[0].operandList[0].codePointAt(0)!
      );
    });
  return (
    <Table
      size="small"
      columns={columns}
      dataSource={dataSource}
      pagination={{
        pageSize: 100,
      }}
    />
  );
};

const CompoundAdmin = () => {
  return (
    <>
      <Flex
        component={Layout.Content}
        style={{ padding: "32px" }}
        vertical
        gap="large"
      >
        <Lookup char="" setChar={() => {}} />
        <CompoundTable />
      </Flex>
    </>
  );
};

export default CompoundAdmin;
