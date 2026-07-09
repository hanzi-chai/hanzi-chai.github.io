import { Checkbox, Flex, Form, Space, Tooltip } from "antd";
import type { ColumnsType, ColumnType } from "antd/es/table";
import Table from "antd/es/table";
import {
  区块列表,
  图形盒子,
  type 字形数据,
  是用户字符,
  type 校验字符数据,
} from "hanzi-chai";
import { useMemo, useState } from "react";
import { createCharacter, removeCharacter, updateCharacter } from "~/api";
import {
  useAtom,
  useAtomValue,
  useAtomValueUnwrapped,
  下一个用户字符码位原子,
  原始字库原子,
  可编辑字符列表原子,
  如按笔顺排序字符原子,
  字库原子,
  字形来源列表原子,
  字形自定义原子,
  用户字符列表原子,
  统一字形列表原子,
  远程原子,
} from "~/atoms";
import { errorFeedback, 字符字形过滤器, type 过滤器参数 } from "~/utils";
import BorderItem from "./BorderItem";
import CharacterForm from "./CharacterForm";
import CharacterGlyphSwitcher from "./CharacterGlyphSwitcher";
import FilterForm from "./FilterForm";
import GlyphAlgebraForm from "./GlyphAlgebraForm";
import { EditOrRedrawGraph } from "./GlyphTable";
import { StrokesView } from "./GlyphView";
import PatchForm from "./PatchForm";
import SourceSelect from "./SourceSelect";
import { BoxedElementWithTooltip, DeleteButton } from "./Utils";

const 字符表跳过码位 = new Set([
  0x04e28, 0x04e36, 0x04e3f, 0x04e40, 0x04e41, 0x04e59, 0x04e5a, 0x04e5b,
  0x0623d, 0x07481, 0x091d2, 0x0990a, 0x09fbb, 0x0f977, 0x0f9a8, 0x0fa0c,
  0x0fa0d, 0x0fa10, 0x0fa12, 0x0fa15, 0x0fa16, 0x0fa17, 0x0fa18, 0x0fa19,
  0x0fa1a, 0x0fa1b, 0x0fa1c, 0x0fa1d, 0x0fa1e, 0x0fa20, 0x0fa22, 0x0fa23,
  0x0fa25, 0x0fa26, 0x0fa2a, 0x0fa2b, 0x0fa2c, 0x0fa2d, 0x0fa72, 0x0fa90,
  0x0faa0, 0x20041, 0x20063, 0x2007d, 0x20087, 0x20088, 0x2008b, 0x200c9,
  0x200ca, 0x200cb, 0x200cc, 0x200cd, 0x200d1, 0x200dc, 0x2010c, 0x2010e,
  0x2010f, 0x20114, 0x2011e, 0x20120, 0x20541, 0x20627, 0x20695, 0x206a4,
  0x2090e, 0x20953, 0x21fe8, 0x22397, 0x22398, 0x2298d, 0x22991, 0x233b3,
  0x23d92, 0x24c12, 0x24d13, 0x24d14, 0x25ad7, 0x268dd, 0x268de, 0x26951,
  0x26b60, 0x27c28, 0x27fb7, 0x2840b, 0x28e0f, 0x2967f, 0x29810, 0x2a6d9,
  0x2b735, 0x2b738, 0x2b740, 0x2bda7, 0x2ceb0, 0x2cf00, 0x2cf02, 0x2d544,
  0x2d80d, 0x2e4d7, 0x2f800, 0x2f802, 0x2f821, 0x2f836, 0x2f83e, 0x2f873,
  0x2f882, 0x2f890, 0x2f8d4, 0x2f8d9, 0x2f8db, 0x2f918, 0x2f91a, 0x2f982,
  0x2f98f, 0x2f9ac, 0x2f9b2, 0x2f9d7, 0x2fa17, 0x30001, 0x30002, 0x30004,
  0x30009, 0x30020, 0x3002a, 0x3005c, 0x300e6, 0x3018a, 0x31350, 0x31f00,
  0x329f1, 0x33473,
]);

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

const EditOrPatchCharacter = ({ record }: { record: 校验字符数据 }) => {
  const 远程 = useAtomValue(远程原子);
  const [可编辑字符列表, set可编辑字符列表] = useAtom(可编辑字符列表原子);
  const [用户字符列表, set用户字符列表] = useAtom(用户字符列表原子);

  return 远程 || record.character.是用户私用区() ? (
    <CharacterForm
      title="编辑"
      initialValues={record}
      onFinish={async (values) => {
        if (远程) {
          const res = await updateCharacter(values);
          if (!errorFeedback(res)) {
            set可编辑字符列表(
              可编辑字符列表.map((x) =>
                x.unicode === values.unicode ? values : x,
              ),
            );
          }
        } else {
          set用户字符列表(
            用户字符列表.map((x) =>
              x.unicode === values.unicode ? values : x,
            ),
          );
        }
        return true;
      }}
    />
  ) : (
    <PatchForm character={record.character} />
  );
};

type Column = ColumnType<校验字符数据>;

export default function CharacterTable() {
  const 原始字库 = useAtomValue(原始字库原子);
  const 字库 = useAtomValue(字库原子);
  const 按笔顺排序字符 = useAtomValueUnwrapped(如按笔顺排序字符原子);
  const [字形来源列表, 设置字形来源列表] = useAtom(字形来源列表原子);
  const 字形自定义 = useAtomValue(字形自定义原子);
  const [filter, setFilter] = useState({} as 过滤器参数);
  const dataSource = useMemo(() => {
    const 过滤器 = new 字符字形过滤器(filter);
    const result: 校验字符数据[] = [];
    for (const character of 按笔顺排序字符) {
      const data = 原始字库.查询(character);
      if (!data) continue;
      if (!过滤器.过滤字符(data.character, data, 字库)) continue;
      if (!字符表跳过码位.has(character.toNumber())) continue;
      result.push(data);
    }
    return result;
  }, [按笔顺排序字符, 原始字库, 字库, filter]);
  const 统一字形列表 = useAtomValue(统一字形列表原子);
  const 统一字形映射 = useMemo(() => {
    const map = new Map<number, 字形数据>();
    for (const glyph of 统一字形列表) {
      map.set(glyph.id, glyph);
    }
    return map;
  }, [统一字形列表]);

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
              <Tooltip title={id}>
                <EditOrRedrawGraph
                  record={统一字形映射.get(id)!}
                  trigger={
                    <BorderItem>
                      <StrokesView glyph={字库.获取字形(id)!.图形盒子} />
                    </BorderItem>
                  }
                  initialChar={character.character.获取名称()}
                />
              </Tooltip>
              <sub className="px-1">{sources.join("")}</sub>
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
    render: (_, record) => {
      const 字符串 = record.character.获取名称();
      const 补丁列表 = 字形自定义[字符串] ?? [];
      const symbol = {
        delete: "−",
        insert: "+",
        update: "±",
      };
      return (
        <span>
          {补丁列表.map((patch, index) => (
            <span key={index}>
              {symbol[patch.type]} ({patch.sources.join(", ")}){" "}
              {patch.type === "delete" ? null : (
                <StrokesView
                  glyph={字库.获取字形(patch.id)?.图形盒子 ?? new 图形盒子()}
                />
              )}
            </span>
          ))}
        </span>
      );
    },
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
        <EditOrPatchCharacter record={record} />
        <DeleteCharacter unicode={record.unicode} />
      </Space>
    ),
    filters: [
      { text: "已编辑", value: 1 },
      { text: "未编辑", value: 0 },
    ],
    onFilter: (value, record) => {
      const customized =
        record.character.是用户私用区() ||
        (字形自定义[record.character.获取名称()]?.length ?? 0) > 0;
      return value === 1 ? customized : !customized;
    },
  };

  const columns: ColumnsType<校验字符数据> = [
    unicodeColumn,
    tygfColumn,
    gb2312,
    glyphs,
    patches,
    ambiguous,
    operations,
  ];

  return (
    <Flex className="overflow-y-scroll" vertical align="center" gap="small">
      <FilterForm setFilter={setFilter} />
      <Flex gap="large">
        <CharacterGlyphSwitcher />
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
