import { Checkbox, Flex, Form, Layout, Space } from "antd";
import type { ColumnsType, ColumnType } from "antd/es/table";
import Table from "antd/es/table";
import { 区块列表, 是用户字符, type 校验字符数据 } from "hanzi-chai";
import { createCharacter, removeCharacter } from "~/api";
import {
  useAtom,
  useAtomValue,
  下一个用户字符码位原子,
  原始字库原子,
  可编辑字符列表原子,
  如字库原子,
  字形来源列表原子,
  用户字符列表原子,
  远程原子,
} from "~/atoms";
import { errorFeedback } from "~/utils";
import CharacterForm from "./CharacterForm";
import GlyphAlgebraForm from "./GlyphAlgebraForm";
import { StrokesView } from "./GlyphView";
import SourceSelect from "./SourceSelect";
import { BoxedElementWithTooltip, DeleteButton } from "./Utils";

const CreateCharacter = () => {
  const 远程 = useAtomValue(远程原子);
  const [用户字符列表, set用户字符列表] = useAtom(用户字符列表原子);
  const [可编辑字符列表, set可编辑字符列表] = useAtom(可编辑字符列表原子);
  const 下一个用户字符码位 = useAtomValue(下一个用户字符码位原子);
  return (
    <CharacterForm
      title="新建"
      initialValues={{ unicode: 0, glyphs: [] }}
      onFinish={async (record) => {
        if (远程) {
          const res = await createCharacter(record);
          if (!errorFeedback(res)) {
            set可编辑字符列表([...可编辑字符列表, record]);
          }
        } else {
          const recordWithUnicode = { ...record, unicode: 下一个用户字符码位 };
          set用户字符列表([...用户字符列表, recordWithUnicode]);
        }
        return true;
      }}
    />
  );
};

const DeleteCharacter = ({ unicode }: { unicode: number }) => {
  const 远程 = useAtomValue(远程原子);
  const [用户字符列表, set用户字符列表] = useAtom(用户字符列表原子);
  const [可编辑字符列表, set可编辑字符列表] = useAtom(可编辑字符列表原子);
  return (
    <DeleteButton
      disabled={!远程 && !是用户字符(unicode)}
      onClick={async () => {
        if (!confirm(`确定删除字符 ${unicode} 吗？`)) return;
        if (远程) {
          const res = await removeCharacter(unicode);
          if (!errorFeedback(res)) {
            set可编辑字符列表(
              可编辑字符列表.filter((x) => x.unicode !== unicode),
            );
          }
        } else {
          set用户字符列表(用户字符列表.filter((x) => x.unicode !== unicode));
        }
      }}
    />
  );
};

type Column = ColumnType<校验字符数据>;

export default function CharacterTable() {
  const 原始字库 = useAtomValue(原始字库原子);
  const 字库 = useAtomValue(如字库原子);
  const 远程 = useAtomValue(远程原子);
  const [字形来源列表, 设置字形来源列表] = useAtom(字形来源列表原子);

  const dataSource: 校验字符数据[] = [...原始字库];

  const unicodeColumn: Column = {
    title: "Unicode",
    dataIndex: "unicode",
    render: (_, { character }) => {
      return (
        <Flex align="center" gap="small">
          <BoxedElementWithTooltip element={character} />
          {character.十六进制()}
        </Flex>
      );
    },
    filters: 区块列表.map((x) => ({ text: x.label, value: x.name })),
    onFilter: (value, record) => {
      return record.character.区块() === value;
    },
    sorter: (a, b) => a.unicode - b.unicode,
    sortDirections: ["ascend", "descend"],
    width: 128,
  };

  const tygfColumn: Column = {
    title: "通用规范",
    dataIndex: "tygf",
    width: 96,
    render: (_, record) => {
      return <Checkbox checked={record.tygf !== undefined} />;
    },
    filters: [
      { text: "一级", value: 1 },
      { text: "二级", value: 2 },
      { text: "三级", value: 3 },
      { text: "否", value: 0 },
    ],
    onFilter: (value, record) => value === record.tygf,
  };

  const gb2312: Column = {
    title: "GB 2312",
    dataIndex: "gb2312",
    render: (_, record) => {
      return <Checkbox checked={record.gb2312 !== undefined} />;
    },
    width: 96,
    filters: [
      { text: "一级", value: 1 },
      { text: "二级", value: 2 },
      { text: "否", value: 0 },
    ],
    onFilter: (value, record) => value === record.gb2312,
  };

  const glyphs: Column = {
    title: "字形列表",
    dataIndex: "glyphs",
    render: (_, character) => {
      return (
        <span>
          {character.glyphs.map(({ id, sources }) => (
            <span key={id}>
              <StrokesView glyph={字库.获取字形(id)!.图形盒子} />(
              {sources.join(", ")})
            </span>
          ))}
        </span>
      );
    },
    sorter: (a, b) => {
      const [as, bs] = [JSON.stringify(a.glyphs), JSON.stringify(b.glyphs)];
      return as.localeCompare(bs);
    },
    sortDirections: ["ascend", "descend"],
  };

  const patches: Column = {
    title: "补丁列表",
    render: (_) => null,
    width: 128,
  };

  const ambiguous: Column = {
    title: "歧义",
    dataIndex: "ambiguous",
    render: (_, record) => {
      return <Checkbox checked={record.ambiguous === 1} />;
    },
    filters: [
      { text: "只看有歧义", value: 1 },
      { text: "只看无歧义", value: 0 },
    ],
    onFilter: (value, record) => Number(record.ambiguous) === value,
    width: 64,
  };

  const operations: Column = {
    title: "操作",
    key: "option",
    render: (_, record) => (
      <Space>
        <CharacterForm
          title="编辑"
          initialValues={record}
          onFinish={async () => {
            return true;
          }}
        />
        <DeleteCharacter unicode={record.unicode} />
      </Space>
    ),
    filters: [
      { text: "已编辑", value: 1 },
      { text: "未编辑", value: 0 },
    ],
    onFilter: (value, record) => {
      const customized = record.character.是用户私用区();
      return value === 1 ? customized : !customized;
    },
  };

  const adminColumns = [
    unicodeColumn,
    tygfColumn,
    gb2312,
    glyphs,
    ambiguous,
    operations,
  ];
  const userColumns = [
    unicodeColumn,
    glyphs,
    patches,
    operations,
    gb2312,
    ambiguous,
  ];
  const columns: ColumnsType<校验字符数据> = 远程 ? adminColumns : userColumns;
  return (
    <Flex
      component={Layout.Content}
      className="overflow-y-scroll"
      vertical
      align="center"
      gap="small"
    >
      <Flex gap="large">
        <Form.Item label="选择字形来源" className="m-0!">
          <SourceSelect value={字形来源列表} onChange={设置字形来源列表} />
        </Form.Item>
        <GlyphAlgebraForm />
        <CreateCharacter />
      </Flex>
      <Table<校验字符数据>
        dataSource={dataSource}
        columns={columns}
        size="small"
        rowKey="unicode"
        pagination={{ defaultPageSize: 50 }}
        className="max-w-480"
      />
    </Flex>
  );
}
